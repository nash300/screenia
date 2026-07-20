import { createClient } from "@supabase/supabase-js";
import { Webhook } from "svix";

const invoiceId = process.argv[2]?.trim();
const targetUrl = process.argv[3]?.trim() || "http://localhost:3000/api/resend/webhook";

if (!invoiceId) {
  throw new Error("Usage: node scripts/replay-resend-delivery.mjs <stripe-invoice-id> [localhost-webhook-url]");
}

if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//i.test(targetUrl)) {
  throw new Error("This replay utility only posts to localhost.");
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const webhookSecret = process.env.RESEND_WEBHOOK_SECRET?.trim();
const stripeSecretKey = process.env.STRIPE_SECRET_KEY?.trim();

if (!supabaseUrl || !serviceRoleKey || !webhookSecret) {
  throw new Error("Supabase service credentials and RESEND_WEBHOOK_SECRET are required.");
}

if (!stripeSecretKey?.startsWith("sk_test_")) {
  throw new Error("Refusing to replay delivery evidence outside Stripe test mode.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: dispatch, error: dispatchError } = await supabase
  .from("billing_email_dispatches")
  .select("stripe_invoice_id, resend_email_id, recipient_email, status")
  .eq("stripe_invoice_id", invoiceId)
  .single();

if (dispatchError || !dispatch?.resend_email_id) {
  throw dispatchError || new Error("The invoice dispatch has no Resend email id.");
}

const { data: deliveryEvent, error: deliveryError } = await supabase
  .from("resend_delivery_events")
  .select("raw_payload")
  .eq("resend_email_id", dispatch.resend_email_id)
  .eq("event_type", "email.delivered")
  .order("processed_at", { ascending: false })
  .limit(1)
  .maybeSingle();

if (deliveryError || !deliveryEvent?.raw_payload) {
  throw deliveryError || new Error("No stored Resend delivery payload exists for this invoice.");
}

const payload = JSON.stringify(deliveryEvent.raw_payload);
const messageId = `msg_screenia_local_replay_${Date.now()}`;
const timestamp = new Date();
const signature = new Webhook(webhookSecret).sign(messageId, timestamp, payload);
const response = await fetch(targetUrl, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "svix-id": messageId,
    "svix-timestamp": String(Math.floor(timestamp.getTime() / 1000)),
    "svix-signature": signature,
  },
  body: payload,
});

const responseBody = await response.text();
if (!response.ok) {
  throw new Error(`Local Resend webhook returned ${response.status}: ${responseBody}`);
}

const { data: updated, error: updatedError } = await supabase
  .from("billing_email_dispatches")
  .select("stripe_invoice_id, status, attempt_count, sent_at, delivered_at")
  .eq("stripe_invoice_id", invoiceId)
  .single();

if (updatedError) throw updatedError;
if (updated.status !== "delivered" || !updated.delivered_at) {
  throw new Error(`Expected delivered dispatch state, received ${updated.status}.`);
}

console.log(JSON.stringify({ response: JSON.parse(responseBody), dispatch: updated }, null, 2));

