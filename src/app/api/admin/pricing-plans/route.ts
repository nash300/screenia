import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { getRequestIp, recordAuditEvent } from "@/lib/server/audit";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-04-22.dahlia",
});

type PricingPlan = {
  id: string;
  code: string;
  name: string;
  resolution: string;
  setup_fee_sek: number;
  hardware_fee_sek: number | null;
  shipping_fee_sek: number | null;
  monthly_fee_sek: number;
  trial_days: number;
  binding_months: number | null;
  currency: string | null;
  tax_behavior: "exclusive" | "inclusive" | "unspecified" | null;
  is_active: boolean;
  stripe_setup_price_id: string | null;
  stripe_hardware_price_id: string | null;
  stripe_shipping_price_id: string | null;
  stripe_monthly_price_id: string | null;
  updated_at: string | null;
};

type StripePriceField =
  | "stripe_setup_price_id"
  | "stripe_hardware_price_id"
  | "stripe_shipping_price_id"
  | "stripe_monthly_price_id";

type PriceSpec = {
  field: StripePriceField;
  amountSek: number;
  name: string;
  description?: string;
  recurring?: {
    interval: "day" | "week" | "month" | "year";
  };
};

async function getAuthenticatedAdmin() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user?.app_metadata?.role === "admin" ? user : null;
}

function toOre(amountSek: number) {
  return Math.round(amountSek * 100);
}

function sanitizeAmount(value: unknown, fallback = 0) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return fallback;
  return Math.max(0, Math.round(numberValue));
}

function sanitizeDays(value: unknown, fallback = 0) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return fallback;
  return Math.max(0, Math.min(365, Math.round(numberValue)));
}

function getAdminReason(value: unknown) {
  return String(value || "").trim();
}

function requireAdminReason(reason: string) {
  return reason.length >= 5 && reason.length <= 1000;
}

async function getPlan(planId: string) {
  return supabaseAdmin
    .from("pricing_plans")
    .select("*")
    .eq("id", planId)
    .single<PricingPlan>();
}

async function ensureProduct({
  existingPriceId,
  name,
  metadata,
}: {
  existingPriceId: string | null;
  name: string;
  metadata: Record<string, string>;
}) {
  if (existingPriceId) {
    try {
      const existingPrice = await stripe.prices.retrieve(existingPriceId, {
        expand: ["product"],
      });

      if (
        existingPrice.product &&
        typeof existingPrice.product !== "string" &&
        !existingPrice.product.deleted
      ) {
        await stripe.products.update(existingPrice.product.id, {
          name,
          metadata,
          active: true,
        });

        return existingPrice.product.id;
      }
    } catch (error) {
      console.warn("Could not reuse Stripe product from existing price.", error);
    }
  }

  const product = await stripe.products.create({
    name,
    metadata,
  });

  return product.id;
}

async function ensurePrice({
  plan,
  spec,
}: {
  plan: PricingPlan;
  spec: PriceSpec;
}) {
  const currency = (plan.currency || "sek").toLowerCase();
  const unitAmount = toOre(spec.amountSek);
  const existingPriceId = plan[spec.field];

  if (existingPriceId) {
    try {
      const existingPrice = await stripe.prices.retrieve(existingPriceId);
      const recurringMatches = spec.recurring
        ? existingPrice.recurring?.interval === spec.recurring.interval
        : !existingPrice.recurring;

      if (
        existingPrice.active &&
        existingPrice.currency === currency &&
        existingPrice.unit_amount === unitAmount &&
        existingPrice.tax_behavior === (plan.tax_behavior || "inclusive") &&
        recurringMatches
      ) {
        return existingPrice.id;
      }
    } catch (error) {
      console.warn("Could not retrieve existing Stripe price.", error);
    }
  }

  const productId = await ensureProduct({
    existingPriceId,
    name: spec.name,
    metadata: {
      pricing_plan_id: plan.id,
      pricing_plan_code: plan.code,
      price_field: spec.field,
    },
  });

  const price = await stripe.prices.create({
    currency,
    unit_amount: unitAmount,
    recurring: spec.recurring,
    tax_behavior: plan.tax_behavior || "inclusive",
    product: productId,
    metadata: {
      pricing_plan_id: plan.id,
      pricing_plan_code: plan.code,
      price_field: spec.field,
    },
  });

  return price.id;
}

export async function GET() {
  const user = await getAuthenticatedAdmin();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("pricing_plans")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    console.error("Load pricing plans error:", error);
    return NextResponse.json(
      { error: "Could not load pricing plans." },
      { status: 500 },
    );
  }

  return NextResponse.json({ plans: data || [] });
}

