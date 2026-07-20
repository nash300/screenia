import Link from "next/link";
import "../landing.css";

export default function SupportServicePolicyPage() {
  return (
    <div className="landing-page flow-page">
      <main className="flow-shell legal-shell">
        <p className="landing-eyebrow">Juridiskt dokument</p>
        <h1>Support och service</h1>
        <p>
          Screenia hjälper kunden med introduktion, skärmkonfiguration,
          innehållshantering och support. Denna förlanseringspolicy beskriver hur
          supportärenden och kundmaterial hanteras.
        </p>

        <section className="flow-card">
          <h2>Kontaktvägar</h2>
          <p>
            Kunden kontaktar Screenia via service@screenia.se eller kundportalen
            för frågor om innehåll, leverans, uppsägning, integritet eller
            betalning. Åtgärder som påverkar order, åtkomst eller kundens
            skyldigheter dokumenteras i ärendets historik.
          </p>
        </section>

        <section className="flow-card">
          <h2>Fjärrsupport och kundmaterial</h2>
          <p>
            Fjärrsupport genomförs endast när kunden har begärt eller godkänt
            den. Logotyper, bilder, texter, kampanjer och instruktioner som kunden
            lämnar används för att leverera Screenias tjänst och hanteras som
            kundens verksamhetsmaterial.
          </p>
        </section>

        <section className="flow-card">
          <h2>Spårbar och säker hantering</h2>
          <p>
            Ändringar som påverkar produktionsarbete, återbetalning,
            abonnemangsåtkomst, skärmvisning, kundradering eller betalning utförs
            genom behörighetskontrollerade åtgärder och sparas i revisionshistoriken.
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
