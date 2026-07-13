import Link from "next/link";
import "../landing.css";

export default function CookiePolicyPage() {
  return (
    <div className="landing-page flow-page">
      <main className="flow-shell legal-shell">
        <p className="landing-eyebrow">Juridiskt dokument</p>
        <h1>Cookiepolicy</h1>
        <p>
          Screenia anvander nodvandiga tekniska cookies och webblagring for
          inloggning, kontosakerhet, betalningsflode, kundportal och
          skarmvisning. Analys, marknadsforingspixlar, remarketing eller annan
          icke-nodvandig sparning far inte aktiveras utan ett tydligt samtycke.
        </p>

        <section className="flow-card">
          <h2>Nodvandig teknik</h2>
          <p>
            Nodvandiga cookies och sessionsdata kan anvandas for Supabase
            autentisering, adminsakerhet, betalningssessioner, forebyggande av
            missbruk och drift av kundportalen. Dessa behovs for att tjansten
            ska fungera sakert.
          </p>
        </section>

        <section className="flow-card">
          <h2>Icke-nodvandig sparning</h2>
          <p>
            Screenia ska halla analysverktyg, marknadsforingspixlar,
            remarketing och liknande sparning avstangd tills det finns ett
            aktivt samtycke, ett dokumenterat andamal och en mojlighet att
            neka eller aterkalla samtycket.
          </p>
        </section>

        <section className="flow-card">
          <h2>Uppdateringar</h2>
          <p>
            Om Screenia senare borjar anvanda frivillig analys eller
            marknadsforing ska denna policy uppdateras innan tekniken aktiveras
            for besokare eller kunder.
          </p>
        </section>

        <div className="account-actions">
          <Link href="/" className="landing-button landing-button-primary">
            Till startsidan
          </Link>
        </div>
      </main>
    </div>
  );
}
