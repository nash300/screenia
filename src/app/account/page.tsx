"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import "../landing.css";

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
    subject: string | null;
    message: string;
    status: string;
    created_at: string;
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

function assetCategoryLabel(value: string) {
  if (value === "logo") return "Logotyp";
  if (value === "image") return "Bild";
  if (value === "menu") return "Meny/prislista";
  if (value === "text") return "Text";
  return "Annat";
}

export default function AccountPage() {
  const [data, setData] = useState<AccountData | null>(null);
  const [loading, setLoading] = useState(true);
  const [messageSubject, setMessageSubject] = useState("");
  const [messageText, setMessageText] = useState("");
  const [messageFiles, setMessageFiles] = useState<File[]>([]);
  const [materialDescription, setMaterialDescription] = useState("");
  const [materialCategory, setMaterialCategory] = useState("image");
  const [materialFiles, setMaterialFiles] = useState<MaterialUploadItem[]>([]);
  const [materialPanel, setMaterialPanel] = useState<"text" | "files" | "history">("text");
  const [notice, setNotice] = useState("");
  const [sending, setSending] = useState(false);
  const [uploadingMaterial, setUploadingMaterial] = useState(false);
  const router = useRouter();

  const loadAccount = async () => {
    const response = await fetch("/api/account");
    if (response.status === 401) {
      router.push("/login");
      return;
    }

    const nextData = await response.json();
    setData(nextData);
    setLoading(false);
  };

  useEffect(() => {
    loadAccount();
  }, []);

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

  const uploadDisplayMaterial = async () => {
    if (!materialDescription.trim() && materialFiles.length === 0) {
      setNotice("Lägg till en beskrivning eller minst en fil.");
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
      setNotice(result.error || "Det gick inte att ladda upp materialet.");
      setUploadingMaterial(false);
      return;
    }

    setMaterialDescription("");
    setMaterialFiles([]);
    setMaterialPanel("history");
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
        files,
      }),
    });
    const result = await response.json();

    if (!response.ok) {
      setNotice(result.error || "Det gick inte att skicka meddelandet.");
      setSending(false);
      return;
    }

    setMessageSubject("");
    setMessageText("");
    setMessageFiles([]);
    setNotice("Meddelandet har skickats till InfoSync.");
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
      setNotice(result.error || "Det gick inte att öppna betalningsportalen.");
      return;
    }
    window.location.href = result.url;
  };

  const cancelSubscription = async () => {
    const confirmed = window.confirm(
      "Vill du avsluta ditt InfoSync-abonnemang? Skärmtjänsten kan sluta fungera efter avslut.",
    );
    if (!confirmed) return;

    setNotice("");
    const response = await fetch("/api/account/cancel-subscription", {
      method: "POST",
    });
    const result = await response.json();
    if (!response.ok) {
      setNotice(result.error || "Det gick inte att avsluta abonnemanget.");
      return;
    }
    setNotice("Abonnemanget har avslutats.");
    loadAccount();
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  if (loading) {
    return <AccountShell>Laddar ditt konto...</AccountShell>;
  }

  if (!data) {
    return <AccountShell>Det gick inte att ladda ditt konto.</AccountShell>;
  }

  const activeSubscription = data.subscriptions[0];

  return (
    <AccountShell onSignOut={signOut}>
      <div className="account-hero">
        <div>
          <p className="landing-eyebrow">Kundkonto</p>
          <h1>{data.customer.name}</h1>
          <p>
            Hantera ditt InfoSync-abonnemang, betalning, skärmmaterial och
            supportmeddelanden.
          </p>
        </div>
        <StatusPill label={data.customer.status} />
      </div>

      {notice && <p className="flow-message">{notice}</p>}

      <section className="account-grid">
        <AccountCard title="Abonnemang">
          {activeSubscription ? (
            <div className="account-facts">
              <Fact label="Order" value={activeSubscription.order_number} />
              <Fact
                label="Paket"
                value={`${activeSubscription.pricing_plans?.name || "Paket"} ${activeSubscription.pricing_plans?.resolution || ""}`}
              />
              <Fact label="Status" value={activeSubscription.status} />
              <Fact
                label="Månadspris"
                value={money(activeSubscription.monthly_fee_sek)}
              />
              <Fact
                label="Startavgift"
                value={money(activeSubscription.setup_fee_sek)}
              />
              <Fact label="Enhet" value={money(activeSubscription.hardware_fee_sek)} />
              <Fact label="Frakt" value={money(activeSubscription.shipping_fee_sek)} />
              <Fact label="Leverans" value={activeSubscription.fulfillment_status || "-"} />
            </div>
          ) : (
            <p>Inget abonnemang är kopplat till kontot ännu.</p>
          )}
          <div className="account-actions">
            <button className="landing-button landing-button-primary" onClick={openBillingPortal}>
              Betalningsportal
            </button>
            <button className="landing-button landing-button-secondary" onClick={cancelSubscription}>
              Avsluta abonnemang
            </button>
          </div>
        </AccountCard>

        <AccountCard title="Företagsuppgifter">
          <div className="account-facts">
            <Fact label="Email" value={data.customer.email} />
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
      </section>

      <section className="account-grid">
        <AccountCard title="Dina skärmar">
          {data.devices.length ? (
            <div className="account-list">
              {data.devices.map((device) => (
                <div key={device.id} className="account-list-item">
                  <strong>{device.name || device.device_code}</strong>
                  <span>
                    {device.location || "Ingen plats"} ·{" "}
                    {device.is_active ? "Aktiv" : "Inaktiv"}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p>Din enhet visas här när den är förberedd.</p>
          )}
        </AccountCard>

        <AccountCard title="Skärmmaterial">
          <div className="account-material-hero">
            <div>
              <p>
                Skicka ny logotyp, bilder, meny, prislista eller text som vi ska
                använda när vi uppdaterar din skärm.
              </p>
            </div>
            <img src="/landing/hero-slides/01/image.png" alt="InfoSync" />
          </div>

          <div className="account-category-tabs">
            <button
              type="button"
              onClick={() => setMaterialPanel("text")}
              className={materialPanel === "text" ? "is-active" : ""}
            >
              Text
            </button>
            <button
              type="button"
              onClick={() => setMaterialPanel("files")}
              className={materialPanel === "files" ? "is-active" : ""}
            >
              Filer ({materialFiles.length})
            </button>
            <button
              type="button"
              onClick={() => setMaterialPanel("history")}
              className={materialPanel === "history" ? "is-active" : ""}
            >
              Tidigare
            </button>
          </div>

          {materialPanel === "text" && (
            <textarea
              value={materialDescription}
              onChange={(event) => setMaterialDescription(event.target.value)}
              placeholder="Beskriv vad du vill ändra eller lägga till på skärmen"
              rows={6}
              maxLength={1200}
              className="account-input"
            />
          )}

          {materialPanel === "files" && (
            <div className="account-upload-builder">
              <select
                value={materialCategory}
                onChange={(event) => setMaterialCategory(event.target.value)}
                className="account-input"
              >
                <option value="logo">Logotyp</option>
                <option value="image">Bildmaterial</option>
                <option value="menu">Meny eller prislista</option>
                <option value="other">Annat material</option>
              </select>
              <label className="account-plus-upload">
                <input
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
                  onChange={(event) =>
                    setMaterialFiles(
                      [
                        ...materialFiles,
                        ...Array.from(event.target.files || []).map((file) => ({
                          file,
                          category: materialCategory,
                        })),
                      ].slice(0, 8),
                    )
                  }
                />
                <span>+</span>
                Lägg till filer
              </label>

              {materialFiles.length ? (
                <div className="account-upload-queue">
                  {materialFiles.map((item, index) => (
                    <div key={`${item.file.name}-${item.file.size}-${index}`}>
                      <strong>{item.file.name}</strong>
                      <span>
                        {assetCategoryLabel(item.category)} · {Math.ceil(item.file.size / 1024)} KB
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setMaterialFiles(materialFiles.filter((_, fileIndex) => fileIndex !== index))
                        }
                      >
                        Ta bort
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p>Tryck på plusknappen för att lägga till filer.</p>
              )}
              <p>
                Max 8 filer. Logotyp max 2 MB. Övriga filer max 5 MB styck och
                15 MB totalt.
              </p>
            </div>
          )}

          {materialPanel === "history" && (
            <div className="account-list">
              {data.displayAssets.length ? (
                data.displayAssets.map((item) => (
                  <div key={item.id} className="account-list-item">
                    <strong>{item.file_name || "Textbeskrivning"}</strong>
                    <span>
                      {date(item.created_at)} · {assetCategoryLabel(item.asset_category)} · {item.status}
                    </span>
                    {item.description && <p>{item.description}</p>}
                  </div>
                ))
              ) : (
                <p>Inget skärmmaterial har skickats ännu.</p>
              )}
            </div>
          )}

          <button
            disabled={uploadingMaterial}
            onClick={uploadDisplayMaterial}
            className="landing-button landing-button-primary"
          >
            {uploadingMaterial ? "Skickar..." : "Skicka allt till InfoSync"}
          </button>
        </AccountCard>
      </section>

      <section className="account-grid">
        <AccountCard title="Meddela InfoSync">
          <input
            value={messageSubject}
            onChange={(event) => setMessageSubject(event.target.value)}
            placeholder="Ämne"
            className="account-input"
          />
          <textarea
            value={messageText}
            onChange={(event) => setMessageText(event.target.value)}
            placeholder="Skriv ditt meddelande eller din uppdateringsförfrågan"
            rows={5}
            className="account-input"
          />
          <input
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,image/heic,application/pdf,text/plain"
            onChange={(event) => setMessageFiles(Array.from(event.target.files || []))}
            className="account-input"
          />
          <button
            disabled={sending}
            onClick={sendMessage}
            className="landing-button landing-button-primary"
          >
            {sending ? "Skickar..." : "Skicka meddelande"}
          </button>
        </AccountCard>
      </section>

      <AccountCard title="Senaste meddelanden">
        {data.messages.length ? (
          <div className="account-list">
            {data.messages.map((item) => (
              <div key={item.id} className="account-list-item">
                <strong>{item.subject || "Meddelande"}</strong>
                <span>{date(item.created_at)} · {item.status}</span>
                <p>{item.message}</p>
              </div>
            ))}
          </div>
        ) : (
          <p>Inga meddelanden ännu.</p>
        )}
      </AccountCard>

      <AccountCard title="Villkor och avtal">
        <p>
          Här visas den version av villkoren som godkändes vid avtalstillfället
          samt aktuella publicerade dokument.
        </p>
        {data.agreements.length ? (
          <div className="account-list">
            {data.agreements.map((agreement) => (
              <div key={agreement.id} className="account-list-item">
                <strong>
                  Godkänd: {agreement.document_title} v{agreement.document_version}
                </strong>
                <span>{date(agreement.accepted_at)}</span>
                <p>{agreement.content_snapshot}</p>
                <div className="account-actions">
                  {agreement.document_url && (
                    <a className="landing-button landing-button-secondary" href={agreement.document_url}>
                      Visa dokument
                    </a>
                  )}
                  {agreement.pdf_url && (
                    <a className="landing-button landing-button-secondary" href={agreement.pdf_url}>
                      Visa PDF
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p>Inga godkända villkor finns registrerade ännu.</p>
        )}

        <div className="account-list">
          {data.legalDocuments.map((document) => (
            <div key={document.id} className="account-list-item">
              <strong>
                Aktuell: {document.title} v{document.version}
              </strong>
              <span>Gäller från {date(document.effective_at)}</span>
              <p>{document.summary || "-"}</p>
              {document.pdf_url && (
                <a className="landing-button landing-button-secondary" href={document.pdf_url}>
                  Visa aktuell PDF
                </a>
              )}
            </div>
          ))}
        </div>
      </AccountCard>
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
      <header className="flow-nav account-nav">
        <Link className="landing-brand" href="/">
          <img src="/brand/infosync-logo-full-transparent.png" alt="InfoSync" />
        </Link>
        {onSignOut && (
          <button className="landing-button landing-button-secondary" onClick={onSignOut}>
            Logga ut
          </button>
        )}
      </header>
      <main className="account-shell">{children}</main>
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
