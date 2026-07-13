"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

const titles: Record<string, string> = {
  "/admin": "Dashboard",
  "/admin/customers": "Customers",
  "/admin/compliance": "Compliance",
  "/admin/inventory": "Inventory",
  "/admin/devices": "Devices",
  "/admin/devices/new": "Add Device",
  "/admin/orders": "Orders",
  "/admin/pricing": "Pricing",
  "/admin/email-events": "Email Events",
  "/admin/launch-readiness": "Readiness",
  "/admin/tax-payments": "Tax Payments",
  "/admin/legal-change-notices": "Legal Notices",
  "/admin/access-reviews": "Admin Access",
  "/admin/backup-drills": "Backup Drills",
  "/admin/data-retention": "Data Retention",
  "/admin/processor-reviews": "Processors",
  "/admin/data-subject-requests": "Privacy Requests",
  "/admin/privacy-incidents": "Incident Register",
};

const sectionTitles: Record<string, string> = {
  overview: "Overview",
  onboarding: "Onboarding",
  communication: "Communication",
  messages: "Messages",
  uploads: "Uploads",
  orders: "Orders",
  devices: "Devices",
  history: "History",
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
