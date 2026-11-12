"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { validateLandingExampleVideo } from "@/lib/landing/example-videos";

type ExampleVideo = {
  id: string;
  title: string;
  body: string;
  video_url: string;
  storage_path: string | null;
  poster_url: string | null;
  poster_storage_path: string | null;
  orientation: "portrait" | "landscape";
  sort_order: number;
  is_active: boolean;
};

type Notice = { type: "success" | "error" | "info"; message: string };

const emptyExampleVideo = (): ExampleVideo => ({
  id: "new-example",
  title: "Gallery video",
  body: "",
  video_url: "",
  storage_path: null,
  poster_url: null,
  poster_storage_path: null,
  orientation: "portrait",
  sort_order: 0,
  is_active: true,
});

function titleFromFileName(fileName: string) {
  return fileName
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .trim()
    .slice(0, 140) || "Gallery video";
}

async function createPosterFile(file: File) {
  const validationError = validateLandingExampleVideo({
    fileName: file.name,
    contentType: file.type,
    fileSize: file.size,
  });
  if (validationError) throw new Error(validationError);

  const objectUrl = URL.createObjectURL(file);
  const parsedObjectUrl = new URL(objectUrl);
  if (
    parsedObjectUrl.protocol !== "blob:" ||
    parsedObjectUrl.origin !== window.location.origin
  ) {
    URL.revokeObjectURL(objectUrl);
    throw new Error("Could not create a safe local video preview.");
  }
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.style.position = "fixed";
  video.style.width = "1px";
  video.style.height = "1px";
  video.style.opacity = "0";
  video.style.pointerEvents = "none";
  document.body.appendChild(video);

  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error("Poster generation timed out.")), 15000);
      video.onloadeddata = () => {
        window.clearTimeout(timeout);
        resolve();
      };
      video.onerror = () => {
        window.clearTimeout(timeout);
        reject(new Error("Could not read the MP4 to create its poster."));
      };
      video.src = parsedObjectUrl.href;
      video.load();
    });

    await video.play();
    await new Promise<void>((resolve) => {
      if ("requestVideoFrameCallback" in video) {
        video.requestVideoFrameCallback(() => resolve());
      } else {
        window.requestAnimationFrame(() => resolve());
      }
    });
    video.pause();

    const seekTo = (time: number) => new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error("Poster frame selection timed out.")), 5000);
      let finished = false;
      let decodeFallback: number | undefined;
      const settle = () => {
        if (finished) return;
        finished = true;
        video.pause();
        window.clearTimeout(timeout);
        if (decodeFallback) window.clearTimeout(decodeFallback);
        if (seekFallback) window.clearTimeout(seekFallback);
        resolve();
      };
      const finishAfterDecode = () => {
        if (finished) return;
        if (seekFallback) window.clearTimeout(seekFallback);
        decodeFallback = window.setTimeout(settle, 350);
        void video.play().then(() => {
          if ("requestVideoFrameCallback" in video) video.requestVideoFrameCallback(settle);
          else window.requestAnimationFrame(() => window.requestAnimationFrame(settle));
        }).catch(settle);
      };
      const seekFallback = window.setTimeout(finishAfterDecode, 600);
      if (Math.abs(video.currentTime - time) < 0.02) {
        finishAfterDecode();
        return;
      }
      video.onseeked = finishAfterDecode;
      video.currentTime = time;
    });

    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    const midpoint = duration > 0.4 ? Math.min(duration / 2, duration - 0.2) : 0;
    await seekTo(Math.max(0, midpoint));
    const scale = Math.min(1, 960 / video.videoWidth, 960 / video.videoHeight);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not create the poster image.");
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => result ? resolve(result) : reject(new Error("Could not create the poster image.")),
        "image/jpeg",
        0.82,
      );
    });
    return new File([blob], `${titleFromFileName(file.name)}-poster.jpg`, { type: "image/jpeg" });
  } finally {
    video.remove();
    URL.revokeObjectURL(objectUrl);
  }
}

