import { createAdminNotification } from "@/lib/server/admin-notifications";
import { supabaseAdmin } from "@/lib/server/admin-api";
import { recordAuditEvent } from "@/lib/server/audit";
export type CheckoutFailureContext = {
  customerId?: string;
  orderId?: string;
  orderNumber?: string;
  pricingPlanCode?: string;
  stripeCustomerId?: string;
  stripeCheckoutSessionId?: string;
};

export async function recordCheckoutLocalSyncFailure({
  customerId,
  orderId,
  orderNumber,
  pricingPlanCode,
  stripeCustomerId,
  stripeCheckoutSessionId,
  phase,
  error,
  ipAddress,
  userAgent,
}: CheckoutFailureContext & {
  phase: string;
  error: unknown;
  ipAddress: string | null;
  userAgent: string | null;
}) {
  const errorMessage =
    error instanceof Error ? error.message : "Unknown local sync error";
  const metadata = {
    customerId,
    orderId,
    orderNumber,
    pricingPlanCode,
    stripeCustomerId,
    stripeCheckoutSessionId,
    phase,
    error: errorMessage,
  };

  await recordAuditEvent(
    supabaseAdmin,
    {
      customerId,
      actorType: "system",
      eventType: "stripe_checkout_local_sync_failed",
      eventDescription:
        "Stripe checkout state was created but Screenia could not store the local billing reference.",
      metadata,
      ipAddress,
      userAgent,
    },
    { throwOnError: true },
  );

  await createAdminNotification(
    supabaseAdmin,
    {
      customerId,
      eventType: "stripe_checkout_local_sync_failed",
      title: "Stripe checkout local sync failed",
      message: `Stripe checkout state exists for order ${
        orderNumber || "unknown"
      }, but Screenia could not store the local ${phase} reference: ${errorMessage}`,
      priority: "urgent",
      metadata,
    },
    { throwOnError: true },
  );
}
