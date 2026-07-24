import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), "utf8");
const plansSource = read("src/lib/pricing/plans.ts");
const checkoutSource = read("src/app/api/stripe/checkout/route.ts");
const webhookSource = read("src/app/api/stripe/webhook/route.ts");
const vatSource = read("src/lib/pricing/vat.ts");
const accountRouteSource = read("src/app/api/account/route.ts");
const accountPageSource = read("src/app/account/page.tsx");
const landingRequestSource = read("src/app/api/onboarding-requests/route.ts");
const setupFeeSource = read("src/lib/pricing/setup-fee.ts");
const shippingFeeSource = read("src/lib/pricing/shipping-fee.ts");
const prepareOnboardingSource = read("src/app/api/admin/prepare-onboarding/route.ts");
const pricingMigrationSource = read("supabase/migrations/202607210000_setup_fee_quantity_rule.sql");
const shippingMigrationSource = read("supabase/migrations/202607210100_tiered_shipping_rule.sql");

const setupFeeForScreens = (screenQuantity, baseSetupFeeSek = 1599) =>
  screenQuantity > 0
    ? baseSetupFeeSek + Math.max(0, screenQuantity - 3) * 249
    : 0;
const incrementalSetupFeeForScreens = (existingPaidScreens, addedScreens) =>
  Math.max(
    0,
    setupFeeForScreens(existingPaidScreens + addedScreens) -
      setupFeeForScreens(existingPaidScreens),
  );
const shippingFeeForDevices = (deviceQuantity, baseShippingFeeSek = 99) =>
  deviceQuantity > 0
    ? baseShippingFeeSek + Math.max(0, deviceQuantity - 3) * 29
    : 0;

const expectedPlans = [
  {
    code: "standard_fhd",
    setupFeeSek: 1599,
    hardwareFeeSek: 699,
    shippingFeeSek: 99,
    monthlyFeeSek: 249,
    trialDays: 21,
    firstPaymentSek: 2397,
  },
  {
    code: "premium_4k",
    setupFeeSek: 1599,
    hardwareFeeSek: 1099,
    shippingFeeSek: 99,
    monthlyFeeSek: 349,
    trialDays: 21,
    firstPaymentSek: 2797,
  },
];

const failures = [];
const requireSource = (source, marker, message) => {
  if (!source.includes(marker)) failures.push(message);
};

for (const plan of expectedPlans) {
  for (const [field, value] of Object.entries(plan)) {
    if (field === "firstPaymentSek") continue;
    const marker = typeof value === "string" ? `${field}: "${value}"` : `${field}: ${value}`;
    requireSource(plansSource, marker, `${plan.code}: expected ${marker}`);
  }

  const calculated = plan.setupFeeSek + plan.hardwareFeeSek + plan.shippingFeeSek;
  if (calculated !== plan.firstPaymentSek) {
    failures.push(`${plan.code}: first payment should be ${plan.firstPaymentSek} SEK, calculated ${calculated} SEK`);
  }
}

const mixedSelection = {
  setupFeeSek: 1599,
  standardQuantity: 1,
  premiumQuantity: 2,
  firstPaymentSek: 4595,
  monthlyFeeSek: 947,
};
const calculatedMixedFirstPayment =
  setupFeeForScreens(
    mixedSelection.standardQuantity + mixedSelection.premiumQuantity,
    mixedSelection.setupFeeSek,
  ) +
  699 * mixedSelection.standardQuantity +
  1099 * mixedSelection.premiumQuantity +
  shippingFeeForDevices(
    mixedSelection.standardQuantity + mixedSelection.premiumQuantity,
  );
const calculatedMixedMonthly =
  249 * mixedSelection.standardQuantity +
  349 * mixedSelection.premiumQuantity;
if (calculatedMixedFirstPayment !== mixedSelection.firstPaymentSek) {
  failures.push(
    `mixed selection: first payment should be ${mixedSelection.firstPaymentSek} SEK, calculated ${calculatedMixedFirstPayment} SEK`,
  );
}

