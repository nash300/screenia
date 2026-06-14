"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { LandingNav } from "@/components/LandingNav";
import "../landing.css";

type AccountSection = "overview" | "setup" | "material" | "messages" | "billing" | "legal";

type AccountData = {
  customer: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    contact_person: string | null;
    organisation_number: string | null;
    address: string | null;
    city: string | null;
    country: string | null;
    status: string;
    payment_status: string | null;
    stripe_customer_id: string | null;
    stripe_subscription_id: string | null;
    activated_at: string | null;
    cancelled_at: string | null;
    created_at: string;
    website_url: string | null;
    business_description: string | null;
    opening_hours: string | null;
    promotions: string | null;
    social_media: string | null;
    content_option: string | null;
    content_collected_at: string | null;
    preview_status: string | null;
    preview_url: string | null;
    preview_feedback: string | null;
  };
  subscriptions: Array<{
    id: string;
    order_number: string;
    status: string;
    setup_fee_paid: boolean;
    setup_fee_sek: number | null;
    hardware_fee_sek: number | null;
    shipping_fee_sek: number | null;
    monthly_fee_sek: number | null;
    trial_days: number | null;
    tax_status: string | null;
    tax_amount_sek: number | null;
    total_amount_sek: number | null;
    fulfillment_status: string | null;
    inventory_status: string | null;
    tracking_number: string | null;
    tracking_url: string | null;
    stripe_subscription_id: string | null;
    stripe_payment_status: string | null;
    created_at: string;
    pricing_plans?: {
      name: string;
      resolution: string;
      code: string;
    } | null;
  }>;
  devices: Array<{
    id: string;
    device_code: string;
    name: string | null;
    is_active: boolean;
    location: string | null;
    inventory_status: string | null;
    assigned_at: string | null;
  }>;
  messages: Array<{
    id: string;
    ticket_number: string | null;
    request_type: string;
    priority: string;
    related_ticket_number: string | null;
    subject: string | null;
    message: string;
    status: string;
    created_at: string;
    files: Array<{
      id: string;
      fileName: string;
      contentType: string;
      fileSize: number;
      downloadUrl: string | null;
    }>;
  }>;
  displayAssets: Array<{
    id: string;
    file_name: string | null;
    content_type: string | null;
    file_size: number | null;
    asset_category: string;
    description: string | null;
    source: string;
    status: string;
    created_at: string;
    downloadUrl: string | null;
  }>;
  agreements: Array<{
    id: string;
    document_type: string;
    document_title: string;
    document_version: string;
    document_effective_at: string | null;
    document_url: string | null;
    pdf_url: string | null;
    content_snapshot: string;
    accepted_at: string;
    collection_point: string;
  }>;
  legalDocuments: Array<{
    id: string;
    document_type: string;
    title: string;
    version: string;
    effective_at: string;
    status: string;
    summary: string | null;
    pdf_url: string | null;
  }>;
};

type MaterialUploadItem = {
  file: File;
  category: string;
};

const formatter = new Intl.NumberFormat("sv-SE");

const sections: Array<{
  id: AccountSection;
  label: string;
  detail: string;
}> = [
  { id: "overview", label: "Översikt", detail: "Företag, skärmar, status" },
  { id: "setup", label: "Innehåll", detail: "Första setup och underlag" },
  { id: "material", label: "Skärmmaterial", detail: "Ladda upp filer och text" },
  { id: "messages", label: "Ärenden", detail: "Support, retur och historik" },
  { id: "billing", label: "Abonnemang", detail: "Betalning och avslut" },
  { id: "legal", label: "Avtal", detail: "Villkor och godkännanden" },
];

const requestTypes = [
  { value: "general", label: "Allmän fråga" },
  { value: "issue", label: "Rapportera problem" },
  { value: "return", label: "Registrera retur" },
  { value: "material_update", label: "Ändra skärminnehåll" },
  { value: "billing", label: "Faktura eller betalning" },
  { value: "technical_support", label: "Teknisk support" },
];

const priorities = [
  { value: "low", label: "Låg" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "Hög" },
  { value: "urgent", label: "Akut" },
];

const cancellationReasons = [
  { value: "", label: "Välj orsak" },
  { value: "too_expensive", label: "För dyrt" },
  { value: "missing_features", label: "Saknar funktioner" },
  { value: "not_using", label: "Använder inte tjänsten" },
  { value: "switching_provider", label: "Byter leverantör" },
  { value: "technical_issue", label: "Tekniskt problem" },
  { value: "temporary_pause", label: "Tillfälligt uppehåll" },
  { value: "other", label: "Annan orsak" },
];

