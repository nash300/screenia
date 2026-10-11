"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
  type TouchEvent,
} from "react";
import Image from "next/image";
import Link from "next/link";
import { LandingNav } from "@/components/LandingNav";
import { LandingScrollReveal } from "@/components/LandingScrollReveal";
import ScreeniaLogo from "@/components/ScreeniaLogo";
import { serializeJsonLd } from "@/lib/seo";
import {
  copy,
  planCopy,
  plans,
  publicSiteUrl,
  workflowImages,
  type LandingAsset,
} from "./landing-content";
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
import {
  type LandingExampleVideo,
} from "@/lib/landing/example-videos";
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

function LandingVideoPreviewCard({
  example,
  orientation,
  duplicate,
  onOpen,
}: {
  example: LandingExampleVideo;
  orientation: "portrait" | "landscape";
  duplicate: boolean;
  onOpen: (example: LandingExampleVideo) => void;
}) {
  const [playing, setPlaying] = useState(false);
  const isAccessible = !duplicate;

  return (
    <article
      className={`landing-video-gallery-card landing-video-gallery-card-${orientation}${playing ? " landing-video-gallery-card-playing" : ""}`}
      role={isAccessible ? "button" : undefined}
      tabIndex={isAccessible ? 0 : -1}
      aria-label={isAccessible ? `Spela förhandsvisning: ${example.title}` : undefined}
      onMouseEnter={() => setPlaying(true)}
      onMouseLeave={() => setPlaying(false)}
      onFocus={() => isAccessible && setPlaying(true)}
      onBlur={() => setPlaying(false)}
      onClick={() => {
        setPlaying(false);
        onOpen(example);
      }}
      onKeyDown={(event) => {
        if (!isAccessible || (event.key !== "Enter" && event.key !== " ")) return;
        event.preventDefault();
        setPlaying(false);
        onOpen(example);
      }}
    >
      <div className="landing-video-gallery-media">
        {example.poster_url ? (
          <Image
            src={example.poster_url}
            alt=""
            fill
            sizes={orientation === "portrait" ? "210px" : "390px"}
            unoptimized
            className="landing-video-gallery-poster"
          />
        ) : (
          <video
            src={example.video_url}
            muted
            playsInline
            preload="metadata"
            aria-hidden="true"
            className="landing-video-gallery-poster"
          />
        )}
        {playing && (
          <video
            src={example.video_url}
            aria-label={isAccessible ? example.title : undefined}
            aria-hidden={duplicate ? "true" : undefined}
            autoPlay
            loop
            muted
            playsInline
            preload="metadata"
            className="landing-video-gallery-playing-video"
          />
        )}
        <span className="landing-video-gallery-play" aria-hidden="true">
          <span>▶</span>
        </span>
      </div>
    </article>
  );
}

function LandingVideoRail({
  items,
  orientation,
  direction,
  onOpen,
}: {
  items: LandingExampleVideo[];
  orientation: "portrait" | "landscape";
  direction: "left" | "right";
  onOpen: (example: LandingExampleVideo) => void;
}) {
  const itemKey = items.map((item) => item.id).join(",");
  const [moving, setMoving] = useState(false);

  useEffect(() => {
    setMoving(false);
    const timer = window.setTimeout(() => setMoving(true), 900);
    return () => window.clearTimeout(timer);
  }, [itemKey, orientation]);

  if (!items.length) return null;

  const renderGroup = (group: number) => (
    <div
      key={group}
      className="landing-video-rail-group"
      aria-hidden={group > 0 ? "true" : undefined}
    >
      {items.map((example) => (
        <LandingVideoPreviewCard
          key={`${example.id}-${group}`}
          example={example}
          orientation={orientation}
          duplicate={group > 0}
          onOpen={onOpen}
        />
      ))}
    </div>
  );

  return (
    <div
      className={`landing-video-rail landing-video-rail-${orientation}`}
      aria-label={orientation === "portrait" ? "Vertikala skärmexempel" : "Horisontella skärmexempel"}
    >
      <div className={`landing-video-rail-track landing-video-rail-track-${direction}${moving ? "" : " landing-video-rail-track-pending"}`}>
        {[0, 1, 2].map(renderGroup)}
      </div>
    </div>
  );
}

