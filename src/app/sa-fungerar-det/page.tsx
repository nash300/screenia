import Link from "next/link";
import "../landing.css";

const steps = [
  [
    "1",
    "Välj paket",
    "Du väljer det paket som passar ditt företag och skickar en förfrågan.",
  ],
  [
    "2",
    "Slutför uppsättning",
    "Du bekräftar uppgifter, laddar upp material och går vidare till betalning.",
  ],
  [
    "3",
    "Vi förbereder hårdvaran",
    "InfoSync skapar skärminnehållet och skickar den förkonfigurerade enheten.",
  ],
  [
    "4",
    "Koppla in och starta",
    "När enheten kommer ansluter du den till HDMI och Wi-Fi.",
  ],
  [
    "5",
    "Begär uppdateringar",
    "Du kan skicka nytt material eller ändringar när innehållet behöver uppdateras.",
  ],
] as const;

export default function HowItWorksPage() {
  return (
    <div className="landing-page flow-page">
      <header className="flow-nav account-nav">
        <Link className="landing-brand" href="/">
          <img src="/brand/infosync-logo-full-transparent.png" alt="InfoSync" />
        </Link>
        <Link className="landing-button landing-button-secondary" href="/">
          Till startsidan
        </Link>
      </header>

      <main className="account-shell">
        <section className="account-hero">
          <div>
            <p className="landing-eyebrow">Så fungerar det</p>
            <h1>Från förfrågan till live skärm.</h1>
            <p>
              Här kommer du kunna lägga mer information om tjänsten, processen,
              leveransen och hur kunder använder InfoSync.
            </p>
          </div>
        </section>

        <section className="account-card">
          <img
            className="landing-workflow-banner"
            src="/brand/how-it-works-sv-banner.png"
            alt="InfoSync process"
          />
        </section>

        <section className="account-grid">
          {steps.map(([number, title, text]) => (
            <article key={number} className="account-card">
              <span className="account-status">{number}</span>
              <h2>{title}</h2>
              <p>{text}</p>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}
