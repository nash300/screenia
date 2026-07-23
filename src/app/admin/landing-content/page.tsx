"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";

type BaseItem = {
  id: string;
  title: string;
  body: string;
  sort_order: number;
  is_active: boolean;
};

type Slide = BaseItem & { image_url: string; highlight_terms: string[] };
type Benefit = BaseItem;
type Notice = { type: "success" | "error" | "info"; message: string };

const emptySlide = (): Slide => ({
  id: "new-slide",
  title: "",
  body: "",
  image_url: "",
  highlight_terms: [],
  sort_order: 0,
  is_active: true,
});

const emptyBenefit = (): Benefit => ({
  id: "new-benefit",
  title: "",
  body: "",
  sort_order: 0,
  is_active: true,
});

export default function LandingContentPage() {
  const [slides, setSlides] = useState<Slide[]>([]);
  const [benefits, setBenefits] = useState<Benefit[]>([]);
  const [newSlide, setNewSlide] = useState<Slide | null>(null);
  const [newBenefit, setNewBenefit] = useState<Benefit | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [loading, setLoading] = useState(true);
  const [migrationRequired, setMigrationRequired] = useState(false);
  const [workingKey, setWorkingKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const response = await fetch("/api/admin/landing-content", { cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setNotice({ type: "error", message: data.error || "Could not load landing content." });
    } else {
      setSlides(data.slides || []);
      setBenefits(data.benefits || []);
      setMigrationRequired(Boolean(data.migrationRequired));
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const request = async (body: Record<string, unknown>) => {
    const response = await fetch("/api/admin/landing-content", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Could not save landing content.");
    return data;
  };

  const save = async (kind: "slide" | "benefit", item: Slide | Benefit, creating = false) => {
    const key = `${kind}-${item.id}`;
    setWorkingKey(key);
    try {
      await request({
        kind,
        action: creating ? "create" : "update",
        ...(creating ? {} : { id: item.id }),
        title: item.title,
        body: item.body,
        isActive: item.is_active,
        ...(kind === "slide" ? { imageUrl: (item as Slide).image_url, highlightTerms: (item as Slide).highlight_terms } : {}),
      });
      setNewSlide(null);
      setNewBenefit(null);
      await load();
      setNotice({ type: "success", message: `${kind === "slide" ? "Slide" : "Card"} saved.` });
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Could not save landing content." });
    } finally {
      setWorkingKey(null);
    }
  };

  const move = async (kind: "slide" | "benefit", id: string, direction: "up" | "down") => {
    setWorkingKey(`${kind}-${id}`);
    try {
      await request({ kind, action: "move", id, direction });
      await load();
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Could not change the order." });
    } finally {
      setWorkingKey(null);
    }
  };

  const remove = async (kind: "slide" | "benefit", id: string) => {
    setWorkingKey(`${kind}-${id}`);
    try {
      await request({ kind, action: "delete", id });
      await load();
      setNotice({ type: "success", message: "Content item removed." });
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Could not remove the content item." });
    } finally {
      setWorkingKey(null);
    }
  };

  const uploadImage = async (file: File, assign: (imageUrl: string) => void) => {
    setWorkingKey("upload");
    try {
      const formData = new FormData();
      formData.set("file", file);
      const response = await fetch("/api/admin/landing-content/upload", { method: "POST", body: formData });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not upload the image.");
      assign(data.imageUrl);
      setNotice({ type: "success", message: "Hero image uploaded. Save the slide to publish it." });
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Could not upload the image." });
    } finally {
      setWorkingKey(null);
    }
  };

  const updateSlide = (updated: Slide) => setSlides((items) => items.map((item) => item.id === updated.id ? updated : item));
  const updateBenefit = (updated: Benefit) => setBenefits((items) => items.map((item) => item.id === updated.id ? updated : item));

  return (
    <main className="admin-landing-content-page">
      <header className="admin-page-header">
        <div>
          <p className="admin-operation-kicker">Website content</p>
          <h1 className="admin-title">Landing hero</h1>
          <p className="admin-subtitle">Maintain the hero slides and the rotating proof cards without changing code. The order here is the order visitors see.</p>
        </div>
      </header>

      {notice && <div className={`admin-pricing-notice admin-pricing-notice-${notice.type}`}>{notice.message}</div>}

      {migrationRequired && <div className="admin-pricing-notice admin-pricing-notice-info">The current published content is shown below. Apply the landing-content database migration before editing, adding, deleting, or uploading content.</div>}

      {loading ? <section className="admin-card"><p className="admin-muted">Loading landing content...</p></section> : (
        <div className="admin-landing-content-grid">
          <section className="admin-landing-content-section">
            <div className="admin-landing-content-heading">
              <div><h2>Hero slides</h2><p>Heading, supporting text, and background image.</p></div>
              <button type="button" className="admin-button-primary" disabled={migrationRequired} onClick={() => setNewSlide(emptySlide())}>Add slide</button>
            </div>
            <div className="admin-landing-content-list">
              {newSlide && <SlideEditor item={newSlide} isNew working={workingKey === "slide-new-slide" || workingKey === "upload"} onChange={setNewSlide} onUpload={uploadImage} onSave={() => save("slide", newSlide, true)} onCancel={() => setNewSlide(null)} />}
              {slides.map((item, index) => <SlideEditor key={item.id} item={item} working={migrationRequired || workingKey === `slide-${item.id}` || workingKey === "upload"} onChange={updateSlide} onUpload={uploadImage} onSave={() => save("slide", item)} onMoveUp={index > 0 ? () => move("slide", item.id, "up") : undefined} onMoveDown={index < slides.length - 1 ? () => move("slide", item.id, "down") : undefined} onDelete={() => remove("slide", item.id)} />)}
            </div>
          </section>

          <section className="admin-landing-content-section">
            <div className="admin-landing-content-heading">
              <div><h2>Rotating cards</h2><p>Short promise cards shown in the transparent hero carousel.</p></div>
              <button type="button" className="admin-button-primary" disabled={migrationRequired} onClick={() => setNewBenefit(emptyBenefit())}>Add card</button>
            </div>
            <div className="admin-landing-content-list">
              {newBenefit && <BenefitEditor item={newBenefit} isNew working={workingKey === "benefit-new-benefit"} onChange={setNewBenefit} onSave={() => save("benefit", newBenefit, true)} onCancel={() => setNewBenefit(null)} />}
              {benefits.map((item, index) => <BenefitEditor key={item.id} item={item} working={migrationRequired || workingKey === `benefit-${item.id}`} onChange={updateBenefit} onSave={() => save("benefit", item)} onMoveUp={index > 0 ? () => move("benefit", item.id, "up") : undefined} onMoveDown={index < benefits.length - 1 ? () => move("benefit", item.id, "down") : undefined} onDelete={() => remove("benefit", item.id)} />)}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

function EditorActions({ onSave, onCancel, onMoveUp, onMoveDown, onDelete, working }: { onSave: () => void; onCancel?: () => void; onMoveUp?: () => void; onMoveDown?: () => void; onDelete?: () => void; working: boolean }) {
  return <div className="admin-landing-editor-actions">
    <button type="button" className="admin-button-primary" disabled={working} onClick={onSave}>{working ? "Working..." : "Save"}</button>
    {onMoveUp && <button type="button" className="admin-button-secondary" disabled={working} onClick={onMoveUp}>Move up</button>}
    {onMoveDown && <button type="button" className="admin-button-secondary" disabled={working} onClick={onMoveDown}>Move down</button>}
    {onCancel && <button type="button" className="admin-button-secondary" disabled={working} onClick={onCancel}>Cancel</button>}
    {onDelete && <button type="button" className="admin-button-danger" disabled={working} onClick={onDelete}>Delete</button>}
  </div>;
}

function SlideEditor({ item, isNew = false, working, onChange, onUpload, onSave, onCancel, onMoveUp, onMoveDown, onDelete }: { item: Slide; isNew?: boolean; working: boolean; onChange: (item: Slide) => void; onUpload: (file: File, assign: (imageUrl: string) => void) => void; onSave: () => void; onCancel?: () => void; onMoveUp?: () => void; onMoveDown?: () => void; onDelete?: () => void }) {
  const highlightText = item.highlight_terms.join(", ");

  return <article className="admin-landing-editor-card">
    {item.image_url ? <Image src={item.image_url} alt="" width={1280} height={720} unoptimized className="admin-landing-slide-preview" /> : <div className="admin-landing-slide-preview admin-landing-slide-preview-empty">Hero image</div>}
    <div className="admin-landing-editor-fields">
      <label><span className="admin-landing-field-label">Heading</span><input value={item.title} maxLength={220} disabled={working} onChange={(event) => onChange({ ...item, title: event.target.value })} /></label>
      <label><span className="admin-landing-field-label">Supporting text</span><textarea value={item.body} maxLength={1000} rows={3} disabled={working} onChange={(event) => onChange({ ...item, body: event.target.value })} /></label>
      <label><span className="admin-landing-field-label">Yellow highlight words</span><input value={highlightText} maxLength={500} disabled={working} placeholder="Example: kunder, unikt, fler besokare" onChange={(event) => onChange({ ...item, highlight_terms: parseHighlightTerms(event.target.value) })} /></label>
      <p className="admin-landing-field-help">Separate words or short phrases with commas. Matching text in the hero heading will be highlighted in yellow.</p>
      <label><span className="admin-landing-field-label">Image path</span><input value={item.image_url} maxLength={2000} disabled={working} placeholder="/landing/hero-slides/01/image.png" onChange={(event) => onChange({ ...item, image_url: event.target.value })} /></label>
      <label
        className={`admin-landing-upload ${
          working ? "admin-landing-upload-disabled" : ""
        }`}
        aria-disabled={working}
      >
        <span>{item.image_url ? "Replace image" : "Upload image"}</span>
        <input className="admin-landing-file-input" type="file" accept="image/png,image/jpeg,image/webp" disabled={working} onChange={(event) => { const file = event.target.files?.[0]; if (file) onUpload(file, (imageUrl) => onChange({ ...item, image_url: imageUrl })); event.currentTarget.value = ""; }} />
      </label>
      {item.image_url && <button type="button" className="admin-button-secondary admin-landing-remove-image" disabled={working} onClick={() => onChange({ ...item, image_url: "" })}>Remove image from slide</button>}
      <label className="admin-pricing-toggle"><input type="checkbox" checked={item.is_active} disabled={working} onChange={(event) => onChange({ ...item, is_active: event.target.checked })} /> Show this slide on the website</label>
      <EditorActions onSave={onSave} onCancel={isNew ? onCancel : undefined} onMoveUp={onMoveUp} onMoveDown={onMoveDown} onDelete={onDelete} working={working} />
    </div>
  </article>;
}

function BenefitEditor({ item, isNew = false, working, onChange, onSave, onCancel, onMoveUp, onMoveDown, onDelete }: { item: Benefit; isNew?: boolean; working: boolean; onChange: (item: Benefit) => void; onSave: () => void; onCancel?: () => void; onMoveUp?: () => void; onMoveDown?: () => void; onDelete?: () => void }) {
  return <article className="admin-landing-editor-card admin-landing-benefit-editor">
    <div className="admin-landing-editor-fields">
      <label><span className="admin-landing-field-label">Card heading</span><input value={item.title} maxLength={120} disabled={working} onChange={(event) => onChange({ ...item, title: event.target.value })} /></label>
      <label><span className="admin-landing-field-label">Card text</span><input value={item.body} maxLength={280} disabled={working} onChange={(event) => onChange({ ...item, body: event.target.value })} /></label>
      <label className="admin-pricing-toggle"><input type="checkbox" checked={item.is_active} disabled={working} onChange={(event) => onChange({ ...item, is_active: event.target.checked })} /> Show this card in the carousel</label>
      <EditorActions onSave={onSave} onCancel={isNew ? onCancel : undefined} onMoveUp={onMoveUp} onMoveDown={onMoveDown} onDelete={onDelete} working={working} />
    </div>
  </article>;
}

function parseHighlightTerms(value: string) {
  return value
    .split(",")
    .map((term) => term.trim())
    .filter(Boolean)
    .slice(0, 12);
}
