import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { getRequestIp, recordAuditEvent } from "@/lib/server/audit";
import { createAdminNotification } from "@/lib/server/admin-notifications";
import {
  CURRENT_PRIVACY_VERSION,
  CURRENT_TERMS_VERSION,
} from "@/lib/legal/documents";
import { getLiveCheckoutBlockers } from "@/lib/server/live-checkout-readiness";
import { PRICING_PLANS } from "@/lib/pricing/plans";
import { includedVatFromGross } from "@/lib/pricing/vat";
import {
  isValidSwedishRegistrationNumber,
  normalizeSwedishRegistrationNumber,
} from "@/lib/business/sweden";

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

async function getAuthenticatedAdmin() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user?.app_metadata?.role === "admin" ? user : null;
}

function toOre(amountSek: number) {
  return Math.round(amountSek * 100);
}

function isLiveStripeKey() {
  return process.env.STRIPE_SECRET_KEY?.startsWith("sk_live_") === true;
}

function checkoutImageUrl(appUrl: string, path: string) {
  const imageBaseUrl = appUrl.includes("localhost")
    ? "https://screenia.se"
    : appUrl;

  return new URL(path, imageBaseUrl).toString();
}

function normalizeEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value);
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

type CheckoutFailureContext = {
  customerId?: string;
  orderId?: string;
  orderNumber?: string;
  pricingPlanCode?: string;
  stripeCustomerId?: string;
  stripeCheckoutSessionId?: string;
};

async function recordCheckoutLocalSyncFailure({
  customerId,
  orderId,
  orderNumber,
  pricingPlanCode,
  stripeCustomerId,
  stripeCheckoutSessionId,
  phase,
  error,
  ipAddress,
  userAgent,
}: CheckoutFailureContext & {
  phase: string;
  error: unknown;
  ipAddress: string | null;
  userAgent: string | null;
}) {
  const errorMessage =
    error instanceof Error ? error.message : "Unknown local sync error";
  const metadata = {
    customerId,
    orderId,
    orderNumber,
    pricingPlanCode,
    stripeCustomerId,
    stripeCheckoutSessionId,
    phase,
    error: errorMessage,
  };

  await recordAuditEvent(
    supabaseAdmin,
    {
      customerId,
      actorType: "system",
      eventType: "stripe_checkout_local_sync_failed",
      eventDescription:
        "Stripe checkout state was created but Screenia could not store the local billing reference.",
      metadata,
      ipAddress,
      userAgent,
    },
    { throwOnError: true },
  );

  await createAdminNotification(
    supabaseAdmin,
    {
      customerId,
      eventType: "stripe_checkout_local_sync_failed",
      title: "Stripe checkout local sync failed",
      message: `Stripe checkout state exists for order ${
        orderNumber || "unknown"
      }, but Screenia could not store the local ${phase} reference: ${errorMessage}`,
      priority: "urgent",
      metadata,
    },
    { throwOnError: true },
  );
}

async function hasRequiredLegalEvidence(customerId: string) {
  const [consentResult, agreementResult] = await Promise.all([
    supabaseAdmin
      .from("consent_records")
      .select("consent_type, document_version")
      .eq("customer_id", customerId)
      .eq("granted", true)
      .in("consent_type", ["terms", "privacy"])
      .in("document_version", [CURRENT_TERMS_VERSION, CURRENT_PRIVACY_VERSION]),
    supabaseAdmin
      .from("customer_legal_agreements")
      .select("document_type, document_version")
      .eq("customer_id", customerId)
      .in("document_type", ["terms", "privacy"])
      .in("document_version", [CURRENT_TERMS_VERSION, CURRENT_PRIVACY_VERSION]),
  ]);

  if (consentResult.error || agreementResult.error) {
    console.error("Checkout legal evidence lookup failed:", {
      consentError: consentResult.error,
      agreementError: agreementResult.error,
    });

    return {
      ok: false,
      error:
        "Det gick inte att kontrollera villkor och integritetssamtycke. Försök igen innan betalning.",
    };
  }

  const consentRows = consentResult.data || [];
  const agreementRows = agreementResult.data || [];
  const hasTermsConsent = consentRows.some(
    (row) =>
      row.consent_type === "terms" &&
      row.document_version === CURRENT_TERMS_VERSION,
  );
  const hasPrivacyConsent = consentRows.some(
    (row) =>
      row.consent_type === "privacy" &&
      row.document_version === CURRENT_PRIVACY_VERSION,
  );
  const hasTermsAgreement = agreementRows.some(
    (row) =>
      row.document_type === "terms" &&
      row.document_version === CURRENT_TERMS_VERSION,
  );
  const hasPrivacyAgreement = agreementRows.some(
    (row) =>
      row.document_type === "privacy" &&
      row.document_version === CURRENT_PRIVACY_VERSION,
  );

  if (
    !hasTermsConsent ||
    !hasPrivacyConsent ||
    !hasTermsAgreement ||
    !hasPrivacyAgreement
  ) {
    return {
      ok: false,
      error:
        "Kunden måste först godkänna aktuella villkor och integritetspolicy i onboarding innan betalning kan startas.",
    };
  }

  return { ok: true, error: null };
}

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
        "id, name, email, billing_email, organisation_number, phone, country, postal_code, address, city, stripe_customer_id, onboarding_token, onboarding_token_expires_at",
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
              name: `Screenia ${plan.name} ${plan.resolution} månadsabonnemang`,
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
                name: `Screenia ${item.name} ${item.resolution} månadsabonnemang`,
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
      success_url: `${appUrl}/onboarding/payment-success?customer_id=${customerId}`,
      cancel_url: `${appUrl}/onboarding/payment-cancelled`,
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
