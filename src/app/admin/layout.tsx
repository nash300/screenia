import Link from "next/link";
import "./admin.css";
import AdminPageTitle from "@/components/AdminPageTitle";
import AdminNotifications from "@/components/AdminNotifications";
import AdminBreadcrumbs from "@/components/AdminBreadcrumbs";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: "D" },
  { href: "/admin/customers", label: "Customers", icon: "C" },
  { href: "/admin/devices", label: "Device Manager", icon: "M" },
  { href: "/admin/pricing", label: "Pricing", icon: "$" },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="admin-layout">
      <aside className="admin-sidebar fixed left-0 top-0 z-40 flex h-screen w-72 flex-col overflow-hidden shadow-2xl">
        <div className="admin-window-titlebar">
          <span className="admin-window-titlebar-text">InfoSync Admin</span>
        </div>

        <div className="relative px-6 py-6">
          <Link href="/admin" className="block no-underline">
            <div className="admin-sidebar-logo-card">
              <img
                src="/brand/infosync-logo-full-transparent.png"
                alt="InfoSync"
                className="mx-auto h-11 w-auto object-contain"
              />
            </div>
          </Link>

          <div className="mt-5">
            <p className="admin-sidebar-kicker">Admin Panel</p>
            <p className="admin-sidebar-description">
              Manage customers, screens, and content.
            </p>
          </div>
        </div>

        <nav className="relative flex-1 space-y-2 px-4">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className="admin-nav-link">
              <span className="admin-nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="admin-sidebar-footer">
          <p className="admin-sidebar-kicker">InfoSync</p>
          <p className="admin-sidebar-version">Version 0.1</p>
        </div>
        <AdminPageTitle />
      </aside>

      <main className="ml-72 min-h-screen">
        <div className="admin-page">
          <AdminBreadcrumbs />
          {children}
        </div>
      </main>
      <AdminNotifications />
    </div>
  );
}
