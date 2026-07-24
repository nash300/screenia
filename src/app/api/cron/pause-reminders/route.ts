import { NextResponse } from "next/server";
import { createAdminNotification } from "@/lib/server/admin-notifications";
import { recordAuditEvent } from "@/lib/server/audit";
import { supabaseAdmin } from "@/lib/server/customer-account";
import {
  escapeHtml,
  renderBrandedEmail,
  sendTransactionalEmail,
} from "@/lib/server/email";

export const dynamic = "force-dynamic";

const reminderKind = "pause_resumes_14_days";
const reminderWindowDays = 14;

type PausedSubscriptionRow = {
  id: string;
  customer_id: string;
  order_number: string | null;
  stripe_subscription_id: string | null;
  pause_resumes_at: string | null;
  monthly_fee_sek: number | null;
  screen_quantity: number | null;
};

type CustomerRow = {
  id: string;
  name: string;
  email: string;
  billing_email: string | null;
};

function addDays(value: Date, days: number) {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
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

function authorizeCron(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();

  if (!cronSecret) {
    if (process.env.NODE_ENV === "production") {
      return false;
    }
    return true;
  }

  return request.headers.get("authorization") === `Bearer ${cronSecret}`;
}

export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const now = new Date();
  const windowEnd = addDays(now, reminderWindowDays);
  const { data: subscriptions, error: subscriptionError } = await supabaseAdmin
    .from("customer_subscriptions")
    .select(
      "id, customer_id, order_number, stripe_subscription_id, pause_resumes_at, monthly_fee_sek, screen_quantity",
    )
    .eq("status", "paused")
    .not("stripe_subscription_id", "is", null)
    .not("pause_resumes_at", "is", null)
    .gte("pause_resumes_at", now.toISOString())
    .lte("pause_resumes_at", windowEnd.toISOString())
    .order("pause_resumes_at", { ascending: true });

  if (subscriptionError) {
    console.error("Pause reminder subscription lookup error:", subscriptionError);
    return NextResponse.json(
      { error: "Could not load paused subscriptions." },
      { status: 500 },
    );
  }

  const rows = (subscriptions || []) as PausedSubscriptionRow[];
  const customerIds = Array.from(new Set(rows.map((row) => row.customer_id)));
  const { data: customers, error: customerError } =
    customerIds.length > 0
      ? await supabaseAdmin
          .from("customers")
          .select("id, name, email, billing_email")
          .in("id", customerIds)
      : { data: [], error: null };

  if (customerError) {
    console.error("Pause reminder customer lookup error:", customerError);
    return NextResponse.json(
      { error: "Could not load pause reminder customers." },
      { status: 500 },
    );
  }

  const customersById = new Map(
    ((customers || []) as CustomerRow[]).map((customer) => [customer.id, customer]),
  );
  const groups = new Map<string, PausedSubscriptionRow[]>();

  for (const row of rows) {
    if (!row.stripe_subscription_id || !row.pause_resumes_at) continue;
    const group = groups.get(row.stripe_subscription_id) || [];
    group.push(row);
    groups.set(row.stripe_subscription_id, group);
  }

  const results = {
    checked: rows.length,
    eligibleSubscriptions: groups.size,
    sent: 0,
    skipped: 0,
    failed: 0,
  };

  for (const [stripeSubscriptionId, group] of groups.entries()) {
    const first = group[0];
    const customer = customersById.get(first.customer_id);
    const pauseResumesAt = first.pause_resumes_at;

    if (!customer || !pauseResumesAt) {
      results.skipped += 1;
      continue;
    }

    const recipient = customer.billing_email || customer.email;
    const { data: dispatch, error: dispatchInsertError } = await supabaseAdmin
      .from("subscription_pause_reminder_dispatches")
      .insert({
        customer_id: customer.id,
        stripe_subscription_id: stripeSubscriptionId,
        reminder_kind: reminderKind,
        pause_resumes_at: pauseResumesAt,
        recipient_email: recipient,
      })
      .select("id")
      .single();

    if (dispatchInsertError?.code === "23505") {
      results.skipped += 1;
      continue;
    }

    if (dispatchInsertError || !dispatch) {
      console.error("Pause reminder dispatch claim error:", dispatchInsertError);
      results.failed += 1;
      await createAdminNotification(supabaseAdmin, {
        customerId: customer.id,
        eventType: "subscription_pause_reminder_dispatch_failed",
        title: "Pause reminder dispatch failed",
        message:
          "Screenia could not reserve the pause reminder email dispatch. Review this subscription manually.",
        priority: "urgent",
        metadata: {
          stripeSubscriptionId,
          pauseResumesAt,
          error: dispatchInsertError?.message || "No dispatch row returned.",
        },
      });
      continue;
    }

    const orderNumbers = group
      .map((row) => row.order_number)
      .filter(Boolean)
      .join(", ");
    const totalMonthlySek = group.reduce(
      (sum, row) => sum + (row.monthly_fee_sek || 0),
      0,
    );
    const totalScreens = group.reduce(
      (sum, row) => sum + Math.max(0, row.screen_quantity || 0),
      0,
    );

    const emailResult = await sendTransactionalEmail({
      to: recipient,
      subject: "Påminnelse: abonnemanget återaktiveras snart",
      text: [
        `Hej ${customer.name},`,
        "",
        `Det pausade Screenia-abonnemanget återaktiveras automatiskt ${formatDate(pauseResumesAt)} om ingen annan överenskommelse görs.`,
        "När pausen upphör öppnas skärmtjänsten igen och kommande abonnemangsdebiteringar fortsätter via Stripe enligt abonnemanget.",
        "",
        orderNumbers ? `Berörda beställningar: ${orderNumbers}` : "",
        `Skärmar: ${totalScreens || group.length}`,
        `Månadspris efter paus: ${formatSek(totalMonthlySek)}`,
        "",
        "Kontakta service@screenia.se före pausens slut om abonnemanget ska vara fortsatt pausat, ändras eller avslutas.",
      ]
        .filter(Boolean)
        .join("\n"),
      html: renderBrandedEmail({
        eyebrow: "Abonnemang",
        title: "Pausen avslutas snart",
        intro: `Det pausade Screenia-abonnemanget återaktiveras automatiskt ${formatDate(pauseResumesAt)} om ingen annan överenskommelse görs.`,
        showHelper: false,
        children: `
          <div style="border:1px solid #d8e7fb; border-radius:14px; background:#f7fbff; padding:16px 18px;">
            <p style="margin:0 0 8px;"><strong>Företag:</strong> ${escapeHtml(customer.name)}</p>
            ${
              orderNumbers
                ? `<p style="margin:0 0 8px;"><strong>Beställningar:</strong> ${escapeHtml(orderNumbers)}</p>`
                : ""
            }
            <p style="margin:0 0 8px;"><strong>Planerad återaktivering:</strong> ${escapeHtml(formatDate(pauseResumesAt))}</p>
            <p style="margin:0 0 8px;"><strong>Skärmar:</strong> ${totalScreens || group.length}</p>
            <p style="margin:0;"><strong>Månadspris efter paus:</strong> ${escapeHtml(formatSek(totalMonthlySek))}</p>
          </div>
          <p style="margin:18px 0 0;">När pausen upphör öppnas skärmtjänsten igen och kommande abonnemangsdebiteringar fortsätter via Stripe enligt abonnemanget.</p>
          <p style="margin:12px 0 0;">Kontakta <a href="mailto:service@screenia.se" style="color:#155ee8;">service@screenia.se</a> före pausens slut om abonnemanget ska vara fortsatt pausat, ändras eller avslutas.</p>
        `,
      }),
    });

    if (!emailResult.ok) {
      results.failed += 1;
      await supabaseAdmin
        .from("subscription_pause_reminder_dispatches")
        .update({
          status: "failed",
          last_error: emailResult.error,
        })
        .eq("id", dispatch.id);

      await createAdminNotification(supabaseAdmin, {
        customerId: customer.id,
        eventType: "subscription_pause_reminder_email_failed",
        title: "Pause reminder email failed",
        message: `The pause reminder email to ${recipient} failed.`,
        priority: "urgent",
        metadata: {
          stripeSubscriptionId,
          pauseResumesAt,
          recipient,
          error: emailResult.error,
        },
      });
      continue;
    }

    results.sent += 1;
    await supabaseAdmin
      .from("subscription_pause_reminder_dispatches")
      .update({
        status: "sent",
        resend_email_id: emailResult.id || null,
        sent_at: new Date().toISOString(),
        last_error: null,
      })
      .eq("id", dispatch.id);

    await Promise.all([
      recordAuditEvent(supabaseAdmin, {
        customerId: customer.id,
        actorType: "system",
        eventType: "subscription_pause_resume_reminder_sent",
        eventDescription:
          "Screenia sent an automatic reminder before a paused subscription resumes.",
        metadata: {
          stripeSubscriptionId,
          pauseResumesAt,
          recipient,
          resendEmailId: emailResult.id || null,
          reminderKind,
        },
      }),
      createAdminNotification(supabaseAdmin, {
        customerId: customer.id,
        eventType: "subscription_pause_resume_reminder_sent",
        title: "Pause resume reminder sent",
        message: `${customer.name} was reminded that the paused subscription resumes on ${formatDate(pauseResumesAt)}.`,
        priority: "normal",
        metadata: {
          stripeSubscriptionId,
          pauseResumesAt,
          recipient,
          resendEmailId: emailResult.id || null,
          reminderKind,
        },
      }),
    ]);
  }

  return NextResponse.json(results);
}
