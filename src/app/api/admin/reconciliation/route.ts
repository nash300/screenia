import { NextResponse } from "next/server";
import Stripe from "stripe";
import {
  getAuthenticatedAdmin,
  hasAdminPermission,
  supabaseAdmin,
} from "@/lib/server/admin-api";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-08-26.dahlia",
});

type LocalSubscription = {
  id: string;
  customer_id: string;
  order_number: string | null;
  status: string | null;
  stripe_payment_status: string | null;
  screen_quantity: number | null;
  stripe_subscription_id: string;
  updated_at: string | null;
  customers:
    | {
        id: string;
        name: string;
        email: string;
        stripe_customer_id: string | null;
        payment_status: string | null;
        service_access_status: string | null;
      }
    | Array<{
        id: string;
        name: string;
        email: string;
        stripe_customer_id: string | null;
        payment_status: string | null;
        service_access_status: string | null;
      }>
    | null;
};

type ReconciliationIssue = {
  severity: "warning" | "urgent";
  code: string;
  message: string;
};

function firstCustomer(value: LocalSubscription["customers"]) {
  return Array.isArray(value) ? value[0] || null : value;
}

export async function GET() {
  const user = await getAuthenticatedAdmin();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  if (!hasAdminPermission(user, "billing.reconcile")) {
    return NextResponse.json(
      { error: "This admin role cannot view billing reconciliation." },
      { status: 403 },
    );
  }

  const { data, error } = await supabaseAdmin
    .from("customer_subscriptions")
    .select(
      "id, customer_id, order_number, status, stripe_payment_status, screen_quantity, stripe_subscription_id, updated_at, customers(id, name, email, stripe_customer_id, payment_status, service_access_status)",
    )
    .not("stripe_subscription_id", "is", null)
    .order("updated_at", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json(
      { error: "Could not load local subscription records." },
      { status: 500 },
    );
  }

  const rows = (data || []) as unknown as LocalSubscription[];
  const results = await Promise.all(
    rows.map(async (row) => {
      const customer = firstCustomer(row.customers);
      const issues: ReconciliationIssue[] = [];

      try {
        const stripeSubscription = await stripe.subscriptions.retrieve(
          row.stripe_subscription_id,
          { expand: ["items.data.price"] },
        );
        const recurringItems = stripeSubscription.items.data.filter((item) => {
          const price = typeof item.price === "string" ? null : item.price;
          return Boolean(price?.recurring);
        });
        const stripeScreenQuantity = recurringItems.reduce(
          (sum, item) => sum + Math.max(0, Number(item.quantity) || 0),
          0,
        );

        if (stripeScreenQuantity !== Number(row.screen_quantity || 0)) {
          issues.push({
            severity: "urgent",
            code: "screen_quantity_mismatch",
            message: `Stripe has ${stripeScreenQuantity} recurring screen(s), while Screenia records ${row.screen_quantity || 0}.`,
          });
        }

        if (stripeSubscription.status !== row.stripe_payment_status) {
          issues.push({
            severity: "warning",
            code: "payment_status_mismatch",
            message: `Stripe status is ${stripeSubscription.status}, while Screenia records ${row.stripe_payment_status || "missing"}.`,
          });
        }

        const stripeCustomerId =
          typeof stripeSubscription.customer === "string"
            ? stripeSubscription.customer
            : stripeSubscription.customer?.id;
        if (customer?.stripe_customer_id !== stripeCustomerId) {
          issues.push({
            severity: "urgent",
            code: "customer_link_mismatch",
            message: "The Stripe customer link does not match the Screenia customer record.",
          });
        }

        if (["canceled", "unpaid", "past_due"].includes(stripeSubscription.status)) {
          if (customer?.service_access_status === "active") {
            issues.push({
              severity: "urgent",
              code: "access_mismatch",
              message: `Stripe is ${stripeSubscription.status}, but Screenia still reports active service access.`,
            });
          }
        }

        return {
          id: row.id,
          customerId: row.customer_id,
          customerName: customer?.name || "Unknown customer",
          customerEmail: customer?.email || "",
          orderNumber: row.order_number,
          stripeSubscriptionId: row.stripe_subscription_id,
          localStatus: row.status,
          localPaymentStatus: row.stripe_payment_status,
          localScreenQuantity: row.screen_quantity,
          stripeStatus: stripeSubscription.status,
          stripeScreenQuantity,
          checkedAt: new Date().toISOString(),
          issues,
        };
      } catch (stripeError) {
        issues.push({
          severity: "urgent",
          code: "stripe_lookup_failed",
          message:
            stripeError instanceof Error
              ? stripeError.message
              : "Stripe subscription could not be retrieved.",
        });

        return {
          id: row.id,
          customerId: row.customer_id,
          customerName: customer?.name || "Unknown customer",
          customerEmail: customer?.email || "",
          orderNumber: row.order_number,
          stripeSubscriptionId: row.stripe_subscription_id,
          localStatus: row.status,
          localPaymentStatus: row.stripe_payment_status,
          localScreenQuantity: row.screen_quantity,
          stripeStatus: null,
          stripeScreenQuantity: null,
          checkedAt: new Date().toISOString(),
          issues,
        };
      }
    }),
  );

  return NextResponse.json({
    checkedAt: new Date().toISOString(),
    summary: {
      checked: results.length,
      healthy: results.filter((item) => item.issues.length === 0).length,
      warnings: results.filter((item) => item.issues.some((issue) => issue.severity === "warning")).length,
      urgent: results.filter((item) => item.issues.some((issue) => issue.severity === "urgent")).length,
    },
    results,
  });
}
