export const adminNavItems = [
  { href: "/admin", label: "Dashboard", icon: "D" },
  { href: "/admin/customers", label: "Customer work", icon: "C" },
  { href: "/admin/orders", label: "Orders & billing", icon: "O" },
  { href: "/admin/devices", label: "Displays", icon: "M" },
  { href: "/admin/inventory", label: "Hardware stock", icon: "I" },
  { href: "/admin/email-events", label: "Email log", icon: "E" },
  { href: "/admin/pricing", label: "Pricing", icon: "$" },
  { href: "/admin/launch-readiness", label: "Launch readiness", icon: "!" },
  { href: "/admin/compliance", label: "Compliance", icon: "K" },
];

export const adminNavGroups = [
  {
    title: "Daily work",
    hrefs: ["/admin", "/admin/customers", "/admin/orders"],
  },
  {
    title: "Service delivery",
    hrefs: ["/admin/devices", "/admin/inventory", "/admin/email-events"],
  },
  {
    title: "Business control",
    hrefs: ["/admin/pricing", "/admin/launch-readiness", "/admin/compliance"],
  },
];

export const complianceNavItems = [
  { href: "/admin/tax-payments", label: "Tax payments", icon: "T" },
  { href: "/admin/legal-change-notices", label: "Legal notices", icon: "L" },
  { href: "/admin/access-reviews", label: "Admin access", icon: "A" },
  { href: "/admin/backup-drills", label: "Recovery readiness", icon: "R" },
  { href: "/admin/data-retention", label: "Data retention", icon: "R" },
  { href: "/admin/processor-reviews", label: "Vendor reviews", icon: "V" },
  { href: "/admin/data-subject-requests", label: "Privacy requests", icon: "R" },
  { href: "/admin/privacy-incidents", label: "Incident response", icon: "!" },
];
