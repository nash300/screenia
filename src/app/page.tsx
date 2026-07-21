"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { LandingNav } from "@/components/LandingNav";
import {
  ADDITIONAL_SETUP_FEE_PER_SCREEN_SEK,
  INCLUDED_SETUP_SCREEN_COUNT,
  additionalSetupScreenCount,
  calculateSetupFeeSek,
} from "@/lib/pricing/setup-fee";
import {
  ADDITIONAL_SHIPPING_FEE_PER_DEVICE_SEK,
  BASE_SHIPPING_FEE_SEK,
  INCLUDED_SHIPPING_DEVICE_COUNT,
  additionalShippingDeviceCount,
  calculateShippingFeeSek,
} from "@/lib/pricing/shipping-fee";
import "./landing.css";

const publicSiteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://screenia.se";

const copy = {
  sv: {
    nav: ["Tjänsten", "Så fungerar det", "Priser", "Exempel", "FAQ", "Kontakt"],
    demo: "Kontakta oss",
    eyebrow: "Digital skyltning för företag",
    hero:
      "Professionellt skärminnehåll, hanterat från en tydlig plattform.",
    lede:
      "Screenia hjälper salonger, butiker och serviceföretag att visa kampanjer, prislistor och information på skärm. Full HD- och 4K-enheter kan kombineras efter verksamhetens behov, med stöd genom hela uppstarten.",
    pricingCta: "Se paket",
    workflowCta: "Se fördelarna",
    stats: [
      ["24/7", "kontinuerlig skärmvisning"],
      ["3 veckor", "kostnadsfri provperiod"],
      ["0", "månaders bindningstid"],
    ],
    platformTitle: "En enklare väg till professionell skärmvisning",
    platformText:
      "Ett eget tekniskt system eller komplicerade inställningar behövs inte. Screenia hanterar processen från första förfrågan till en skärm med rätt innehåll för verksamheten.",
    features: [
      ["Smidig start", "Vald skärmlösning följs av en personlig startguide med tydliga nästa steg."],
      ["Tydlig kostnad", "Startavgift, enhetspris, månadskostnad, provperiod och bindningstid redovisas innan beställningen slutförs."],
      ["Hjälp med skärmen", "Efter betalning samlar vi in material, gör layouten och skickar enheten med instruktioner."],
      ["Innehåll som syns", "Lösningen kan visa erbjudanden, prislistor, nyheter och annan information som passar lokalen."],
    ],
    workflowTitle: "Från paketval till fungerande skärm",
    workflowText:
      "Startguiden är en säker sida för bekräftelse av uppgifter, villkor och betalning. Material samlas in efter betalningen för att hålla den inledande förfrågan enkel.",
    steps: [
      ["01", "Välj skärmar", "Ange önskat antal Full HD- och 4K-skärmar. Båda typerna kan kombineras i samma förfrågan.", "Förfrågan är inte en bindande beställning. Uppgifterna används för att skapa en personlig startguide."],
      ["02", "Färdigställ uppgifter och betala", "I startguiden bekräftas företagsuppgifter och villkor innan betalningen genomförs.", "Logotyp, meny och bilder behöver inte förberedas före betalningen."],
      ["03", "Skicka innehåll efter betalning", "Efter betalningen kan material laddas upp, en Screenia-mall väljas eller innehållet skickas senare.", "Meny, prislista, logotyp, bilder eller enkla instruktioner är tillräckligt som underlag."],
      ["04", "Vi bygger layouten", "Screenia tar fram det första skärmförslaget, förbereder hårdvaran och skickar enheten när arbetet är klart.", "Aktuell status visas i kundportalen."],
      ["05", "Koppla in och starta", "Vid leverans ansluts enheten till TV och Wi-Fi enligt medföljande instruktioner.", "Därefter börjar skärmen visa det färdigställda innehållet."],
    ],
    process: [["Förfrågan", "Paket valt"], ["Betalning", "Säker checkout"], ["Innehåll", "Efter betalning"], ["Start", "TV + Wi-Fi"]],
    pricingTitle: "Tydliga paket för hanterade skärmar",
    pricingText:
      "Kombinera Full HD för mindre skärmar och enklare innehåll med 4K där text, menyer och detaljer ska vara extra skarpa. Startavgiften täcker upp till tre skärmar. Månadsabonnemanget startar efter provperioden.",
    recommended: "Rekommenderas",
    setupFee: "Startavgift",
    monthly: "Per månad",
    choose: "Välj",
    trustTitle: "Betalning och uppgifter hanteras säkert",
    trustText:
      "Betalningen genomförs på en säker betalningssida med de betalningssätt som är aktiverade för beställningen.",
    deliveryTitle: "Leveransalternativ i Sverige",
    deliveryText:
      "Vi kan skicka skärmenheten med etablerade transportörer i Sverige och väljer alternativ efter adress, paketstorlek och ledtid.",
    galleryTitle: "Exempel på skärmar och mallar",
    galleryText:
      "Några exempel på hur kampanjer, menyer och information kan visas på en kundskärm.",
    galleryItems: [
      ["Restaurangmeny", "Kampanjer, menyer och dagens erbjudanden."],
      ["Skyltfönster", "Synligt innehåll för kunder som passerar lokalen."],
      ["Salong och service", "Priser, behandlingar och aktuell information."],
      ["Produktvisning", "Tydliga bilder och budskap för butiksmiljöer."],
    ],
    faqTitle: "Svar inför val av skärmlösning",
    faqs: [
      ["Vad händer efter valet av skärmar?", "En kort förfrågan skickas med önskad kombination. Efter Screenias granskning skickas en personlig startguide för bekräftelse av uppgifter, villkor och betalning."],
      ["Vilket material behövs?", "Inget material behövs före betalningen. Därefter kan meny, prislista, logotyp och bilder laddas upp eller en Screenia-mall väljas."],
      ["Hur lång är uppstartstiden?", "Efter betalningen samlas innehållet in. Screenia tar därefter fram den första layouten, förbereder hårdvaran och skickar enheten när arbetet är klart."],
      ["Vilken TV eller skärm krävs?", "En Smart TV eller skärm med HDMI-ingång och tillgång till Wi-Fi krävs."],
      ["Kan kampanjer och priser visas samtidigt?", "Ja. En layout kan innehålla prislista, erbjudanden, öppettider, QR-kod och bildmaterial i samma visning."],
      ["Kan innehållet ändras senare?", "Ja. Nytt material och uppdaterade priser kan skickas till Screenia för publicering på skärmen."],
      ["Hur levereras enheten?", "Lämpligt leveranssätt väljs utifrån adress, paketstorlek och ledtid. Leveransinformation och instruktioner skickas när enheten lämnar Screenia."],
      ["Vad ingår i startavgiften", "Start- och konfigurationsavgiften är 1 599 kr (upp till 3 skärmar). I avgiften ingår personlig rådgivning vid planering, framtagning av layout och överenskomna justeringar under uppstartsfasen. Från den fjärde skärmen tillkommer 249 kr per skärm. Avgiften återbetalas inte efter att layout- eller produktionsarbetet har påbörjats."],
    ],
    companyTitle: "Företagsinformation",
    companyText:
      "Screenia hanterar kunduppgifter, betalning och leverans enligt våra villkor och vår integritetspolicy.",
    contactEyebrow: "Redo att komma igång",
    contactTitle: "Ett enklare arbetsflöde för nästa skärmlösning.",
    contactText:
      "Ange önskat antal Full HD- och 4K-skärmar samt planerat innehåll. Screenia kontrollerar kombinationen innan betalning kan genomföras.",
    contactButton: "Kontakta Screenia",
    seoIntro:
      "Screenia erbjuder digital skyltning i Sverige för salonger, butiker, restauranger och lokala serviceföretag som vill visa menyer, prislistor, kampanjer och kundinformation på TV-skärm.",
    modalEyebrow: "Skicka förfrågan",
    modalTitle: "Starta med",
    modalText:
      "Efter att företagets uppgifter har skickats återkommer Screenia med en personlig startguide för uppgifter, villkor och betalning.",
    close: "Stäng",
    fields: ["Företagsnamn *", "E-post *", "Kontaktperson", "Telefon", "Meddelande"],
    screenCountLabel: "Antal skärmar *",
    screenCountHelp: "Ange önskat antal skärmar eller enheter.",
    placeholders: ["Exempel: Salon Bella", "namn@foretag.se", "Kontaktpersonens namn", "+46...", "Plats, bransch eller annan relevant information."],
    requestPrivacy:
      "Uppgifterna används för att hantera förfrågan och skapa en personlig startguide. Känsliga personuppgifter ska inte anges i meddelandet.",
    requestPrivacyConsent:
      "Jag har läst integritetspolicyn och förstår att Screenia sparar uppgifterna för att hantera min förfrågan.",
    sending: "Skickar förfrågan...",
    submit: "Skicka förfrågan",
    success:
      "Tack. Förfrågan är mottagen och Screenia återkommer med en personlig startguide.",
    error: "Förfrågan kunde inte skickas.",
    legal: ["Villkor", "Integritet", "Alla rättigheter förbehållna."],
  },
  en: {
    nav: ["Service", "How it works", "Pricing", "Examples", "FAQ", "Contact"],
    demo: "Contact us",
    eyebrow: "Digital signage for businesses",
    hero: "Professional screen content, managed from one clear platform.",
    lede:
      "Screenia helps salons, shops, and service businesses present campaigns, price lists, and information on screen. Full HD and 4K devices can be combined according to operational needs, with support throughout the setup process.",
    pricingCta: "See packages",
    workflowCta: "How it works",
    stats: [["24/7", "continuous screen playback"], ["3 weeks", "free subscription trial"], ["0", "months commitment"]],
    platformTitle: "A simpler path to professional screen display",
    platformText:
      "No proprietary technical system or complex configuration is required. Screenia manages the process from the initial request to a screen displaying the appropriate content for the business.",
    features: [
      ["Smooth start", "The selected screen solution is followed by a personal setup guide with clear next steps."],
      ["Clear costs", "The setup fee, device price, monthly price, trial period, and commitment are presented before the order is completed."],
      ["Screen support", "Screenia creates the layout from the submitted material and sends the device with instructions."],
      ["Visible content", "The solution can display offers, price lists, news, and other information suited to the premises."],
    ],
    workflowTitle: "From package choice to working screen",
    workflowText:
      "The setup guide provides a secure page for confirming details, accepting terms, and completing payment. Material is collected after payment to keep the initial request straightforward.",
    steps: [
      ["01", "Choose screens", "Specify the required quantities of Full HD and 4K screens. Both types can be combined in one request.", "The request is not a binding order. The information is used to create a personal setup guide."],
      ["02", "Complete details and pay", "Company details and terms are confirmed in the setup guide before payment is completed.", "A logo, menu, and images do not need to be prepared before payment."],
      ["03", "Submit content after payment", "After payment, material can be uploaded, a Screenia template selected, or content submitted later.", "A menu, price list, logo, images, or brief instructions provide sufficient material."],
      ["04", "We build the layout", "Screenia creates the first screen proposal, prepares the hardware, and ships the device when the work is complete.", "Current progress is shown in the customer portal."],
      ["05", "Connect and start", "On delivery, the device is connected to the TV and Wi-Fi according to the supplied instructions.", "The screen then begins displaying the completed content."],
    ],
    process: [["Request", "Package selected"], ["Material", "Menu, images, logo"], ["Production", "Layout + USB device"], ["Start", "HDMI + Wi-Fi"]],
    pricingTitle: "Clear packages for managed screens",
    pricingText:
      "Choose Full HD for smaller screens and simpler content, or 4K when text, menus, and details need extra sharpness. The base setup fee covers up to three screens; each additional screen adds 249 SEK. The monthly subscription starts after the trial.",
    recommended: "Recommended",
    setupFee: "Setup fee",
    monthly: "Per month",
    choose: "Choose",
    trustTitle: "Payment and details are handled securely",
    trustText:
      "Payment is completed through a secure checkout page using the payment methods enabled for the order.",
    deliveryTitle: "Delivery options in Sweden",
    deliveryText:
      "We can ship the screen device with established carriers in Sweden and choose the option by address, parcel size, and lead time.",
    galleryTitle: "Example screen templates",
    galleryText:
      "A few examples of how campaigns, menus, and information can appear on a customer display.",
    galleryItems: [
      ["Restaurant menu", "Campaigns, menus, and daily offers."],
      ["Window display", "Visible content for customers passing the location."],
      ["Salon and service", "Prices, treatments, and current information."],
      ["Product display", "Clear imagery and messages for retail spaces."],
    ],
    faqTitle: "Answers before selecting a screen solution",
    faqs: [
      ["What happens after the screens are selected?", "A short request is submitted with the preferred combination. After Screenia reviews it, a personal setup guide is sent for confirmation of details, terms, and payment."],
      ["What material is required?", "No material is required before payment. A menu, price list, logo, and images can then be uploaded, or a Screenia template can be selected."],
      ["How long does setup take?", "After payment, the content is collected. Screenia then creates the first layout, prepares the hardware, and ships the device when the work is complete."],
      ["What type of TV or screen is required?", "A Smart TV or screen with an HDMI input and Wi-Fi access is required."],
      ["Can campaigns and prices be displayed together?", "Yes. A layout can include price lists, offers, opening hours, QR codes, and imagery in the same presentation."],
      ["Can the content be changed later?", "Yes. New material and updated prices can be submitted to Screenia for publication on the screen."],
      ["How is the device shipped?", "A suitable delivery option is selected according to the address, parcel size, and lead time. Delivery information and instructions are sent when the device leaves Screenia."],
      ["What is included in the setup fee", "The 1,599 SEK setup fee (up to 3 screens) includes personal planning support, layout creation, and agreed adjustments during the setup phase. Each additional screen adds 249 SEK."],
    ],
    companyTitle: "Company information",
    companyText:
      "Screenia handles customer details, payment, and delivery according to our terms and privacy policy.",
    contactEyebrow: "Ready to get started",
    contactTitle: "A simpler workflow for the next screen solution.",
    contactText:
      "Specify the required number of Full HD and 4K screens and the planned content. Screenia checks the combination before payment can be completed.",
    contactButton: "Contact Screenia",
    seoIntro:
      "Screenia provides digital signage in Sweden for salons, shops, restaurants, and local service businesses that want to show menus, price lists, campaigns, and customer information on TV screens.",
    modalEyebrow: "Send request",
    modalTitle: "Start with",
    modalText:
      "After the company details are submitted, Screenia provides a personal setup guide for information, terms, and payment.",
    close: "Close",
    fields: ["Company name *", "Email *", "Contact person", "Phone", "Message"],
    screenCountLabel: "Number of screens *",
    screenCountHelp: "Specify the required number of screens or devices.",
    placeholders: ["Example: Salon Bella", "name@company.com", "Contact name", "+46...", "Location, industry, or other relevant information."],
    requestPrivacy:
      "The information is used to handle the request and create a personal setup guide. Sensitive personal data must not be included in the message.",
    requestPrivacyConsent:
      "I have read the privacy policy and understand that Screenia stores these details to handle my request.",
    sending: "Sending request...",
    submit: "Send request",
    success: "Thank you. The request has been received, and Screenia will provide a personal setup guide.",
    error: "The request could not be sent.",
    legal: ["Terms", "Privacy", "All rights reserved."],
  },
} as const;

