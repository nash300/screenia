"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: "D" },
  { href: "/admin/customers", label: "Customers", icon: "C" },
  { href: "/admin/orders", label: "Orders", icon: "O" },
  { href: "/admin/inventory", label: "Inventory", icon: "I" },
  { href: "/admin/devices", label: "Device Manager", icon: "M" },
  { href: "/admin/pricing", label: "Pricing", icon: "$" },
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
