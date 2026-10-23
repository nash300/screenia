import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export type AdminRole = "owner" | "operations" | "finance" | "support" | "content";

export type AdminPermission =
  | "billing.manage"
  | "billing.reconcile"
  | "customer.read"
  | "customer.support"
  | "device.allocate"
  | "device.grant_complimentary"
  | "device.replace"
  | "content.manage";

const adminRolePermissions: Record<AdminRole, ReadonlySet<AdminPermission>> = {
  owner: new Set([
    "billing.manage",
    "billing.reconcile",
    "customer.read",
    "customer.support",
    "device.allocate",
    "device.grant_complimentary",
    "device.replace",
    "content.manage",
  ]),
  operations: new Set([
    "customer.read",
    "customer.support",
    "device.allocate",
    "device.replace",
    "content.manage",
  ]),
  finance: new Set([
    "billing.manage",
    "billing.reconcile",
    "customer.read",
  ]),
  support: new Set(["customer.read", "customer.support"]),
  content: new Set(["customer.read", "content.manage"]),
};

const adminRoleLabels: Record<AdminRole, string> = {
  owner: "Owner",
  operations: "Operations",
  finance: "Finance",
  support: "Support",
  content: "Content",
};

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

type AuthenticatedClientOptions = {
  persistSession?: boolean;
};

export async function createAuthenticatedClient(
  options: AuthenticatedClientOptions = {},
) {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (items) => {
          if (!options.persistSession) return;

          items.forEach(({ name, value, options: cookieOptions }) => {
            cookieStore.set(name, value, cookieOptions);
          });
        },
      },
    },
  );
}

export async function getAuthenticatedUser(
  options?: AuthenticatedClientOptions,
) {
  const supabase = await createAuthenticatedClient(options);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}

export async function getAuthenticatedAdmin(
  options?: AuthenticatedClientOptions,
) {
  const user = await getAuthenticatedUser(options);
  return user?.app_metadata?.role === "admin" ? user : null;
}

export function getAdminRole(user: {
  app_metadata?: Record<string, unknown> | null;
}): AdminRole {
  const configuredRole = String(user.app_metadata?.admin_role || "").toLowerCase();

  if (Object.prototype.hasOwnProperty.call(adminRolePermissions, configuredRole)) {
    return configuredRole as AdminRole;
  }

  // Existing Screenia admins predate scoped roles and retain owner access until
  // an explicit admin_role claim is added to their Supabase app_metadata.
  return "owner";
}

export function hasAdminPermission(
  user: { app_metadata?: Record<string, unknown> | null },
  permission: AdminPermission,
) {
  return adminRolePermissions[getAdminRole(user)].has(permission);
}

export function getAdminRoleLabel(role: AdminRole) {
  return adminRoleLabels[role];
}

export function getAdminPermissions(role: AdminRole) {
  return Array.from(adminRolePermissions[role]);
}
