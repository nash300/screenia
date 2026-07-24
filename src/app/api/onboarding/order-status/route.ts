import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const payableStatuses = ["quote_prepared", "quote_sent", "checkout_started"];

function isMissingOrExpiredToken(expiresAt: string | null | undefined) {
  if (!expiresAt) return true;
  return new Date(expiresAt) < new Date();
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = String(searchParams.get("token") || "").trim();

  if (!token) {
    return NextResponse.json({ error: "Startlank saknas." }, { status: 400 });
  }

  const { data: customer, error: customerError } = await supabaseAdmin
    .from("customers")
    .select("id, onboarding_token_expires_at")
    .eq("onboarding_token", token)
    .single();

  if (customerError || !customer) {
    return NextResponse.json({ error: "Ogiltig startlank." }, { status: 404 });
  }

  if (isMissingOrExpiredToken(customer.onboarding_token_expires_at)) {
    return NextResponse.json(
      { error: "Startlanken har gatt ut." },
      { status: 410 },
    );
  }

  const { data: order, error: orderError } = await supabaseAdmin
    .from("customer_subscriptions")
    .select("id, status, stripe_payment_status")
    .eq("customer_id", customer.id)
    .in("status", payableStatuses)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (orderError) {
    console.error("Onboarding order status lookup error:", orderError);
    return NextResponse.json(
      { error: "Orderstatus kunde inte hamtas." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    hasPayableOrder:
      Boolean(order) && !["paid", "complete"].includes(order?.stripe_payment_status || ""),
    orderStatus: order?.status || null,
  });
}
