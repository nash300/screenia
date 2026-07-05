import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { recordAuditEvent } from "@/lib/server/audit";
import { createAdminNotification } from "@/lib/server/admin-notifications";
import { includedVatFromGross } from "@/lib/pricing/vat";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-04-22.dahlia",
});

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

function includedVatOreFromStripeTotal(amountOre: number | null | undefined) {
  if (!amountOre) return null;
  return Math.round(includedVatFromGross(amountOre / 100).vat * 100);
}

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

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const redirectTo = appUrl
    ? `${appUrl}/auth/callback?next=/account/activate`
    : undefined;

  const { data: invitedUser, error: inviteError } =
    await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      redirectTo,
      data: {
        customer_id: customerId,
        account_type: "customer",
      },
    });

  if (inviteError) {
    const { data: users } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = users.users.find(
      (user) => user.email?.toLowerCase() === email.toLowerCase(),
    );

    if (existingUser) {
      await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
        user_metadata: {
          ...(existingUser.user_metadata || {}),
          customer_id: customerId,
          account_type: "customer",
        },
      });
      await saveCustomerAuthUser(customerId, existingUser.id);
      return existingUser.id;
    }

    console.error("Invite customer auth user error:", inviteError);
    return null;
  }

  if (invitedUser.user) {
    await saveCustomerAuthUser(customerId, invitedUser.user.id);
    return invitedUser.user.id;
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
    const includedVatOre =
      session.total_details?.amount_tax ||
      includedVatOreFromStripeTotal(session.amount_total);

    if (customerId) {
      await ensureCustomerAuthUser(customerId, customerEmail);
      const customerUpdate: Record<string, string | null> = {
        status: "paid",
        payment_status: "paid",
        stripe_customer_id: session.customer as string,
        stripe_subscription_id: session.subscription as string,
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
            "Stripe checkout completed. Customer paid and is ready for content collection.",
          metadata: {
            stripeCustomerId: session.customer,
            stripeSubscriptionId: session.subscription,
            stripeCheckoutSessionId: session.id,
            customerSubscriptionId,
            orderNumber,
            taxAmountSek: includedVatOre,
            totalAmountSek: session.amount_total,
          },
        });

        await createAdminNotification(supabaseAdmin, {
          customerId,
          eventType: "payment_completed",
          title: "Payment completed",
          message: `Stripe checkout completed for order ${orderNumber || session.id}.`,
          priority: "urgent",
          metadata: {
            stripeCustomerId: session.customer,
            stripeSubscriptionId: session.subscription,
            stripeCheckoutSessionId: session.id,
            customerSubscriptionId,
            orderNumber,
            customerEmail,
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
          status: "paid",
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
          tax_amount_sek: includedVatOre,
          total_amount_sek: session.amount_total ?? null,
          fulfillment_status: "content_collection",
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
          fulfillment_status: "payment_failed",
        })
        .eq("stripe_customer_id", customerId);

      await Promise.all(
        data.map((customer) =>
          Promise.all([
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
            createAdminNotification(supabaseAdmin, {
              customerId: customer.id,
              eventType: "payment_failed",
              title: "Payment failed",
              message: `Stripe reported a failed payment for invoice ${invoice.id}.`,
              priority: "urgent",
              metadata: {
                stripeCustomerId: customerId,
                invoiceId: invoice.id,
              },
            }),
          ]),
        ),
      );
    }
  }

  if (event.type === "invoice.paid") {
    const invoice = event.data.object as Stripe.Invoice;
    const billingReason = invoice.billing_reason;

    if (billingReason && billingReason !== "subscription_create") {
      const stripeCustomerId =
        typeof invoice.customer === "string"
          ? invoice.customer
          : invoice.customer?.id;
      const invoiceWithSubscription = invoice as Stripe.Invoice & {
        parent?: {
          subscription_details?: {
            subscription?: string | null;
          } | null;
        } | null;
        subscription?: string | Stripe.Subscription | null;
      };
      const stripeSubscriptionId =
        typeof invoiceWithSubscription.subscription === "string"
          ? invoiceWithSubscription.subscription
          : invoiceWithSubscription.subscription?.id ||
            invoiceWithSubscription.parent?.subscription_details?.subscription ||
            null;

      if (stripeCustomerId) {
        const { data: customers, error: customerError } = await supabaseAdmin
          .from("customers")
          .select("id, payment_status")
          .eq("stripe_customer_id", stripeCustomerId);

        if (customerError) {
          console.error("Invoice paid customer lookup error:", customerError);
        }

        const { data: existingAudit, error: auditLookupError } =
          await supabaseAdmin
            .from("audit_events")
            .select("id")
            .eq("event_type", "subscription_invoice_paid")
            .contains("metadata", { invoiceId: invoice.id })
            .limit(1);

        if (auditLookupError) {
          console.error("Invoice paid audit lookup error:", auditLookupError);
        }

        if (stripeSubscriptionId) {
          const { data: localSubscription, error: subscriptionLookupError } =
            await supabaseAdmin
              .from("customer_subscriptions")
              .select("id, status")
              .eq("stripe_subscription_id", stripeSubscriptionId)
              .maybeSingle();

          if (subscriptionLookupError) {
            console.error(
              "Invoice paid subscription lookup error:",
              subscriptionLookupError,
            );
          } else if (
            localSubscription &&
            !["refunded", "cancelled"].includes(localSubscription.status)
          ) {
            const { error: subscriptionError } = await supabaseAdmin
              .from("customer_subscriptions")
              .update({
                status: "active",
                stripe_payment_status: "paid",
                fulfillment_status: "active",
              })
              .eq("id", localSubscription.id);

            if (subscriptionError) {
              console.error(
                "Invoice paid subscription update error:",
                subscriptionError,
              );
            }
          }
        }

        if (!existingAudit?.length) {
          await Promise.all(
            (customers || [])
              .filter((customer) => customer.payment_status !== "refunded")
              .map((customer) =>
                recordAuditEvent(supabaseAdmin, {
                  customerId: customer.id,
                  actorType: "stripe",
                  eventType: "subscription_invoice_paid",
                  eventDescription:
                    "Stripe reported a paid subscription invoice.",
                  metadata: {
                    stripeCustomerId,
                    stripeSubscriptionId,
                    invoiceId: invoice.id,
                    billingReason,
                    amountPaid: invoice.amount_paid,
                    amountDue: invoice.amount_due,
                    total: invoice.total,
                    totalTaxes: invoice.total_taxes,
                  },
                }),
              ),
          );
        }
      }
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription;

    const customerId = subscription.customer;

    const { data: customers, error: customerLookupError } = await supabaseAdmin
      .from("customers")
      .select("id, payment_status, inactive_reason, cancellation_reason, cancellation_source, cancelled_at")
      .eq("stripe_customer_id", customerId);

    if (customerLookupError) {
      console.error("Subscription deleted customer lookup error:", customerLookupError);
    } else {
      const cancelledAt = new Date().toISOString();

      for (const customer of customers || []) {
        const appInitiatedCancellation =
          customer.cancellation_source === "customer" ||
          customer.cancellation_source === "admin";
        const refundBeforeProduction =
          customer.payment_status === "refunded" ||
          customer.cancellation_reason === "refunded_before_production";

        const { error } = await supabaseAdmin
          .from("customers")
          .update({
            status: "suspended",
            payment_status: refundBeforeProduction ? "refunded" : "cancelled",
            inactive_reason: appInitiatedCancellation
              ? customer.inactive_reason || "subscription_cancelled"
              : "subscription_cancelled",
            cancelled_at: customer.cancelled_at || cancelledAt,
            cancellation_source: appInitiatedCancellation
              ? customer.cancellation_source
              : "stripe",
          })
          .eq("id", customer.id);

        if (error) {
          console.error("Subscription deleted customer update error:", error);
        }
      }

      await supabaseAdmin
        .from("customer_subscriptions")
        .update({
          fulfillment_status: "cancelled",
        })
        .eq("stripe_subscription_id", subscription.id);

      await supabaseAdmin
        .from("customer_subscriptions")
        .update({
          status: "cancelled",
          fulfillment_status: "cancelled",
        })
        .eq("stripe_subscription_id", subscription.id)
        .neq("status", "refunded");

      await Promise.all(
        (customers || []).map((customer) =>
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
