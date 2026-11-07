import { NextResponse } from "next/server";
import {
  customerAccessDeniedResponse,
  getAuthenticatedUser,
  getCustomerForUser,
  hasCustomerServiceAccess,
  sanitizeFileName,
  supabaseAdmin,
} from "@/lib/server/customer-account";
import { customerCanUploadVideos } from "@/lib/pricing/plan-entitlements";
import { getRequestIp, recordAuditEvent } from "@/lib/server/audit";
import { createAdminNotification } from "@/lib/server/admin-notifications";
import { DISPLAY_ASSET_BUCKET } from "@/lib/server/display-assets";
import { validateCustomerVideo } from "./video-validation";

const MAX_DESCRIPTION_LENGTH = 1200;

type VideoUploadBody = {
  action?: string;
  fileName?: string;
  contentType?: string;
  fileSize?: number;
  storagePath?: string;
  description?: string;
};

async function loadVideoEntitlement(customerId: string) {
  const { data, error } = await supabaseAdmin
    .from("customer_subscriptions")
    .select("status, quote_items, pricing_plans(code)")
    .eq("customer_id", customerId)
    .in("status", ["paid", "active", "trialing"]);

  if (error) throw error;
  return customerCanUploadVideos(data || []);
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser();
  const customer = await getCustomerForUser(user);

  if (!user || !customer) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (!hasCustomerServiceAccess(customer)) {
    return NextResponse.json(customerAccessDeniedResponse(), { status: 403 });
  }

  let videoUploadEnabled = false;
  try {
    videoUploadEnabled = await loadVideoEntitlement(customer.id);
  } catch (error) {
    console.error("Premium video entitlement lookup error:", error);
    return NextResponse.json(
      { error: "Videobehörigheten kunde inte kontrolleras." },
      { status: 500 },
    );
  }

  if (!videoUploadEnabled) {
    return NextResponse.json(
      {
        error:
          "Egen videouppladdning ingår endast i ett aktivt Premium-abonnemang.",
      },
      { status: 403 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as VideoUploadBody;
  const action = String(body.action || "");
  const fileName = sanitizeFileName(String(body.fileName || ""));
  const contentType = String(body.contentType || "");
  const fileSize = Number(body.fileSize || 0);
  const validationError = validateCustomerVideo({ fileName, contentType, fileSize });

  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  if (action === "create") {
    const storagePath = `${customer.id}/${crypto.randomUUID()}-${fileName}`;
    const { data, error } = await supabaseAdmin.storage
      .from(DISPLAY_ASSET_BUCKET)
      .createSignedUploadUrl(storagePath, { upsert: false });

    if (error || !data?.token) {
      console.error("Create customer video upload URL error:", error);
      return NextResponse.json(
        { error: "Videouppladdningen kunde inte startas." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      bucket: DISPLAY_ASSET_BUCKET,
      storagePath,
      token: data.token,
    });
  }

  if (action !== "complete") {
    return NextResponse.json({ error: "Ogiltig videouppladdning." }, { status: 400 });
  }

  const storagePath = String(body.storagePath || "");
  const description = String(body.description || "").trim();
  if (
    !storagePath.startsWith(`${customer.id}/`) ||
    storagePath.includes("..") ||
    description.length > MAX_DESCRIPTION_LENGTH
  ) {
    return NextResponse.json(
      { error: "Videouppladdningen kunde inte verifieras." },
      { status: 400 },
    );
  }

  const storedName = storagePath.slice(customer.id.length + 1);
  const { data: storedObjects, error: listError } = await supabaseAdmin.storage
    .from(DISPLAY_ASSET_BUCKET)
    .list(customer.id, { search: storedName, limit: 10 });
  const storedObject = storedObjects?.find((item) => item.name === storedName);

  if (listError || !storedObject) {
    return NextResponse.json(
      { error: "Videofilen hittades inte efter uppladdningen." },
      { status: 400 },
    );
  }

  const storedSize = Number(storedObject.metadata?.size || fileSize);
  const storedType = String(
    storedObject.metadata?.mimetype ||
      storedObject.metadata?.contentType ||
      contentType,
  );
  const storedValidationError = validateCustomerVideo({
    fileName,
    contentType: storedType,
    fileSize: storedSize,
  });
  if (storedValidationError) {
    await supabaseAdmin.storage.from(DISPLAY_ASSET_BUCKET).remove([storagePath]);
    return NextResponse.json({ error: storedValidationError }, { status: 400 });
  }

  const existing = await supabaseAdmin
    .from("customer_display_assets")
    .select("id")
    .eq("customer_id", customer.id)
    .eq("storage_path", storagePath)
    .maybeSingle();
  if (existing.data) {
    return NextResponse.json(
      { error: "Videofilen har redan registrerats." },
      { status: 409 },
    );
  }

  const { data: asset, error: assetError } = await supabaseAdmin
    .from("customer_display_assets")
    .insert({
      customer_id: customer.id,
      file_name: fileName,
      content_type: storedType,
      file_size: storedSize,
      storage_bucket: DISPLAY_ASSET_BUCKET,
      storage_path: storagePath,
      uploaded_by: "customer",
      asset_category: "video",
      description: description || null,
      source: "account",
      status: "new",
    })
    .select("id")
    .single();

  if (assetError || !asset) {
    await supabaseAdmin.storage.from(DISPLAY_ASSET_BUCKET).remove([storagePath]);
    return NextResponse.json(
      { error: "Videofilen kunde inte registreras." },
      { status: 500 },
    );
  }

  const ipAddress = getRequestIp(request);
  const userAgent = request.headers.get("user-agent");

  try {
    await recordAuditEvent(
      supabaseAdmin,
      {
        customerId: customer.id,
        actorType: "customer",
        actorId: user.id,
        eventType: "customer_video_uploaded",
        eventDescription:
          "Premium customer uploaded a video for display review.",
        metadata: {
          assetId: asset.id,
          fileName,
          contentType: storedType,
          fileSize: storedSize,
          storagePath,
        },
        ipAddress,
        userAgent,
      },
      { throwOnError: true },
    );
  } catch (auditError) {
    console.error("Customer video upload audit error:", auditError);
    await Promise.allSettled([
      supabaseAdmin
        .from("customer_display_assets")
        .delete()
        .eq("id", asset.id),
      supabaseAdmin.storage.from(DISPLAY_ASSET_BUCKET).remove([storagePath]),
    ]);
    return NextResponse.json(
      {
        error:
          "Videofilen sparades inte eftersom revisionshistoriken inte kunde lagras.",
      },
      { status: 500 },
    );
  }

  try {
    await createAdminNotification(
      supabaseAdmin,
      {
        customerId: customer.id,
        eventType: "customer_video_uploaded",
        title: "New Premium video",
        message: `${customer.name} uploaded ${fileName} for display review.`,
        priority: "high",
        metadata: {
          assetId: asset.id,
          fileName,
          contentType: storedType,
          fileSize: storedSize,
        },
      },
      { throwOnError: true },
    );
  } catch (notificationError) {
    console.error("Customer video upload notification error:", notificationError);
    await recordAuditEvent(supabaseAdmin, {
      customerId: customer.id,
      actorType: "system",
      eventType: "customer_video_notification_failed",
      eventDescription:
        "A Premium video was stored, but the admin notification failed.",
      metadata: {
        assetId: asset.id,
        fileName,
        error:
          notificationError instanceof Error
            ? notificationError.message
            : "Unknown notification error",
      },
      ipAddress,
      userAgent,
    });
  }

  return NextResponse.json({ success: true, assetId: asset.id });
}
