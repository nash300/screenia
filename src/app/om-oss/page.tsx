import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { LandingNav } from "@/components/LandingNav";
import { LandingScrollReveal } from "@/components/LandingScrollReveal";
import "../landing.css";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://screenia.se";

export const metadata: Metadata = {
  title: "Om Screenia | Digital skyltning för lokala företag",
  description:
    "Lär känna Screenia, vår vision och hur vi hjälper lokala företag i Sverige att använda digital skyltning utan tekniskt krångel.",
  keywords: [
    "om Screenia",
    "digital skyltning Sverige",
    "digital signage företag",
    "skärmlösningar småföretag",
    "Screenia vision",
  ],
  alternates: {
    canonical: "/om-oss",
    languages: {
      "sv-SE": "/om-oss",
    },
  },
  openGraph: {
    title: "Om Screenia | Digital skyltning för lokala företag",
    description:
      "Screenia gör professionell digital skyltning enkel, tydlig och tillgänglig för lokala företag.",
    url: "/om-oss",
    siteName: "Screenia",
    locale: "sv_SE",
    type: "website",
    images: [
      {
        url: "/brand/screenia-pricing-devices.png",
        width: 1200,
        height: 630,
        alt: "Screenia digital skyltning och skärmenheter",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Om Screenia | Digital skyltning för lokala företag",
    description:
      "Vår vision är att göra digital skyltning lika enkel att använda som den är effektiv att se.",
    images: ["/brand/screenia-pricing-devices.png"],
  },
};

const beliefs = [
  ["Tydlighet före teknik", "Kunden ska förstå nästa steg, kostnaden och resultatet utan att behöva tolka tekniska begrepp."],
  ["Professionellt från början", "En lokal verksamhet ska kunna se modern och välorganiserad ut även utan en egen marknadsavdelning."],
  ["Rimliga kostnader", "Digital skyltning ska vara möjlig att testa och utveckla utan långa bindningar eller onödigt komplicerade avtal."],
] as const;

const values = [
  ["Enkelhet", "Vi skalar bort tekniskt brus och bygger flöden som är lätta att följa för både kund och administratör."],
  ["Noggrannhet", "Beställningar, betalningar, innehåll och status ska vara spårbara, tydliga och lätta att kontrollera."],
  ["Förtroende", "Vi arbetar med transparens kring priser, villkor, leverans och vad kunden faktiskt får."],
  ["Utveckling", "Tjänsten ska växa steg för steg med verkliga kundbehov, inte med funktioner som bara ser bra ut på papper."],
] as const;

const strategy = [
  ["1", "Starta smalt", "Vi fokuserar först på företag som har tydliga visuella behov: restauranger, salonger, butiker och serviceverksamheter."],
  ["2", "Göra flödet tryggt", "Förfrågan, onboarding, betalning, innehåll och support ska sitta ihop i ett kontrollerat arbetsflöde."],
  ["3", "Bygga för upprepning", "När processerna fungerar stabilt kan fler skärmar, fler kunder och fler innehållstyper hanteras utan att kvaliteten sjunker."],
] as const;

const proofPoints = [
  ["3 veckor", "kostnadsfri provperiod"],
  ["0 månader", "bindningstid"],
  ["FHD eller 4K", "paket efter behov"],
  ["Sverige", "byggt för lokala företag"],
] as const;

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
        "@type": "Organization",
        name: "Screenia",
        url: siteUrl,
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
    <div className="landing-page about-page">
      <LandingNav currentPath="/om-oss" />
      <LandingScrollReveal />

      <main className="about-main">
        <section className="about-hero">
          <div className="about-hero-copy">
            <p className="landing-eyebrow">Om Screenia</p>
            <h1>Vi gör digital skyltning enklare för företag som vill synas bättre.</h1>
            <p>
              Screenia är byggt för verksamheter som vill visa menyer, priser,
              kampanjer och information på skärm utan att fastna i tekniska
              system, dyra installationer eller otydliga leverantörsflöden.
            </p>
            <div className="about-hero-actions">
              <Link href="/#pricing" className="landing-button landing-button-primary">
                Se paket
              </Link>
              <Link href="/sa-fungerar-det" className="landing-button landing-button-secondary">
                Se fördelar
              </Link>
            </div>
          </div>

          <div className="about-hero-visual" aria-label="Screenia skärmvisning">
            <Image
              src="/brand/screenia-pricing-devices.png"
              alt="Screenia enheter för digital skyltning"
              width={1400}
              height={900}
              priority
            />
            <div className="about-hero-stat">
              <strong>Från idé till skärm</strong>
              <span>En tydlig process för innehåll, betalning och start.</span>
            </div>
          </div>
        </section>

        <section className="about-beliefs" aria-label="Vad Screenia tror på">
          {beliefs.map(([title, text]) => (
            <article className="about-belief" key={title}>
              <h2>{title}</h2>
              <p>{text}</p>
            </article>
          ))}
        </section>

        <section className="about-story">
          <div className="about-story-panel">
            <p className="landing-eyebrow">Vår vision</p>
            <h2>Digital skyltning ska vara lika enkel att använda som den är effektiv att se.</h2>
            <p>
              Många mindre företag har redan en TV, en meny, en prislista eller
              kampanjidé, men saknar tid och tekniskt stöd för att göra det
              snyggt på skärm. Vår vision är att göra den vägen kortare:
              från första förfrågan till en färdig visning som känns modern,
              tydlig och relevant för kundens lokal.
            </p>
          </div>
          <div className="about-story-panel about-story-panel-dark">
            <p className="landing-eyebrow">Vår roll</p>
            <h2>Vi kombinerar innehåll, arbetsflöde och teknik i en hanterad tjänst.</h2>
            <p>
              Screenia ska inte bara leverera en enhet. Tjänsten ska hjälpa
              kunden genom val av paket, insamling av material, betalning,
              layoutförberedelse, leverans och fortsatt uppdatering när
              verksamheten förändras.
            </p>
          </div>
        </section>

        <section className="about-values">
          <div className="about-section-heading">
            <p className="landing-eyebrow">Värderingar</p>
            <h2>Så bygger vi Screenia.</h2>
          </div>
          <div className="about-value-grid">
            {values.map(([title, text]) => (
              <article className="about-value-card" key={title}>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="about-strategy">
          <div className="about-section-heading">
            <p className="landing-eyebrow">Strategi</p>
            <h2>Vi bygger för stabilitet först, tillväxt sedan.</h2>
            <p>
              Strategin är att skapa en tjänst som fungerar professionellt i
              verkliga kundflöden innan den skalas upp. Det gör produkten mer
              pålitlig och lättare att förbättra över tid.
            </p>
          </div>
          <div className="about-strategy-grid">
            {strategy.map(([number, title, text]) => (
              <article className="about-strategy-card" key={number}>
                <span>{number}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="about-proof">
          {proofPoints.map(([value, label]) => (
            <div className="about-proof-card" key={value}>
              <strong>{value}</strong>
              <span>{label}</span>
            </div>
          ))}
        </section>

        <section className="about-closing">
          <p className="landing-eyebrow">Framåt</p>
          <h2>Vårt mål är att bli det självklara valet för enkel digital skyltning i Sverige.</h2>
          <p>
            Vi vill hjälpa fler lokala företag att kommunicera tydligare i sin
            egen miljö. Därför utvecklar vi Screenia med fokus på enkel start,
            tydliga priser, säkra flöden och ett visuellt uttryck som gör
            skillnad i vardagen.
          </p>
          <Link href="/#contact" className="landing-button landing-button-primary">
            Kontakta Screenia
          </Link>
        </section>
      </main>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
    </div>
  );
}
