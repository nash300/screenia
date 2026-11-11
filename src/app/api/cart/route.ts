import { NextResponse } from "next/server";
import { getRequestIp } from "@/lib/server/audit";
import { checkPersistentRateLimit } from "@/lib/server/persistent-rate-limit";
import { rateLimitHeaders } from "@/lib/server/rate-limit";
import {
  createCheckoutCart,
  getCheckoutCart,
  isValidCartToken,
  updateCheckoutCart,
} from "@/lib/server/checkout-cart";
import { supabaseAdmin } from "@/lib/server/admin-api";

async function rateLimit(request: Request) {
  return checkPersistentRateLimit(supabaseAdmin, {
    key: `public-cart:${getRequestIp(request) || "unknown"}`,
    limit: 60,
    windowMs: 15 * 60 * 1000,
  });
}

export async function POST(request: Request) {
  const limit = await rateLimit(request);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "För många försök. Försök igen senare." },
      { status: 429, headers: rateLimitHeaders(limit) },
    );
  }

  try {
    const body = await request.json();
    const cart = await createCheckoutCart(body.items);
    return NextResponse.json(cart, { headers: rateLimitHeaders(limit) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ogiltig varukorg." },
      { status: 400, headers: rateLimitHeaders(limit) },
    );
  }
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!isValidCartToken(token)) {
    return NextResponse.json({ error: "Varukorg saknas." }, { status: 400 });
  }

  const cart = await getCheckoutCart(token);
  if (!cart) return NextResponse.json({ error: "Varukorgen har gått ut." }, { status: 404 });
  return NextResponse.json(cart);
}

export async function PATCH(request: Request) {
  const limit = await rateLimit(request);
  const body = await request.json().catch(() => ({}));
  const token = body.token;
  if (!isValidCartToken(token)) {
    return NextResponse.json({ error: "Varukorg saknas." }, { status: 400 });
  }

  try {
    const cart = await updateCheckoutCart(token, body.items);
    return NextResponse.json(cart, { headers: rateLimitHeaders(limit) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Varukorgen kunde inte uppdateras." },
      { status: 400, headers: rateLimitHeaders(limit) },
    );
  }
}
