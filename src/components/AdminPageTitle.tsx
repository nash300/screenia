"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

const titles: Record<string, string> = {
  "/admin": "Dashboard",
  "/admin/customers": "Customer Work",
  "/admin/compliance": "Compliance",
  "/admin/inventory": "Hardware Stock",
  "/admin/devices": "Displays",
  "/admin/devices/new": "Create Customer Display",
  "/admin/orders": "Orders & Billing",
  "/admin/pricing": "Pricing",
  "/admin/email-events": "Email Log",
  "/admin/launch-readiness": "Launch Readiness",
  "/admin/tax-payments": "VAT Filing",
  "/admin/legal-change-notices": "Legal Notices",
  "/admin/access-reviews": "Admin Access",
  "/admin/backup-drills": "Recovery Readiness",
  "/admin/data-retention": "Data Retention",
  "/admin/processor-reviews": "Vendor Reviews",
  "/admin/data-subject-requests": "Privacy Requests",
  "/admin/privacy-incidents": "Incident Response",
};

const sectionTitles: Record<string, string> = {
  overview: "Overview",
  onboarding: "Request & Onboarding",
  communication: "Communication",
  messages: "Messages",
  uploads: "Uploads",
  orders: "Orders & Billing",
  devices: "Displays & Hardware",
  history: "Audit Trail",
  details: "Details",
  preview: "Preview",
  media: "Media",
  display: "Display URL",
};

export default function AdminPageTitle() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const section = searchParams.get("view") || searchParams.get("section");
    const title = section
      ? `${sectionTitles[section] || section} - ${titles[pathname] || "Admin"}`
      : titles[pathname] || "Admin";
    document.title = `${title} - Screenia`;
  }, [pathname, searchParams]);

  return null;
}
