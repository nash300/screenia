import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { getRequestIp, recordAuditEvent } from "@/lib/server/audit";
import { createAdminNotification } from "@/lib/server/admin-notifications";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const ASSET_STATUSES = new Set(["new", "reviewed", "archived"]);

type CustomerAssetRow = {
  id: string;
  customer_id: string;
  file_name: string | null;
  content_type: string | null;
  file_size: number | null;
  storage_bucket: string | null;
  storage_path: string | null;
  asset_category: string | null;
  description: string | null;
  source: string | null;
  status: string | null;
  admin_note?: string | null;
  admin_note_updated_at?: string | null;
  reviewed_at?: string | null;
  created_at: string;
  customers?: { name?: string | null; email?: string | null } | Array<{
    name?: string | null;
    email?: string | null;
  }> | null;
};

type CustomerAssetUpdatePayload = {
  assetId?: string;
  customerId?: string;
  status?: string;
  adminNote?: string;
  reason?: string;
};

function normalizeAssetStatus(status: string | null) {
  return ASSET_STATUSES.has(status || "") ? status : "new";
}

function getReason(value: unknown) {
  return String(value || "").trim().slice(0, 1000);
}

function changedFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
) {
  return Object.entries(after)
    .filter(([key, value]) => before[key] !== value)
    .map(([key]) => key);
}

async function getAuthenticatedUser() {
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

  return user;
}

