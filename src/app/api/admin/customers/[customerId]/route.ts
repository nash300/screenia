import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { getRequestIp, recordAuditEvent } from "@/lib/server/audit";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const createAuthenticatedClient = async () => {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (items) => {
          items.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    },
  );
};

function isMissingRelationError(error: { code?: string; message?: string }) {
  return (
    error.code === "42P01" ||
    error.code === "42703" ||
    error.code === "PGRST205" ||
    error.message?.includes("schema cache")
  );
}

function deleteErrorResponse(label: string, error: unknown) {
  console.error(`${label}:`, error);

  return NextResponse.json(
    {
      error:
        process.env.NODE_ENV === "development"
          ? `${label}: ${error instanceof Error ? error.message : JSON.stringify(error)}`
          : label,
    },
    { status: 500 },
  );
}

async function deleteByCustomerId(table: string, customerId: string, label: string) {
  const { error } = await supabaseAdmin
    .from(table)
    .delete()
    .eq("customer_id", customerId);

  if (error && !isMissingRelationError(error)) {
    return deleteErrorResponse(label, error);
  }

  return null;
}

async function detachCustomerId(table: string, customerId: string, label: string) {
  const { error } = await supabaseAdmin
    .from(table)
    .update({ customer_id: null })
    .eq("customer_id", customerId);

  if (error && !isMissingRelationError(error)) {
    return deleteErrorResponse(label, error);
  }

  return null;
}

async function listStoragePaths(bucket: string, prefix: string) {
  const paths: string[] = [];
  const { data, error } = await supabaseAdmin.storage
    .from(bucket)
    .list(prefix, { limit: 1000 });

  if (error || !data) return paths;

  for (const item of data) {
    const path = `${prefix}/${item.name}`;
    if (item.id) {
      paths.push(path);
    } else {
      paths.push(...(await listStoragePaths(bucket, path)));
    }
  }

  return paths;
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ customerId: string }> },
) {
  const supabase = await createAuthenticatedClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user?.app_metadata.role !== "admin") {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { customerId } = await params;
  const ipAddress = getRequestIp(request);
  const userAgent = request.headers.get("user-agent");

  const { data: customer, error: customerError } = await supabaseAdmin
    .from("customers")
    .select("id, name, status")
    .eq("id", customerId)
    .single();

  if (customerError || !customer) {
    return NextResponse.json(
      { error: "Customer was not found." },
      { status: 404 },
    );
  }

  await recordAuditEvent(supabaseAdmin, {
    customerId: customer.id,
    actorType: "admin",
    actorId: user.id,
    eventType: "customer_deleted",
    eventDescription: "Admin deleted a customer record.",
    metadata: {
      customerName: customer.name,
      customerStatus: customer.status,
    },
    ipAddress,
    userAgent,
  });

  const { data: devices } = await supabaseAdmin
    .from("devices")
    .select("id")
    .eq("customer_id", customer.id);
  const deviceIds = (devices || []).map((device) => device.id);

  for (const table of [
    "customer_message_files",
    "customer_messages",
    "customer_display_assets",
    "customer_legal_agreements",
    "consent_records",
    "customer_subscriptions",
  ]) {
    const response = await deleteByCustomerId(
      table,
      customer.id,
      `Could not delete customer records from ${table}.`,
    );
    if (response) return response;
  }

  for (const table of ["admin_notifications", "audit_events", "inventory_events", "inventory_items", "videos"]) {
    const response = await detachCustomerId(
      table,
      customer.id,
      `Could not detach customer records from ${table}.`,
    );
    if (response) return response;
  }

  if (deviceIds.length > 0) {
    for (const table of ["inventory_events", "inventory_items"]) {
      const { error: detachDeviceError } = await supabaseAdmin
        .from(table)
        .update({ device_id: null })
        .in("device_id", deviceIds);

      if (detachDeviceError && !isMissingRelationError(detachDeviceError)) {
        return deleteErrorResponse(
          `Could not detach device records from ${table}.`,
          detachDeviceError,
        );
      }
    }

    const { error: playlistDeleteError } = await supabaseAdmin
      .from("playlists")
      .delete()
      .in("device_id", deviceIds);

    if (playlistDeleteError) {
      return deleteErrorResponse(
        "Could not delete customer playlists.",
        playlistDeleteError,
      );
    }

    const { error: deviceDeleteError } = await supabaseAdmin
      .from("devices")
      .delete()
      .eq("customer_id", customer.id);

    if (deviceDeleteError) {
      return deleteErrorResponse("Could not delete customer devices.", deviceDeleteError);
    }
  }

  const { error: deleteError } = await supabaseAdmin
    .from("customers")
    .delete()
    .eq("id", customer.id);

  if (deleteError) {
    return deleteErrorResponse("Could not delete customer.", deleteError);
  }

  for (const bucket of ["customer-display-assets", "customer-message-files"]) {
    const paths = await listStoragePaths(bucket, customer.id);
    if (paths.length > 0) {
      await supabaseAdmin.storage.from(bucket).remove(paths);
    }
  }

  return NextResponse.json({ success: true });
}