export default function Home() {
  const [requestOpen, setRequestOpen] = useState(false);
  const [priceBreakdownOpen, setPriceBreakdownOpen] = useState(false);
  const [expandedExample, setExpandedExample] = useState<LandingExampleVideo | null>(null);
  const [expandedPlanDetails, setExpandedPlanDetails] = useState<Record<string, boolean>>({});
  const [planQuantities, setPlanQuantities] = useState<Record<(typeof plans)[number]["code"], number>>({
    standard_fhd: 0,
    premium_4k: 0,
    premium_plus_4k: 0,
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
  const [serviceLogos, setServiceLogos] = useState<LandingAsset[]>([]);
  const [exampleVideos, setExampleVideos] = useState<LandingExampleVideo[]>([]);
  const exampleSwipeStart = useRef<{ x: number; y: number } | null>(null);

  const t = copy.sv;
  const companyEmail = process.env.NEXT_PUBLIC_COMPANY_EMAIL || "service@screenia.se";
  const footerLinks = [
    { label: "Så fungerar digital skyltning", href: "/sa-fungerar-det" },
    { label: "Integritet", href: "/privacy" },
    { label: "Villkor", href: "/terms" },
    { label: "Kundinloggning", href: "/login" },
    { label: "Kontakt", href: "/kontakt" },
  ];
  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      "@id": `${publicSiteUrl}/#organization`,
      name: "Screenia",
      url: publicSiteUrl,
      image: `${publicSiteUrl}/brand/screenia-logo-full-white-bg.png`,
      logo: `${publicSiteUrl}/brand/screenia-logo-full-white-bg.png`,
      email: process.env.NEXT_PUBLIC_COMPANY_EMAIL || "service@screenia.se",
      areaServed: {
        "@type": "Country",
        name: "Sweden",
      },
      priceRange: "SEK 249-399 per månad",
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
        "@id": `${publicSiteUrl}/#organization`,
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "Service",
      "@id": `${publicSiteUrl}/#digital-signage-service`,
      name: "Digital skyltning för företag",
      serviceType: "Digital signage",
      provider: {
        "@id": `${publicSiteUrl}/#organization`,
      },
      audience: {
        "@type": "BusinessAudience",
        audienceType: "Företag och organisationer i Sverige",
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
          url: `${publicSiteUrl}/#pricing`,
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
          exampleVideos?: LandingExampleVideo[];
          serviceLogos: LandingAsset[];
        };

        if (!isMounted) return;

        if (data.exampleVideos?.length) {
          setExampleVideos(data.exampleVideos);
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

  const showAdjacentExample = useCallback((offset: number) => {
    setExpandedExample((current) => {
      if (!current) return null;

      const matchingExamples = exampleVideos.filter(
        (example) => example.orientation === current.orientation,
      );
      if (matchingExamples.length <= 1) return current;

      const currentIndex = matchingExamples.findIndex(
        (example) => example.id === current.id,
      );
      const nextIndex =
        (Math.max(currentIndex, 0) + offset + matchingExamples.length) %
        matchingExamples.length;
      return matchingExamples[nextIndex];
    });
  }, [exampleVideos]);

  const handleExampleSwipeStart = (event: TouchEvent<HTMLElement>) => {
    const touch = event.touches[0];
    exampleSwipeStart.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
  };

  const handleExampleSwipeEnd = (event: TouchEvent<HTMLElement>) => {
    const start = exampleSwipeStart.current;
    const touch = event.changedTouches[0];
    exampleSwipeStart.current = null;
    if (!start || !touch) return;

    const distanceX = touch.clientX - start.x;
    const distanceY = touch.clientY - start.y;
    if (Math.abs(distanceX) < 55 || Math.abs(distanceX) <= Math.abs(distanceY)) {
      return;
    }

    showAdjacentExample(distanceX < 0 ? 1 : -1);
  };

  useEffect(() => {
    if (!expandedExample) return;

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExpandedExample(null);
      if (event.key === "ArrowLeft") showAdjacentExample(-1);
      if (event.key === "ArrowRight") showAdjacentExample(1);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [expandedExample, showAdjacentExample]);

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
    setPlanQuantities({
      standard_fhd: 0,
      premium_4k: 0,
      premium_plus_4k: 0,
    });
    setMessage("");
    setPrivacyAccepted(false);
    setRequestStatus("success");
    setRequestMessage(t.success);
  };

  return (
    <div className="landing-page">
      <LandingScrollReveal />
      <LandingNav currentPath="/" />

      <main id="top">
        <section className="landing-hero landing-hero-modern" aria-labelledby="landing-hero-title">
          <div className="landing-hero-modern-grid">
            <div className="landing-hero-modern-copy">
              <p className="landing-hero-modern-eyebrow">{t.eyebrow}</p>
              <h1 id="landing-hero-title">
                <span>Gör er TV</span>
                <span>till en säljande</span>
                <span>skärm<i aria-hidden="true">.</i></span>
              </h1>
              <p className="landing-hero-modern-lede">{t.lede}</p>
              <div className="landing-actions landing-hero-modern-actions">
                <a href="#pricing" className="landing-button landing-button-primary">
                  {t.pricingCta}
                </a>
                <a href="/sa-fungerar-det" className="landing-button landing-button-secondary">
                  {t.workflowCta}
                </a>
              </div>
              <div className="landing-hero-modern-trust" aria-label="Fördelar med Screenia">
                <span><i aria-hidden="true">✓</i><strong>3 veckor kostnadsfritt</strong></span>
                <span><i aria-hidden="true">✓</i><strong>Ingen bindningstid</strong></span>
                <span><i aria-hidden="true">✓</i><strong>Personlig hjälp</strong></span>
              </div>
            </div>

            <div className="landing-hero-modern-visual" aria-label="Screenias skärmenhet">
              <div className="landing-hero-process landing-hero-process-background" aria-hidden="true">
                <figure className="landing-hero-process-card landing-hero-process-delivery">
                  <Image
                    src="/landing/hero-process/delivery-kit.webp"
                    alt=""
                    fill
                    priority
                    sizes="(max-width: 900px) 74vw, 41vw"
                  />
                </figure>
                <figure className="landing-hero-process-card landing-hero-process-connection">
                  <Image
                    src="/landing/hero-process/tv-connection.webp"
                    alt=""
                    fill
                    priority
                    sizes="(max-width: 900px) 75vw, 42vw"
                  />
                </figure>
                <figure className="landing-hero-process-card landing-hero-process-display">
                  <Image
                    src="/landing/hero-process/restaurant-display.webp"
                    alt=""
                    fill
                    priority
                    sizes="(max-width: 900px) 92vw, 48vw"
                  />
                </figure>
              </div>

              <div className="landing-hero-product-cluster" aria-hidden="true">
                <span className="landing-hero-product-layer landing-hero-product-box">
                  <Image
                    src="/landing/hero-devices/xiaomi-tv-box.png"
                    alt=""
                    width={1448}
                    height={1086}
                    priority
                    sizes="(max-width: 900px) 74vw, 36vw"
                  />
                </span>
              </div>
            </div>
          </div>
        </section>

        <section id="workflow" className="landing-section landing-section-surface landing-workflow">
          <div className="landing-section-panel landing-workflow-panel">
            <div className="landing-workflow-heading">
              <h2>{t.workflowTitle}</h2>
              <p>{t.workflowText}</p>
            </div>
            <div className="landing-workflow-grid">
              {t.steps.map(([number, title, points], index) => (
                <article key={number} className="landing-workflow-step">
                  <div className="landing-workflow-image-wrap">
                    <Image
                      src={workflowImages[index]}
                      alt=""
                      fill
                      sizes="(max-width: 780px) 42vw, (max-width: 1180px) 30vw, 18vw"
                    />
                  </div>
                  <div className="landing-workflow-step-copy">
                    <span>{number}</span>
                    <h3>{title}</h3>
                    <p className="landing-workflow-description">
                      {points.join(" ")}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <LandingSection
          id="pricing"
          title="Bygg en skärmlösning"
          text="Välj det paket och antal skärmar som passar er verksamhet. Se månads- och startkostnaden direkt innan ni går vidare."
        >
          {selectedScreenCount > 0 ? (
            <a
              className="landing-mobile-selection-bar"
              href="#selected-package-summary"
              aria-label={`Visa vald kombination: ${selectedScreenCount} skärm${selectedScreenCount === 1 ? "" : "ar"}, ${formatLandingSek(selectedMonthlyTotal)} per månad`}
            >
              <span>
                <strong>
                  {selectedScreenCount} skärm{selectedScreenCount === 1 ? "" : "ar"} vald
                  {selectedScreenCount === 1 ? "" : "a"}
                </strong>
                <small>{formatLandingSek(selectedMonthlyTotal)}/mån totalt</small>
              </span>
              <b>Visa val</b>
            </a>
          ) : null}
          <p id="pricing-swipe-hint" className="landing-price-swipe-hint">
            Svep åt sidan för att se Standard, Premium och Premium Plus.
          </p>
          <div
            className="landing-price-grid"
            role="region"
            aria-label="Abonnemangspaket"
            aria-describedby="pricing-swipe-hint"
            tabIndex={0}
          >
            {plans.map((plan) => {
              const planText = planCopy.sv[plan.code];
              return (
                <article
                  key={plan.name}
                  className={`landing-price-card landing-price-card-${plan.cardAccent} ${
                    plan.featured ? "landing-price-card-featured" : ""
                  }`}
                >
                  <div className="landing-plan-card-top">
                    <span
                      className={`landing-plan-badge landing-plan-badge-${plan.badgeTone}`}
                    >
                      {plan.badge}
                    </span>
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
                  <div
                    className={`landing-plan-details ${
                      expandedPlanDetails[plan.code] ? "landing-plan-details-expanded" : ""
                    }`}
                  >
                    <p className="landing-plan-description">{planText.description}</p>
                    <ul>
                      <li>Upp till {plan.maxSlides} slides per skärm</li>
                      <li>Upp till {plan.maxSectionsPerSlide} sektioner per slide</li>
                      {planText.features.map((feature) => <li key={feature}>{feature}</li>)}
                    </ul>
                    <button
                      type="button"
                      className="landing-plan-details-toggle"
                      onClick={() =>
                        setExpandedPlanDetails((current) => ({
                          ...current,
                          [plan.code]: !current[plan.code],
                        }))
                      }
                      aria-expanded={Boolean(expandedPlanDetails[plan.code])}
                    >
                      {expandedPlanDetails[plan.code]
                        ? "Visa mindre"
                        : "Visa alla funktioner"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
          {selectedScreenCount > 0 ? (
          <section
            id="selected-package-summary"
            className="landing-package-builder"
            aria-live="polite"
          >
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
                <div className="landing-package-lines" aria-label="Specifikation av vald kombination">
                  <section className="landing-package-cost-group">
                    <h4>Efter provperioden</h4>
                    {selectedQuoteItems.map(({ plan, quantity }) => (
                      <div key={`subscription-${plan.code}`}>
                        <span>
                          {plan.name} {plan.resolution}
                          <small>Abonnemang per månad</small>
                        </span>
                        <strong>
                          <span>{quantity} × {formatLandingSek(plan.monthlyFeeSek)}</span>
                          <b>{formatLandingSek(plan.monthlyFeeSek * quantity)}/mån</b>
                        </strong>
                      </div>
                    ))}
                  </section>

                  <section className="landing-package-cost-group">
                    <h4>Vid start</h4>
                    <div>
                      <span>
                        Startavgift
                        <small>Upp till {INCLUDED_SETUP_SCREEN_COUNT} skärmar</small>
                      </span>
                      <strong>
                        <span>1 × {formatLandingSek(plans[0].setupFeeSek)}</span>
                        <b>{formatLandingSek(plans[0].setupFeeSek)}</b>
                      </strong>
                    </div>
                    {selectedAdditionalSetupScreens > 0 && (
                      <div>
                        <span>
                          Extra startavgift
                          <small>Skärmar utöver de {INCLUDED_SETUP_SCREEN_COUNT} inkluderade</small>
                        </span>
                        <strong>
                          <span>{selectedAdditionalSetupScreens} × {formatLandingSek(ADDITIONAL_SETUP_FEE_PER_SCREEN_SEK)}</span>
                          <b>{formatLandingSek(selectedAdditionalSetupScreens * ADDITIONAL_SETUP_FEE_PER_SCREEN_SEK)}</b>
                        </strong>
                      </div>
                    )}
                    {selectedQuoteItems.map(({ plan, quantity }) => (
                      <div key={`hardware-${plan.code}`}>
                        <span>
                          {plan.name} {plan.resolution}
                          <small>Skärmenhet</small>
                        </span>
                        <strong>
                          <span>{quantity} × {formatLandingSek(plan.hardwareFeeSek)}</span>
                          <b>{formatLandingSek(plan.hardwareFeeSek * quantity)}</b>
                        </strong>
                      </div>
                    ))}
                    <div>
                      <span>
                        Frakt
                        <small>Upp till {INCLUDED_SHIPPING_DEVICE_COUNT} enheter</small>
                      </span>
                      <strong>
                        <span>1 × {formatLandingSek(BASE_SHIPPING_FEE_SEK)}</span>
                        <b>{formatLandingSek(BASE_SHIPPING_FEE_SEK)}</b>
                      </strong>
                    </div>
                    {selectedAdditionalShippingDevices > 0 && (
                      <div>
                        <span>
                          Extra frakt
                          <small>Enheter utöver de {INCLUDED_SHIPPING_DEVICE_COUNT} inkluderade</small>
                        </span>
                        <strong>
                          <span>{selectedAdditionalShippingDevices} × {formatLandingSek(ADDITIONAL_SHIPPING_FEE_PER_DEVICE_SEK)}</span>
                          <b>{formatLandingSek(selectedAdditionalShippingDevices * ADDITIONAL_SHIPPING_FEE_PER_DEVICE_SEK)}</b>
                        </strong>
                      </div>
                    )}
                  </section>
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
                Lägg till Standard, Premium eller Premium Plus för att beräkna kostnaden.
              </p>
            )}
          </section>
          ) : null}
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
          <p className="landing-video-swipe-hint">
            Svep åt sidan och tryck på en presentation för att spela.
          </p>
          <div className="landing-video-rails">
            <LandingVideoRail
              items={exampleVideos.filter((example) => example.orientation === "portrait")}
              orientation="portrait"
              direction="left"
              onOpen={setExpandedExample}
            />
            <LandingVideoRail
              items={exampleVideos.filter((example) => example.orientation !== "portrait")}
              orientation="landscape"
              direction="right"
              onOpen={setExpandedExample}
            />
          </div>
        </LandingSection>

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

        <section id="contact" className="landing-section-surface landing-contact">
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
        <div className="landing-footer-brand">
          <Link href="/" aria-label="Screenia startsida">
            <ScreeniaLogo className="screenia-logo-footer" />
          </Link>
          <p>Digital skyltning, tydligt hanterad.</p>
        </div>
        <div className="landing-footer-contact">
          <span>Kundservice</span>
          <a href={`mailto:${companyEmail}`}>{companyEmail}</a>
        </div>
        <nav aria-label="Sidfot">
          {footerLinks.map((link) => (
            <Link key={link.href} href={link.href}>
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="landing-footer-legal">
          <p>© 2026 Screenia. Screenia drivs som enskild näringsverksamhet i Sverige.</p>
          <p className="landing-footer-registration">
            <span>Godkänd för F-skatt</span>
            <span>Momsregistrerad</span>
          </p>
        </div>
      </footer>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(structuredData) }}
      />

      {expandedExample && (
        <div
          className="landing-video-lightbox-backdrop"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) setExpandedExample(null);
          }}
        >
          <section
            className={`landing-video-lightbox landing-video-lightbox-${expandedExample.orientation}`}
            role="dialog"
            aria-modal="true"
            aria-label="Förstorad videoförhandsvisning"
            onTouchStart={handleExampleSwipeStart}
            onTouchEnd={handleExampleSwipeEnd}
            onTouchCancel={() => {
              exampleSwipeStart.current = null;
            }}
          >
            {exampleVideos.filter(
              (example) => example.orientation === expandedExample.orientation,
            ).length > 1 && (
              <>
                <button
                  type="button"
                  className="landing-video-lightbox-nav landing-video-lightbox-nav-previous"
                  onClick={() => showAdjacentExample(-1)}
                  aria-label="Visa föregående presentation"
                >
                  <span aria-hidden="true">‹</span>
                </button>
                <button
                  type="button"
                  className="landing-video-lightbox-nav landing-video-lightbox-nav-next"
                  onClick={() => showAdjacentExample(1)}
                  aria-label="Visa nästa presentation"
                >
                  <span aria-hidden="true">›</span>
                </button>
                <span className="landing-video-lightbox-swipe-hint">
                  Svep för nästa
                </span>
              </>
            )}
            <button
              type="button"
              className="landing-video-lightbox-close"
              onClick={() => setExpandedExample(null)}
              aria-label="Stäng förhandsvisning"
              title="Stäng"
            >
              <span aria-hidden="true">×</span>
            </button>
            <video
              key={expandedExample.id}
              src={expandedExample.video_url}
              poster={expandedExample.poster_url || undefined}
              aria-label={expandedExample.title}
              autoPlay
              controls
              loop
              muted
              playsInline
              preload="auto"
            />
          </section>
        </div>
      )}

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
                  <small className="landing-package-hardware-calculation">
                    {selectedQuoteItems.map(({ plan, quantity }) => (
                      <span key={plan.code}>
                        {quantity} × {plan.name} {plan.resolution} à{" "}
                        {formatLandingSek(plan.hardwareFeeSek)} ={" "}
                        {formatLandingSek(plan.hardwareFeeSek * quantity)}
                      </span>
                    ))}
                  </small>
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
    <section id={id} className={`landing-section landing-section-surface landing-${id}`}>
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
