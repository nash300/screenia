export const CURRENT_TERMS_VERSION = "2026-05-28-draft";
export const CURRENT_PRIVACY_VERSION = "2026-05-28-draft";

export const CURRENT_TERMS_DOCUMENT = {
  type: "terms",
  title: "Villkor",
  version: CURRENT_TERMS_VERSION,
  effectiveDate: "2026-05-28",
  url: "/terms",
  pdfUrl: "/legal/villkor-current.pdf",
  summary:
    "Utkast. Den slutliga villkorstexten ersätts här innan publicering.",
  content:
    "Detta är en platshållare för Screenias villkor. Den slutliga juridiska texten läggs in här och versioneras innan tjänsten används i produktion.",
} as const;

export const CURRENT_PRIVACY_DOCUMENT = {
  type: "privacy",
  title: "Integritetspolicy",
  version: CURRENT_PRIVACY_VERSION,
  effectiveDate: "2026-05-28",
  url: "/privacy",
  pdfUrl: "/legal/integritetspolicy-current.pdf",
  summary:
    "Utkast. Den slutliga integritetstexten ersätts här innan publicering.",
  content:
    "Detta är en platshållare för Screenias integritetspolicy. Den slutliga texten läggs in här och versioneras innan tjänsten används i produktion.",
} as const;
