import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { getRequestIp, recordAuditEvent } from "@/lib/server/audit";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const createAuthenticatedClient = async () => {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (items) => {
          items.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    },
  );
};

function isMissingProductionColumns(error: { code?: string; message?: string }) {
  return (
    error.code === "42703" ||
    error.code === "PGRST204" ||
    error.message?.includes("production_status") ||
    error.message?.includes("layout_started_at") ||
    error.message?.includes("setup_fee_locked_at")
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ customerId: string }> },
) {
  const supabase = await createAuthenticatedClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user?.app_metadata.role !== "admin") {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  if (body.action !== "start_layout") {
    return NextResponse.json({ error: "Unsupported production action." }, { status: 400 });
  }

  const { customerId } = await params;
  const timestamp = new Date().toISOString();

  const { data: customer, error: customerError } = await supabaseAdmin
    .from("customers")
    .select("id, name, status, payment_status, production_status, layout_started_at")
    .eq("id", customerId)
    .single();

  if (customerError || !customer) {
    if (customerError && isMissingProductionColumns(customerError)) {
      return NextResponse.json(
        {
          error:
            "Production tracking columns are missing. Apply the latest Supabase migration first.",
        },
        { status: 409 },
      );
    }

    return NextResponse.json({ error: "Customer was not found." }, { status: 404 });
  }

  if (customer.layout_started_at) {
    return NextResponse.json({
      success: true,
      alreadyStarted: true,
      layoutStartedAt: customer.layout_started_at,
    });
  }

  if (customer.payment_status !== "paid") {
    return NextResponse.json(
      { error: "Layout work can only be started after payment is marked paid." },
      { status: 400 },
    );
  }

  const { error: updateError } = await supabaseAdmin
    .from("customers")
    .update({
      production_status: "layout_started",
      layout_started_at: timestamp,
      setup_fee_locked_at: timestamp,
    })
    .eq("id", customer.id);

  if (updateError) {
    if (isMissingProductionColumns(updateError)) {
      return NextResponse.json(
        {
          error:
            "Production tracking columns are missing. Apply the latest Supabase migration first.",
        },
        { status: 409 },
      );
    }

    console.error("Start layout production update error:", updateError);
    return NextResponse.json({ error: "Could not start layout work." }, { status: 500 });
  }

  const subscriptionResult = await supabaseAdmin
    .from("customer_subscriptions")
    .update({ fulfillment_status: "layout_started" })
    .eq("customer_id", customer.id)
    .in("status", ["paid", "active", "checkout_started"]);

  if (subscriptionResult.error && subscriptionResult.error.code !== "42703") {
    console.warn("Could not update subscription fulfillment status.", subscriptionResult.error);
  }

  await recordAuditEvent(supabaseAdmin, {
    customerId: customer.id,
    actorType: "admin",
    actorId: user.id,
    eventType: "layout_work_started",
    eventDescription:
      "Admin marked layout work as started. Setup fee is now non-refundable.",
    metadata: {
      customerName: customer.name,
      previousProductionStatus: customer.production_status,
      setupFeeLockedAt: timestamp,
    },
    ipAddress: getRequestIp(request),
    userAgent: request.headers.get("user-agent"),
  });

  return NextResponse.json({
    success: true,
    layoutStartedAt: timestamp,
    setupFeeLockedAt: timestamp,
  });
}
