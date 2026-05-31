import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

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

  let requestQuery = supabaseAdmin
    .from("customer_display_assets")
    .select(
      `
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
    `,
    )
    .order("created_at", { ascending: false })
    .limit(customerId ? 100 : 200);

  if (customerId) requestQuery = requestQuery.eq("customer_id", customerId);
  if (category && category !== "all") {
    requestQuery = requestQuery.eq("asset_category", category);
  }
  if (status && status !== "all") {
    requestQuery = requestQuery.eq("status", status);
  }
  if (query) {
    requestQuery = requestQuery.or(
      `file_name.ilike.%${query}%,description.ilike.%${query}%`,
    );
  }

  const { data: assets, error } = await requestQuery;

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

  const assetsWithUrls = await Promise.all(
    (assets || []).map(async (asset) => {
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
        status: asset.status,
        createdAt: asset.created_at,
        downloadUrl,
      };
    }),
  );

  return NextResponse.json({ assets: assetsWithUrls });
}
