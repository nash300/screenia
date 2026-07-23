"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  adminNavGroups,
  adminNavItems,
  complianceNavItems,
  siteContentNavItems,
} from "@/lib/admin/navigation";

export default function AdminSidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="relative flex-1 overflow-y-auto px-4 pb-4">
      {adminNavGroups.map((group) => (
        <section key={group.title} className="admin-nav-group">
          <p className="admin-nav-group-title">{group.title}</p>
          <div className="space-y-2">
            {adminNavItems
              .filter((item) => group.hrefs.includes(item.href))
              .map((item) => {
                const complianceActive = complianceNavItems.some(
                  (complianceItem) =>
                    pathname === complianceItem.href ||
                    pathname.startsWith(`${complianceItem.href}/`),
                );
                const siteContentActive = siteContentNavItems.some(
                  (contentItem) =>
                    pathname === contentItem.href ||
                    pathname.startsWith(`${contentItem.href}/`),
                );
                const isActive =
                  item.href === "/admin/compliance"
                    ? pathname === "/admin/compliance" || complianceActive
                    : item.href === "/admin/site-content"
                    ? pathname === "/admin/site-content" || siteContentActive
                    : item.href === "/admin"
                    ? pathname === "/admin"
                    : pathname === item.href ||
                      pathname.startsWith(`${item.href}/`);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`admin-nav-link ${isActive ? "is-active" : ""}`}
                    aria-current={isActive ? "page" : undefined}
                  >
                    <span className="admin-nav-icon" aria-hidden="true">
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </Link>
                );
              })}
          </div>
        </section>
      ))}
    </nav>
  );
}
