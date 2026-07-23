import Link from "next/link";
import { siteContentNavItems } from "@/lib/admin/navigation";

export default function SiteContentPage() {
  return (
    <main className="admin-site-content-page">
      <header className="admin-page-header">
        <div>
          <p className="admin-operation-kicker">Website editing</p>
          <h1 className="admin-title">Site content</h1>
          <p className="admin-subtitle">
            Edit customer-facing website content from one place. Keep public text,
            images, legal documents, and policy pages clear before publishing.
          </p>
        </div>
      </header>

      <section className="admin-content-hub-grid">
        {siteContentNavItems.map((item) => (
          <Link key={item.href} href={item.href} className="admin-content-hub-card">
            <span className="admin-nav-icon" aria-hidden="true">{item.icon}</span>
            <span>
              <strong>{item.label}</strong>
              <small>{item.description}</small>
            </span>
          </Link>
        ))}
      </section>
    </main>
  );
}
