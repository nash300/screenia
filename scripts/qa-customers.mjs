import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const BATCH_ID = "SCREENIA_QA_100_V1";
const EMAIL_PATTERN = "qa.customer.%@example.test";
const QA_PASSWORD = "ScreeniaQa12345";
const command = process.argv[2] || "verify";
const confirmed = process.argv.includes("--confirm-screenia-qa");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
}

if (!["seed", "verify", "clean"].includes(command)) {
  throw new Error("Use one of: seed, verify, clean.");
}

if (["seed", "clean"].includes(command) && !confirmed) {
  throw new Error("Destructive QA changes require --confirm-screenia-qa.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const scenarios = [
  { key: "new_request", label: "New website request", customer: "new_request", subscription: false },
  { key: "quote_draft", label: "Quote prepared but not sent", customer: "draft", order: "quote_prepared", fulfillment: "pending" },
  { key: "quote_sent", label: "Quote and setup link sent", customer: "invited", order: "quote_sent", fulfillment: "pending", onboarding: true },
  { key: "checkout_started", label: "Profile completed, checkout unfinished", customer: "completed_profile", order: "checkout_started", fulfillment: "pending", onboarding: true, accepted: true },
  { key: "paid_material_collection", label: "Paid, waiting for initial material", customer: "paid", payment: "paid", access: "active", order: "paid", fulfillment: "content_collection", inventory: "ready_to_reserve", accepted: true },
  { key: "material_pending", label: "Customer material is incomplete", customer: "content_pending", payment: "paid", access: "active", order: "paid", fulfillment: "content_pending", inventory: "ready_to_reserve", accepted: true },
  { key: "material_received", label: "Material received, device not allocated", customer: "content_received", payment: "paid", access: "active", order: "active", fulfillment: "content_received", inventory: "ready_to_reserve", production: "not_started", preview: "pending", accepted: true },
  { key: "device_without_playlist", label: "Device allocated, playlist missing", customer: "content_received", payment: "paid", access: "active", order: "active", fulfillment: "preview_approved", inventory: "assigned", production: "ready", preview: "approved", devices: "one", accepted: true },
  { key: "active_display", label: "Active service with playable display", customer: "active", payment: "paid", access: "active", order: "active", fulfillment: "active", inventory: "assigned", production: "completed", preview: "approved", devices: "all", playlist: true, account: true, accepted: true },
  { key: "trial_active", label: "Active customer inside free trial", customer: "active", payment: "paid", access: "active", order: "active", fulfillment: "active", inventory: "assigned", production: "completed", preview: "approved", devices: "all", playlist: true, account: true, trial: true, accepted: true },
  { key: "payment_failed", label: "Recurring payment failed", customer: "suspended", payment: "failed", access: "payment_failed", inactive: "payment_failed", order: "payment_failed", fulfillment: "paused", inventory: "assigned", production: "completed", preview: "approved", devices: "one", accepted: true },
  { key: "paused", label: "Subscription temporarily paused", customer: "active", payment: "paid", access: "paused", inactive: "paused", order: "active", fulfillment: "paused", inventory: "assigned", production: "completed", preview: "approved", devices: "one", playlist: true, paused: true, accepted: true },
  { key: "cancel_scheduled", label: "Cancellation scheduled for period end", customer: "active", payment: "paid", access: "active_until_period_end", order: "active", fulfillment: "active", inventory: "assigned", production: "completed", preview: "approved", devices: "one", playlist: true, cancelAtPeriodEnd: true, accepted: true },
  { key: "cancelled", label: "Cancelled and closed customer", customer: "cancelled", payment: "cancelled", access: "cancelled", inactive: "customer_cancelled", order: "cancelled", fulfillment: "cancelled", inventory: "returned", production: "not_started", preview: "not_started", cancelled: true, accepted: true },
  { key: "refunded_before_layout", label: "Full refund before layout work", customer: "refunded", payment: "refunded", access: "refunded", inactive: "refunded_before_production", order: "refunded", fulfillment: "cancelled", inventory: "returned", production: "not_started", preview: "not_started", refund: "full", cancelled: true, accepted: true },
  { key: "post_layout_refund", label: "Partial refund request after layout started", customer: "active", payment: "paid", access: "active", order: "active", fulfillment: "in_production", inventory: "reserved", production: "layout_started", preview: "changes_requested", refund: "partial", layoutStarted: true, accepted: true },
  { key: "payment_disputed", label: "Payment dispute under review", customer: "suspended", payment: "disputed", access: "payment_disputed", inactive: "payment_disputed", order: "disputed", fulfillment: "paused", inventory: "reserved", production: "paused", preview: "pending", accepted: true },
  { key: "ready_to_ship", label: "Device prepared and ready to ship", customer: "active", payment: "paid", access: "active", order: "active", fulfillment: "ready_to_ship", inventory: "assigned", production: "completed", preview: "approved", devices: "all", accepted: true },
  { key: "shipped", label: "Order shipped with tracking", customer: "active", payment: "paid", access: "active", order: "active", fulfillment: "shipped", inventory: "shipped", production: "completed", preview: "approved", devices: "all", tracking: true, accepted: true },
  { key: "discount_and_support", label: "Active discount with customer support history", customer: "active", payment: "paid", access: "active", order: "active", fulfillment: "active", inventory: "assigned", production: "completed", preview: "approved", devices: "one", playlist: true, discount: true, support: true, accepted: true },
];

const cities = ["Stockholm", "Gothenburg", "Malmo", "Uppsala", "Vasteras"];
const industries = ["Restaurant", "Retail", "Salon", "Clinic", "Office"];

function deterministicUuid(key) {
  const hex = createHash("sha256").update(`${BATCH_ID}:${key}`).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function isoDaysFromNow(days, hour = 10) {
  const date = new Date(Date.now() + days * 86_400_000);
  date.setUTCHours(hour, 0, 0, 0);
  return date.toISOString();
}

function chunks(items, size = 50) {
  const result = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

async function insertRows(table, rows) {
  if (rows.length === 0) return;
  for (const part of chunks(rows)) {
    const { error } = await supabase.from(table).insert(part);
    if (error) throw new Error(`${table} insert failed: ${error.message}`);
  }
}

async function qaCustomers() {
  const { data, error } = await supabase
    .from("customers")
    .select("id,customer_number,email,auth_user_id,notes,created_at,updated_at")
    .like("email", EMAIL_PATTERN);
  if (error) throw new Error(`Could not identify QA customers: ${error.message}`);
  return data || [];
}

async function deleteQaAuthUsers() {
  let page = 1;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`Could not list auth users: ${error.message}`);
    const users = data.users.filter(
      (user) => user.user_metadata?.qa_seed_batch === BATCH_ID,
    );
    for (const user of users) {
      const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);
      if (deleteError) throw new Error(`Could not delete QA auth user: ${deleteError.message}`);
    }
    if (data.users.length < 1000) break;
    page += 1;
  }
}

