import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { getRequestIp, recordAuditEvent } from "@/lib/server/audit";
import { createAdminNotification } from "@/lib/server/admin-notifications";
import { assertCustomerCanReceiveDevice } from "@/lib/server/device-entitlements";

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

function cleanString(value: unknown, maxLength: number) {
  const trimmed = String(value || "").trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

function getReason(value: unknown) {
  return String(value || "").trim().slice(0, 1000);
}

function buildDevicePayload(body: Record<string, unknown>) {
  const customerId = cleanString(body.customer_id, 80);
  const name = cleanString(body.name, 160);

  if (!customerId) {
    return { error: "Select a customer before creating a device." };
  }

  if (!name) {
    return { error: "Device name is required." };
  }

  return {
    payload: {
      customer_id: customerId,
      name,
      location: cleanString(body.location, 200),
      internal_notes: cleanString(body.internal_notes, 1000),
      is_active: true,
    },
  };
}

async function rollbackCreatedDevice(deviceId: string) {
  const { error } = await supabaseAdmin
    .from("devices")
    .delete()
    .eq("id", deviceId);

  return { ok: !error, error };
}

export async function POST(request: Request) {
  const user = await getAuthenticatedAdmin();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const reason = getReason(body.reason);

  if (reason.length < 5) {
    return NextResponse.json(
      { error: "A reason of at least 5 characters is required." },
      { status: 400 },
    );
  }

  const result = buildDevicePayload(body);

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const entitlement = await assertCustomerCanReceiveDevice(
    supabaseAdmin,
    result.payload.customer_id,
  ).catch((error) => ({
    ok: false as const,
    entitlement: null,
    error:
      error instanceof Error
        ? error.message
        : "Could not verify paid device entitlement.",
  }));

  if (!entitlement.ok) {
    return NextResponse.json(
      { error: entitlement.error, entitlement: entitlement.entitlement },
      { status: 400 },
    );
  }

  const { data, error } = await supabaseAdmin
    .from("devices")
    .insert(result.payload)
    .select("id, device_code, customer_id, name")
    .single();

  if (error || !data) {
    console.error("Create device error:", error);
    return NextResponse.json(
      { error: error?.message || "Could not create device." },
      { status: 500 },
    );
  }

  try {
    await recordAuditEvent(
      supabaseAdmin,
      {
        customerId: data.customer_id,
        actorType: "admin",
        actorId: user.id,
        eventType: "admin_device_created",
        eventDescription: "Admin created a display device.",
        metadata: {
          deviceId: data.id,
          deviceCode: data.device_code,
          deviceName: data.name,
          reason,
        },
        ipAddress: getRequestIp(request),
        userAgent: request.headers.get("user-agent"),
      },
      { throwOnError: true },
    );
  } catch (auditError) {
    console.error("Create device audit error:", auditError);
    const rollbackResult = await rollbackCreatedDevice(data.id);

    if (!rollbackResult.ok) {
      console.error("Create device rollback error:", rollbackResult.error);

      try {
        await createAdminNotification(
          supabaseAdmin,
          {
            customerId: data.customer_id,
            eventType: "admin_device_create_rollback_failed",
            title: "Device creation rollback failed",
            message:
              "A newly created display device could not be removed after audit storage failed.",
            priority: "urgent",
            metadata: {
              deviceId: data.id,
              deviceCode: data.device_code,
              deviceName: data.name,
              reason,
              auditError:
                auditError instanceof Error ? auditError.message : String(auditError),
              rollbackError: rollbackResult.error
                ? rollbackResult.error.message
                : null,
            },
          },
          { throwOnError: true },
        );
      } catch (notificationError) {
        console.error(
          "Create device rollback failure notification error:",
          notificationError,
        );
        return NextResponse.json(
          {
            error:
              "Device creation audit failed, rollback failed, and urgent admin visibility could not be stored. Contact technical support before retrying.",
          },
          { status: 500 },
        );
      }

      return NextResponse.json(
        {
          error:
            "Device creation audit failed and rollback failed. An urgent admin notification was created.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        error:
          "Device was not saved because the audit event could not be stored.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, device: data });
}
