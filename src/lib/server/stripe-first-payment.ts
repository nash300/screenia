import Stripe from "stripe";

export async function resolveStripeFirstPayment({
  stripe,
  checkoutSessionId,
  storedPaymentIntentId,
  expectedAmountOre,
}: {
  stripe: Stripe;
  checkoutSessionId: string | null;
  storedPaymentIntentId: string | null;
  expectedAmountOre: number;
}) {
  let paymentIntentId = storedPaymentIntentId;

  if (!paymentIntentId && checkoutSessionId) {
    const checkoutSession = await stripe.checkout.sessions.retrieve(checkoutSessionId);
    paymentIntentId =
      typeof checkoutSession.payment_intent === "string"
        ? checkoutSession.payment_intent
        : checkoutSession.payment_intent?.id || null;

    if (!paymentIntentId && checkoutSession.invoice) {
      const invoiceId =
        typeof checkoutSession.invoice === "string"
          ? checkoutSession.invoice
          : checkoutSession.invoice.id;
      const invoicePayments = await stripe.invoicePayments.list({
        invoice: invoiceId,
        status: "paid",
        limit: 10,
      });
      const matchingPayment = invoicePayments.data.find(
        (payment) =>
          payment.payment.type === "payment_intent" &&
          payment.amount_paid === expectedAmountOre &&
          payment.currency.toLowerCase() === "sek",
      );
      const invoicePaymentIntent = matchingPayment?.payment.payment_intent;
      paymentIntentId =
        typeof invoicePaymentIntent === "string"
          ? invoicePaymentIntent
          : invoicePaymentIntent?.id || null;
    }
  }

  if (!paymentIntentId) {
    throw new Error("The original first-payment reference could not be verified.");
  }

  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
    expand: ["latest_charge"],
  });

  if (
    expectedAmountOre <= 0 ||
    paymentIntent.amount_received !== expectedAmountOre ||
    paymentIntent.currency.toLowerCase() !== "sek"
  ) {
    throw new Error(
      "The original Stripe payment does not match the stored first-payment total.",
    );
  }

  const charge =
    typeof paymentIntent.latest_charge === "object"
      ? paymentIntent.latest_charge
      : null;

  if (!charge) {
    throw new Error("The original first-payment charge could not be verified.");
  }

  return { paymentIntentId, paymentIntent, charge };
}
