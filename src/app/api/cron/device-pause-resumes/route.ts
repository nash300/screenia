import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createAdminNotification } from "@/lib/server/admin-notifications";
import { recordAuditEvent } from "@/lib/server/audit";
import { supabaseAdmin } from "@/lib/server/customer-account";
import {
  escapeHtml,
  renderBrandedEmail,
  sendTransactionalEmail,
} from "@/lib/server/email";

export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-04-22.dahlia",
});

type DevicePauseRow = {
  id: string;
  customer_id: string;
  customer_subscription_id: string;
  device_id: string;
  stripe_subscription_id: string;
  stripe_subscription_item_id: string;
  pricing_plan_code: string | null;
  monthly_fee_sek: number | null;
  pause_resumes_at: string;
  original_subscription_item_quantity: number;
  adjusted_subscription_item_quantity: number;
  devices?: {
    device_code: string | null;
    name: string | null;
  } | null;
  customers?: {
    name: string | null;
    email: string | null;
    billing_email: string | null;
  } | null;
};

function firstRelation<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] || null : value || null;
}

function authorizeCron(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();

  if (!cronSecret) return process.env.NODE_ENV !== "production";

  return request.headers.get("authorization") === `Bearer ${cronSecret}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("sv-SE", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(value));
}

function formatSek(value: number | null | undefined) {
  return `${(value ?? 0).toLocaleString("sv-SE")} kr`;
}

export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("subscription_device_pauses")
    .select(
      "id, customer_id, customer_subscription_id, device_id, stripe_subscription_id, stripe_subscription_item_id, pricing_plan_code, monthly_fee_sek, pause_resumes_at, original_subscription_item_quantity, adjusted_subscription_item_quantity, devices(device_code, name), customers(name, email, billing_email)",
    )
    .eq("status", "active")
    .lte("pause_resumes_at", now)
    .order("pause_resumes_at", { ascending: true })
    .limit(50);

  if (error) {
    console.error("Device pause resume lookup error:", error);
    return NextResponse.json(
      { error: "Could not load due device pauses." },
      { status: 500 },
    );
  }

  const rows = ((data || []) as unknown as DevicePauseRow[]).map((row) => ({
    ...row,
    devices: firstRelation(row.devices),
    customers: firstRelation(row.customers),
  }));
  const results = {
    checked: rows.length,
    resumed: 0,
    failed: 0,
  };

  for (const row of rows) {
    const customer = row.customers;
    const device = row.devices;
    const deviceLabel = device?.name || device?.device_code || row.device_id;

    try {
      const stripeItem = await stripe.subscriptionItems.retrieve(
        row.stripe_subscription_item_id,
      );
      const currentQuantity = stripeItem.quantity || 0;
      const restoredQuantity = Math.max(
        row.original_subscription_item_quantity,
        currentQuantity + 1,
      );

      await stripe.subscriptionItems.update(row.stripe_subscription_item_id, {
        quantity: restoredQuantity,
        proration_behavior: "none",
      });

      const resumedAt = new Date().toISOString();
      const { error: updateError } = await supabaseAdmin
        .from("subscription_device_pauses")
        .update({
          status: "resumed",
          resumed_at: resumedAt,
          resume_error: null,
        })
        .eq("id", row.id);

      if (updateError) throw updateError;

      await supabaseAdmin
        .from("devices")
        .update({ is_active: true, inventory_status: "assigned" })
        .eq("id", row.device_id);

      const recipient = customer?.billing_email || customer?.email;
      const emailResult = recipient
        ? await sendTransactionalEmail({
            to: recipient,
            subject: "Bekräftelse: skärmen är återaktiverad",
            text: [
              `Hej ${customer?.name || "kund"},`,
              "",
              `Skärmen ${deviceLabel} är återaktiverad efter paus.`,
              `Den ingår igen i kommande abonnemangsdebiteringar från ${formatDate(resumedAt)}.`,
              "",
              `Månadsbelopp som återaktiveras: ${formatSek(row.monthly_fee_sek)}`,
              "Övriga villkor och abonnemangsdelar påverkas inte av återaktiveringen.",
            ].join("\n"),
            html: renderBrandedEmail({
              eyebrow: "Abonnemang",
              title: "Skärmen är återaktiverad",
              intro: `Skärmen ${escapeHtml(
                deviceLabel,
              )} är återaktiverad efter paus.`,
              showHelper: false,
              children: `
                <div style="border:1px solid #d8e7fb; border-radius:14px; background:#f7fbff; padding:16px 18px;">
                  <p style="margin:0 0 8px;"><strong>Skärm:</strong> ${escapeHtml(deviceLabel)}</p>
                  <p style="margin:0 0 8px;"><strong>Återaktiverad:</strong> ${formatDate(resumedAt)}</p>
                  <p style="margin:0;"><strong>Månadsbelopp som återaktiveras:</strong> ${formatSek(row.monthly_fee_sek)}</p>
                </div>
                <p style="margin:18px 0 0;">Övriga villkor och abonnemangsdelar påverkas inte av återaktiveringen.</p>
              `,
            }),
          })
        : { ok: false as const, configured: true as const, status: 0, error: "Missing recipient." };

      await Promise.all([
        recordAuditEvent(supabaseAdmin, {
          customerId: row.customer_id,
          actorType: "system",
          eventType: "customer_device_subscription_resumed",
          eventDescription:
            "Screenia automatically resumed billing for one paused display device.",
          metadata: {
            devicePauseId: row.id,
            deviceId: row.device_id,
            stripeSubscriptionId: row.stripe_subscription_id,
            stripeSubscriptionItemId: row.stripe_subscription_item_id,
            previousQuantity: currentQuantity,
            restoredQuantity,
            resendEmailId: emailResult.ok ? emailResult.id || null : null,
            emailWarning: emailResult.ok ? null : emailResult.error,
          },
        }),
        createAdminNotification(supabaseAdmin, {
          customerId: row.customer_id,
          eventType: "customer_device_subscription_resumed",
          title: "Device pause ended",
          message: `${deviceLabel} was automatically returned to the subscription quantity.`,
          priority: "normal",
          metadata: {
            devicePauseId: row.id,
            deviceId: row.device_id,
            stripeSubscriptionId: row.stripe_subscription_id,
            stripeSubscriptionItemId: row.stripe_subscription_item_id,
            restoredQuantity,
            resendEmailId: emailResult.ok ? emailResult.id || null : null,
          },
        }),
      ]);

      results.resumed += 1;
    } catch (resumeError) {
      const message =
        resumeError instanceof Error ? resumeError.message : String(resumeError);

      results.failed += 1;
      await supabaseAdmin
        .from("subscription_device_pauses")
        .update({ status: "failed", resume_error: message })
        .eq("id", row.id);

      await createAdminNotification(supabaseAdmin, {
        customerId: row.customer_id,
        eventType: "customer_device_subscription_resume_failed",
        title: "Device pause resume failed",
        message: `${deviceLabel} could not be returned to billing automatically. Review Stripe before the next invoice.`,
        priority: "urgent",
        metadata: {
          devicePauseId: row.id,
          deviceId: row.device_id,
          stripeSubscriptionId: row.stripe_subscription_id,
          stripeSubscriptionItemId: row.stripe_subscription_item_id,
          error: message,
        },
      });
    }
  }

  return NextResponse.json(results);
}
