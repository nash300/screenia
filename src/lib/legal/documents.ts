export const CURRENT_TERMS_VERSION = "2026-07-24-avtalsutkast";
export const CURRENT_PRIVACY_VERSION = "2026-07-24-avtalsutkast";

export const CURRENT_TERMS_DOCUMENT = {
  type: "terms",
  title: "Villkor",
  version: CURRENT_TERMS_VERSION,
  effectiveDate: "2026-07-24",
  url: "/terms",
  pdfUrl: null,
  summary:
    "Avtalsutkast för Screenias tjänst. Juridisk granskning krävs innan livebetalningar aktiveras.",
  content:
    "Screenia tillhandahåller en förvaltad tjänst för digital skyltning. Kunden ansvarar för riktiga företags-, fakturerings- och leveransuppgifter samt för rätten att använda lämnat material. Första betalningen omfattar uppstart, valda enheter och frakt. Månadsavgiften börjar efter provperioden. Uppsägning gäller normalt vid den betalda periodens slut. Rätten till full återbetalning kan påverkas när layout- eller produktionsarbete har påbörjats.",
} as const;

export const CURRENT_PRIVACY_DOCUMENT = {
  type: "privacy",
  title: "Integritetspolicy",
  version: CURRENT_PRIVACY_VERSION,
  effectiveDate: "2026-07-24",
  url: "/privacy",
  pdfUrl: null,
  summary:
    "Utkast till integritetspolicy. Juridisk granskning krävs innan livebetalningar aktiveras.",
  content:
    "Screenia behandlar de personuppgifter som behövs för förfrågan, avtal, betalning, leverans, support och förvaltning av tjänsten. Uppgifter delas endast med leverantörer som behövs för dessa ändamål. Den registrerade kan kontakta Screenia för tillgång, rättelse, radering, begränsning eller andra integritetsfrågor. Vissa uppgifter måste bevaras enligt lag eller för att hantera betalning, säkerhet och rättsliga anspråk.",
} as const;
