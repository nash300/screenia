"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  defaultCustomerLanguage,
  normalizeCustomerLanguage,
  type CustomerLanguage,
} from "@/lib/customer-language";
import "./landing.css";

const copy = {
  sv: {
    nav: ["Tjänsten", "Så fungerar det", "Priser", "FAQ", "Kontakt"],
    demo: "Kontakta oss",
    eyebrow: "Digital skyltning för företag",
    hero:
      "Professionellt skärminnehåll, hanterat från en tydlig plattform.",
    lede:
      "InfoSync hjälper salonger, butiker och serviceföretag att visa kampanjer, prislistor och information på skärm. Du väljer paket, skickar in dina uppgifter och får hjälp att komma igång utan tekniskt krångel.",
    pricingCta: "Se paket",
    workflowCta: "Så fungerar det",
    stats: [
      ["24/7", "kontinuerlig skärmvisning"],
      ["14 dagar", "provperiod på abonnemang"],
      ["0", "månaders bindningstid"],
    ],
    platformTitle: "En enklare väg till professionell skärmvisning",
    platformText:
      "Du behöver inte bygga ett eget system eller hantera tekniska inställningar. InfoSync hjälper dig från första förfrågan till en skärm som visar rätt innehåll i din verksamhet.",
    features: [
      ["Smidig start", "Du väljer paket och får en personlig startguide där allt fortsätter på ett tydligt sätt."],
      ["Tydlig kostnad", "Du ser startavgift, månadskostnad, provperiod och bindningstid innan du går vidare."],
      ["Hjälp med skärmen", "Vi gör layouten utifrån ditt material och skickar enheten med instruktioner."],
      ["Innehåll som syns", "Du kan visa erbjudanden, prislistor, nyheter eller annan information som passar din lokal."],
    ],
    workflowTitle: "Från paketval till fungerande skärm",
    workflowText:
      "Startguiden är den säkra sidan där du bekräftar uppgifter, skickar material och går vidare till betalning. Resten håller vi enkelt.",
    steps: [
      ["01", "Välj paket", "Välj Standard eller Premium och skicka en kort förfrågan med företagets uppgifter.", "Det är inte en beställning ännu. Vi använder uppgifterna för att skapa din personliga startguide."],
      ["02", "Färdigställ uppgifter och betala", "I startguiden bekräftar du uppgifter, godkänner villkor, laddar upp material och går vidare till betalning.", "Meny, prislista, logotyp, bilder eller enkla instruktioner räcker fint."],
      ["03", "Vi bygger layouten", "Efter betalning skapar vi skärmlayouten utifrån materialet och skickar USB-enheten inom 4 arbetsdagar.", "Under tiden kan du montera eller placera din Smart TV i lokalen."],
      ["04", "Koppla in och starta", "När enheten kommer kopplar du den till HDMI, ansluter till Wi-Fi och följer instruktionerna vi skickar med.", "Sedan är skärmen redo att visa ditt innehåll."],
    ],
    process: [["Förfrågan", "Paket valt"], ["Material", "Meny, bilder, logotyp"], ["Produktion", "Layout + USB-enhet"], ["Start", "HDMI + Wi-Fi"]],
    pricingTitle: "Tydliga paket för hanterade skärmar",
    pricingText:
      "Startavgiften betalas en gång. Månadsabonnemanget har 14 dagars provperiod och ingen bindningstid.",
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
    faqTitle: "Svar innan du väljer paket",
    faqs: [
      ["Vad händer efter att jag valt paket?", "Du får en personlig startguide där du kontrollerar företagsuppgifter, skickar material till skärmen, godkänner villkor och går vidare till betalning."],
      ["Vilket material behöver jag skicka?", "Du kan ladda upp meny, prislista, logotyp, bilder eller PDF-filer. Det går också bra att skriva kort vad skärmen ska visa."],
      ["Hur snabbt kan jag komma igång?", "När betalningen är klar skapar vi layouten och postar USB-enheten inom 4 arbetsdagar. Leveranstiden beror sedan på posten."],
      ["Behöver jag köpa en särskild TV?", "Du behöver en Smart TV eller skärm med HDMI-ingång och tillgång till Wi-Fi."],
      ["Kan jag visa kampanjer och priser samtidigt?", "Ja. Vi kan bygga en layout med prislista, erbjudanden, öppettider, QR-kod och bildmaterial i samma visning."],
      ["Kan jag ändra innehållet senare?", "Ja. Skicka nytt material eller nya priser till InfoSync så hjälper vi dig att uppdatera skärmen."],
      ["Vilken leverans kan jag välja?", "I startguiden väljer kunden en tillgänglig transportör, exempelvis PostNord, DHL, Bring, DB Schenker eller Instabox."],
      ["Vad ingår i startavgiften?", "Startavgiften täcker personlig startguide, layoutarbete, förberedelse av skärminnehåll och utskick av enheten."],
    ],
    companyTitle: "Företagsinformation",
    companyText:
      "InfoSync hanterar kunduppgifter, betalning och leverans enligt våra villkor och vår integritetspolicy.",
    contactEyebrow: "Redo att komma igång?",
    contactTitle: "Starta din nästa skärm med ett enklare arbetsflöde.",
    contactText:
      "Berätta hur många skärmar du vill hantera och vilket innehåll du vill visa. Vi hjälper dig att välja rätt paket.",
    contactButton: "Kontakta InfoSync",
    seoIntro:
      "InfoSync erbjuder digital skyltning i Sverige för salonger, butiker, restauranger och lokala serviceföretag som vill visa menyer, prislistor, kampanjer och kundinformation på TV-skärm.",
    modalEyebrow: "Skicka förfrågan",
    modalTitle: "Starta med",
    modalText:
      "Skicka företagets uppgifter så kontaktar InfoSync dig med en personlig startguide för uppgifter, villkor och betalning.",
    close: "Stäng",
    fields: ["Företagsnamn *", "E-post *", "Kontaktperson", "Telefon", "Meddelande"],
    placeholders: ["Exempel: Salon Bella", "namn@foretag.se", "Ditt namn", "+46...", "Antal skärmar, plats eller annat vi bör känna till."],
    sending: "Skickar förfrågan...",
    submit: "Skicka förfrågan",
    success:
      "Tack. Din förfrågan är mottagen och InfoSync återkommer med en personlig startguide.",
    error: "Det gick inte att skicka din förfrågan.",
    legal: ["Villkor", "Integritet", "Alla rättigheter förbehållna."],
  },
  en: {
    nav: ["Service", "How it works", "Pricing", "FAQ", "Contact"],
    demo: "Contact us",
    eyebrow: "Digital signage for businesses",
    hero: "Professional screen content, managed from one clear platform.",
    lede:
      "InfoSync helps salons, shops, and service businesses show campaigns, price lists, and information on screens. Choose a package, send your details, and get help launching without technical hassle.",
    pricingCta: "See packages",
    workflowCta: "How it works",
    stats: [["24/7", "continuous screen playback"], ["14 days", "subscription trial"], ["0", "months commitment"]],
    platformTitle: "A simpler path to professional screen display",
    platformText:
      "You do not need to build your own system or manage technical settings. InfoSync helps you from the first request to a screen that shows the right content in your business.",
    features: [
      ["Smooth start", "Choose a package and receive a personal setup guide where everything continues clearly."],
      ["Clear costs", "See setup fee, monthly price, trial period, and commitment before you continue."],
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
      "The setup fee is paid once. The monthly subscription has a 14-day trial and no commitment.",
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
    faqTitle: "Answers before you choose a package",
    faqs: [
      ["What happens after I choose a package?", "You receive a personal setup guide where you check company details, send screen material, accept terms, and continue to payment."],
      ["What material do I need to send?", "You can upload a menu, price list, logo, images, or PDFs. You can also briefly describe what the screen should show."],
      ["How quickly can I start?", "After payment, we build the layout and post the USB device within 4 working days. Delivery time depends on the postal service."],
      ["Do I need a special TV?", "You need a Smart TV or screen with HDMI and access to Wi-Fi."],
      ["Can I show campaigns and prices together?", "Yes. We can build a layout with price lists, offers, opening hours, QR codes, and imagery in one screen flow."],
      ["Can I change the content later?", "Yes. Send new material or updated prices to InfoSync and we help update the screen."],
      ["Which delivery service can I choose?", "In the setup guide, the customer selects an available carrier such as PostNord, DHL, Bring, DB Schenker, or Instabox."],
      ["What is included in the setup fee?", "The setup fee covers the personal setup guide, layout work, screen content preparation, and device dispatch."],
    ],
    companyTitle: "Company information",
    companyText:
      "InfoSync handles customer details, payment, and delivery according to our terms and privacy policy.",
    contactEyebrow: "Ready to get started?",
    contactTitle: "Launch your next screen with a simpler workflow.",
    contactText:
      "Tell us how many screens you want to manage and what content you want to show. We help you choose the right package.",
    contactButton: "Contact InfoSync",
    seoIntro:
      "InfoSync provides digital signage in Sweden for salons, shops, restaurants, and local service businesses that want to show menus, price lists, campaigns, and customer information on TV screens.",
    modalEyebrow: "Send request",
    modalTitle: "Start with",
    modalText:
      "Send your company details and InfoSync will contact you with a personal setup guide for details, terms, and payment.",
    close: "Close",
    fields: ["Company name *", "Email *", "Contact person", "Phone", "Message"],
    placeholders: ["Example: Salon Bella", "name@company.com", "Your name", "+46...", "Number of screens, location, or anything we should know."],
    sending: "Sending request...",
    submit: "Send request",
    success: "Thanks. Your request has been received and InfoSync will send your personal setup guide.",
    error: "We could not send your request.",
    legal: ["Terms", "Privacy", "All rights reserved."],
  },
} as const;

const plans = [
  {
    code: "standard_fhd",
    name: "Standard",
    resolution: "FHD",
    setupFee: "1 999 kr",
    monthlyFee: "219 kr",
    featured: false,
  },
  {
    code: "premium_4k",
    name: "Premium",
    resolution: "4K",
    setupFee: "1 999 kr",
    monthlyFee: "269 kr",
    featured: true,
  },
] as const;

const planCopy = {
  sv: {
    standard_fhd: {
      description:
        "För en skärm som visar kampanjer, erbjudanden och information i Full HD.",
      features: [
        "Uppspelning i Full HD",
        "Säker startguide för uppgifter och betalning",
        "Vi hjälper dig att få skärmen redo",
        "14 dagars provperiod på månadsabonnemang",
        "Ingen bindningstid",
      ],
    },
    premium_4k: {
      description: "För verksamheter som vill visa extra skarpt innehåll i 4K.",
      features: [
        "Uppspelning för 4K-innehåll",
        "Säker startguide för uppgifter och betalning",
        "Vi hjälper dig att få skärmen redo",
        "14 dagars provperiod på månadsabonnemang",
        "Ingen bindningstid",
      ],
    },
  },
  en: {
    standard_fhd: {
      description:
        "For one screen showing campaigns, offers, and information in Full HD.",
      features: [
        "Full HD playback",
        "Secure setup guide for details and payment",
        "We help you get the screen ready",
        "14-day trial on the monthly subscription",
        "No commitment",
      ],
    },
    premium_4k: {
      description: "For businesses that want extra sharp 4K content.",
      features: [
        "Playback for 4K content",
        "Secure setup guide for details and payment",
        "We help you get the screen ready",
        "14-day trial on the monthly subscription",
        "No commitment",
      ],
    },
  },
} as const;

const navIds = ["#platform", "#workflow", "#pricing", "#faq", "#contact"];
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

type LandingAsset = {
  label: string;
  src: string;
};

type HeroSlideAsset = LandingAsset & {
  id: string;
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

const stepImages = ["/salon1.jpg", "/salon2.jpg", "/window_screen2.jpg", "/window_screen1.jpg"] as const;

const comparisonRows = {
  sv: [
    ["Upplösning", "Full HD", "4K"],
    ["Passar bäst för", "En skärm med tydliga menyer och erbjudanden", "Extra skarp visning och mer premiumkänsla"],
    ["Startavgift", "1 999 kr", "1 999 kr"],
    ["Månadspris", "219 kr", "269 kr"],
    ["Provperiod", "14 dagar", "14 dagar"],
    ["Bindningstid", "Ingen", "Ingen"],
  ],
  en: [
    ["Resolution", "Full HD", "4K"],
    ["Best for", "One screen with clear menus and offers", "Sharper display and a more premium feel"],
    ["Setup fee", "1 999 kr", "1 999 kr"],
    ["Monthly price", "219 kr", "269 kr"],
    ["Trial", "14 days", "14 days"],
    ["Commitment", "None", "None"],
  ],
} as const;

export default function Home() {
  const [language, setLanguage] = useState<CustomerLanguage>(
    defaultCustomerLanguage,
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<(typeof plans)[number] | null>(
    null,
  );
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [requestStatus, setRequestStatus] = useState<
    "idle" | "saving" | "success" | "error"
  >("idle");
  const [requestMessage, setRequestMessage] = useState("");
  const [heroSlides, setHeroSlides] = useState<HeroSlideAsset[]>([]);
  const [activeHeroSlide, setActiveHeroSlide] = useState(0);
  const [serviceLogos, setServiceLogos] = useState<LandingAsset[]>([]);

  const t = copy[language];
  const companyDetails = [
    process.env.NEXT_PUBLIC_COMPANY_LEGAL_NAME || "InfoSync",
    process.env.NEXT_PUBLIC_COMPANY_ORG_NUMBER
      ? `${language === "sv" ? "Organisationsnummer" : "Organisation number"}: ${process.env.NEXT_PUBLIC_COMPANY_ORG_NUMBER}`
      : "",
    process.env.NEXT_PUBLIC_COMPANY_ADDRESS || "",
    process.env.NEXT_PUBLIC_COMPANY_EMAIL || "hello@infosync.se",
  ].filter(Boolean);
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: "InfoSync",
    url: "https://infosync.se",
    image: "https://infosync.se/brand/infosync-logo1.png",
    email: "hello@infosync.se",
    areaServed: "Sweden",
    priceRange: "SEK 219-269 per month",
    description: t.seoIntro,
    knowsAbout: [
      "digital skyltning",
      "digital signage",
      "skärmreklam",
      "menyskärm",
      "informationsskärm",
      "TV skyltning",
    ],
    makesOffer: plans.map((plan) => ({
      "@type": "Offer",
      name: `${plan.name} ${plan.resolution}`,
      priceCurrency: "SEK",
      category: "Digital signage service",
    })),
  };

  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("lang");
    const nextLanguage = normalizeCustomerLanguage(
      fromUrl || window.localStorage.getItem("infosync-language"),
    );
    setLanguage(nextLanguage);
    window.localStorage.setItem("infosync-language", nextLanguage);
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadLandingAssets = async () => {
      try {
        const response = await fetch("/api/landing-assets");
        if (!response.ok) return;

        const data = (await response.json()) as {
          heroSlides?: HeroSlideAsset[];
          serviceLogos?: LandingAsset[];
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

  const switchLanguage = (nextLanguage: CustomerLanguage) => {
    setLanguage(nextLanguage);
    window.localStorage.setItem("infosync-language", nextLanguage);
  };

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
      ? heroSlides[activeHeroSlide % heroSlideCount][language]
      : {
          eyebrow: t.eyebrow,
          title: t.hero,
          text: t.lede,
        };
  const currentHeroVideo =
    heroSlideCount > 0 ? heroSlides[activeHeroSlide % heroSlideCount] : null;

  useEffect(() => {
    if (heroSlideCount <= 1) return;

    const timer = window.setInterval(() => {
      setActiveHeroSlide((current) => (current + 1) % heroSlideCount);
    }, 4000);

    return () => {
      window.clearInterval(timer);
    };
  }, [heroSlideCount]);

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
        message,
        language,
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
    setMessage("");
    setRequestStatus("success");
    setRequestMessage(t.success);
  };

  return (
    <div className="landing-page">
      <header className="landing-nav">
        <a className="landing-brand" href="#top" onClick={() => setMenuOpen(false)}>
          <img src="/brand/infosync-logo1.png" alt="" />
          <span>InfoSync</span>
        </a>

        <div className="landing-header-controls">
          <LanguageSwitch language={language} onLanguage={switchLanguage} />
          <button
            className="landing-menu-button"
            type="button"
            aria-label="Open menu"
            onClick={() => setMenuOpen((current) => !current)}
          >
            <span />
            <span />
            <span />
          </button>
        </div>

        <nav className={menuOpen ? "landing-links open" : "landing-links"}>
          {navIds.map((href, index) => (
            <a key={href} href={href} onClick={() => setMenuOpen(false)}>
              {t.nav[index]}
            </a>
          ))}
          <a className="landing-nav-cta" href="#contact" onClick={() => setMenuOpen(false)}>
            {t.demo}
          </a>
        </nav>
      </header>

      <main id="top">
        <section className="landing-hero">
          <div className="landing-hero-video-layer" aria-hidden="true">
            {currentHeroVideo && (
              <video
                key={currentHeroVideo.src}
                autoPlay
                muted
                playsInline
                loop
                preload="metadata"
              >
                <source src={currentHeroVideo.src} />
              </video>
            )}
          </div>
          <div className="landing-hero-copy">
            <div className="landing-hero-copy-main">
              <p className="landing-eyebrow">{currentHeroSlide.eyebrow}</p>
              <h1>{currentHeroSlide.title}</h1>
              <p className="landing-lede">{currentHeroSlide.text}</p>
              <div className="landing-actions">
                <a href="#pricing" className="landing-button landing-button-primary">
                  {t.pricingCta}
                </a>
                <a href="#workflow" className="landing-button landing-button-secondary">
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
            {serviceLogos.length > 0 && (
              <div className="landing-logo-rail" aria-label="Service logos">
                {serviceLogos.map((logo) => (
                  <span key={logo.label} className="landing-logo-tile">
                    <img src={logo.src} alt={`${logo.label} logo`} />
                  </span>
                ))}
              </div>
            )}
          </div>
        </section>

        <LandingSection id="platform" eyebrow={t.nav[0]} title={t.platformTitle} text={t.platformText}>
          <div className="landing-feature-grid">
            {t.features.map(([title, text]) => (
              <Feature key={title} title={title} text={text} />
            ))}
          </div>
          <div className="landing-illustration-grid">
            {visualCopy[language].map(([title, text], index) => (
              <Illustration key={title} title={title} text={text} index={index} />
            ))}
          </div>
        </LandingSection>

        <section id="workflow" className="landing-section landing-workflow">
          <SectionHeading eyebrow={t.nav[1]} title={t.workflowTitle} text={t.workflowText} />
          <div className="landing-workflow-layout">
            <div className="landing-timeline">
              {t.steps.map(([number, title, text, detail], index) => (
                <Step key={number} number={number} title={title} text={text} detail={detail} image={stepImages[index]} />
              ))}
            </div>
            <div className="landing-device-visual" aria-hidden="true">
              <div className="landing-device-screen">
                <span />
                <span />
                <span />
              </div>
            </div>
          </div>
          <div className="landing-process-visual" aria-label="Process overview">
            {t.process.map(([label, value]) => (
              <div key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
        </section>

        <LandingSection id="pricing" eyebrow={t.nav[2]} title={t.pricingTitle} text={t.pricingText}>
          <div className="landing-price-grid">
            {plans.map((plan) => {
              const planText = planCopy[language][plan.code];
              return (
                <article
                  key={plan.name}
                  className={plan.featured ? "landing-price-card featured" : "landing-price-card"}
                >
                  {plan.featured && <span className="landing-plan-badge">{t.recommended}</span>}
                  <div className="landing-plan-heading">
                    <div>
                      <h3>{plan.name}</h3>
                      <p>{plan.resolution}</p>
                    </div>
                    <span>{plan.resolution}</span>
                  </div>
                  <p className="landing-plan-description">{planText.description}</p>
                  <div className="landing-plan-price">
                    <strong>{plan.monthlyFee}</strong>
                    <span>{t.monthly}</span>
                  </div>
                  <PriceRow label={t.setupFee} value={plan.setupFee} />
                  <ul>{planText.features.map((feature) => <li key={feature}>{feature}</li>)}</ul>
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
          <ComparisonTable language={language} />
        </LandingSection>

        <LandingSection id="faq" eyebrow={t.nav[3]} title={t.faqTitle}>
          <div className="landing-faq-layout">
            <div className="landing-faq-grid">
              {t.faqs.map(([question, answer]) => (
                <details key={question} className="landing-faq-item">
                  <summary>{question}</summary>
                  <p>{answer}</p>
                </details>
              ))}
            </div>
            <div className="landing-faq-visual" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
          </div>
        </LandingSection>

        <section id="contact" className="landing-contact">
          <div>
            <p className="landing-eyebrow">{t.contactEyebrow}</p>
            <h2>{t.contactTitle}</h2>
            <p>{t.contactText}</p>
          </div>
          <a href="mailto:hello@infosync.se" className="landing-button landing-button-primary">
            {t.contactButton}
          </a>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-footer-company">
          <p className="landing-eyebrow">InfoSync</p>
          <h2>{t.companyTitle}</h2>
          <p>{t.companyText}</p>
          <ul className="landing-company-details">
            {companyDetails.map((detail) => (
              <li key={detail}>{detail}</li>
            ))}
          </ul>
        </div>
        <div className="landing-footer-card">
          <span>InfoSync</span>
          <strong>{language === "sv" ? "Digital skyltning för lokala företag i Sverige" : "Digital signage for local businesses in Sweden"}</strong>
          <nav>
            <a href={`/terms?lang=${language}`}>{t.legal[0]}</a>
            <a href={`/privacy?lang=${language}`}>{t.legal[1]}</a>
          </nav>
          <p>{new Date().getFullYear()} InfoSync. {t.legal[2]}</p>
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
              <FormField label={t.fields[0]} value={companyName} onChange={setCompanyName} placeholder={t.placeholders[0]} required />
              <FormField label={t.fields[1]} value={email} onChange={setEmail} placeholder={t.placeholders[1]} type="email" required />
              <FormField label={t.fields[2]} value={contactPerson} onChange={setContactPerson} placeholder={t.placeholders[2]} />
              <FormField label={t.fields[3]} value={phone} onChange={setPhone} placeholder={t.placeholders[3]} />
              <label className="landing-request-form-wide">
                <span>{t.fields[4]}</span>
                <textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={3} placeholder={t.placeholders[4]} />
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

function ComparisonTable({ language }: { language: CustomerLanguage }) {
  return (
    <div className="landing-comparison">
      <table>
        <thead>
          <tr>
            <th>{language === "sv" ? "Jämförelse" : "Comparison"}</th>
            <th>Standard</th>
            <th>Premium</th>
          </tr>
        </thead>
        <tbody>
          {comparisonRows[language].map(([label, standard, premium]) => (
            <tr key={label}>
              <th>{label}</th>
              <td>{standard}</td>
              <td>{premium}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LanguageSwitch({
  language,
  onLanguage,
}: {
  language: CustomerLanguage;
  onLanguage: (language: CustomerLanguage) => void;
}) {
  return (
    <div className="landing-language-switch" aria-label="Language">
      <button
        type="button"
        className={language === "sv" ? "active" : ""}
        onClick={() => onLanguage("sv")}
        aria-label="Svenska"
      >
        🇸🇪
      </button>
      <button
        type="button"
        className={language === "en" ? "active" : ""}
        onClick={() => onLanguage("en")}
        aria-label="English"
      >
        🇬🇧
      </button>
    </div>
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

function Step({
  number,
  title,
  text,
  detail,
  image,
}: {
  number: string;
  title: string;
  text: string;
  detail?: string;
  image: string;
}) {
  return (
    <article className="landing-step">
      <img src={image} alt="" />
      <span>{number}</span>
      <h3>{title}</h3>
      <p>{text}</p>
      {detail && <small>{detail}</small>}
    </article>
  );
}
