import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { hasDisplayEntitlement } from "@/lib/server/subscription-entitlements";
import { getRequestIp } from "@/lib/server/audit";
import { checkPersistentRateLimit } from "@/lib/server/persistent-rate-limit";
import { rateLimitHeaders } from "@/lib/server/rate-limit";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

type DisplayDevice = {
  id: string;
  is_active: boolean | null;
  is_complimentary: boolean | null;
  complimentary_expires_at: string | null;
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
  type: string | null;
  order_index: number | null;
  videos:
    | {
        storage_bucket: string | null;
        storage_path: string | null;
        content_type: string | null;
      }
    | Array<{
        storage_bucket: string | null;
        storage_path: string | null;
        content_type: string | null;
      }>
    | null;
};

const SIGNED_URL_SECONDS = 10 * 60;
const DISPLAY_LOOKUP_LIMIT = 60;
const DISPLAY_LOOKUP_WINDOW_MS = 60 * 1000;

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
  request: Request,
  context: { params: Promise<{ deviceId: string }> },
) {
  const { deviceId } = await context.params;
  const normalizedDeviceId = deviceId.trim().toUpperCase();
  const rateLimit = await checkPersistentRateLimit(supabaseAdmin, {
    key: `display-playlist:${getRequestIp(request) || "unknown"}`,
    limit: DISPLAY_LOOKUP_LIMIT,
    windowMs: DISPLAY_LOOKUP_WINDOW_MS,
  });

  if (!rateLimit.allowed) {
    return noStoreJson(
      { error: "Too many display requests." },
      { status: 429, headers: rateLimitHeaders(rateLimit) },
    );
  }

  if (!/^[A-Z0-9]{6,64}$/u.test(normalizedDeviceId)) {
    return noStoreJson(
      { error: "Display is not active." },
      { status: 403, headers: rateLimitHeaders(rateLimit) },
    );
  }

  const { data: device, error: deviceError } = await supabaseAdmin
    .from("devices")
    .select(
      `
      id,
      is_active,
      is_complimentary,
      complimentary_expires_at,
      customers(status, payment_status, service_access_status, service_access_until)
    `,
    )
    .eq("device_code", normalizedDeviceId)
    .maybeSingle<DisplayDevice>();

  if (deviceError) {
    console.error("Display device lookup failed:", deviceError);
    return noStoreJson(
      { error: "Could not verify display access." },
      { status: 500 },
    );
  }

  const complimentaryExpired =
    device?.is_complimentary === true &&
    Boolean(
      device.complimentary_expires_at &&
        Date.parse(device.complimentary_expires_at) <= Date.now(),
    );
  const hasAccess = device?.is_complimentary
    ? !complimentaryExpired
    : hasDisplayEntitlement({
      customerStatus: device?.customers?.status,
      paymentStatus: device?.customers?.payment_status,
      serviceAccessStatus: device?.customers?.service_access_status,
      serviceAccessUntil: device?.customers?.service_access_until,
    });

  if (!device || !device.is_active || !hasAccess) {
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
      type,
      order_index,
      videos(storage_bucket, storage_path, content_type)
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
        type: row.type || (video.content_type?.startsWith("image/") ? "image" : "video"),
        contentType: video.content_type || null,
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
