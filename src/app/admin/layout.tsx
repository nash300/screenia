import Link from "next/link";
import { Suspense } from "react";
import "./admin.css";
import AdminPageTitle from "@/components/AdminPageTitle";
import AdminNotifications from "@/components/AdminNotifications";
import AdminBreadcrumbs from "@/components/AdminBreadcrumbs";
import ScreeniaLogo from "@/components/ScreeniaLogo";
import AdminSidebarNav from "@/components/AdminSidebarNav";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="admin-layout">
      <aside className="admin-sidebar fixed left-0 top-0 z-40 flex h-screen w-72 flex-col overflow-hidden shadow-2xl">
        <div className="admin-window-titlebar">
          <span className="admin-window-titlebar-text">Screenia Admin</span>
        </div>

        <div className="relative px-6 py-6">
          <Link href="/admin" className="block no-underline">
            <div className="admin-sidebar-logo-card">
              <ScreeniaLogo className="screenia-logo-admin" />
            </div>
          </Link>

          <div className="mt-5">
            <p className="admin-sidebar-kicker">Admin Panel</p>
            <p className="admin-sidebar-description">
              Manage customers, screens, and content.
            </p>
          </div>
        </div>

        <AdminSidebarNav />

        <div className="admin-sidebar-footer">
          <p className="admin-sidebar-kicker">Screenia</p>
          <p className="admin-sidebar-version">Version 0.1</p>
        </div>
          <Suspense fallback={null}>
            <AdminPageTitle />
          </Suspense>
      </aside>

      <main className="ml-72 min-h-screen">
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
