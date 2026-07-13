import { NextResponse } from "next/server";
import { getRequestIp, recordAuditEvent } from "@/lib/server/audit";
import { createAdminNotification } from "@/lib/server/admin-notifications";
import {
  customerAccessDeniedResponse,
  getAuthenticatedUser,
  getCustomerForUser,
  hasCustomerServiceAccess,
  supabaseAdmin,
} from "@/lib/server/customer-account";

const validDecisions = new Set(["approved", "changes_requested"]);

async function rollbackPreviewDecision({
  customerId,
  decisionId,
  previousPreviewStatus,
  previousPreviewFeedback,
  subscriptionId,
  previousFulfillmentStatus,
}: {
  customerId: string;
  decisionId?: string | null;
  previousPreviewStatus?: unknown;
  previousPreviewFeedback?: unknown;
  subscriptionId?: string | null;
  previousFulfillmentStatus?: string | null;
}) {
  await Promise.allSettled([
    decisionId
      ? supabaseAdmin.from("customer_preview_decisions").delete().eq("id", decisionId)
      : Promise.resolve(),
    supabaseAdmin
      .from("customers")
      .update({
        preview_status:
          typeof previousPreviewStatus === "string"
            ? previousPreviewStatus
            : null,
        preview_feedback:
          typeof previousPreviewFeedback === "string"
            ? previousPreviewFeedback
            : null,
      })
      .eq("id", customerId),
    subscriptionId
      ? supabaseAdmin
          .from("customer_subscriptions")
          .update({
            fulfillment_status: previousFulfillmentStatus || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", subscriptionId)
      : Promise.resolve(),
  ]);
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser();
  const customer = await getCustomerForUser(user);

  if (!user || !customer) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (!hasCustomerServiceAccess(customer)) {
    return NextResponse.json(customerAccessDeniedResponse(), { status: 403 });
  }

  const body = await request.json();
  const decision = String(body.decision || "").trim();
  const feedback = String(body.feedback || "").trim();
  const previewUrl = String(
    ("preview_url" in customer ? customer.preview_url : "") || "",
  ).trim();
  const ipAddress = getRequestIp(request);
  const userAgent = request.headers.get("user-agent");

  if (!validDecisions.has(decision)) {
    return NextResponse.json({ error: "Invalid preview decision." }, { status: 400 });
  }

  if (!previewUrl) {
    return NextResponse.json(
      { error: "There is no preview available for this account yet." },
      { status: 400 },
    );
  }

  if (decision === "changes_requested" && feedback.length < 5) {
    return NextResponse.json(
      { error: "Please describe the change you want Screenia to make." },
      { status: 400 },
    );
  }

  const { data: subscription, error: subscriptionLookupError } = await supabaseAdmin
    .from("customer_subscriptions")
    .select("id, order_number, fulfillment_status")
    .eq("customer_id", customer.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (subscriptionLookupError) {
    console.error("Preview decision subscription lookup error:", subscriptionLookupError);
    return NextResponse.json(
      { error: "Could not check the preview fulfillment status." },
      { status: 500 },
    );
  }

  const { data: previewDecision, error: decisionError } = await supabaseAdmin
    .from("customer_preview_decisions")
    .insert({
      customer_id: customer.id,
      subscription_id: subscription?.id || null,
      preview_url: previewUrl,
      decision,
      feedback: feedback || null,
      ip_address: ipAddress,
      user_agent: userAgent,
    })
    .select("id")
    .single();

  if (decisionError || !previewDecision) {
    console.error("Preview decision insert error:", decisionError);
    return NextResponse.json(
      { error: "Could not save your preview response." },
      { status: 500 },
    );
  }

  const nextPreviewStatus =
    decision === "approved" ? "approved" : "changes_requested";
  const nextFulfillmentStatus =
    decision === "approved" ? "preview_approved" : "content_pending";

  const { error: customerError } = await supabaseAdmin
    .from("customers")
    .update({
      preview_status: nextPreviewStatus,
      preview_feedback: feedback || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", customer.id);

  if (customerError) {
    console.error("Preview decision customer update error:", customerError);
    await rollbackPreviewDecision({
      customerId: customer.id,
      decisionId: previewDecision.id,
      previousPreviewStatus:
        (customer as Record<string, unknown>).preview_status,
      previousPreviewFeedback:
        (customer as Record<string, unknown>).preview_feedback,
    });

    return NextResponse.json(
      { error: "Could not update the preview status." },
      { status: 500 },
    );
  }

  if (subscription?.id) {
    const { error: subscriptionError } = await supabaseAdmin
      .from("customer_subscriptions")
      .update({
        fulfillment_status: nextFulfillmentStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", subscription.id);

    if (subscriptionError) {
      console.error("Preview decision fulfillment update error:", subscriptionError);
      await rollbackPreviewDecision({
        customerId: customer.id,
        decisionId: previewDecision.id,
        previousPreviewStatus:
          (customer as Record<string, unknown>).preview_status,
        previousPreviewFeedback:
          (customer as Record<string, unknown>).preview_feedback,
        subscriptionId: subscription.id,
        previousFulfillmentStatus: subscription.fulfillment_status,
      });
      try {
        await createAdminNotification(
          supabaseAdmin,
          {
            customerId: customer.id,
            eventType: "customer_preview_decision_sync_failed",
            title: "Preview decision sync failed",
            message:
              "A customer preview decision could not be saved because fulfillment status did not sync. The local decision was rolled back.",
            priority: "urgent",
            metadata: {
              decision,
              feedback: feedback || null,
              subscriptionId: subscription.id,
              orderNumber: subscription.order_number || null,
              error: subscriptionError.message,
            },
          },
          { throwOnError: true },
        );
      } catch (notificationError) {
        console.error(
          "Preview decision sync failure notification error:",
          notificationError,
        );
        return NextResponse.json(
          {
            error:
              "Preview response was not saved and Screenia could not create an internal admin alert. Contact support.",
          },
          { status: 500 },
        );
      }

      return NextResponse.json(
        { error: "Could not update the preview fulfillment status." },
        { status: 500 },
      );
    }
  }

  const eventType =
    decision === "approved"
      ? "customer_preview_approved"
      : "customer_preview_changes_requested";

  try {
    await recordAuditEvent(
      supabaseAdmin,
      {
        customerId: customer.id,
        actorType: "customer",
        actorId: user.id,
        eventType,
        eventDescription:
          decision === "approved"
            ? "Customer approved the first screen preview."
            : "Customer requested changes to the first screen preview.",
        metadata: {
          decision,
          feedback: feedback || null,
          previewUrl,
          subscriptionId: subscription?.id || null,
          orderNumber: subscription?.order_number || null,
        },
        ipAddress,
        userAgent,
      },
      { throwOnError: true },
    );
  } catch (auditError) {
    const message =
      auditError instanceof Error ? auditError.message : "Unknown audit storage error";
    await rollbackPreviewDecision({
      customerId: customer.id,
      decisionId: previewDecision.id,
      previousPreviewStatus: (customer as Record<string, unknown>).preview_status,
      previousPreviewFeedback:
        (customer as Record<string, unknown>).preview_feedback,
      subscriptionId: subscription?.id || null,
      previousFulfillmentStatus: subscription?.fulfillment_status || null,
    });
    try {
      await createAdminNotification(
        supabaseAdmin,
        {
          customerId: customer.id,
          eventType: "customer_preview_decision_audit_failed",
          title: "Preview decision audit failed",
          message:
            "A customer preview decision was rolled back because the audit event could not be stored.",
          priority: "urgent",
          metadata: {
            decision,
            feedback: feedback || null,
            subscriptionId: subscription?.id || null,
            orderNumber: subscription?.order_number || null,
            error: message,
          },
        },
        { throwOnError: true },
      );
    } catch (notificationError) {
      console.error(
        "Preview decision audit failure notification error:",
        notificationError,
      );
      return NextResponse.json(
        {
          error:
            "Preview response was not saved and Screenia could not create an internal admin alert. Contact support.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        error:
          "Preview response was not saved because Screenia could not store the required audit evidence.",
      },
      { status: 500 },
    );
  }

  try {
    await createAdminNotification(
      supabaseAdmin,
      {
        customerId: customer.id,
        eventType,
        title:
          decision === "approved"
            ? "Preview approved"
            : "Preview changes requested",
        message:
          decision === "approved"
            ? `${customer.name || customer.email} approved the first screen preview.`
            : `${customer.name || customer.email} requested changes to the first screen preview.`,
        priority: decision === "approved" ? "normal" : "high",
        metadata: {
          decision,
          feedback: feedback || null,
          subscriptionId: subscription?.id || null,
          orderNumber: subscription?.order_number || null,
        },
      },
      { throwOnError: true },
    );
  } catch (notificationError) {
    const message =
      notificationError instanceof Error
        ? notificationError.message
        : "Unknown admin notification storage error";
    console.error("Preview decision admin notification error:", notificationError);
    await rollbackPreviewDecision({
      customerId: customer.id,
      decisionId: previewDecision.id,
      previousPreviewStatus: (customer as Record<string, unknown>).preview_status,
      previousPreviewFeedback:
        (customer as Record<string, unknown>).preview_feedback,
      subscriptionId: subscription?.id || null,
      previousFulfillmentStatus: subscription?.fulfillment_status || null,
    });

    try {
      await recordAuditEvent(
        supabaseAdmin,
        {
          customerId: customer.id,
          actorType: "customer",
          actorId: user.id,
          eventType: "customer_preview_decision_notification_failed",
          eventDescription:
            "Customer preview decision was rolled back because admin notification evidence could not be stored.",
          metadata: {
            decision,
            feedback: feedback || null,
            previewUrl,
            subscriptionId: subscription?.id || null,
            orderNumber: subscription?.order_number || null,
            error: message,
          },
          ipAddress,
          userAgent,
        },
        { throwOnError: true },
      );
    } catch (auditError) {
      console.error(
        "Preview decision notification failure audit error:",
        auditError,
      );
      return NextResponse.json(
        {
          error:
            "Preview response was not saved and Screenia could not store internal failure evidence. Contact support.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        error:
          "Preview response was not saved because Screenia could not create the admin review notification.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, previewStatus: nextPreviewStatus });
}
