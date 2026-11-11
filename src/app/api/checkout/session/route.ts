import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { isValidSwedishRegistrationNumber, normalizeSwedishRegistrationNumber } from "@/lib/business/sweden";
import { calculateCartQuote } from "@/lib/pricing/cart";
import { getRequestIp, recordAuditEvent, recordConsent, recordLegalAgreement } from "@/lib/server/audit";
import { supabaseAdmin } from "@/lib/server/admin-api";
import { createAdminNotification } from "@/lib/server/admin-notifications";
import { getCheckoutCart, isValidCartToken } from "@/lib/server/checkout-cart";
import { getLiveCheckoutBlockers } from "@/lib/server/live-checkout-readiness";
import { CURRENT_PRIVACY_DOCUMENT, CURRENT_TERMS_DOCUMENT } from "@/lib/legal/documents";
import { isValidEmailAddress } from "@/lib/validation/email";
import { isLiveStripeKey } from "@/app/api/stripe/checkout/stripe-checkout-utils";
import { stripe } from "@/app/api/stripe/checkout/stripe-checkout-client";

function priceData(name: string, amountSek: number, recurring = false) {
  return {
    price_data: {
      currency: "sek" as const,
      unit_amount: Math.round(amountSek * 100),
      tax_behavior: "inclusive" as const,
      product_data: { name },
      ...(recurring ? { recurring: { interval: "month" as const } } : {}),
    },
  };
}

