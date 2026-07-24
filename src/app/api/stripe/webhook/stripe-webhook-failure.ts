import { createAdminNotification } from "@/lib/server/admin-notifications";
import { recordAuditEvent } from "@/lib/server/audit";
import { supabaseAdmin } from "./stripe-webhook-clients";

export async function recordStripeWebhookFailureVisibility({
  eventType,
  title,
  message,
  metadata,
  customerIds = [],
}: {
  eventType: string;
  title: string;
  message: string;
  metadata: Record<string, unknown>;
  customerIds?: string[];
}): Promise<never> {
  try {
    const auditTargets = customerIds.length ? customerIds : [null];

    await Promise.all(
      auditTargets.map((customerId) =>
        recordAuditEvent(
          supabaseAdmin,
          {
            customerId,
            actorType: "stripe",
            eventType,
            eventDescription: message,
            metadata,
          },
          { throwOnError: true },
        ),
      ),
    );

    await createAdminNotification(
      supabaseAdmin,
      {
        customerId: customerIds[0] || null,
        eventType,
        title,
        message,
        priority: "urgent",
        metadata,
      },
      { throwOnError: true },
    );
  } catch (visibilityError) {
    console.error("Stripe webhook failure visibility error:", visibilityError);
    throw new Error(
      "Stripe webhook failed and urgent visibility could not be stored.",
    );
  }

  throw new Error(message);
}
