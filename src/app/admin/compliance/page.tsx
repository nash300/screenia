import Link from "next/link";
import { complianceNavItems } from "@/lib/admin/navigation";

const groups = [
  {
    title: "Accounting and policy records",
    description: "VAT filing evidence, legal-change notices, and retention reviews.",
    hrefs: [
      "/admin/tax-payments",
      "/admin/legal-change-notices",
      "/admin/data-retention",
    ],
  },
  {
    title: "Privacy and access control",
    description: "GDPR requests, incident response, and admin access reviews.",
    hrefs: [
      "/admin/data-subject-requests",
      "/admin/privacy-incidents",
      "/admin/access-reviews",
    ],
  },
  {
    title: "Vendor and recovery control",
    description: "Processor reviews and recovery evidence for launch readiness.",
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
                    <span className="admin-nav-icon" aria-hidden="true">
                      {item.icon}
                    </span>
                    <span>
                      <strong>{item.label}</strong>
                      <small>{item.description}</small>
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
