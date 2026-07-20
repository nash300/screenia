import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { getRequestIp, recordAuditEvent } from "@/lib/server/audit";
import { createAdminNotification } from "@/lib/server/admin-notifications";
import { resolveStripeFirstPayment } from "@/lib/server/stripe-first-payment";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-04-22.dahlia",
});

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function getAdminUser() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (items) =>
          items.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          ),
      },
    },
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.app_metadata.role === "admin" ? user : null;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ customerId: string }> },
) {
  const user = await getAdminUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { customerId } = await params;
  const body = await request.json().catch(() => ({}));
  const action = String(body.action || "");
  const reason = String(body.reason || "").trim().slice(0, 1000);
  const requestedAmountOre = Math.round(Number(body.amountSek || 0) * 100);

  if (reason.length < 10) {
    return NextResponse.json(
      { error: "Record a clear customer request and admin reason." },
      { status: 400 },
    );
  }

  const [{ data: customer }, { data: subscription }] = await Promise.all([
    supabaseAdmin
      .from("customers")
      .select(
        "id, name, payment_status, service_access_status, layout_started_at, setup_fee_locked_at",
      )
      .eq("id", customerId)
      .maybeSingle(),
    supabaseAdmin
      .from("customer_subscriptions")
      .select(
        "id, order_number, total_amount_sek, stripe_checkout_session_id, stripe_payment_intent_id, stripe_subscription_id, stripe_payment_status, status",
      )
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (!customer || !subscription) {
    return NextResponse.json({ error: "Customer order was not found." }, { status: 404 });
  }

  if (!customer.layout_started_at || !customer.setup_fee_locked_at) {
    return NextResponse.json(
      { error: "Use the normal pre-production refund workflow before layout starts." },
      { status: 409 },
    );
  }

  const fullFirstPaymentOre = Math.round(subscription.total_amount_sek || 0);
  const auditBase = {
    customerId,
    actorType: "admin" as const,
    actorId: user.id,
    ipAddress: getRequestIp(request),
    userAgent: request.headers.get("user-agent"),
  };

  if (action === "record_post_layout_request") {
    const amountOre = requestedAmountOre || fullFirstPaymentOre;
    const recordedAt = new Date().toISOString();
    const { data: refundCase, error } = await supabaseAdmin
      .from("customer_refund_cases")
      .insert({
        customer_id: customerId,
        customer_subscription_id: subscription.id,
        order_number: subscription.order_number,
        request_type: "full",
        requested_amount_ore: amountOre,
        currency: "sek",
        customer_reason: reason,
        admin_decision: "denied",
        admin_reason:
          "Automatic full refund denied because documented layout work has started.",
        status: "closed",
        requested_at: recordedAt,
        decided_at: recordedAt,
        created_by: user.id,
      })
      .select("id")
      .single();

    if (error || !refundCase) {
      return NextResponse.json(
        { error: "The refund request could not be recorded." },
        { status: 500 },
      );
    }

    await Promise.all([
      recordAuditEvent(supabaseAdmin, {
        ...auditBase,
        eventType: "post_layout_refund_request_denied",
        eventDescription:
          "Admin recorded a full refund request after layout started; no Stripe refund was created.",
        metadata: {
          refundCaseId: refundCase.id,
          orderNumber: subscription.order_number,
          requestedAmountOre: amountOre,
          reason,
          layoutStartedAt: customer.layout_started_at,
          setupFeeLockedAt: customer.setup_fee_locked_at,
        },
      }),
      createAdminNotification(supabaseAdmin, {
        customerId,
        eventType: "post_layout_refund_request_denied",
        title: "Post-layout refund request recorded",
        message: `Order ${subscription.order_number || subscription.id}: full automatic refund was not issued because layout work has started.`,
        priority: "high",
        metadata: { refundCaseId: refundCase.id, requestedAmountOre: amountOre },
      }),
    ]);

    return NextResponse.json({ success: true, refundCaseId: refundCase.id });
  }

  if (action === "issue_partial_refund") {
    if (requestedAmountOre <= 0) {
      return NextResponse.json(
        { error: "Enter a partial refund amount greater than zero." },
        { status: 400 },
      );
    }

    let resolvedFirstPayment;
    try {
      resolvedFirstPayment = await resolveStripeFirstPayment({
        stripe,
        checkoutSessionId: subscription.stripe_checkout_session_id,
        storedPaymentIntentId: subscription.stripe_payment_intent_id,
        expectedAmountOre: fullFirstPaymentOre,
      });
    } catch (error) {
      return NextResponse.json(
        {
          error: `${error instanceof Error ? error.message : "The first payment could not be verified."} No refund was created.`,
        },
        { status: 409 },
      );
    }

    const refundableRemainingOre =
      resolvedFirstPayment.charge.amount - resolvedFirstPayment.charge.amount_refunded;
    if (requestedAmountOre >= refundableRemainingOre) {
      return NextResponse.json(
        {
          error:
            "A partial refund must be smaller than the remaining first payment. Use an approved full-refund exception process otherwise.",
        },
        { status: 409 },
      );
    }

    const refund = await stripe.refunds.create({
      payment_intent: resolvedFirstPayment.paymentIntentId,
      amount: requestedAmountOre,
      metadata: {
        customer_id: customerId,
        customer_subscription_id: subscription.id,
        order_number: subscription.order_number || "",
        reason: "approved_partial_refund_after_layout",
        admin_reason: reason,
      },
    });

    const recordedAt = new Date().toISOString();
    const { data: refundCase, error: caseError } = await supabaseAdmin
      .from("customer_refund_cases")
      .insert({
        customer_id: customerId,
        customer_subscription_id: subscription.id,
        order_number: subscription.order_number,
        request_type: "partial",
        requested_amount_ore: requestedAmountOre,
        approved_amount_ore: requestedAmountOre,
        currency: "sek",
        customer_reason: reason,
        admin_decision: "approved_partial",
        admin_reason: reason,
        status: "closed",
        stripe_payment_intent_id: resolvedFirstPayment.paymentIntentId,
        stripe_refund_id: refund.id,
        requested_at: recordedAt,
        decided_at: recordedAt,
        created_by: user.id,
      })
      .select("id")
      .single();

    if (caseError || !refundCase) {
      await createAdminNotification(supabaseAdmin, {
        customerId,
        eventType: "partial_refund_local_sync_failed",
        title: "Partial refund needs reconciliation",
        message: `Stripe refund ${refund.id} succeeded, but Screenia could not store the refund case.`,
        priority: "urgent",
        metadata: { refundId: refund.id, amountOre: refund.amount },
      });
      return NextResponse.json(
        { error: "Stripe refund succeeded, but the local refund case was not stored." },
        { status: 500 },
      );
    }

    await Promise.all([
      supabaseAdmin
        .from("customer_subscriptions")
        .update({ stripe_payment_intent_id: resolvedFirstPayment.paymentIntentId })
        .eq("id", subscription.id),
      recordAuditEvent(supabaseAdmin, {
        ...auditBase,
        eventType: "payment_partially_refunded",
        eventDescription:
          "Admin issued and recorded a partial first-payment refund without closing service access.",
        metadata: {
          refundCaseId: refundCase.id,
          orderNumber: subscription.order_number,
          refundId: refund.id,
          paymentIntentId: resolvedFirstPayment.paymentIntentId,
          amountOre: refund.amount,
          reason,
        },
      }),
      createAdminNotification(supabaseAdmin, {
        customerId,
        eventType: "payment_partially_refunded",
        title: "Partial refund completed",
        message: `A partial refund of ${(refund.amount / 100).toLocaleString("sv-SE")} kr was issued for order ${subscription.order_number || subscription.id}.`,
        priority: "high",
        metadata: { refundCaseId: refundCase.id, refundId: refund.id, amountOre: refund.amount },
      }),
    ]);

    return NextResponse.json({
      success: true,
      refundCaseId: refundCase.id,
      refundId: refund.id,
      amountOre: refund.amount,
    });
  }

  return NextResponse.json({ error: "Unsupported refund-case action." }, { status: 400 });
}
