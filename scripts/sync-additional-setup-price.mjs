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

const stripeKey = process.env.STRIPE_SECRET_KEY || "";
if (!stripeKey.startsWith("sk_test_")) {
  throw new Error(
    "This preparatory sync is restricted to Stripe test mode. Use the audited admin pricing sync for live mode.",
  );
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);
const stripe = new Stripe(stripeKey, { apiVersion: "2026-04-22.dahlia" });

const { data: plans, error: plansError } = await supabase
  .from("pricing_plans")
  .select(
    "id,code,name,resolution,setup_fee_sek,setup_included_screens,additional_setup_fee_sek,shipping_fee_sek,shipping_included_devices,additional_shipping_fee_sek,tax_behavior,stripe_setup_price_id,stripe_additional_setup_price_id,stripe_shipping_price_id,stripe_additional_shipping_price_id",
  )
  .eq("is_active", true)
  .order("code");

if (plansError) throw plansError;
if (!plans?.length) throw new Error("No active pricing plans were found.");

for (const plan of plans) {
  if (
    plan.setup_fee_sek !== 1599 ||
    plan.setup_included_screens !== 3 ||
    plan.additional_setup_fee_sek !== 249 ||
    plan.shipping_fee_sek !== 99 ||
    plan.shipping_included_devices !== 3 ||
    plan.additional_shipping_fee_sek !== 29 ||
    plan.tax_behavior !== "inclusive"
  ) {
    throw new Error(`Pricing rule mismatch for ${plan.code}.`);
  }
}

let sharedShippingPriceId = plans.find(
  (plan) => plan.stripe_additional_shipping_price_id,
)?.stripe_additional_shipping_price_id;

if (sharedShippingPriceId) {
  try {
    const existing = await stripe.prices.retrieve(sharedShippingPriceId, {
      expand: ["product"],
    });
    if (
      !existing.active ||
      existing.currency !== "sek" ||
      existing.unit_amount !== 2900 ||
      existing.tax_behavior !== "inclusive" ||
      existing.recurring
    ) {
      sharedShippingPriceId = null;
    } else if (
      existing.product &&
      typeof existing.product !== "string" &&
      !existing.product.deleted
    ) {
      await stripe.products.update(existing.product.id, {
        name: "Screenia frakt för extra enhet",
        description:
          "Frakt per enhet utöver de tre enheter som ingår i grundfrakten.",
        active: true,
      });
    }
  } catch {
    sharedShippingPriceId = null;
  }
}

if (!sharedShippingPriceId) {
  const product = await stripe.products.create({
    name: "Screenia frakt för extra enhet",
    description:
      "Frakt per enhet utöver de tre enheter som ingår i grundfrakten.",
    metadata: {
      business_rule: "additional_device_shipping",
      included_devices: "3",
    },
  });

  const price = await stripe.prices.create({
    currency: "sek",
    unit_amount: 2900,
    tax_behavior: "inclusive",
    product: product.id,
    metadata: {
      business_rule: "additional_device_shipping",
      included_devices: "3",
    },
  });
  sharedShippingPriceId = price.id;
}

let sharedPriceId = plans.find(
  (plan) => plan.stripe_additional_setup_price_id,
)?.stripe_additional_setup_price_id;

if (sharedPriceId) {
  try {
    const existing = await stripe.prices.retrieve(sharedPriceId, {
      expand: ["product"],
    });
    if (
      !existing.active ||
      existing.currency !== "sek" ||
      existing.unit_amount !== 24900 ||
      existing.tax_behavior !== "inclusive" ||
      existing.recurring
    ) {
      sharedPriceId = null;
    } else if (
      existing.product &&
      typeof existing.product !== "string" &&
      !existing.product.deleted
    ) {
      await stripe.products.update(existing.product.id, {
        name: "Screenia extra skärm - start och konfiguration",
        description:
          "Engångsavgift per skärm utöver de tre skärmar som ingår i grundavgiften.",
        active: true,
      });
    }
  } catch {
    sharedPriceId = null;
  }
}

if (!sharedPriceId) {
  const product = await stripe.products.create({
    name: "Screenia extra skärm - start och konfiguration",
    description:
      "Engångsavgift per skärm utöver de tre skärmar som ingår i grundavgiften.",
    metadata: {
      business_rule: "additional_screen_setup",
      included_screens: "3",
    },
  });

  const price = await stripe.prices.create({
    currency: "sek",
    unit_amount: 24900,
    tax_behavior: "inclusive",
    product: product.id,
    metadata: {
      business_rule: "additional_screen_setup",
      included_screens: "3",
    },
  });
  sharedPriceId = price.id;
}

for (const plan of plans) {
  if (plan.stripe_setup_price_id) {
    const basePrice = await stripe.prices.retrieve(plan.stripe_setup_price_id, {
      expand: ["product"],
    });
    if (
      basePrice.unit_amount !== 159900 ||
      basePrice.currency !== "sek" ||
      basePrice.tax_behavior !== "inclusive" ||
      basePrice.recurring
    ) {
      throw new Error(`Base setup Stripe price mismatch for ${plan.code}.`);
    }
    if (
      basePrice.product &&
      typeof basePrice.product !== "string" &&
      !basePrice.product.deleted
    ) {
      await stripe.products.update(basePrice.product.id, {
        name: `Screenia ${plan.name} ${plan.resolution} - start och konfiguration (upp till 3 skärmar)`,
        description: "Grundavgift för start och konfiguration av upp till tre skärmar.",
        active: true,
      });
    }
  }
  if (plan.stripe_shipping_price_id) {
    const shippingPrice = await stripe.prices.retrieve(
      plan.stripe_shipping_price_id,
      { expand: ["product"] },
    );
    if (
      shippingPrice.unit_amount !== 9900 ||
      shippingPrice.currency !== "sek" ||
      shippingPrice.tax_behavior !== "inclusive" ||
      shippingPrice.recurring
    ) {
      throw new Error(`Base shipping Stripe price mismatch for ${plan.code}.`);
    }
    if (
      shippingPrice.product &&
      typeof shippingPrice.product !== "string" &&
      !shippingPrice.product.deleted
    ) {
      await stripe.products.update(shippingPrice.product.id, {
        name: "Screenia frakt inom Sverige (upp till 3 enheter)",
        description: "Grundfrakt för upp till tre skärmenheter.",
        active: true,
      });
    }
  }
}

const { error: updateError } = await supabase
  .from("pricing_plans")
  .update({
    stripe_additional_setup_price_id: sharedPriceId,
    stripe_additional_shipping_price_id: sharedShippingPriceId,
  })
  .in(
    "id",
    plans.map((plan) => plan.id),
  );
if (updateError) throw updateError;

console.log(
  `Synced shared Stripe test prices for 249 SEK additional-screen setup (${sharedPriceId}) and 29 SEK additional-device shipping (${sharedShippingPriceId}) across ${plans.length} active plans.`,
);
