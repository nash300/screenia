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

async function saveCustomerAuthUser(customerId: string, authUserId: string) {
  const { error } = await supabaseAdmin
    .from("customers")
    .update({ auth_user_id: authUserId })
    .eq("id", customerId);

  if (error && error.code !== "PGRST204" && error.code !== "42703") {
    console.error("Save customer auth user error:", error);
  }
}

async function ensureCustomerAuthUser(customerId: string, email?: string | null) {
  if (!email) return null;

  const { data: customer, error: customerError } = await supabaseAdmin
    .from("customers")
    .select("auth_user_id")
    .eq("id", customerId)
    .maybeSingle();

  if (
    customerError &&
    customerError.code !== "PGRST204" &&
    customerError.code !== "42703"
  ) {
    console.error("Customer auth user lookup error:", customerError);
  }

  if (customer?.auth_user_id) return customer.auth_user_id;

  const { data: createdUser, error: createError } =
    await supabaseAdmin.auth.admin.createUser({
      email,
      email_confirm: true,
      password: crypto.randomUUID() + crypto.randomUUID(),
      user_metadata: {
        customer_id: customerId,
        account_type: "customer",
      },
    });

  if (createError) {
    const { data: users } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = users.users.find(
      (user) => user.email?.toLowerCase() === email.toLowerCase(),
    );

    if (existingUser) {
      await saveCustomerAuthUser(customerId, existingUser.id);
      return existingUser.id;
    }

    console.error("Create customer auth user error:", createError);
    return null;
  }

  if (createdUser.user) {
    await saveCustomerAuthUser(customerId, createdUser.user.id);
    return createdUser.user.id;
  }

  return null;
}

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
    const discountCouponId =
      session.metadata?.stripe_discount_coupon_id || null;
    const customerEmail =
      session.customer_details?.email || session.customer_email || null;

    if (customerId) {
      await ensureCustomerAuthUser(customerId, customerEmail);
      const customerUpdate: Record<string, string | null> = {
        status: "active",
        payment_status: "paid",
        stripe_customer_id: session.customer as string,
        stripe_subscription_id: session.subscription as string,
        activated_at: new Date().toISOString(),
      };

      const { error } = await supabaseAdmin
        .from("customers")
        .update(customerUpdate)
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
        if (discountCouponId) {
          try {
            await stripe.subscriptions.update(session.subscription as string, {
              discounts: [{ coupon: discountCouponId }],
            });
          } catch (error) {
            console.error("Apply subscription discount error:", error);
          }
        }

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
          stripe_discount_coupon_id: discountCouponId,
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
