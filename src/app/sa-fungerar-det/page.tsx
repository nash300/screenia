import type { Metadata } from "next";
import Image from "next/image";
import { LandingNav } from "@/components/LandingNav";
import { LandingScrollReveal } from "@/components/LandingScrollReveal";
import "../landing.css";
import "../standalone-public.css";

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
        url: "/landing/hero-slides/02/image.png",
        width: 1200,
        height: 630,
        alt: "Screenia digital skyltning för lokala företag",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Så fungerar digital skyltning för företag | Screenia",
    description:
      "Guide till digital skyltning för lokala företag i Sverige: paket, material, betalning, leverans och löpande uppdateringar.",
    images: ["/landing/hero-slides/02/image.png"],
  },
};

const reasons = [
  ["01", "Byggt för småföretag", "En enkel helhetslösning för restauranger, salonger, butiker och andra lokala verksamheter.", "/window_screen2.jpg"],
  ["02", "Ingen tekniker behövs", "Screenia förbereder flödet och enheten. Installation av avancerade system eller utbildning i ny teknik behövs inte.", "/landing/hero-slides/02/image.png"],
  ["03", "Professionellt uttryck", "Genomtänkt skärminnehåll ger lokalen ett modernare och mer förtroendeingivande uttryck.", "/salon1.jpg"],
  ["04", "Snabbare start", "Ett tydligt steg-för-steg-flöde gör att verksamheten kan komma igång utan långa installationsprojekt.", "/window_screen1.jpg"],
  ["05", "Tydliga kostnader", "Paket, provperiod, startavgift och löpande pris presenteras före godkännande och betalning.", "/landing/hero-slides/01/image.png"],
  ["06", "Mer synliga erbjudanden", "Kampanjer, menyer och aktuella priser får en tydlig plats där kunderna faktiskt ser dem.", "/bbr.jpg"],
  ["07", "Bättre läsbarhet", "Välj Full HD för enklare innehåll eller 4K när menyer, text och detaljer ska vara extra skarpa.", "/landing/hero-slides/03/image.png"],
  ["08", "Uppdateringar vid behov", "Skicka nya bilder, priser och kampanjer via kundportalen när verksamhetens innehåll förändras.", "/salon2.jpg"],
  ["09", "Trygg betalning", "Uppgifter, villkor och betalning hanteras i ett sammanhållet flöde med tydlig bekräftelse.", "/m.jpg"],
  ["10", "Enhet förberedd av oss", "Screenia förbereder skärmenheten så att verksamheten kan fokusera på sitt innehåll i stället för tekniken.", "/brand/screenia-helper.png"],
  ["11", "Skalbart över tid", "Lägg till fler skärmar eller platser när behovet växer, utan att byta arbetssätt.", "/salon3.jpg"],
  ["12", "Personlig hjälp", "Personlig rådgivning och support ingår för innehåll, skärmvisning och löpande uppdateringar.", "/salon4.jpg"],
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
            <h2>12 fördelar som gör skärmen enklare att använda.</h2>
            <p>
              Från första val till löpande uppdateringar är varje del utformad
              för att spara tid, skapa tydlighet och ge ett professionellt
              resultat i lokalen.
            </p>
          </div>

          <div className="how-reason-grid" aria-label="Screenia fördelar">
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
