"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const labels: Record<string, string> = {
  admin: "Admin",
  customers: "Customers",
  orders: "Orders",
  inventory: "Inventory",
  devices: "Device Manager",
  pricing: "Pricing",
  subscriptions: "Subscriptions",
  new: "New",
};

function labelForSegment(segment: string) {
  return labels[segment] || segment.replace(/-/g, " ");
}

export default function AdminBreadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  if (segments[0] !== "admin") return null;

  const crumbs = segments.map((segment, index) => {
    const href = `/${segments.slice(0, index + 1).join("/")}`;
    const isLast = index === segments.length - 1;
    const label =
      index > 1 && /^[0-9a-f-]{20,}$/i.test(segment)
        ? "Customer details"
        : labelForSegment(segment);

    return { href, isLast, label };
  });

  return (
    <nav className="admin-breadcrumbs" aria-label="Breadcrumb">
      {crumbs.map((crumb, index) => (
        <span key={crumb.href} className="admin-breadcrumb-item">
          {index > 0 && <span className="admin-breadcrumb-separator">/</span>}
          {crumb.isLast ? (
            <span className="admin-breadcrumb-current">{crumb.label}</span>
          ) : (
            <Link href={crumb.href}>{crumb.label}</Link>
          )}
        </span>
      ))}
    </nav>
  );
}
