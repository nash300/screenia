"use client";

import { use, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase/client";
import "../../landing.css";

type Customer = {
  id: string;
  name: string;
  email: string;
  status: string;
  payment_status: string | null;
  onboarding_token_expires_at: string | null;
};

type WizardStep = "details" | "payment";

const stepLabels: Record<WizardStep, string> = {
  details: "Uppgifter",
  payment: "Betalning",
};

const stepOrder: WizardStep[] = ["details", "payment"];

export default function OnboardingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<WizardStep>("details");
  const [contactPerson, setContactPerson] = useState("");
  const [phone, setPhone] = useState("");
  const [organisationNumber, setOrganisationNumber] = useState("");
  const [billingEmail, setBillingEmail] = useState("");
  const [address, setAddress] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("Sverige");
  const [businessCategory, setBusinessCategory] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [preferredContactChannel, setPreferredContactChannel] = useState("email");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [analyticsConsent, setAnalyticsConsent] = useState(false);
  const [remoteSupportConsent, setRemoteSupportConsent] = useState(false);

  useEffect(() => {
    const loadCustomer = async () => {
      const { data, error } = await supabase
        .from("customers")
        .select(
          "id, name, email, status, payment_status, onboarding_token_expires_at",
        )
        .eq("onboarding_token", token)
        .single();

      if (error || !data) {
        setCustomer(null);
        setLoading(false);
        return;
      }

      const loadedCustomer = data as Customer;
      setCustomer(loadedCustomer);
      if (loadedCustomer.status === "accepted_terms") setStep("payment");
      setLoading(false);
    };

    loadCustomer();
  }, [token]);

  const validateDetails = () => {
    if (!contactPerson.trim()) return "Kontaktperson måste anges.";
    if (!organisationNumber.trim()) return "Organisationsnummer måste anges.";
    if (!address.trim()) return "Leveransadress måste anges.";
    if (!/^\d{3}\s?\d{2}$/.test(postalCode.trim())) {
      return "Ange ett svenskt postnummer med 5 siffror.";
    }
    if (!city.trim()) return "Ort måste anges.";
    if (!["sverige", "sweden", "se"].includes(country.trim().toLowerCase())) {
      return "Screenia tar bara emot beställningar från svenska kunder.";
    }
    if (!acceptedTerms) return "Du måste godkänna villkoren.";
    if (!acceptedPrivacy) return "Du måste godkänna integritetspolicyn.";
    return "";
  };

  const saveProfile = async () => {
    if (!customer) return;

    const detailsError = validateDetails();
    if (detailsError) {
      setMessage(detailsError);
      return;
    }

    setSaving(true);
    setMessage("");

    const response = await fetch("/api/onboarding/complete-profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        contactPerson,
        phone,
        organisationNumber,
        billingEmail,
        address,
        postalCode,
        city,
        country,
        businessCategory,
        websiteUrl,
        preferredContactChannel,
        acceptedTerms,
        acceptedPrivacy,
        marketingConsent,
        analyticsConsent,
        remoteSupportConsent,
      }),
    });
    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error || "Det gick inte att spara uppgifterna.");
      setSaving(false);
      return;
    }

    setCustomer({ ...customer, status: "accepted_terms" });
    setStep("payment");
    setMessage("Uppgifterna är sparade. Nu kan du gå vidare till säker betalning.");
    setSaving(false);
  };

  const startPayment = async () => {
    if (!customer) return;

    setSaving(true);
    const response = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerId: customer.id,
        email: customer.email,
        legalAccepted: true,
      }),
    });
    const data = await response.json();

    if (!response.ok || !data.url) {
      setMessage(data.error || "Det gick inte att starta betalningen.");
      setSaving(false);
      return;
    }

    window.location.href = data.url;
  };

  if (loading) return <FlowShell>Laddar din startlänk...</FlowShell>;
  if (!customer) return <FlowShell>Ogiltig startlänk.</FlowShell>;

  const isExpired =
    customer.onboarding_token_expires_at &&
    new Date(customer.onboarding_token_expires_at) < new Date();

  if (isExpired) return <FlowShell>Den här startlänken har gått ut.</FlowShell>;

  if (customer.payment_status === "paid") {
    return (
      <FlowShell>
        <h1>Betalningen är klar</h1>
        <p>
          Vi har skickat ett e-postmeddelande där du kan välja lösenord och
          aktivera kundportalen. Där gör du innehållssetup och följer ordern.
        </p>
        <a
          href="/login"
          className="landing-button landing-button-primary"
        >
          Till inloggning
        </a>
      </FlowShell>
    );
  }

  return (
    <FlowShell wide>
      <div className="flow-hero">
        <div>
          <p className="landing-eyebrow">Screenia</p>
          <h1>Bekräfta din beställning</h1>
          <p>
            Kontrollera företagets uppgifter, godkänn villkoren och betala säkert.
            Material, logotyp och kampanjer samlar vi in först efter betalning.
          </p>
        </div>
        <img src="/brand/infosync-helper.png" alt="Screenia" className="flow-helper" />
      </div>

      <WizardSteps active={step} />

      <section className="flow-card flow-summary">
        <div>
          <span>Företag</span>
          <strong>{customer.name}</strong>
        </div>
        <div>
          <span>E-post</span>
          <strong>{customer.email}</strong>
        </div>
      </section>

      {message && <p className="flow-message">{message}</p>}

      {step === "details" && (
        <section className="flow-card">
          <h2>1. Företags- och leveransuppgifter</h2>
          <p>
            Det här tar normalt mindre än två minuter. Du behöver inte förbereda
            logotyp, meny eller bilder nu.
          </p>
          <div className="flow-form-grid">
            <FlowInput id="contact-person" name="contactPerson" label="Kontaktperson" placeholder="Kontaktperson *" value={contactPerson} onChange={setContactPerson} autoComplete="name" required />
            <FlowInput id="phone" name="phone" label="Telefon" placeholder="Telefon" value={phone} onChange={setPhone} autoComplete="tel" inputMode="tel" />
            <FlowInput id="organisation-number" name="organisationNumber" label="Organisationsnummer" placeholder="Organisationsnummer *" value={organisationNumber} onChange={setOrganisationNumber} required />
            <FlowInput id="billing-email" name="billingEmail" label="Faktura-e-post" placeholder="Faktura-e-post (valfritt)" value={billingEmail} onChange={setBillingEmail} autoComplete="email" inputMode="email" />
            <FlowInput id="delivery-address" name="address" label="Leveransadress" placeholder="Leveransadress *" value={address} onChange={setAddress} autoComplete="street-address" required />
            <FlowInput id="postal-code" name="postalCode" label="Postnummer" placeholder="Postnummer *" value={postalCode} onChange={setPostalCode} autoComplete="postal-code" inputMode="numeric" required />
            <FlowInput id="city" name="city" label="Ort" placeholder="Ort *" value={city} onChange={setCity} autoComplete="address-level2" required />
            <FlowInput id="business-category" name="businessCategory" label="Bransch" placeholder="Bransch (t.ex. restaurang, salong)" value={businessCategory} onChange={setBusinessCategory} />
            <FlowInput id="website-url" name="websiteUrl" label="Webbplats eller social länk" placeholder="Webbplats eller social länk" value={websiteUrl} onChange={setWebsiteUrl} autoComplete="url" inputMode="url" />
            <label className="flow-select-label">
              <span>Föredragen kontakt</span>
              <select
                id="preferred-contact-channel"
                name="preferredContactChannel"
                aria-label="Föredragen kontakt"
                value={preferredContactChannel}
                onChange={(event) => setPreferredContactChannel(event.target.value)}
              >
                <option value="email">E-post</option>
                <option value="phone">Telefon</option>
                <option value="sms">SMS</option>
              </select>
            </label>
            <label className="flow-select-label">
              <span>Land</span>
              <select
                id="country"
                name="country"
                aria-label="Land"
                value={country}
                onChange={(event) => setCountry(event.target.value)}
              >
                <option value="Sverige">Sverige</option>
              </select>
            </label>
          </div>

          <div className="flow-checks">
            <FlowCheck checked={acceptedTerms} onChange={setAcceptedTerms}>
              Jag godkänner <a href="/terms" target="_blank">villkoren</a>. *
            </FlowCheck>
            <FlowCheck checked={acceptedPrivacy} onChange={setAcceptedPrivacy}>
              Jag godkänner <a href="/privacy" target="_blank">integritetspolicyn</a>. *
            </FlowCheck>
            <FlowCheck checked={marketingConsent} onChange={setMarketingConsent}>
              Jag vill få relevanta nyheter och erbjudanden från Screenia.
            </FlowCheck>
            <FlowCheck checked={analyticsConsent} onChange={setAnalyticsConsent}>
              Screenia får använda order- och användningsdata för statistik och förbättring av tjänsten.
            </FlowCheck>
            <FlowCheck checked={remoteSupportConsent} onChange={setRemoteSupportConsent}>
              Screenia får kontakta mig och ge fjärrsupport när jag ber om hjälp.
            </FlowCheck>
          </div>

          <button onClick={saveProfile} disabled={saving} className="landing-button landing-button-primary">
            {saving ? "Sparar..." : "Spara och fortsätt till betalning"}
          </button>
        </section>
      )}

      {step === "payment" && (
        <section className="flow-card">
          <h2>2. Säker betalning</h2>
          <p>
            När betalningen är klar öppnas nästa steg där du kan skicka material,
            välja Screenia-mall eller låta oss kontakta dig senare.
          </p>
          <button onClick={startPayment} disabled={saving} className="landing-button landing-button-primary">
            {saving ? "Startar betalning..." : "Fortsätt till betalning"}
          </button>
        </section>
      )}
    </FlowShell>
  );
}

function WizardSteps({ active }: { active: WizardStep }) {
  const activeIndex = stepOrder.indexOf(active);
  return (
    <div className="flow-steps" aria-label="Startsteg">
      {stepOrder.map((stepName, index) => (
        <div
          key={stepName}
          className={`flow-step ${index <= activeIndex ? "is-active" : ""}`}
        >
          <span>{index + 1}</span>
          <strong>{stepLabels[stepName]}</strong>
        </div>
      ))}
    </div>
  );
}

function FlowShell({
  children,
  wide = false,
}: {
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="landing-page flow-page">
      <main className={`flow-shell ${wide ? "flow-shell-wide" : ""}`}>{children}</main>
    </div>
  );
}

function FlowInput({
  id,
  name,
  label,
  placeholder,
  value,
  onChange,
  autoComplete,
  inputMode,
  required = false,
}: {
  id: string;
  name: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  inputMode?: "email" | "numeric" | "search" | "tel" | "text" | "url";
  required?: boolean;
}) {
  return (
    <input
      id={id}
      name={name}
      aria-label={label}
      placeholder={placeholder}
      value={value}
      autoComplete={autoComplete}
      inputMode={inputMode}
      required={required}
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
