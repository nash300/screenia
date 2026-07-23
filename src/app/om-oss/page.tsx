import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { LandingNav } from "@/components/LandingNav";
import { LandingScrollReveal } from "@/components/LandingScrollReveal";
import "../landing.css";
import "../standalone-public.css";

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
        url: "/landing/free-source/business-consultation.jpg",
        width: 1200,
        height: 630,
        alt: "Planering inför digital skyltning med Screenia",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Om Screenia | Digital skyltning för lokala företag",
    description:
      "Vår vision är att göra digital skyltning lika enkel att använda som den är effektiv att se.",
    images: ["/landing/free-source/business-consultation.jpg"],
  },
};

const beliefs = [
  ["Tydlighet före teknik", "Kunden ska förstå upplägg, nästa steg och resultat utan att behöva tolka tekniska begrepp."],
  ["Personlig planering", "Varje uppstart ska kännas genomtänkt, enkel att följa och anpassad efter verksamhetens lokal."],
  ["Kontrollerad tillväxt", "Tjänsten ska kunna växa med fler skärmar utan att processen blir tung eller otydlig."],
] as const;

const values = [
  ["Enkelhet", "Vi skalar bort tekniskt brus och bygger flöden som är lätta att följa."],
  ["Noggrannhet", "Beställningar, betalningar, innehåll och status ska vara spårbara."],
  ["Förtroende", "Priser, villkor, leverans och ansvar ska vara tydliga från början."],
] as const;

const strategy = [
  ["1", "Lyssna på behovet", "Först identifieras vad verksamheten vill visa och vilken typ av skärm som passar bäst."],
  ["2", "Göra starten trygg", "Förfrågan, onboarding, betalning, innehåll och support kopplas ihop i ett kontrollerat flöde."],
  ["3", "Förbättra med data", "När verkliga kundflöden används kan tjänsten utvecklas utan att förlora enkelheten."],
] as const;

const proofPoints = [
  ["Planering", "personligt stöd från start"],
  ["Tydlighet", "samma flöde för uppstart och betalning"],
  ["Skalbart", "fler skärmar när behovet växer"],
] as const;

const signals = [
  ["Planering med kunden", "Processen börjar med att förstå lokal, målgrupp och vilket budskap som ska synas.", "/landing/free-source/business-consultation.jpg"],
  ["Synlighet i lokalen", "Innehållet ska upplevas professionellt där kunden faktiskt möter verksamheten.", "/landing/free-source/retail-digital-signage.jpg"],
  ["Enkel drift", "Tjänsten byggs för återkommande uppdateringar utan att kunden behöver hantera teknisk drift.", "/landing/free-source/restaurant-neon-sign.jpg"],
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
    <div className="landing-page about-page public-info-page">
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
              src="/landing/free-source/business-consultation.jpg"
              alt="Planering inför digital skyltning"
              width={1400}
              height={900}
              priority
            />
            <div className="about-hero-stat">
              <strong>Från behov till tydlig visning</strong>
              <span>Planering, innehåll och uppstart ska kännas lugnt och professionellt.</span>
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

        <section className="about-signals" aria-label="Screenias arbetssätt">
          {signals.map(([title, text, image]) => (
            <article className="about-signal-card" key={title}>
              <Image src={image} alt={`${title} hos Screenia`} width={1000} height={760} />
              <div>
                <h2>{title}</h2>
                <p>{text}</p>
              </div>
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
          <Link href="/kontakt" className="landing-button landing-button-primary">
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
