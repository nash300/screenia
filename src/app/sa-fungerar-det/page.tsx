import type { Metadata } from "next";
import { LandingNav } from "@/components/LandingNav";
import "../landing.css";

export const metadata: Metadata = {
  title: "Så fungerar digital skyltning",
  description:
    "Se hur Screenia hjälper lokala företag att komma igång med digital skyltning, skärminnehåll, betalning, leverans och löpande uppdateringar.",
  alternates: {
    canonical: "/sa-fungerar-det",
  },
  openGraph: {
    title: "Så fungerar digital skyltning | Screenia",
    description:
      "En enkel guide till hur Screenia hjälper salonger, butiker och restauranger att visa professionellt innehåll på TV-skärm.",
    url: "/sa-fungerar-det",
    siteName: "Screenia",
    locale: "sv_SE",
    type: "website",
    images: [
      {
        url: "/brand/how-it-works-sv-banner.png",
        width: 1200,
        height: 630,
        alt: "Screenia digital skyltning för lokala företag",
      },
    ],
  },
};

const reasons = [
  ["01", "Byggt för småföretag", "Visa varför Screenia passar restauranger, salonger, butiker och lokala verksamheter.", "/window_screen2.jpg"],
  ["02", "Ingen tekniker behövs", "Beskriv hur kunden slipper installationer, abonnemangsdjungel och komplicerade system.", "/landing/hero-slides/02/image.png"],
  ["03", "Professionellt uttryck", "Förklara hur skärmen hjälper företaget att se mer modernt och förtroendeingivande ut.", "/salon1.jpg"],
  ["04", "Snabbare start", "Lyft hur kunden kan komma igång på dagar istället för veckor.", "/window_screen1.jpg"],
  ["05", "Tydliga kostnader", "Beskriv paket, provperiod, startavgift och ingen bindningstid på ett enkelt sätt.", "/landing/hero-slides/01/image.png"],
  ["06", "Mer synliga erbjudanden", "Visa hur kampanjer, menyer och priser blir lättare för kunden att upptäcka.", "/bbr.jpg"],
  ["07", "Bättre läsbarhet", "Förklara skillnaden mellan Full HD och 4K för menyer, text och detaljerade bilder.", "/landing/hero-slides/03/image.png"],
  ["08", "Uppdateringar vid behov", "Berätta hur kunden kan skicka nya bilder, priser eller kampanjer när innehållet ändras.", "/salon2.jpg"],
  ["09", "Trygg betalning", "Visa att uppgifter, villkor och betalning sker i ett samlat och säkert flöde.", "/m.jpg"],
  ["10", "Enhet förberedd av oss", "Beskriv hur Screenia förbereder enheten så kunden kan fokusera på sin verksamhet.", "/brand/screenia-helper.png"],
  ["11", "Skalbart över tid", "Förklara hur kunden kan lägga till fler skärmar eller fler platser när behovet växer.", "/salon3.jpg"],
  ["12", "Personlig hjälp", "Lyft support, rådgivning och hjälp med innehåll som en del av helhetskänslan.", "/salon4.jpg"],
] as const;

export default function HowItWorksPage() {
  return (
    <div className="landing-page how-page">
      <LandingNav currentPath="/sa-fungerar-det" />

      <main className="how-main">
        <section className="how-hero">
          <p className="landing-eyebrow">Fördelar</p>
          <h1>Mer synlighet för företaget, utan mer tekniskt arbete.</h1>
          <p>
            Den här sidan kan användas för att lyfta värdet med Screenia:
            varför tjänsten är enkel att komma igång med, hur den hjälper
            kunden att synas bättre och varför den passar lokala företag.
          </p>
        </section>

        <section className="how-promo-section">
          <div className="how-section-heading">
            <p className="landing-eyebrow">Det här gör skillnaden</p>
            <h2>12 platser för att visa varför Screenia är ett smart val.</h2>
            <p>
              Här kan vi senare lägga dina egna bilder och texter som säljer in
              tjänsten tydligare, skapar förtroende och visar konkreta fördelar
              med lösningen.
            </p>
          </div>

          <div className="how-reason-grid" aria-label="Screenia fördelar">
            {reasons.map(([number, title, text, image]) => (
              <article key={number} className="how-reason-card">
                <img src={image} alt={`${title} med Screenia`} />
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
    </div>
  );
}
