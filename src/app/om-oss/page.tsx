import type { Metadata } from "next";
import Image from "next/image";
import { LandingNav } from "@/components/LandingNav";
import { LandingScrollReveal } from "@/components/LandingScrollReveal";
import { createPublicPageMetadata, serializeJsonLd } from "@/lib/seo";
import "../public-info.css";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://screenia.se";

export const metadata: Metadata = createPublicPageMetadata({
  path: "/om-oss",
  title: "Om Screenia och vår digitala skyltning",
  description:
    "Lär känna Screenia och hur vi hjälper företag i Sverige att synas tydligare med enkel digital skyltning.",
  keywords: [
    "om Screenia",
    "digital skyltning Sverige",
    "digital signage företag",
    "skärmlösningar småföretag",
    "Screenia vision",
  ],
  image: "/landing/free-source/retail-digital-signage.jpg",
  imageAlt: "Digitala informationsskärmar i en butiksmiljö",
});

const beliefs = [
  ["spark", "Tydligt från start", "Du vet vad som händer och vad det kostar."],
  ["screen", "Innehåll som syns", "Vi hjälper dig visa rätt budskap i lokalen."],
  ["growth", "Växer med dig", "Lägg till skärmar när verksamheten växer."],
] as const;

const steps = [
  ["1", "Välj", "Berätta hur många skärmar du behöver och välj Standard eller Premium. Du ser hela startkostnaden och månadspriset innan du beställer.", "cart"],
  ["2", "Förbered", "Efter betalningen skapar du ditt konto och laddar upp logo, prislista, bilder och annat du vill visa.", "upload"],
  ["3", "Syns", "Vi går igenom materialet tillsammans med dig och gör visningen redo för din verksamhet.", "spark"],
] as const;

function AboutIcon({ name }: { name: "spark" | "screen" | "growth" | "cart" | "upload" }) {
  const paths = {
    spark: <><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" /><path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z" /></>,
    screen: <><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8M12 17v4" /></>,
    growth: <><path d="M4 19V9M10 19V5M16 19v-7M22 19V3" /><path d="m4 7 5-3 6 3 6-4" /></>,
    cart: <><path d="M3 4h2l2.2 10.2a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 1.9-1.4L20 8H6" /><circle cx="10" cy="20" r="1" /><circle cx="18" cy="20" r="1" /></>,
    upload: <><path d="M12 16V4m0 0L8 8m4-4 4 4" /><path d="M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" /></>,
  } as const;
  return <svg className="about-card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

export default function AboutPage() {
  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "AboutPage",
      "@id": `${siteUrl}/om-oss#webpage`,
      url: `${siteUrl}/om-oss`,
      name: "Om Screenia",
      description: metadata.description,
      inLanguage: "sv-SE",
      isPartOf: {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        name: "Screenia",
        url: siteUrl,
      },
      about: {
        "@id": `${siteUrl}/#organization`,
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Startsida",
          item: siteUrl,
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "Om oss",
          item: `${siteUrl}/om-oss`,
        },
      ],
    },
  ];

  return (
    <div className="landing-page about-page public-info-page">
      <LandingNav currentPath="/om-oss" />
      <LandingScrollReveal />

      <main className="about-main">
        <section className="about-hero">
          <div className="about-hero-copy">
            <p className="landing-eyebrow">Om Screenia</p>
            <h1>Vi gör digital skyltning enklare för företag som vill synas bättre.</h1>
            <p>
              Vi hjälper verksamheter att visa menyer, priser, kampanjer och
              information på skärm – tydligt, snyggt och enkelt.
            </p>
          </div>

          <div className="about-hero-background" aria-hidden="true">
            <Image
              src="/landing/free-source/retail-digital-signage.jpg"
              alt=""
              fill
              sizes="100vw"
              priority
            />
          </div>

          <div className="about-hero-visual" aria-label="Exempel på Screenias skärmhantering">
            <div className="about-hero-dashboard">
              <div className="about-hero-dashboard-topline">
                <span className="about-hero-live"><i /> LIVE</span>
                <span>SCREENIA / ÖVERSIKT</span>
              </div>
              <div className="about-hero-dashboard-screen">
                <span className="about-hero-dashboard-kicker">DAGENS INNEHÅLL</span>
                <strong>Syns tydligare.<br />Sälj mer.</strong>
                <div className="about-hero-dashboard-bars" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
              <div className="about-hero-dashboard-stats">
                <span><b>Alltid</b> aktiv visning</span>
                <span><b>Klar</b> kommunikation</span>
              </div>
            </div>
          </div>
        </section>

        <section className="about-beliefs" aria-label="Det här får du med Screenia">
          {beliefs.map(([icon, title, text]) => (
            <article className="about-belief" key={title}>
              <AboutIcon name={icon} />
              <h2>{title}</h2>
              <p>{text}</p>
            </article>
          ))}
        </section>

        <section className="about-story" aria-labelledby="about-story-title">
          <div className="about-section-heading">
            <p className="landing-eyebrow">Om Screenia</p>
            <h2 id="about-story-title">En tydligare väg från idé till synlighet.</h2>
            <p>Du ska kunna fokusera på din verksamhet medan din skärm gör jobbet i bakgrunden.</p>
          </div>
          <div className="about-story-grid">
            <article className="about-story-card">
              <AboutIcon name="spark" />
              <h3>Vår idé</h3>
              <p>Vi gör digital skyltning lättare för företag som vill visa mer, sälja bättre och skapa en trevligare kundupplevelse.</p>
            </article>
            <article className="about-story-card">
              <AboutIcon name="growth" />
              <h3>Vår vision</h3>
              <p>Varje företag ska kunna kommunicera tydligt med en skärm som känns relevant, levande och enkel att uppdatera.</p>
            </article>
            <article className="about-story-card">
              <AboutIcon name="screen" />
              <h3>Vår lösning</h3>
              <p>Vi samlar paket, innehåll och personlig hjälp i ett lugnt flöde – så att du alltid vet vad nästa steg är.</p>
            </article>
          </div>
          <div className="about-story-highlight">
            <AboutIcon name="spark" />
            <div>
              <h3>Därför känns Screenia enklare</h3>
              <p>Du får tydliga priser, hjälp när du behöver den och en visning som är byggd för just din vardag.</p>
            </div>
          </div>
        </section>

        <section className="about-strategy">
          <div className="about-section-heading">
            <p className="landing-eyebrow">Så fungerar det</p>
            <h2>Från idé till skärm på ett enkelt sätt.</h2>
          </div>
          <div className="about-strategy-grid">
            {steps.map(([number, title, text, icon]) => (
              <article className="about-strategy-card" key={number}>
                <div className="about-step-topline"><span>{number}</span><AboutIcon name={icon} /></div>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="about-closing">
          <AboutIcon name="spark" />
          <p className="landing-eyebrow">Screenia</p>
          <h2>Tydligare budskap. Enklare vardag.</h2>
          <p>Gör mer av skärmen du redan har och låt ditt erbjudande synas där det räknas.</p>
        </section>
      </main>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(structuredData) }}
      />
    </div>
  );
}
