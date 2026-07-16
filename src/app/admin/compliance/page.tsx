import Link from "next/link";
import { complianceNavItems } from "@/lib/admin/navigation";

const groups = [
  {
    title: "Business records",
    description: "Periodic VAT filing evidence, legal changes, and retention.",
    hrefs: [
      "/admin/tax-payments",
      "/admin/legal-change-notices",
      "/admin/data-retention",
    ],
  },
  {
    title: "Privacy and security",
    description: "GDPR requests, incidents, and admin access checks.",
    hrefs: [
      "/admin/data-subject-requests",
      "/admin/privacy-incidents",
      "/admin/access-reviews",
    ],
  },
  {
    title: "Infrastructure controls",
    description: "Vendor reviews and recovery evidence for launch readiness.",
    hrefs: ["/admin/processor-reviews", "/admin/backup-drills"],
  },
];

export default function AdminCompliancePage() {
  return (
    <div className="admin-compliance-page">
      <div className="admin-page-header">
        <h1 className="admin-title">Compliance</h1>
        <p className="admin-subtitle">
          Business-control workflows for VAT, legal changes, privacy, security,
          vendors, and recovery evidence.
        </p>
      </div>

      <section className="admin-compliance-summary admin-card p-6">
        <div>
          <p className="admin-operation-kicker">Business control</p>
          <h2 className="admin-card-title text-xl">Evidence without clutter</h2>
          <p className="admin-muted">
            These workflows support launch readiness, GDPR, accounting, and
            operational evidence without crowding daily customer work.
          </p>
        </div>
      </section>

      <div className="admin-compliance-grid">
        {groups.map((group) => (
          <section key={group.title} className="admin-card admin-compliance-group p-6">
            <div className="admin-compliance-group-header">
              <div>
                <h2 className="admin-card-title text-xl">{group.title}</h2>
                <p className="admin-muted">{group.description}</p>
              </div>
            </div>

            <div className="admin-compliance-links">
              {complianceNavItems
                .filter((item) => group.hrefs.includes(item.href))
                .map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="admin-compliance-link"
                  >
                    <span className="admin-nav-icon">{item.icon}</span>
                    <span>
                      <strong>{item.label}</strong>
                      <small>{describeComplianceItem(item.href)}</small>
                    </span>
                  </Link>
                ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function describeComplianceItem(href: string) {
  switch (href) {
    case "/admin/tax-payments":
      return "VAT/moms filing periods, payment status, and audit evidence";
    case "/admin/legal-change-notices":
      return "Policy notice workflow and customer re-acceptance tracking";
    case "/admin/data-retention":
      return "Retention, anonymization, and deletion review workflow";
    case "/admin/data-subject-requests":
      return "GDPR access, deletion, export, or correction requests";
    case "/admin/privacy-incidents":
      return "Security/privacy incident response workflow";
    case "/admin/access-reviews":
      return "Admin access, MFA, and removal review workflow";
    case "/admin/processor-reviews":
      return "Vendor approval, DPA, ownership, and security evidence";
    case "/admin/backup-drills":
      return "Backup coverage, restore tests, and recovery evidence";
    default:
      return "Compliance workflow";
  }
}
