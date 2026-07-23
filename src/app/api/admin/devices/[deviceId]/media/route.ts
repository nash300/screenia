import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { getRequestIp, recordAuditEvent } from "@/lib/server/audit";
import { createAdminNotification } from "@/lib/server/admin-notifications";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

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

function getReason(value: unknown) {
  return String(value || "").trim().slice(0, 1000);
}

function sanitizeFileName(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9.-]/g, "")
      .slice(0, 160) || "screenia-display-media"
  );
}

const allowedDisplayMediaTypes = new Set([
  "video/mp4",
  "image/png",
  "image/jpeg",
  "image/webp",
]);

function playlistTypeFor(contentType: string) {
  return contentType.startsWith("image/") ? "image" : "video";
}

async function getDevice(deviceId: string) {
  return supabaseAdmin
    .from("devices")
    .select("id, device_code, customer_id")
    .eq("id", deviceId)
    .single();
}

type PlaylistSnapshot = {
  id: string;
  video_id: string | null;
  type: string | null;
  src: string | null;
  order_index: number | null;
};

async function rollbackUploadedDeviceMedia({
  playlistId,
  videoId,
  storagePath,
}: {
  playlistId?: string | null;
  videoId?: string | null;
  storagePath: string;
}) {
  const rollbackResults = await Promise.allSettled([
    playlistId
      ? supabaseAdmin.from("playlists").delete().eq("id", playlistId)
      : Promise.resolve({ error: null }),
    videoId
      ? supabaseAdmin.from("videos").delete().eq("id", videoId)
      : Promise.resolve({ error: null }),
    supabaseAdmin.storage.from("videos").remove([storagePath]),
  ]);

  const errors = rollbackResults
    .map((result) => {
      if (result.status === "rejected") return String(result.reason);
      return result.value.error?.message || null;
    })
    .filter(Boolean) as string[];

  return { ok: errors.length === 0, errors };
}

async function rollbackRemovedPlaylistItem(
  deviceId: string,
  playlistItem: PlaylistSnapshot,
) {
  const { error } = await supabaseAdmin.from("playlists").insert({
    id: playlistItem.id,
    device_id: deviceId,
    video_id: playlistItem.video_id,
    type: playlistItem.type,
    src: playlistItem.src,
    order_index: playlistItem.order_index,
  });

  return { ok: !error, errors: error ? [error.message] : [] };
}