async function deleteDetachedQaAuditEvents() {
  const { data, error } = await supabase
    .from("audit_events")
    .select("id,metadata")
    .is("customer_id", null)
    .eq("event_type", "customers_delete");
  if (error) throw new Error(`Could not identify detached QA audit events: ${error.message}`);

  const ids = (data || [])
    .filter((event) => {
      const oldRow = event.metadata?.old;
      return (
        oldRow?.notes?.includes(BATCH_ID) ||
        oldRow?.email?.endsWith("@example.test")
      );
    })
    .map((event) => event.id);

  for (const part of chunks(ids)) {
    const { error: deleteError } = await supabase
      .from("audit_events")
      .delete()
      .in("id", part);
    if (deleteError) {
      throw new Error(`Could not clean detached QA audit events: ${deleteError.message}`);
    }
  }
}

async function cleanFixtures() {
  const existing = await qaCustomers();
  const ids = existing.map((customer) => customer.id);

  if (ids.length > 0) {
    const { data: deviceRows, error: deviceReadError } = await supabase
      .from("devices")
      .select("id")
      .in("customer_id", ids);
    if (deviceReadError) {
      throw new Error(`Could not identify QA devices: ${deviceReadError.message}`);
    }
    const deviceIds = (deviceRows || []).map((device) => device.id);

    if (deviceIds.length > 0) {
      for (const part of chunks(deviceIds)) {
        const { error: playlistError } = await supabase
          .from("playlists")
          .delete()
          .in("device_id", part);
        if (playlistError) {
          throw new Error(`Could not clean QA playlists: ${playlistError.message}`);
        }
      }
    }

    for (const table of [
      "customer_message_files",
      "customer_messages",
      "customer_display_assets",
      "customer_preview_decisions",
      "customer_legal_agreements",
      "consent_records",
      "customer_refund_cases",
      "subscription_adjustments",
      "customer_subscriptions",
      "devices",
    ]) {
      for (const part of chunks(ids)) {
        const { error } = await supabase.from(table).delete().in("customer_id", part);
        if (error) throw new Error(`Could not clean ${table}: ${error.message}`);
      }
    }
  }

  const { error: inventoryError } = await supabase
    .from("inventory_items")
    .delete()
    .like("notes", `%[${BATCH_ID}]%`);
  if (inventoryError) throw new Error(`Could not clean QA inventory: ${inventoryError.message}`);

  if (ids.length > 0) {
    for (const part of chunks(ids)) {
      const { error: auditError } = await supabase
        .from("audit_events")
        .delete()
        .in("customer_id", part);
      if (auditError) throw new Error(`Could not clean QA audit events: ${auditError.message}`);
    }

    for (const part of chunks(ids)) {
      const { error } = await supabase.from("customers").delete().in("id", part);
      if (error) throw new Error(`Could not clean QA customers: ${error.message}`);
    }
  }

  await deleteQaAuthUsers();
  await deleteDetachedQaAuditEvents();
  return existing.length;
}

