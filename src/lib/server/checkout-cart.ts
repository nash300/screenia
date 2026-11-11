import { createHash, randomBytes } from "node:crypto";
import { supabaseAdmin } from "@/lib/server/admin-api";
import {
  calculateCartQuote,
  normalizeCartItems,
  type CartItemInput,
} from "@/lib/pricing/cart";

function hashCartToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function createCartToken() {
  return randomBytes(32).toString("base64url");
}

export async function createCheckoutCart(items: unknown) {
  const normalizedItems = normalizeCartItems(items);
  const quote = calculateCartQuote(normalizedItems);
  const token = createCartToken();
  const { data, error } = await supabaseAdmin
    .from("checkout_carts")
    .insert({
      token_hash: hashCartToken(token),
      items: normalizedItems,
      quote_snapshot: quote,
    })
    .select("id, expires_at")
    .single();

  if (error || !data) throw error || new Error("Checkout cart could not be created.");
  return { id: data.id, token, expiresAt: data.expires_at, quote };
}

export async function updateCheckoutCart(token: string, items: unknown) {
  const normalizedItems = normalizeCartItems(items);
  const quote = calculateCartQuote(normalizedItems);
  const { data, error } = await supabaseAdmin
    .from("checkout_carts")
    .update({ items: normalizedItems, quote_snapshot: quote, updated_at: new Date().toISOString() })
    .eq("token_hash", hashCartToken(token))
    .gt("expires_at", new Date().toISOString())
    .select("id, expires_at")
    .maybeSingle();

  if (error || !data) throw error || new Error("Checkout cart was not found or has expired.");
  return { id: data.id, token, expiresAt: data.expires_at, quote };
}

export async function getCheckoutCart(token: string) {
  const { data, error } = await supabaseAdmin
    .from("checkout_carts")
    .select("id, items, quote_snapshot, expires_at")
    .eq("token_hash", hashCartToken(token))
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (error || !data) return null;

  // Always recalculate from the current server pricing rather than trusting
  // the snapshot returned by the browser.
  const quote = calculateCartQuote(data.items as CartItemInput[]);
  return { ...data, quote };
}

export function isValidCartToken(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{40,64}$/.test(value);
}
