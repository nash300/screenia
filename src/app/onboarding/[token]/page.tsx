"use client";

import { use, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  getCustomerLanguageFromNotes,
  normalizeCustomerLanguage,
  type CustomerLanguage,
} from "@/lib/customer-language";
import { supabase } from "@/lib/supabase/client";
import "../../landing.css";

type Customer = {
  id: string;
  name: string;
  email: string;
  status: string;
  notes: string | null;
  onboarding_token_expires_at: string | null;
};

const copy = {
  sv: {
    loading: "Laddar din startlänk...",
    invalid: "Ogiltig startlänk.",
    expired: "Den här startlänken har gått ut.",
    activeTitle: "Kontot är aktivt",
    activeText: "Ditt InfoSync-konto är aktivt.",
    readyTitle: "Nästan klart",
    readyText:
      "Dina uppgifter och ditt material är inskickade. Nästa steg är att slutföra betalningen.",
    paymentTitle: "Betalning",
    paymentText: "Du skickas vidare till en säker betalningssida.",
    paymentButton: "Fortsätt till betalning",
    paymentLoading: "Startar betalning...",
    title: "Välkommen till InfoSync",
    intro:
      "Kontrollera uppgifterna, lägg till material för skärmen och gå vidare till betalning.",
    company: "Företag",
    email: "E-post",
    detailsTitle: "Fyll i dina uppgifter",
    fields: [
      "Kontaktperson *",
      "Telefon",
      "Organisationsnummer",
      "Ort",
      "Adress",
      "Land",
    ],
    materialTitle: "Material till din skärm",
    materialText:
      "Ladda gärna upp meny, prislista, logotyp eller bilder som hjälper oss att skapa layouten. PDF, JPG, PNG, WEBP och HEIC stöds.",
    materialPlaceholder:
      "Exempel: använd menybilden, visa luncherbjudande och öppettider.",
    courierTitle: "Välj transportör",
    courierText:
      "Välj den transportör du helst vill använda. Vi bekräftar slutligt alternativ utifrån din adress och paketets storlek.",
    terms: "Jag godkänner villkoren och förstår att de gäller för InfoSync-abonnemanget. *",
    privacy:
      "Jag godkänner integritetspolicyn och förstår att InfoSync behandlar företagets och kontaktpersonens uppgifter för start, fakturering, support och leverans av tjänsten. *",
    marketing: "Jag vill få relevanta nyheter och erbjudanden från InfoSync",
    save: "Spara och fortsätt",
    saving: "Sparar...",
    requiredContact: "Kontaktperson måste anges.",
    requiredTerms: "Du måste godkänna villkoren.",
    requiredPrivacy: "Du måste godkänna integritetspolicyn.",
    requiredCourier: "Välj transportör.",
    fileSize: "Filerna får tillsammans vara högst 20 MB.",
    saved: "Uppgifterna har sparats.",
    saveError: "Det gick inte att spara uppgifterna.",
    planMissing:
      "Inget prispaket är kopplat till din startlänk. Kontakta InfoSync.",
    paymentError: "Det gick inte att starta betalningen.",
    termsBefore: "Jag godkänner ",
    termsLink: "villkoren",
    termsAfter:
      " och förstår att de gäller för InfoSync-abonnemanget. *",
    privacyBefore: "Jag godkänner ",
    privacyLink: "integritetspolicyn",
    privacyAfter:
      " och förstår att InfoSync behandlar företagets och kontaktpersonens uppgifter för start, fakturering, support och leverans av tjänsten. *",
  },
  en: {
    loading: "Loading your setup link...",
    invalid: "Invalid setup link.",
    expired: "This setup link has expired.",
    activeTitle: "Account active",
    activeText: "Your InfoSync account is active.",
    readyTitle: "Almost ready",
    readyText:
      "Your details and material have been submitted. The next step is to complete payment.",
    paymentTitle: "Payment",
    paymentText: "You will continue to a secure payment page.",
    paymentButton: "Continue to payment",
    paymentLoading: "Starting payment...",
    title: "Welcome to InfoSync",
    intro:
      "Check your details, add screen material, and continue to payment.",
    company: "Company",
    email: "Email",
    detailsTitle: "Complete your details",
    fields: ["Contact person *", "Phone", "Organisation number", "City", "Address", "Country"],
    materialTitle: "Material for your screen",
    materialText:
      "Upload a menu, price list, logo, or images that help us create the layout. PDF, JPG, PNG, WEBP, and HEIC are supported.",
    materialPlaceholder:
      "Example: use the menu image, show lunch offer and opening hours.",
    courierTitle: "Choose delivery service",
    courierText:
      "Choose the carrier you prefer. We confirm the final option based on your address and parcel size.",
    terms: "I accept the terms and understand they apply to the InfoSync subscription. *",
    privacy:
      "I accept the privacy policy and understand that InfoSync processes company and contact-person details for setup, billing, support, and service delivery. *",
    marketing: "I want to receive relevant news and offers from InfoSync",
    save: "Save and continue",
    saving: "Saving...",
    requiredContact: "Contact person is required.",
    requiredTerms: "You must accept the terms.",
    requiredPrivacy: "You must accept the privacy policy.",
    requiredCourier: "Choose a delivery service.",
    fileSize: "Files can be at most 20 MB in total.",
    saved: "Your details have been saved.",
    saveError: "We could not save your details.",
    planMissing: "No package is connected to your setup link. Contact InfoSync.",
    paymentError: "We could not start payment.",
    termsBefore: "I accept the ",
    termsLink: "terms",
    termsAfter: " and understand they apply to the InfoSync subscription. *",
    privacyBefore: "I accept the ",
    privacyLink: "privacy policy",
    privacyAfter:
      " and understand that InfoSync processes company and contact-person details for setup, billing, support, and service delivery. *",
  },
} as const;

