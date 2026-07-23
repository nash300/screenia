"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

const titles: Record<string, string> = {
  "/admin": "Dashboard",
  "/admin/customers": "Customer Work",
  "/admin/contact-inquiries": "Visitor Messages",
  "/admin/inventory": "Hardware Stock",
  "/admin/devices": "Displays",
  "/admin/devices/new": "Create Display Endpoint",
  "/admin/orders": "Orders & Billing",
  "/admin/pricing": "Pricing",
  "/admin/site-content": "Site Content",
  "/admin/landing-content": "Hero Editor",
  "/admin/legal-documents": "Document Editor",
  "/admin/email-events": "Email Delivery",
  "/admin/training": "Training Catalog",
  "/admin/troubleshooting": "Troubleshooting",
};

const sectionTitles: Record<string, string> = {
  overview: "Overview",
  onboarding: "Request & Quote",
  communication: "Communication & Material",
  messages: "Messages",
  uploads: "Uploads",
  orders: "Orders & Billing",
  devices: "Device Allocation",
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
