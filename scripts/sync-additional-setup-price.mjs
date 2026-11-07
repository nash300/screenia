import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

function loadEnvFile(path) {
  const source = readFileSync(path, "utf8");
  for (const line of source.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator < 1) continue;
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile(".env.local");
const stripeKey = process.env.STRIPE_SECRET_KEY || "";
if (!stripeKey.startsWith("sk_test_")) throw new Error("This pricing sync is restricted to Stripe test mode.");
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("Supabase service configuration is missing.");

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const stripe = new Stripe(stripeKey, { apiVersion: "2026-08-26.dahlia" });

const { data: plans, error } = await supabase
  .from("pricing_plans")
  .select("id,code,name,resolution,setup_fee_sek,setup_included_screens,additional_setup_fee_sek,hardware_fee_sek,shipping_fee_sek,shipping_included_devices,additional_shipping_fee_sek,monthly_fee_sek,tax_behavior,stripe_setup_price_id,stripe_additional_setup_price_id,stripe_hardware_price_id,stripe_shipping_price_id,stripe_monthly_price_id,stripe_additional_shipping_price_id")
  .eq("is_active", true)
  .order("code");
if (error) throw error;
if (!plans || plans.length !== 2 || !plans.every((plan) => ["standard_fhd", "premium_4k"].includes(plan.code))) throw new Error("Exactly Standard and Premium must be active before Stripe sync.");

for (const plan of plans) {
  if (plan.setup_fee_sek !== 499 || plan.setup_included_screens !== 3 || plan.additional_setup_fee_sek !== 249 || plan.shipping_fee_sek !== 99 || plan.shipping_included_devices !== 50 || plan.additional_shipping_fee_sek !== 0 || plan.tax_behavior !== "inclusive") throw new Error(`Pricing rule mismatch for ${plan.code}.`);
}

async function deactivatePrice(priceId) {
  if (!priceId) return;
  try {
    const price = await stripe.prices.retrieve(priceId);
    if (price.active) await stripe.prices.update(priceId, { active: false });
  } catch (error) {
    if (error?.statusCode !== 404) throw error;
  }
}

async function ensurePrice({ existingId, amountSek, recurring, productName, productDescription, metadata }) {
  let existing = null;
  if (existingId) {
    try {
      existing = await stripe.prices.retrieve(existingId, { expand: ["product"] });
    } catch (error) {
      if (error?.statusCode !== 404) throw error;
    }
  }
  const valid = existing && existing.active && existing.currency === "sek" && existing.unit_amount === amountSek * 100 && existing.tax_behavior === "inclusive" && Boolean(existing.recurring) === Boolean(recurring) && existing.product && typeof existing.product !== "string" && !existing.product.deleted;
  if (valid) {
    await stripe.products.update(existing.product.id, { name: productName, description: productDescription, active: true, metadata });
    return existing.id;
  }
  let productId = null;
  if (existing?.product && typeof existing.product !== "string" && !existing.product.deleted) productId = existing.product.id;
  if (!productId) {
    const product = await stripe.products.create({ name: productName, description: productDescription, active: true, metadata });
    productId = product.id;
  } else {
    await stripe.products.update(productId, { name: productName, description: productDescription, active: true, metadata });
  }
  const price = await stripe.prices.create({ currency: "sek", unit_amount: amountSek * 100, tax_behavior: "inclusive", product: productId, ...(recurring ? { recurring: { interval: "month" } } : {}), metadata });
  await stripe.products.update(productId, { default_price: price.id });
  if (existing?.active) await deactivatePrice(existing.id);
  return price.id;
}

const sharedSetupExistingId = plans.find((plan) => plan.stripe_additional_setup_price_id)?.stripe_additional_setup_price_id || null;
const sharedSetupId = await ensurePrice({
  existingId: sharedSetupExistingId,
  amountSek: 249,
  productName: "Screenia additional setup",
  productDescription: "One-time setup fee for each screen beyond the included setup quantity.",
  metadata: { business_rule: "additional_screen_setup", included_screens: "3" },
});

for (const plan of plans) {
  const base = `Screenia ${plan.name} ${plan.resolution}`;
  const metadata = { pricing_plan_code: plan.code };
  const ids = {
    stripe_setup_price_id: await ensurePrice({ existingId: plan.stripe_setup_price_id, amountSek: 499, productName: `${base} - administrative setup`, productDescription: "Administrative setup and configuration fee.", metadata: { ...metadata, business_rule: "base_administrative_charge" } }),
    stripe_additional_setup_price_id: sharedSetupId,
    stripe_hardware_price_id: await ensurePrice({ existingId: plan.stripe_hardware_price_id, amountSek: plan.hardware_fee_sek, productName: `${base} device`, productDescription: "Screenia display device.", metadata: { ...metadata, business_rule: "hardware" } }),
    stripe_shipping_price_id: await ensurePrice({ existingId: plan.stripe_shipping_price_id, amountSek: 99, productName: "Screenia Sweden shipping", productDescription: "Fixed shipping fee regardless of device quantity.", metadata: { ...metadata, business_rule: "fixed_shipping" } }),
    stripe_monthly_price_id: await ensurePrice({ existingId: plan.stripe_monthly_price_id, amountSek: plan.monthly_fee_sek, recurring: { interval: "month" }, productName: `${base} monthly subscription`, productDescription: "Monthly Screenia subscription.", metadata: { ...metadata, business_rule: "monthly_subscription" } }),
    stripe_additional_shipping_price_id: null,
  };
  const { error: updateError } = await supabase.from("pricing_plans").update(ids).eq("id", plan.id);
  if (updateError) throw updateError;
}

const obsoleteShippingIds = [...new Set(plans.map((plan) => plan.stripe_additional_shipping_price_id).filter(Boolean))];
for (const priceId of obsoleteShippingIds) await deactivatePrice(priceId);

console.log(`Synced Standard and Premium Stripe prices: fixed 99 SEK shipping, unchanged device prices, and monthly prices of 99/129 SEK.`);