const plans = [
  {
    code: "standard_fhd",
    name: "Standard",
    resolution: "FHD",
    setupFee: "1 599 kr",
    hardwareFee: "699 kr",
    monthlyFee: "249 kr",
    setupFeeSek: 1599,
    hardwareFeeSek: 699,
    shippingFeeSek: 99,
    monthlyFeeSek: 249,
    trialDays: 21,
    cardAccent: "blue",
    deviceLabel: "FHD HDMI Stick",
    deviceImage: "/brand/screenia-standard-device.png",
    featured: false,
  },
  {
    code: "premium_4k",
    name: "Premium",
    resolution: "4K",
    setupFee: "1 599 kr",
    hardwareFee: "1 099 kr",
    monthlyFee: "349 kr",
    setupFeeSek: 1599,
    hardwareFeeSek: 1099,
    shippingFeeSek: 99,
    monthlyFeeSek: 349,
    trialDays: 21,
    cardAccent: "gold",
    deviceLabel: "4K TV Box",
    deviceImage: "/brand/screenia-premium-device.png",
    featured: true,
  },
] as const;

const planCopy = {
  sv: {
    standard_fhd: {
      description:
        "För mindre skärmar och standardinnehåll i Full HD.",
      features: [
        "Uppspelning i Full HD (1080p)",
        "Rekommenderas för skärmar upp till 43 tum",
        "Passar kampanjer, erbjudanden och informationsskärmar",
        "Bäst för salonger, väntrum och mindre butiker",
        "Personlig planeringshjälp, layoutdesign och överenskomna ändringar ingår i startavgiften",
        "3 veckors kostnadsfri provperiod",
        "Ingen bindningstid",
      ],
    },
    premium_4k: {
      description: "För större skärmar och extra skarpt innehåll i 4K.",
      features: [
        "Uppspelning i äkta 4K (3840×2160)",
        "Rekommenderas för skärmar från 55 tum",
        "Skarpare text, menyer och detaljerade bilder",
        "Bäst för restauranger, butiker och premiumvisning",
        "Personlig planeringshjälp, layoutdesign och överenskomna ändringar ingår i startavgiften",
        "3 veckors kostnadsfri provperiod",
        "Ingen bindningstid",
      ],
    },
  },
  en: {
    standard_fhd: {
      description:
        "For one screen showing campaigns, offers, and information in Full HD.",
      features: [
        "Full HD playback (1080p)",
        "Recommended for screens up to 43 inches",
        "Fits campaigns, offers, and information screens",
        "Best for salons, waiting rooms, and smaller shops",
        "Personal planning support, layout design, and agreed revisions are included in the setup fee",
        "3-week free trial",
        "No commitment",
      ],
    },
    premium_4k: {
      description: "For businesses that want extra sharp 4K content.",
      features: [
        "True 4K playback (3840×2160)",
        "Recommended for screens from 55 inches",
        "Sharper text, menus, and detailed images",
        "Best for restaurants, shops, and premium display",
        "Personal planning support, layout design, and agreed revisions are included in the setup fee",
        "3-week free trial",
        "No commitment",
      ],
    },
  },
} as const;