const fourScreenSelection = {
  screenQuantity: 4,
  setupFeeSek: 1848,
  hardwareFeeSek: 699 * 4,
  shippingFeeSek: 99 + 29,
  firstPaymentSek: 4772,
};
const calculatedFourScreenFirstPayment =
  setupFeeForScreens(fourScreenSelection.screenQuantity) +
  fourScreenSelection.hardwareFeeSek +
  fourScreenSelection.shippingFeeSek;
if (calculatedFourScreenFirstPayment !== fourScreenSelection.firstPaymentSek) {
  failures.push(
    `four-screen selection: first payment should be ${fourScreenSelection.firstPaymentSek} SEK, calculated ${calculatedFourScreenFirstPayment} SEK`,
  );
}
if (calculatedMixedMonthly !== mixedSelection.monthlyFeeSek) {
  failures.push(
    `mixed selection: monthly price should be ${mixedSelection.monthlyFeeSek} SEK, calculated ${calculatedMixedMonthly} SEK`,
  );
}

const fourthScreenAddonSetup = incrementalSetupFeeForScreens(3, 1);
const thirdScreenAddonSetup = incrementalSetupFeeForScreens(2, 1);
const fourthScreenAddonFirstPayment =
  fourthScreenAddonSetup + 699 + shippingFeeForDevices(1);
if (fourthScreenAddonSetup !== 249) {
  failures.push(
    `existing customer add-on: fourth screen setup should be 249 SEK, calculated ${fourthScreenAddonSetup} SEK`,
  );
}
if (thirdScreenAddonSetup !== 0) {
  failures.push(
    `existing customer add-on: third covered screen setup should be 0 SEK, calculated ${thirdScreenAddonSetup} SEK`,
  );
}
if (fourthScreenAddonFirstPayment !== 1047) {
  failures.push(
    `existing customer add-on: fourth Standard screen first payment should be 1047 SEK, calculated ${fourthScreenAddonFirstPayment} SEK`,
  );
}

const checkoutMarkers = [
  [
    'mode: isExistingCustomerAddOn ? "payment" : "subscription"',
    "Checkout must create a subscription for new customers and one invoice for existing-customer add-ons",
  ],
  [
    "invoice_creation:",
    "Existing-customer add-ons must create exactly one Stripe invoice",
  ],
  [
    "subscription_items",
    "Existing-customer add-ons must carry subscription update items through Checkout metadata",
  ],
  ["trial_period_days: plan.trial_days", "Checkout must use the configured trial"],
  ["tax_behavior: priceTaxBehavior", "Checkout line items must declare tax behavior"],
  ["automatic_tax:", "Checkout must configure automatic tax"],
  ["calculateSetupFeeSek(", "Checkout must calculate the quantity-based setup fee"],
  ["stripe_additional_setup_price_id", "Checkout must use the dedicated additional-screen Stripe price"],
  ["quantity: additionalSetupScreens", "Stripe must invoice the exact additional-screen quantity"],
  ["additional_setup_screen_count: additionalSetupScreens", "Orders must store the additional-screen count"],
  ["item.discountedHardwareFeeSek * item.quantity", "First-payment calculation must include device quantity"],
  ["calculateShippingFeeSek(", "Checkout must calculate order-wide tiered shipping"],
  ["quantity: additionalShippingDevices", "Stripe must invoice the exact additional-shipping quantity"],
  ["additional_shipping_device_count: additionalShippingDevices", "Orders must store the additional-shipping count"],
];

for (const [marker, message] of checkoutMarkers) requireSource(checkoutSource, marker, message);