export default function ExampleGalleryPage() {
  const [examples, setExamples] = useState<ExampleVideo[]>([]);
  const [newExample, setNewExample] = useState<ExampleVideo | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [loading, setLoading] = useState(true);
  const [migrationRequired, setMigrationRequired] = useState(false);
  const [workingKey, setWorkingKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const response = await fetch("/api/admin/landing-content", { cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setNotice({ type: "error", message: data.error || "Could not load the example gallery." });
    } else {
      setExamples(data.examples || []);
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
    if (!response.ok) throw new Error(data.error || "Could not save the gallery.");
    return data;
  };

  const save = async (item: ExampleVideo, creating = false) => {
    setWorkingKey(`example-${item.id}`);
    try {
      await request({
        kind: "example",
        action: creating ? "create" : "update",
        ...(creating ? {} : { id: item.id }),
        title: item.title || "Gallery video",
        body: "",
        videoUrl: item.video_url,
        storagePath: item.storage_path,
        posterUrl: item.poster_url,
        posterStoragePath: item.poster_storage_path,
        orientation: item.orientation,
        isActive: item.is_active,
      });
      setNewExample(null);
      await load();
      setNotice({ type: "success", message: "Gallery video saved." });
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Could not save the gallery video." });
    } finally {
      setWorkingKey(null);
    }
  };

  const move = async (id: string, direction: "up" | "down") => {
    setWorkingKey(`example-${id}`);
    try {
      await request({ kind: "example", action: "move", id, direction });
      await load();
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Could not change the order." });
    } finally {
      setWorkingKey(null);
    }
  };

  const remove = async (id: string) => {
    setWorkingKey(`example-${id}`);
    try {
      await request({ kind: "example", action: "delete", id });
      await load();
      setNotice({ type: "success", message: "Gallery video removed." });
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Could not remove the gallery video." });
    } finally {
      setWorkingKey(null);
    }
  };

  const uploadVideo = async (
    file: File,
    assign: (
      videoUrl: string,
      storagePath: string,
      posterUrl: string,
      posterStoragePath: string,
      internalTitle: string,
    ) => void,
  ) => {
    setWorkingKey("video-upload");
    try {
      const posterFile = await createPosterFile(file);
      const createResponse = await fetch("/api/admin/landing-content/video-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          fileName: file.name,
          contentType: file.type,
          fileSize: file.size,
        }),
      });
      const upload = await createResponse.json().catch(() => ({}));
      if (!createResponse.ok) throw new Error(upload.error || "Could not prepare the video upload.");

      const { error: uploadError } = await supabase.storage
        .from(upload.bucket)
        .uploadToSignedUrl(upload.storagePath, upload.token, file, {
          contentType: "video/mp4",
        });
      if (uploadError) throw uploadError;

      const completeResponse = await fetch("/api/admin/landing-content/video-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete", storagePath: upload.storagePath }),
      });
      const completed = await completeResponse.json().catch(() => ({}));
      if (!completeResponse.ok) throw new Error(completed.error || "Could not complete the video upload.");

      const posterFormData = new FormData();
      posterFormData.set("file", posterFile);
      posterFormData.set("purpose", "example-poster");
      const posterResponse = await fetch("/api/admin/landing-content/upload", {
        method: "POST",
        body: posterFormData,
      });
      const poster = await posterResponse.json().catch(() => ({}));
      if (!posterResponse.ok) throw new Error(poster.error || "Could not upload the video poster.");

      assign(
        completed.videoUrl,
        completed.storagePath,
        poster.imageUrl,
        poster.path,
        titleFromFileName(file.name),
      );
      setNotice({ type: "success", message: "MP4 uploaded. Select its orientation and save." });
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Could not upload the video." });
    } finally {
      setWorkingKey(null);
    }
  };

  const generatePoster = async (item: ExampleVideo) => {
    setWorkingKey(`poster-${item.id}`);
    try {
      const videoResponse = await fetch(item.video_url);
      if (!videoResponse.ok) throw new Error("Could not download the MP4 for poster generation.");
      const videoBlob = await videoResponse.blob();
      const videoFile = new File([videoBlob], `${item.title || item.id}.mp4`, { type: "video/mp4" });
      const posterFile = await createPosterFile(videoFile);
      const formData = new FormData();
      formData.set("file", posterFile);
      formData.set("purpose", "example-poster");
      const uploadResponse = await fetch("/api/admin/landing-content/upload", {
        method: "POST",
        body: formData,
      });
      const poster = await uploadResponse.json().catch(() => ({}));
      if (!uploadResponse.ok) throw new Error(poster.error || "Could not upload the poster image.");

      await request({
        kind: "example",
        action: "update",
        id: item.id,
        title: item.title || "Gallery video",
        body: "",
        videoUrl: item.video_url,
        storagePath: item.storage_path,
        posterUrl: poster.imageUrl,
        posterStoragePath: poster.path,
        orientation: item.orientation,
        isActive: item.is_active,
      });
      await load();
      setNotice({ type: "success", message: "Poster image created." });
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Could not create the poster image." });
    } finally {
      setWorkingKey(null);
    }
  };

  const updateExample = (updated: ExampleVideo) =>
    setExamples((items) => items.map((item) => item.id === updated.id ? updated : item));

  return (
    <main className="admin-landing-content-page">
      <header className="admin-page-header">
        <div>
          <p className="admin-operation-kicker">Site content</p>
          <h1 className="admin-title">Example video gallery</h1>
          <p className="admin-subtitle">Upload MP4 previews, choose portrait or landscape, and control their public order.</p>
        </div>
        <button type="button" className="admin-button-primary" disabled={migrationRequired} onClick={() => setNewExample(emptyExampleVideo())}>Add video</button>
      </header>

      {notice && <div className={`admin-pricing-notice admin-pricing-notice-${notice.type}`}>{notice.message}</div>}
      {migrationRequired && <div className="admin-pricing-notice admin-pricing-notice-info">Gallery editing is temporarily unavailable. Please try again later.</div>}

      {loading ? <section className="admin-card"><p className="admin-muted">Loading example gallery...</p></section> : (
        <section className="admin-landing-content-section">
          <div className="admin-landing-content-list admin-landing-video-editor-list">
            {newExample && <ExampleVideoEditor item={newExample} isNew working={workingKey === "example-new-example" || workingKey === "video-upload"} onChange={setNewExample} onUpload={uploadVideo} onSave={() => save(newExample, true)} onCancel={() => setNewExample(null)} />}
            {examples.map((item, index) => <ExampleVideoEditor key={item.id} item={item} working={migrationRequired || workingKey === `example-${item.id}` || workingKey === `poster-${item.id}` || workingKey === "video-upload"} onChange={updateExample} onUpload={uploadVideo} onGeneratePoster={item.video_url ? () => generatePoster(item) : undefined} onSave={() => save(item)} onMoveUp={index > 0 ? () => move(item.id, "up") : undefined} onMoveDown={index < examples.length - 1 ? () => move(item.id, "down") : undefined} onDelete={() => remove(item.id)} />)}
            {!newExample && examples.length === 0 && <p className="admin-muted">No uploaded videos yet.</p>}
          </div>
        </section>
      )}
    </main>
  );
}

