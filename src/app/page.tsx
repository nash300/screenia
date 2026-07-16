"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import Image from "next/image";
import { LandingNav } from "@/components/LandingNav";
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
      "Screenia hjälper salonger, butiker och serviceföretag att visa kampanjer, prislistor och information på skärm. Du väljer paket, skickar in dina uppgifter och får hjälp att komma igång utan tekniskt krångel.",
    pricingCta: "Se paket",
    workflowCta: "Se fördelarna",
    stats: [
      ["24/7", "kontinuerlig skärmvisning"],
      ["3 veckor", "kostnadsfri provperiod"],
      ["0", "månaders bindningstid"],
    ],
    platformTitle: "En enklare väg till professionell skärmvisning",
    platformText:
      "Du behöver inte bygga ett eget system eller hantera tekniska inställningar. Screenia hjälper dig från första förfrågan till en skärm som visar rätt innehåll i din verksamhet.",
    features: [
      ["Smidig start", "Du väljer paket och får en personlig startguide där allt fortsätter på ett tydligt sätt."],
      ["Tydlig kostnad", "Du ser startavgift, enhetspris, månadskostnad, provperiod och bindningstid innan du går vidare."],
      ["Hjälp med skärmen", "Efter betalning samlar vi in material, gör layouten och skickar enheten med instruktioner."],
      ["Innehåll som syns", "Du kan visa erbjudanden, prislistor, nyheter eller annan information som passar din lokal."],
    ],
    workflowTitle: "Från paketval till fungerande skärm",
    workflowText:
      "Startguiden är den säkra sidan där du bekräftar uppgifter och betalar. Material samlas in först efter betalning så att förfrågan går snabbt.",
    steps: [
      ["01", "Välj paket", "Välj Standard eller Premium och skicka en kort förfrågan med företagets uppgifter.", "Det är inte en beställning ännu. Vi använder uppgifterna för att skapa din personliga startguide."],
      ["02", "Färdigställ uppgifter och betala", "I startguiden bekräftar du uppgifter, godkänner villkor och går vidare till betalning.", "Du behöver inte förbereda logotyp, meny eller bilder innan betalning."],
      ["03", "Skicka innehåll efter betalning", "Efter betalning väljer du om du vill ladda upp material, använda Screenia-mall eller skicka innehåll senare.", "Meny, prislista, logotyp, bilder eller enkla instruktioner räcker fint."],
      ["04", "Vi bygger layouten", "Screenia skapar första skärmförslaget, förbereder hårdvaran och skickar enheten när allt är klart.", "Du kan följa status i kundportalen."],
      ["05", "Koppla in och starta", "När enheten kommer kopplar du den till TV och Wi-Fi enligt instruktionerna vi skickar med.", "Sedan börjar skärmen visa ditt innehåll."],
    ],
    process: [["Förfrågan", "Paket valt"], ["Betalning", "Säker checkout"], ["Innehåll", "Efter betalning"], ["Start", "TV + Wi-Fi"]],
    pricingTitle: "Tydliga paket för hanterade skärmar",
    pricingText:
      "Välj Full HD för mindre skärmar och enklare innehåll, eller 4K när text, menyer och detaljer ska vara extra skarpa. Startavgift, skärmenhet och eventuell frakt betalas först. Månadsabonnemanget startar efter provperioden.",
    recommended: "Rekommenderas",
    setupFee: "Startavgift",
    monthly: "Per månad",
    choose: "Välj",
    trustTitle: "Betalning och uppgifter hanteras säkert",
    trustText:
      "Betalningen sker via en säker betalningssida med kort, Klarna och andra betalningssätt som är aktiverade för din betalning.",
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
    faqTitle: "Svar innan du väljer paket",
    faqs: [
      ["Vad händer efter att jag valt paket", "Du skickar en kort förfrågan. När Screenia har granskat den får du en personlig startguide där du bekräftar uppgifter och betalar."],
      ["Vilket material behöver jag skicka", "Inget material behövs före betalning. Efter betalning kan du ladda upp meny, prislista, logotyp, bilder eller välja en Screenia-mall."],
      ["Hur snabbt kan jag komma igång", "Efter betalning samlar vi in innehåll, skapar första layouten, förbereder hårdvaran och skickar enheten när den är klar."],
      ["Behöver jag köpa en särskild TV", "Du behöver en Smart TV eller skärm med HDMI-ingång och tillgång till Wi-Fi."],
      ["Kan jag visa kampanjer och priser samtidigt", "Ja. Vi kan bygga en layout med prislista, erbjudanden, öppettider, QR-kod och bildmaterial i samma visning."],
      ["Kan jag ändra innehållet senare", "Ja. Skicka nytt material eller nya priser till Screenia så hjälper vi dig att uppdatera skärmen."],
      ["Hur skickas enheten", "Vi väljer ett lämpligt leveranssätt utifrån adress, paketstorlek och ledtid. Du får tydliga instruktioner när enheten skickas."],
      ["Vad ingår i startavgiften", "Start- och konfigurationsavgiften är 1 599 kr för båda paketen och täcker personlig startguide, layoutarbete och förberedelse av skärminnehåll. Avgiften återbetalas inte när arbetet har startat."],
    ],
    companyTitle: "Företagsinformation",
    companyText:
      "Screenia hanterar kunduppgifter, betalning och leverans enligt våra villkor och vår integritetspolicy.",
    contactEyebrow: "Redo att komma igång",
    contactTitle: "Starta din nästa skärm med ett enklare arbetsflöde.",
    contactText:
      "Berätta hur många skärmar du vill hantera och vilket innehåll du vill visa. Vi hjälper dig att välja rätt paket.",
    contactButton: "Kontakta Screenia",
    seoIntro:
      "Screenia erbjuder digital skyltning i Sverige för salonger, butiker, restauranger och lokala serviceföretag som vill visa menyer, prislistor, kampanjer och kundinformation på TV-skärm.",
    modalEyebrow: "Skicka förfrågan",
    modalTitle: "Starta med",
    modalText:
      "Skicka företagets uppgifter så kontaktar Screenia dig med en personlig startguide för uppgifter, villkor och betalning.",
    close: "Stäng",
    fields: ["Företagsnamn *", "E-post *", "Kontaktperson", "Telefon", "Meddelande"],
    screenCountLabel: "Antal skärmar *",
    screenCountHelp: "Välj hur många skärmar eller enheter du vill beställa.",
    placeholders: ["Exempel: Salon Bella", "namn@foretag.se", "Ditt namn", "+46...", "Plats, bransch eller annat vi bör känna till."],
    requestPrivacy:
      "Vi använder uppgifterna för att hantera din förfrågan och skapa en personlig startguide. Skicka inte känsliga personuppgifter i meddelandet.",
    requestPrivacyConsent:
      "Jag har läst integritetspolicyn och förstår att Screenia sparar uppgifterna för att hantera min förfrågan.",
    sending: "Skickar förfrågan...",
    submit: "Skicka förfrågan",
    success:
      "Tack. Din förfrågan är mottagen och Screenia återkommer med en personlig startguide.",
    error: "Det gick inte att skicka din förfrågan.",
    legal: ["Villkor", "Integritet", "Alla rättigheter förbehållna."],
  },
  en: {
    nav: ["Service", "How it works", "Pricing", "Examples", "FAQ", "Contact"],
    demo: "Contact us",
    eyebrow: "Digital signage for businesses",
    hero: "Professional screen content, managed from one clear platform.",
    lede:
      "Screenia helps salons, shops, and service businesses show campaigns, price lists, and information on screens. Choose a package, send your details, and get help launching without technical hassle.",
    pricingCta: "See packages",
    workflowCta: "How it works",
    stats: [["24/7", "continuous screen playback"], ["3 weeks", "free subscription trial"], ["0", "months commitment"]],
    platformTitle: "A simpler path to professional screen display",
    platformText:
      "You do not need to build your own system or manage technical settings. Screenia helps you from the first request to a screen that shows the right content in your business.",
    features: [
      ["Smooth start", "Choose a package and receive a personal setup guide where everything continues clearly."],
      ["Clear costs", "See setup fee, device price, monthly price, trial period, and commitment before you continue."],
      ["Screen support", "We build the layout from your material and send the device with instructions."],
      ["Visible content", "Show offers, price lists, news, or information that fits your space."],
    ],
    workflowTitle: "From package choice to working screen",
    workflowText:
      "The setup guide is the secure page where you confirm details, send material, and continue to payment. We keep the rest simple.",
    steps: [
      ["01", "Choose package", "Choose Standard or Premium and send a short request with your company details.", "This is not an order yet. We use the details to create your personal setup guide."],
      ["02", "Complete details and pay", "In the setup guide, confirm details, accept terms, upload material, and continue to payment.", "Menu, price list, logo, images, or short instructions are enough."],
      ["03", "We build the layout", "After payment, we create the screen layout from your material and send the USB device within 4 working days.", "Meanwhile, you can mount or place your Smart TV."],
      ["04", "Plug in and start", "When the device arrives, connect it to HDMI, join Wi-Fi, and follow the included instructions.", "Then the screen is ready to show your content."],
    ],
    process: [["Request", "Package selected"], ["Material", "Menu, images, logo"], ["Production", "Layout + USB device"], ["Start", "HDMI + Wi-Fi"]],
    pricingTitle: "Clear packages for managed screens",
    pricingText:
      "Choose Full HD for smaller screens and simpler content, or 4K when text, menus, and details need extra sharpness. Setup, screen device, and any shipping are paid first. The monthly subscription starts after the trial.",
    recommended: "Recommended",
    setupFee: "Setup fee",
    monthly: "Per month",
    choose: "Choose",
    trustTitle: "Payment and details are handled securely",
    trustText:
      "Payment happens through a secure checkout page with cards, Klarna, and other payment methods enabled for your payment.",
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
    faqTitle: "Answers before you choose a package",
    faqs: [
      ["What happens after I choose a package", "You receive a personal setup guide where you check company details, send screen material, accept terms, and continue to payment."],
      ["What material do I need to send", "You can upload a menu, price list, logo, images, or PDFs. You can also briefly describe what the screen should show."],
      ["How quickly can I start", "After payment, we build the layout and post the USB device within 4 working days. Delivery time depends on the postal service."],
      ["Do I need a special TV", "You need a Smart TV or screen with HDMI and access to Wi-Fi."],
      ["Can I show campaigns and prices together", "Yes. We can build a layout with price lists, offers, opening hours, QR codes, and imagery in one screen flow."],
      ["Can I change the content later", "Yes. Send new material or updated prices to Screenia and we help update the screen."],
      ["How is the device shipped", "We choose a suitable delivery option by address, parcel size, and lead time. You receive clear instructions when the device is sent."],
      ["What is included in the setup fee", "The setup fee covers the personal setup guide, layout work, screen content preparation, and preparing the device for dispatch."],
    ],
    companyTitle: "Company information",
    companyText:
      "Screenia handles customer details, payment, and delivery according to our terms and privacy policy.",
    contactEyebrow: "Ready to get started",
    contactTitle: "Launch your next screen with a simpler workflow.",
    contactText:
      "Tell us how many screens you want to manage and what content you want to show. We help you choose the right package.",
    contactButton: "Contact Screenia",
    seoIntro:
      "Screenia provides digital signage in Sweden for salons, shops, restaurants, and local service businesses that want to show menus, price lists, campaigns, and customer information on TV screens.",
    modalEyebrow: "Send request",
    modalTitle: "Start with",
    modalText:
      "Send your company details and Screenia will contact you with a personal setup guide for details, terms, and payment.",
    close: "Close",
    fields: ["Company name *", "Email *", "Contact person", "Phone", "Message"],
    screenCountLabel: "Number of screens *",
    screenCountHelp: "Choose how many screens or devices you want to order.",
    placeholders: ["Example: Salon Bella", "name@company.com", "Your name", "+46...", "Location, industry, or anything else we should know."],
    requestPrivacy:
      "We use these details to handle your request and create a personal setup guide. Do not include sensitive personal data in the message.",
    requestPrivacyConsent:
      "I have read the privacy policy and understand that Screenia stores these details to handle my request.",
    sending: "Sending request...",
    submit: "Send request",
    success: "Thanks. Your request has been received and Screenia will send your personal setup guide.",
    error: "We could not send your request.",
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
        "3-week free trial",
        "No commitment",
      ],
    },
  },
} as const;

