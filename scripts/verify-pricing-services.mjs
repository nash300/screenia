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
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile(".env.local");

const required = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "STRIPE_SECRET_KEY"];
for (const key of required) {
  if (!process.env[key]) throw new Error(`Missing ${key}.`);
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2026-08-26.dahlia" });

const { data: plans, error } = await supabase
  .from("pricing_plans")
  .select("code,setup_fee_sek,setup_included_screens,additional_setup_fee_sek,shipping_fee_sek,shipping_included_devices,additional_shipping_fee_sek,tax_behavior,stripe_setup_price_id,stripe_hardware_price_id,stripe_shipping_price_id,stripe_monthly_price_id,stripe_additional_setup_price_id,stripe_additional_shipping_price_id")
  .eq("is_active", true)
  .order("code");
if (error) throw error;

const expectedPlans = {
  standard_fhd: { hardwareOre: 69900, monthlyOre: 9900 },
  premium_4k: { hardwareOre: 109900, monthlyOre: 12900 },
};
const actualCodes = (plans || []).map((plan) => plan.code);
if (actualCodes.length !== 2 || actualCodes.some((code) => !expectedPlans[code])) {
  throw new Error(`Expected exactly Standard and Premium active plans, found ${actualCodes.join(", ") || "none"}.`);
}

for (const plan of plans) {
  const expected = expectedPlans[plan.code];
  if (plan.setup_fee_sek !== 199 || plan.setup_included_screens !== 50 || plan.additional_setup_fee_sek !== 0 || plan.shipping_fee_sek !== 99 || plan.shipping_included_devices !== 50 || plan.additional_shipping_fee_sek !== 0 || plan.tax_behavior !== "inclusive" || plan.stripe_additional_setup_price_id !== null || plan.stripe_additional_shipping_price_id !== null) {
    throw new Error(`Supabase pricing rule mismatch for ${plan.code}.`);
  }

  const priceChecks = [
    ["setup", plan.stripe_setup_price_id, 19900, false],
    ["hardware", plan.stripe_hardware_price_id, expected.hardwareOre, false],
    ["shipping", plan.stripe_shipping_price_id, 9900, false],
    ["monthly", plan.stripe_monthly_price_id, expected.monthlyOre, true],
  ];
  for (const [label, priceId, expectedOre, recurring] of priceChecks) {
    if (!priceId) throw new Error(`${plan.code} is missing ${label} Stripe price.`);
    const price = await stripe.prices.retrieve(priceId);
    if (!price.active || price.currency !== "sek" || price.unit_amount !== expectedOre || price.tax_behavior !== "inclusive" || Boolean(price.recurring) !== recurring) {
      throw new Error(`${plan.code} ${label} Stripe price is misconfigured.`);
    }
  }
}

console.log("Pricing services verified: Standard 99 SEK/month, Premium 129 SEK/month, fixed 99 SEK shipping, 199 SEK setup, unchanged device prices, and Premium video entitlement.");