async function loadPlans() {
  const { data, error } = await supabase
    .from("pricing_plans")
    .select("id,code,name,resolution,setup_fee_sek,hardware_fee_sek,shipping_fee_sek,monthly_fee_sek,trial_days,is_active")
    .in("code", ["standard_fhd", "premium_4k"])
    .eq("is_active", true);
  if (error) throw new Error(`Could not load pricing plans: ${error.message}`);
  if (!data || data.length !== 2) {
    throw new Error("Both active Standard FHD and Premium 4K plans are required.");
  }
  return Object.fromEntries(data.map((plan) => [plan.code, plan]));
}

async function createQaAccounts(fixtures) {
  const accountFixtures = fixtures.filter((fixture) => fixture.scenario.account);
  const authIds = new Map();
  for (const fixture of accountFixtures) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: fixture.email,
      password: QA_PASSWORD,
      email_confirm: true,
      user_metadata: {
        qa_seed_batch: BATCH_ID,
        scenario: fixture.scenario.key,
      },
    });
    if (error || !data.user) {
      throw new Error(`Could not create QA account ${fixture.email}: ${error?.message || "unknown error"}`);
    }
    authIds.set(fixture.email, data.user.id);
  }
  return authIds;
}

function buildFixtures(plans) {
  const fixtures = [];
  for (let scenarioIndex = 0; scenarioIndex < scenarios.length; scenarioIndex += 1) {
    const scenario = scenarios[scenarioIndex];
    for (let variation = 0; variation < 5; variation += 1) {
      const index = scenarioIndex * 5 + variation;
      const sequence = index + 1;
      const standard = plans.standard_fhd;
      const premium = plans.premium_4k;
      const primaryPlan = variation % 2 === 0 ? standard : premium;
      const mixedPackage = variation === 4;
      const quantity = mixedPackage ? 2 : variation + 1;
      const quoteItems = mixedPackage
        ? [
            { plan: standard, quantity: 1 },
            { plan: premium, quantity: 1 },
          ]
        : [{ plan: primaryPlan, quantity }];
      const email = `qa.customer.${String(sequence).padStart(3, "0")}@example.test`;
      fixtures.push({
        index,
        sequence,
        variation,
        scenario,
        id: deterministicUuid(`customer-${sequence}`),
        subscriptionId: deterministicUuid(`subscription-${sequence}`),
        customerNumber: `99${String(sequence).padStart(6, "0")}`,
        orderNumber: `98${String(sequence).padStart(8, "0")}`,
        email,
        primaryPlan,
        quoteItems,
        quantity,
      });
    }
  }
  return fixtures;
}

function quoteItemRecords(fixture) {
  return fixture.quoteItems.map(({ plan, quantity }) => ({
    pricingPlanCode: plan.code,
    name: plan.name,
    resolution: plan.resolution,
    quantity,
    hardwareFeeSek: plan.hardware_fee_sek,
    shippingFeeSek: plan.shipping_fee_sek,
    monthlyFeeSek: plan.monthly_fee_sek,
  }));
}

function fixtureAmounts(fixture) {
  const screenQuantity = fixture.quoteItems.reduce(
    (sum, item) => sum + item.quantity,
    0,
  );
  const setupFeeSek =
    fixture.primaryPlan.setup_fee_sek + Math.max(0, screenQuantity - 3) * 249;
  const deviceSubtotal = fixture.quoteItems.reduce(
    (sum, item) => sum + item.plan.hardware_fee_sek * item.quantity,
    0,
  );
  const shippingSubtotal = fixture.quoteItems.reduce(
    (sum, item) => sum + item.plan.shipping_fee_sek * item.quantity,
    0,
  );
  const monthlySubtotal = fixture.quoteItems.reduce(
    (sum, item) => sum + item.plan.monthly_fee_sek * item.quantity,
    0,
  );
  const discountPercent = fixture.scenario.discount ? 20 : 0;
  const deviceDiscount = Math.round(deviceSubtotal * (discountPercent / 100));
  const monthlyDiscount = Math.round(monthlySubtotal * (discountPercent / 100));
  const firstPaymentSek =
    setupFeeSek + deviceSubtotal + shippingSubtotal - deviceDiscount;
  const firstPaymentOre = firstPaymentSek * 100;
  const netOre = Math.round(firstPaymentOre / 1.25);
  return {
    deviceSubtotal,
    shippingSubtotal,
    monthlySubtotal,
    discountPercent,
    deviceDiscount,
    monthlyDiscount,
    setupFeeSek,
    screenQuantity,
    firstPaymentOre,
    vatOre: firstPaymentOre - netOre,
  };
}

function hasCompletedPayment(scenario) {
  return !["new_request", "quote_draft", "quote_sent", "checkout_started"].includes(scenario.key);
}