const galleryImages = [
  "/landing/section-art/restaurant-menu-screens.jpg",
  "/landing/section-art/digital-menu-board.jpg",
  "/landing/section-art/salon-service-window.jpg",
  "/bbr.jpg",
] as const;

const featureIcons = ["spark", "receipt", "screen", "megaphone"] as const;

const visualImages = [
  "/landing/section-art/digital-menu-board.jpg",
  "/landing/section-art/restaurant-menu-screens.jpg",
  "/landing/section-art/salon-service-window.jpg",
] as const;
const visualCopy = {
  sv: [
    ["Planera innehåll", "Meny, kampanj och logotyp samlas på ett ställe."],
    ["Trygg betalning", "Villkor, uppgifter och betalning sker i samma tydliga flöde."],
    ["Färdig visning", "Enheten kopplas in och visar materialet utan krånglig installation."],
  ],
  en: [
    ["Plan content", "Menu, campaign, and logo are collected in one place."],
    ["Secure payment", "Terms, details, and payment stay in the same clear flow."],
    ["Ready display", "The device plugs in and shows the material without complicated setup."],
  ],
} as const;

const heroBenefits = [
  ["Ingen bindningstid", "Avsluta när som helst."],
  ["Kostnadsfri provperiod", "2 veckor", "3 veckor"],
  ["Alla HDMI-skärmar", "Smart TV och signage."],
  ["100 % nöjdhetsgaranti", "Trygg start med oss."],
] as const;

type LandingAsset = {
  label: string;
  src: string;
  width?: number;
  height?: number;
};

type HeroSlideAsset = LandingAsset & {
  id: string;
  mediaType: "image" | "video";
  sv: {
    eyebrow: string;
    title: string;
    text: string;
  };
  en: {
    eyebrow: string;
    title: string;
    text: string;
  };
};

const heroHighlightWords: Record<string, string[]> = {
  "01": ["kunder", "unikt", "fler besökare"],
  "02": ["befintliga skärm", "allt som behövs", "olika storlekar"],
  "03": ["Slipp dyra installationer", "några minuter", "Enkelt", "prisvärt", "småföretag"],
};

function renderHighlightedText(text: string, words: string[]) {
  if (!words.length) return text;

  const escapedWords = words.map((word) =>
    word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
  );
  const pattern = new RegExp(`(${escapedWords.join("|")})`, "gi");

  return text.split(pattern).map((part, index) => {
    const isHighlighted = words.some(
      (word) => word.toLowerCase() === part.toLowerCase(),
    );

    if (!isHighlighted) return part;

    return (
      <span key={`${part}-${index}`} className="landing-highlight">
        {part}
      </span>
    );
  });
}

