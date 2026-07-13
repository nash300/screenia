import { NextResponse } from "next/server";
import { getRequestIp, recordAuditEvent } from "@/lib/server/audit";
import { createAdminNotification } from "@/lib/server/admin-notifications";
import {
  customerAccessDeniedResponse,
  getAuthenticatedUser,
  getCustomerForUser,
  hasCustomerServiceAccess,
  supabaseAdmin,
} from "@/lib/server/customer-account";
import {
  DISPLAY_ASSET_BUCKET,
  saveDisplayAssets,
  validateDisplayAssetRequest,
  type DisplayFileInput,
} from "@/lib/server/display-assets";

const contentOptions = new Set(["upload", "template", "later"]);

async function cleanupContentSetupAssets({
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

async function rollbackContentSetup({
  customerId,
  customer,
  subscriptionUpdates,
  assetIds,
  storagePaths,
}: {
  customerId: string;
  customer: Record<string, unknown>;
  subscriptionUpdates: Array<{ id: string; fulfillment_status: string | null }>;
  assetIds: string[];
  storagePaths: string[];
}) {
  await Promise.allSettled([
    supabaseAdmin
      .from("customers")
      .update({
        name: typeof customer.name === "string" ? customer.name : null,
        website_url:
          typeof customer.website_url === "string" ? customer.website_url : null,
        business_description:
          typeof customer.business_description === "string"
            ? customer.business_description
            : null,
        opening_hours:
          typeof customer.opening_hours === "string" ? customer.opening_hours : null,
        promotions:
          typeof customer.promotions === "string" ? customer.promotions : null,
        social_media:
          typeof customer.social_media === "string" ? customer.social_media : null,
        content_option:
          typeof customer.content_option === "string" ? customer.content_option : null,
        content_collected_at:
          typeof customer.content_collected_at === "string"
            ? customer.content_collected_at
            : null,
        preview_status:
          typeof customer.preview_status === "string"
            ? customer.preview_status
            : null,
        notes: typeof customer.notes === "string" ? customer.notes : null,
        status: typeof customer.status === "string" ? customer.status : null,
      })
      .eq("id", customerId),
    ...subscriptionUpdates.map((subscription) =>
      supabaseAdmin
        .from("customer_subscriptions")
        .update({ fulfillment_status: subscription.fulfillment_status })
        .eq("id", subscription.id),
    ),
    cleanupContentSetupAssets({ assetIds, storagePaths }),
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
  const businessName = String(body.businessName || "").trim();
  const businessDescription = String(body.businessDescription || "").trim();
  const openingHours = String(body.openingHours || "").trim();
  const promotions = String(body.promotions || "").trim();
  const websiteUrl = String(body.websiteUrl || "").trim();
  const socialMedia = String(body.socialMedia || "").trim();
  const contentOption = String(body.contentOption || "").trim();
  const displayNotes = String(body.displayNotes || "").trim();
  const displayFiles = Array.isArray(body.displayFiles)
    ? (body.displayFiles as DisplayFileInput[])
    : [];
  const ipAddress = getRequestIp(request);
  const userAgent = request.headers.get("user-agent");

  if (!contentOptions.has(contentOption)) {
    return NextResponse.json(
      { error: "Välj hur du vill skicka innehåll." },
      { status: 400 },
    );
  }

  if (!businessName || !businessDescription) {
    return NextResponse.json(
      { error: "Företagsnamn och kort beskrivning måste anges." },
      { status: 400 },
    );
  }

  const assetValidation = validateDisplayAssetRequest(displayFiles, displayNotes);
  if (contentOption === "upload" && assetValidation.error) {
    return NextResponse.json({ error: assetValidation.error }, { status: 400 });
  }

  let storedFiles: string[] = [];
  let storedAssetIds: string[] = [];
  let storagePaths: string[] = [];
  if (displayFiles.length > 0 || displayNotes) {
    try {
      const result = await saveDisplayAssets({
        supabase: supabaseAdmin,
        customerId: customer.id,
        files: displayFiles,
        description: displayNotes,
        source: "account",
      });
      storedFiles = result.storedFiles;
      storedAssetIds = result.storedAssetIds;
      storagePaths = result.storagePaths;
    } catch (error) {
      console.error("Account content setup upload failed:", error);
      return NextResponse.json(
        { error: "Det gick inte att spara materialet." },
        { status: 500 },
      );
    }
  }

  const notesBlock = [
    "Customer portal content setup",
    `Business name: ${businessName}`,
    `Description: ${businessDescription}`,
    openingHours ? `Opening hours: ${openingHours}` : "",
    promotions ? `Promotions: ${promotions}` : "",
    websiteUrl ? `Website: ${websiteUrl}` : "",
    socialMedia ? `Social media: ${socialMedia}` : "",
    `Content option: ${contentOption}`,
    displayNotes ? `Content notes: ${displayNotes}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const nextStatus = contentOption === "later" ? "content_pending" : "content_received";
  const { data: subscriptionsBeforeUpdate, error: subscriptionLookupError } =
    await supabaseAdmin
      .from("customer_subscriptions")
      .select("id, fulfillment_status")
      .eq("customer_id", customer.id)
      .in("status", ["paid", "active", "checkout_started"]);

  if (subscriptionLookupError) {
    console.error("Account content setup subscription lookup error:", subscriptionLookupError);
    await cleanupContentSetupAssets({
      assetIds: storedAssetIds,
      storagePaths,
    });

    return NextResponse.json(
      { error: "Det gick inte att kontrollera orderstatus." },
      { status: 500 },
    );
  }

  const { error: updateError } = await supabaseAdmin
    .from("customers")
    .update({
      name: businessName,
      website_url: websiteUrl || null,
      business_description: businessDescription,
      opening_hours: openingHours || null,
      promotions: promotions || null,
      social_media: socialMedia || null,
      content_option: contentOption,
      content_collected_at: new Date().toISOString(),
      preview_status: "waiting_for_admin",
      notes: [customer.notes, notesBlock].filter(Boolean).join("\n\n"),
      status: nextStatus,
    })
    .eq("id", customer.id);

  if (updateError?.code === "42703" || updateError?.code === "PGRST204") {
    const fallbackResult = await supabaseAdmin
      .from("customers")
      .update({
        name: businessName,
        website_url: websiteUrl || null,
        notes: [customer.notes, notesBlock].filter(Boolean).join("\n\n"),
        status: nextStatus,
      })
      .eq("id", customer.id);

    if (fallbackResult.error) {
      console.error("Account content setup fallback update error:", fallbackResult.error);
      await cleanupContentSetupAssets({
        assetIds: storedAssetIds,
        storagePaths,
      });

      return NextResponse.json(
        { error: "Det gick inte att spara innehållsuppgifterna." },
        { status: 500 },
      );
    }
  } else if (updateError) {
    console.error("Account content setup customer update error:", updateError);
    await cleanupContentSetupAssets({
      assetIds: storedAssetIds,
      storagePaths,
    });

    return NextResponse.json(
      { error: "Det gick inte att spara innehållsuppgifterna." },
      { status: 500 },
    );
  }

  const { error: subscriptionUpdateError } = await supabaseAdmin
    .from("customer_subscriptions")
    .update({ fulfillment_status: nextStatus })
    .eq("customer_id", customer.id)
    .in("status", ["paid", "active", "checkout_started"]);

  if (subscriptionUpdateError) {
    console.error("Account content setup subscription update error:", subscriptionUpdateError);
    await rollbackContentSetup({
      customerId: customer.id,
      customer: customer as Record<string, unknown>,
      subscriptionUpdates: subscriptionsBeforeUpdate || [],
      assetIds: storedAssetIds,
      storagePaths,
    });

    try {
      await createAdminNotification(
        supabaseAdmin,
        {
          customerId: customer.id,
          eventType: "content_setup_sync_failed",
          title: "Content setup sync failed",
          message:
            "A customer content setup submission was rolled back because subscription fulfillment status could not be updated.",
          priority: "urgent",
          metadata: {
            contentOption,
            error: subscriptionUpdateError.message,
          },
        },
        { throwOnError: true },
      );
    } catch (notificationError) {
      console.error(
        "Content setup sync failure notification error:",
        notificationError,
      );
      return NextResponse.json(
        {
          error:
            "Det gick inte att uppdatera orderstatus eller skapa intern adminavisering. Kontakta support.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { error: "Det gick inte att uppdatera orderstatus." },
      { status: 500 },
    );
  }

  try {
    await recordAuditEvent(
      supabaseAdmin,
      {
        customerId: customer.id,
        actorType: "customer",
        eventType: "content_setup_submitted",
        eventDescription: "Customer submitted content setup from account portal.",
        metadata: {
          contentOption,
          storedFiles,
          storedAssetIds,
          hasOpeningHours: Boolean(openingHours),
          hasPromotions: Boolean(promotions),
          hasSocialMedia: Boolean(socialMedia),
          hasDisplayNotes: Boolean(displayNotes),
        },
        ipAddress,
        userAgent,
      },
      { throwOnError: true },
    );
  } catch (auditError) {
    const message =
      auditError instanceof Error ? auditError.message : "Unknown audit storage error";
    await rollbackContentSetup({
      customerId: customer.id,
      customer: customer as Record<string, unknown>,
      subscriptionUpdates: subscriptionsBeforeUpdate || [],
      assetIds: storedAssetIds,
      storagePaths,
    });

    try {
      await createAdminNotification(
        supabaseAdmin,
        {
          customerId: customer.id,
          eventType: "content_setup_audit_failed",
          title: "Content setup audit failed",
          message:
            "A customer content setup submission was rolled back because audit evidence could not be stored.",
          priority: "urgent",
          metadata: {
            contentOption,
            error: message,
          },
        },
        { throwOnError: true },
      );
    } catch (notificationError) {
      console.error(
        "Content setup audit failure notification error:",
        notificationError,
      );
      return NextResponse.json(
        {
          error:
            "Innehallsuppgifterna sparades inte och Screenia kunde inte skapa intern adminavisering. Kontakta support.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        error:
          "Innehållsuppgifterna sparades inte eftersom revisionshistoriken inte kunde lagras.",
      },
      { status: 500 },
    );
  }

  try {
    await createAdminNotification(
      supabaseAdmin,
      {
        customerId: customer.id,
        eventType: "content_setup_submitted",
        title: "Content setup submitted",
        message: `${businessName} submitted content setup and is waiting for admin review.`,
        priority: contentOption === "later" ? "normal" : "high",
        metadata: {
          contentOption,
          storedFiles,
          hasOpeningHours: Boolean(openingHours),
          hasPromotions: Boolean(promotions),
          hasSocialMedia: Boolean(socialMedia),
          hasDisplayNotes: Boolean(displayNotes),
        },
      },
      { throwOnError: true },
    );
  } catch (notificationError) {
    const message =
      notificationError instanceof Error
        ? notificationError.message
        : "Unknown admin notification storage error";
    console.error("Content setup admin notification error:", notificationError);
    await rollbackContentSetup({
      customerId: customer.id,
      customer: customer as Record<string, unknown>,
      subscriptionUpdates: subscriptionsBeforeUpdate || [],
      assetIds: storedAssetIds,
      storagePaths,
    });

    try {
      await recordAuditEvent(
        supabaseAdmin,
        {
          customerId: customer.id,
          actorType: "customer",
          eventType: "content_setup_notification_failed",
          eventDescription:
            "Customer content setup was rolled back because admin notification evidence could not be stored.",
          metadata: {
            contentOption,
            storedFiles,
            storedAssetIds,
            error: message,
          },
          ipAddress,
          userAgent,
        },
        { throwOnError: true },
      );
    } catch (auditError) {
      console.error("Content setup notification failure audit error:", auditError);
      return NextResponse.json(
        {
          error:
            "Innehallsuppgifterna sparades inte och Screenia kunde inte lagra intern felhistorik. Kontakta support.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        error:
          "Innehallsuppgifterna sparades inte eftersom adminaviseringen inte kunde skapas.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}