const galleryImages = [
  "/window_screen1.jpg",
  "/window_screen2.jpg",
  "/salon1.jpg",
  "/bbr.jpg",
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

export default function Home() {
  const [selectedPlan, setSelectedPlan] = useState<(typeof plans)[number] | null>(
    null,
  );
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [phone, setPhone] = useState("");
  const [screenQuantity, setScreenQuantity] = useState(1);
  const [message, setMessage] = useState("");
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [requestStatus, setRequestStatus] = useState<
    "idle" | "saving" | "success" | "error"
  >("idle");
  const [requestMessage, setRequestMessage] = useState("");
  const [heroSlides, setHeroSlides] = useState<HeroSlideAsset[]>([]);
  const [activeHeroSlide, setActiveHeroSlide] = useState(0);
  const [heroInteractionKey, setHeroInteractionKey] = useState(0);
  const [serviceLogos, setServiceLogos] = useState<LandingAsset[]>([]);

  const t = copy.sv;
  const companyDetails = [
    process.env.NEXT_PUBLIC_COMPANY_LEGAL_NAME || "Screenia",
    process.env.NEXT_PUBLIC_COMPANY_ORG_NUMBER
      ? `Organisationsnummer: ${process.env.NEXT_PUBLIC_COMPANY_ORG_NUMBER}`
      : "",
    process.env.NEXT_PUBLIC_COMPANY_ADDRESS || "",
    process.env.NEXT_PUBLIC_COMPANY_EMAIL || "service@screenia.se",
  ].filter(Boolean);
  const footerLinks = [
    { label: "Terms of Service", href: "/terms" },
    { label: "Privacy Policy", href: "/privacy" },
    { label: "Cookie Policy", href: "/cookie-policy" },
    { label: "Subscription & Billing Policy", href: "/subscription-billing-policy" },
    { label: "Support & Service Policy", href: "/support-service-policy" },
    { label: "Contact", href: "#contact" },
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

  const openPlanRequest = (plan: (typeof plans)[number]) => {
    setSelectedPlan(plan);
    setRequestStatus("idle");
    setRequestMessage("");
  };

  const closePlanRequest = () => {
    if (requestStatus === "saving") return;
    setSelectedPlan(null);
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

  const goToHeroSlide = (index: number) => {
    if (heroSlideCount <= 1) return;

    setActiveHeroSlide((index + heroSlideCount) % heroSlideCount);
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

    elements.forEach((element, index) => {
      element.classList.add("landing-reveal-target");
      element.style.setProperty("--reveal-index", String(index % 6));
    });

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      {
        rootMargin: "0px 0px -12% 0px",
        threshold: 0.12,
      },
    );

    elements.forEach((element) => observer.observe(element));

    return () => {
      observer.disconnect();
      elements.forEach((element) => {
        element.classList.remove("landing-reveal-target", "is-visible");
        element.style.removeProperty("--reveal-index");
      });
    };
  }, []);

  const submitPlanRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedPlan) return;

    setRequestStatus("saving");
    setRequestMessage("");

    const response = await fetch("/api/onboarding-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        planCode: selectedPlan.code,
        companyName,
        email,
        contactPerson,
        phone,
        screenQuantity,
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
    setScreenQuantity(1);
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
                className="landing-hero-background-image"
              />
            )}
          </div>
          <div className="landing-hero-copy">
            <div className="landing-hero-copy-main">
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
            <div className="landing-hero-benefits" aria-label="Screenia benefits">
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
          {serviceLogos.length > 0 && (
            <div className="landing-logo-rail" aria-label="Service logos">
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

        <LandingSection id="platform" eyebrow={t.nav[0]} title={t.platformTitle} text={t.platformText}>
          <div className="landing-feature-grid">
            {t.features.map(([title, text]) => (
              <Feature key={title} title={title} text={text} />
            ))}
          </div>
          <div className="landing-illustration-grid">
            {visualCopy.sv.map(([title, text], index) => (
              <Illustration key={title} title={title} text={text} index={index} />
            ))}
          </div>
        </LandingSection>

        <section id="workflow" className="landing-section landing-workflow">
          <Image
            className="landing-workflow-banner"
            src="/brand/how-it-works-sv-banner.png"
            alt="Screenia process: välj paket, slutför uppsättning, få hårdvara, anslut och begär uppdateringar"
            width={1983}
            height={793}
          />
        </section>

        <LandingSection id="pricing" eyebrow={t.nav[2]} title={t.pricingTitle} text={t.pricingText}>
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
                  {plan.featured && <span className="landing-plan-badge">{t.recommended}</span>}
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
                    <span>{t.monthly}</span>
                    <span>inkl. moms</span>
                  </div>
                  <div className="landing-price-mini-grid">
                    <PriceRow label={t.setupFee} value={plan.setupFee} />
                    <PriceRow label="Skärmenhet" value={plan.hardwareFee} />
                  </div>
                  <button
                    type="button"
                    onClick={() => openPlanRequest(plan)}
                    className="landing-button landing-button-primary"
                  >
                    {t.choose} {plan.name}
                  </button>
                </article>
              );
            })}
          </div>
          <div className="landing-pricing-note">
            <h3>Vilken version passar mig?</h3>
            <p>Alla priser visas inklusive svensk moms. Stripe Checkout visar momsbeloppet utan att höja totalsumman.</p>
            <p>
              För skärmar på 50 tum kan både Full HD och 4K fungera bra
              beroende på innehållet. Om skärmen visar mycket text, menyer
              eller detaljerade bilder rekommenderar vi 4K för bästa skärpa och
              läsbarhet.
            </p>
          </div>
        </LandingSection>

        <LandingSection id="examples" eyebrow={t.nav[3]} title={t.galleryTitle} text={t.galleryText}>
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
        </section>

        <LandingSection id="faq" eyebrow={t.nav[4]} title={t.faqTitle}>
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
          <div>
            <p className="landing-eyebrow">{t.contactEyebrow}</p>
            <h2>{t.contactTitle}</h2>
            <p>{t.contactText}</p>
          </div>
          <a href="mailto:service@screenia.se" className="landing-button landing-button-primary">
            {t.contactButton}
          </a>
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

      {selectedPlan && (
        <div className="landing-modal-backdrop" role="presentation">
          <section className="landing-modal" role="dialog" aria-modal="true" aria-labelledby="landing-request-title">
            <button type="button" onClick={closePlanRequest} className="landing-modal-close" aria-label={t.close}>
              {t.close}
            </button>
            <p className="landing-eyebrow">{t.modalEyebrow}</p>
            <h2 id="landing-request-title">
              {t.modalTitle} {selectedPlan.name} {selectedPlan.resolution}
            </h2>
            <p>{t.modalText}</p>
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
              <FormField label={t.fields[3]} value={phone} onChange={setPhone} placeholder={t.placeholders[3]} />
              <label>
                <span>{t.screenCountLabel}</span>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={screenQuantity}
                  onChange={(event) =>
                    setScreenQuantity(
                      Math.min(50, Math.max(1, Number(event.target.value) || 1)),
                    )
                  }
                  required
                />
                <small>{t.screenCountHelp}</small>
              </label>
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
    </div>
  );
}

function LandingSection({
  id,
  eyebrow,
  title,
  text,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  text?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className={`landing-section landing-${id}`}>
      <SectionHeading eyebrow={eyebrow} title={title} text={text} />
      {children}
    </section>
  );
}

function SectionHeading({
  eyebrow,
  title,
  text,
}: {
  eyebrow: string;
  title: string;
  text?: string;
}) {
  return (
    <div className="landing-section-heading">
      <p className="landing-eyebrow">{eyebrow}</p>
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
}: {
  title: string;
  text: string;
  index: number;
}) {
  return (
    <article className={`landing-illustration landing-illustration-${index + 1}`}>
      <div className="landing-illustration-art" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div>
        <h3>{title}</h3>
        <p>{text}</p>
      </div>
    </article>
  );
}

function Feature({ title, text }: { title: string; text: string }) {
  return (
    <article className="landing-feature">
      <span />
      <h3>{title}</h3>
      <p>{text}</p>
    </article>
  );
}

