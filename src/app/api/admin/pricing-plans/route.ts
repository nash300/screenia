import {
  getAuthenticatedAdmin,
  supabaseAdmin,
} from "@/lib/server/admin-api";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getRequestIp, recordAuditEvent } from "@/lib/server/audit";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-04-22.dahlia",
});

type PricingPlan = {
  id: string;
  code: string;
  name: string;
  resolution: string;
  setup_fee_sek: number;
  setup_included_screens: number;
  additional_setup_fee_sek: number;
  hardware_fee_sek: number | null;
  shipping_fee_sek: number | null;
  shipping_included_devices: number;
  additional_shipping_fee_sek: number;
  monthly_fee_sek: number;
  trial_days: number;
  binding_months: number | null;
  currency: string | null;
  tax_behavior: "exclusive" | "inclusive" | "unspecified" | null;
  is_active: boolean;
  stripe_setup_price_id: string | null;
  stripe_additional_setup_price_id: string | null;
  stripe_hardware_price_id: string | null;
  stripe_shipping_price_id: string | null;
  stripe_additional_shipping_price_id: string | null;
  stripe_monthly_price_id: string | null;
  updated_at: string | null;
};

type StripePriceField =
  | "stripe_setup_price_id"
  | "stripe_additional_setup_price_id"
  | "stripe_hardware_price_id"
  | "stripe_shipping_price_id"
  | "stripe_additional_shipping_price_id"
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
    shipping_included_devices: Math.max(
      1,
      sanitizeAmount(
        body.shippingIncludedDevices,
        currentPlan.shipping_included_devices ?? 3,
      ),
    ),
    additional_shipping_fee_sek: sanitizeAmount(
      body.additionalShippingFeeSek,
      currentPlan.additional_shipping_fee_sek ?? 29,
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
        shippingIncludedDevices: currentPlan.shipping_included_devices,
        additionalShippingFeeSek: currentPlan.additional_shipping_fee_sek,
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
  if (!plan.stripe_additional_setup_price_id) {
    const { data: sharedSetupRule } = await supabaseAdmin
      .from("pricing_plans")
      .select("stripe_additional_setup_price_id")
      .not("stripe_additional_setup_price_id", "is", null)
      .eq("additional_setup_fee_sek", plan.additional_setup_fee_sek)
      .limit(1)
      .maybeSingle();
    plan.stripe_additional_setup_price_id =
      sharedSetupRule?.stripe_additional_setup_price_id || null;
  }
  if (!plan.stripe_additional_shipping_price_id) {
    const { data: sharedShippingRule } = await supabaseAdmin
      .from("pricing_plans")
      .select("stripe_additional_shipping_price_id")
      .not("stripe_additional_shipping_price_id", "is", null)
      .eq("additional_shipping_fee_sek", plan.additional_shipping_fee_sek)
      .limit(1)
      .maybeSingle();
    plan.stripe_additional_shipping_price_id =
      sharedShippingRule?.stripe_additional_shipping_price_id || null;
  }
  const specs: PriceSpec[] = [
    {
      field: "stripe_setup_price_id",
      amountSek: plan.setup_fee_sek,
      name: `${baseName} - start och konfiguration (upp till ${plan.setup_included_screens} skärmar)`,
      description: "Grundavgift för start och konfiguration.",
    },
    {
      field: "stripe_additional_setup_price_id",
      amountSek: plan.additional_setup_fee_sek,
      name: "Screenia extra skärm - start och konfiguration",
      description: `Engångsavgift per skärm utöver de ${plan.setup_included_screens} skärmar som ingår i grundavgiften.`,
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
      name: `Screenia frakt inom Sverige (upp till ${plan.shipping_included_devices} enheter)`,
    },
    {
      field: "stripe_additional_shipping_price_id",
      amountSek: plan.additional_shipping_fee_sek,
      name: "Screenia frakt för extra enhet",
      description: `Frakt per enhet utöver de ${plan.shipping_included_devices} som ingår i grundfrakten.`,
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
    stripe_additional_setup_price_id:
      plan.stripe_additional_setup_price_id || "",
    stripe_hardware_price_id:
      hardwareFeeSek > 0 ? plan.stripe_hardware_price_id || "" : null,
    stripe_shipping_price_id: plan.stripe_shipping_price_id || "",
    stripe_additional_shipping_price_id:
      plan.stripe_additional_shipping_price_id || "",
    stripe_monthly_price_id: plan.stripe_monthly_price_id || "",
  };

  for (const spec of specs) {
    stripeIds[spec.field] = await ensurePrice({ plan, spec });
  }

  const sharedAdditionalSetupPriceId =
    stripeIds.stripe_additional_setup_price_id;
  if (sharedAdditionalSetupPriceId) {
    const { error: sharedPriceError } = await supabaseAdmin
      .from("pricing_plans")
      .update({
        stripe_additional_setup_price_id: sharedAdditionalSetupPriceId,
      })
      .eq("additional_setup_fee_sek", plan.additional_setup_fee_sek);

    if (sharedPriceError) {
      console.error("Store shared additional setup price error:", sharedPriceError);
      return NextResponse.json(
        {
          error:
            "Stripe prices were created, but the shared additional-screen reference could not be stored.",
        },
        { status: 500 },
      );
    }
  }

  const sharedAdditionalShippingPriceId =
    stripeIds.stripe_additional_shipping_price_id;
  if (sharedAdditionalShippingPriceId) {
    const { error: sharedShippingPriceError } = await supabaseAdmin
      .from("pricing_plans")
      .update({
        stripe_additional_shipping_price_id: sharedAdditionalShippingPriceId,
      })
      .eq("additional_shipping_fee_sek", plan.additional_shipping_fee_sek);

    if (sharedShippingPriceError) {
      console.error("Store shared additional shipping price error:", sharedShippingPriceError);
      return NextResponse.json(
        {
          error:
            "Stripe prices were created, but the shared additional-shipping reference could not be stored.",
        },
        { status: 500 },
      );
    }
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