export async function PATCH(request: Request) {
  const user = await getAuthenticatedAdmin();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const planId = String(body.planId || "");
  const reason = getAdminReason(body.reason);
  if (!planId) {
    return NextResponse.json({ error: "Missing pricing plan id." }, { status: 400 });
  }

  if (!requireAdminReason(reason)) {
    return NextResponse.json(
      { error: "A pricing change reason between 5 and 1000 characters is required." },
      { status: 400 },
    );
  }

  const { data: currentPlan, error: currentError } = await getPlan(planId);
  if (currentError || !currentPlan) {
    return NextResponse.json({ error: "Pricing plan not found." }, { status: 404 });
  }

  const update = {
    setup_fee_sek: sanitizeAmount(body.setupFeeSek, currentPlan.setup_fee_sek),
    hardware_fee_sek: sanitizeAmount(
      body.hardwareFeeSek,
      currentPlan.hardware_fee_sek ?? 0,
    ),
    shipping_fee_sek: sanitizeAmount(
      body.shippingFeeSek,
      currentPlan.shipping_fee_sek ?? 0,
    ),
    monthly_fee_sek: sanitizeAmount(body.monthlyFeeSek, currentPlan.monthly_fee_sek),
    trial_days: sanitizeDays(body.trialDays, currentPlan.trial_days),
    binding_months: sanitizeDays(body.bindingMonths, currentPlan.binding_months ?? 0),
    is_active: Boolean(body.isActive),
  };

  const { data: updatedPlan, error } = await supabaseAdmin
    .from("pricing_plans")
    .update(update)
    .eq("id", planId)
    .select("*")
    .single<PricingPlan>();

  if (error || !updatedPlan) {
    console.error("Update pricing plan error:", error);
    return NextResponse.json(
      { error: "Could not update pricing plan." },
      { status: 500 },
    );
  }

  await recordAuditEvent(supabaseAdmin, {
    actorType: "admin",
    actorId: user.id,
    eventType: "pricing_plan_updated",
    eventDescription: "Admin updated a pricing plan.",
    metadata: {
      planId,
      planCode: currentPlan.code,
      before: {
        setupFeeSek: currentPlan.setup_fee_sek,
        hardwareFeeSek: currentPlan.hardware_fee_sek,
        shippingFeeSek: currentPlan.shipping_fee_sek,
        monthlyFeeSek: currentPlan.monthly_fee_sek,
        trialDays: currentPlan.trial_days,
      },
      after: update,
      reason,
    },
    ipAddress: getRequestIp(request),
    userAgent: request.headers.get("user-agent"),
  });

  return NextResponse.json({ plan: updatedPlan });
}

export async function POST(request: Request) {
  const user = await getAuthenticatedAdmin();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const planId = String(body.planId || "");
  const reason = getAdminReason(body.reason);
  if (!planId) {
    return NextResponse.json({ error: "Missing pricing plan id." }, { status: 400 });
  }

  if (!requireAdminReason(reason)) {
    return NextResponse.json(
      { error: "A Stripe price sync reason between 5 and 1000 characters is required." },
      { status: 400 },
    );
  }

  const { data: plan, error: planError } = await getPlan(planId);
  if (planError || !plan) {
    return NextResponse.json({ error: "Pricing plan not found." }, { status: 404 });
  }

  const hardwareFeeSek = plan.hardware_fee_sek ?? 0;
  const shippingFeeSek = plan.shipping_fee_sek ?? 0;
  const baseName = `Screenia ${plan.name} ${plan.resolution}`;
  const specs: PriceSpec[] = [
    {
      field: "stripe_setup_price_id",
      amountSek: plan.setup_fee_sek,
      name: `${baseName} setup`,
      description: "One-time setup and configuration fee.",
    },
    ...(hardwareFeeSek > 0
      ? [
          {
            field: "stripe_hardware_price_id" as const,
            amountSek: hardwareFeeSek,
            name: `${baseName} screen device`,
          },
        ]
      : []),
    {
      field: "stripe_shipping_price_id",
      amountSek: shippingFeeSek,
      name: `${baseName} shipping`,
    },
    {
      field: "stripe_monthly_price_id",
      amountSek: plan.monthly_fee_sek,
      name: `${baseName} monthly subscription`,
      recurring: { interval: "month" },
    },
  ];

  const stripeIds: Record<StripePriceField, string | null> = {
    stripe_setup_price_id: plan.stripe_setup_price_id || "",
    stripe_hardware_price_id:
      hardwareFeeSek > 0 ? plan.stripe_hardware_price_id || "" : null,
    stripe_shipping_price_id: plan.stripe_shipping_price_id || "",
    stripe_monthly_price_id: plan.stripe_monthly_price_id || "",
  };

  for (const spec of specs) {
    stripeIds[spec.field] = await ensurePrice({ plan, spec });
  }

  const { data: updatedPlan, error: updateError } = await supabaseAdmin
    .from("pricing_plans")
    .update(stripeIds)
    .eq("id", plan.id)
    .select("*")
    .single<PricingPlan>();

  if (updateError || !updatedPlan) {
    console.error("Store synced Stripe prices error:", updateError);
    return NextResponse.json(
      { error: "Stripe prices were created, but Supabase could not be updated." },
      { status: 500 },
    );
  }

  await recordAuditEvent(supabaseAdmin, {
    actorType: "admin",
    actorId: user.id,
    eventType: "pricing_plan_stripe_synced",
    eventDescription: "Admin synced a pricing plan to Stripe prices.",
    metadata: {
      planId: plan.id,
      planCode: plan.code,
      stripePriceIds: stripeIds,
      reason,
    },
    ipAddress: getRequestIp(request),
    userAgent: request.headers.get("user-agent"),
  });

  return NextResponse.json({ plan: updatedPlan, stripePriceIds: stripeIds });
}
