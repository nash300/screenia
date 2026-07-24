import { NextResponse } from "next/server";
import { getAuthenticatedAdmin, supabaseAdmin } from "@/lib/server/admin-api";
import { stripe } from "./stripe-checkout-client";
import {
  recordCheckoutLocalSyncFailure,
  type CheckoutFailureContext,
} from "./stripe-checkout-failure";
import { hasRequiredLegalEvidence } from "./stripe-checkout-legal";
import {
  checkoutImageUrl,
  isLiveStripeKey,
  isValidEmail,
  normalizeEmail,
  staticPriceLineItem,
  stripeAutomaticTaxEnabled,
  subscriptionItemForMonthlyCharge,
  toOre,
  withTimeout,
  type CheckoutLineItem,
  type QuoteItem,
} from "./stripe-checkout-utils";
import { getRequestIp, recordAuditEvent } from "@/lib/server/audit";
import { createAdminNotification } from "@/lib/server/admin-notifications";
import { getLiveCheckoutBlockers } from "@/lib/server/live-checkout-readiness";
import { PRICING_PLANS } from "@/lib/pricing/plans";
import {
  ADDITIONAL_SETUP_FEE_PER_SCREEN_SEK,
  INCLUDED_SETUP_SCREEN_COUNT,
  additionalSetupScreenCount,
  calculateSetupFeeSek,
} from "@/lib/pricing/setup-fee";
import {
  ADDITIONAL_SHIPPING_FEE_PER_DEVICE_SEK,
  INCLUDED_SHIPPING_DEVICE_COUNT,
  additionalShippingDeviceCount,
  calculateShippingFeeSek,
} from "@/lib/pricing/shipping-fee";
import { includedVatFromGross } from "@/lib/pricing/vat";
import {
  isValidSwedishRegistrationNumber,
  normalizeSwedishRegistrationNumber,
} from "@/lib/business/sweden";

