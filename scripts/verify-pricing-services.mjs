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
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile(".env.local");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2026-04-22.dahlia",
});

const { data: plans, error } = await supabase
  .from("pricing_plans")
  .select(
    "code,setup_fee_sek,setup_included_screens,additional_setup_fee_sek,tax_behavior,stripe_setup_price_id,stripe_hardware_price_id,stripe_shipping_price_id,stripe_monthly_price_id,stripe_additional_setup_price_id",
  )
  .eq("is_active", true)
  .order("code");
if (error) throw error;
if (plans?.length !== 2) {
  throw new Error(`Expected 2 active plans, found ${plans?.length || 0}.`);
}

const additionalPriceIds = new Set(
  plans.map((plan) => plan.stripe_additional_setup_price_id).filter(Boolean),
);
if (additionalPriceIds.size !== 1) {
  throw new Error("Active plans do not share exactly one additional-screen Stripe price.");
}

const sharedAdditionalPriceId = [...additionalPriceIds][0];
const sharedAdditionalPrice = await stripe.prices.retrieve(
  sharedAdditionalPriceId,
  { expand: ["product"] },
);
if (
  !sharedAdditionalPrice.active ||
  sharedAdditionalPrice.currency !== "sek" ||
  sharedAdditionalPrice.unit_amount !== 24900 ||
  sharedAdditionalPrice.tax_behavior !== "inclusive" ||
  sharedAdditionalPrice.recurring
) {
  throw new Error("The shared additional-screen Stripe price is misconfigured.");
}

for (const plan of plans) {
  if (
    plan.setup_fee_sek !== 1599 ||
    plan.setup_included_screens !== 3 ||
    plan.additional_setup_fee_sek !== 249 ||
    plan.tax_behavior !== "inclusive"
  ) {
    throw new Error(`Supabase pricing rule mismatch for ${plan.code}.`);
  }

  const priceChecks = [
    ["setup", plan.stripe_setup_price_id, 159900, false],
    [
      "hardware",
      plan.stripe_hardware_price_id,
      plan.code === "premium_4k" ? 109900 : 69900,
      false,
    ],
    ["shipping", plan.stripe_shipping_price_id, 9900, false],
    [
      "monthly",
      plan.stripe_monthly_price_id,
      plan.code === "premium_4k" ? 34900 : 24900,
      true,
    ],
  ];

  for (const [label, priceId, expectedOre, recurring] of priceChecks) {
    if (!priceId) throw new Error(`${plan.code} is missing ${label} Stripe price.`);
    const price = await stripe.prices.retrieve(priceId);
    if (
      !price.active ||
      price.currency !== "sek" ||
      price.unit_amount !== expectedOre ||
      price.tax_behavior !== "inclusive" ||
      Boolean(price.recurring) !== recurring
    ) {
      throw new Error(`${plan.code} ${label} Stripe price is misconfigured.`);
    }
  }
}

console.log(
  `Pricing services verified: 2 plans, shared 249 SEK additional-screen price ${sharedAdditionalPriceId}, inclusive moms, and correct one-time/monthly Stripe behavior.`,
);