function ExampleVideoEditor({ item, isNew = false, working, onChange, onUpload, onGeneratePoster, onSave, onCancel, onMoveUp, onMoveDown, onDelete }: {
  item: ExampleVideo;
  isNew?: boolean;
  working: boolean;
  onChange: (item: ExampleVideo) => void;
  onUpload: (file: File, assign: (videoUrl: string, storagePath: string, posterUrl: string, posterStoragePath: string, internalTitle: string) => void) => void;
  onGeneratePoster?: () => void;
  onSave: () => void;
  onCancel?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onDelete?: () => void;
}) {
  return <article className="admin-landing-editor-card admin-landing-video-editor">
    {item.video_url
      ? <video
          src={item.video_url}
          poster={item.poster_url || undefined}
          muted
          loop
          playsInline
          preload="metadata"
          onMouseEnter={(event) => { void event.currentTarget.play(); }}
          onMouseLeave={(event) => { event.currentTarget.pause(); }}
          className={`admin-landing-video-preview admin-landing-video-preview-${item.orientation}`}
        />
      : <div className={`admin-landing-video-preview admin-landing-video-preview-${item.orientation} admin-landing-slide-preview-empty`}>MP4 preview</div>}
    <div className="admin-landing-editor-fields">
      <label>
        <span className="admin-landing-field-label">Video orientation</span>
        <select value={item.orientation} disabled={working} onChange={(event) => onChange({ ...item, orientation: event.target.value === "portrait" ? "portrait" : "landscape" })}>
          <option value="portrait">Vertical / portrait (9:16)</option>
          <option value="landscape">Horizontal / landscape (16:9)</option>
        </select>
      </label>
      <label className={`admin-landing-upload ${working ? "admin-landing-upload-disabled" : ""}`} aria-disabled={working}>
        <span>{item.video_url ? "Replace MP4" : "Upload MP4"}</span>
        <input className="admin-landing-file-input" type="file" accept="video/mp4,.mp4" disabled={working} onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onUpload(file, (videoUrl, storagePath, posterUrl, posterStoragePath, internalTitle) => onChange({
            ...item,
            title: internalTitle,
            video_url: videoUrl,
            storage_path: storagePath,
            poster_url: posterUrl,
            poster_storage_path: posterStoragePath,
          }));
          event.currentTarget.value = "";
        }} />
      </label>
      <p className="admin-landing-field-help">
        MP4 only, maximum 100 MB. The gallery uses a poster image and plays the video on hover or tap.
      </p>
      {onGeneratePoster && <button type="button" className="admin-button-secondary admin-landing-remove-image" disabled={working} onClick={onGeneratePoster}>{item.poster_url ? "Refresh poster image" : "Create poster image"}</button>}
      <label className="admin-pricing-toggle"><input type="checkbox" checked={item.is_active} disabled={working} onChange={(event) => onChange({ ...item, is_active: event.target.checked })} /> Show this video in the public gallery</label>
      <EditorActions onSave={onSave} onCancel={isNew ? onCancel : undefined} onMoveUp={onMoveUp} onMoveDown={onMoveDown} onDelete={onDelete} working={working} />
    </div>
  </article>;
}

function EditorActions({ onSave, onCancel, onMoveUp, onMoveDown, onDelete, working }: {
  onSave: () => void;
  onCancel?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onDelete?: () => void;
  working: boolean;
}) {
  return <div className="admin-landing-editor-actions">
    <button type="button" className="admin-button-primary" disabled={working} onClick={onSave}>{working ? "Working..." : "Save"}</button>
    {onMoveUp && <button type="button" className="admin-button-secondary" disabled={working} onClick={onMoveUp}>Move up</button>}
    {onMoveDown && <button type="button" className="admin-button-secondary" disabled={working} onClick={onMoveDown}>Move down</button>}
    {onCancel && <button type="button" className="admin-button-secondary" disabled={working} onClick={onCancel}>Cancel</button>}
    {onDelete && <button type="button" className="admin-button-danger" disabled={working} onClick={onDelete}>Delete</button>}
  </div>;
}
