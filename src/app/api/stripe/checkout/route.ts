import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { getRequestIp, recordAuditEvent } from "@/lib/server/audit";
import { PRICING_PLANS } from "@/lib/pricing/plans";
import { includedVatFromGross } from "@/lib/pricing/vat";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-04-22.dahlia",
});
const stripeAutomaticTaxEnabled =
  process.env.STRIPE_AUTOMATIC_TAX_ENABLED === "true";
const DEFAULT_SHIPPING_FEE_SEK = 99;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

function toOre(amountSek: number) {
  return Math.round(amountSek * 100);
}

function checkoutImageUrl(appUrl: string, path: string) {
  const imageBaseUrl = appUrl.includes("localhost")
    ? "https://infosync.se"
    : appUrl;

  return new URL(path, imageBaseUrl).toString();
}

async function withTimeout<T>(promise: PromiseLike<T>, timeoutMs: number): Promise<T | null> {
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<null>((resolve) => {
        timeout = setTimeout(() => resolve(null), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

type QuoteItem = {
  pricingPlanCode?: string;
  quantity?: number;
  hardwareFeeSek?: number;
  shippingFeeSek?: number;
  monthlyFeeSek?: number;
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { customerId, email, pricingPlanCode, legalAccepted } = body;
    const ipAddress = getRequestIp(request);
    const userAgent = request.headers.get("user-agent");

    if (!customerId || !email) {
      return NextResponse.json(
        { error: "Kund eller e-post saknas." },
        { status: 400 },
      );
    }

    if (!legalAccepted) {
      return NextResponse.json(
        { error: "Villkoren måste godkännas före betalning." },
        { status: 400 },
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL;

    if (!appUrl) {
      return NextResponse.json(
        { error: "Appens URL saknas." },
        { status: 500 },
      );
    }

    const { data: customer, error: customerError } = await supabaseAdmin
      .from("customers")
      .select(
        "id, name, email, phone, country, postal_code, address, city, stripe_customer_id",
      )
      .eq("id", customerId)
      .single();

    if (customerError || !customer) {
      return NextResponse.json({ error: "Kunden hittades inte." }, { status: 404 });
    }

    if (
      !customer.address ||
      !customer.city ||
      !/^\d{5}$/.test(String(customer.postal_code || "")) ||
      !["sverige", "sweden", "se"].includes(String(customer.country || "").toLowerCase())
    ) {
      return NextResponse.json(
        {
          error:
            "Komplettera svensk leveransadress och postnummer innan betalning.",
        },
        { status: 400 },
      );
    }

    const { data: quotedOrder, error: quotedOrderError } = await supabaseAdmin
      .from("customer_subscriptions")
      .select(
        "id, order_number, screen_quantity, device_discount_percent, device_discount_months, quote_items, pricing_plan_id, pricing_plans(*)",
      )
      .eq("customer_id", customerId)
      .in("status", ["quote_prepared", "quote_sent", "checkout_started"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (
      quotedOrderError?.code === "42703" ||
      quotedOrderError?.code === "PGRST204"
    ) {
      return NextResponse.json(
        {
          error:
            "Databasen saknar de senaste orderkolumnerna. Kör de senaste Supabase-migreringarna innan betalning startas.",
        },
        { status: 409 },
      );
    }

    const relatedPlan = Array.isArray(quotedOrder?.pricing_plans)
      ? quotedOrder?.pricing_plans[0]
      : quotedOrder?.pricing_plans;
    let plan = relatedPlan || null;
    let planError = null;

    if (!plan) {
      const planQuery = supabaseAdmin
        .from("pricing_plans")
        .select("*")
        .eq("is_active", true);
      const planResult = pricingPlanCode
        ? await planQuery.eq("code", pricingPlanCode).single()
        : await planQuery.eq("id", quotedOrder?.pricing_plan_id || "").single();

      plan = planResult.data;
      planError = planResult.error;
    }

    if (planError || !plan) {
      const quotedPlanCode =
        Array.isArray(quotedOrder?.quote_items) &&
        quotedOrder.quote_items.length > 0
          ? (quotedOrder.quote_items[0] as QuoteItem).pricingPlanCode
          : pricingPlanCode;
      const fallbackPlan = PRICING_PLANS.find(
        (item) => item.code === quotedPlanCode,
      );

      if (fallbackPlan && quotedOrder?.pricing_plan_id) {
        plan = {
          id: quotedOrder.pricing_plan_id,
          code: fallbackPlan.code,
          name: fallbackPlan.name,
          resolution: fallbackPlan.resolution,
          setup_fee_sek: fallbackPlan.setupFeeSek,
          hardware_fee_sek: fallbackPlan.hardwareFeeSek,
          shipping_fee_sek: fallbackPlan.shippingFeeSek,
          monthly_fee_sek: fallbackPlan.monthlyFeeSek,
          trial_days: fallbackPlan.trialDays,
          currency: "sek",
          tax_behavior: "inclusive",
        };
        planError = null;
      }
    }

    if (planError || !plan) {
      return NextResponse.json(
        {
          error:
            "Prispaketet hittades inte. Be InfoSync kontrollera offerten innan betalning.",
        },
        { status: 404 },
      );
    }

    const configuredPlan = PRICING_PLANS.find((item) => item.code === plan.code);
    const hardwareFeeSek =
      plan.hardware_fee_sek ??
      configuredPlan?.hardwareFeeSek ??
      0;
    const shippingFeeSek = plan.shipping_fee_sek ?? DEFAULT_SHIPPING_FEE_SEK;
    const currency = plan.currency || "sek";
    const priceTaxBehavior =
      plan.tax_behavior === "exclusive"
        ? ("exclusive" as const)
        : ("inclusive" as const);

    const screenQuantity = Math.min(
      50,
      Math.max(1, Number(quotedOrder?.screen_quantity) || 1),
    );
    const deviceDiscountPercent = Math.min(
      100,
      Math.max(0, Number(quotedOrder?.device_discount_percent) || 0),
    );
    const deviceDiscountMonths = Math.min(
      36,
      Math.max(0, Number(quotedOrder?.device_discount_months) || 0),
    );
    const discountedHardwareFeeSek = Math.max(
      0,
      Math.round(hardwareFeeSek * (1 - deviceDiscountPercent / 100)),
    );
    const quoteItems =
      Array.isArray(quotedOrder?.quote_items) &&
      quotedOrder.quote_items.length > 0
        ? (quotedOrder.quote_items as QuoteItem[])
        : [
            {
              pricingPlanCode: plan.code,
              quantity: screenQuantity,
              hardwareFeeSek,
              shippingFeeSek,
              monthlyFeeSek: plan.monthly_fee_sek,
            },
          ];
    const quotePlanCodes = Array.from(
      new Set(
        quoteItems
          .map((item) => item.pricingPlanCode)
          .filter((code): code is string => Boolean(code)),
      ),
    );
    const quotePlansResult = await withTimeout(
      supabaseAdmin
        .from("pricing_plans")
        .select(
          "code, name, resolution, hardware_fee_sek, shipping_fee_sek, monthly_fee_sek",
        )
        .in("code", quotePlanCodes),
      3000,
    );
    const quotePlans = quotePlansResult?.data || [];
    const checkoutQuoteItems = quoteItems.map((item) => {
      const itemPlan =
        quotePlans?.find((row) => row.code === item.pricingPlanCode) || plan;
      const configuredPlan = PRICING_PLANS.find(
        (pricingPlan) => pricingPlan.code === itemPlan.code,
      );
      const itemHardwareFee =
        item.hardwareFeeSek ??
        itemPlan.hardware_fee_sek ??
        configuredPlan?.hardwareFeeSek ??
        0;
      const itemShippingFee =
        item.shippingFeeSek ??
        itemPlan.shipping_fee_sek ??
        configuredPlan?.shippingFeeSek ??
        DEFAULT_SHIPPING_FEE_SEK;
      const quantity = Math.min(50, Math.max(1, Number(item.quantity) || 1));

      return {
        code: itemPlan.code,
        name: itemPlan.name,
        resolution: itemPlan.resolution,
        quantity,
        hardwareFeeSek: itemHardwareFee,
        discountedHardwareFeeSek: Math.max(
          0,
          Math.round(itemHardwareFee * (1 - deviceDiscountPercent / 100)),
        ),
        shippingFeeSek: itemShippingFee,
        monthlyFeeSek: item.monthlyFeeSek ?? itemPlan.monthly_fee_sek,
      };
    });
    const checkoutScreenQuantity = checkoutQuoteItems.reduce(
      (sum, item) => sum + item.quantity,
      0,
    );
    const expectedInitialPaymentSek =
      plan.setup_fee_sek +
      checkoutQuoteItems.reduce(
        (sum, item) =>
          sum +
          item.discountedHardwareFeeSek * item.quantity +
          item.shippingFeeSek * item.quantity,
        0,
      );
    const expectedInitialVatOre = toOre(
      includedVatFromGross(expectedInitialPaymentSek).vat,
    );

    const orderPayload = {
        customer_id: customerId,
        pricing_plan_id: plan.id,
        status: "checkout_started",
        currency,
        setup_fee_sek: plan.setup_fee_sek,
        hardware_fee_sek: hardwareFeeSek,
        shipping_fee_sek: shippingFeeSek,
        monthly_fee_sek: plan.monthly_fee_sek,
        trial_days: plan.trial_days,
        tax_status: stripeAutomaticTaxEnabled ? "pending" : "not_enabled",
        fulfillment_status: "pending",
        inventory_status: "not_reserved",
        legal_acceptance_at: new Date().toISOString(),
        legal_acceptance_ip: ipAddress,
        screen_quantity: checkoutScreenQuantity,
        device_discount_percent: deviceDiscountPercent,
        device_discount_months: deviceDiscountMonths,
        device_discount_amount_sek: checkoutQuoteItems.reduce(
          (sum, item) =>
            sum +
            (item.hardwareFeeSek - item.discountedHardwareFeeSek) *
              item.quantity,
          0,
        ),
        monthly_discount_amount_sek:
          deviceDiscountMonths > 0
            ? Math.round(
                checkoutQuoteItems.reduce(
                  (sum, item) => sum + item.monthlyFeeSek * item.quantity,
                  0,
                ) *
                  (deviceDiscountPercent / 100),
              )
            : 0,
        quote_items: checkoutQuoteItems.map((item) => ({
          pricingPlanCode: item.code,
          name: item.name,
          resolution: item.resolution,
          quantity: item.quantity,
          hardwareFeeSek: item.hardwareFeeSek,
          shippingFeeSek: item.shippingFeeSek,
          monthlyFeeSek: item.monthlyFeeSek,
        })),
      };

    const { data: order, error: orderError } = quotedOrder
      ? await supabaseAdmin
          .from("customer_subscriptions")
          .update(orderPayload)
          .eq("id", quotedOrder.id)
          .select("id, order_number")
          .single()
      : await supabaseAdmin
          .from("customer_subscriptions")
          .insert(orderPayload)
          .select("id, order_number")
          .single();

    if (orderError || !order) {
      if (orderError?.code === "42703" || orderError?.code === "PGRST204") {
        return NextResponse.json(
          {
            error:
              "Databasen saknar de senaste orderkolumnerna. Kör de senaste Supabase-migreringarna innan betalning startas.",
          },
          { status: 409 },
        );
      }

      console.error("Create order error:", orderError);
      return NextResponse.json(
        { error: "Det gick inte att skapa ordern." },
        { status: 500 },
      );
    }

    const coupon =
      deviceDiscountPercent > 0 && deviceDiscountMonths > 0
        ? await stripe.coupons.create({
            percent_off: deviceDiscountPercent,
            duration: "repeating",
            duration_in_months: deviceDiscountMonths,
            name: `InfoSync device discount ${deviceDiscountPercent}%`,
            metadata: {
              customer_id: customerId,
              order_number: order.order_number,
            },
          })
        : null;
    const setupImage = checkoutImageUrl(appUrl, "/brand/infosync-logo-full-white-bg.png");
    const deviceImage = checkoutImageUrl(appUrl, "/brand/infosync-helper.png");
    const subscriptionImage = checkoutImageUrl(appUrl, "/brand/infosync-icon-512-transparent.png");
    const stripeAddress = {
      city: customer.city,
      country: "SE",
      line1: customer.address,
      postal_code: String(customer.postal_code || "").replace(/\s/g, ""),
    };
    const stripeCustomerPayload = {
      address: stripeAddress,
      email,
      metadata: {
        customer_id: customerId,
      },
      name: customer.name || undefined,
      phone: customer.phone || undefined,
      shipping: {
        address: stripeAddress,
        name: customer.name || email,
        phone: customer.phone || undefined,
      },
    };
    const stripeCustomer = customer.stripe_customer_id
      ? await stripe.customers.update(
          customer.stripe_customer_id,
          stripeCustomerPayload,
        )
      : await stripe.customers.create(stripeCustomerPayload);

    if (!customer.stripe_customer_id) {
      await supabaseAdmin
        .from("customers")
        .update({ stripe_customer_id: stripeCustomer.id })
        .eq("id", customerId);
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: stripeCustomer.id,
      client_reference_id: order.order_number,
      locale: "sv",
      automatic_tax: {
        enabled: stripeAutomaticTaxEnabled,
      },
      shipping_address_collection: {
        allowed_countries: ["SE"],
      },
      billing_address_collection: stripeAutomaticTaxEnabled
        ? "required"
        : "auto",
      tax_id_collection: {
        enabled: stripeAutomaticTaxEnabled,
      },
      customer_update: {
        address: "auto",
        name: "auto",
        shipping: "auto",
      },
      line_items: [
        {
          price_data: {
            currency,
            unit_amount: toOre(plan.setup_fee_sek),
            tax_behavior: priceTaxBehavior,
            product_data: {
              name: `${plan.name} start- och konfigurationsavgift`,
              description: "Engångsavgift. Återbetalas inte när setupen har startat.",
              images: [setupImage],
            },
          },
          quantity: 1,
        },
        ...((checkoutQuoteItems[0]?.discountedHardwareFeeSek ?? discountedHardwareFeeSek) > 0
          ? [
              {
                price_data: {
                  currency,
                  unit_amount: toOre(
                    checkoutQuoteItems[0]?.discountedHardwareFeeSek ??
                      discountedHardwareFeeSek,
                  ),
                  tax_behavior: priceTaxBehavior,
                  product_data: {
                    name: `${plan.name} ${plan.resolution} skärmenhet`,
                    images: [deviceImage],
                  },
                },
                quantity: checkoutQuoteItems[0]?.quantity ?? screenQuantity,
              },
            ]
          : []),
        {
          price_data: {
            currency,
            unit_amount: toOre(checkoutQuoteItems[0]?.shippingFeeSek ?? shippingFeeSek),
            tax_behavior: priceTaxBehavior,
            product_data: {
              name: "Frakt inom Sverige",
              images: [subscriptionImage],
            },
          },
          quantity: checkoutScreenQuantity,
        },
        {
          price_data: {
            currency,
            unit_amount: toOre(checkoutQuoteItems[0]?.monthlyFeeSek ?? plan.monthly_fee_sek),
            tax_behavior: priceTaxBehavior,
            recurring: {
              interval: "month",
            },
            product_data: {
              name: `InfoSync ${plan.name} ${plan.resolution} månadsabonnemang`,
              images: [subscriptionImage],
            },
          },
          quantity: checkoutQuoteItems[0]?.quantity ?? 1,
        },
        ...checkoutQuoteItems.slice(1).flatMap((item) => [
          ...(item.discountedHardwareFeeSek > 0
            ? [
                {
                  price_data: {
                    currency,
                    unit_amount: toOre(item.discountedHardwareFeeSek),
                    tax_behavior: priceTaxBehavior,
                    product_data: {
                      name: `${item.name} ${item.resolution} skärmenhet`,
                      images: [deviceImage],
                    },
                  },
                  quantity: item.quantity,
                },
              ]
            : []),
          {
            price_data: {
              currency,
              unit_amount: toOre(item.shippingFeeSek),
              tax_behavior: priceTaxBehavior,
              product_data: {
                name: `Frakt ${item.name} ${item.resolution}`,
                images: [subscriptionImage],
              },
            },
            quantity: item.quantity,
          },
          {
            price_data: {
              currency,
              unit_amount: toOre(item.monthlyFeeSek),
              tax_behavior: priceTaxBehavior,
              recurring: {
                interval: "month" as const,
              },
              product_data: {
                name: `InfoSync ${item.name} ${item.resolution} månadsabonnemang`,
                images: [subscriptionImage],
              },
            },
            quantity: item.quantity,
          },
        ]),
      ],
      subscription_data: {
        trial_period_days: plan.trial_days,
        metadata: {
          customer_id: customerId,
          customer_subscription_id: order.id,
          order_number: order.order_number,
          pricing_plan_id: plan.id,
          pricing_plan_code: plan.code,
          screen_quantity: String(checkoutScreenQuantity),
          device_discount_percent: String(deviceDiscountPercent),
          device_discount_months: String(deviceDiscountMonths),
          stripe_discount_coupon_id: coupon?.id || "",
        },
      },
      success_url: `${appUrl}/onboarding/payment-success?customer_id=${customerId}`,
      cancel_url: `${appUrl}/onboarding/payment-cancelled`,
      metadata: {
        customer_id: customerId,
        customer_subscription_id: order.id,
        order_number: order.order_number,
        pricing_plan_id: plan.id,
        pricing_plan_code: plan.code,
        screen_quantity: String(checkoutScreenQuantity),
        device_discount_percent: String(deviceDiscountPercent),
        device_discount_months: String(deviceDiscountMonths),
        stripe_discount_coupon_id: coupon?.id || "",
      },
    });

    await supabaseAdmin
      .from("customer_subscriptions")
      .update({
        stripe_checkout_session_id: session.id,
        tax_status: session.automatic_tax?.enabled
          ? session.automatic_tax.status || "pending"
          : "not_enabled",
        tax_amount_sek:
          session.total_details?.amount_tax || expectedInitialVatOre,
        total_amount_sek:
          session.amount_total ?? toOre(expectedInitialPaymentSek),
        stripe_payment_status: session.payment_status,
        stripe_discount_coupon_id: coupon?.id ?? null,
      })
      .eq("id", order.id);

    await recordAuditEvent(supabaseAdmin, {
      customerId,
      actorType: "customer",
      eventType: "stripe_checkout_started",
      eventDescription: "Customer started Stripe checkout from onboarding.",
      metadata: {
        pricingPlanCode: plan.code,
        pricingPlanId: plan.id,
        customerSubscriptionId: order.id,
        orderNumber: order.order_number,
        stripeCheckoutSessionId: session.id,
        stripeAutomaticTaxEnabled,
      },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ url: session.url, orderNumber: order.order_number });
  } catch (error) {
    console.error("Stripe checkout error:", error);

    return NextResponse.json(
      { error: "Det gick inte att starta betalningen." },
      { status: 500 },
    );
  }
}
