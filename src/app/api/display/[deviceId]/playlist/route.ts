import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { hasDisplayEntitlement } from "@/lib/server/subscription-entitlements";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

type DisplayDevice = {
  id: string;
  is_active: boolean | null;
  customers: {
    status: string | null;
    payment_status: string | null;
    service_access_status: string | null;
    service_access_until: string | null;
  } | null;
};

type PlaylistRow = {
  id: string;
  src: string | null;
  order_index: number | null;
  videos:
    | {
        storage_bucket: string | null;
        storage_path: string | null;
      }
    | Array<{
        storage_bucket: string | null;
        storage_path: string | null;
      }>
    | null;
};

const SIGNED_URL_SECONDS = 10 * 60;

export const dynamic = "force-dynamic";

function noStoreJson(body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      ...init?.headers,
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(
  _request: Request,
  context: RouteContext<"/api/display/[deviceId]/playlist">,
) {
  const { deviceId } = await context.params;

  const { data: device, error: deviceError } = await supabaseAdmin
    .from("devices")
    .select(
      `
      id,
      is_active,
      customers(status, payment_status, service_access_status, service_access_until)
    `,
    )
    .eq("device_code", deviceId)
    .maybeSingle<DisplayDevice>();

  if (deviceError) {
    console.error("Display device lookup failed:", deviceError);
    return noStoreJson(
      { error: "Could not verify display access." },
      { status: 500 },
    );
  }

  if (
    !device ||
    !device.is_active ||
    !hasDisplayEntitlement({
      customerStatus: device.customers?.status,
      paymentStatus: device.customers?.payment_status,
      serviceAccessStatus: device.customers?.service_access_status,
      serviceAccessUntil: device.customers?.service_access_until,
    })
  ) {
    return noStoreJson(
      { error: "Display is not active." },
      { status: 403 },
    );
  }

  const { data: playlistRows, error: playlistError } = await supabaseAdmin
    .from("playlists")
    .select(
      `
      id,
      src,
      order_index,
      videos(storage_bucket, storage_path)
    `,
    )
    .eq("device_id", device.id)
    .order("order_index")
    .returns<PlaylistRow[]>();

  if (playlistError) {
    console.error("Display playlist lookup failed:", playlistError);
    return noStoreJson(
      { error: "Could not load display playlist." },
      { status: 500 },
    );
  }

  const playlist = [];

  for (const row of playlistRows || []) {
    const video = Array.isArray(row.videos) ? row.videos[0] : row.videos;

    if (video?.storage_bucket && video.storage_path) {
      const { data, error } = await supabaseAdmin.storage
        .from(video.storage_bucket)
        .createSignedUrl(video.storage_path, SIGNED_URL_SECONDS);

      if (error || !data?.signedUrl) {
        console.error("Display signed URL failed:", error);
        continue;
      }

      playlist.push({
        id: row.id,
        src: data.signedUrl,
        orderIndex: row.order_index || 0,
      });
      continue;
    }

    if (row.src) {
      console.warn("Skipping display playlist item without private video storage.", {
        playlistId: row.id,
      });
    }
  }

  return noStoreJson({ playlist, signedUrlSeconds: SIGNED_URL_SECONDS });
}