export async function GET(request: Request) {
  const user = await getAuthenticatedUser();

  if (user?.app_metadata?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const customerId = searchParams.get("customerId");
  const category = searchParams.get("category");
  const status = searchParams.get("status");
  const query = searchParams.get("q")?.trim();

  const baseSelect = `
    id,
    customer_id,
    file_name,
    content_type,
    file_size,
    storage_bucket,
    storage_path,
    asset_category,
    description,
    source,
    status,
    admin_note,
    admin_note_updated_at,
    reviewed_at,
    created_at,
    customers(name, email)
  `;
  const fallbackSelect = `
    id,
    customer_id,
    file_name,
    content_type,
    file_size,
    storage_bucket,
    storage_path,
    asset_category,
    description,
    source,
    status,
    created_at,
    customers(name, email)
  `;

  const buildQuery = (selectStatement: string) => {
    let assetQuery = supabaseAdmin
      .from("customer_display_assets")
      .select(selectStatement)
      .order("created_at", { ascending: false })
      .limit(customerId ? 100 : 200);

    if (customerId) assetQuery = assetQuery.eq("customer_id", customerId);
    if (category && category !== "all") {
      assetQuery = assetQuery.eq("asset_category", category);
    }
    if (status && status !== "all") {
      assetQuery = assetQuery.eq("status", status);
    }
    if (query) {
      assetQuery = assetQuery.or(
        `file_name.ilike.%${query}%,description.ilike.%${query}%`,
      );
    }

    return assetQuery;
  };

  let { data: assets, error } = await buildQuery(baseSelect);

  if (error?.code === "42703" || error?.code === "PGRST204") {
    const fallback = await buildQuery(fallbackSelect);
    assets = fallback.data;
    error = fallback.error;
  }

  if (error) {
    if (error.code === "PGRST205" || error.code === "42703") {
      return NextResponse.json({
        assets: [],
        warning:
          "Customer material tables are not available. Apply the latest Supabase migrations.",
      });
    }

    console.error("Load customer assets error:", error);
    return NextResponse.json(
      { error: "Could not load customer assets." },
      { status: 500 },
    );
  }

  const assetRows = (assets || []) as unknown as CustomerAssetRow[];

  const assetsWithUrls = await Promise.all(
    assetRows.map(async (asset) => {
      let downloadUrl: string | null = null;
      if (asset.storage_bucket && asset.storage_path) {
        const { data } = await supabaseAdmin.storage
          .from(asset.storage_bucket)
          .createSignedUrl(asset.storage_path, 60 * 15);
        downloadUrl = data?.signedUrl || null;
      }

      const customer = Array.isArray(asset.customers)
        ? asset.customers[0]
        : asset.customers;

      return {
        id: asset.id,
        customerId: asset.customer_id,
        customerName: customer?.name || "Unknown customer",
        customerEmail: customer?.email || null,
        fileName: asset.file_name,
        contentType: asset.content_type,
        fileSize: asset.file_size,
        category: asset.asset_category,
        description: asset.description,
        source: asset.source,
        status: normalizeAssetStatus(asset.status),
        adminNote: asset.admin_note || null,
        adminNoteUpdatedAt: asset.admin_note_updated_at || null,
        reviewedAt: asset.reviewed_at || null,
        createdAt: asset.created_at,
        downloadUrl,
      };
    }),
  );

  return NextResponse.json({ assets: assetsWithUrls });
}

export async function PATCH(request: Request) {
  const user = await getAuthenticatedUser();

  if (user?.app_metadata?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as CustomerAssetUpdatePayload;
  const assetId = String(body.assetId || "").trim();
  const customerId = String(body.customerId || "").trim();
  const status = String(body.status || "").trim();
  const adminNote = String(body.adminNote || "").trim();
  const reason = getReason(body.reason);

  if (!assetId || !customerId) {
    return NextResponse.json(
      { error: "Asset ID and customer ID are required." },
      { status: 400 },
    );
  }

  if (!ASSET_STATUSES.has(status)) {
    return NextResponse.json({ error: "Invalid material status." }, { status: 400 });
  }

  if (reason.length < 5) {
    return NextResponse.json(
      { error: "A reason of at least 5 characters is required." },
      { status: 400 },
    );
  }

  if (adminNote.length > 1000) {
    return NextResponse.json(
      { error: "Admin note must be 1000 characters or less." },
      { status: 400 },
    );
  }

  const baseSelect =
    "id, file_name, asset_category, source, status, admin_note, admin_note_updated_at, reviewed_at, reviewed_by";
  const fallbackSelect = "id, file_name, asset_category, source, status";
  let adminNoteStored = true;
  const existingQuery = await supabaseAdmin
    .from("customer_display_assets")
    .select(baseSelect)
    .eq("id", assetId)
    .eq("customer_id", customerId)
    .single();
  let existing = existingQuery.data as Record<string, unknown> | null;
  let existingError = existingQuery.error;

  if (existingError?.code === "42703" || existingError?.code === "PGRST204") {
    adminNoteStored = false;
    const fallback = await supabaseAdmin
      .from("customer_display_assets")
      .select(fallbackSelect)
      .eq("id", assetId)
      .eq("customer_id", customerId)
      .single();
    existing = fallback.data as Record<string, unknown> | null;
    existingError = fallback.error;
  }

  if (existingError || !existing) {
    return NextResponse.json(
      { error: "Display material was not found." },
      { status: 404 },
    );
  }

  const now = new Date().toISOString();
  const updatePayload = {
    status,
    admin_note: adminNote || null,
    admin_note_updated_at: now,
    reviewed_at: status === "reviewed" ? now : null,
    reviewed_by: status === "reviewed" ? user.id : null,
  };

  let { data: asset, error } = await supabaseAdmin
    .from("customer_display_assets")
    .update(updatePayload)
    .eq("id", assetId)
    .eq("customer_id", customerId)
    .select("id, file_name, asset_category, source, status")
    .single();

  if (error?.code === "42703" || error?.code === "PGRST204") {
    adminNoteStored = false;
    const fallback = await supabaseAdmin
      .from("customer_display_assets")
      .update({ status })
      .eq("id", assetId)
      .eq("customer_id", customerId)
      .select("id, file_name, asset_category, source, status")
      .single();
    asset = fallback.data;
    error = fallback.error;
  }

  if (error || !asset) {
    console.error("Update customer asset error:", error);
    return NextResponse.json(
      { error: "Could not update display material." },
      { status: 500 },
    );
  }

  const auditedPayload = adminNoteStored ? updatePayload : { status };
  const fieldsChanged = changedFields(existing, auditedPayload);

  try {
    await recordAuditEvent(
      supabaseAdmin,
      {
        customerId,
        actorType: "admin",
        actorId: user.id,
        eventType: "customer_display_asset_admin_update",
        eventDescription:
          "Admin updated customer display material review status.",
        metadata: {
          assetId,
          fileName: asset.file_name || null,
          category: asset.asset_category || null,
          source: asset.source || null,
          status,
          hasAdminNote: Boolean(adminNote),
          adminNoteStored,
          changedFields: fieldsChanged,
          before: Object.fromEntries(
            fieldsChanged.map((field) => [
              field,
              (existing as Record<string, unknown>)[field],
            ]),
          ),
          after: Object.fromEntries(
            fieldsChanged.map((field) => [
              field,
              (auditedPayload as Record<string, unknown>)[field],
            ]),
          ),
          reason,
        },
        ipAddress: getRequestIp(request),
        userAgent: request.headers.get("user-agent"),
      },
      { throwOnError: true },
    );
  } catch (auditError) {
    console.error("Customer display material review audit error:", auditError);
    if (fieldsChanged.length > 0) {
      await supabaseAdmin
        .from("customer_display_assets")
        .update(
          Object.fromEntries(
            fieldsChanged.map((field) => [
              field,
              (existing as Record<string, unknown>)[field],
            ]),
          ),
        )
        .eq("id", assetId)
        .eq("customer_id", customerId);
    }

    try {
      await createAdminNotification(
        supabaseAdmin,
        {
          customerId,
          eventType: "customer_display_asset_review_audit_failed",
          title: "Display material review audit failed",
          message:
            "A display material review update was rolled back because audit evidence could not be stored.",
          priority: "urgent",
          metadata: {
            assetId,
            fileName: asset.file_name || null,
            category: asset.asset_category || null,
            source: asset.source || null,
            status,
            changedFields: fieldsChanged,
            reason,
            error:
              auditError instanceof Error ? auditError.message : String(auditError),
          },
        },
        { throwOnError: true },
      );
    } catch (notificationError) {
      console.error(
        "Customer display material review audit failure notification error:",
        notificationError,
      );
      return NextResponse.json(
        {
          error:
            "Display material review was not saved and the audit failure notification could not be stored. Contact technical support before retrying.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        error:
          "Display material review was not saved because the audit event could not be stored.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, asset, adminNoteStored });
}
