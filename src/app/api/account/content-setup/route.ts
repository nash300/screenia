import { NextResponse } from "next/server";
import { getRequestIp, recordAuditEvent } from "@/lib/server/audit";
import {
  getAuthenticatedUser,
  getCustomerForUser,
  supabaseAdmin,
} from "@/lib/server/customer-account";
import {
  saveDisplayAssets,
  validateDisplayAssetRequest,
  type DisplayFileInput,
} from "@/lib/server/display-assets";

const contentOptions = new Set(["upload", "template", "later"]);

export async function POST(request: Request) {
  const user = await getAuthenticatedUser();
  const customer = await getCustomerForUser(user);

  if (!user || !customer) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
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
      status: nextStatus,
    })
    .eq("id", customer.id);

  if (updateError?.code === "42703" || updateError?.code === "PGRST204") {
    await supabaseAdmin
      .from("customers")
      .update({
        name: businessName,
        website_url: websiteUrl || null,
        notes: [customer.notes, notesBlock].filter(Boolean).join("\n\n"),
        status: nextStatus,
      })
      .eq("id", customer.id);
  } else if (updateError) {
    console.error("Account content setup customer update error:", updateError);
    return NextResponse.json(
      { error: "Det gick inte att spara innehållsuppgifterna." },
      { status: 500 },
    );
  }

  await supabaseAdmin
    .from("customer_subscriptions")
    .update({ fulfillment_status: nextStatus })
    .eq("customer_id", customer.id)
    .in("status", ["paid", "active", "checkout_started"]);

  await recordAuditEvent(supabaseAdmin, {
    customerId: customer.id,
    actorType: "customer",
    eventType: "content_setup_submitted",
    eventDescription: "Customer submitted content setup from account portal.",
    metadata: {
      contentOption,
      storedFiles,
      hasOpeningHours: Boolean(openingHours),
      hasPromotions: Boolean(promotions),
      hasSocialMedia: Boolean(socialMedia),
    },
    ipAddress,
    userAgent,
  });

  return NextResponse.json({ success: true });
}