export async function POST(request: Request) {
  const ipAddress = getRequestIp(request);
  const userAgent = request.headers.get("user-agent");
  const failureContext: CheckoutFailureContext = {};

  try {
    const body = await request.json();
    const { customerId, email, pricingPlanCode, legalAccepted } = body;
    const onboardingToken = String(body.onboardingToken || "").trim();
    failureContext.customerId = String(customerId || "").trim() || undefined;

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

    if (isLiveStripeKey()) {
      const liveCheckoutBlockers =
        await getLiveCheckoutBlockers(supabaseAdmin);

      if (liveCheckoutBlockers.length > 0) {
        return NextResponse.json(
          {
            error: `Livebetalningar är spärrade tills alla lanseringskontroller är klara: ${liveCheckoutBlockers.join(
              ", ",
            )}.`,
          },
          { status: 403 },
        );
      }
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
        "id, name, email, billing_email, organisation_number, phone, country, postal_code, address, city, stripe_customer_id, stripe_subscription_id, onboarding_token, onboarding_token_expires_at",
      )
      .eq("id", customerId)
      .single();

    if (customerError || !customer) {
      return NextResponse.json({ error: "Kunden hittades inte." }, { status: 404 });
    }

    const authenticatedAdmin = await getAuthenticatedAdmin();

    if (!authenticatedAdmin) {
      const tokenExpiresAt = customer.onboarding_token_expires_at
        ? new Date(customer.onboarding_token_expires_at)
        : null;
      const tokenExpired = tokenExpiresAt ? tokenExpiresAt < new Date() : true;

      if (
        !onboardingToken ||
        onboardingToken !== customer.onboarding_token ||
        tokenExpired
      ) {
        return NextResponse.json(
          {
            error:
              "Startlänken saknas eller har gått ut. Be Screenia skicka en ny betalningslänk.",
          },
          { status: 401 },
        );
      }
    }

    const storedCustomerEmail = normalizeEmail(customer.email);
    const submittedEmail = normalizeEmail(email);
    const billingEmail = normalizeEmail(customer.billing_email);
    const stripeBillingEmail = billingEmail || storedCustomerEmail;

    if (!isValidEmail(storedCustomerEmail)) {
      return NextResponse.json(
        {
          error:
            "Kundens kontoe-postadress saknas eller är ogiltig. Kontakta Screenia innan betalning.",
        },
        { status: 400 },
      );
    }

    if (billingEmail && !isValidEmail(billingEmail)) {
      return NextResponse.json(
        {
          error:
            "Faktura-e-postadressen är ogiltig. Uppdatera kunduppgifterna innan betalning.",
        },
        { status: 400 },
      );
    }

    if (!isValidEmail(submittedEmail)) {
      return NextResponse.json(
        { error: "Ange en giltig betalnings-e-postadress." },
        { status: 400 },
      );
    }

    if (submittedEmail !== storedCustomerEmail) {
      return NextResponse.json(
        {
          error:
            "Betalnings-e-posten matchar inte kundens registrerade e-postadress.",
        },
        { status: 403 },
      );
    }

    if (
      !customer.organisation_number ||
      !isValidSwedishRegistrationNumber(customer.organisation_number)
    ) {
      return NextResponse.json(
        {
          error:
            "Kundens organisationsnummer saknas eller är ogiltigt. Uppdatera kunduppgifterna innan betalning.",
        },
        { status: 400 },
      );
    }

    const normalizedOrganisationNumber =
      normalizeSwedishRegistrationNumber(customer.organisation_number);

    const legalEvidence = await hasRequiredLegalEvidence(customerId);

    if (!legalEvidence.ok) {
      return NextResponse.json(
        { error: legalEvidence.error },
        { status: 409 },
      );
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
        "id, order_number, screen_quantity, setup_fee_sek, base_setup_fee_sek, setup_included_screens, additional_setup_fee_per_screen_sek, additional_setup_screen_count, shipping_fee_sek, base_shipping_fee_sek, shipping_included_devices, additional_shipping_fee_per_device_sek, additional_shipping_device_count, device_discount_percent, device_discount_months, quote_items, pricing_plan_id, pricing_plans(*)",
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
          setup_included_screens: INCLUDED_SETUP_SCREEN_COUNT,
          additional_setup_fee_sek: ADDITIONAL_SETUP_FEE_PER_SCREEN_SEK,
          stripe_additional_setup_price_id: null,
          hardware_fee_sek: fallbackPlan.hardwareFeeSek,
          shipping_fee_sek: fallbackPlan.shippingFeeSek,
          shipping_included_devices: fallbackPlan.shippingIncludedDevices,
          additional_shipping_fee_sek: fallbackPlan.additionalShippingFeeSek,
          stripe_additional_shipping_price_id: null,
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
            "Prispaketet hittades inte. Be Screenia kontrollera offerten innan betalning.",
        },
        { status: 404 },
      );
    }
    failureContext.pricingPlanCode = plan.code;

    const configuredPlan = PRICING_PLANS.find((item) => item.code === plan.code);
    const hardwareFeeSek =
      plan.hardware_fee_sek ??
      configuredPlan?.hardwareFeeSek ??
      0;
    const baseShippingFeeSek =
      Number(quotedOrder?.base_shipping_fee_sek) ||
      plan.shipping_fee_sek ||
      configuredPlan?.shippingFeeSek ||
      99;
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
    const quoteItems: QuoteItem[] =
      Array.isArray(quotedOrder?.quote_items) &&
      quotedOrder.quote_items.length > 0
        ? (quotedOrder.quote_items as QuoteItem[])
        : [
            {
              pricingPlanCode: plan.code,
              quantity: screenQuantity,
              hardwareFeeSek,
              monthlyFeeSek: plan.monthly_fee_sek,
            },
          ];
    const isExistingCustomerAddOn = quoteItems.some(
      (item) => item.orderType === "existing_customer_add_on",
    );
    const existingStripeSubscriptionId =
      isExistingCustomerAddOn && customer.stripe_subscription_id
        ? String(customer.stripe_subscription_id)
        : null;
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
          "code, name, resolution, hardware_fee_sek, shipping_fee_sek, monthly_fee_sek, stripe_hardware_price_id, stripe_monthly_price_id",
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
      const quantity = Math.min(50, Math.max(1, Number(item.quantity) || 1));

      return {
        code: itemPlan.code,
        name: itemPlan.name,
        resolution: itemPlan.resolution,
        quantity,
        hardwareFeeSek: itemHardwareFee,
        discountedHardwareFeeSek: itemHardwareFee,
        monthlyFeeSek: item.monthlyFeeSek ?? itemPlan.monthly_fee_sek,
        stripeHardwarePriceId: itemPlan.stripe_hardware_price_id,
        stripeMonthlyPriceId: itemPlan.stripe_monthly_price_id,
      };
    });
    const checkoutScreenQuantity = checkoutQuoteItems.reduce(
      (sum, item) => sum + item.quantity,
      0,
    );
    const baseSetupFeeSek = quotedOrder
      ? Number(quotedOrder.base_setup_fee_sek) || 0
      : plan.setup_fee_sek;
    const setupIncludedScreens =
      Number(quotedOrder?.setup_included_screens) ||
      plan.setup_included_screens ||
      INCLUDED_SETUP_SCREEN_COUNT;
    const additionalSetupFeeSek =
      Number(quotedOrder?.additional_setup_fee_per_screen_sek) ||
      plan.additional_setup_fee_sek ||
      ADDITIONAL_SETUP_FEE_PER_SCREEN_SEK;
    const additionalSetupScreens = quotedOrder
      ? Number(quotedOrder.additional_setup_screen_count) || 0
      : additionalSetupScreenCount(checkoutScreenQuantity, setupIncludedScreens);
    const setupFeeSek = quotedOrder
      ? Number(quotedOrder.setup_fee_sek) || 0
      : calculateSetupFeeSek(
          checkoutScreenQuantity,
          baseSetupFeeSek,
          setupIncludedScreens,
          additionalSetupFeeSek,
        );
    const shippingIncludedDevices =
      Number(quotedOrder?.shipping_included_devices) ||
      plan.shipping_included_devices ||
      INCLUDED_SHIPPING_DEVICE_COUNT;
    const additionalShippingFeeSek =
      Number(quotedOrder?.additional_shipping_fee_per_device_sek) ||
      plan.additional_shipping_fee_sek ||
      ADDITIONAL_SHIPPING_FEE_PER_DEVICE_SEK;
    const additionalShippingDevices = quotedOrder
      ? Number(quotedOrder.additional_shipping_device_count) || 0
      : additionalShippingDeviceCount(
          checkoutScreenQuantity,
          shippingIncludedDevices,
        );
    const shippingFeeSek = quotedOrder
      ? Number(quotedOrder.shipping_fee_sek) || 0
      : calculateShippingFeeSek(
          checkoutScreenQuantity,
          baseShippingFeeSek,
          shippingIncludedDevices,
          additionalShippingFeeSek,
        );
    const expectedInitialPaymentSek =
      setupFeeSek +
      checkoutQuoteItems.reduce(
        (sum, item) =>
          sum +
          item.discountedHardwareFeeSek * item.quantity,
        0,
      ) +
      shippingFeeSek;
    const expectedInitialVatOre = toOre(
      includedVatFromGross(expectedInitialPaymentSek).vat,
    );

    const orderPayload = {
        customer_id: customerId,
        pricing_plan_id: plan.id,
        status: "checkout_started",
        currency,
        setup_fee_sek: setupFeeSek,
        base_setup_fee_sek: baseSetupFeeSek,
        setup_included_screens: setupIncludedScreens,
        additional_setup_fee_per_screen_sek: additionalSetupFeeSek,
        additional_setup_screen_count: additionalSetupScreens,
        hardware_fee_sek: checkoutQuoteItems.reduce(
          (sum, item) =>
            sum +
            item.discountedHardwareFeeSek * item.quantity,
          0,
        ),
        shipping_fee_sek: shippingFeeSek,
        base_shipping_fee_sek: baseShippingFeeSek,
        shipping_included_devices: shippingIncludedDevices,
        additional_shipping_fee_per_device_sek: additionalShippingFeeSek,
        additional_shipping_device_count: additionalShippingDevices,
        monthly_fee_sek:
          checkoutQuoteItems.reduce(
            (sum, item) => sum + item.monthlyFeeSek * item.quantity,
            0,
          ) -
          (deviceDiscountMonths > 0
            ? Math.round(
                checkoutQuoteItems.reduce(
                  (sum, item) => sum + item.monthlyFeeSek * item.quantity,
                  0,
                ) *
                  (deviceDiscountPercent / 100),
              )
            : 0),
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
    failureContext.orderId = order.id;
    failureContext.orderNumber = order.order_number;

    const coupon =
      deviceDiscountPercent > 0 && deviceDiscountMonths > 0
        ? await stripe.coupons.create({
            percent_off: deviceDiscountPercent,
            duration: "repeating",
            duration_in_months: deviceDiscountMonths,
            name: `Screenia device discount ${deviceDiscountPercent}%`,
            metadata: {
              customer_id: customerId,
              order_number: order.order_number,
            },
          })
        : null;
    const setupImage = checkoutImageUrl(appUrl, "/brand/screenia-logo-full-white-bg.png");
    const deviceImage = checkoutImageUrl(appUrl, "/brand/screenia-helper.png");
    const subscriptionImage = checkoutImageUrl(appUrl, "/brand/screenia-icon-512-transparent.png");
    const stripeAddress = {
      city: customer.city,
      country: "SE",
      line1: customer.address,
      postal_code: String(customer.postal_code || "").replace(/\s/g, ""),
    };
    const stripeCustomerPayload = {
      address: stripeAddress,
      email: stripeBillingEmail,
      preferred_locales: ["sv"],
      invoice_settings: {
        footer:
          "Screenia. Alla priser inkluderar svensk moms. Frågor om fakturan: service@screenia.se",
      },
      metadata: {
        account_email: storedCustomerEmail,
        billing_email: stripeBillingEmail,
        customer_id: customerId,
        organisation_number: normalizedOrganisationNumber,
      },
      name: customer.name || undefined,
      phone: customer.phone || undefined,
      shipping: {
        address: stripeAddress,
        name: customer.name || storedCustomerEmail,
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
      const { error: stripeCustomerSyncError } = await supabaseAdmin
        .from("customers")
        .update({ stripe_customer_id: stripeCustomer.id })
        .eq("id", customerId);

      if (stripeCustomerSyncError) {
        console.error("Stripe customer local sync error:", stripeCustomerSyncError);
        try {
          await recordCheckoutLocalSyncFailure({
            ...failureContext,
            customerId,
            orderId: order.id,
            orderNumber: order.order_number,
            pricingPlanCode: plan.code,
            stripeCustomerId: stripeCustomer.id,
            phase: "customer",
            error: stripeCustomerSyncError,
            ipAddress,
            userAgent,
          });
        } catch (evidenceError) {
          console.error(
            "Stripe customer local sync failure evidence was not stored:",
            evidenceError,
          );

          return NextResponse.json(
            {
              error:
                "Stripe-kunden skapades, men Screenia kunde inte spara betalningsreferensen eller intern felhistorik. Kontakta support innan betalning startas igen.",
            },
            { status: 500 },
          );
        }

        return NextResponse.json(
          {
            error:
              "Stripe-kunden skapades, men Screenia kunde inte spara betalningsreferensen. Kontakta support innan betalning startas igen.",
          },
          { status: 500 },
        );
      }
    }
    failureContext.stripeCustomerId = stripeCustomer.id;

    const setupLineItem =
      baseSetupFeeSek > 0
        ? staticPriceLineItem({
        priceId: plan.stripe_setup_price_id,
        expectedAmountSek: baseSetupFeeSek,
        actualAmountSek: baseSetupFeeSek,
        quantity: 1,
      }) || {
        price_data: {
          currency,
          unit_amount: toOre(baseSetupFeeSek),
          tax_behavior: priceTaxBehavior,
          product_data: {
            name: `${plan.name} start- och konfigurationsavgift (upp till ${setupIncludedScreens} skärmar)`,
            description:
              "Grundavgift för start och konfiguration. Återbetalas inte när setupen har startat.",
            images: [setupImage],
          },
        },
        quantity: 1,
      } : null;

    const additionalSetupLineItem =
      additionalSetupScreens > 0
        ? staticPriceLineItem({
            priceId: plan.stripe_additional_setup_price_id,
            expectedAmountSek: additionalSetupFeeSek,
            actualAmountSek: additionalSetupFeeSek,
            quantity: additionalSetupScreens,
          }) || {
            price_data: {
              currency,
              unit_amount: toOre(additionalSetupFeeSek),
              tax_behavior: priceTaxBehavior,
              product_data: {
                name: "Extra skärm - start och konfiguration",
                description: `Tillägg per skärm utöver de ${setupIncludedScreens} som ingår i grundavgiften.`,
                images: [setupImage],
              },
            },
            quantity: additionalSetupScreens,
          }
        : null;

    const oneTimeCheckoutLineItems: CheckoutLineItem[] = [
      ...(setupLineItem ? [setupLineItem] : []),
      ...(additionalSetupLineItem ? [additionalSetupLineItem] : []),
      staticPriceLineItem({
        priceId: plan.stripe_shipping_price_id,
        expectedAmountSek: baseShippingFeeSek,
        actualAmountSek: baseShippingFeeSek,
        quantity: 1,
      }) || {
        price_data: {
          currency,
          unit_amount: toOre(baseShippingFeeSek),
          tax_behavior: priceTaxBehavior,
          product_data: {
            name: `Frakt inom Sverige (upp till ${shippingIncludedDevices} enheter)`,
            images: [subscriptionImage],
          },
        },
        quantity: 1,
      },
      ...(additionalShippingDevices > 0
        ? [
            staticPriceLineItem({
              priceId: plan.stripe_additional_shipping_price_id,
              expectedAmountSek: additionalShippingFeeSek,
              actualAmountSek: additionalShippingFeeSek,
              quantity: additionalShippingDevices,
            }) || {
              price_data: {
                currency,
                unit_amount: toOre(additionalShippingFeeSek),
                tax_behavior: priceTaxBehavior,
                product_data: {
                  name: "Frakt för extra enhet",
                  description: `Tillägg per enhet utöver de ${shippingIncludedDevices} som ingår i grundfrakten.`,
                  images: [subscriptionImage],
                },
              },
              quantity: additionalShippingDevices,
            },
          ]
        : []),
      ...checkoutQuoteItems.flatMap((item) => {
        const hardwareLineItem =
          item.discountedHardwareFeeSek > 0
            ? staticPriceLineItem({
                priceId: item.stripeHardwarePriceId,
                expectedAmountSek: item.hardwareFeeSek,
                actualAmountSek: item.discountedHardwareFeeSek,
                quantity: item.quantity,
              }) || {
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
              }
            : null;

        const monthlyLineItem =
          staticPriceLineItem({
            priceId: item.stripeMonthlyPriceId,
            expectedAmountSek: item.monthlyFeeSek,
            actualAmountSek: item.monthlyFeeSek,
            quantity: item.quantity,
          }) || {
            price_data: {
              currency,
              unit_amount: toOre(item.monthlyFeeSek),
              tax_behavior: priceTaxBehavior,
              recurring: {
                interval: "month",
              },
              product_data: {
                name: `Screenia ${item.name} ${item.resolution} månadsabonnemang`,
                images: [subscriptionImage],
              },
            },
            quantity: item.quantity,
          };

        void monthlyLineItem;

        return [hardwareLineItem].filter(
          (lineItem): lineItem is CheckoutLineItem => Boolean(lineItem),
        );
      }),
    ];
    const monthlyCheckoutLineItems: CheckoutLineItem[] = isExistingCustomerAddOn
      ? []
      : checkoutQuoteItems.map(
          (item) =>
            staticPriceLineItem({
              priceId: item.stripeMonthlyPriceId,
              expectedAmountSek: item.monthlyFeeSek,
              actualAmountSek: item.monthlyFeeSek,
              quantity: item.quantity,
            }) || {
              price_data: {
                currency,
                unit_amount: toOre(item.monthlyFeeSek),
                tax_behavior: priceTaxBehavior,
                recurring: {
                  interval: "month",
                },
                product_data: {
                  name: `Screenia ${item.name} ${item.resolution} månadsabonnemang`,
                  images: [subscriptionImage],
                },
              },
              quantity: item.quantity,
            },
        );
    const checkoutLineItems = [
      ...oneTimeCheckoutLineItems,
      ...monthlyCheckoutLineItems,
    ];
    const addOnSubscriptionItems = checkoutQuoteItems.map((item) =>
      subscriptionItemForMonthlyCharge({
        priceId: item.stripeMonthlyPriceId,
        quantity: item.quantity,
      }),
    );

    const session = await stripe.checkout.sessions.create({
      mode: isExistingCustomerAddOn ? "payment" : "subscription",
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
      line_items: checkoutLineItems,
      ...(isExistingCustomerAddOn
        ? {
            invoice_creation: {
              enabled: true,
              invoice_data: {
                description: `Screenia tilläggsorder ${order.order_number}`,
                footer:
                  "Screenia. Alla priser inkluderar svensk moms. Frågor om fakturan: service@screenia.se",
                metadata: {
                  customer_id: customerId,
                  customer_subscription_id: order.id,
                  existing_stripe_subscription_id:
                    existingStripeSubscriptionId || "",
                  order_number: order.order_number,
                },
              },
            },
          }
        : {
            subscription_data: {
              trial_period_days: plan.trial_days,
              metadata: {
                account_email: storedCustomerEmail,
                billing_email: stripeBillingEmail,
                customer_id: customerId,
                customer_subscription_id: order.id,
                organisation_number: normalizedOrganisationNumber,
                order_number: order.order_number,
                pricing_plan_id: plan.id,
                pricing_plan_code: plan.code,
                screen_quantity: String(checkoutScreenQuantity),
                device_discount_percent: String(deviceDiscountPercent),
                device_discount_months: String(deviceDiscountMonths),
                stripe_discount_coupon_id: coupon?.id || "",
              },
            },
          }),
      success_url: `${appUrl}/onboarding/payment-success?customer_id=${customerId}`,
      cancel_url: `${appUrl}/onboarding/payment-cancelled?token=${encodeURIComponent(
        customer.onboarding_token,
      )}`,
      metadata: {
        account_email: storedCustomerEmail,
        billing_email: stripeBillingEmail,
        customer_id: customerId,
        customer_subscription_id: order.id,
        organisation_number: normalizedOrganisationNumber,
        order_number: order.order_number,
        pricing_plan_id: plan.id,
        pricing_plan_code: plan.code,
        screen_quantity: String(checkoutScreenQuantity),
        device_discount_percent: String(deviceDiscountPercent),
        device_discount_months: String(deviceDiscountMonths),
        stripe_discount_coupon_id: coupon?.id || "",
        checkout_kind: isExistingCustomerAddOn
          ? "existing_customer_add_on"
          : "new_subscription",
        existing_stripe_subscription_id: existingStripeSubscriptionId || "",
        subscription_items: JSON.stringify(
          addOnSubscriptionItems.map((item, index) => ({
            pricingPlanCode: checkoutQuoteItems[index]?.code || "",
            price: "price" in item ? item.price : null,
            price_data: "price_data" in item ? item.price_data : null,
            quantity: item.quantity,
          })),
        ),
      },
    });

    failureContext.stripeCheckoutSessionId = session.id;

    const { error: checkoutSyncError } = await supabaseAdmin
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

    if (checkoutSyncError) {
      console.error("Stripe checkout local sync error:", checkoutSyncError);
      try {
        await recordCheckoutLocalSyncFailure({
          ...failureContext,
          customerId,
          orderId: order.id,
          orderNumber: order.order_number,
          pricingPlanCode: plan.code,
          stripeCustomerId: stripeCustomer.id,
          stripeCheckoutSessionId: session.id,
          phase: "checkout_session",
          error: checkoutSyncError,
          ipAddress,
          userAgent,
        });
      } catch (evidenceError) {
        console.error(
          "Stripe checkout local sync failure evidence was not stored:",
          evidenceError,
        );

        return NextResponse.json(
          {
            error:
              "Stripe-betalningen skapades, men Screenia kunde inte spara checkout-referensen eller intern felhistorik. Kontakta support innan betalning startas igen.",
          },
          { status: 500 },
        );
      }

      return NextResponse.json(
        {
          error:
            "Stripe-betalningen skapades, men Screenia kunde inte spara checkout-referensen. Kontakta support innan betalning startas igen.",
        },
        { status: 500 },
      );
    }

    try {
      await recordAuditEvent(
        supabaseAdmin,
        {
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
        },
        { throwOnError: true },
      );
    } catch (auditError) {
      console.error("Stripe checkout started audit was not stored:", auditError);
      await createAdminNotification(
        supabaseAdmin,
        {
          customerId,
          eventType: "stripe_checkout_started_audit_failed",
          title: "Stripe checkout audit missing",
          message: `Stripe checkout session ${session.id} was created for order ${order.order_number}, but checkout-start audit evidence was not stored.`,
          priority: "urgent",
          metadata: {
            pricingPlanCode: plan.code,
            pricingPlanId: plan.id,
            customerSubscriptionId: order.id,
            orderNumber: order.order_number,
            stripeCheckoutSessionId: session.id,
            stripeCustomerId: stripeCustomer.id,
            error: auditError instanceof Error ? auditError.message : String(auditError),
          },
        },
        { throwOnError: true },
      );

      return NextResponse.json(
        {
          error:
            "Stripe checkout was created, but Screenia could not store checkout audit evidence. Contact support before trying again.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({ url: session.url, orderNumber: order.order_number });
  } catch (error) {
    console.error("Stripe checkout error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown checkout error";

    if (failureContext.customerId) {
      try {
        await recordAuditEvent(
          supabaseAdmin,
          {
            customerId: failureContext.customerId,
            actorType: "system",
            eventType: "stripe_checkout_failed",
            eventDescription:
              "System could not create a Stripe checkout session.",
            metadata: {
              ...failureContext,
              error: errorMessage,
            },
            ipAddress,
            userAgent,
          },
          { throwOnError: true },
        );

        await createAdminNotification(
          supabaseAdmin,
          {
            customerId: failureContext.customerId,
            eventType: "stripe_checkout_failed",
            title: "Stripe checkout failed",
            message: `Stripe checkout could not be created for order ${
              failureContext.orderNumber || "unknown"
            }: ${errorMessage}`,
            priority: "urgent",
            metadata: {
              ...failureContext,
              error: errorMessage,
            },
          },
          { throwOnError: true },
        );
      } catch (evidenceError) {
        console.error(
          "Stripe checkout failure evidence was not stored:",
          evidenceError,
        );
        return NextResponse.json(
          {
            error:
              "Det gick inte att starta betalningen och Screenia kunde inte spara intern felbevisning. Kontakta support innan du försöker igen.",
          },
          { status: 500 },
        );
      }
    }

    return NextResponse.json(
      { error: "Det gick inte att starta betalningen." },
      { status: 500 },
    );
  }
}
