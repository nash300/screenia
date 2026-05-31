import { NextResponse } from "next/server";
import {
  getAuthenticatedUser,
  getCustomerForUser,
  supabaseAdmin,
} from "@/lib/server/customer-account";
import { getRequestIp, recordAuditEvent } from "@/lib/server/audit";
import {
  saveDisplayAssets,
  validateDisplayAssetRequest,
  type DisplayFileInput,
} from "@/lib/server/display-assets";

export async function POST(request: Request) {
  const user = await getAuthenticatedUser();
  const customer = await getCustomerForUser(user);

  if (!user || !customer) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
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

    await recordAuditEvent(supabaseAdmin, {
      customerId: customer.id,
      actorType: "customer",
      eventType: "customer_display_material_uploaded",
      eventDescription: "Customer uploaded display material from account portal.",
      metadata: {
        descriptionProvided: Boolean(description),
        files: result.storedFiles,
      },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Customer display material upload error:", error);
    return NextResponse.json(
      { error: "Det gick inte att spara materialet." },
      { status: 500 },
    );
  }
}
