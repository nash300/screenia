import { NextResponse } from "next/server";
import Stripe from "stripe";
import {
  handleStripeDispute,
  handleStripeRefund,
  stripeObjectId,
} from "./stripe-financial-risk-handlers";
import { stripe, supabaseAdmin } from "./stripe-webhook-clients";
import { recordStripeWebhookFailureVisibility } from "./stripe-webhook-failure";
import { syncStripeSubscription } from "./stripe-subscription-sync";
import {
  formatInvoiceDate,
  formatStripeSek,
  fulfillmentStatusForPaidRecovery,
  includedVatOreFromStripeTotal,
  invoiceCustomerId,
  invoiceSubscriptionId,
  invoiceTaxAmountOre,
  parseAddOnSubscriptionItems,
} from "./stripe-webhook-utils";
import { recordAuditEvent } from "@/lib/server/audit";
import { createAdminNotification } from "@/lib/server/admin-notifications";
import { getStripeSubscriptionEntitlement } from "@/lib/server/subscription-entitlements";
import {
  escapeHtml,
  renderBrandedEmail,
  sendTransactionalEmail,
} from "@/lib/server/email";

async function startWebhookEventProcessing(event: Stripe.Event) {
  const { data, error } = await supabaseAdmin
    .from("stripe_webhook_events")
    .insert({
      stripe_event_id: event.id,
      event_type: event.type,
      livemode: event.livemode,
      processing_status: "processing",
    })
    .select("id")
    .single();

  if (!error) {
    return { eventRowId: data.id as string, duplicate: false };
  }

  if (error.code !== "23505") {
    console.error("Stripe webhook event ledger insert error:", error);
    throw new Error("Stripe webhook event ledger is not ready.");
  }

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("stripe_webhook_events")
    .select("id, processing_status")
    .eq("stripe_event_id", event.id)
    .single();

  if (existingError || !existing) {
    console.error("Stripe webhook event ledger lookup error:", existingError);
    throw new Error("Stripe webhook event ledger lookup failed.");
  }

  if (existing.processing_status === "processed") {
    return { eventRowId: existing.id as string, duplicate: true };
  }

  const { error: retryError } = await supabaseAdmin
    .from("stripe_webhook_events")
    .update({
      processing_status: "processing",
      processing_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", existing.id);

  if (retryError) {
    console.error("Stripe webhook event ledger retry update error:", retryError);
    throw new Error("Stripe webhook event ledger retry failed.");
  }

  return { eventRowId: existing.id as string, duplicate: false };
}

async function finishWebhookEventProcessing(
  eventRowId: string,
  status: "processed" | "failed",
  error?: unknown,
) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : null;

  const { error: updateError } = await supabaseAdmin
    .from("stripe_webhook_events")
    .update({
      processing_status: status,
      processing_error: message,
      processed_at: status === "processed" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", eventRowId);

  if (updateError) {
    console.error("Stripe webhook event ledger finish error:", updateError);
  }
}

async function saveCustomerAuthUser(customerId: string, authUserId: string) {
  const { error } = await supabaseAdmin
    .from("customers")
    .update({ auth_user_id: authUserId })
    .eq("id", customerId);

  if (
    error &&
    error.code !== "PGRST204" &&
    error.code !== "42703" &&
    error.code !== "23505"
  ) {
    console.error("Save customer auth user error:", error);
  }
}

async function findAuthUserByEmail(email: string) {
  const normalizedEmail = email.toLowerCase();
  let page = 1;
  const perPage = 100;

  while (page <= 10) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      console.error("List auth users error:", error);
      return null;
    }

    const existingUser = data.users.find(
      (user) => user.email?.toLowerCase() === normalizedEmail,
    );

    if (existingUser) return existingUser;
    if (!data.nextPage || data.users.length === 0) return null;
    page = data.nextPage;
  }

  return null;
}

async function getAuthUserCustomerConflict(
  authUserId: string,
  targetCustomerId: string,
  metadataCustomerId?: unknown,
) {
  const metadataId =
    typeof metadataCustomerId === "string" ? metadataCustomerId.trim() : "";

  if (metadataId && metadataId !== targetCustomerId) {
    return metadataId;
  }

  const { data, error } = await supabaseAdmin
    .from("customers")
    .select("id")
    .eq("auth_user_id", authUserId)
    .neq("id", targetCustomerId)
    .limit(1)
    .maybeSingle();

  if (error && error.code !== "PGRST116" && error.code !== "42703") {
    console.error("Customer auth user conflict lookup error:", error);
  }

  return data?.id || null;
}

async function recordCustomerAuthUserConflict({
  customerId,
  email,
  existingAuthUserId,
  conflictingCustomerId,
}: {
  customerId: string;
  email: string;
  existingAuthUserId: string;
  conflictingCustomerId: string;
}) {
  try {
    await recordAuditEvent(
      supabaseAdmin,
      {
        customerId,
        actorType: "system",
        eventType: "customer_auth_user_conflict",
        eventDescription:
          "A paid customer email already belongs to another customer account.",
        metadata: {
          email,
          existingAuthUserId,
          conflictingCustomerId,
        },
      },
      { throwOnError: true },
    );
  } catch (auditError) {
    console.error("Customer auth conflict audit error:", auditError);
  }

  await createAdminNotification(supabaseAdmin, {
    customerId,
    eventType: "customer_auth_user_conflict",
    title: "Customer account email conflict",
    message:
      "A paid customer uses an email address that is already linked to another customer account. Do not send account access until the duplicate email is resolved.",
    priority: "urgent",
    metadata: {
      email,
      existingAuthUserId,
      conflictingCustomerId,
    },
  }).catch((notificationError) => {
    console.error("Customer auth conflict notification error:", notificationError);
  });
}

async function sendCustomerPasswordSetupEmail({
  customerId,
  email,
}: {
  customerId: string;
  email: string;
}) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const redirectTo = appUrl
    ? `${appUrl}/auth/callback?next=/account/reset-password`
    : undefined;

  const { error } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
    redirectTo,
  });

  try {
    await recordAuditEvent(
      supabaseAdmin,
      {
        customerId,
        actorType: "system",
        eventType: error
          ? "customer_password_setup_email_failed"
          : "customer_password_setup_email_requested",
        eventDescription: error
          ? "System could not request an account password setup email after payment."
          : "System requested an account password setup email after payment.",
        metadata: {
          email,
          redirectTo: redirectTo || null,
          error: error?.message || null,
        },
      },
      { throwOnError: true },
    );
  } catch (auditError) {
    console.error("Customer password setup email audit error:", auditError);
  }

  if (error) {
    await createAdminNotification(supabaseAdmin, {
      customerId,
      eventType: "customer_password_setup_email_failed",
      title: "Customer password setup email failed",
      message:
        "A customer paid successfully, but Screenia could not send the account password setup email. Send a password reset link manually before handoff.",
      priority: "urgent",
      metadata: {
        email,
        redirectTo: redirectTo || null,
        error: error.message,
      },
    }).catch((notificationError) => {
      console.error(
        "Customer password setup failure notification error:",
        notificationError,
      );
    });
  }

  return !error;
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

  const existingUser = await findAuthUserByEmail(email);

  if (existingUser) {
    const conflictingCustomerId = await getAuthUserCustomerConflict(
      existingUser.id,
      customerId,
      existingUser.user_metadata?.customer_id,
    );

    if (conflictingCustomerId) {
      await recordCustomerAuthUserConflict({
        customerId,
        email,
        existingAuthUserId: existingUser.id,
        conflictingCustomerId,
      });
      return null;
    }

    const { error: metadataError } = await supabaseAdmin.auth.admin.updateUserById(
      existingUser.id,
      {
        user_metadata: {
          ...(existingUser.user_metadata || {}),
          customer_id: customerId,
          account_type: "customer",
        },
      },
    );

    if (metadataError) {
      console.error("Update existing customer auth user error:", metadataError);
      return null;
    }

    await saveCustomerAuthUser(customerId, existingUser.id);
    await sendCustomerPasswordSetupEmail({ customerId, email });
    return existingUser.id;
  }

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
    const existingUser = await findAuthUserByEmail(email);

    if (existingUser) {
      const conflictingCustomerId = await getAuthUserCustomerConflict(
        existingUser.id,
        customerId,
        existingUser.user_metadata?.customer_id,
      );

      if (conflictingCustomerId) {
        await recordCustomerAuthUserConflict({
          customerId,
          email,
          existingAuthUserId: existingUser.id,
          conflictingCustomerId,
        });
        return null;
      }

      await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
        user_metadata: {
          ...(existingUser.user_metadata || {}),
          customer_id: customerId,
          account_type: "customer",
        },
      });
      await saveCustomerAuthUser(customerId, existingUser.id);
      await sendCustomerPasswordSetupEmail({ customerId, email });
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

  let eventRowId: string;
  try {
    const processing = await startWebhookEventProcessing(event);
    eventRowId = processing.eventRowId;

    if (processing.duplicate) {
      return NextResponse.json({ received: true, duplicate: true });
    }
  } catch (error) {
    console.error("Stripe webhook event processing guard error:", error);
    return NextResponse.json(
      { error: "Webhook event ledger is not ready." },
      { status: 500 },
    );
  }

  try {
    if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    const customerId = session.metadata?.customer_id;
    const customerSubscriptionId = session.metadata?.customer_subscription_id;
    const orderNumber = session.metadata?.order_number;
    const discountCouponId =
      session.metadata?.stripe_discount_coupon_id || null;
    const customerEmail =
      session.customer_details?.email || session.customer_email || null;
    const accountEmail = session.metadata?.account_email || customerEmail;
    const includedVatOre =
      session.total_details?.amount_tax ||
      includedVatOreFromStripeTotal(session.amount_total);
    const checkoutKind = session.metadata?.checkout_kind || "new_subscription";
    const isExistingCustomerAddOn = checkoutKind === "existing_customer_add_on";
    const existingStripeSubscriptionId =
      session.metadata?.existing_stripe_subscription_id || null;

    if (customerId) {
      await ensureCustomerAuthUser(customerId, accountEmail);
      let stripeSubscription: Stripe.Subscription | null = null;
      let effectiveStripeSubscriptionId =
        typeof session.subscription === "string" ? session.subscription : null;
      if (isExistingCustomerAddOn) {
        const addOnItems = parseAddOnSubscriptionItems(
          session.metadata?.subscription_items,
        );

        if (!existingStripeSubscriptionId || !addOnItems.length) {
          await recordStripeWebhookFailureVisibility({
            eventType: "stripe_add_on_subscription_update_failed",
            title: "Add-on subscription update failed",
            message:
              "A paid add-on checkout did not include enough metadata to update the existing Stripe subscription.",
            metadata: {
              stripeCheckoutSessionId: session.id,
              stripeCustomerId: session.customer,
              customerSubscriptionId,
              orderNumber,
              existingStripeSubscriptionId,
              addOnItemCount: addOnItems.length,
            },
            customerIds: [customerId],
          });
        }

        try {
          stripeSubscription = await stripe.subscriptions.update(
            existingStripeSubscriptionId as string,
            {
              items: addOnItems,
              proration_behavior: "none",
              metadata: {
                last_add_on_order_number: orderNumber || "",
                last_add_on_customer_subscription_id:
                  customerSubscriptionId || "",
              },
            },
          );
          effectiveStripeSubscriptionId = stripeSubscription.id;
        } catch (error) {
          await recordStripeWebhookFailureVisibility({
            eventType: "stripe_add_on_subscription_update_failed",
            title: "Add-on subscription update failed",
            message:
              "The add-on one-time payment succeeded, but Screenia could not add the monthly charge to the existing Stripe subscription.",
            metadata: {
              stripeCheckoutSessionId: session.id,
              stripeCustomerId: session.customer,
              customerSubscriptionId,
              orderNumber,
              existingStripeSubscriptionId,
              error: error instanceof Error ? error.message : String(error),
            },
            customerIds: [customerId],
          });
        }
      }
      if (session.subscription) {
        try {
          stripeSubscription = await stripe.subscriptions.retrieve(
            session.subscription as string,
          );
        } catch (error) {
          console.error("Retrieve checkout subscription error:", error);
        }
      }
      const entitlement = stripeSubscription
        ? getStripeSubscriptionEntitlement(stripeSubscription)
        : null;
      const customerUpdate: Record<string, string | null> = {
        status: "paid",
        payment_status: "paid",
        stripe_customer_id: session.customer as string,
        stripe_subscription_id: effectiveStripeSubscriptionId,
        service_access_status: entitlement?.serviceAccessStatus || "active",
        service_access_until: entitlement?.serviceAccessUntil || null,
        inactive_reason: null,
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
            stripeSubscriptionId: effectiveStripeSubscriptionId,
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
            stripeSubscriptionId: effectiveStripeSubscriptionId,
            stripeCheckoutSessionId: session.id,
            customerSubscriptionId,
            orderNumber,
            customerEmail,
          },
        });
      }

      if (effectiveStripeSubscriptionId) {
        if (discountCouponId) {
          try {
            await stripe.subscriptions.update(effectiveStripeSubscriptionId, {
              discounts: [{ coupon: discountCouponId }],
            });
          } catch (error) {
            console.error("Apply subscription discount error:", error);
          }
        }

        const subscriptionUpdate = {
          status: "paid",
          stripe_customer_id: session.customer as string,
          stripe_subscription_id: effectiveStripeSubscriptionId,
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
          trial_starts_at: entitlement?.trialStart || null,
          trial_ends_at: entitlement?.trialEnd || null,
          stripe_current_period_start: entitlement?.currentPeriodStart || null,
          stripe_current_period_end: entitlement?.currentPeriodEnd || null,
          cancel_at_period_end: entitlement?.cancelAtPeriodEnd || false,
          cancellation_effective_at: entitlement?.cancellationEffectiveAt || null,
          pause_started_at: null,
          pause_resumes_at: null,
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

    const customerId = invoiceCustomerId(invoice);
    const stripeSubscriptionId = invoiceSubscriptionId(invoice);

    if (!customerId) {
      console.warn("Payment failed invoice did not include a customer id:", invoice.id);
      await recordStripeWebhookFailureVisibility({
        eventType: "stripe_invoice_payment_failed_sync_failed",
        title: "Failed-payment invoice sync failed",
        message: `Stripe failed-payment invoice ${invoice.id} did not include a customer id.`,
        metadata: {
          invoiceId: invoice.id,
          stripeSubscriptionId,
          billingReason: invoice.billing_reason,
          amountDue: invoice.amount_due,
          total: invoice.total,
        },
      });
    } else {
    const { data, error } = await supabaseAdmin
      .from("customers")
      .update({
        status: "suspended",
        payment_status: "failed",
        service_access_status: "payment_failed",
        service_access_until: null,
        inactive_reason: "payment_failed",
        cancellation_source: "stripe",
      })
      .eq("stripe_customer_id", customerId)
      .select();

    if (error) {
      console.error("Payment failed update error:", error);
      await recordStripeWebhookFailureVisibility({
        eventType: "stripe_invoice_payment_failed_sync_failed",
        title: "Failed-payment invoice sync failed",
        message: `Stripe failed-payment invoice ${invoice.id} could not suspend customer access: ${error.message}`,
        metadata: {
          stripeCustomerId: customerId,
          stripeSubscriptionId,
          invoiceId: invoice.id,
          error: error.message,
        },
      });
    }

    if (!data || data.length === 0) {
      console.warn("No customer found for failed payment:", customerId);
      await recordStripeWebhookFailureVisibility({
        eventType: "stripe_invoice_payment_failed_sync_failed",
        title: "Failed-payment invoice sync failed",
        message: `Stripe failed-payment invoice ${invoice.id} did not match any Screenia customer.`,
        metadata: {
          stripeCustomerId: customerId,
          stripeSubscriptionId,
          invoiceId: invoice.id,
          error: "No Screenia customer matched invoice customer id.",
        },
      });
    } else {
      const { error: subscriptionError } = await supabaseAdmin
        .from("customer_subscriptions")
        .update({
          status: "payment_failed",
          stripe_invoice_id: invoice.id,
          stripe_payment_status: "failed",
          tax_amount_sek: invoiceTaxAmountOre(invoice),
          total_amount_sek: invoice.total,
          fulfillment_status: "payment_failed",
        })
        .eq(
          stripeSubscriptionId ? "stripe_subscription_id" : "stripe_customer_id",
          stripeSubscriptionId || customerId,
        );

      if (subscriptionError) {
        console.error("Payment failed subscription update error:", subscriptionError);
        await recordStripeWebhookFailureVisibility({
          eventType: "stripe_invoice_payment_failed_sync_failed",
          title: "Failed-payment invoice sync failed",
          message: `Stripe failed-payment invoice ${invoice.id} could not update the local subscription row: ${subscriptionError.message}`,
          metadata: {
            stripeCustomerId: customerId,
            stripeSubscriptionId,
            invoiceId: invoice.id,
            error: subscriptionError.message,
          },
          customerIds: data.map((customer) => customer.id),
        });
      }

      try {
        await Promise.all(
          data.map((customer) =>
            Promise.all([
              recordAuditEvent(
                supabaseAdmin,
                {
                  customerId: customer.id,
                  actorType: "stripe",
                  eventType: "payment_failed",
                  dedupeKey: `payment_failed:${invoice.id}`,
                  eventDescription:
                    "Stripe reported a failed payment. Customer was suspended.",
                  metadata: {
                    stripeCustomerId: customerId,
                    stripeSubscriptionId,
                    invoiceId: invoice.id,
                    amountDue: invoice.amount_due,
                    total: invoice.total,
                    taxAmount: invoiceTaxAmountOre(invoice),
                  },
                },
                { throwOnError: true },
              ),
              createAdminNotification(
                supabaseAdmin,
                {
                  customerId: customer.id,
                  eventType: "payment_failed",
                  dedupeKey: `payment_failed:${invoice.id}`,
                  title: "Payment failed",
                  message: `Stripe reported a failed payment for invoice ${invoice.id}.`,
                  priority: "urgent",
                  metadata: {
                    stripeCustomerId: customerId,
                    stripeSubscriptionId,
                    invoiceId: invoice.id,
                    amountDue: invoice.amount_due,
                    total: invoice.total,
                    taxAmount: invoiceTaxAmountOre(invoice),
                  },
                },
                { throwOnError: true },
              ),
            ]),
          ),
        );
      } catch (evidenceError) {
        console.error("Payment failed evidence storage error:", evidenceError);
        await recordStripeWebhookFailureVisibility({
          eventType: "stripe_invoice_payment_failed_evidence_failed",
          title: "Failed-payment invoice evidence failed",
          message: `Stripe failed-payment invoice ${invoice.id} suspended access, but Screenia could not store required audit or notification evidence.`,
          metadata: {
            stripeCustomerId: customerId,
            stripeSubscriptionId,
            invoiceId: invoice.id,
            error:
              evidenceError instanceof Error
                ? evidenceError.message
                : String(evidenceError),
          },
          customerIds: data.map((customer) => customer.id),
        });
      }
    }
    }
  }

    if (event.type === "invoice.paid") {
    const invoice = event.data.object as Stripe.Invoice;
    const billingReason = invoice.billing_reason;

    if (billingReason && billingReason !== "subscription_create") {
      if (
        billingReason === "subscription_update" &&
        invoice.total === 0 &&
        invoice.amount_paid === 0
      ) {
        return NextResponse.json({ received: true, ignored: "zero_amount_subscription_update" });
      }

      const stripeCustomerId = invoiceCustomerId(invoice);
      const stripeSubscriptionId = invoiceSubscriptionId(invoice);
      const paidInvoiceMetadata = {
        stripeCustomerId,
        stripeSubscriptionId,
        invoiceId: invoice.id,
        billingReason,
        amountPaid: invoice.amount_paid,
        amountDue: invoice.amount_due,
        total: invoice.total,
        taxAmount: invoiceTaxAmountOre(invoice),
      };

      if (!stripeCustomerId) {
        await recordStripeWebhookFailureVisibility({
          eventType: "stripe_invoice_paid_sync_failed",
          title: "Paid invoice sync failed",
          message: `Stripe paid invoice ${invoice.id} did not include a customer id.`,
          metadata: paidInvoiceMetadata,
        });
      }

      if (!stripeSubscriptionId) {
        await recordStripeWebhookFailureVisibility({
          eventType: "stripe_invoice_paid_sync_failed",
          title: "Paid invoice sync failed",
          message: `Stripe paid invoice ${invoice.id} did not include a subscription id.`,
          metadata: paidInvoiceMetadata,
        });
      }

      const paidStripeCustomerId = stripeCustomerId as string;
      const paidStripeSubscriptionId = stripeSubscriptionId as string;

      const { data: customers, error: customerError } = await supabaseAdmin
        .from("customers")
        .select(
          "id, name, email, billing_email, customer_number, status, payment_status, inactive_reason, production_status, layout_started_at, content_collected_at, preview_status",
        )
        .eq("stripe_customer_id", paidStripeCustomerId);

      if (customerError) {
        console.error("Invoice paid customer lookup error:", customerError);
        await recordStripeWebhookFailureVisibility({
          eventType: "stripe_invoice_paid_sync_failed",
          title: "Paid invoice sync failed",
          message: `Stripe paid invoice ${invoice.id} could not look up the customer: ${customerError.message}`,
          metadata: {
            ...paidInvoiceMetadata,
            error: customerError.message,
          },
        });
      }

      const matchedCustomers = customers ?? [];

      if (!matchedCustomers.length) {
        await recordStripeWebhookFailureVisibility({
          eventType: "stripe_invoice_paid_sync_failed",
          title: "Paid invoice sync failed",
          message: `Stripe paid invoice ${invoice.id} did not match any Screenia customer.`,
          metadata: {
            ...paidInvoiceMetadata,
            error: "No Screenia customer matched invoice customer id.",
          },
        });
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
        await recordStripeWebhookFailureVisibility({
          eventType: "stripe_invoice_paid_evidence_failed",
          title: "Paid invoice evidence failed",
          message: `Stripe paid invoice ${invoice.id} could not verify existing audit evidence: ${auditLookupError.message}`,
          metadata: {
            ...paidInvoiceMetadata,
            error: auditLookupError.message,
          },
          customerIds: matchedCustomers.map((customer) => customer.id),
        });
      }

      const { data: existingEmailAudit, error: emailAuditLookupError } =
        await supabaseAdmin
          .from("audit_events")
          .select("id")
          .eq("event_type", "subscription_invoice_email_sent")
          .contains("metadata", { invoiceId: invoice.id })
          .limit(1);

      if (emailAuditLookupError) {
        await recordStripeWebhookFailureVisibility({
          eventType: "stripe_invoice_email_evidence_failed",
          title: "Invoice email evidence failed",
          message: `Screenia could not verify email evidence for paid invoice ${invoice.id}: ${emailAuditLookupError.message}`,
          metadata: {
            ...paidInvoiceMetadata,
            error: emailAuditLookupError.message,
          },
          customerIds: matchedCustomers.map((customer) => customer.id),
        });
      }

      const { data: localSubscriptions, error: subscriptionLookupError } =
        await supabaseAdmin
          .from("customer_subscriptions")
          .select("id, status")
          .eq("stripe_subscription_id", paidStripeSubscriptionId);

      if (subscriptionLookupError) {
        console.error(
          "Invoice paid subscription lookup error:",
          subscriptionLookupError,
        );
        await recordStripeWebhookFailureVisibility({
          eventType: "stripe_invoice_paid_sync_failed",
          title: "Paid invoice sync failed",
          message: `Stripe paid invoice ${invoice.id} could not look up the local subscription: ${subscriptionLookupError.message}`,
          metadata: {
            ...paidInvoiceMetadata,
            error: subscriptionLookupError.message,
          },
          customerIds: matchedCustomers.map((customer) => customer.id),
        });
      }

      const matchedSubscriptions = localSubscriptions ?? [];

      if (!matchedSubscriptions.length) {
        await recordStripeWebhookFailureVisibility({
          eventType: "stripe_invoice_paid_sync_failed",
          title: "Paid invoice sync failed",
          message: `Stripe paid invoice ${invoice.id} did not match a local subscription row.`,
          metadata: {
            ...paidInvoiceMetadata,
            error: "No customer_subscriptions row matched stripe_subscription_id.",
          },
          customerIds: matchedCustomers.map((customer) => customer.id),
        });
      }

      const updatableSubscriptionIds = matchedSubscriptions
        .filter(
          (subscription) =>
            !["refunded", "cancelled"].includes(subscription.status),
        )
        .map((subscription) => subscription.id);

      if (updatableSubscriptionIds.length) {
        const recoveryFulfillmentStatus = fulfillmentStatusForPaidRecovery(
          matchedCustomers[0] || {},
        );

        const { error: subscriptionError } = await supabaseAdmin
          .from("customer_subscriptions")
          .update({
            status: "active",
            stripe_invoice_id: invoice.id,
            stripe_payment_status: "paid",
            tax_amount_sek: invoiceTaxAmountOre(invoice),
            total_amount_sek: invoice.total,
            fulfillment_status: recoveryFulfillmentStatus,
          })
          .in("id", updatableSubscriptionIds);

        if (subscriptionError) {
          console.error(
            "Invoice paid subscription update error:",
            subscriptionError,
          );
          await recordStripeWebhookFailureVisibility({
            eventType: "stripe_invoice_paid_sync_failed",
            title: "Paid invoice sync failed",
            message: `Stripe paid invoice ${invoice.id} could not update the local subscription row: ${subscriptionError.message}`,
            metadata: {
              ...paidInvoiceMetadata,
              error: subscriptionError.message,
            },
            customerIds: matchedCustomers.map((customer) => customer.id),
          });
        }
      }

      let entitlement: Awaited<ReturnType<typeof syncStripeSubscription>> | null =
        null;
      try {
        const stripeSubscription =
          await stripe.subscriptions.retrieve(paidStripeSubscriptionId);
        entitlement = await syncStripeSubscription(stripeSubscription);
      } catch (error) {
        console.error("Invoice paid subscription entitlement sync error:", error);
        await recordStripeWebhookFailureVisibility({
          eventType: "stripe_invoice_paid_sync_failed",
          title: "Paid invoice sync failed",
          message: `Stripe paid invoice ${invoice.id} could not sync subscription entitlement.`,
          metadata: {
            ...paidInvoiceMetadata,
            error: error instanceof Error ? error.message : String(error),
          },
          customerIds: matchedCustomers.map((customer) => customer.id),
        });
      }

      if (!entitlement) {
        await recordStripeWebhookFailureVisibility({
          eventType: "stripe_invoice_paid_sync_failed",
          title: "Paid invoice sync failed",
          message: `Stripe paid invoice ${invoice.id} did not produce subscription entitlement state.`,
          metadata: {
            ...paidInvoiceMetadata,
            error: "Missing synced entitlement after Stripe subscription lookup.",
          },
          customerIds: matchedCustomers.map((customer) => customer.id),
        });
      }

      const syncedEntitlement = entitlement as Awaited<
        ReturnType<typeof syncStripeSubscription>
      >;

      if (!existingEmailAudit?.length) {
        const invoiceNumber = invoice.number || invoice.id;
        const invoiceUrl =
          invoice.hosted_invoice_url ||
          `${(process.env.NEXT_PUBLIC_APP_URL || "https://screenia.se").replace(/\/$/, "")}/account?section=billing`;
        const taxAmount = invoiceTaxAmountOre(invoice);
        const servicePeriod = invoice.lines.data[0]?.period;
        const servicePeriodLabel =
          servicePeriod?.start && servicePeriod?.end
            ? `${formatInvoiceDate(servicePeriod.start)} - ${formatInvoiceDate(servicePeriod.end)}`
            : null;

        for (const customer of matchedCustomers) {
          const recipient = String(customer.billing_email || customer.email || "")
            .trim()
            .toLowerCase();
          const customerName = String(customer.name || "kund").trim() || "kund";

          if (!recipient) {
            await Promise.all([
              recordAuditEvent(
                supabaseAdmin,
                {
                  customerId: customer.id,
                  actorType: "system",
                  eventType: "subscription_invoice_email_failed",
                  eventDescription:
                    "A paid subscription invoice could not be emailed because the customer has no billing or account email.",
                  metadata: paidInvoiceMetadata,
                },
                { throwOnError: true },
              ),
              createAdminNotification(
                supabaseAdmin,
                {
                  customerId: customer.id,
                  eventType: "subscription_invoice_email_failed",
                  title: "Paid invoice email not sent",
                  message: `Invoice ${invoiceNumber} is paid, but the customer has no billing or account email.`,
                  priority: "urgent",
                  metadata: paidInvoiceMetadata,
                },
                { throwOnError: true },
              ),
            ]);
            continue;
          }

          const { data: newDispatch, error: dispatchInsertError } =
            await supabaseAdmin
              .from("billing_email_dispatches")
              .insert({
                stripe_invoice_id: invoice.id,
                customer_id: customer.id,
                recipient_email: recipient,
                status: "pending",
              })
              .select("stripe_invoice_id, status, attempt_count")
              .maybeSingle();

          let dispatchClaimed = Boolean(newDispatch);

          if (dispatchInsertError?.code === "23505") {
            const { data: existingDispatch, error: existingDispatchError } =
              await supabaseAdmin
                .from("billing_email_dispatches")
                .select("status, attempt_count")
                .eq("stripe_invoice_id", invoice.id)
                .single();

            if (existingDispatchError || !existingDispatch) {
              await recordStripeWebhookFailureVisibility({
                eventType: "stripe_invoice_email_dispatch_failed",
                title: "Invoice email dispatch lock failed",
                message: `Screenia could not inspect the email dispatch lock for invoice ${invoice.id}.`,
                metadata: {
                  ...paidInvoiceMetadata,
                  recipient,
                  error:
                    existingDispatchError?.message ||
                    "The existing dispatch lock row was not found.",
                },
                customerIds: [customer.id],
              });
            }

            const lockedDispatch = existingDispatch as {
              status: string;
              attempt_count: number;
            };

            if (lockedDispatch.status === "failed") {
              const { data: retryDispatch, error: retryDispatchError } =
                await supabaseAdmin
                  .from("billing_email_dispatches")
                  .update({
                    status: "pending",
                    recipient_email: recipient,
                    attempt_count: lockedDispatch.attempt_count + 1,
                    last_error: null,
                  })
                  .eq("stripe_invoice_id", invoice.id)
                  .eq("status", "failed")
                  .select("stripe_invoice_id")
                  .maybeSingle();

              if (retryDispatchError) {
                await recordStripeWebhookFailureVisibility({
                  eventType: "stripe_invoice_email_dispatch_failed",
                  title: "Invoice email retry lock failed",
                  message: `Screenia could not claim the email retry for invoice ${invoice.id}.`,
                  metadata: {
                    ...paidInvoiceMetadata,
                    recipient,
                    error: retryDispatchError.message,
                  },
                  customerIds: [customer.id],
                });
              }

              dispatchClaimed = Boolean(retryDispatch);
            }
          } else if (dispatchInsertError) {
            await recordStripeWebhookFailureVisibility({
              eventType: "stripe_invoice_email_dispatch_failed",
              title: "Invoice email dispatch lock failed",
              message: `Screenia could not claim the email dispatch for invoice ${invoice.id}.`,
              metadata: {
                ...paidInvoiceMetadata,
                recipient,
                error: dispatchInsertError.message,
              },
              customerIds: [customer.id],
            });
          }

          if (!dispatchClaimed) continue;

          const emailResult = await sendTransactionalEmail({
            to: recipient,
            subject: `Din Screenia-faktura ${invoiceNumber} är betald`,
            text: `Hej ${customerName},

Din månadsfaktura ${invoiceNumber} är betald.
Belopp inklusive moms: ${formatStripeSek(invoice.amount_paid)}
Varav moms: ${formatStripeSek(taxAmount)}${
              servicePeriodLabel ? `\nPeriod: ${servicePeriodLabel}` : ""
            }

Öppna fakturan: ${invoiceUrl}

Frågor? Svara på detta mejl eller kontakta service@screenia.se.

Screenia`,
            html: renderBrandedEmail({
              eyebrow: "Månadsfaktura",
              title: "Din faktura är betald",
              intro: `Hej ${escapeHtml(customerName)}, här är kvittot på månadens Screenia-betalning.`,
              showHelper: false,
              children: `
                <div style="border:1px solid #d8e7fb; border-radius:12px; background:#f5f9ff; padding:18px;">
                  <p style="margin:0 0 10px;"><strong>Fakturanummer:</strong> ${escapeHtml(invoiceNumber)}</p>
                  <p style="margin:0 0 10px;"><strong>Betalt inklusive moms:</strong> ${escapeHtml(formatStripeSek(invoice.amount_paid))}</p>
                  <p style="margin:0 0 10px;"><strong>Varav moms:</strong> ${escapeHtml(formatStripeSek(taxAmount))}</p>
                  ${
                    servicePeriodLabel
                      ? `<p style="margin:0;"><strong>Period:</strong> ${escapeHtml(servicePeriodLabel)}</p>`
                      : ""
                  }
                </div>
                <p style="margin:20px 0 0;">
                  <a href="${escapeHtml(invoiceUrl)}" style="display:inline-block; border-radius:8px; background:#155ee8; color:#ffffff; padding:12px 18px; font-weight:700; text-decoration:none;">Öppna fakturan</a>
                </p>
                <p style="margin:18px 0 0; color:#526579;">Frågor om betalningen? Svara på detta mejl så hjälper vi dig.</p>
              `,
            }),
          });

          if (!emailResult.ok) {
            const { error: dispatchFailureError } = await supabaseAdmin
              .from("billing_email_dispatches")
              .update({
                status: "failed",
                last_error: emailResult.error,
              })
              .eq("stripe_invoice_id", invoice.id);

            if (dispatchFailureError) {
              await recordStripeWebhookFailureVisibility({
                eventType: "stripe_invoice_email_dispatch_failed",
                title: "Invoice email failure state was not stored",
                message: `Invoice ${invoice.id} email failed and its dispatch state could not be stored.`,
                metadata: {
                  ...paidInvoiceMetadata,
                  recipient,
                  emailError: emailResult.error,
                  error: dispatchFailureError.message,
                },
                customerIds: [customer.id],
              });
            }

            await Promise.all([
              recordAuditEvent(
                supabaseAdmin,
                {
                  customerId: customer.id,
                  actorType: "system",
                  eventType: "subscription_invoice_email_failed",
                  eventDescription:
                    "A paid subscription invoice email could not be sent.",
                  metadata: {
                    ...paidInvoiceMetadata,
                    recipient,
                    error: emailResult.error,
                  },
                },
                { throwOnError: true },
              ),
              createAdminNotification(
                supabaseAdmin,
                {
                  customerId: customer.id,
                  eventType: "subscription_invoice_email_failed",
                  title: "Paid invoice email failed",
                  message: `Invoice ${invoiceNumber} is paid, but its email to ${recipient} failed.`,
                  priority: "urgent",
                  metadata: {
                    ...paidInvoiceMetadata,
                    recipient,
                    error: emailResult.error,
                  },
                },
                { throwOnError: true },
              ),
            ]);
            continue;
          }

          const { error: dispatchSentError } = await supabaseAdmin
            .from("billing_email_dispatches")
            .update({
              status: "sent",
              resend_email_id: emailResult.id || null,
              sent_at: new Date().toISOString(),
              last_error: null,
            })
            .eq("stripe_invoice_id", invoice.id);

          if (dispatchSentError) {
            await recordStripeWebhookFailureVisibility({
              eventType: "stripe_invoice_email_dispatch_failed",
              title: "Invoice email success state was not stored",
              message: `Invoice ${invoice.id} email was sent, but its dispatch state could not be stored.`,
              metadata: {
                ...paidInvoiceMetadata,
                recipient,
                resendEmailId: emailResult.id || null,
                error: dispatchSentError.message,
              },
              customerIds: [customer.id],
            });
          }

          if (emailResult.id) {
            const { data: knownDeliveryEvents, error: deliveryLookupError } =
              await supabaseAdmin
                .from("resend_delivery_events")
                .select("event_type, processed_at")
                .eq("resend_email_id", emailResult.id)
                .order("processed_at", { ascending: false });

            if (deliveryLookupError) {
              await recordStripeWebhookFailureVisibility({
                eventType: "stripe_invoice_email_dispatch_failed",
                title: "Invoice email delivery reconciliation failed",
                message: `Invoice ${invoice.id} email was sent, but existing delivery events could not be reconciled.`,
                metadata: {
                  ...paidInvoiceMetadata,
                  recipient,
                  resendEmailId: emailResult.id,
                  error: deliveryLookupError.message,
                },
                customerIds: [customer.id],
              });
            }

            const deliveryEventTypes = new Set(
              (knownDeliveryEvents || []).map((delivery) => delivery.event_type),
            );
            const delivered = ["email.delivered", "email.opened", "email.clicked"].some(
              (eventType) => deliveryEventTypes.has(eventType),
            );
            const bounced = ["email.bounced", "email.complained"].some(
              (eventType) => deliveryEventTypes.has(eventType),
            );
            const failed = deliveryEventTypes.has("email.failed");

            if (delivered || bounced || failed) {
              const reconciledStatus = delivered
                ? "delivered"
                : bounced
                  ? "bounced"
                  : "failed";
              const { error: reconciliationError } = await supabaseAdmin
                .from("billing_email_dispatches")
                .update({
                  status: reconciledStatus,
                  delivered_at: delivered ? new Date().toISOString() : null,
                  last_error: delivered ? null : reconciledStatus,
                })
                .eq("stripe_invoice_id", invoice.id);

              if (reconciliationError) {
                await recordStripeWebhookFailureVisibility({
                  eventType: "stripe_invoice_email_dispatch_failed",
                  title: "Invoice email delivery state was not stored",
                  message: `Invoice ${invoice.id} delivery evidence was received, but the dispatch state could not be updated.`,
                  metadata: {
                    ...paidInvoiceMetadata,
                    recipient,
                    resendEmailId: emailResult.id,
                    reconciledStatus,
                    error: reconciliationError.message,
                  },
                  customerIds: [customer.id],
                });
              }
            }
          }

          await recordAuditEvent(
            supabaseAdmin,
            {
              customerId: customer.id,
              actorType: "system",
              eventType: "subscription_invoice_email_sent",
              dedupeKey: `subscription_invoice_email_sent:${invoice.id}:${customer.id}`,
              eventDescription:
                "Screenia sent the customer a paid subscription invoice email.",
              metadata: {
                ...paidInvoiceMetadata,
                invoiceNumber,
                recipient,
                resendEmailId: emailResult.id || null,
              },
            },
            { throwOnError: true },
          );
        }
      }

      const restoreDisplayAccess =
        syncedEntitlement.serviceAccessStatus === "active" ||
        syncedEntitlement.serviceAccessStatus === "active_until_period_end";
      const paymentFailureCustomerIds = matchedCustomers
        .filter(
          (customer) =>
            customer.payment_status === "failed" ||
            customer.status === "suspended" ||
            customer.inactive_reason === "payment_failed",
        )
        .map((customer) => customer.id);

      if (restoreDisplayAccess && paymentFailureCustomerIds.length > 0) {
        const recoveredAt = new Date().toISOString();
        const { error: restoreError } = await supabaseAdmin
          .from("customers")
          .update({
            status: "active",
            payment_status: "paid",
            service_access_status: syncedEntitlement.serviceAccessStatus,
            service_access_until: syncedEntitlement.serviceAccessUntil,
            inactive_reason: null,
            cancellation_source: null,
          })
          .in("id", paymentFailureCustomerIds);

        if (restoreError) {
          console.error(
            "Invoice paid customer access restore error:",
            restoreError,
          );
          await recordStripeWebhookFailureVisibility({
            eventType: "stripe_invoice_paid_sync_failed",
            title: "Paid invoice sync failed",
            message: `Stripe paid invoice ${invoice.id} could not restore customer access: ${restoreError.message}`,
            metadata: {
              ...paidInvoiceMetadata,
              error: restoreError.message,
            },
            customerIds: paymentFailureCustomerIds,
          });
        }

        const { error: resolveNotificationError } = await supabaseAdmin
          .from("admin_notifications")
          .update({
            resolved_at: recoveredAt,
            resolution_event_type: "payment_recovered",
          })
          .eq("event_type", "payment_failed")
          .contains("metadata", { invoiceId: invoice.id });

        if (resolveNotificationError) {
          await recordStripeWebhookFailureVisibility({
            eventType: "stripe_invoice_paid_evidence_failed",
            title: "Payment recovery alert resolution failed",
            message: `Invoice ${invoice.id} was paid, but Screenia could not resolve its failed-payment alert.`,
            metadata: {
              ...paidInvoiceMetadata,
              error: resolveNotificationError.message,
            },
            customerIds: paymentFailureCustomerIds,
          });
        }

        try {
          await Promise.all(
            paymentFailureCustomerIds.map((customerId) =>
              createAdminNotification(
                supabaseAdmin,
                {
                  customerId,
                  eventType: "payment_recovered",
                  dedupeKey: `payment_recovered:${invoice.id}:${customerId}`,
                  title: "Payment recovered",
                  message: `Invoice ${invoice.id} is paid and eligible service access was restored.`,
                  priority: "high",
                  metadata: {
                    ...paidInvoiceMetadata,
                    recoveredAt,
                    serviceAccessStatus: syncedEntitlement.serviceAccessStatus,
                    serviceAccessUntil: syncedEntitlement.serviceAccessUntil,
                  },
                },
                { throwOnError: true },
              ),
            ),
          );
        } catch (notificationError) {
          await recordStripeWebhookFailureVisibility({
            eventType: "stripe_invoice_paid_evidence_failed",
            title: "Payment recovery notification failed",
            message: `Invoice ${invoice.id} restored access, but Screenia could not create the recovery notification.`,
            metadata: {
              ...paidInvoiceMetadata,
              error:
                notificationError instanceof Error
                  ? notificationError.message
                  : String(notificationError),
            },
            customerIds: paymentFailureCustomerIds,
          });
        }
      }

      if (!existingAudit?.length) {
        try {
          await Promise.all(
            matchedCustomers
              .filter((customer) => customer.payment_status !== "refunded")
              .map((customer) =>
                recordAuditEvent(
                  supabaseAdmin,
                  {
                    customerId: customer.id,
                    actorType: "stripe",
                    eventType: "subscription_invoice_paid",
                    dedupeKey: `subscription_invoice_paid:${invoice.id}:${customer.id}`,
                    eventDescription:
                      "Stripe reported a paid subscription invoice.",
                    metadata: {
                      ...paidInvoiceMetadata,
                      serviceAccessStatus: syncedEntitlement.serviceAccessStatus,
                      serviceAccessUntil: syncedEntitlement.serviceAccessUntil,
                    },
                  },
                  { throwOnError: true },
                ),
              ),
          );
        } catch (evidenceError) {
          console.error("Invoice paid evidence storage error:", evidenceError);
          await recordStripeWebhookFailureVisibility({
            eventType: "stripe_invoice_paid_evidence_failed",
            title: "Paid invoice evidence failed",
            message: `Stripe paid invoice ${invoice.id} was synced, but Screenia could not store required audit evidence.`,
            metadata: {
              ...paidInvoiceMetadata,
              error:
                evidenceError instanceof Error
                  ? evidenceError.message
                  : String(evidenceError),
            },
            customerIds: matchedCustomers.map((customer) => customer.id),
          });
        }
      }
    }
  }

    if (
      event.type === "charge.dispute.created" ||
      event.type === "charge.dispute.updated" ||
      event.type === "charge.dispute.closed"
    ) {
    const dispute = event.data.object as Stripe.Dispute;
    await handleStripeDispute(dispute, event.type);
  }

    if (event.type === "charge.refunded") {
    const charge = event.data.object as Stripe.Charge;
    const latestRefund =
      typeof charge.refunds?.data?.[0] === "object"
        ? charge.refunds.data[0]
        : null;

    if (latestRefund) {
      await handleStripeRefund(latestRefund, event.type);
    }
  }

    if (event.type === "refund.created" || event.type === "refund.updated") {
    const refund = event.data.object as Stripe.Refund;
    await handleStripeRefund(refund, event.type);
  }

    if (event.type === "customer.subscription.updated") {
    const subscription = event.data.object as Stripe.Subscription;
    await syncStripeSubscription(subscription);
  }

    if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription;

    const customerId = stripeObjectId(subscription.customer);
    const deletedSubscriptionMetadata = {
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      stripeStatus: subscription.status,
    };

    if (!customerId) {
      await recordStripeWebhookFailureVisibility({
        eventType: "stripe_subscription_deleted_sync_failed",
        title: "Subscription deletion sync failed",
        message: `Stripe subscription deletion ${subscription.id} did not include a customer id.`,
        metadata: deletedSubscriptionMetadata,
      });
    }

    const deletedStripeCustomerId = customerId as string;

    const { data: customers, error: customerLookupError } = await supabaseAdmin
      .from("customers")
      .select("id, payment_status, inactive_reason, cancellation_reason, cancellation_source, cancelled_at")
      .eq("stripe_customer_id", deletedStripeCustomerId);

    if (customerLookupError) {
      console.error("Subscription deleted customer lookup error:", customerLookupError);
      await recordStripeWebhookFailureVisibility({
        eventType: "stripe_subscription_deleted_sync_failed",
        title: "Subscription deletion sync failed",
        message: `Stripe subscription deletion ${subscription.id} could not look up the customer: ${customerLookupError.message}`,
        metadata: {
          ...deletedSubscriptionMetadata,
          error: customerLookupError.message,
        },
      });
    }

    const matchedCustomers = customers ?? [];

    if (!matchedCustomers.length) {
      await recordStripeWebhookFailureVisibility({
        eventType: "stripe_subscription_deleted_sync_failed",
        title: "Subscription deletion sync failed",
        message: `Stripe subscription deletion ${subscription.id} did not match any Screenia customer.`,
        metadata: {
          ...deletedSubscriptionMetadata,
          error: "No Screenia customer matched stripe_customer_id.",
        },
      });
    }

    const cancelledAt = new Date().toISOString();

    for (const customer of matchedCustomers) {
      const appInitiatedCancellation =
        customer.cancellation_source === "customer" ||
        customer.cancellation_source === "admin";
      const refundedPayment = customer.payment_status === "refunded";

      const { error } = await supabaseAdmin
        .from("customers")
        .update({
          status: "suspended",
          payment_status: refundedPayment ? "refunded" : "cancelled",
          service_access_status: refundedPayment ? "refunded" : "cancelled",
          service_access_until: null,
          inactive_reason: refundedPayment
            ? customer.inactive_reason || "refunded_before_production"
            : appInitiatedCancellation
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
        await recordStripeWebhookFailureVisibility({
          eventType: "stripe_subscription_deleted_sync_failed",
          title: "Subscription deletion sync failed",
          message: `Stripe subscription deletion ${subscription.id} could not block customer display access: ${error.message}`,
          metadata: {
            ...deletedSubscriptionMetadata,
            customerId: customer.id,
            error: error.message,
          },
          customerIds: [customer.id],
        });
      }
    }

    const { error: fulfillmentUpdateError } = await supabaseAdmin
      .from("customer_subscriptions")
      .update({
        fulfillment_status: "cancelled",
        inventory_status: "cancelled",
      })
      .eq("stripe_subscription_id", subscription.id);

    if (fulfillmentUpdateError) {
      console.error(
        "Subscription deleted fulfillment update error:",
        fulfillmentUpdateError,
      );
      await recordStripeWebhookFailureVisibility({
        eventType: "stripe_subscription_deleted_sync_failed",
        title: "Subscription deletion sync failed",
        message: `Stripe subscription deletion ${subscription.id} could not update fulfillment status: ${fulfillmentUpdateError.message}`,
        metadata: {
          ...deletedSubscriptionMetadata,
          error: fulfillmentUpdateError.message,
        },
        customerIds: matchedCustomers.map((customer) => customer.id),
      });
    }

    const { error: subscriptionStatusError } = await supabaseAdmin
      .from("customer_subscriptions")
      .update({
        status: "cancelled",
        stripe_payment_status: subscription.status,
        fulfillment_status: "cancelled",
        inventory_status: "cancelled",
      })
      .eq("stripe_subscription_id", subscription.id)
      .neq("status", "refunded");

    if (subscriptionStatusError) {
      console.error(
        "Subscription deleted status update error:",
        subscriptionStatusError,
      );
      await recordStripeWebhookFailureVisibility({
        eventType: "stripe_subscription_deleted_sync_failed",
        title: "Subscription deletion sync failed",
        message: `Stripe subscription deletion ${subscription.id} could not update local subscription status: ${subscriptionStatusError.message}`,
        metadata: {
          ...deletedSubscriptionMetadata,
          error: subscriptionStatusError.message,
        },
        customerIds: matchedCustomers.map((customer) => customer.id),
      });
    }

    try {
      await Promise.all(
        matchedCustomers.map((customer) =>
          recordAuditEvent(
            supabaseAdmin,
            {
            customerId: customer.id,
            actorType: "stripe",
            eventType: "subscription_cancelled",
            eventDescription:
              "Stripe subscription was cancelled. Customer was suspended.",
            metadata: {
              stripeCustomerId: customerId,
              stripeSubscriptionId: subscription.id,
            },
            },
            { throwOnError: true },
          ),
        ),
      );
    } catch (evidenceError) {
      console.error("Subscription deleted evidence storage error:", evidenceError);
      await recordStripeWebhookFailureVisibility({
        eventType: "stripe_subscription_deleted_evidence_failed",
        title: "Subscription deletion evidence failed",
        message: `Stripe subscription deletion ${subscription.id} blocked access, but Screenia could not store required audit evidence.`,
        metadata: {
          ...deletedSubscriptionMetadata,
          error:
            evidenceError instanceof Error
              ? evidenceError.message
              : String(evidenceError),
        },
        customerIds: matchedCustomers.map((customer) => customer.id),
      });
    }
  }

    await finishWebhookEventProcessing(eventRowId, "processed");
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Stripe webhook processing error:", error);
    await finishWebhookEventProcessing(eventRowId, "failed", error);
    await createAdminNotification(supabaseAdmin, {
      eventType: "stripe_webhook_processing_failed",
      title: "Stripe webhook failed",
      message: `Stripe event ${event.type} (${event.id}) could not be processed. Check the webhook event ledger before retrying operational changes.`,
      priority: "urgent",
      metadata: {
        stripeEventId: event.id,
        stripeEventType: event.type,
        livemode: event.livemode,
        error: error instanceof Error ? error.message : String(error),
      },
    });
    return NextResponse.json(
      { error: "Webhook processing failed." },
      { status: 500 },
    );
  }
}
