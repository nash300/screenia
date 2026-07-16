export const adminNavItems = [
  {
    href: "/admin",
    label: "Dashboard",
    icon: "DB",
    description: "Operational overview, urgent work, and setup health.",
  },
  {
    href: "/admin/customers",
    label: "Customer work",
    icon: "CU",
    description: "Requests, onboarding links, customer details, account setup, messages, and uploads.",
  },
  {
    href: "/admin/orders",
    label: "Orders & billing",
    icon: "OR",
    description: "Quotes, Stripe status, refunds, cancellation, and accounting exports.",
  },
  {
    href: "/admin/email-events",
    label: "Email log",
    icon: "EM",
    description: "Transactional email delivery, failures, bounces, and customer communication evidence.",
  },
  {
    href: "/admin/devices",
    label: "Displays",
    icon: "DS",
    description: "Customer display endpoints, playlists, screen URLs, and content readiness.",
  },
  {
    href: "/admin/inventory",
    label: "Hardware stock",
    icon: "ST",
    description: "Physical boxes, serial numbers, purchase data, warranty, returns, repair, and retirement.",
  },
  {
    href: "/admin/pricing",
    label: "Pricing",
    icon: "PR",
    description: "Packages, included VAT, setup fees, device prices, shipping, and Stripe sync.",
  },
  {
    href: "/admin/launch-readiness",
    label: "Launch readiness",
    icon: "RD",
    description: "Operational gates before live payments and public launch.",
  },
  {
    href: "/admin/compliance",
    label: "Compliance",
    icon: "CO",
    description: "VAT filing, legal notices, privacy requests, incidents, vendors, and recovery evidence.",
  },
];

export const adminNavGroups = [
  {
    title: "Customer operations",
    hrefs: ["/admin", "/admin/customers", "/admin/orders", "/admin/email-events"],
  },
  {
    title: "Service delivery",
    hrefs: ["/admin/devices", "/admin/inventory"],
  },
  {
    title: "Business control",
    hrefs: ["/admin/pricing", "/admin/launch-readiness", "/admin/compliance"],
  },
];

export const complianceNavItems = [
  {
    href: "/admin/tax-payments",
    label: "VAT filing",
    icon: "VA",
    description: "VAT/moms filing periods, payment status, and audit evidence",
  },
  {
    href: "/admin/legal-change-notices",
    label: "Legal notices",
    icon: "LE",
    description: "Policy notices and customer re-acceptance tracking",
  },
  {
    href: "/admin/access-reviews",
    label: "Admin access",
    icon: "AC",
    description: "Admin access, MFA, and removal review workflow",
  },
  {
    href: "/admin/backup-drills",
    label: "Recovery readiness",
    icon: "RE",
    description: "Backup coverage, restore tests, and recovery evidence",
  },
  {
    href: "/admin/data-retention",
    label: "Data retention",
    icon: "DR",
    description: "Retention, anonymization, and deletion review workflow",
  },
  {
    href: "/admin/processor-reviews",
    label: "Vendor reviews",
    icon: "VE",
    description: "Vendor approval, DPA, ownership, and security evidence",
  },
  {
    href: "/admin/data-subject-requests",
    label: "Privacy requests",
    icon: "PR",
    description: "GDPR access, deletion, export, or correction requests",
  },
  {
    href: "/admin/privacy-incidents",
    label: "Incident response",
    icon: "IR",
    description: "Security and privacy incident response workflow",
  },
];
