"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const labels: Record<string, string> = {
  admin: "Admin",
  customers: "Customers",
  compliance: "Compliance",
  orders: "Orders & billing",
  inventory: "Hardware stock",
  devices: "Displays",
  pricing: "Pricing",
  subscriptions: "Subscriptions",
  "email-events": "Email Evidence",
  "launch-readiness": "Readiness",
  "tax-payments": "Moms/VAT Filing",
  "legal-change-notices": "Legal Notices",
  "access-reviews": "Admin Access",
  "backup-drills": "Recovery Readiness",
  "data-retention": "Data Retention",
  "processor-reviews": "Vendor Reviews",
  "data-subject-requests": "Privacy Requests",
  "privacy-incidents": "Incident Response",
  new: "New",
};

const sectionLabels: Record<string, string> = {
  overview: "Overview",
  onboarding: "Request & quote",
  communication: "Communication & material",
  messages: "Messages",
  uploads: "Uploads",
  orders: "Orders",
  devices: "Device allocation",
  history: "History",
  details: "Details",
  preview: "Preview",
  media: "Media",
  display: "Display URL",
};

function labelForSegment(segment: string) {
  return labels[segment] || segment.replace(/-/g, " ");
}

export default function AdminBreadcrumbs() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
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

  const section = searchParams.get("section");
  const view = searchParams.get("view");
  const sectionCrumbs = [
    section
      ? {
          href: `${pathname}?section=${section}`,
          isLast: !view,
          label: sectionLabels[section] || labelForSegment(section),
        }
      : null,
    view
      ? {
          href: `${pathname}?section=${section || "communication"}&view=${view}`,
          isLast: true,
          label: sectionLabels[view] || labelForSegment(view),
        }
      : null,
  ].filter(Boolean) as Array<{ href: string; isLast: boolean; label: string }>;

  const allCrumbs = sectionCrumbs.length
    ? crumbs.map((crumb) => ({ ...crumb, isLast: false })).concat(sectionCrumbs)
    : crumbs;

  return (
    <nav className="admin-breadcrumbs" aria-label="Breadcrumb">
      {allCrumbs.map((crumb, index) => (
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
