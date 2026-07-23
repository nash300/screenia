import type { Metadata } from "next";
import Image from "next/image";
import { LandingNav } from "@/components/LandingNav";
import { LandingScrollReveal } from "@/components/LandingScrollReveal";
import "../landing.css";
import "../public-info.css";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://screenia.se";

export const metadata: Metadata = {
  title: "Så fungerar digital skyltning för företag",
  description:
    "Guide till hur Screenia hjälper salonger, butiker, restauranger och lokala företag i Sverige att komma igång med digital skyltning utan tekniskt krångel.",
  keywords: [
    "så fungerar digital skyltning",
    "digital skyltning företag",
    "digital signage Sverige",
    "skärminnehåll butik",
    "digital menyskärm restaurang",
    "reklamskärm salong",
  ],
  alternates: {
    canonical: "/sa-fungerar-det",
    languages: {
      "sv-SE": "/sa-fungerar-det",
    },
  },
  openGraph: {
    title: "Så fungerar digital skyltning för företag | Screenia",
    description:
      "En enkel guide till hur Screenia hjälper lokala företag att visa menyer, kampanjer, prislistor och information på TV-skärm.",
    url: "/sa-fungerar-det",
    siteName: "Screenia",
    locale: "sv_SE",
    type: "website",
    images: [
      {
        url: "/landing/free-source/retail-digital-signage.jpg",
        width: 1200,
        height: 630,
        alt: "Digital skyltning i en verksamhetsmiljö",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Så fungerar digital skyltning för företag | Screenia",
    description:
      "Guide till digital skyltning för lokala företag i Sverige: paket, material, betalning, leverans och löpande uppdateringar.",
    images: ["/landing/free-source/retail-digital-signage.jpg"],
  },
};

const reasons = [
  ["01", "Tydlig start", "Paket, uppstart, betalning och nästa steg samlas i ett enkelt flöde innan arbetet startar.", "/landing/free-source/business-consultation.jpg"],
  ["02", "Professionellt uttryck", "Skärminnehållet planeras för att ge lokalen ett modernt, tydligt och säljande intryck.", "/landing/free-source/retail-digital-signage.jpg"],
  ["03", "Mindre teknikstress", "Screenia förbereder processen så att verksamheten slipper bygga ett eget tekniskt system.", "/landing/free-source/restaurant-neon-sign.jpg"],
  ["04", "Personlig planering", "Rådgivning, layoutstöd och överenskomna justeringar ingår i uppstarten.", "/landing/free-source/business-consultation.jpg"],
  ["05", "Redo att växa", "Lösningen kan utökas med fler skärmar när behovet ökar, utan att arbetssättet byts ut.", "/landing/free-source/retail-digital-signage.jpg"],
] as const;

export default function HowItWorksPage() {
  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "@id": `${siteUrl}/sa-fungerar-det#webpage`,
      url: `${siteUrl}/sa-fungerar-det`,
      name: "Så fungerar digital skyltning för företag",
      description: metadata.description,
      inLanguage: "sv-SE",
      isPartOf: {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        name: "Screenia",
        url: siteUrl,
      },
      about: {
        "@type": "Service",
        "@id": `${siteUrl}/#digital-signage-service`,
        name: "Digital skyltning för företag",
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
          name: "Så fungerar det",
          item: `${siteUrl}/sa-fungerar-det`,
        },
      ],
    },
  ];

  return (
    <div className="landing-page how-page public-info-page">
      <LandingNav currentPath="/sa-fungerar-det" />
      <LandingScrollReveal />

      <main className="how-main">
        <section className="how-hero">
          <p className="landing-eyebrow">Fördelar</p>
          <h1>Mer synlighet för företaget, utan mer tekniskt arbete.</h1>
          <p>
            Screenia samlar uppstart, betalning, innehåll och support i ett
            tydligt flöde. Resultatet är en professionell skärmlösning utan
            behov av ett eget tekniskt system.
          </p>
        </section>

        <section className="how-promo-section">
          <div className="how-section-heading">
            <p className="landing-eyebrow">Det här gör skillnaden</p>
            <h2>De viktigaste fördelarna för en trygg skärmstart.</h2>
            <p>
              Fokus ligger på de delar som har störst betydelse för kunden:
              tydlig process, professionellt innehåll, trygg uppstart och en
              lösning som kan växa med verksamheten.
            </p>
          </div>

          <div className="how-reason-grid how-reason-grid-featured" aria-label="Screenia fördelar">
            {reasons.map(([number, title, text, image]) => (
              <article key={number} className="how-reason-card">
                <Image
                  src={image}
                  alt={`${title} med Screenia`}
                  width={900}
                  height={720}
                />
                <div>
                  <span>{number}</span>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
    </div>
  );
}