function money(amount: number | null) {
  if (typeof amount !== "number") return "-";
  return `${formatter.format(amount)} kr`;
}

function date(value: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("sv-SE", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function fileSize(value: number | null) {
  if (!value) return "-";
  if (value < 1024 * 1024) return `${Math.ceil(value / 1024)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function assetCategoryLabel(value: string) {
  if (value === "logo") return "Logo";
  if (value === "image") return "Bild";
  if (value === "menu") return "Meny eller prislista";
  if (value === "text") return "Text";
  return "Annat";
}

function requestTypeLabel(value: string) {
  return requestTypes.find((item) => item.value === value)?.label || "Allmän fråga";
}

function priorityLabel(value: string) {
  return priorities.find((item) => item.value === value)?.label || "Normal";
}

function statusLabel(value: string | null) {
  if (value === "active") return "Aktiv";
  if (value === "paid") return "Betald";
  if (value === "new_request") return "Förfrågan mottagen";
  if (value === "accepted_terms") return "Redo för betalning";
  if (value === "content_collection") return "Innehåll samlas in";
  if (value === "content_pending") return "Innehåll väntar";
  if (value === "content_received") return "Innehåll mottaget";
  if (value === "inactive") return "Inaktiv";
  if (value === "suspended") return "Pausad";
  if (value === "cancelled") return "Avslutad";
  if (value === "new") return "Nytt";
  if (value === "customer_reply") return "Kundsvar";
  if (value === "in_progress") return "Pågår";
  if (value === "resolved") return "Löst";
  return value || "-";
}

function contentOptionLabel(value: string | null) {
  if (value === "upload") return "Eget material";
  if (value === "template") return "InfoSync-mall";
  if (value === "later") return "Skickas senare";
  return "-";
}

function journeySteps(data: AccountData) {
  const subscription = data.subscriptions[0];
  const customerStatus = data.customer.status;
  const paymentStatus = data.customer.payment_status;
  const fulfillment = subscription?.fulfillment_status;
  const inventory = subscription?.inventory_status;
  const hasDevice = data.devices.length > 0;
  const hasContent = data.displayAssets.length > 0 || customerStatus === "content_received";

  return [
    {
      label: "Förfrågan",
      detail: "InfoSync har tagit emot din förfrågan.",
      done: Boolean(data.customer.created_at),
    },
    {
      label: "Godkänd order",
      detail: "Vi har granskat uppgifterna och skickat startlänken.",
      done: ["accepted_terms", "paid", "content_pending", "content_received", "active"].includes(customerStatus),
    },
    {
      label: "Betalning",
      detail: "Betalningen är klar innan vi samlar in material.",
      done: paymentStatus === "paid" || ["paid", "active"].includes(subscription?.status || ""),
    },
    {
      label: "Innehåll",
      detail: "Material, öppettider och önskemål är skickade eller planerade.",
      done: hasContent || ["content_pending", "content_received", "active"].includes(customerStatus),
    },
    {
      label: "Förhandsvisning",
      detail: "InfoSync tar fram första skärmförslaget.",
      done: ["preview_approved", "in_production", "ready_to_ship", "shipped", "completed"].includes(fulfillment || ""),
    },
    {
      label: "Hårdvara",
      detail: "Enheten förbereds och kopplas till din skärm.",
      done: hasDevice || ["assigned", "shipped"].includes(inventory || ""),
    },
    {
      label: "Leverans",
      detail: "Ordern är skickad och kan följas med spårning.",
      done: fulfillment === "shipped" || inventory === "shipped" || customerStatus === "active",
    },
    {
      label: "Aktiv",
      detail: "Skärmen är inkopplad och visar innehåll.",
      done: customerStatus === "active",
    },
  ];
}

export default function AccountPage() {
  const [data, setData] = useState<AccountData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<AccountSection>("overview");
  const [messageSubject, setMessageSubject] = useState("");
  const [messageText, setMessageText] = useState("");
  const [messageFiles, setMessageFiles] = useState<File[]>([]);
  const [requestType, setRequestType] = useState("general");
  const [requestPriority, setRequestPriority] = useState("normal");
  const [relatedTicketNumber, setRelatedTicketNumber] = useState("");
  const [materialDescription, setMaterialDescription] = useState("");
  const [materialCategory, setMaterialCategory] = useState("image");
  const [materialFiles, setMaterialFiles] = useState<MaterialUploadItem[]>([]);
  const [setupBusinessName, setSetupBusinessName] = useState("");
  const [setupBusinessDescription, setSetupBusinessDescription] = useState("");
  const [setupOpeningHours, setSetupOpeningHours] = useState("");
  const [setupPromotions, setSetupPromotions] = useState("");
  const [setupWebsiteUrl, setSetupWebsiteUrl] = useState("");
  const [setupSocialMedia, setSetupSocialMedia] = useState("");
  const [setupContentOption, setSetupContentOption] = useState("template");
  const [setupNotes, setSetupNotes] = useState("");
  const [setupFiles, setSetupFiles] = useState<MaterialUploadItem[]>([]);
  const [savingSetup, setSavingSetup] = useState(false);
  const [notice, setNotice] = useState("");
  const [sending, setSending] = useState(false);
  const [uploadingMaterial, setUploadingMaterial] = useState(false);
  const [cancellationReason, setCancellationReason] = useState("");
  const [cancellationDetails, setCancellationDetails] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const router = useRouter();

  const activeSubscription = data?.subscriptions[0];
  const dashboardStats = useMemo(
    () => [
      { label: "Skärmar", value: String(data?.devices.length || 0) },
      { label: "Nya uppladdningar", value: String(data?.displayAssets.filter((item) => item.status === "new").length || 0) },
      { label: "Ärenden", value: String(data?.messages.length || 0) },
    ],
    [data],
  );

  const loadAccount = useCallback(async () => {
    const response = await fetch("/api/account");
    if (response.status === 401) {
      router.push("/login");
      return;
    }

    const nextData = await response.json();
    setData(nextData);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    loadAccount();
  }, [loadAccount]);

  useEffect(() => {
    if (!data?.customer) return;
    setSetupBusinessName(data.customer.name || "");
    setSetupBusinessDescription(data.customer.business_description || "");
    setSetupOpeningHours(data.customer.opening_hours || "");
    setSetupPromotions(data.customer.promotions || "");
    setSetupWebsiteUrl(data.customer.website_url || "");
    setSetupSocialMedia(data.customer.social_media || "");
    setSetupContentOption(data.customer.content_option || "template");
  }, [data?.customer]);

  const fileToPayload = (file: File, category = "other") => {
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
          name: file.name,
          type: file.type,
          size: file.size,
          data: String(reader.result || ""),
          category,
        });
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  };

  const addMaterialFiles = (files: FileList | File[]) => {
    const nextFiles = Array.from(files).map((file) => ({
      file,
      category: materialCategory,
    }));
    setMaterialFiles((current) => [...current, ...nextFiles].slice(0, 8));
  };

  const addSetupFiles = (files: FileList | File[]) => {
    const nextFiles = Array.from(files).map((file) => ({
      file,
      category: "image",
    }));
    setSetupFiles((current) => [...current, ...nextFiles].slice(0, 8));
  };

  const submitContentSetup = async () => {
    if (!setupBusinessName.trim() || !setupBusinessDescription.trim()) {
      setNotice("Företagsnamn och kort beskrivning måste anges.");
      return;
    }

    if (setupContentOption === "upload" && !setupNotes.trim() && setupFiles.length === 0) {
      setNotice("Lägg till filer eller skriv vad skärmen ska visa.");
      return;
    }

    setSavingSetup(true);
    setNotice("");
    const files = await Promise.all(
      setupFiles.map((item) => fileToPayload(item.file, item.category)),
    );

    const response = await fetch("/api/account/content-setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessName: setupBusinessName,
        businessDescription: setupBusinessDescription,
        openingHours: setupOpeningHours,
        promotions: setupPromotions,
        websiteUrl: setupWebsiteUrl,
        socialMedia: setupSocialMedia,
        contentOption: setupContentOption,
        displayNotes: setupNotes,
        displayFiles: files,
      }),
    });
    const result = await response.json();

    if (!response.ok) {
      setNotice(result.error || "Kunde inte spara innehållsunderlaget.");
      setSavingSetup(false);
      return;
    }

    setSetupFiles([]);
    setSetupNotes("");
    setNotice("Innehållsunderlaget har skickats till InfoSync.");
    setSavingSetup(false);
    loadAccount();
  };

  const uploadDisplayMaterial = async () => {
    if (!materialDescription.trim() && materialFiles.length === 0) {
      setNotice("Lägg till en beskrivning eller minst en fil innan du skickar.");
      return;
    }

    setUploadingMaterial(true);
    setNotice("");
    const files = await Promise.all(
      materialFiles.map((item) => fileToPayload(item.file, item.category)),
    );
    const response = await fetch("/api/account/display-assets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description: materialDescription,
        files,
      }),
    });
    const result = await response.json();

    if (!response.ok) {
      setNotice(result.error || "Kunde inte ladda upp materialet.");
      setUploadingMaterial(false);
      return;
    }

    setMaterialDescription("");
    setMaterialFiles([]);
    setNotice("Materialet har skickats till InfoSync.");
    setUploadingMaterial(false);
    loadAccount();
  };

  const sendMessage = async () => {
    if (!messageText.trim()) {
      setNotice("Skriv ett meddelande innan du skickar.");
      return;
    }

    setSending(true);
    setNotice("");
    const files = await Promise.all(messageFiles.map((file) => fileToPayload(file)));
    const response = await fetch("/api/account/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subject: messageSubject,
        message: messageText,
        requestType,
        priority: requestPriority,
        relatedTicketNumber: relatedTicketNumber || null,
        files,
      }),
    });
    const result = await response.json();

    if (!response.ok) {
      setNotice(result.error || "Kunde inte skicka ärendet.");
      setSending(false);
      return;
    }

    setMessageSubject("");
    setMessageText("");
    setMessageFiles([]);
    setRelatedTicketNumber("");
    setNotice(
      result.ticketNumber
        ? `Ärendet har skickats. Ärendenummer: ${result.ticketNumber}`
        : "Ärendet har skickats till InfoSync.",
    );
    setSending(false);
    loadAccount();
  };

  const openBillingPortal = async () => {
    setNotice("");
    const response = await fetch("/api/account/billing-portal", {
      method: "POST",
    });
    const result = await response.json();
    if (!response.ok || !result.url) {
      setNotice(result.error || "Kunde inte öppna betalningsportalen.");
      return;
    }
    window.location.href = result.url;
  };

  const cancelSubscription = async () => {
    if (!cancellationReason) {
      setNotice("Välj en avslutsorsak först.");
      return;
    }

    const confirmed = window.confirm(
      "Vill du avsluta ditt InfoSync-abonnemang? Skärmtjänsten kan sluta fungera efter avslut.",
    );
    if (!confirmed) return;

    setCancelling(true);
    setNotice("");
    const response = await fetch("/api/account/cancel-subscription", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reason: cancellationReason,
        details: cancellationDetails,
      }),
    });
    const result = await response.json();
    if (!response.ok) {
      setNotice(result.error || "Kunde inte avsluta abonnemanget.");
      setCancelling(false);
      return;
    }
    setNotice("Abonnemanget har avslutats. Tack för din feedback.");
    setCancelling(false);
    loadAccount();
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  if (loading) {
    return <AccountShell onSignOut={signOut}>Laddar ditt konto...</AccountShell>;
  }

  if (!data) {
    return <AccountShell onSignOut={signOut}>Kunde inte ladda ditt konto.</AccountShell>;
  }

  return (
    <AccountShell onSignOut={signOut}>
      <div className="account-dashboard">
        <aside className="account-sidebar" aria-label="Account sections">
          <div className="account-sidebar-profile">
            <span className="account-avatar">{data.customer.name.slice(0, 1).toUpperCase()}</span>
            <div>
              <strong>{data.customer.name}</strong>
              <span>{data.customer.email}</span>
            </div>
          </div>

          <nav className="account-menu">
            {sections.map((section) => (
              <button
                key={section.id}
                type="button"
                className={activeSection === section.id ? "is-active" : ""}
                onClick={() => setActiveSection(section.id)}
              >
                <strong>{section.label}</strong>
                <span>{section.detail}</span>
              </button>
            ))}
          </nav>
        </aside>

        <main className="account-main">
          <section className="account-hero-panel">
            <div>
              <p className="landing-eyebrow">Kundportal</p>
              <h1>{sections.find((item) => item.id === activeSection)?.label}</h1>
              <p>
                Hantera abonnemang, skärmmaterial, ärenden och konto historik på ett samlat ställe.
              </p>
            </div>
            <StatusPill label={statusLabel(data.customer.status)} />
          </section>

          {notice && <p className="flow-message">{notice}</p>}

          {activeSection === "overview" && (
            <div className="account-panel-stack">
              <section className="account-stat-grid">
                {dashboardStats.map((item) => (
                  <div key={item.label} className="account-stat">
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </div>
                ))}
              </section>

              <AccountCard title="Orderstatus">
                <div className="account-status-timeline">
                  {journeySteps(data).map((step, index) => (
                    <div
                      key={step.label}
                      className={`account-status-step ${step.done ? "is-done" : ""}`}
                    >
                      <span>{index + 1}</span>
                      <div>
                        <strong>{step.label}</strong>
                        <p>{step.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </AccountCard>

              <section className="account-grid">
                <AccountCard title="Företagsuppgifter">
                  <div className="account-facts">
                    <Fact label="E-post" value={data.customer.email} />
                    <Fact label="Kontakt" value={data.customer.contact_person || "-"} />
                    <Fact label="Telefon" value={data.customer.phone || "-"} />
                    <Fact
                      label="Adress"
                      value={[data.customer.address, data.customer.city, data.customer.country]
                        .filter(Boolean)
                        .join(", ") || "-"}
                    />
                    <Fact label="Aktiverat" value={date(data.customer.activated_at)} />
                    <Fact label="Betalning" value={data.customer.payment_status || "-"} />
                  </div>
                </AccountCard>

                <AccountCard title="Skärmar">
                  {data.devices.length ? (
                    <div className="account-list">
                      {data.devices.map((device) => (
                        <div key={device.id} className="account-list-item">
                          <strong>{device.name || device.device_code}</strong>
                          <span>
                            {device.location || "Ingen plats"} |{" "}
                            {device.is_active ? "Aktiv" : "Inaktiv"}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p>Din skärm visas här när den är förberedd.</p>
                  )}
                </AccountCard>
              </section>
            </div>
          )}

          {activeSection === "setup" && (
            <div className="account-panel-stack">
              <AccountCard title="Första innehållssetup">
                <p>
                  Här samlar vi allt InfoSync behöver för att skapa första
                  skärmförslaget. Du kan skicka filer nu, välja mall eller be oss
                  kontakta dig senare.
                </p>
                <div className="account-facts">
                  <Fact label="Status" value={statusLabel(data.customer.status)} />
                  <Fact label="Senast skickat" value={date(data.customer.content_collected_at)} />
                  <Fact label="Förhandsvisning" value={statusLabel(data.customer.preview_status)} />
                  <Fact label="Valt innehållssätt" value={contentOptionLabel(data.customer.content_option)} />
                </div>

                <div className="flow-form-grid">
                  <input
                    value={setupBusinessName}
                    onChange={(event) => setSetupBusinessName(event.target.value)}
                    placeholder="Företagsnamn *"
                    className="account-input"
                  />
                  <input
                    value={setupWebsiteUrl}
                    onChange={(event) => setSetupWebsiteUrl(event.target.value)}
                    placeholder="Webbplats"
                    className="account-input"
                  />
                  <input
                    value={setupSocialMedia}
                    onChange={(event) => setSetupSocialMedia(event.target.value)}
                    placeholder="Sociala medier"
                    className="account-input"
                  />
                  <input
                    value={setupOpeningHours}
                    onChange={(event) => setSetupOpeningHours(event.target.value)}
                    placeholder="Öppettider"
                    className="account-input"
                  />
                </div>
                <textarea
                  value={setupBusinessDescription}
                  onChange={(event) => setSetupBusinessDescription(event.target.value)}
                  placeholder="Beskriv verksamheten kort. Exempel: restaurang med lunchmeny, kampanjer och QR-kod till onlinebeställning. *"
                  rows={4}
                  className="account-input"
                />
                <textarea
                  value={setupPromotions}
                  onChange={(event) => setSetupPromotions(event.target.value)}
                  placeholder="Aktuella kampanjer, priser eller budskap"
                  rows={3}
                  className="account-input"
                />
              </AccountCard>

              <AccountCard title="Innehållsalternativ">
                <div className="account-service-grid">
                  <AccountChoice
                    active={setupContentOption === "upload"}
                    title="Jag har material"
                    text="Ladda upp logotyp, meny, bilder eller PDF."
                    onClick={() => setSetupContentOption("upload")}
                  />
                  <AccountChoice
                    active={setupContentOption === "template"}
                    title="Använd InfoSync-mall"
                    text="Vi skapar första versionen utifrån dina uppgifter."
                    onClick={() => setSetupContentOption("template")}
                  />
                  <AccountChoice
                    active={setupContentOption === "later"}
                    title="Skicka senare"
                    text="Vi kontaktar dig när det är dags för material."
                    onClick={() => setSetupContentOption("later")}
                  />
                </div>

                <div className="account-upload-workspace">
                  <label
                    className="account-dropzone"
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault();
                      addSetupFiles(event.dataTransfer.files);
                    }}
                  >
                    <input
                      type="file"
                      multiple
                      accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
                      onChange={(event) => addSetupFiles(event.target.files || [])}
                    />
                    <span className="account-upload-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" focusable="false">
                        <path d="M11 16h2V7.8l3.6 3.6L18 10l-6-6-6 6 1.4 1.4L11 7.8V16Z" />
                        <path d="M5 14h2v4h10v-4h2v4a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-4Z" />
                      </svg>
                    </span>
                    <strong>Välj filer</strong>
                    <em>eller släpp filer här</em>
                    <small>Stöds: .png, .jpg, .webp, .heic, .pdf</small>
                  </label>

                  <div className="account-upload-side">
                    <h3>Valda filer</h3>
                    <div className="account-file-list">
                      {setupFiles.length ? (
                        setupFiles.map((item, index) => (
                          <div key={`${item.file.name}-${item.file.size}-${index}`} className="account-file-row">
                            <span className="account-file-icon">FIL</span>
                            <div>
                              <strong>{item.file.name}</strong>
                              <span>{fileSize(item.file.size)}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                setSetupFiles((current) =>
                                  current.filter((_, fileIndex) => fileIndex !== index),
                                )
                              }
                              aria-label={`Ta bort ${item.file.name}`}
                            >
                              x
                            </button>
                          </div>
                        ))
                      ) : (
                        <p>Inga filer valda ännu.</p>
                      )}
                    </div>
                  </div>
                </div>

                <textarea
                  value={setupNotes}
                  onChange={(event) => setSetupNotes(event.target.value)}
                  placeholder="Skriv önskemål för skärmen: färger, meny, kampanj, QR-kod, bilder eller annat vi ska tänka på."
                  rows={5}
                  maxLength={1200}
                  className="account-input"
                />
                <button
                  disabled={savingSetup}
                  onClick={submitContentSetup}
                  className="landing-button landing-button-primary"
                >
                  {savingSetup ? "Skickar..." : "Skicka innehållsunderlag"}
                </button>
              </AccountCard>

              <AccountCard title="Förhandsvisning">
                {data.customer.preview_url ? (
                  <div className="account-list-item account-history-row">
                    <div>
                      <strong>Första skärmförslaget</strong>
                      <span>{statusLabel(data.customer.preview_status)}</span>
                      {data.customer.preview_feedback && (
                        <p>{data.customer.preview_feedback}</p>
                      )}
                    </div>
                    <a href={data.customer.preview_url} target="_blank" rel="noreferrer">
                      Öppna preview
                    </a>
                  </div>
                ) : (
                  <p>Förhandsvisningen visas här när InfoSync har skapat första förslaget.</p>
                )}
              </AccountCard>
            </div>
          )}

          {activeSection === "material" && (
            <div className="account-panel-stack">
              <AccountCard title="Skicka skärmmaterial">
                <div className="account-upload-workspace">
                  <label
                    className="account-dropzone"
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault();
                      addMaterialFiles(event.dataTransfer.files);
                    }}
                  >
                    <input
                      type="file"
                      multiple
                      accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
                      onChange={(event) => addMaterialFiles(event.target.files || [])}
                    />
                    <span className="account-upload-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" focusable="false">
                        <path d="M11 16h2V7.8l3.6 3.6L18 10l-6-6-6 6 1.4 1.4L11 7.8V16Z" />
                        <path d="M5 14h2v4h10v-4h2v4a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-4Z" />
                      </svg>
                    </span>
                    <strong>Bläddra</strong>
                    <em>släpp filer här</em>
                    <small>Stöds: .png, .jpg, .webp, .heic, .pdf</small>
                  </label>

                  <div className="account-upload-side">
                    <div className="account-upload-controls">
                      <label>
                        Kategori
                        <select
                          value={materialCategory}
                          onChange={(event) => setMaterialCategory(event.target.value)}
                          className="account-input"
                        >
                          <option value="logo">Logo</option>
                          <option value="image">Bildmaterial</option>
                          <option value="menu">Meny eller prislista</option>
                          <option value="other">Annat material</option>
                        </select>
                      </label>
                    </div>

                    <h3>Valda filer</h3>
                    <div className="account-file-list">
                      {materialFiles.length ? (
                        materialFiles.map((item, index) => (
                          <div key={`${item.file.name}-${item.file.size}-${index}`} className="account-file-row">
                            <span className="account-file-icon">IMG</span>
                            <div>
                              <strong>{item.file.name}</strong>
                              <span>{assetCategoryLabel(item.category)} | {fileSize(item.file.size)}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                setMaterialFiles((current) =>
                                  current.filter((_, fileIndex) => fileIndex !== index),
                                )
                              }
                              aria-label={`Remove ${item.file.name}`}
                            >
                              x
                            </button>
                          </div>
                        ))
                      ) : (
                        <p>Inga filer valda ännu.</p>
                      )}
                    </div>
                  </div>
                </div>

                <textarea
                  value={materialDescription}
                  onChange={(event) => setMaterialDescription(event.target.value)}
                  placeholder="Beskriv vad som ska ändras på skärmen, var filerna ska användas eller vilket budskap som ska visas."
                  rows={5}
                  maxLength={1200}
                  className="account-input"
                />

                <button
                  disabled={uploadingMaterial}
                  onClick={uploadDisplayMaterial}
                  className="landing-button landing-button-primary"
                >
                  {uploadingMaterial ? "Skickar..." : "Skicka till InfoSync"}
                </button>
              </AccountCard>

              <AccountCard title="Tidigare uppladdat material">
                <HistoryList empty="Inget skärmmaterial har skickats ännu.">
                  {data.displayAssets.map((item) => (
                    <div key={item.id} className="account-list-item account-history-row">
                      <div>
                        <strong>{item.file_name || "Textinstruktion"}</strong>
                        <span>
                          {date(item.created_at)} | {assetCategoryLabel(item.asset_category)} | {statusLabel(item.status)}
                        </span>
                        {item.description && <p>{item.description}</p>}
                      </div>
                      {item.downloadUrl && (
                        <a href={item.downloadUrl} target="_blank" rel="noreferrer">
                          Ladda ner
                        </a>
                      )}
                    </div>
                  ))}
                </HistoryList>
              </AccountCard>
            </div>
          )}

          {activeSection === "messages" && (
            <div className="account-panel-stack">
              <AccountCard title="Skapa eller följ upp ett ärende">
                <div className="account-service-grid">
                  <label>
                    Ärendetyp
                    <select
                      value={requestType}
                      onChange={(event) => setRequestType(event.target.value)}
                      className="account-input"
                    >
                      {requestTypes.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Prioritet
                    <select
                      value={requestPriority}
                      onChange={(event) => setRequestPriority(event.target.value)}
                      className="account-input"
                    >
                      {priorities.map((priority) => (
                        <option key={priority.value} value={priority.value}>
                          {priority.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <input
                  value={messageSubject}
                  onChange={(event) => setMessageSubject(event.target.value)}
                  placeholder="Rubrik"
                  className="account-input"
                />
                <input
                  value={relatedTicketNumber}
                  onChange={(event) => setRelatedTicketNumber(event.target.value)}
                  placeholder="Svar på ärendenummer, t.ex. IS-260613-ABC123 (valfritt)"
                  className="account-input"
                />
                <textarea
                  value={messageText}
                  onChange={(event) => setMessageText(event.target.value)}
                  placeholder="Beskriv problemet, returen, frågan eller uppdateringen. Ange gärna ordernummer, skärmkod, returorsak och önskat nästa steg."
                  rows={5}
                  className="account-input"
                />
                <label className="account-compact-upload">
                  <input
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp,image/heic,application/pdf,text/plain"
                    onChange={(event) => setMessageFiles(Array.from(event.target.files || []))}
                  />
                  Bifoga filer
                </label>
                {messageFiles.length > 0 && (
                  <div className="account-file-list is-compact">
                    {messageFiles.map((file, index) => (
                      <div key={`${file.name}-${index}`} className="account-file-row">
                        <span className="account-file-icon">FILE</span>
                        <div>
                          <strong>{file.name}</strong>
                          <span>{fileSize(file.size)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <button
                  disabled={sending}
                  onClick={sendMessage}
                  className="landing-button landing-button-primary"
                >
                  {sending ? "Skickar..." : "Skicka ärende"}
                </button>
              </AccountCard>

              <AccountCard title="Ärendehistorik och konversationer">
                <HistoryList empty="Inga ärenden ännu.">
                  {data.messages.map((item) => (
                    <div key={item.id} className="account-list-item">
                      <strong>{item.subject || "Ärende"}</strong>
                      <span>
                        {item.ticket_number ? `${item.ticket_number} | ` : ""}
                        {requestTypeLabel(item.request_type)} | {priorityLabel(item.priority)} |{" "}
                        {date(item.created_at)} | {statusLabel(item.status)}
                      </span>
                      {item.related_ticket_number && (
                        <p>Uppföljning på ärende {item.related_ticket_number}</p>
                      )}
                      <p>{item.message}</p>
                      {item.files.length > 0 && (
                        <div className="account-history-links">
                          {item.files.map((file) =>
                            file.downloadUrl ? (
                              <a key={file.id} href={file.downloadUrl} target="_blank" rel="noreferrer">
                                {file.fileName}
                              </a>
                            ) : (
                              <span key={file.id}>{file.fileName}</span>
                            ),
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </HistoryList>
              </AccountCard>
            </div>
          )}

          {activeSection === "billing" && (
            <div className="account-panel-stack">
              <section className="account-grid">
                <AccountCard title="Abonnemang">
                  {activeSubscription ? (
                    <div className="account-facts">
                      <Fact label="Beställning" value={activeSubscription.order_number} />
                      <Fact
                        label="Paket"
                        value={`${activeSubscription.pricing_plans?.name || "Paket"} ${activeSubscription.pricing_plans?.resolution || ""}`}
                      />
                      <Fact label="Status" value={statusLabel(activeSubscription.status)} />
                      <Fact label="Månadspris" value={money(activeSubscription.monthly_fee_sek)} />
                      <Fact label="Startavgift" value={money(activeSubscription.setup_fee_sek)} />
                      <Fact label="Leverans" value={activeSubscription.fulfillment_status || "-"} />
                      <Fact label="Spårningsnummer" value={activeSubscription.tracking_number || "-"} />
                      <Fact
                        label="Spårningslänk"
                        value={activeSubscription.tracking_url || "-"}
                      />
                    </div>
                  ) : (
                    <p>Inget abonnemang är kopplat till kontot ännu.</p>
                  )}
                  <button className="landing-button landing-button-primary" onClick={openBillingPortal}>
                    Öppna betalningsportal
                  </button>
                </AccountCard>

                <AccountCard title="Avslut och feedback">
                  <p>
                    Om du vill avsluta samlar vi in orsaken så att vi kan analysera churn och förbättra tjänsten.
                  </p>
                  <select
                    value={cancellationReason}
                    onChange={(event) => setCancellationReason(event.target.value)}
                    className="account-input"
                  >
                    {cancellationReasons.map((reason) => (
                      <option key={reason.value} value={reason.value}>
                        {reason.label}
                      </option>
                    ))}
                  </select>
                  <textarea
                    value={cancellationDetails}
                    onChange={(event) => setCancellationDetails(event.target.value)}
                    placeholder="Mer information (valfritt)"
                    rows={5}
                    maxLength={1200}
                    className="account-input"
                  />
                  <button
                    className="landing-button landing-button-secondary"
                    disabled={cancelling}
                    onClick={cancelSubscription}
                  >
                    {cancelling ? "Avslutar..." : "Avsluta abonnemang"}
                  </button>
                </AccountCard>
              </section>
            </div>
          )}

          {activeSection === "legal" && (
            <div className="account-panel-stack">
              <AccountCard title="Godkända avtal">
                <HistoryList empty="Inga godkända villkor finns registrerade ännu.">
                  {data.agreements.map((agreement) => (
                    <div key={agreement.id} className="account-list-item account-history-row">
                      <div>
                        <strong>
                          {agreement.document_title} v{agreement.document_version}
                        </strong>
                        <span>Godkänt {date(agreement.accepted_at)}</span>
                        <p>{agreement.content_snapshot}</p>
                      </div>
                      <div className="account-history-links">
                        {agreement.document_url && <a href={agreement.document_url}>Dokument</a>}
                        {agreement.pdf_url && <a href={agreement.pdf_url}>PDF</a>}
                      </div>
                    </div>
                  ))}
                </HistoryList>
              </AccountCard>

              <AccountCard title="Aktuella dokument">
                <HistoryList empty="Inga aktuella dokument är publicerade.">
                  {data.legalDocuments.map((document) => (
                    <div key={document.id} className="account-list-item account-history-row">
                      <div>
                        <strong>
                          {document.title} v{document.version}
                        </strong>
                        <span>Gäller från {date(document.effective_at)}</span>
                        <p>{document.summary || "-"}</p>
                      </div>
                      {document.pdf_url && <a href={document.pdf_url}>PDF</a>}
                    </div>
                  ))}
                </HistoryList>
              </AccountCard>
            </div>
          )}
        </main>
      </div>
    </AccountShell>
  );
}

function AccountShell({
  children,
  onSignOut,
}: {
  children: ReactNode;
  onSignOut?: () => void;
}) {
  return (
    <div className="landing-page account-page">
      <LandingNav currentPath="/account" accountMode onSignOut={onSignOut} />
      <div className="account-shell">{children}</div>
    </div>
  );
}

function AccountCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="account-card">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function AccountChoice({
  active,
  title,
  text,
  onClick,
}: {
  active: boolean;
  title: string;
  text: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`account-card ${active ? "is-active" : ""}`}
      onClick={onClick}
    >
      <strong>{title}</strong>
      <span>{text}</span>
    </button>
  );
}

function HistoryList({
  children,
  empty,
}: {
  children: ReactNode[];
  empty: string;
}) {
  return children.length ? <div className="account-list">{children}</div> : <p>{empty}</p>;
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function StatusPill({ label }: { label: string }) {
  return <span className="account-status">{label.replaceAll("_", " ")}</span>;
}
