import Link from "next/link";
import "../landing.css";

export default function SubscriptionBillingPolicyPage() {
  return (
    <div className="landing-page flow-page">
      <main className="flow-shell legal-shell">
        <p className="landing-eyebrow">Juridiskt dokument</p>
        <h1>Abonnemang och betalning</h1>
        <p>
          Denna förlanseringspolicy beskriver hur Screenia hanterar priser,
          betalning, abonnemang, uppsägning, återbetalning och momsunderlag.
        </p>

        <section className="flow-card">
          <h2>Priser och första betalning</h2>
          <p>
            Angivna kundpriser inkluderar moms. Den första betalningen består av
            start- och konfigurationsavgift, priset för vald enhet per skärm samt
            frakt per skärm. Start- och konfigurationsavgiften är 1 599 kr för
            upp till tre skärmar. Från den fjärde skärmen tillkommer 249 kr per
            extra skärm. Betalningen genomförs säkert via Stripe.
          </p>
        </section>

        <section className="flow-card">
          <h2>Provperiod och månadsabonnemang</h2>
          <p>
            Månadsavgiften debiteras inte vid den första betalningen. Det valda
            månadsabonnemanget börjar debiteras när den 21 dagar långa
            provperioden är slut. Aktuell kommande debitering och
            abonnemangsstatus visas i kundportalen och hos Stripe.
          </p>
        </section>

        <section className="flow-card">
          <h2>Uppsägning och återbetalning</h2>
          <p>
            Ett abonnemang avslutas normalt vid slutet av den redan betalda
            perioden. Startavgiften kan återbetalas om beställningen avbryts
            innan Screenia har registrerat att layout- eller produktionsarbetet
            har startat. Därefter är startavgiften inte återbetalningsbar, om
            inte Screenia skriftligen beslutar om ett undantag.
          </p>
        </section>

        <section className="flow-card">
          <h2>Moms, kvitto och betalningsunderlag</h2>
          <p>
            Stripe tillhandahåller betalnings- och fakturaunderlag. Screenia
            sparar orderstatus, momsbelopp, betalningsreferenser, rabatter och
            återbetalningar för bokföring, support och spårbarhet. Testbetalningar
            hålls åtskilda från riktiga bokföringsunderlag.
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
