import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

const confirmed = process.argv.includes("--confirm-screenia-reset");
const skipStripe = process.argv.includes("--skip-stripe");

if (!confirmed) {
  throw new Error("Testing reset requires --confirm-screenia-reset.");
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const stripeSecretKey = process.env.STRIPE_SECRET_KEY?.trim();

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ZERO_UUID = "00000000-0000-0000-0000-000000000000";

const customerScopedTables = [
  "billing_email_dispatches",
  "playlists",
  "customer_message_files",
  "customer_messages",
  "customer_display_assets",
  "customer_preview_decisions",
  "customer_legal_agreements",
  "consent_records",
  "customer_refund_cases",
  "subscription_adjustments",
  "customer_subscriptions",
  "inventory_events",
  "inventory_items",
  "videos",
  "devices",
  "admin_notifications",
  "audit_events",
];

const globalOperationalTables = [
  "contact_inquiry_replies",
  "contact_inquiries",
  "resend_delivery_events",
  "stripe_webhook_events",
  "admin_operation_test_results",
  "admin_operation_test_runs",
  "admin_operation_test_evidence",
];

const removedComplianceTables = [
  "admin_access_reviews",
  "backup_restore_drills",
  "data_retention_reviews",
  "data_subject_requests",
  "legal_change_notices",
  "privacy_incidents",
  "processor_compliance_reviews",
  "tax_payments",
];

const storageBucketsToClear = [
  "videos",
  "customer-display-assets",
  "customer-message-files",
];

function chunks(items, size = 100) {
  const result = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

async function tableExists(table) {
  const { error } = await supabase.from(table).select("id").limit(1);
  return !error;
}

async function deleteAllFromTable(table) {
  if (!(await tableExists(table))) {
    return { table, skipped: true, deleted: null };
  }

  const { count, error } = await supabase
    .from(table)
    .delete({ count: "exact" })
    .neq("id", ZERO_UUID);

  if (error) throw new Error(`Could not clear ${table}: ${error.message}`);
  return { table, skipped: false, deleted: count ?? 0 };
}

async function deleteCustomersAndAuthUsers() {
  const { data: customers, error } = await supabase
    .from("customers")
    .select("id, auth_user_id, email")
    .neq("id", ZERO_UUID);

  if (error) throw new Error(`Could not list customers: ${error.message}`);

  const authUserIds = [...new Set((customers || []).map((row) => row.auth_user_id).filter(Boolean))];

  const { count, error: customerDeleteError } = await supabase
    .from("customers")
    .delete({ count: "exact" })
    .neq("id", ZERO_UUID);

  if (customerDeleteError) {
    throw new Error(`Could not clear customers: ${customerDeleteError.message}`);
  }

  let deletedAuthUsers = 0;
  for (const userId of authUserIds) {
    const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);
    if (deleteError) {
      throw new Error(`Could not delete customer auth user ${userId}: ${deleteError.message}`);
    }
    deletedAuthUsers += 1;
  }

  return { customers: customerDeleteError ? 0 : count ?? 0, authUsers: deletedAuthUsers };
}

async function listStoragePaths(bucket, prefix = "") {
  const paths = [];
  const { data, error } = await supabase.storage.from(bucket).list(prefix, { limit: 1000 });
  if (error) return paths;

  for (const item of data || []) {
    const path = prefix ? `${prefix}/${item.name}` : item.name;
    if (item.id === null) {
      paths.push(...(await listStoragePaths(bucket, path)));
    } else {
      paths.push(path);
    }
  }

  return paths;
}

async function clearStorageBucket(bucket) {
  const paths = await listStoragePaths(bucket);
  let removed = 0;
  for (const part of chunks(paths)) {
    const { error } = await supabase.storage.from(bucket).remove(part);
    if (error) throw new Error(`Could not clear storage bucket ${bucket}: ${error.message}`);
    removed += part.length;
  }
  return { bucket, removed };
}

async function deleteStripeTestCustomers() {
  if (skipStripe) return { skipped: true, deletedCustomers: 0 };
  if (!stripeSecretKey?.startsWith("sk_test_")) {
    throw new Error("Stripe reset requires a test-mode STRIPE_SECRET_KEY. Use --skip-stripe to skip Stripe.");
  }

  const stripe = new Stripe(stripeSecretKey, { apiVersion: "2026-04-22.dahlia" });
  let deletedCustomers = 0;

  for await (const customer of stripe.customers.list({ limit: 100 })) {
    if (customer.deleted) continue;
    await stripe.customers.del(customer.id);
    deletedCustomers += 1;
  }

  return { skipped: false, deletedCustomers };
}

async function main() {
  const deleted = [];

  for (const table of [...customerScopedTables, ...globalOperationalTables, ...removedComplianceTables]) {
    deleted.push(await deleteAllFromTable(table));
  }

  const customers = await deleteCustomersAndAuthUsers();

  deleted.push(await deleteAllFromTable("audit_events"));

  const storage = [];
  for (const bucket of storageBucketsToClear) {
    storage.push(await clearStorageBucket(bucket));
  }

  const stripe = await deleteStripeTestCustomers();

  console.log(JSON.stringify({ deleted, customers, storage, stripe }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
