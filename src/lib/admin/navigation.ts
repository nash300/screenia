export const adminNavItems = [
  {
    href: "/admin",
    label: "Overview",
    icon: "DB",
    description: "Start here and continue the next customer task.",
  },
  {
    href: "/admin/customers",
    label: "Customers",
    icon: "CU",
    description: "Requests, profiles, onboarding, files, and delivery progress.",
  },
  {
    href: "/admin/contact-inquiries",
    label: "Messages",
    icon: "VM",
    description: "Read and answer website enquiries.",
  },
  {
    href: "/admin/orders",
    label: "Orders & payments",
    icon: "OR",
    description: "Orders, payments, refunds, invoices, and exports.",
  },
  {
    href: "/admin/devices",
    label: "Displays",
    icon: "DS",
    description: "Display links, playlists, media, device assignment, and screen status.",
  },
  {
    href: "/admin/inventory",
    label: "Hardware",
    icon: "ST",
    description: "Stock, serial numbers, assignments, returns, and repairs.",
  },
  {
    href: "/admin/pricing",
    label: "Pricing & VAT",
    icon: "PR",
    description: "Plans, fees, shipping, VAT, and Stripe sync.",
  },
  {
    href: "/admin/site-content",
    label: "Website",
    icon: "SC",
    description: "Public pages, images, examples, and documents.",
  },
  {
    href: "/admin/services",
    label: "Service connections",
    icon: "SV",
    description: "Review Screenia's connected payment, hosting, database, email, domain, and code services.",
  },
  {
    href: "/admin/troubleshooting",
    label: "Troubleshooting",
    icon: "TS",
    description: "Diagnostic tools used only when investigating technical problems.",
  },
];

export const adminNavGroups = [
  {
    title: "Daily work",
    defaultOpen: true,
    hrefs: [
      "/admin",
      "/admin/customers",
      "/admin/contact-inquiries",
      "/admin/orders",
    ],
  },
  {
    title: "Delivery",
    defaultOpen: false,
    hrefs: ["/admin/devices", "/admin/inventory"],
  },
  {
    title: "Business",
    defaultOpen: false,
    hrefs: [
      "/admin/pricing",
      "/admin/site-content",
    ],
  },
  {
    title: "System",
    defaultOpen: false,
    hrefs: ["/admin/services", "/admin/troubleshooting"],
  },
];

export const siteContentNavItems = [
  {
    href: "/admin/landing-content",
    label: "Hero editor",
    icon: "HE",
    description: "Hero slides, background images, yellow highlights, and rotating cards.",
  },
  {
    href: "/admin/example-gallery",
    label: "Example gallery",
    icon: "EG",
    description: "Portrait and landscape MP4 previews shown in the moving public gallery.",
  },
  {
    href: "/admin/legal-documents",
    label: "Document editor",
    icon: "DO",
    description: "Terms, privacy, cookie, billing, and support pages shown to customers.",
  },
];