function isValidOptionalPhone(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (!/^[+0-9().\-\s]+$/.test(trimmed)) return false;
  const digits = trimmed.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15;
}

function formatLandingSek(value: number) {
  return `${value.toLocaleString("sv-SE")} kr`;
}

export default function Home() {
  const [requestOpen, setRequestOpen] = useState(false);
  const [priceBreakdownOpen, setPriceBreakdownOpen] = useState(false);
  const [planQuantities, setPlanQuantities] = useState<Record<(typeof plans)[number]["code"], number>>({
    standard_fhd: 0,
    premium_4k: 0,
  });
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [requestStatus, setRequestStatus] = useState<
    "idle" | "saving" | "success" | "error"
  >("idle");
  const [requestMessage, setRequestMessage] = useState("");
  const [heroSlides, setHeroSlides] = useState<HeroSlideAsset[]>([]);
  const [activeHeroSlide, setActiveHeroSlide] = useState(0);
  const [heroSlideDirection, setHeroSlideDirection] = useState<"next" | "previous">("next");
  const [heroInteractionKey, setHeroInteractionKey] = useState(0);
  const [serviceLogos, setServiceLogos] = useState<LandingAsset[]>([]);

  const t = copy.sv;
  const companyEmail = process.env.NEXT_PUBLIC_COMPANY_EMAIL || "service@screenia.se";
  const companyDetails = [
    process.env.NEXT_PUBLIC_COMPANY_LEGAL_NAME || "Screenia",
    process.env.NEXT_PUBLIC_COMPANY_ORG_NUMBER
      ? `Organisationsnummer: ${process.env.NEXT_PUBLIC_COMPANY_ORG_NUMBER}`
      : "",
    process.env.NEXT_PUBLIC_COMPANY_ADDRESS || "",
  ].filter(Boolean);
  const footerLinks = [
    { label: "Om Screenia", href: "/om-oss" },
    { label: "Användarvillkor", href: "/terms" },
    { label: "Integritetspolicy", href: "/privacy" },
    { label: "Cookiepolicy", href: "/cookie-policy" },
    { label: "Abonnemang och betalning", href: "/subscription-billing-policy" },
    { label: "Support och service", href: "/support-service-policy" },
    { label: "Kontakt", href: "/kontakt" },
  ];
  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "LocalBusiness",
      "@id": `${publicSiteUrl}/#business`,
      name: "Screenia",
      url: publicSiteUrl,
      image: `${publicSiteUrl}/brand/screenia-logo-full-white-bg.png`,
      logo: `${publicSiteUrl}/brand/screenia-logo-full-white-bg.png`,
      email: process.env.NEXT_PUBLIC_COMPANY_EMAIL || "service@screenia.se",
      areaServed: {
        "@type": "Country",
        name: "Sweden",
      },
      priceRange: "SEK 249-349 per månad",
      description: t.seoIntro,
      knowsAbout: [
        "digital skyltning",
        "digital signage",
        "skärmreklam",
        "menyskärm",
        "informationsskärm",
        "TV skyltning",
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "@id": `${publicSiteUrl}/#website`,
      name: "Screenia",
      url: publicSiteUrl,
      inLanguage: "sv-SE",
      publisher: {
        "@id": `${publicSiteUrl}/#business`,
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "Service",
      "@id": `${publicSiteUrl}/#digital-signage-service`,
      name: "Digital skyltning för företag",
      serviceType: "Digital signage",
      provider: {
        "@id": `${publicSiteUrl}/#business`,
      },
      areaServed: {
        "@type": "Country",
        name: "Sweden",
      },
      description: t.seoIntro,
      hasOfferCatalog: {
        "@type": "OfferCatalog",
        name: "Screenia paket",
        itemListElement: plans.map((plan) => ({
          "@type": "Offer",
          name: `${plan.name} ${plan.resolution}`,
          description: planCopy.sv[plan.code].description,
          priceCurrency: "SEK",
          price: Number(plan.monthlyFee.replace(/\D/g, "")),
          category: "Digital signage subscription",
          availability: "https://schema.org/InStock",
          eligibleDuration: {
            "@type": "QuantitativeValue",
            value: 3,
            unitText: "veckors kostnadsfri provperiod",
          },
        })),
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "@id": `${publicSiteUrl}/#faq`,
      inLanguage: "sv-SE",
      mainEntity: t.faqs.map(([question, answer]) => ({
        "@type": "Question",
        name: question,
        acceptedAnswer: {
          "@type": "Answer",
          text: answer,
        },
      })),
    },
  ];

  useEffect(() => {
    let isMounted = true;

    const loadLandingAssets = async () => {
      try {
        const response = await fetch("/api/landing-assets");
        if (!response.ok) return;

        const data = (await response.json()) as {
          heroSlides: HeroSlideAsset[];
          serviceLogos: LandingAsset[];
        };

        if (!isMounted) return;

        if (data.heroSlides?.length) {
          setHeroSlides(data.heroSlides);
          setActiveHeroSlide(0);
        }

        setServiceLogos(data.serviceLogos || []);
      } catch {
        return;
      }
    };

    loadLandingAssets();

    return () => {
      isMounted = false;
    };
  }, []);

  const selectedQuoteItems = plans
    .map((plan) => ({ plan, quantity: planQuantities[plan.code] }))
    .filter((item) => item.quantity > 0);
  const selectedScreenCount = selectedQuoteItems.reduce(
    (sum, item) => sum + item.quantity,
    0,
  );
  const selectedSetupFee = calculateSetupFeeSek(
    selectedScreenCount,
    plans[0].setupFeeSek,
  );
  const selectedAdditionalSetupScreens =
    additionalSetupScreenCount(selectedScreenCount);
  const selectedHardwareTotal = selectedQuoteItems.reduce(
    (sum, item) => sum + item.plan.hardwareFeeSek * item.quantity,
    0,
  );
  const selectedAdditionalShippingDevices =
    additionalShippingDeviceCount(selectedScreenCount);
  const selectedShippingTotal = calculateShippingFeeSek(selectedScreenCount);
  const selectedMonthlyTotal = selectedQuoteItems.reduce(
    (sum, item) => sum + item.plan.monthlyFeeSek * item.quantity,
    0,
  );
  const selectedFirstPayment =
    selectedSetupFee + selectedHardwareTotal + selectedShippingTotal;

  const setPlanQuantity = (
    code: (typeof plans)[number]["code"],
    quantity: number,
  ) => {
    setPlanQuantities((current) => {
      const otherQuantity = Object.entries(current).reduce(
        (sum, [itemCode, itemQuantity]) =>
          itemCode === code ? sum : sum + itemQuantity,
        0,
      );
      return {
        ...current,
        [code]: Math.min(50 - otherQuantity, Math.max(0, quantity)),
      };
    });
  };

  const openPlanRequest = () => {
    if (selectedScreenCount === 0) return;
    setPriceBreakdownOpen(false);
    setRequestOpen(true);
    setRequestStatus("idle");
    setRequestMessage("");
  };

  const closePlanRequest = () => {
    if (requestStatus === "saving") return;
    setRequestOpen(false);
  };

  const heroSlideCount = heroSlides.length;
  const currentHeroSlide =
    heroSlideCount > 0
      ? heroSlides[activeHeroSlide % heroSlideCount].sv
      : {
          eyebrow: t.eyebrow,
          title: t.hero,
          text: t.lede,
        };
  const currentHeroMedia =
    heroSlideCount > 0 ? heroSlides[activeHeroSlide % heroSlideCount] : null;
  const currentHeroIndex = heroSlideCount > 0 ? activeHeroSlide % heroSlideCount : 0;
  const currentHighlightWords = currentHeroMedia
    ? heroHighlightWords[currentHeroMedia.id] || []
    : ["Professionellt", "tydlig plattform"];
  const heroSlideMotionClass = `landing-hero-slide-motion landing-hero-slide-motion-${heroSlideDirection} landing-hero-slide-motion-${heroSlideDirection}-${currentHeroIndex}`;
  const heroSlideMotionKey = `${heroSlideDirection}-${currentHeroIndex}-${heroInteractionKey}`;

  const goToHeroSlide = (index: number) => {
    if (heroSlideCount <= 1) return;

    const targetIndex = (index + heroSlideCount) % heroSlideCount;
    const stepForward =
      targetIndex === (currentHeroIndex + 1) % heroSlideCount ||
      (currentHeroIndex === heroSlideCount - 1 && targetIndex === 0);
    setHeroSlideDirection(stepForward ? "next" : "previous");
    setActiveHeroSlide(targetIndex);
    setHeroInteractionKey((current) => current + 1);
  };

  const goToPreviousHeroSlide = () => {
    goToHeroSlide(currentHeroIndex - 1);
  };

  const goToNextHeroSlide = () => {
    goToHeroSlide(currentHeroIndex + 1);
  };

  useEffect(() => {
    if (heroSlideCount <= 1) return;

    const timer = window.setInterval(() => {
      setHeroSlideDirection("next");
      setActiveHeroSlide((current) => (current + 1) % heroSlideCount);
    }, 6500);

    return () => {
      window.clearInterval(timer);
    };
  }, [heroSlideCount, heroInteractionKey]);

  useEffect(() => {
    const selectors = [
      ".landing-section",
      ".landing-section-heading",
      ".landing-feature",
      ".landing-price-card",
      ".landing-pricing-note",
      ".landing-gallery-card",
      ".landing-service-film-copy",
      ".landing-film-stage",
      ".landing-faq-item",
      ".landing-contact",
      ".landing-footer-company",
      ".landing-footer-card",
    ];
    const elements = Array.from(
      document.querySelectorAll<HTMLElement>(selectors.join(",")),
    );
    let lastScrollY = window.scrollY;

    elements.forEach((element, index) => {
      element.classList.add("landing-reveal-target");
      element.style.setProperty("--reveal-index", String(index % 6));
    });

    const observer = new IntersectionObserver(
      (entries) => {
        const isScrollingDown = window.scrollY >= lastScrollY;
        lastScrollY = window.scrollY;

        entries.forEach((entry) => {
          const target = entry.target as HTMLElement;
          target.classList.toggle("from-scroll-down", isScrollingDown);
          target.classList.toggle("from-scroll-up", !isScrollingDown);
          target.classList.toggle("is-visible", entry.isIntersecting);
        });
      },
      {
        rootMargin: "0px 0px -4% 0px",
        threshold: 0.08,
      },
    );

    elements.forEach((element) => observer.observe(element));

    return () => {
      observer.disconnect();
      elements.forEach((element) => {
        element.classList.remove(
          "landing-reveal-target",
          "is-visible",
          "from-scroll-down",
          "from-scroll-up",
        );
        element.style.removeProperty("--reveal-index");
      });
    };
  }, []);

  const submitPlanRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (selectedScreenCount === 0) return;

    if (!isValidOptionalPhone(phone)) {
      setRequestStatus("error");
      setRequestMessage(
        "Ange ett giltigt telefonnummer med 7–15 siffror, eller lämna fältet tomt.",
      );
      return;
    }

    setRequestStatus("saving");
    setRequestMessage("");

    const response = await fetch("/api/onboarding-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quoteItems: selectedQuoteItems.map(({ plan, quantity }) => ({
          pricingPlanCode: plan.code,
          quantity,
        })),
        companyName,
        email,
        contactPerson,
        phone,
        message,
        privacyAccepted,
      }),
    });
    const data = await response.json();

    if (!response.ok) {
      setRequestStatus("error");
      setRequestMessage(data.error || t.error);
      return;
    }

    setCompanyName("");
    setEmail("");
    setContactPerson("");
    setPhone("");
    setPlanQuantities({ standard_fhd: 0, premium_4k: 0 });
    setMessage("");
    setPrivacyAccepted(false);
    setRequestStatus("success");
    setRequestMessage(t.success);
  };

  return (
    <div className="landing-page">
      <LandingNav currentPath="/" />

      <main id="top">
        <section className="landing-hero landing-hero-background-slide">
          <div
            className="landing-hero-video-layer"
            aria-hidden="true"
          >
            {currentHeroMedia && (
              <Image
                key={currentHeroMedia.id}
                src={currentHeroMedia.src}
                alt=""
                fill
                priority
                sizes="100vw"
                className={`landing-hero-background-image landing-hero-background-image-${heroSlideDirection}`}
              />
            )}
          </div>
          <div className="landing-hero-copy">
            <div
              key={`hero-copy-${heroSlideMotionKey}`}
              className={`landing-hero-copy-main ${heroSlideMotionClass}`}
            >
              <h1>
                {renderHighlightedText(currentHeroSlide.title, currentHighlightWords)}
              </h1>
              <p className="landing-lede">
                {currentHeroSlide.text}
              </p>
              <div className="landing-actions">
                <a href="#pricing" className="landing-button landing-button-primary">
                  {t.pricingCta}
                </a>
                <a href="/sa-fungerar-det" className="landing-button landing-button-secondary">
                  {t.workflowCta}
                </a>
              </div>
              <div className="landing-stats">
                {t.stats.map(([value, label]) => (
                  <div key={label}>
                    <strong>{value}</strong>
                    <span>{label}</span>
                  </div>
                ))}
              </div>
              <p className="landing-seo-copy">{t.seoIntro}</p>
            </div>
            <div
              key={`hero-benefits-${heroSlideMotionKey}`}
              className={`landing-hero-benefits ${heroSlideMotionClass}`}
              aria-label="Screenia benefits"
            >
              {heroBenefits.map(([title, text, highlight]) => (
                <div key={title} className="landing-hero-benefit">
                  <span className="landing-hero-benefit-icon" aria-hidden="true" />
                  <span>
                    <strong>{title}</strong>
                    {highlight ? (
                      <small>
                        <span className="landing-benefit-old">{text}</span>
                        <span className="landing-benefit-new">{highlight}</span>
                      </small>
                    ) : (
                      <small>{text}</small>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
          {heroSlideCount > 1 && (
            <div className="landing-hero-controls" aria-label="Bildspel">
              <button
                type="button"
                className="landing-hero-arrow"
                onClick={goToPreviousHeroSlide}
                aria-label="Visa föregående bild"
              >
                <span aria-hidden="true">‹</span>
              </button>
              <div className="landing-hero-dots" role="tablist" aria-label="Välj bild">
                {heroSlides.map((slide, index) => (
                  <button
                    key={slide.id}
                    type="button"
                    className={index === currentHeroIndex ? "is-active" : ""}
                    onClick={() => goToHeroSlide(index)}
                    role="tab"
                    aria-selected={index === currentHeroIndex}
                    aria-label={`Visa bild ${index + 1}`}
                  />
                ))}
              </div>
              <button
                type="button"
                className="landing-hero-arrow"
                onClick={goToNextHeroSlide}
                aria-label="Visa nästa bild"
              >
                <span aria-hidden="true">›</span>
              </button>
            </div>
          )}
        </section>

        <LandingSection id="platform" title={t.platformTitle} text={t.platformText}>
          <div className="landing-feature-grid">
            {t.features.map(([title, text], index) => (
              <Feature
                key={title}
                title={title}
                text={text}
                icon={featureIcons[index] || "spark"}
              />
            ))}
          </div>
          <div className="landing-illustration-grid">
            {visualCopy.sv.map(([title, text], index) => (
              <Illustration
                key={title}
                title={title}
                text={text}
                index={index}
                image={visualImages[index]}
              />
            ))}
          </div>
        </LandingSection>

        <section id="workflow" className="landing-section landing-workflow">
          <div className="landing-section-panel landing-workflow-panel">
            <div className="landing-workflow-heading">
              <h2>{t.workflowTitle}</h2>
              <p>{t.workflowText}</p>
            </div>
            <div className="landing-workflow-grid">
              {t.steps.map(([number, title, text, note]) => (
                <article key={number} className="landing-workflow-step">
                  <span>{number}</span>
                  <h3>{title}</h3>
                  <p>{text}</p>
                  <small>{note}</small>
                </article>
              ))}
            </div>
          </div>
        </section>

        <LandingSection
          id="pricing"
          title="Bygg en skärmlösning"
          text="Full HD- och 4K-enheter kan kombineras i samma förfrågan. Den beräknade kostnaden uppdateras utifrån vald kombination."
        >
          <div className="landing-price-grid">
            {plans.map((plan) => {
              const planText = planCopy.sv[plan.code];
              return (
                <article
                  key={plan.name}
                  className={`landing-price-card landing-price-card-${plan.cardAccent} ${
                    plan.featured ? "featured" : ""
                  }`}
                >
                  <div className="landing-plan-card-top">
                    {plan.featured ? (
                      <span className="landing-plan-badge">{t.recommended}</span>
                    ) : (
                      <span className="landing-plan-badge-placeholder">Startpaket</span>
                    )}
                  </div>
                  <div className="landing-plan-heading">
                    <h3>{plan.name}</h3>
                    <span>{plan.resolution}</span>
                  </div>
                  <div className="landing-plan-device" aria-hidden="true">
                    <Image
                      src={plan.deviceImage}
                      alt=""
                      width={560}
                      height={528}
                      className="landing-plan-device-image"
                    />
                    <span>{plan.deviceLabel}</span>
                  </div>
                  <p className="landing-plan-description">{planText.description}</p>
                  <ul>{planText.features.map((feature) => <li key={feature}>{feature}</li>)}</ul>
                  <div className="landing-plan-price">
                    <strong>{plan.monthlyFee}</strong>
                    <span>per skärm och månad, inkl. moms</span>
                    <span>Startar efter 21 kostnadsfria dagar</span>
                  </div>
                  <div className="landing-price-mini-grid">
                    <PriceRow
                      label="Skärmenhet, engångsvis"
                      value={formatLandingSek(plan.hardwareFeeSek)}
                    />
                    <PriceRow label="Startavgift (upp till 3 skärmar)" value={plan.setupFee} />
                  </div>
                  <div className="landing-plan-quantity">
                    <div>
                      <strong>Antal skärmar</strong>
                    </div>
                    <div className="landing-quantity-stepper">
                      <button
                        type="button"
                        onClick={() => setPlanQuantity(plan.code, planQuantities[plan.code] - 1)}
                        disabled={planQuantities[plan.code] === 0}
                        aria-label={`Minska antal ${plan.name} ${plan.resolution}`}
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="0"
                        max="50"
                        value={planQuantities[plan.code]}
                        onChange={(event) =>
                          setPlanQuantity(plan.code, Number(event.target.value) || 0)
                        }
                        aria-label={`Antal ${plan.name} ${plan.resolution}`}
                      />
                      <button
                        type="button"
                        onClick={() => setPlanQuantity(plan.code, planQuantities[plan.code] + 1)}
                        disabled={selectedScreenCount >= 50}
                        aria-label={`Öka antal ${plan.name} ${plan.resolution}`}
                      >
                        +
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
          <section className="landing-package-builder" aria-live="polite">
            <div className="landing-package-builder-heading">
              <div>
                <p className="landing-eyebrow">Vald kombination</p>
                <h3>
                  {selectedScreenCount > 0
                    ? `${selectedScreenCount} skärm${selectedScreenCount === 1 ? "" : "ar"} vald${selectedScreenCount === 1 ? "" : "a"}`
                    : "Välj antal i korten ovan"}
                </h3>
              </div>
              <span>Alla priser inkl. moms</span>
            </div>

            {selectedScreenCount > 0 ? (
              <>
                <div className="landing-package-lines">
                  {selectedQuoteItems.map(({ plan, quantity }) => (
                    <div key={plan.code}>
                      <span>{quantity} × {plan.name} {plan.resolution}</span>
                      <strong>
                        {formatLandingSek(plan.monthlyFeeSek * quantity)}/mån
                        <small>Skärmenheter: {formatLandingSek(plan.hardwareFeeSek * quantity)} engångsvis</small>
                      </strong>
                    </div>
                  ))}
                </div>
                <div className="landing-package-totals">
                  <div className="landing-package-total-primary">
                    <span>Löpande kostnad efter 21 kostnadsfria dagar</span>
                    <strong>{formatLandingSek(selectedMonthlyTotal)}/mån totalt</strong>
                    <small>Ingen bindningstid.</small>
                  </div>
                  <div className="landing-package-total-secondary">
                    <span>Engångsbetalning vid start</span>
                    <strong>{formatLandingSek(selectedFirstPayment)}</strong>
                    <small>Startavgift, alla valda enheter och frakt.</small>
                    <button
                      type="button"
                      className="landing-package-breakdown-trigger"
                      onClick={() => setPriceBreakdownOpen(true)}
                    >
                      Se exakt prisspecifikation
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={openPlanRequest}
                  className="landing-button landing-button-primary landing-package-continue"
                >
                  Fortsätt med valda skärmar
                </button>
              </>
            ) : (
              <p className="landing-package-empty">
                Lägg till Full HD, 4K eller en kombination för att beräkna kostnaden.
              </p>
            )}
          </section>
          <div className="landing-pricing-note">
            <h3>Välj rätt teknisk nivå</h3>
            <p>Samtliga priser anges inklusive svensk moms. I betalningssteget redovisas momsbeloppet separat utan att totalsumman förändras.</p>
            <p>
              Startavgiften är 1 599 kr för upp till tre skärmar. Därefter
              tillkommer 249 kr per extra skärm. Frakten är 99 kr för upp till
              tre enheter och därefter 29 kr per extra enhet.
            </p>
            <p>
              För skärmar på 50 tum kan både Full HD och 4K fungera bra
              beroende på innehållet. Om skärmen visar mycket text, menyer
              eller detaljerade bilder rekommenderar vi 4K för bästa skärpa och
              läsbarhet.
            </p>
          </div>
          {serviceLogos.length > 0 && (
            <div className="landing-logo-rail landing-pricing-logo-rail" aria-label="Betalning och leverans">
              <div className="landing-logo-track">
                {[0, 1, 2].map((group) => (
                  <div
                    key={group}
                    className="landing-logo-group"
                    aria-hidden={group > 0 ? "true" : undefined}
                  >
                    {serviceLogos.map((logo) => (
                      <span key={`${logo.label}-${group}`} className="landing-logo-tile">
                        <Image
                          src={logo.src}
                          alt={group === 0 ? `${logo.label} logo` : ""}
                          width={logo.width || 138}
                          height={logo.height || 30}
                        />
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
        </LandingSection>

        <LandingSection id="examples" title={t.galleryTitle} text={t.galleryText}>
          <div className="landing-gallery-grid">
            {t.galleryItems.map(([title, text], index) => (
              <article key={title} className="landing-gallery-card">
                <div className="landing-gallery-image">
                  <Image
                    src={galleryImages[index]}
                    alt={title}
                    width={1400}
                    height={1050}
                  />
                </div>
                <div className="landing-gallery-content">
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
              </article>
            ))}
          </div>
        </LandingSection>

        <section className="landing-section landing-service-film" aria-label="Screenia servicefilm">
          <div className="landing-section-panel landing-service-film-panel">
            <div className="landing-service-film-copy">
              <p className="landing-eyebrow">20 sekunder</p>
              <h2>Från idé till levande skärm, utan tekniskt krångel.</h2>
              <p>
                En snabb överblick över hur Screenia hjälper svenska företag att
                välja paket, skicka material, få hårdvara och hålla skärmen
                uppdaterad över tid.
              </p>
            </div>
            <div className="landing-film-stage" role="img" aria-label="Animerad film om Screenias arbetsflöde">
              <div className="landing-film-screen">
                <Image
                  src="/brand/screenia-pricing-devices.png"
                  alt="Screenia digital signage devices"
                  width={1400}
                  height={900}
                  priority={false}
                />
              </div>
              <div className="landing-film-progress" aria-hidden="true" />
            </div>
          </div>
        </section>

        <LandingSection id="faq" title={t.faqTitle}>
          <div className="landing-faq-layout">
            <div className="landing-faq-grid">
              {t.faqs.map(([question, answer]) => (
                <details key={question} className="landing-faq-item">
                  <summary>{question}</summary>
                  <p>{answer}</p>
                </details>
              ))}
            </div>
          </div>
        </LandingSection>

        <section id="contact" className="landing-contact">
          <div className="landing-contact-panel">
            <div>
              <p className="landing-eyebrow">{t.contactEyebrow}</p>
              <h2>{t.contactTitle}</h2>
              <p>{t.contactText}</p>
            </div>
            <Link href="/kontakt" className="landing-button landing-button-primary">
              {t.contactButton}
            </Link>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-footer-company">
          <p className="landing-eyebrow">Screenia</p>
          <h2>{t.companyTitle}</h2>
          <p>{t.companyText}</p>
          <ul className="landing-company-details">
            {companyDetails.map((detail) => (
              <li key={detail}>{detail}</li>
            ))}
            <li>
              <a href={`mailto:${companyEmail}`}>{companyEmail}</a>
            </li>
          </ul>
        </div>
        <div className="landing-footer-card">
          <span>Screenia</span>
          <strong>Digital skyltning för lokala företag i Sverige</strong>
          <nav>
            {footerLinks.map((link) => (
              <a key={link.href} href={link.href}>
                {link.label}
              </a>
            ))}
          </nav>
          <p>{new Date().getFullYear()} Screenia. {t.legal[2]}</p>
        </div>
      </footer>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      {requestOpen && selectedScreenCount > 0 && (
        <div className="landing-modal-backdrop" role="presentation">
          <section className="landing-modal" role="dialog" aria-modal="true" aria-labelledby="landing-request-title">
            <button
              type="button"
              onClick={closePlanRequest}
              className="landing-modal-close"
              aria-label={t.close}
              title={t.close}
            >
              <span aria-hidden="true">×</span>
            </button>
            <p className="landing-eyebrow">{t.modalEyebrow}</p>
            <h2 id="landing-request-title">
              Vald skärmlösning
            </h2>
            <p>
              {selectedQuoteItems
                .map(({ plan, quantity }) => `${quantity} × ${plan.name} ${plan.resolution}`)
              .join(" + ")}. Efter den kostnadsfria 21-dagarsperioden är abonnemanget {formatLandingSek(selectedMonthlyTotal)}/månad. Engångsbetalningen vid start är {formatLandingSek(selectedFirstPayment)} och inkluderar startavgift {formatLandingSek(selectedSetupFee)}, alla enheter och frakt {formatLandingSek(selectedShippingTotal)}. Startavgiften täcker upp till tre skärmar och fraktpriset täcker upp till tre enheter.
            </p>
            <form onSubmit={submitPlanRequest} className="landing-request-form">
              <input
                type="text"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                className="landing-honeypot"
                aria-hidden="true"
              />
              <FormField label={t.fields[0]} value={companyName} onChange={setCompanyName} placeholder={t.placeholders[0]} required />
              <FormField label={t.fields[1]} value={email} onChange={setEmail} placeholder={t.placeholders[1]} type="email" required />
              <FormField label={t.fields[2]} value={contactPerson} onChange={setContactPerson} placeholder={t.placeholders[2]} />
              <FormField label={t.fields[3]} value={phone} onChange={setPhone} placeholder={t.placeholders[3]} type="tel" />
              <div className="landing-request-selection landing-request-form-wide">
                {selectedQuoteItems.map(({ plan, quantity }) => (
                  <span key={plan.code}>{quantity} × {plan.name} {plan.resolution}</span>
                ))}
              </div>
              <label className="landing-request-form-wide">
                <span>{t.fields[4]}</span>
                <textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={3} placeholder={t.placeholders[4]} />
              </label>

              <p className="landing-request-privacy landing-request-form-wide">
                {t.requestPrivacy} <a href="/privacy" target="_blank">Integritetspolicy</a>
              </p>

              <label className="landing-request-checkbox landing-request-form-wide">
                <input
                  type="checkbox"
                  checked={privacyAccepted}
                  onChange={(event) => setPrivacyAccepted(event.target.checked)}
                  required
                />
                <span>{t.requestPrivacyConsent}</span>
              </label>

              {requestMessage && (
                <p className={`landing-request-message landing-request-${requestStatus}`}>
                  {requestMessage}
                </p>
              )}

              <button type="submit" disabled={requestStatus === "saving"} className="landing-button landing-button-primary landing-request-submit">
                {requestStatus === "saving" ? t.sending : t.submit}
              </button>
            </form>
          </section>
        </div>
      )}

      {priceBreakdownOpen && selectedScreenCount > 0 && (
        <div className="landing-modal-backdrop" role="presentation">
          <section
            className="landing-modal landing-pricing-breakdown-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="landing-price-breakdown-title"
          >
            <button
              type="button"
              onClick={() => setPriceBreakdownOpen(false)}
              className="landing-modal-close"
              aria-label={t.close}
              title={t.close}
            >
              <span aria-hidden="true">×</span>
            </button>
            <p className="landing-eyebrow">Prisöversikt</p>
            <h2 id="landing-price-breakdown-title">Exakt prisspecifikation</h2>
            <p>
              Samtliga belopp anges inklusive moms. Specifikationen bygger på
              den valda kombinationen av skärmar.
            </p>
            <dl className="landing-package-breakdown-list landing-package-breakdown-modal-list">
              <div>
                <dt>
                  Start och konfiguration
                  <small>
                    Grundavgift {formatLandingSek(plans[0].setupFeeSek)} (upp till {INCLUDED_SETUP_SCREEN_COUNT} skärmar). Inkluderar personlig rådgivning vid planering, framtagning av layout och överenskomna justeringar under uppstartsfasen.
                    {selectedAdditionalSetupScreens > 0
                      ? ` ${selectedAdditionalSetupScreens} extra skärm${selectedAdditionalSetupScreens === 1 ? "" : "ar"} × ${formatLandingSek(ADDITIONAL_SETUP_FEE_PER_SCREEN_SEK)}.`
                      : ""}
                  </small>
                </dt>
                <dd>{formatLandingSek(selectedSetupFee)}</dd>
              </div>
              <div>
                <dt>
                  Skärmenheter
                  <small>Samtliga valda Full HD- och 4K-enheter.</small>
                </dt>
                <dd>{formatLandingSek(selectedHardwareTotal)}</dd>
              </div>
              <div>
                <dt>
                  Frakt inom Sverige
                  <small>
                    {formatLandingSek(BASE_SHIPPING_FEE_SEK)} (upp till {INCLUDED_SHIPPING_DEVICE_COUNT} enheter)
                    {selectedAdditionalShippingDevices > 0
                      ? ` + ${selectedAdditionalShippingDevices} extra enhet${selectedAdditionalShippingDevices === 1 ? "" : "er"} × ${formatLandingSek(ADDITIONAL_SHIPPING_FEE_PER_DEVICE_SEK)}`
                      : ""}.
                  </small>
                </dt>
                <dd>{formatLandingSek(selectedShippingTotal)}</dd>
              </div>
              <div className="landing-package-breakdown-total">
                <dt>
                  Engångsbetalning vid start
                  <small>Startavgift, skärmenheter och frakt.</small>
                </dt>
                <dd>{formatLandingSek(selectedFirstPayment)}</dd>
              </div>
              <div>
                <dt>
                  Abonnemang efter provperiod
                  <small>Debiteras efter 21 kostnadsfria dagar. Ingen bindningstid.</small>
                </dt>
                <dd>{formatLandingSek(selectedMonthlyTotal)}/mån</dd>
              </div>
            </dl>
          </section>
        </div>
      )}
    </div>
  );
}

function LandingSection({
  id,
  title,
  text,
  children,
}: {
  id: string;
  title: string;
  text?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className={`landing-section landing-${id}`}>
      <div className="landing-section-panel">
        <SectionHeading title={title} text={text} />
        {children}
      </div>
    </section>
  );
}

function SectionHeading({
  title,
  text,
}: {
  title: string;
  text?: string;
}) {
  return (
    <div className="landing-section-heading">
      <h2>{title}</h2>
      {text && <p>{text}</p>}
    </div>
  );
}

function PriceRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="landing-price-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function FormField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label>
      <span>{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        placeholder={placeholder}
      />
    </label>
  );
}

function Illustration({
  title,
  text,
  index,
  image,
}: {
  title: string;
  text: string;
  index: number;
  image: string;
}) {
  return (
    <article className={`landing-illustration landing-illustration-${index + 1}`}>
      <div className="landing-illustration-art" aria-hidden="true">
        <Image src={image} alt="" width={420} height={300} />
        <span className="landing-illustration-icon">
          <SectionIcon name={index === 0 ? "layout" : index === 1 ? "shield" : "screen"} />
        </span>
      </div>
      <div>
        <h3>{title}</h3>
        <p>{text}</p>
      </div>
    </article>
  );
}

function Feature({
  title,
  text,
  icon,
}: {
  title: string;
  text: string;
  icon: (typeof featureIcons)[number];
}) {
  return (
    <article className="landing-feature">
      <span className="landing-feature-icon" aria-hidden="true">
        <SectionIcon name={icon} />
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
    </article>
  );
}

function SectionIcon({
  name,
}: {
  name: "spark" | "receipt" | "screen" | "megaphone" | "layout" | "shield";
}) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.8,
  };

  if (name === "receipt") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path {...common} d="M7 4h10a1 1 0 0 1 1 1v15l-3-2-3 2-3-2-3 2V5a1 1 0 0 1 1-1Z" />
        <path {...common} d="M9 8h6M9 12h6M9 16h3" />
      </svg>
    );
  }

  if (name === "screen") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect {...common} x="3" y="5" width="18" height="12" rx="2" />
        <path {...common} d="M8 21h8M12 17v4M7 9h5M7 13h10" />
      </svg>
    );
  }

  if (name === "megaphone") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path {...common} d="M4 13h3l9 4V7l-9 4H4v2Z" />
        <path {...common} d="M7 13v5a2 2 0 0 0 2 2h1M19 9.5a4 4 0 0 1 0 5" />
      </svg>
    );
  }

  if (name === "layout") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect {...common} x="4" y="5" width="16" height="14" rx="2" />
        <path {...common} d="M4 10h16M10 10v9M13 14h4" />
      </svg>
    );
  }

  if (name === "shield") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path {...common} d="M12 3 19 6v5c0 4.5-2.8 7.7-7 10-4.2-2.3-7-5.5-7-10V6l7-3Z" />
        <path {...common} d="m9 12 2 2 4-5" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path {...common} d="M12 3v4M12 17v4M4.2 7.2l2.8 2.8M17 17l2.8 2.8M3 12h4M17 12h4M4.2 16.8 7 14M17 7l2.8-2.8" />
      <circle {...common} cx="12" cy="12" r="3.2" />
    </svg>
  );
}

