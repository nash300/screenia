import Link from "next/link";
import { Suspense } from "react";
import "./admin.css";
import AdminPageTitle from "@/components/AdminPageTitle";
import AdminNotifications from "@/components/AdminNotifications";
import AdminBreadcrumbs from "@/components/AdminBreadcrumbs";
import ScreeniaLogo from "@/components/ScreeniaLogo";
import AdminSidebarNav from "@/components/AdminSidebarNav";
import AdminSignOutButton from "@/components/AdminSignOutButton";
import { privatePageMetadata } from "@/lib/seo";
import {
  getAdminRole,
  getAdminRoleLabel,
  getAuthenticatedAdmin,
} from "@/lib/server/admin-api";

export const metadata = {
  ...privatePageMetadata,
  title: "Administration",
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAuthenticatedAdmin();
  const adminRole = user ? getAdminRole(user) : null;

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div className="admin-window-titlebar">
          <span className="admin-window-titlebar-text">Screenia Admin</span>
        </div>

        <div className="relative px-6 py-6">
          <Link href="/admin" className="block no-underline">
            <div className="admin-sidebar-logo-card">
              <ScreeniaLogo className="screenia-logo-admin" />
            </div>
          </Link>

          <div className="admin-sidebar-intro">
            <p className="admin-sidebar-kicker">Admin workspace</p>
            <p className="admin-sidebar-description">
              Start on Overview. It shows the next customer task.
            </p>
            {adminRole ? (
              <div className="admin-sidebar-role" aria-label="Current admin role">
                <span>Access role</span>
                <strong>{getAdminRoleLabel(adminRole)}</strong>
              </div>
            ) : null}
          </div>
        </div>

        <AdminSidebarNav />

        <div className="admin-sidebar-footer">
          <AdminSignOutButton />
        </div>
          <Suspense fallback={null}>
            <AdminPageTitle />
          </Suspense>
      </aside>

      <main className="admin-main">
        <div className="admin-page">
          <Suspense fallback={null}>
            <AdminBreadcrumbs />
          </Suspense>
          {children}
        </div>
      </main>
      <AdminNotifications />
    </div>
  );
}
