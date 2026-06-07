"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

const titles: Record<string, string> = {
  "/admin": "Dashboard",
  "/admin/customers": "Customers",
  "/admin/inventory": "Inventory",
  "/admin/devices": "Devices",
  "/admin/devices/new": "Add Device",
};

export default function AdminPageTitle() {
  const pathname = usePathname();

  useEffect(() => {
    const title = titles[pathname] || "Admin";
    document.title = `${title} - InfoSync`;
  }, [pathname]);

  return null;
}
