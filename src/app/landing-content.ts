import { PLAN_PRESENTATION_LIMITS } from "@/lib/pricing/plans";

export const publicSiteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://screenia.se";

export const copy = {
  sv: {
    nav: ["Tjänsten", "Så fungerar det", "Priser", "Exempel", "FAQ", "Kontakt"],
    demo: "Kontakta oss",
    eyebrow: "Digital skyltning för företag",
    hero: "Gör er TV till en säljande skärm.",
    lede:
      "Vi designar innehållet, förbereder enheten och hjälper er hela vägen. Koppla in – klart.",
    pricingCta: "Se paket",
    workflowCta: "Så fungerar det",
    stats: [
      ["Lokal annonsering för småföretag", "Nå ut med erbjudanden och information direkt där dina kunder finns."],
      ["Fungerar med en vanlig TV", "Använd en vanlig TV som reklamskärm – du väljer själv var den ska placeras."],
      ["Ingen bindningstid", "Avsluta abonnemanget när du vill."],
      ["Vi tar hand om tekniken", "Du behöver bara en TV. Screenia hanterar systemet, innehållet och den tekniska driften åt dig."],
    ],
    workflowTitle: "Från paketval till fungerande skärm",
    workflowText:
      "Ni gör de enkla valen. Screenia sköter planering, innehåll, enhet och support.",
    steps: [
      ["1", "Välj paket & skicka förfrågan", [
        "Ni väljer paket och antal skärmar, fyller i företags- och leveransuppgifter och skickar förfrågan.",
        "Screenia granskar den och återkommer.",
      ]],
      ["2", "Bekräfta, betala & skapa profil", [
        "Screenia skickar en personlig beställningslänk där ni bekräftar uppgifterna och betalar.",
        "Därefter skapar ni kundprofilen via länken i e-postmeddelandet.",
      ]],
      ["3", "Skicka material – Screenia designar", [
        "Ni skickar materialet som ska visas, och Screenia planerar och designar innehållet.",
        "Screenia kontaktar er om något behöver stämmas av.",
      ]],
      ["4", "Screenia förbereder & levererar", [
        "Screenia förbereder enheten med ert innehåll och skickar den med enkla instruktioner.",
      ]],
      ["5", "Koppla in & börja visa", [
        "Ni ansluter enheten till TV:n och internet, och mallen visas automatiskt när TV:n slås på.",
        "Screenia hjälper er vid start och framtida uppdateringar.",
      ]],
    ],
    process: [["Förfrågan", "Paket valt"], ["Betalning", "Säker checkout"], ["Innehåll", "Efter betalning"], ["Start", "TV + Wi-Fi"]],
    pricingTitle: "Tydliga paket för hanterade skärmar",
    pricingText:
      "Välj Standard Full HD, Premium 4K eller Premium Plus 4K med möjlighet att ladda upp egna videor. Paketen kan kombineras, startavgiften täcker upp till tre skärmar och månadsabonnemanget startar efter provperioden.",
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
    galleryTitle: "Presentationer i rörelse",
    galleryText:
      "Se hur professionellt utformade presentationer kan lyfta information och erbjudanden på både stående och liggande skärmar.",
    faqTitle: "Svar inför val av skärmlösning",
    faqs: [
      ["Vad händer efter valet av skärmar?", "En kort förfrågan skickas med önskad kombination. Efter Screenias granskning skickas en personlig startguide för bekräftelse av uppgifter, villkor och betalning."],
      ["Vilket material behövs?", "Inget material behövs före betalningen. Därefter kan meny, prislista, logotyp och bilder laddas upp eller en Screenia-mall väljas."],
      ["Hur lång är uppstartstiden?", "Efter betalningen samlas innehållet in. Screenia tar därefter fram den första layouten, förbereder hårdvaran och skickar enheten när arbetet är klart."],
      ["Vilken TV eller skärm krävs?", "En Smart TV eller skärm med HDMI-ingång och tillgång till Wi-Fi krävs."],
      ["När börjar abonnemanget debiteras?", "Månadsabonnemanget börjar först efter den kostnadsfria provperioden. Första betalningen avser uppstart, valda enheter och frakt."],
      ["Går det att kombinera paketen?", "Ja. Standard Full HD, Premium 4K och Premium Plus 4K kan kombineras i samma förfrågan. Screenia kontrollerar att kombinationen passar innehållet och användningen."],
      ["Vilken upplösning bör väljas?", "Full HD passar enklare innehåll och mindre skärmar. 4K rekommenderas när menyer, små texter, detaljerade bilder eller större skärmar ska vara extra tydliga."],
      ["Kan jag använda egna videor?", "Ja. Premium Plus inkluderar uppladdning av egna MP4- och WEBM-videor i kundportalen. Screenia granskar materialet före publicering för att säkerställa att det fungerar på skärmen."],
      ["Kan kampanjer och priser visas samtidigt?", "Ja. En layout kan innehålla prislista, erbjudanden, öppettider, QR-kod och bildmaterial i samma visning."],
      ["Kan innehållet ändras senare?", "Ja. Nytt material och uppdaterade priser kan skickas till Screenia för publicering på skärmen."],
      ["Kan flera skärmar visa olika innehåll?", "Ja. Flera skärmar kan planeras med samma eller olika innehåll beroende på placering, målgrupp och vald lösning."],
      ["Behövs ett eget tekniskt system?", "Nej. Screenia hanterar skärmupplägg, publicering och uppföljning så att kunden inte behöver bygga ett eget system."],
      ["Vad händer om internetanslutningen bryts?", "Skärmen behöver nätverk för uppdateringar och normal drift. Vid problem kontaktas Screenia för felsökning och nästa åtgärd."],
      ["Hur levereras enheten?", "Lämpligt leveranssätt väljs utifrån adress, paketstorlek och ledtid. Leveransinformation och instruktioner skickas när enheten lämnar Screenia."],
      ["Vad ingår i startavgiften?", "I start- och konfigurationsavgiften ingår personlig rådgivning vid planering, framtagning av layout och överenskomna justeringar under uppstartsfasen. Aktuella belopp visas i prisverktyget innan förfrågan skickas. Avgiften återbetalas inte efter att layout- eller produktionsarbetet har påbörjats."],
      ["Kan beställningen avbrytas?", "En förfrågan är inte bindande. Efter betalning beror återbetalning och avbrytande på om layout- eller produktionsarbete har startat."],
    ],
    companyTitle: "Företagsinformation",
    companyText:
      "Screenia hanterar kunduppgifter, betalning och leverans enligt våra villkor och vår integritetspolicy.",
    contactEyebrow: "Redo att komma igång",
    contactTitle: "Ett enklare arbetsflöde för nästa skärmlösning.",
    contactText:
      "Ange önskat antal skärmar i Standard, Premium eller Premium Plus samt planerat innehåll. Screenia kontrollerar kombinationen innan betalning kan genomföras.",
    contactButton: "Kontakta Screenia",
    seoIntro:
      "Screenia erbjuder digital skyltning för företag och organisationer i Sverige, oavsett bransch eller verksamhetstyp. Visa information, erbjudanden och annat visuellt innehåll på en vanlig TV eller professionell informationsskärm. Ni använder er befintliga skärm medan Screenia sköter skärminnehåll, publicering och teknisk support.",
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
      "Screenia helps businesses and organisations present campaigns, price lists, and information on screen, regardless of industry. Standard Full HD, Premium 4K, and Premium Plus 4K devices can be combined according to operational needs, with support throughout the setup process.",
    pricingCta: "See packages",
    workflowCta: "How it works",
    stats: [
      ["New for small businesses", "A new screen concept for small business owners in Sweden."],
      ["Use your own equipment", "Choose which screens to use and where to place them."],
      ["No commitment period", "Cancel the subscription whenever you want."],
      ["Easy to get started", "No technical knowledge is required."],
    ],
    workflowTitle: "From package choice to working screen",
    workflowText:
      "You make the simple choices. Screenia handles planning, content, the device, and support.",
    steps: [
      ["1", "Choose a package & send a request", [
        "You choose a package and number of screens, enter the company and delivery details, and send the request.",
        "Screenia reviews it and contacts you.",
      ]],
      ["2", "Confirm, pay & create a profile", [
        "Screenia sends a personal order link where you confirm the details and pay.",
        "You then create your profile using the link in the email.",
      ]],
      ["3", "Send material — Screenia designs", [
        "You send the material to be displayed, and Screenia plans and designs the content.",
        "Screenia contacts you if anything needs clarification.",
      ]],
      ["4", "Screenia prepares & delivers", [
        "Screenia prepares the device with your content and ships it with simple instructions.",
      ]],
      ["5", "Connect & start displaying", [
        "You connect the device to the TV and internet, and the template displays automatically when the TV is turned on.",
        "Screenia helps with startup and future updates.",
      ]],
    ],
    process: [["Request", "Package selected"], ["Material", "Menu, images, logo"], ["Production", "Layout + USB device"], ["Start", "HDMI + Wi-Fi"]],
    pricingTitle: "Clear packages for managed screens",
    pricingText:
      "Choose Standard Full HD, Premium 4K, or Premium Plus 4K with customer video uploads. Packages can be combined, the base setup fee covers up to three screens, and the monthly subscription starts after the trial.",
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
    galleryTitle: "Presentations in motion",
    galleryText:
      "See examples of digital presentations we have designed for clear, engaging display on screen.",
    faqTitle: "Answers before selecting a screen solution",
    faqs: [
      ["What happens after the screens are selected?", "A short request is submitted with the preferred combination. After Screenia reviews it, a personal setup guide is sent for confirmation of details, terms, and payment."],
      ["What material is required?", "No material is required before payment. A menu, price list, logo, and images can then be uploaded, or a Screenia template can be selected."],
      ["How long does setup take?", "After payment, the content is collected. Screenia then creates the first layout, prepares the hardware, and ships the device when the work is complete."],
      ["What type of TV or screen is required?", "A Smart TV or screen with an HDMI input and Wi-Fi access is required."],
      ["When does subscription billing start?", "The monthly subscription starts only after the free trial period. The first payment covers setup, selected devices, and shipping."],
      ["Can the packages be combined?", "Yes. Standard Full HD, Premium 4K, and Premium Plus 4K can be combined in one request. Screenia checks that the combination fits the content and use case."],
      ["Which resolution should be selected?", "Full HD suits simpler content and smaller screens. 4K is recommended when menus, small text, detailed images, or larger screens need extra clarity."],
      ["Can I use my own videos?", "Yes. Premium Plus includes customer uploads of MP4 and WEBM videos through the customer portal. Screenia reviews the material before publishing it to the screen."],
      ["Can campaigns and prices be displayed together?", "Yes. A layout can include price lists, offers, opening hours, QR codes, and imagery in the same presentation."],
      ["Can the content be changed later?", "Yes. New material and updated prices can be submitted to Screenia for publication on the screen."],
      ["Can several screens show different content?", "Yes. Several screens can be planned with the same or different content depending on location, audience, and selected solution."],
      ["Is a separate technical system required?", "No. Screenia handles screen setup, publishing, and follow-up so the customer does not need to build a separate system."],
      ["What happens if the internet connection fails?", "The screen needs network access for updates and normal operation. If a problem occurs, Screenia can help troubleshoot and agree the next action."],
      ["How is the device shipped?", "A suitable delivery option is selected according to the address, parcel size, and lead time. Delivery information and instructions are sent when the device leaves Screenia."],
      ["What is included in the setup fee?", "The setup and configuration fee includes personal planning support, layout creation, and agreed adjustments during the setup phase. Current amounts are shown in the pricing tool before the request is submitted."],
      ["Can the order be cancelled?", "A request is not binding. After payment, cancellation and refunds depend on whether layout or production work has started."],
    ],
    companyTitle: "Company information",
    companyText:
      "Screenia handles customer details, payment, and delivery according to our terms and privacy policy.",
    contactEyebrow: "Ready to get started",
    contactTitle: "A simpler workflow for the next screen solution.",
    contactText:
      "Specify the required number of Standard, Premium, or Premium Plus screens and the planned content. Screenia checks the combination before payment can be completed.",
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

export const plans = [
  {
    code: "standard_fhd",
    name: "Standard",
    resolution: "FHD",
    setupFee: "499 kr",
    hardwareFee: "699 kr",
    monthlyFee: "249 kr",
    setupFeeSek: 499,
    hardwareFeeSek: 699,
    shippingFeeSek: 99,
    monthlyFeeSek: 249,
    trialDays: 21,
    ...PLAN_PRESENTATION_LIMITS.standard_fhd,
    cardAccent: "blue",
    badge: "Startpaket",
    badgeTone: "default",
    deviceLabel: "FHD HDMI Stick",
    deviceImage: "/landing/hero-devices/mi-tv-stick.png",
    deviceAccessoryImage: "/landing/hero-devices/mi-tv-stick-remote.png",
    featured: false,
  },
  {
    code: "premium_4k",
    name: "Premium",
    resolution: "4K",
    setupFee: "499 kr",
    hardwareFee: "1 099 kr",
    monthlyFee: "349 kr",
    setupFeeSek: 499,
    hardwareFeeSek: 1099,
    shippingFeeSek: 99,
    monthlyFeeSek: 349,
    trialDays: 21,
    ...PLAN_PRESENTATION_LIMITS.premium_4k,
    cardAccent: "gold",
    badge: "Rekommenderas",
    badgeTone: "recommended",
    deviceLabel: "4K TV Box",
    deviceImage: "/landing/hero-devices/xiaomi-tv-box.png",
    deviceAccessoryImage: "/landing/hero-devices/xiaomi-tv-box-remote.png",
    featured: true,
  },
  {
    code: "premium_plus_4k",
    name: "Premium Plus",
    resolution: "4K",
    setupFee: "499 kr",
    hardwareFee: "1 099 kr",
    monthlyFee: "399 kr",
    setupFeeSek: 499,
    hardwareFeeSek: 1099,
    shippingFeeSek: 99,
    monthlyFeeSek: 399,
    trialDays: 21,
    ...PLAN_PRESENTATION_LIMITS.premium_plus_4k,
    cardAccent: "plus",
    badge: "Nyhet",
    badgeTone: "plus",
    deviceLabel: "4K TV Box",
    deviceImage: "/landing/hero-devices/xiaomi-tv-box.png",
    deviceAccessoryImage: "/landing/hero-devices/xiaomi-tv-box-remote.png",
    featured: false,
  },
] as const;

export const planCopy = {
  sv: {
    standard_fhd: {
      description:
        "För mindre skärmar och standardinnehåll i Full HD.",
      features: [
        "Uppspelning i Full HD (1080p)",
        "Rekommenderas för skärmar under 55 tum",
        "Passar kampanjer, erbjudanden och informationsskärmar",
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
        "Personlig planeringshjälp, layoutdesign och överenskomna ändringar ingår i startavgiften",
        "3 veckors kostnadsfri provperiod",
        "Ingen bindningstid",
      ],
    },
    premium_plus_4k: {
      description:
        "För verksamheter som vill kombinera extra skarp 4K-visning med egna videoklipp.",
      features: [
        "Alla funktioner som ingår i Premium",
        "Uppspelning i äkta 4K (3840×2160)",
        "Ladda upp egna MP4- och WEBM-videor via kundportalen",
        "Screenia granskar materialet före publicering",
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
        "Recommended for screens under 55 inches",
        "Fits campaigns, offers, and information screens",
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
        "Personal planning support, layout design, and agreed revisions are included in the setup fee",
        "3-week free trial",
        "No commitment",
      ],
    },
    premium_plus_4k: {
      description:
        "For businesses that want sharp 4K content and the ability to provide their own video clips.",
      features: [
        "Everything included in Premium",
        "True 4K playback (3840×2160)",
        "Upload your own MP4 and WEBM videos through the customer portal",
        "Screenia reviews the material before publication",
        "Personal planning support, layout design, and agreed revisions are included in the setup fee",
        "3-week free trial",
        "No commitment",
      ],
    },
  },
} as const;

export const workflowImages = [
  "/landing/workflow/01-package-request.png",
  "/landing/workflow/02-design-planning.png",
  "/landing/workflow/03-device-shipping.png",
  "/landing/workflow/04-connect-device.png",
  "/landing/workflow/05-live-display.png",
] as const;

export const heroBenefits = [
  ["Ingen bindningstid", "Avsluta när som helst."],
  ["Kostnadsfri provperiod", "2 veckor", "3 veckor"],
  ["Alla HDMI-skärmar", "Smart TV och signage."],
  ["100 % nöjdhetsgaranti", "Trygg start med oss."],
] as const;

export type LandingAsset = {
  label: string;
  src: string;
  width?: number;
  height?: number;
};

export type HeroSlideAsset = LandingAsset & {
  id: string;
  mediaType: "image" | "video";
  highlightTerms?: string[];
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

export type HeroBenefit = {
  id: string;
  title: string;
  body: string;
};

export const fallbackHeroBenefits: HeroBenefit[] = heroBenefits.map(
  ([title, body], index) => ({ id: `fallback-${index + 1}`, title, body }),
);

export const heroHighlightWords: Record<string, string[]> = {
  "01": ["kunder", "unikt", "fler besökare"],
  "02": ["befintliga skärm", "allt som behövs", "olika storlekar"],
  "03": ["Slipp dyra installationer", "några minuter", "Enkelt", "prisvärt", "småföretag"],
};