const courierOptions = ["PostNord", "DHL", "Bring", "DB Schenker", "Instabox"] as const;

export default function OnboardingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);

  const [language, setLanguage] = useState<CustomerLanguage>("sv");
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [contactPerson, setContactPerson] = useState("");
  const [phone, setPhone] = useState("");
  const [organisationNumber, setOrganisationNumber] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("Sverige");
  const [displayNotes, setDisplayNotes] = useState("");
  const [displayFiles, setDisplayFiles] = useState<File[]>([]);
  const [preferredCourier, setPreferredCourier] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);

  const t = copy[language];

  const switchLanguage = (nextLanguage: CustomerLanguage) => {
    setLanguage(nextLanguage);
    window.localStorage.setItem("infosync-language", nextLanguage);
  };

  const fileToPayload = (file: File) => {
    return new Promise<{
      name: string;
      type: string;
      size: number;
      data: string;
    }>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () =>
        resolve({
          name: file.name,
          type: file.type,
          size: file.size,
          data: String(reader.result || ""),
        });
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  };

  useEffect(() => {
    const urlLanguage = new URLSearchParams(window.location.search).get("lang");
    setLanguage(
      normalizeCustomerLanguage(
        urlLanguage || window.localStorage.getItem("infosync-language"),
      ),
    );

    const loadCustomer = async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id, name, email, status, notes, onboarding_token_expires_at")
        .eq("onboarding_token", token)
        .single();

      if (error || !data) {
        setCustomer(null);
        setLoading(false);
        return;
      }

      const loadedCustomer = data as Customer;
      const noteLanguage = getCustomerLanguageFromNotes(loadedCustomer.notes);
      setLanguage(normalizeCustomerLanguage(urlLanguage || noteLanguage));
      setCustomer(loadedCustomer);
      setLoading(false);
    };

    loadCustomer();
  }, [token]);

  const saveProfile = async () => {
    if (!customer) return;

    if (!contactPerson.trim()) {
      setMessage(t.requiredContact);
      return;
    }
    if (!acceptedTerms) {
      setMessage(t.requiredTerms);
      return;
    }
    if (!acceptedPrivacy) {
      setMessage(t.requiredPrivacy);
      return;
    }
    if (!preferredCourier) {
      setMessage(t.requiredCourier);
      return;
    }

    const totalFileSize = displayFiles.reduce((sum, file) => sum + file.size, 0);
    if (totalFileSize > 20 * 1024 * 1024) {
      setMessage(t.fileSize);
      return;
    }

    setSaving(true);
    const displayFilePayloads = await Promise.all(displayFiles.map(fileToPayload));

    const response = await fetch("/api/onboarding/complete-profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        contactPerson,
        phone,
        organisationNumber,
        address,
        city,
        country,
        acceptedTerms,
        acceptedPrivacy,
        marketingConsent,
        displayNotes,
        displayFiles: displayFilePayloads,
        preferredCourier,
        language,
      }),
    });
    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error || t.saveError);
      setSaving(false);
      return;
    }

    setCustomer({ ...customer, status: "accepted_terms" });
    setMessage(t.saved);
    setDisplayFiles([]);
    setSaving(false);
  };

  const startPayment = async () => {
    if (!customer) return;

    const pricingPlanCode =
      customer.notes?.match(/\((standard_fhd|premium_4k)\)/)?.[1] || "";

    if (!pricingPlanCode) {
      setMessage(t.planMissing);
      return;
    }

    setSaving(true);
    const response = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerId: customer.id,
        email: customer.email,
        pricingPlanCode,
        legalAccepted: true,
        language,
      }),
    });
    const data = await response.json();

    if (!response.ok || !data.url) {
      setMessage(data.error || t.paymentError);
      setSaving(false);
      return;
    }

    window.location.href = data.url;
  };

  if (loading) return <FlowShell language={language} onLanguage={switchLanguage}>{t.loading}</FlowShell>;
  if (!customer) return <FlowShell language={language} onLanguage={switchLanguage}>{t.invalid}</FlowShell>;

  const isExpired =
    customer.onboarding_token_expires_at &&
    new Date(customer.onboarding_token_expires_at) < new Date();

  if (isExpired) return <FlowShell language={language} onLanguage={switchLanguage}>{t.expired}</FlowShell>;

  if (customer.status === "active") {
    return (
      <FlowShell language={language} onLanguage={switchLanguage}>
        <h1>{t.activeTitle}</h1>
        <p>{t.activeText}</p>
      </FlowShell>
    );
  }

  if (customer.status === "accepted_terms") {
    return (
      <FlowShell language={language} onLanguage={switchLanguage}>
        <h1>{t.readyTitle}</h1>
        <p>{t.readyText}</p>
        <section className="flow-card">
          <h2>{t.paymentTitle}</h2>
          <p>{t.paymentText}</p>
          {message && <p className="flow-message">{message}</p>}
          <button onClick={startPayment} disabled={saving} className="landing-button landing-button-primary">
            {saving ? t.paymentLoading : t.paymentButton}
          </button>
        </section>
      </FlowShell>
    );
  }

  return (
    <FlowShell language={language} onLanguage={switchLanguage}>
      <h1>{t.title}</h1>
      <p>{t.intro}</p>

      <section className="flow-card flow-summary">
        <div>
          <span>{t.company}</span>
          <strong>{customer.name}</strong>
        </div>
        <div>
          <span>{t.email}</span>
          <strong>{customer.email}</strong>
        </div>
      </section>

      <section className="flow-card">
        <h2>{t.detailsTitle}</h2>
        <div className="flow-form-grid">
          <FlowInput placeholder={t.fields[0]} value={contactPerson} onChange={setContactPerson} />
          <FlowInput placeholder={t.fields[1]} value={phone} onChange={setPhone} />
          <FlowInput placeholder={t.fields[2]} value={organisationNumber} onChange={setOrganisationNumber} />
          <FlowInput placeholder={t.fields[3]} value={city} onChange={setCity} />
          <FlowInput placeholder={t.fields[4]} value={address} onChange={setAddress} />
          <FlowInput placeholder={t.fields[5]} value={country} onChange={setCountry} />
        </div>

        <div className="flow-material">
          <h3>{t.materialTitle}</h3>
          <p>{t.materialText}</p>
          <textarea value={displayNotes} onChange={(event) => setDisplayNotes(event.target.value)} rows={3} placeholder={t.materialPlaceholder} />
          <input type="file" multiple accept="image/jpeg,image/png,image/webp,image/heic,application/pdf" onChange={(event) => setDisplayFiles(Array.from(event.target.files || []))} />
          {displayFiles.length > 0 && (
            <ul>{displayFiles.map((file) => <li key={`${file.name}-${file.size}`}>{file.name} ({Math.ceil(file.size / 1024)} KB)</li>)}</ul>
          )}
        </div>

        <div className="flow-material flow-courier">
          <h3>{t.courierTitle}</h3>
          <p>{t.courierText}</p>
          <div className="flow-courier-options">
            {courierOptions.map((courier) => (
              <label key={courier} className={preferredCourier === courier ? "active" : ""}>
                <input
                  type="radio"
                  name="preferredCourier"
                  value={courier}
                  checked={preferredCourier === courier}
                  onChange={(event) => setPreferredCourier(event.target.value)}
                />
                <span>{courier}</span>
              </label>
            ))}
          </div>
        </div>

        {message && <p className="flow-message">{message}</p>}

        <div className="flow-checks">
          <FlowCheck checked={acceptedTerms} onChange={setAcceptedTerms}>
            {t.termsBefore}
            <a href={`/terms?lang=${language}`} target="_blank">{t.termsLink}</a>
            {t.termsAfter}
          </FlowCheck>
          <FlowCheck checked={acceptedPrivacy} onChange={setAcceptedPrivacy}>
            {t.privacyBefore}
            <a href={`/privacy?lang=${language}`} target="_blank">{t.privacyLink}</a>
            {t.privacyAfter}
          </FlowCheck>
          <FlowCheck checked={marketingConsent} onChange={setMarketingConsent}>
            {t.marketing}
          </FlowCheck>
        </div>

        <button onClick={saveProfile} disabled={saving} className="landing-button landing-button-primary">
          {saving ? t.saving : t.save}
        </button>
      </section>
    </FlowShell>
  );
}

function FlowShell({
  language,
  onLanguage,
  children,
}: {
  language: CustomerLanguage;
  onLanguage: (language: CustomerLanguage) => void;
  children: ReactNode;
}) {
  return (
    <div className="landing-page flow-page">
      <header className="flow-nav">
        <Link className="landing-brand" href="/">
          <img src="/brand/infosync-logo-full-transparent.png" alt="InfoSync" />
        </Link>
        <div className="landing-language-switch">
          <button className={language === "sv" ? "active" : ""} onClick={() => onLanguage("sv")}>🇸🇪</button>
          <button className={language === "en" ? "active" : ""} onClick={() => onLanguage("en")}>🇬🇧</button>
        </div>
      </header>
      <main className="flow-shell">{children}</main>
    </div>
  );
}

function FlowInput({
  placeholder,
  value,
  onChange,
}: {
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <input
      placeholder={placeholder}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

function FlowCheck({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>{children}</span>
    </label>
  );
}