function randomIntegrationIdentifier() {
  return `screenia_cart_${randomBytes(6).toString("hex")}`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const cartToken = String(body.cartToken || "").trim();
    const companyName = String(body.companyName || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const contactPerson = String(body.contactPerson || "").trim();
    const phone = String(body.phone || "").trim();
    const organisationNumber = normalizeSwedishRegistrationNumber(String(body.organisationNumber || ""));
    const billingEmail = String(body.billingEmail || "").trim().toLowerCase();
    const address = String(body.address || "").trim();
    const postalCode = String(body.postalCode || "").replace(/\s/g, "");
    const city = String(body.city || "").trim();
    const country = String(body.country || "Sverige").trim();
    const businessCategory = String(body.businessCategory || "").trim();
    const websiteUrl = String(body.websiteUrl || "").trim();
    const preferredContactChannel = String(body.preferredContactChannel || "email").trim();
    const acceptedTerms = Boolean(body.acceptedTerms);
    const acceptedPrivacy = Boolean(body.acceptedPrivacy);
    const marketingConsent = Boolean(body.marketingConsent);
    const analyticsConsent = Boolean(body.analyticsConsent);
    const remoteSupportConsent = Boolean(body.remoteSupportConsent);
    const ipAddress = getRequestIp(request);
    const userAgent = request.headers.get("user-agent");

    if (!isValidCartToken(cartToken)) return NextResponse.json({ error: "Varukorg saknas." }, { status: 400 });
    if (!companyName || !contactPerson) return NextResponse.json({ error: "Företag och kontaktperson måste anges." }, { status: 400 });
    if (!isValidEmailAddress(email) || (billingEmail && !isValidEmailAddress(billingEmail))) return NextResponse.json({ error: "Ange giltiga e-postadresser." }, { status: 400 });
    if (!isValidSwedishRegistrationNumber(organisationNumber)) return NextResponse.json({ error: "Ange ett giltigt svenskt organisationsnummer." }, { status: 400 });
    if (!/^\d{5}$/.test(postalCode) || !city || !address) return NextResponse.json({ error: "Ange en komplett svensk leveransadress." }, { status: 400 });
    if (!/^sverige|sweden|se$/i.test(country)) return NextResponse.json({ error: "Screenia tar bara emot beställningar från svenska kunder." }, { status: 400 });
    if (!acceptedTerms || !acceptedPrivacy) return NextResponse.json({ error: "Villkor och integritetspolicy måste godkännas." }, { status: 400 });
    if (!['email', 'phone', 'sms'].includes(preferredContactChannel)) return NextResponse.json({ error: "Välj ett giltigt kontaktsätt." }, { status: 400 });

    if (isLiveStripeKey()) {
      const blockers = await getLiveCheckoutBlockers(supabaseAdmin);
      if (blockers.length) return NextResponse.json({ error: `Livebetalningar är spärrade tills lanseringskontrollerna är klara: ${blockers.join(", ")}.` }, { status: 403 });
    }

    const cart = await getCheckoutCart(cartToken);
    if (!cart) return NextResponse.json({ error: "Varukorgen har gått ut. Börja om med dina paketval." }, { status: 410 });
    const quote = calculateCartQuote(cart.items);

    const { data: existingCustomer } = await supabaseAdmin
      .from("customers")
      .select("id, status, payment_status")
      .ilike("email", email)
      .not("payment_status", "in", "(cancelled,refunded)")
      .limit(1)
      .maybeSingle();
    if (existingCustomer) {
      return NextResponse.json({ error: "Det finns redan ett kundkonto med den här e-postadressen. Kontakta Screenia för att lägga till fler skärmar." }, { status: 409 });
    }

    const acceptedAt = new Date().toISOString();
    const { data: customer, error: customerError } = await supabaseAdmin
      .from("customers")
      .insert({
        name: companyName,
        email,
        contact_person: contactPerson,
        phone: phone || null,
        organisation_number: organisationNumber,
        billing_email: billingEmail || null,
        address,
        postal_code: postalCode,
        city,
        country: "Sverige",
        business_category: businessCategory || null,
        website_url: websiteUrl || null,
        preferred_contact_channel: preferredContactChannel,
        marketing_consent: marketingConsent,
        analytics_consent: analyticsConsent,
        remote_support_consent: remoteSupportConsent,
        terms_accepted_at: acceptedAt,
        privacy_accepted_at: acceptedAt,
        status: "checkout_started",
        payment_status: "pending",
        onboarding_stage: "payment_pending",
      })
      .select("id, email")
      .single();
    if (customerError || !customer) throw customerError || new Error("Kunden kunde inte skapas.");

    await Promise.all([
      recordConsent(supabaseAdmin, { customerId: customer.id, consentType: "terms", granted: true, statement: "Jag godkänner villkoren.", documentName: CURRENT_TERMS_DOCUMENT.title, documentVersion: CURRENT_TERMS_DOCUMENT.version, documentUrl: CURRENT_TERMS_DOCUMENT.url, collectionPoint: "public_checkout", ipAddress, userAgent }, { throwOnError: true }),
      recordConsent(supabaseAdmin, { customerId: customer.id, consentType: "privacy", granted: true, statement: "Jag godkänner integritetspolicyn.", documentName: CURRENT_PRIVACY_DOCUMENT.title, documentVersion: CURRENT_PRIVACY_DOCUMENT.version, documentUrl: CURRENT_PRIVACY_DOCUMENT.url, collectionPoint: "public_checkout", ipAddress, userAgent }, { throwOnError: true }),
      recordLegalAgreement(supabaseAdmin, { customerId: customer.id, documentType: "terms", documentTitle: CURRENT_TERMS_DOCUMENT.title, documentVersion: CURRENT_TERMS_DOCUMENT.version, documentEffectiveAt: CURRENT_TERMS_DOCUMENT.effectiveDate, documentUrl: CURRENT_TERMS_DOCUMENT.url, pdfUrl: CURRENT_TERMS_DOCUMENT.pdfUrl, contentSnapshot: CURRENT_TERMS_DOCUMENT.content, collectionPoint: "public_checkout", ipAddress, userAgent }, { throwOnError: true }),
      recordLegalAgreement(supabaseAdmin, { customerId: customer.id, documentType: "privacy", documentTitle: CURRENT_PRIVACY_DOCUMENT.title, documentVersion: CURRENT_PRIVACY_DOCUMENT.version, documentEffectiveAt: CURRENT_PRIVACY_DOCUMENT.effectiveDate, documentUrl: CURRENT_PRIVACY_DOCUMENT.url, pdfUrl: CURRENT_PRIVACY_DOCUMENT.pdfUrl, contentSnapshot: CURRENT_PRIVACY_DOCUMENT.content, collectionPoint: "public_checkout", ipAddress, userAgent }, { throwOnError: true }),
    ]);

    const { data: dbPlans } = await supabaseAdmin
      .from("pricing_plans")
      .select("id, code, setup_fee_sek, hardware_fee_sek, shipping_fee_sek, monthly_fee_sek, stripe_setup_price_id, stripe_hardware_price_id, stripe_shipping_price_id, stripe_monthly_price_id")
      .in("code", quote.items.map((item) => item.pricingPlanCode));
    const primaryPlan = dbPlans?.find((plan) => plan.code === quote.items[0]?.pricingPlanCode);
    const quoteItems = quote.items.map((item) => ({ ...item, orderType: "new_customer_cart" }));

    const { data: subscriptionRow, error: subscriptionError } = await supabaseAdmin
      .from("customer_subscriptions")
      .insert({
        customer_id: customer.id,
        pricing_plan_id: primaryPlan?.id || null,
        status: "checkout_started",
        currency: quote.currency,
        screen_quantity: quote.screenQuantity,
        setup_fee_sek: quote.setupFeeSek,
        base_setup_fee_sek: quote.setupFeeSek,
        setup_fee_waived: false,
        hardware_fee_sek: quote.hardwareFeeSek,
        shipping_fee_sek: quote.shippingFeeSek,
        base_shipping_fee_sek: quote.shippingFeeSek,
        monthly_fee_sek: quote.monthlyFeeSek,
        trial_days: quote.trialDays,
        quote_items: quoteItems,
        requested_quote_items: quoteItems,
        fulfillment_status: "pending",
        inventory_status: "not_reserved",
      })
      .select("id, order_number")
      .single();
    if (subscriptionError || !subscriptionRow) throw subscriptionError || new Error("Order could not be created.");

    const { data: order, error: orderError } = await supabaseAdmin
      .from("checkout_orders")
      .insert({
        cart_id: cart.id,
        customer_id: customer.id,
        customer_subscription_id: subscriptionRow.id,
        status: "payment_pending",
        quote_snapshot: quote,
        currency: quote.currency,
        initial_amount_sek: quote.initialPaymentSek,
        monthly_amount_sek: quote.monthlyFeeSek,
      })
      .select("id")
      .single();
    if (orderError || !order) throw orderError || new Error("Checkout order could not be created.");

    const primaryDbPlan = dbPlans?.find((plan) => plan.code === quote.items[0]?.pricingPlanCode);
    const setupPrice = primaryDbPlan?.stripe_setup_price_id && Number(primaryDbPlan.setup_fee_sek) === quote.setupFeeSek
      ? { price: primaryDbPlan.stripe_setup_price_id }
      : priceData("Start och konfiguration", quote.setupFeeSek);
    const shippingPrice = primaryDbPlan?.stripe_shipping_price_id && Number(primaryDbPlan.shipping_fee_sek) === quote.shippingFeeSek
      ? { price: primaryDbPlan.stripe_shipping_price_id }
      : priceData("Frakt inom Sverige", quote.shippingFeeSek);
    const lineItems: Array<Record<string, unknown>> = [
      { ...setupPrice, quantity: 1 },
      ...quote.items.map((item) => {
        const dbPlan = dbPlans?.find((plan) => plan.code === item.pricingPlanCode);
        const canUseHardwarePrice = dbPlan?.stripe_hardware_price_id && Number(dbPlan.hardware_fee_sek) === item.hardwareFeeSek;
        return canUseHardwarePrice
          ? { price: dbPlan.stripe_hardware_price_id, quantity: item.quantity }
          : { ...priceData(`${item.name} ${item.resolution} skärmenhet`, item.hardwareFeeSek), quantity: item.quantity };
      }),
      { ...shippingPrice, quantity: 1 },
      ...quote.items.map((item) => {
        const dbPlan = dbPlans?.find((plan) => plan.code === item.pricingPlanCode);
        const canUseMonthlyPrice = dbPlan?.stripe_monthly_price_id && Number(dbPlan.monthly_fee_sek) === item.monthlyFeeSek;
        return canUseMonthlyPrice
          ? { price: dbPlan.stripe_monthly_price_id, quantity: item.quantity }
          : { ...priceData(`${item.name} ${item.resolution} abonnemang`, item.monthlyFeeSek, true), quantity: item.quantity };
      }),
    ];

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: lineItems as never,
      customer_email: customer.email,
      billing_address_collection: "required",
      shipping_address_collection: { allowed_countries: ["SE"] },
      success_url: `${appUrl}/checkout/success?order=${order.id}`,
      cancel_url: `${appUrl}/#pricing`,
      integration_identifier: randomIntegrationIdentifier(),
      subscription_data: {
        trial_period_days: quote.trialDays,
        metadata: {
          checkout_order_id: order.id,
          customer_id: customer.id,
          customer_subscription_id: subscriptionRow.id,
        },
      },
      metadata: {
        checkout_kind: "public_cart",
        checkout_order_id: order.id,
        customer_id: customer.id,
        customer_subscription_id: subscriptionRow.id,
        account_email: customer.email,
        order_number: subscriptionRow.order_number || "",
      },
    });

    await Promise.all([
      supabaseAdmin.from("checkout_orders").update({ stripe_checkout_session_id: session.id, status: "checkout_started" }).eq("id", order.id),
      supabaseAdmin.from("customer_subscriptions").update({ stripe_checkout_session_id: session.id }).eq("id", subscriptionRow.id),
      supabaseAdmin.from("customers").update({ onboarding_stage: "checkout_started" }).eq("id", customer.id),
      recordAuditEvent(supabaseAdmin, { customerId: customer.id, actorType: "customer", eventType: "checkout_started", eventDescription: "Customer started public cart checkout.", dedupeKey: `checkout_started:${order.id}`, metadata: { orderId: order.id, stripeCheckoutSessionId: session.id, initialAmountSek: quote.initialPaymentSek, monthlyAmountSek: quote.monthlyFeeSek }, ipAddress, userAgent }, { throwOnError: true }),
      createAdminNotification(supabaseAdmin, { customerId: customer.id, eventType: "checkout_started", dedupeKey: `checkout_started:${order.id}`, title: "New cart checkout started", message: `${companyName} started a checkout for ${quote.screenQuantity} screen(s).`, priority: "high", metadata: { orderId: order.id, stripeCheckoutSessionId: session.id, initialAmountSek: quote.initialPaymentSek, monthlyAmountSek: quote.monthlyFeeSek } }),
    ]);

    return NextResponse.json({ url: session.url, orderId: order.id });
  } catch (error) {
    console.error("Public cart checkout error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Betalningen kunde inte startas." }, { status: 500 });
  }
}