async function seedFixtures() {
  const { count: nonQaCount, error: countError } = await supabase
    .from("customers")
    .select("*", { count: "exact", head: true })
    .not("email", "like", EMAIL_PATTERN);
  if (countError) throw new Error(`Could not check existing customers: ${countError.message}`);
  if ((nonQaCount || 0) > 0) {
    throw new Error(
      `Refusing to mix QA fixtures with ${nonQaCount} non-QA customer records. Clean or explicitly redesign the fixture policy first.`,
    );
  }

  await cleanFixtures();
  const plans = await loadPlans();
  const fixtures = buildFixtures(plans);
  const authIds = await createQaAccounts(fixtures);

  const customers = fixtures.map((fixture) => {
    const { scenario, variation, sequence } = fixture;
    const createdAt = isoDaysFromNow(-(140 - sequence));
    const acceptedAt = scenario.accepted ? isoDaysFromNow(-(95 - sequence)) : null;
    const expiredLink = scenario.onboarding && variation === 0;
    const trackingNumber = scenario.tracking ? `QA-TRACK-${String(sequence).padStart(5, "0")}` : null;
    return {
      id: fixture.id,
      auth_user_id: authIds.get(fixture.email) || null,
      customer_number: fixture.customerNumber,
      name: `QA ${String(sequence).padStart(3, "0")} - ${scenario.label}`,
      contact_person: `Test Contact ${String(sequence).padStart(3, "0")}`,
      email: fixture.email,
      billing_email: variation === 3 ? `qa.billing.${String(sequence).padStart(3, "0")}@example.test` : fixture.email,
      phone: variation === 0 && scenario.key === "new_request" ? null : `+46 70 100 ${String(sequence).padStart(2, "0")} 00`,
      organisation_number: variation === 1 && scenario.key === "new_request" ? null : `559900-${String(sequence).padStart(4, "0")}`,
      address: scenario.key === "new_request" && variation < 2 ? null : `Testgatan ${sequence}`,
      postal_code: scenario.key === "new_request" && variation < 2 ? null : `${String(11000 + sequence).slice(0, 3)} ${String(10 + variation).padStart(2, "0")}`,
      city: cities[variation],
      country: "Sweden",
      business_category: industries[variation],
      website_url: variation === 2 ? null : `https://qa-${String(sequence).padStart(3, "0")}.example.test`,
      preferred_contact_channel: variation % 2 === 0 ? "email" : "phone",
      requested_screen_quantity: fixture.quantity,
      requested_quote_items: quoteItemRecords(fixture),
      notes: `[${BATCH_ID}] Scenario ${scenario.key}: ${scenario.label}. Variation ${variation + 1} of 5. Fictional data only.`,
      status: scenario.customer,
      payment_status: scenario.payment || null,
      service_access_status: scenario.access || "inactive",
      inactive_reason: scenario.inactive || null,
      onboarding_token: scenario.onboarding ? deterministicUuid(`onboarding-${sequence}`) : null,
      onboarding_token_expires_at: scenario.onboarding
        ? isoDaysFromNow(expiredLink ? -1 : 14)
        : null,
      terms_accepted_at: acceptedAt,
      privacy_accepted_at: acceptedAt,
      marketing_consent: variation === 4,
      analytics_consent: variation !== 0,
      remote_support_consent: scenario.support || variation === 3,
      business_description: scenario.accepted ? `Fictional ${industries[variation].toLowerCase()} used for Screenia QA.` : null,
      opening_hours: scenario.accepted ? "Mon-Fri 09:00-18:00" : null,
      promotions: scenario.accepted && variation === 4 ? "QA campaign: lunch offer" : null,
      social_media: null,
      content_option: scenario.accepted ? (variation % 2 === 0 ? "upload" : "assisted") : null,
      content_collected_at: ["content_received", "active", "suspended"].includes(scenario.customer)
        ? isoDaysFromNow(-10)
        : null,
      preview_status: scenario.preview || "not_started",
      preview_url: scenario.preview && scenario.preview !== "not_started"
        ? `${appUrl}/brand/screenia-helper.png`
        : null,
      preview_feedback: scenario.preview === "changes_requested" ? "QA request: update the promotion text." : null,
      production_status: scenario.production || "not_started",
      layout_started_at: scenario.layoutStarted ? isoDaysFromNow(-8) : null,
      setup_fee_locked_at: scenario.layoutStarted ? isoDaysFromNow(-8) : null,
      activated_at: scenario.customer === "active" ? isoDaysFromNow(-7) : null,
      cancelled_at: scenario.cancelled ? isoDaysFromNow(-4) : null,
      cancellation_source: scenario.cancelled ? "admin" : null,
      cancellation_reason: scenario.cancelled ? "QA lifecycle coverage" : null,
      cancellation_details: scenario.cancelled ? "Fictional cancellation used for admin testing." : null,
      tracking_number: trackingNumber,
      tracking_url: trackingNumber ? `https://tracking.example.test/${trackingNumber}` : null,
      created_at: createdAt,
      updated_at: isoDaysFromNow(-(30 - variation)),
    };
  });
  await insertRows("customers", customers);

  const subscriptions = fixtures
    .filter((fixture) => fixture.scenario.subscription !== false)
    .map((fixture) => {
      const { scenario, sequence } = fixture;
      const amounts = fixtureAmounts(fixture);
      const paid = hasCompletedPayment(scenario);
      const trackingNumber = scenario.tracking ? `QA-TRACK-${String(sequence).padStart(5, "0")}` : null;
      return {
        id: fixture.subscriptionId,
        customer_id: fixture.id,
        pricing_plan_id: fixture.primaryPlan.id,
        order_number: fixture.orderNumber,
        status: scenario.order,
        currency: "sek",
        setup_fee_sek: amounts.setupFeeSek,
        base_setup_fee_sek: fixture.primaryPlan.setup_fee_sek,
        setup_included_screens: 3,
        additional_setup_fee_per_screen_sek: 249,
        additional_setup_screen_count: Math.max(0, amounts.screenQuantity - 3),
        hardware_fee_sek: fixture.primaryPlan.hardware_fee_sek,
        shipping_fee_sek: fixture.primaryPlan.shipping_fee_sek,
        monthly_fee_sek: fixture.primaryPlan.monthly_fee_sek,
        trial_days: fixture.primaryPlan.trial_days,
        screen_quantity: fixture.quantity,
        setup_fee_paid: paid,
        tax_status: paid ? "not_enabled" : "not_calculated",
        tax_amount_sek: paid ? amounts.vatOre : null,
        total_amount_sek: paid ? amounts.firstPaymentOre : null,
        stripe_payment_status:
          scenario.payment === "failed" ? "unpaid" : scenario.payment || null,
        fulfillment_status: scenario.fulfillment,
        inventory_status: scenario.inventory || "not_reserved",
        device_discount_percent: amounts.discountPercent,
        device_discount_months: scenario.discount ? 3 : 0,
        device_discount_amount_sek: amounts.deviceDiscount,
        monthly_discount_amount_sek: amounts.monthlyDiscount,
        quote_items: quoteItemRecords(fixture),
        quote_notes: `[${BATCH_ID}] ${scenario.label}`,
        trial_starts_at: scenario.trial ? isoDaysFromNow(-5) : null,
        trial_ends_at: scenario.trial ? isoDaysFromNow(16) : null,
        stripe_current_period_start: paid ? isoDaysFromNow(-5) : null,
        stripe_current_period_end: paid ? isoDaysFromNow(25) : null,
        cancel_at_period_end: Boolean(scenario.cancelAtPeriodEnd),
        cancellation_effective_at: scenario.cancelAtPeriodEnd ? isoDaysFromNow(25) : null,
        pause_started_at: scenario.paused ? isoDaysFromNow(-3) : null,
        pause_resumes_at: scenario.paused ? isoDaysFromNow(11) : null,
        pause_reason: scenario.paused ? "QA seasonal pause" : null,
        tracking_number: trackingNumber,
        tracking_url: trackingNumber ? `https://tracking.example.test/${trackingNumber}` : null,
        hardware_prepared_at: ["ready_to_ship", "shipped"].includes(scenario.fulfillment) ? isoDaysFromNow(-3) : null,
        shipped_at: scenario.tracking ? isoDaysFromNow(-1) : null,
        content_approved_at: scenario.preview === "approved" ? isoDaysFromNow(-9) : null,
        activated_at: scenario.customer === "active" ? isoDaysFromNow(-7) : null,
        created_at: isoDaysFromNow(-(125 - sequence)),
        updated_at: isoDaysFromNow(-Math.max(0, 15 - fixture.variation)),
      };
    });
  await insertRows("customer_subscriptions", subscriptions);

  const devices = [];
  const playlists = [];
  const inventory = [];
  let deviceSequence = 1;
  for (const fixture of fixtures.filter((item) => item.scenario.devices)) {
    const deviceCount = fixture.scenario.devices === "all" ? fixture.quantity : 1;
    for (let deviceIndex = 0; deviceIndex < deviceCount; deviceIndex += 1) {
      const id = deterministicUuid(`device-${deviceSequence}`);
      const code = `Q${String(deviceSequence).padStart(5, "0")}`;
      const serial = `QA-SCR-${String(deviceSequence).padStart(6, "0")}`;
      devices.push({
        id,
        customer_id: fixture.id,
        device_code: code,
        name: `QA display ${deviceIndex + 1}`,
        is_active: !["cancelled", "refunded", "suspended"].includes(fixture.scenario.customer),
        make: "Screenia QA",
        model: fixture.primaryPlan.code === "premium_4k" ? "QA-4K" : "QA-FHD",
        serial_number: serial,
        purchase_cost: fixture.primaryPlan.hardware_fee_sek,
        purchase_date: isoDaysFromNow(-120).slice(0, 10),
        warranty_period_months: 24,
        supplier: "QA Fixture Supplier",
        location: cities[fixture.variation],
        internal_notes: `[${BATCH_ID}] Fictional assigned device.`,
        inventory_status: fixture.scenario.inventory || "assigned",
        stock_location: fixture.scenario.inventory === "returned" ? "Returns shelf" : "Customer site",
        assigned_at: isoDaysFromNow(-12),
        purchase_currency: "sek",
        last_seen_at: fixture.scenario.playlist ? isoDaysFromNow(0) : null,
        created_at: isoDaysFromNow(-60),
        updated_at: isoDaysFromNow(-1),
      });
      inventory.push({
        id: deterministicUuid(`inventory-${deviceSequence}`),
        item_code: `QA${String(deviceSequence).padStart(6, "0")}`,
        item_type: fixture.primaryPlan.code,
        status: fixture.scenario.inventory || "assigned",
        condition: fixture.scenario.inventory === "returned" ? "used" : "new",
        make: "Screenia QA",
        model: fixture.primaryPlan.code === "premium_4k" ? "QA-4K" : "QA-FHD",
        serial_number: serial,
        seller: "QA Fixture Supplier",
        purchase_cost: fixture.primaryPlan.hardware_fee_sek,
        purchase_currency: "sek",
        purchase_date: isoDaysFromNow(-120).slice(0, 10),
        warranty_period_months: 24,
        warranty_until: isoDaysFromNow(610).slice(0, 10),
        accessories: ["Power adapter", "HDMI cable"],
        customer_id: fixture.id,
        device_id: id,
        assigned_at: isoDaysFromNow(-12),
        shipped_at: fixture.scenario.tracking ? isoDaysFromNow(-1) : null,
        notes: `[${BATCH_ID}] Fictional linked inventory item.`,
        created_at: isoDaysFromNow(-120),
        updated_at: isoDaysFromNow(-1),
      });
      if (fixture.scenario.playlist) {
        playlists.push({
          id: deterministicUuid(`playlist-${deviceSequence}`),
          device_id: id,
          type: "image",
          src: `${appUrl}/brand/screenia-helper.png`,
          duration: 12,
          order_index: 1,
          created_at: isoDaysFromNow(-6),
          updated_at: isoDaysFromNow(-1),
        });
      }
      deviceSequence += 1;
    }
  }
  await insertRows("devices", devices);
  await insertRows("playlists", playlists);
  await insertRows("inventory_items", inventory);

  const messages = fixtures
    .filter((fixture) => fixture.scenario.support)
    .map((fixture) => {
      const status = ["new", "open", "waiting_customer", "resolved", "closed"][fixture.variation];
      return {
        id: deterministicUuid(`message-${fixture.sequence}`),
        customer_id: fixture.id,
        ticket_number: `QA-TKT-${String(fixture.sequence).padStart(5, "0")}`,
        request_type: ["technical", "billing", "content", "delivery", "general"][fixture.variation],
        priority: ["urgent", "high", "normal", "normal", "low"][fixture.variation],
        subject: `QA support case: ${status}`,
        message: `Fictional customer message for ${BATCH_ID}. No real response is required.`,
        status,
        admin_note: fixture.variation >= 2 ? "QA admin follow-up recorded." : null,
        admin_note_updated_at: fixture.variation >= 2 ? isoDaysFromNow(-1) : null,
        resolved_at: ["resolved", "closed"].includes(status) ? isoDaysFromNow(-1) : null,
        created_at: isoDaysFromNow(-5 + fixture.variation),
        updated_at: isoDaysFromNow(-1),
      };
    });
  await insertRows("customer_messages", messages);

  const refundCases = fixtures
    .filter((fixture) => fixture.scenario.refund)
    .map((fixture) => {
      const amounts = fixtureAmounts(fixture);
      const isFull = fixture.scenario.refund === "full";
      return {
        id: deterministicUuid(`refund-${fixture.sequence}`),
        customer_id: fixture.id,
        customer_subscription_id: fixture.subscriptionId,
        order_number: fixture.orderNumber,
        request_type: isFull ? "full" : "partial",
        requested_amount_ore: isFull ? amounts.firstPaymentOre : Math.round(amounts.firstPaymentOre / 3),
        approved_amount_ore: isFull ? amounts.firstPaymentOre : null,
        currency: "sek",
        customer_reason: isFull
          ? "QA cancellation before layout work started."
          : "QA goodwill request after layout work started.",
        admin_decision: isFull ? "approved_full" : "pending",
        admin_reason: isFull ? "QA refund policy boundary verified." : null,
        status: isFull ? "closed" : "open",
        requested_at: isoDaysFromNow(-4),
        decided_at: isFull ? isoDaysFromNow(-3) : null,
        created_at: isoDaysFromNow(-4),
        updated_at: isoDaysFromNow(-3),
      };
    });
  await insertRows("customer_refund_cases", refundCases);

  const adjustments = fixtures
    .filter((fixture) => fixture.scenario.discount)
    .map((fixture) => ({
      id: deterministicUuid(`adjustment-${fixture.sequence}`),
      customer_id: fixture.id,
      customer_subscription_id: fixture.subscriptionId,
      stripe_subscription_id: `qa_no_stripe_${fixture.orderNumber}`,
      adjustment_type: "temporary_discount",
      percent_off: 20,
      duration_months: 3,
      reason: `[${BATCH_ID}] Fictional retention discount.`,
      status: fixture.variation === 4 ? "ended" : "active",
      created_at: isoDaysFromNow(-10),
      updated_at: isoDaysFromNow(-1),
      ended_at: fixture.variation === 4 ? isoDaysFromNow(-1) : null,
    }));
  await insertRows("subscription_adjustments", adjustments);

  const legalFixtures = fixtures.filter(
    (fixture) => fixture.scenario.accepted && fixture.variation === 0,
  );
  const consentRows = legalFixtures.flatMap((fixture) => [
    {
      id: deterministicUuid(`consent-terms-${fixture.sequence}`),
      customer_id: fixture.id,
      consent_type: "terms",
      granted: true,
      statement: "QA acceptance of Screenia terms.",
      document_name: "Terms of service",
      document_version: "qa-v1",
      collection_point: "qa_fixture",
      created_at: isoDaysFromNow(-20),
    },
    {
      id: deterministicUuid(`consent-privacy-${fixture.sequence}`),
      customer_id: fixture.id,
      consent_type: "privacy",
      granted: true,
      statement: "QA acknowledgement of Screenia privacy notice.",
      document_name: "Privacy notice",
      document_version: "qa-v1",
      collection_point: "qa_fixture",
      created_at: isoDaysFromNow(-20),
    },
  ]);
  await insertRows("consent_records", consentRows);

  return {
    fixtures,
    subscriptions,
    devices,
    playlists,
    inventory,
    messages,
    refundCases,
    adjustments,
    accounts: authIds.size,
    consents: consentRows.length,
  };
}

