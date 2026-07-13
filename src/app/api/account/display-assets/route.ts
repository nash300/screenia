import { NextResponse } from "next/server";
import {
  customerAccessDeniedResponse,
  getAuthenticatedUser,
  getCustomerForUser,
  hasCustomerServiceAccess,
  supabaseAdmin,
} from "@/lib/server/customer-account";
import { getRequestIp, recordAuditEvent } from "@/lib/server/audit";
import { createAdminNotification } from "@/lib/server/admin-notifications";
import {
  DISPLAY_ASSET_BUCKET,
  saveDisplayAssets,
  validateDisplayAssetRequest,
  type DisplayFileInput,
} from "@/lib/server/display-assets";

async function cleanupUploadedDisplayAssets({
  assetIds,
  storagePaths,
}: {
  assetIds: string[];
  storagePaths: string[];
}) {
  await Promise.allSettled([
    assetIds.length > 0
      ? supabaseAdmin.from("customer_display_assets").delete().in("id", assetIds)
      : Promise.resolve(),
    storagePaths.length > 0
      ? supabaseAdmin.storage.from(DISPLAY_ASSET_BUCKET).remove(storagePaths)
      : Promise.resolve(),
  ]);
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

  const body = await request.json();
  const description = String(body.description || "").trim();
  const files = Array.isArray(body.files)
    ? (body.files as DisplayFileInput[])
    : [];
  const ipAddress = getRequestIp(request);
  const userAgent = request.headers.get("user-agent");

  const validation = validateDisplayAssetRequest(files, description);
  if (validation.error) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  try {
    const result = await saveDisplayAssets({
      supabase: supabaseAdmin,
      customerId: customer.id,
      files,
      description,
      source: "account",
    });

    try {
      await recordAuditEvent(
        supabaseAdmin,
        {
          customerId: customer.id,
          actorType: "customer",
          actorId: user.id,
          eventType: "customer_display_material_uploaded",
          eventDescription:
            "Customer uploaded display material from account portal.",
          metadata: {
            descriptionProvided: Boolean(description),
            files: result.storedFiles,
            assetIds: result.storedAssetIds,
          },
          ipAddress,
          userAgent,
        },
        { throwOnError: true },
      );
    } catch (auditError) {
      console.error("Customer display material audit error:", auditError);
      await cleanupUploadedDisplayAssets({
        assetIds: result.storedAssetIds,
        storagePaths: result.storagePaths,
      });

      return NextResponse.json(
        {
          error:
            "Materialet sparades inte eftersom revisionshistoriken inte kunde lagras.",
        },
        { status: 500 },
      );
    }

    try {
      await createAdminNotification(
        supabaseAdmin,
        {
          customerId: customer.id,
          eventType: "customer_display_material_uploaded",
          title: "New display material",
          message: `${customer.name} uploaded display material for admin review.`,
          priority: "high",
          metadata: {
            descriptionProvided: Boolean(description),
            files: result.storedFiles,
            assetIds: result.storedAssetIds,
          },
        },
        { throwOnError: true },
      );
    } catch (notificationError) {
      console.error(
        "Customer display material notification error:",
        notificationError,
      );
      try {
        await recordAuditEvent(
          supabaseAdmin,
          {
            customerId: customer.id,
            actorType: "system",
            eventType: "customer_display_material_notification_failed",
            eventDescription:
              "Customer display material was saved, but admin notification storage failed.",
            metadata: {
              descriptionProvided: Boolean(description),
              files: result.storedFiles,
              assetIds: result.storedAssetIds,
              error:
                notificationError instanceof Error
                  ? notificationError.message
                  : "Unknown admin notification storage error",
            },
            ipAddress,
            userAgent,
          },
          { throwOnError: true },
        );
      } catch (notificationAuditError) {
        console.error(
          "Customer display material notification failure audit error:",
          notificationAuditError,
        );
        await cleanupUploadedDisplayAssets({
          assetIds: result.storedAssetIds,
          storagePaths: result.storagePaths,
        });

        return NextResponse.json(
          {
            error:
              "Materialet sparades inte eftersom Screenia inte kunde skapa adminavisering eller intern felbevisning.",
          },
          { status: 500 },
        );
      }

      return NextResponse.json(
        {
          error:
            "Materialet sparades, men Screenia kunde inte skapa adminaviseringen. Kontakta support om du inte far aterkoppling.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Customer display material upload error:", error);
    return NextResponse.json(
      { error: "Det gick inte att spara materialet." },
      { status: 500 },
    );
  }
}
