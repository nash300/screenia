import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { getRequestIp, recordAuditEvent } from "@/lib/server/audit";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-04-22.dahlia",
});
const stripeAutomaticTaxEnabled =
  process.env.STRIPE_AUTOMATIC_TAX_ENABLED === "true";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { customerId, email, pricingPlanCode, legalAccepted } = body;
    const ipAddress = getRequestIp(request);
    const userAgent = request.headers.get("user-agent");

    if (!customerId || !email || !pricingPlanCode) {
      return NextResponse.json(
        { error: "Kund, e-post eller prispaket saknas." },
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

    const { data: plan, error: planError } = await supabaseAdmin
      .from("pricing_plans")
      .select("*")
      .eq("code", pricingPlanCode)
      .eq("is_active", true)
      .single();

    if (planError || !plan) {
      return NextResponse.json(
        { error: "Prispaketet hittades inte." },
        { status: 404 },
      );
    }

    if (!plan.stripe_setup_price_id || !plan.stripe_monthly_price_id) {
      return NextResponse.json(
        { error: "Betalningsinställningar saknas för detta paket." },
        { status: 500 },
      );
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from("customer_subscriptions")
      .insert({
        customer_id: customerId,
        pricing_plan_id: plan.id,
        status: "checkout_started",
        currency: plan.currency || "sek",
        setup_fee_sek: plan.setup_fee_sek,
        monthly_fee_sek: plan.monthly_fee_sek,
        trial_days: plan.trial_days,
        tax_status: stripeAutomaticTaxEnabled ? "pending" : "not_enabled",
        fulfillment_status: "pending",
        inventory_status: "not_reserved",
        legal_acceptance_at: new Date().toISOString(),
        legal_acceptance_ip: ipAddress,
      })
      .select("id, order_number")
      .single();

    if (orderError || !order) {
      console.error("Create order error:", orderError);
      return NextResponse.json(
        { error: "Det gick inte att skapa ordern." },
        { status: 500 },
      );
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: email,
      client_reference_id: order.order_number,
      automatic_tax: {
        enabled: stripeAutomaticTaxEnabled,
      },
      billing_address_collection: stripeAutomaticTaxEnabled
        ? "required"
        : "auto",
      tax_id_collection: {
        enabled: stripeAutomaticTaxEnabled,
      },
      line_items: [
        {
          price: plan.stripe_setup_price_id,
          quantity: 1,
        },
        {
          price: plan.stripe_monthly_price_id,
          quantity: 1,
        },
      ],
      subscription_data: {
        trial_period_days: plan.trial_days,
        metadata: {
          customer_id: customerId,
          customer_subscription_id: order.id,
          order_number: order.order_number,
          pricing_plan_id: plan.id,
          pricing_plan_code: plan.code,
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
      },
    });

    await supabaseAdmin
      .from("customer_subscriptions")
      .update({
        stripe_checkout_session_id: session.id,
        tax_status: session.automatic_tax?.enabled
          ? session.automatic_tax.status || "pending"
          : "not_enabled",
        tax_amount_sek: session.total_details?.amount_tax ?? null,
        total_amount_sek: session.amount_total ?? null,
        stripe_payment_status: session.payment_status,
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