requireSource(vatSource, "SWEDISH_STANDARD_VAT_RATE = 0.25", "Included Swedish VAT rate must remain 25%");
requireSource(vatSource, "grossOre / (1 + SWEDISH_STANDARD_VAT_RATE)", "Included VAT must be derived from gross, not added to it");
requireSource(webhookSource, "session.amount_total", "Checkout total must be stored from Stripe evidence");
requireSource(
  webhookSource,
  "stripe.subscriptions.update(",
  "Paid existing-customer add-ons must update the existing Stripe subscription",
);
requireSource(webhookSource, "invoice.total", "Recurring invoice total must be stored from Stripe evidence");
requireSource(webhookSource, "invoiceTaxAmountOre(invoice)", "Recurring invoice VAT must be stored from Stripe evidence");
requireSource(accountRouteSource, "screen_quantity", "Customer billing data must include screen quantity");
requireSource(accountRouteSource, "quote_items", "Customer billing data must include quoted line items");
requireSource(accountRouteSource, "device_discount_amount_sek", "Customer billing data must include initial device discount");
requireSource(accountPageSource, "hardwareSubtotalSek", "Customer first-payment display must calculate the complete hardware subtotal");
requireSource(accountPageSource, "shippingSubtotalSek", "Customer first-payment display must calculate the complete shipping subtotal");
requireSource(accountPageSource, "monthlySubtotalSek", "Customer monthly display must calculate all quoted screens");
requireSource(landingRequestSource, "Array.isArray(body.quoteItems)", "Landing requests must accept mixed package lines");
requireSource(landingRequestSource, "requested_quote_items: requestedQuoteItems", "Landing requests must store every selected package line");
requireSource(landingRequestSource, "calculateSetupFeeSek(screenQuantity, baseSetupFeeSek)", "Landing confirmation must calculate the quantity-based setup fee");
requireSource(setupFeeSource, "calculateIncrementalSetupFeeSek", "Setup helpers must support existing-customer add-on setup pricing");
requireSource(prepareOnboardingSource, "calculateIncrementalSetupFeeSek(", "Admin quote preparation must calculate marginal setup for existing customers");
requireSource(checkoutSource, "Number(quotedOrder.setup_fee_sek)", "Stripe checkout must use the prepared quote setup amount");
requireSource(setupFeeSource, "INCLUDED_SETUP_SCREEN_COUNT = 3", "Setup fee must include the first three screens");
requireSource(setupFeeSource, "ADDITIONAL_SETUP_FEE_PER_SCREEN_SEK = 249", "Each screen after the third must add 249 SEK");
requireSource(shippingFeeSource, "INCLUDED_SHIPPING_DEVICE_COUNT = 3", "Base shipping must include the first three devices");
requireSource(shippingFeeSource, "BASE_SHIPPING_FEE_SEK = 99", "Base shipping must be 99 SEK");
requireSource(shippingFeeSource, "ADDITIONAL_SHIPPING_FEE_PER_DEVICE_SEK = 29", "Each device after the third must add 29 SEK shipping");
requireSource(pricingMigrationSource, "stripe_additional_setup_price_id text", "Supabase must store the shared additional-screen Stripe price reference");
requireSource(pricingMigrationSource, "additional_setup_screen_count integer", "Supabase orders must store the additional-screen count");
requireSource(shippingMigrationSource, "stripe_additional_shipping_price_id text", "Supabase must store the shared additional-shipping Stripe price reference");
requireSource(shippingMigrationSource, "additional_shipping_device_count integer", "Supabase orders must store the additional-shipping device count");

if (failures.length) {
  console.error("Billing invariant check failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

for (const plan of expectedPlans) {
  console.log(`${plan.code}: first ${plan.firstPaymentSek} SEK, then ${plan.monthlyFeeSek} SEK/month after ${plan.trialDays} days (prices include moms)`);
}
console.log(`mixed 1 FHD + 2 4K: first ${mixedSelection.firstPaymentSek} SEK, then ${mixedSelection.monthlyFeeSek} SEK/month (one setup fee)`);
console.log(`four Standard FHD screens: first ${fourScreenSelection.firstPaymentSek} SEK including ${fourScreenSelection.setupFeeSek} SEK setup`);
console.log("existing customer add-on after three paid screens: first 1047 SEK including 249 SEK setup");
console.log("Billing invariant check passed.");
