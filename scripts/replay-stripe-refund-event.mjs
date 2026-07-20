import Stripe from "stripe";

const eventType = process.argv[2]?.trim();
const refundId = process.argv[3]?.trim();
const targetUrl = process.argv[4]?.trim() || "http://localhost:3000/api/stripe/webhook";

if (!eventType || !refundId) {
  throw new Error(
    "Usage: node scripts/replay-stripe-refund-event.mjs <event-type> <refund-id> [localhost-webhook-url]",
  );
}

if (!/^refund\.(created|updated)$/.test(eventType)) {
  throw new Error("Only refund.created and refund.updated test events are supported.");
}

if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//i.test(targetUrl)) {
  throw new Error("This replay utility only posts to localhost.");
}

const stripeSecretKey = process.env.STRIPE_SECRET_KEY?.trim();
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
if (!stripeSecretKey?.startsWith("sk_test_") || !webhookSecret) {
  throw new Error("Stripe test credentials and the local webhook signing secret are required.");
}

const stripe = new Stripe(stripeSecretKey, { apiVersion: "2026-04-22.dahlia" });
let sourceEvent = null;

for await (const event of stripe.events.list({ type: eventType, limit: 100 })) {
  if (event.data?.object?.id === refundId) {
    sourceEvent = event;
    break;
  }
}

if (!sourceEvent) {
  throw new Error(`No ${eventType} event was found for refund ${refundId}.`);
}

const replayEvent = {
  ...sourceEvent,
  id: `evt_screenia_local_refund_replay_${Date.now()}`,
  created: Math.floor(Date.now() / 1000),
};
const payload = JSON.stringify(replayEvent);
const signature = stripe.webhooks.generateTestHeaderString({
  payload,
  secret: webhookSecret,
});
const response = await fetch(targetUrl, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "stripe-signature": signature,
  },
  body: payload,
});
const responseBody = await response.text();
if (!response.ok) {
  throw new Error(`Local Stripe webhook returned ${response.status}: ${responseBody}`);
}

console.log(
  JSON.stringify(
    {
      sourceEventId: sourceEvent.id,
      replayEventId: replayEvent.id,
      eventType,
      refundId,
      response: JSON.parse(responseBody),
    },
    null,
    2,
  ),
);
