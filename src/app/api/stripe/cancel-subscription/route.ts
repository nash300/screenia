import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { getRequestIp, recordAuditEvent } from "@/lib/server/audit";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-04-22.dahlia",
});

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function getAuthenticatedUser(request: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: () => {},
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);

    if (user?.app_metadata?.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { customerId, subscriptionId } = await request.json();

    if (!customerId || !subscriptionId) {
      return NextResponse.json(
        { error: "Missing customerId or subscriptionId" },
        { status: 400 },
      );
    }

    const { error } = await supabaseAdmin
      .from("customers")
      .update({
        status: "suspended",
        payment_status: "cancelled",
        inactive_reason: "subscription_cancelled",
        cancelled_at: new Date().toISOString(),
        cancellation_source: "admin",
      })
      .eq("id", customerId);

    if (error) {
      console.error("Supabase cancel update error:", error);
      return NextResponse.json(
        { error: "Subscription cancelled, but database update failed" },
        { status: 500 },
      );
    }

    try {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);

      if (subscription.status !== "canceled") {
        await stripe.subscriptions.cancel(subscriptionId);
      }
    } catch (err: unknown) {
      // If Stripe says it doesn't exist, we still continue
      if (
        typeof err === "object" &&
        err !== null &&
        "code" in err &&
        err.code === "resource_missing"
      ) {
        console.warn("Subscription not found in Stripe, continuing anyway");
      } else {
        throw err;
      }
    }

    const { error: subscriptionUpdateError } = await supabaseAdmin
      .from("customer_subscriptions")
      .update({
        status: "cancelled",
        fulfillment_status: "cancelled",
      })
      .eq("stripe_subscription_id", subscriptionId);

    if (subscriptionUpdateError) {
      console.error(
        "Supabase subscription cancel update error:",
        subscriptionUpdateError,
      );
    }

    await recordAuditEvent(supabaseAdmin, {
      customerId,
      actorType: "admin",
      actorId: user.id,
      eventType: "subscription_cancelled",
      eventDescription: "Admin cancelled the Stripe subscription.",
      metadata: {
        stripeSubscriptionId: subscriptionId,
      },
      ipAddress: getRequestIp(request),
      userAgent: request.headers.get("user-agent"),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Cancel subscription error:", error);

    return NextResponse.json(
      { error: "Could not cancel subscription" },
      { status: 500 },
    );
  }
}
