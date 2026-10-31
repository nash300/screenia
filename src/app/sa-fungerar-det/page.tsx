import type { Metadata } from "next";
import Image from "next/image";
import { LandingNav } from "@/components/LandingNav";
import { LandingScrollReveal } from "@/components/LandingScrollReveal";
import { createPublicPageMetadata, serializeJsonLd } from "@/lib/seo";
import "../public-info.css";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://screenia.se";

export const metadata: Metadata = createPublicPageMetadata({
  path: "/sa-fungerar-det",
  title: "Digital skyltning med vanlig TV – så fungerar det",
  description:
    "Så fungerar Screenias digitala skyltning med en vanlig TV: ni väljer lösning och skickar material, vi sköter innehåll, enhet, publicering och support.",
  keywords: [
    "så fungerar digital skyltning",
    "digital skyltning företag",
    "digital signage Sverige",
    "skärminnehåll butik",
    "digital menyskärm restaurang",
    "reklamskärm salong",
  ],
  image: "/landing/free-source/retail-digital-signage.jpg",
  imageAlt: "Digital skyltning med en vanlig TV i en verksamhet",
});

const reasons = [
  [
    "01",
    "Tydlig start",
    "Paket, uppstart, betalning och nästa steg samlas i ett enkelt flöde innan arbetet startar.",
    "/landing/how-it-works/screenia-tydlig-start-v2.png",
    "Två personer planerar Screenias skärmlösning med box, surfplatta och mobil.",
  ],
  [
    "02",
    "Professionellt uttryck",
    "Skärminnehållet planeras för att ge lokalen ett modernt, tydligt och säljande intryck.",
    "/landing/how-it-works/screenia-professionellt-uttryck.webp",
    "Digitalt innehåll formges professionellt på en ritplatta",
  ],
  [
    "03",
    "Mindre teknikstress",
    "Screenia förbereder processen så att verksamheten slipper bygga ett eget tekniskt system.",
    "/landing/how-it-works/screenia-mindre-teknikstress.webp",
    "Företagare kan koppla av medan Screenia tar hand om tekniken",
  ],
  [
    "04",
    "Personlig planering",
    "Rådgivning, layoutstöd och överenskomna justeringar ingår i uppstarten.",
    "/landing/how-it-works/screenia-personlig-planering.webp",
    "Personlig planering av skärmlösningen tillsammans med Screenia",
  ],
  [
    "05",
    "Redo att växa",
    "Lösningen kan utökas med fler skärmar när behovet ökar, utan att arbetssättet byts ut.",
    "/landing/how-it-works/screenia-redo-att-vaxa.webp",
    "Digitala menyskärmar som kan byggas ut när verksamheten växer",
  ],
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
          <div className="how-hero-copy">
            <p className="landing-eyebrow">Fördelar</p>
            <h1>Digital skyltning med vanlig TV, utan tekniskt krångel.</h1>
            <p>
              Screenia samlar uppstart, betalning, innehåll och support i ett
              tydligt flöde. Resultatet är en professionell skärmlösning utan
              behov av ett eget tekniskt system.
            </p>
          </div>
          <div className="how-hero-visual">
            <Image
              src="/landing/screenia-tv-foretagare.webp"
              alt="Företagare använder Screenia för digital skyltning på en vanlig TV"
              fill
              priority
              sizes="(max-width: 820px) calc(100vw - 84px), 38vw"
            />
          </div>
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
            {reasons.map(([number, title, text, image, imageAlt]) => (
              <article key={number} className="how-reason-card">
                <Image
                  src={image}
                  alt={imageAlt}
                  width={900}
                  height={720}
                  sizes="(max-width: 820px) calc(100vw - 72px), (max-width: 1120px) 44vw, 30vw"
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
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(structuredData) }}
      />
    </div>
  );
}
