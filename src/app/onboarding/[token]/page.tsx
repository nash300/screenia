"use client";

import { use, useEffect, useState, type ReactNode } from "react";
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

type WizardStep = "details" | "material" | "payment";

type MaterialFile = {
  file: File;
  category: "logo" | "image" | "menu" | "other";
};

const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_TOTAL_BYTES = 15 * 1024 * 1024;
const MAX_FILES = 8;
const allowedFileTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "application/pdf",
]);

const stepLabels: Record<WizardStep, string> = {
  details: "Uppgifter",
  material: "Material",
  payment: "Betalning",
};

const stepOrder: WizardStep[] = ["details", "material", "payment"];

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
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("Sverige");
  const [displayNotes, setDisplayNotes] = useState("");
  const [materialFiles, setMaterialFiles] = useState<MaterialFile[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);

  useEffect(() => {
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
      setCustomer(loadedCustomer);
      if (loadedCustomer.status === "accepted_terms") setStep("payment");
      setLoading(false);
    };

    loadCustomer();
  }, [token]);

  const fileToPayload = (item: MaterialFile) => {
    return new Promise<{
      name: string;
      type: string;
      size: number;
      data: string;
      category: string;
    }>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () =>
        resolve({
          name: item.file.name,
          type: item.file.type,
          size: item.file.size,
          data: String(reader.result || ""),
          category: item.category,
        });
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(item.file);
    });
  };

  const addFiles = (files: File[], category: MaterialFile["category"]) => {
    const nextFiles = [...materialFiles];
    for (const file of files) {
      nextFiles.push({ file, category });
    }
    setMaterialFiles(nextFiles.slice(0, MAX_FILES));
  };

  const validateDetails = () => {
    if (!contactPerson.trim()) return "Kontaktperson måste anges.";
    if (!acceptedTerms) return "Du måste godkänna villkoren.";
    if (!acceptedPrivacy) return "Du måste godkänna integritetspolicyn.";
    return "";
  };

  const validateMaterial = () => {
    if (!displayNotes.trim() && materialFiles.length === 0) {
      return "Lägg till en beskrivning eller minst en fil.";
    }

    if (displayNotes.length > 1200) {
      return "Beskrivningen får vara högst 1200 tecken.";
    }

    if (materialFiles.length > MAX_FILES) {
      return `Du kan ladda upp högst ${MAX_FILES} filer.`;
    }

    const totalSize = materialFiles.reduce((sum, item) => sum + item.file.size, 0);
    if (totalSize > MAX_TOTAL_BYTES) {
      return "Filerna får tillsammans vara högst 15 MB.";
    }

    for (const item of materialFiles) {
      const limit = item.category === "logo" ? MAX_LOGO_BYTES : MAX_FILE_BYTES;
      if (!allowedFileTypes.has(item.file.type)) {
        return "Endast JPG, PNG, WEBP, HEIC och PDF kan laddas upp.";
      }
      if (item.file.size > limit) {
        return `${item.file.name} är för stor. Max ${Math.round(limit / 1024 / 1024)} MB.`;
      }
    }

    return "";
  };

  const continueToMaterial = () => {
    const error = validateDetails();
    if (error) {
      setMessage(error);
      return;
    }
    setMessage("");
    setStep("material");
  };

  const saveProfile = async () => {
    if (!customer) return;

    const detailsError = validateDetails();
    const materialError = validateMaterial();
    if (detailsError || materialError) {
      setMessage(detailsError || materialError);
      return;
    }

    setSaving(true);
    setMessage("");
    const displayFilePayloads = await Promise.all(materialFiles.map(fileToPayload));

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
      }),
    });
    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error || "Det gick inte att spara uppgifterna.");
      setSaving(false);
      return;
    }

    setCustomer({ ...customer, status: "accepted_terms" });
    setMaterialFiles([]);
    setStep("payment");
    setMessage("Uppgifterna har sparats. Nu kan du gå vidare till betalning.");
    setSaving(false);
  };

  const startPayment = async () => {
    if (!customer) return;

    const pricingPlanCode =
      customer.notes?.match(/\((standard_fhd|premium_4k)\)/)?.[1] || "";

    if (!pricingPlanCode) {
      setMessage("Inget prispaket är kopplat till din startlänk. Kontakta InfoSync.");
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

  if (customer.status === "active") {
    return (
      <FlowShell>
        <h1>Kontot är aktivt</h1>
        <p>Ditt InfoSync-konto är aktivt.</p>
      </FlowShell>
    );
  }

  return (
    <FlowShell wide>
      <div className="flow-hero">
        <div>
          <p className="landing-eyebrow">InfoSync</p>
          <h1>Kom igång med din skärm</h1>
          <p>
            Fyll i uppgifterna, ladda upp materialet vi behöver och slutför
            betalningen i sista steget.
          </p>
        </div>
        <img
          src="/brand/infosync-helper.png"
          alt="InfoSync"
          className="flow-helper"
        />
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
          <h2>1. Kunduppgifter</h2>
          <div className="flow-form-grid">
            <FlowInput placeholder="Kontaktperson *" value={contactPerson} onChange={setContactPerson} />
            <FlowInput placeholder="Telefon" value={phone} onChange={setPhone} />
            <FlowInput placeholder="Organisationsnummer" value={organisationNumber} onChange={setOrganisationNumber} />
            <FlowInput placeholder="Ort" value={city} onChange={setCity} />
            <FlowInput placeholder="Adress" value={address} onChange={setAddress} />
            <FlowInput placeholder="Land" value={country} onChange={setCountry} />
          </div>

          <div className="flow-checks">
            <FlowCheck checked={acceptedTerms} onChange={setAcceptedTerms}>
              Jag godkänner <a href="/terms" target="_blank">villkoren</a> och
              förstår att de gäller för InfoSync-abonnemanget. *
            </FlowCheck>
            <FlowCheck checked={acceptedPrivacy} onChange={setAcceptedPrivacy}>
              Jag godkänner <a href="/privacy" target="_blank">integritetspolicyn</a>.
              *
            </FlowCheck>
            <FlowCheck checked={marketingConsent} onChange={setMarketingConsent}>
              Jag vill få relevanta nyheter och erbjudanden från InfoSync.
            </FlowCheck>
          </div>

          <button onClick={continueToMaterial} className="landing-button landing-button-primary">
            Fortsätt till material
          </button>
        </section>
      )}

      {step === "material" && (
        <section className="flow-card">
          <div className="flow-material-hero">
            <div>
              <h2>2. Material till skärmens layout</h2>
              <p>
                Beskriv vad skärmen ska visa. Lägg till logotyp, bilder, meny
                eller prislista med plusknapparna och skicka allt tillsammans.
              </p>
            </div>
            <img src="/landing/hero-slides/01/image.png" alt="InfoSync" />
          </div>

          <div className="flow-upload-grid">
            <div className="flow-material">
              <h3>Text och önskemål</h3>
              <textarea
                value={displayNotes}
                onChange={(event) => setDisplayNotes(event.target.value)}
                rows={6}
                maxLength={1200}
                placeholder="Exempel: visa lunchmeny, öppettider, kampanjer och företagets logotyp. Skriv även färger eller stil om du har önskemål."
              />
              <small>{displayNotes.length}/1200 tecken</small>
            </div>

            <div className="flow-material">
              <h3>Logotyp</h3>
              <p>PNG, JPG eller WEBP. Max 2 MB.</p>
              <label className="account-plus-upload">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic"
                  onChange={(event) => addFiles(Array.from(event.target.files || []), "logo")}
                />
                <span>+</span>
                Lägg till logotyp
              </label>
            </div>

            <div className="flow-material">
              <h3>Bilder, meny eller prislista</h3>
              <p>JPG, PNG, WEBP, HEIC eller PDF. Max 5 MB per fil.</p>
              <label className="account-plus-upload">
                <input
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
                  onChange={(event) => addFiles(Array.from(event.target.files || []), "image")}
                />
                <span>+</span>
                Lägg till filer
              </label>
            </div>

            <div className="flow-material">
              <h3>Valda filer</h3>
              {materialFiles.length > 0 ? (
                <ul>
                  {materialFiles.map((item, index) => (
                    <li key={`${item.file.name}-${item.file.size}-${index}`}>
                      <span>{item.category}</span> {item.file.name} ({Math.ceil(item.file.size / 1024)} KB)
                      <button
                        type="button"
                        onClick={() =>
                          setMaterialFiles(materialFiles.filter((_, itemIndex) => itemIndex !== index))
                        }
                      >
                        Ta bort
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>Inga filer valda ännu.</p>
              )}
            </div>
          </div>

          <div className="flow-actions">
            <button
              type="button"
              onClick={() => setStep("details")}
              className="landing-button landing-button-secondary"
            >
              Tillbaka
            </button>
            <button
              onClick={saveProfile}
              disabled={saving}
              className="landing-button landing-button-primary"
            >
              {saving ? "Sparar..." : "Spara och gå till betalning"}
            </button>
          </div>
        </section>
      )}

      {step === "payment" && (
        <section className="flow-card">
          <h2>3. Betalning</h2>
          <p>
            Dina uppgifter och ditt material är sparade. Du skickas vidare till
            en säker betalningssida.
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