async function verifyFixtures() {
  const customers = await qaCustomers();
  const ids = customers.map((customer) => customer.id);
  const counts = { customers: customers.length };
  for (const table of [
    "customer_subscriptions",
    "devices",
    "customer_messages",
    "customer_refund_cases",
    "subscription_adjustments",
    "consent_records",
    "audit_events",
  ]) {
    if (ids.length === 0) {
      counts[table] = 0;
      continue;
    }
    const { count, error } = await supabase
      .from(table)
      .select("*", { count: "exact", head: true })
      .in("customer_id", ids);
    if (error) throw new Error(`${table} verification failed: ${error.message}`);
    counts[table] = count || 0;
  }

  const { count: inventoryCount, error: inventoryError } = await supabase
    .from("inventory_items")
    .select("*", { count: "exact", head: true })
    .like("notes", `%[${BATCH_ID}]%`);
  if (inventoryError) throw new Error(`Inventory verification failed: ${inventoryError.message}`);
  counts.inventory_items = inventoryCount || 0;

  const { data: scenarioRows, error: scenarioError } = await supabase
    .from("customers")
    .select("status,payment_status,service_access_status")
    .like("email", EMAIL_PATTERN);
  if (scenarioError) throw new Error(`Scenario verification failed: ${scenarioError.message}`);

  const { data: subscriptions, error: subscriptionError } = ids.length
    ? await supabase
        .from("customer_subscriptions")
        .select("id,customer_id,order_number,setup_fee_sek,total_amount_sek,tax_amount_sek,device_discount_amount_sek,quote_items,created_at,updated_at")
        .in("customer_id", ids)
    : { data: [], error: null };
  if (subscriptionError) {
    throw new Error(`Subscription invariant verification failed: ${subscriptionError.message}`);
  }

  const { data: devices, error: deviceError } = ids.length
    ? await supabase.from("devices").select("id,device_code,customer_id").in("customer_id", ids)
    : { data: [], error: null };
  if (deviceError) throw new Error(`Device invariant verification failed: ${deviceError.message}`);

  const { data: inventory, error: inventoryLinkError } = await supabase
    .from("inventory_items")
    .select("id,item_code,device_id,customer_id")
    .like("notes", `%[${BATCH_ID}]%`);
  if (inventoryLinkError) {
    throw new Error(`Inventory invariant verification failed: ${inventoryLinkError.message}`);
  }

  const { data: authData, error: authError } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (authError) throw new Error(`Auth fixture verification failed: ${authError.message}`);

  const { data: detachedAudits, error: detachedAuditError } = await supabase
    .from("audit_events")
    .select("id,metadata")
    .is("customer_id", null)
    .eq("event_type", "customers_delete");
  if (detachedAuditError) {
    throw new Error(`Detached audit verification failed: ${detachedAuditError.message}`);
  }

  const duplicateCount = (values) =>
    values.length - new Set(values.filter(Boolean)).size;
  const customerById = new Map(customers.map((customer) => [customer.id, customer]));
  let totalMismatches = 0;
  let vatMismatches = 0;
  let orderBeforeCustomer = 0;
  let orderUpdatedBeforeCreated = 0;
  let futureOrders = 0;
  const now = Date.now();

  for (const subscription of subscriptions || []) {
    const customer = customerById.get(subscription.customer_id);
    if (customer && Date.parse(subscription.created_at) < Date.parse(customer.created_at)) {
      orderBeforeCustomer += 1;
    }
    if (Date.parse(subscription.updated_at) < Date.parse(subscription.created_at)) {
      orderUpdatedBeforeCreated += 1;
    }
    if (Date.parse(subscription.created_at) > now) futureOrders += 1;

    if (subscription.total_amount_sek === null) continue;
    const itemTotal = (Array.isArray(subscription.quote_items) ? subscription.quote_items : [])
      .reduce(
        (sum, item) =>
          sum +
          ((Number(item.hardwareFeeSek) || 0) + (Number(item.shippingFeeSek) || 0)) *
            (Number(item.quantity) || 1),
        0,
      );
    const expectedTotal =
      (subscription.setup_fee_sek + itemTotal - (subscription.device_discount_amount_sek || 0)) * 100;
    if (subscription.total_amount_sek !== expectedTotal) totalMismatches += 1;
    const expectedVat = expectedTotal - Math.round(expectedTotal / 1.25);
    if (subscription.tax_amount_sek !== expectedVat) vatMismatches += 1;
  }

  const invariants = {
    qaAuthAccounts: authData.users.filter(
      (user) => user.user_metadata?.qa_seed_batch === BATCH_ID,
    ).length,
    duplicateCustomerNumbers: duplicateCount(customers.map((customer) => customer.customer_number)),
    duplicateEmails: duplicateCount(customers.map((customer) => customer.email)),
    duplicateOrderNumbers: duplicateCount((subscriptions || []).map((subscription) => subscription.order_number)),
    duplicateDeviceCodes: duplicateCount((devices || []).map((device) => device.device_code)),
    duplicateInventoryCodes: duplicateCount((inventory || []).map((item) => item.item_code)),
    totalMismatches,
    vatMismatches,
    unlinkedInventory: (inventory || []).filter((item) => !item.customer_id || !item.device_id).length,
    missingBatchMarker: customers.filter((customer) => !customer.notes?.includes(BATCH_ID)).length,
    customerUpdatedBeforeCreated: customers.filter(
      (customer) => Date.parse(customer.updated_at) < Date.parse(customer.created_at),
    ).length,
    futureCustomers: customers.filter((customer) => Date.parse(customer.created_at) > now).length,
    orderBeforeCustomer,
    orderUpdatedBeforeCreated,
    futureOrders,
    staleDetachedQaAudits: (detachedAudits || []).filter((event) => {
      const oldRow = event.metadata?.old;
      return oldRow?.notes?.includes(BATCH_ID) || oldRow?.email?.endsWith("@example.test");
    }).length,
  };

  const statusCounts = Object.fromEntries(
    Object.entries(
      (scenarioRows || []).reduce((result, row) => {
        const key = row.status || "none";
        result[key] = (result[key] || 0) + 1;
        return result;
      }, {}),
    ).sort(([left], [right]) => left.localeCompare(right)),
  );

  const required = {
    customers: 100,
    customer_subscriptions: 95,
    customer_messages: 5,
    customer_refund_cases: 10,
    subscription_adjustments: 5,
  };
  const failures = Object.entries(required).filter(
    ([key, expected]) => counts[key] !== expected,
  );
  failures.push(
    ...Object.entries(invariants)
      .filter(([key, value]) => key !== "qaAuthAccounts" && value !== 0)
      .map(([key, value]) => [key, `expected 0, received ${value}`]),
  );
  if (invariants.qaAuthAccounts !== 10) {
    failures.push(["qaAuthAccounts", `expected 10, received ${invariants.qaAuthAccounts}`]);
  }

  return { counts, statusCounts, invariants, failures };
}

if (command === "clean") {
  const removed = await cleanFixtures();
  console.log(JSON.stringify({ batch: BATCH_ID, removedCustomers: removed }, null, 2));
} else if (command === "seed") {
  const seeded = await seedFixtures();
  const verification = await verifyFixtures();
  if (verification.failures.length > 0) {
    throw new Error(`QA verification failed: ${JSON.stringify(verification.failures)}`);
  }
  console.log(
    JSON.stringify(
      {
        batch: BATCH_ID,
        scenarios: scenarios.length,
        variationsPerScenario: 5,
        accounts: seeded.accounts,
        qaLogin: {
          email: "qa.customer.041@example.test",
          password: QA_PASSWORD,
        },
        ...verification,
      },
      null,
      2,
    ),
  );
} else {
  const verification = await verifyFixtures();
  console.log(JSON.stringify({ batch: BATCH_ID, ...verification }, null, 2));
  if (verification.failures.length > 0) process.exitCode = 1;
}