async function notifyDeviceMediaRollbackFailure({
  customerId,
  eventType,
  title,
  message,
  metadata,
}: {
  customerId?: string | null;
  eventType: string;
  title: string;
  message: string;
  metadata: Record<string, unknown>;
}) {
  await createAdminNotification(
    supabaseAdmin,
    {
      customerId: customerId || null,
      eventType,
      title,
      message,
      priority: "urgent",
      metadata,
    },
    { throwOnError: true },
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ deviceId: string }> },
) {
  const user = await getAuthenticatedAdmin();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { deviceId } = await params;
  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  const reason = getReason(formData?.get("reason"));

  if (reason.length < 5) {
    return NextResponse.json(
      { error: "A reason of at least 5 characters is required." },
      { status: 400 },
    );
  }

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Choose a display media file." }, { status: 400 });
  }

  if (!allowedDisplayMediaTypes.has(file.type)) {
    return NextResponse.json(
      { error: "Only MP4, PNG, JPG, and WebP display media are supported." },
      { status: 400 },
    );
  }

  const { data: device, error: deviceError } = await getDevice(deviceId);

  if (deviceError || !device) {
    return NextResponse.json({ error: "Device was not found." }, { status: 404 });
  }

  const safeFileName = sanitizeFileName(file.name);
  const storagePath = `${device.device_code}/${Date.now()}-${safeFileName}`;
  const { error: uploadError } = await supabaseAdmin.storage
    .from("videos")
    .upload(storagePath, file, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    console.error("Device video upload error:", uploadError);
    return NextResponse.json(
      { error: "Could not upload video." },
      { status: 500 },
    );
  }

  const { data: videoRecord, error: videoRecordError } = await supabaseAdmin
    .from("videos")
    .insert({
      customer_id: device.customer_id,
      file_name: safeFileName || file.name,
      storage_bucket: "videos",
      storage_path: storagePath,
      src: storagePath,
      content_type: file.type,
    })
    .select("id")
    .single();

  if (videoRecordError || !videoRecord) {
    console.error("Device video record error:", videoRecordError);
    await supabaseAdmin.storage.from("videos").remove([storagePath]);

    return NextResponse.json(
      { error: "Video uploaded, but metadata could not be saved." },
      { status: 500 },
    );
  }

  const { count } = await supabaseAdmin
    .from("playlists")
    .select("id", { count: "exact", head: true })
    .eq("device_id", device.id);
  const { data: playlistRecord, error: playlistError } = await supabaseAdmin
    .from("playlists")
    .insert({
      device_id: device.id,
      video_id: videoRecord.id,
      type: playlistTypeFor(file.type),
      src: storagePath,
      order_index: (count || 0) + 1,
    })
    .select("id")
    .single();

  if (playlistError || !playlistRecord) {
    console.error("Device playlist insert error:", playlistError);
    await supabaseAdmin.from("videos").delete().eq("id", videoRecord.id);
    await supabaseAdmin.storage.from("videos").remove([storagePath]);

    return NextResponse.json(
      { error: "Video uploaded, but could not be added to playlist." },
      { status: 500 },
    );
  }

  try {
    await recordAuditEvent(
      supabaseAdmin,
      {
        customerId: device.customer_id,
        actorType: "admin",
        actorId: user.id,
        eventType: "admin_device_media_added",
        eventDescription:
          "Admin uploaded display media to a display device playlist.",
        metadata: {
          deviceId: device.id,
          deviceCode: device.device_code,
          videoId: videoRecord.id,
          playlistId: playlistRecord.id,
          storagePath,
          fileName: safeFileName,
          reason,
        },
        ipAddress: getRequestIp(request),
        userAgent: request.headers.get("user-agent"),
      },
      { throwOnError: true },
    );
  } catch (auditError) {
    console.error("Device media upload audit error:", auditError);
    const rollbackResult = await rollbackUploadedDeviceMedia({
      playlistId: playlistRecord.id,
      videoId: videoRecord.id,
      storagePath,
    });

    if (!rollbackResult.ok) {
      console.error("Device media upload rollback error:", rollbackResult.errors);

      try {
        await notifyDeviceMediaRollbackFailure({
          customerId: device.customer_id,
          eventType: "admin_device_media_upload_rollback_failed",
          title: "Device media upload rollback failed",
          message:
            "Uploaded media, video metadata, or playlist state could not be fully removed after audit storage failed.",
          metadata: {
            deviceId: device.id,
            deviceCode: device.device_code,
            videoId: videoRecord.id,
            playlistId: playlistRecord.id,
            storagePath,
            fileName: safeFileName,
            reason,
            auditError:
              auditError instanceof Error ? auditError.message : String(auditError),
            rollbackErrors: rollbackResult.errors,
          },
        });
      } catch (notificationError) {
        console.error(
          "Device media upload rollback failure notification error:",
          notificationError,
        );
        return NextResponse.json(
          {
            error:
              "Device media upload audit failed, rollback failed, and urgent admin visibility could not be stored. Contact technical support before retrying.",
          },
          { status: 500 },
        );
      }

      return NextResponse.json(
        {
          error:
            "Device media upload audit failed and rollback failed. An urgent admin notification was created.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        error:
          "Device media upload was not saved because the audit event could not be stored.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, playlistId: playlistRecord.id });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ deviceId: string }> },
) {
  const user = await getAuthenticatedAdmin();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { deviceId } = await params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const playlistId = String(body.playlistId || "").trim();
  const reason = getReason(body.reason);

  if (reason.length < 5) {
    return NextResponse.json(
      { error: "A reason of at least 5 characters is required." },
      { status: 400 },
    );
  }

  if (!playlistId) {
    return NextResponse.json(
      { error: "Playlist item is required." },
      { status: 400 },
    );
  }

  const { data: device, error: deviceError } = await getDevice(deviceId);

  if (deviceError || !device) {
    return NextResponse.json({ error: "Device was not found." }, { status: 404 });
  }

  const { data: playlistItem, error: playlistLookupError } = await supabaseAdmin
    .from("playlists")
    .select("id, video_id, type, src, order_index")
    .eq("id", playlistId)
    .eq("device_id", device.id)
    .single();

  if (playlistLookupError || !playlistItem) {
    return NextResponse.json(
      { error: "Playlist item was not found." },
      { status: 404 },
    );
  }

  const { error: deleteError } = await supabaseAdmin
    .from("playlists")
    .delete()
    .eq("id", playlistItem.id);

  if (deleteError) {
    console.error("Delete device playlist item error:", deleteError);
    return NextResponse.json(
      { error: "Could not remove video from playlist." },
      { status: 500 },
    );
  }

  try {
    await recordAuditEvent(
      supabaseAdmin,
      {
        customerId: device.customer_id,
        actorType: "admin",
        actorId: user.id,
        eventType: "admin_device_media_removed",
        eventDescription:
          "Admin removed video media from a display device playlist.",
        metadata: {
          deviceId: device.id,
          deviceCode: device.device_code,
          playlistId: playlistItem.id,
          videoId: playlistItem.video_id,
          src: playlistItem.src,
          reason,
        },
        ipAddress: getRequestIp(request),
        userAgent: request.headers.get("user-agent"),
      },
      { throwOnError: true },
    );
  } catch (auditError) {
    console.error("Device media removal audit error:", auditError);
    const rollbackResult = await rollbackRemovedPlaylistItem(
      device.id,
      playlistItem as PlaylistSnapshot,
    );

    if (!rollbackResult.ok) {
      console.error("Device media removal rollback error:", rollbackResult.errors);

      try {
        await notifyDeviceMediaRollbackFailure({
          customerId: device.customer_id,
          eventType: "admin_device_media_removal_rollback_failed",
          title: "Device media removal rollback failed",
          message:
            "A removed playlist item could not be restored after audit storage failed.",
          metadata: {
            deviceId: device.id,
            deviceCode: device.device_code,
            playlistId: playlistItem.id,
            videoId: playlistItem.video_id,
            src: playlistItem.src,
            reason,
            auditError:
              auditError instanceof Error ? auditError.message : String(auditError),
            rollbackErrors: rollbackResult.errors,
          },
        });
      } catch (notificationError) {
        console.error(
          "Device media removal rollback failure notification error:",
          notificationError,
        );
        return NextResponse.json(
          {
            error:
              "Device media removal audit failed, rollback failed, and urgent admin visibility could not be stored. Contact technical support before retrying.",
          },
          { status: 500 },
        );
      }

      return NextResponse.json(
        {
          error:
            "Device media removal audit failed and rollback failed. An urgent admin notification was created.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        error:
          "Device media removal was not saved because the audit event could not be stored.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}
