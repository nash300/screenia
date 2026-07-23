export const adminNavItems = [
  {
    href: "/admin",
    label: "Dashboard",
    icon: "DB",
    description: "Daily overview, alerts, and setup health.",
  },
  {
    href: "/admin/customers",
    label: "Customer work",
    icon: "CU",
    description: "Requests, customer profiles, onboarding links, files, messages, and handoff.",
  },
  {
    href: "/admin/contact-inquiries",
    label: "Visitor messages",
    icon: "VM",
    description: "Contact form questions, replies, delivery status, and case progress.",
  },
  {
    href: "/admin/orders",
    label: "Orders & billing",
    icon: "OR",
    description: "Orders, Stripe payments, refunds, cancellations, invoices, and accounting exports.",
  },
  {
    href: "/admin/devices",
    label: "Displays",
    icon: "DS",
    description: "Display links, playlists, media, device assignment, and screen status.",
  },
  {
    href: "/admin/inventory",
    label: "Hardware stock",
    icon: "ST",
    description: "Physical devices, serial numbers, warranty, returns, repairs, and retirement.",
  },
  {
    href: "/admin/pricing",
    label: "Pricing",
    icon: "PR",
    description: "Plans, setup fees, device prices, shipping, VAT, and Stripe sync.",
  },
  {
    href: "/admin/site-content",
    label: "Site content",
    icon: "SC",
    description: "Hero slides, images, document pages, and public website text.",
  },
  {
    href: "/admin/training",
    label: "Training catalog",
    icon: "TR",
    description: "Reserved workspace for future Screenia training material.",
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
    title: "Customer work",
    hrefs: [
      "/admin",
      "/admin/customers",
      "/admin/contact-inquiries",
      "/admin/orders",
    ],
  },
  {
    title: "Service delivery",
    hrefs: ["/admin/devices", "/admin/inventory"],
  },
  {
    title: "Content and business",
    hrefs: ["/admin/pricing", "/admin/site-content", "/admin/training"],
  },
  {
    title: "System support",
    hrefs: ["/admin/troubleshooting"],
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
    href: "/admin/legal-documents",
    label: "Document editor",
    icon: "DO",
    description: "Terms, privacy, cookie, billing, and support pages shown to customers.",
  },
];
