import Link from "next/link";
import { complianceNavItems } from "@/lib/admin/navigation";

const groups = [
  {
    title: "Business records",
    description: "Periodic evidence for taxes, legal changes, and retention.",
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
    description: "Processors and backup/restore evidence for launch readiness.",
    hrefs: ["/admin/processor-reviews", "/admin/backup-drills"],
  },
];

export default function AdminCompliancePage() {
  return (
    <div className="admin-compliance-page">
      <div className="admin-page-header">
        <h1 className="admin-title">Compliance</h1>
        <p className="admin-subtitle">
          Occasional audit, privacy, tax, and governance tools grouped away from
          daily customer operations.
        </p>
      </div>

      <section className="admin-compliance-summary admin-card p-6">
        <div>
          <p className="admin-operation-kicker">Quiet workspace</p>
          <h2 className="admin-card-title text-xl">Use only when needed</h2>
          <p className="admin-muted">
            These registers support launch readiness, GDPR, accounting, and
            operational evidence. They stay available without crowding the main
            sidebar.
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
      return "VAT/moms period evidence and payment status";
    case "/admin/legal-change-notices":
      return "Policy version changes and customer notice tracking";
    case "/admin/data-retention":
      return "Retention, anonymization, and deletion review records";
    case "/admin/data-subject-requests":
      return "GDPR access, deletion, export, or correction requests";
    case "/admin/privacy-incidents":
      return "Security/privacy incident response register";
    case "/admin/access-reviews":
      return "Admin access and MFA review evidence";
    case "/admin/processor-reviews":
      return "Supplier processor and DPA review evidence";
    case "/admin/backup-drills":
      return "Backup verification and restore drill records";
    default:
      return "Compliance register";
  }
}
