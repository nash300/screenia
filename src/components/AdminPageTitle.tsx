"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

const titles: Record<string, string> = {
  "/admin": "Dashboard",
  "/admin/customers": "Customers",
  "/admin/inventory": "Inventory",
  "/admin/devices": "Devices",
  "/admin/devices/new": "Add Device",
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
