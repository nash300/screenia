import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { recordAuditEvent } from "@/lib/server/audit";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-04-22.dahlia",
});

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (error) {
    console.error("Webhook signature error:", error);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    const customerId = session.metadata?.customer_id;
    const customerSubscriptionId = session.metadata?.customer_subscription_id;
    const orderNumber = session.metadata?.order_number;

    if (customerId) {
      const { error } = await supabaseAdmin
        .from("customers")
        .update({
          status: "active",
          payment_status: "paid",
          stripe_customer_id: session.customer as string,
          stripe_subscription_id: session.subscription as string,
          activated_at: new Date().toISOString(),
        })
        .eq("id", customerId);

      if (error) {
        console.error("Checkout completed customer update error:", error);
      } else {
        await recordAuditEvent(supabaseAdmin, {
          customerId,
          actorType: "stripe",
          eventType: "payment_completed",
          eventDescription:
            "Stripe checkout completed. Customer paid and is ready for screen setup.",
          metadata: {
            stripeCustomerId: session.customer,
            stripeSubscriptionId: session.subscription,
            stripeCheckoutSessionId: session.id,
            customerSubscriptionId,
            orderNumber,
            taxAmountSek: session.total_details?.amount_tax,
            totalAmountSek: session.amount_total,
          },
        });
      }

      if (session.subscription) {
        const subscriptionUpdate = {
          status: "active",
          stripe_customer_id: session.customer as string,
          stripe_subscription_id: session.subscription as string,
          stripe_invoice_id:
            typeof session.invoice === "string" ? session.invoice : session.invoice?.id,
          stripe_payment_intent_id:
            typeof session.payment_intent === "string"
              ? session.payment_intent
              : session.payment_intent?.id,
          stripe_payment_status: session.payment_status,
          setup_fee_paid: true,
          tax_status: session.automatic_tax?.enabled
            ? session.automatic_tax.status || "complete"
            : "not_enabled",
          tax_amount_sek: session.total_details?.amount_tax ?? null,
          total_amount_sek: session.amount_total ?? null,
          fulfillment_status: "paid",
          inventory_status: "ready_to_reserve",
        };

        const updateQuery = supabaseAdmin
          .from("customer_subscriptions")
          .update(subscriptionUpdate);

        const { error: subscriptionError } = customerSubscriptionId
          ? await updateQuery.eq("id", customerSubscriptionId)
          : await updateQuery.eq("stripe_checkout_session_id", session.id);

        if (subscriptionError) {
          console.error(
            "Checkout completed subscription update error:",
            subscriptionError,
          );
        }
      }
    }
  }

  if (event.type === "invoice.payment_failed") {
    const invoice = event.data.object as Stripe.Invoice;

    const customerId = invoice.customer;

    const { data, error } = await supabaseAdmin
      .from("customers")
      .update({
        status: "suspended",
        payment_status: "failed",
        inactive_reason: "payment_failed",
        cancellation_source: "stripe",
      })
      .eq("stripe_customer_id", customerId)
      .select();

    if (error) {
      console.error("Payment failed update error:", error);
    }

    if (!data || data.length === 0) {
      console.warn("No customer found for failed payment:", customerId);
    } else {
      await supabaseAdmin
        .from("customer_subscriptions")
        .update({
          status: "payment_failed",
          stripe_payment_status: "failed",
        })
        .eq("stripe_customer_id", customerId);

      await Promise.all(
        data.map((customer) =>
          recordAuditEvent(supabaseAdmin, {
            customerId: customer.id,
            actorType: "stripe",
            eventType: "payment_failed",
            eventDescription:
              "Stripe reported a failed payment. Customer was suspended.",
            metadata: {
              stripeCustomerId: customerId,
              invoiceId: invoice.id,
            },
          }),
        ),
      );
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription;

    const customerId = subscription.customer;

    const { error } = await supabaseAdmin
      .from("customers")
      .update({
        status: "suspended",
        payment_status: "cancelled",
        inactive_reason: "subscription_cancelled",
        cancelled_at: new Date().toISOString(),
        cancellation_source: "stripe",
      })
      .eq("stripe_customer_id", customerId);

    if (error) {
      console.error("Subscription deleted error:", error);
    } else {
      await supabaseAdmin
        .from("customer_subscriptions")
        .update({
          status: "cancelled",
          fulfillment_status: "cancelled",
        })
        .eq("stripe_subscription_id", subscription.id);

      const { data } = await supabaseAdmin
        .from("customers")
        .select("id")
        .eq("stripe_customer_id", customerId);

      await Promise.all(
        (data || []).map((customer) =>
          recordAuditEvent(supabaseAdmin, {
            customerId: customer.id,
            actorType: "stripe",
            eventType: "subscription_cancelled",
            eventDescription:
              "Stripe subscription was cancelled. Customer was suspended.",
            metadata: {
              stripeCustomerId: customerId,
              stripeSubscriptionId: subscription.id,
            },
          }),
        ),
      );
    }
  }

  return NextResponse.json({ received: true });
}
