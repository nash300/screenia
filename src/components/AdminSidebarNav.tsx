"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { adminNavItems, complianceNavItems } from "@/lib/admin/navigation";

export default function AdminSidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="relative flex-1 space-y-2 px-4">
      {adminNavItems.map((item) => {
        const complianceActive = complianceNavItems.some(
          (complianceItem) =>
            pathname === complianceItem.href ||
            pathname.startsWith(`${complianceItem.href}/`),
        );
        const isActive =
          item.href === "/admin/compliance"
            ? pathname === "/admin/compliance" || complianceActive
            : item.href === "/admin"
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
