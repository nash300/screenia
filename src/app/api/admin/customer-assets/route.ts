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

  if (!customerId) {
    return NextResponse.json(
      { error: "Customer ID is required." },
      { status: 400 },
    );
  }

  const { data: assets, error } = await supabaseAdmin
    .from("customer_display_assets")
    .select("id, file_name, content_type, file_size, storage_bucket, storage_path, created_at")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Load customer assets error:", error);
    return NextResponse.json(
      { error: "Could not load customer assets." },
      { status: 500 },
    );
  }

  const assetsWithUrls = await Promise.all(
    (assets || []).map(async (asset) => {
      const { data } = await supabaseAdmin.storage
        .from(asset.storage_bucket)
        .createSignedUrl(asset.storage_path, 60 * 15);

      return {
        id: asset.id,
        fileName: asset.file_name,
        contentType: asset.content_type,
        fileSize: asset.file_size,
        createdAt: asset.created_at,
        downloadUrl: data?.signedUrl || null,
      };
    }),
  );

  return NextResponse.json({ assets: assetsWithUrls });
}
