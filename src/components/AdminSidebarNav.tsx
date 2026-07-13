"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: "D" },
  { href: "/admin/customers", label: "Customers", icon: "C" },
  { href: "/admin/orders", label: "Orders", icon: "O" },
  { href: "/admin/tax-payments", label: "Tax", icon: "T" },
  { href: "/admin/inventory", label: "Inventory", icon: "I" },
  { href: "/admin/devices", label: "Device Manager", icon: "M" },
  { href: "/admin/pricing", label: "Pricing", icon: "$" },
  { href: "/admin/legal-change-notices", label: "Legal Notices", icon: "L" },
  { href: "/admin/access-reviews", label: "Access", icon: "A" },
  { href: "/admin/backup-drills", label: "Backups", icon: "B" },
  { href: "/admin/data-retention", label: "Retention", icon: "R" },
  { href: "/admin/email-events", label: "Email Events", icon: "E" },
  { href: "/admin/processor-reviews", label: "Processors", icon: "P" },
  { href: "/admin/data-subject-requests", label: "Privacy Requests", icon: "R" },
  { href: "/admin/privacy-incidents", label: "Incidents", icon: "!" },
  { href: "/admin/launch-readiness", label: "Readiness", icon: "!" },
];

export default function AdminSidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="relative flex-1 space-y-2 px-4">
      {navItems.map((item) => {
        const isActive =
          item.href === "/admin"
            ? pathname === "/admin"
            : pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`admin-nav-link ${isActive ? "is-active" : ""}`}
            aria-current={isActive ? "page" : undefined}
          >
            <span className="admin-nav-icon">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
