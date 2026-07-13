"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { showAdminNotification } from "@/lib/admin/notifications";

type PlaylistItem = {
  id: string;
  src: string;
  order_index: number;
};

type DeviceDetails = {
  id: string;
  customer_id: string;
  name: string | null;
  is_active: boolean | null;
  make: string | null;
  model: string | null;
  serial_number: string | null;
  purchase_cost: number | null;
  purchase_date: string | null;
  warranty_period_months: number | null;
  supplier: string | null;
  location: string | null;
  internal_notes: string | null;
};

type DeviceSection = "overview" | "details" | "preview" | "media" | "display";
type DeviceOperation = "status" | "delete";

type DeviceOperationDraft = {
  operation: DeviceOperation;
  reason: string;
  confirmed: boolean;
};

const deviceSectionIds: DeviceSection[] = [
  "overview",
  "details",
  "preview",
  "media",
  "display",
];

export default function AdminDevicePage({
  params,
}: {
  params: Promise<{ deviceId: string }>;
}) {
  const { deviceId } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();

  const [deviceUuid, setDeviceUuid] = useState<string | null>(null);
  const [deviceName, setDeviceName] = useState("");
  const [newDeviceName, setNewDeviceName] = useState("");
  const [isActive, setIsActive] = useState(true);

  const [playlist, setPlaylist] = useState<PlaylistItem[]>([]);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUploadReason, setVideoUploadReason] = useState("");
  const [removingPlaylistId, setRemovingPlaylistId] = useState("");
  const [removeVideoReason, setRemoveVideoReason] = useState("");
  const [removeVideoConfirmed, setRemoveVideoConfirmed] = useState(false);
  const [renameReason, setRenameReason] = useState("");
  const [detailsReason, setDetailsReason] = useState("");
  const [deviceOperationDraft, setDeviceOperationDraft] =
    useState<DeviceOperationDraft | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [device, setDevice] = useState<DeviceDetails | null>(null);

  const [editMake, setEditMake] = useState("");
  const [editModel, setEditModel] = useState("");
  const [editSerialNumber, setEditSerialNumber] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editPurchaseCost, setEditPurchaseCost] = useState("");
  const [editPurchaseDate, setEditPurchaseDate] = useState("");
  const [editWarrantyPeriod, setEditWarrantyPeriod] = useState("");
  const [editSupplier, setEditSupplier] = useState("");
  const [editInternalNotes, setEditInternalNotes] = useState("");
  const [activeSection, setActiveSection] = useState<DeviceSection>("overview");

  const loadDeviceAndPlaylist = useCallback(async () => {
    setLoading(true);

    const { data: device, error: deviceError } = await supabase
      .from("devices")
      .select(
        `
        id,
        customer_id,
        name,
        is_active,
        make,
        model,
        serial_number,
        purchase_cost,
        purchase_date,
        warranty_period_months,
        supplier,
        location,
        internal_notes
      `,
      )
      .eq("device_code", deviceId)
      .single();

    if (deviceError || !device) {
      console.error("Device not found:", deviceError);
      setDeviceUuid(null);
      setPlaylist([]);
      setLoading(false);
      return;
    }

    setDevice(device);
    setEditMake(device.make || "");
    setEditModel(device.model || "");
    setEditSerialNumber(device.serial_number || "");
    setEditLocation(device.location || "");
    setEditPurchaseCost(device.purchase_cost?.toString() || "");
    setEditPurchaseDate(device.purchase_date || "");
    setEditWarrantyPeriod(device.warranty_period_months?.toString() || "");
    setEditSupplier(device.supplier || "");
    setEditInternalNotes(device.internal_notes || "");
    setDeviceUuid(device.id);
    setDeviceName(device.name || deviceId);
    setNewDeviceName(device.name || deviceId);
    setIsActive(device.is_active);

    const { data, error } = await supabase
      .from("playlists")
      .select("id, src, order_index, videos(storage_bucket, storage_path)")
      .eq("device_id", device.id)
      .order("order_index");

    if (error) {
      console.error("Playlist error:", error);
      setPlaylist([]);
    } else {
      const playlistWithPreviewUrls = await Promise.all(
        (data || []).map(async (item) => {
          const video = Array.isArray(item.videos)
            ? item.videos[0]
            : item.videos;

          if (video?.storage_bucket && video.storage_path) {
            const { data: signedUrlData } = await supabase.storage
              .from(video.storage_bucket)
              .createSignedUrl(video.storage_path, 60 * 15);

            if (signedUrlData?.signedUrl) {
              return { ...item, src: signedUrlData.signedUrl };
            }
          }

          return { ...item, src: item.src || "" };
        }),
      );

      setPlaylist(playlistWithPreviewUrls);
    }

    setLoading(false);
  }, [deviceId]);

  const renameDevice = async () => {
    if (!deviceUuid) return;

    if (!newDeviceName.trim()) {
      showAdminNotification("warning", "Device name is required.");
      return;
    }

    const reason = renameReason.trim();
    if (!reason) {
      showAdminNotification("warning", "Add a reason before renaming this device.");
      return;
    }

    setRenaming(true);

    const response = await fetch(`/api/admin/devices/${deviceUuid}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "rename",
        name: newDeviceName,
        reason,
      }),
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      showAdminNotification(
        "error",
        result.error || "Could not rename device.",
      );
      setRenaming(false);
      return;
    }

    await loadDeviceAndPlaylist();
    showAdminNotification("success", "Device renamed.");
    setRenameReason("");
    setRenaming(false);
  };

  const saveDeviceDetails = async () => {
    if (!deviceUuid) return;

    const reason = detailsReason.trim();
    if (!reason) {
      showAdminNotification("warning", "Add a reason before saving device details.");
      return;
    }

    setSaving(true);

    const response = await fetch(`/api/admin/devices/${deviceUuid}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update_details",
        make: editMake.trim() || null,
        model: editModel.trim() || null,
        serial_number: editSerialNumber.trim() || null,
        location: editLocation.trim() || null,
        purchase_cost: editPurchaseCost ? Number(editPurchaseCost) : null,
        purchase_date: editPurchaseDate || null,
        warranty_period_months: editWarrantyPeriod
          ? Number(editWarrantyPeriod)
          : null,
        supplier: editSupplier.trim() || null,
        internal_notes: editInternalNotes.trim() || null,
        reason,
      }),
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      showAdminNotification(
        "error",
        result.error || "Could not save device details.",
      );
      setSaving(false);
      return;
    }

    await loadDeviceAndPlaylist();
    showAdminNotification("success", "Device details updated.");
    setDetailsReason("");
    setSaving(false);
  };

  const deleteDevice = async (reason: string) => {
    if (!deviceUuid) return;

    const response = await fetch(`/api/admin/devices/${deviceUuid}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      showAdminNotification(
        "error",
        result.error || "Could not delete device.",
      );
      return;
    }

    showAdminNotification("success", "Device deleted.");
    window.location.href = "/admin/devices";
  };

  const toggleDeviceActive = async (reason: string) => {
    if (!deviceUuid) return;

    const nextValue = !isActive;
    const response = await fetch(`/api/admin/devices/${deviceUuid}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "set_active",
        is_active: nextValue,
        reason,
      }),
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      showAdminNotification(
        "error",
        result.error || "Could not update device status.",
      );
      return;
    }

    setIsActive(nextValue);
    setDeviceOperationDraft(null);
    showAdminNotification(
      "success",
      nextValue ? "Device activated." : "Device deactivated.",
    );
  };

  const submitDeviceOperation = async () => {
    if (!deviceOperationDraft) return;

    const reason = deviceOperationDraft.reason.trim();
    if (!reason) {
      showAdminNotification("warning", "Add a reason before saving this device operation.");
      return;
    }

    if (!deviceOperationDraft.confirmed) {
      showAdminNotification("warning", "Confirm the device operation before continuing.");
      return;
    }

    if (deviceOperationDraft.operation === "delete") {
      await deleteDevice(reason);
      return;
    }

    await toggleDeviceActive(reason);
  };

  const uploadVideo = async () => {
    if (!deviceUuid || !videoFile) return;

    if (videoFile.type !== "video/mp4") {
      showAdminNotification("warning", "Please upload an MP4 video.");
      return;
    }

    const reason = videoUploadReason.trim();

    if (reason.length < 5) {
      showAdminNotification(
        "warning",
        "Add a reason of at least 5 characters before uploading.",
      );
      return;
    }

    setSaving(true);

    const formData = new FormData();
    formData.append("file", videoFile);
    formData.append("reason", reason);

    const response = await fetch(`/api/admin/devices/${deviceUuid}/media`, {
      method: "POST",
      body: formData,
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      showAdminNotification(
        "error",
        result.error || "Could not upload and add video to playlist.",
      );
      setSaving(false);
      return;
    }

    setVideoFile(null);
    setVideoUploadReason("");
    await loadDeviceAndPlaylist();
    showAdminNotification("success", "Video uploaded and added to playlist.");
    setSaving(false);
  };

  const startRemoveVideo = (playlistId: string) => {
    setRemovingPlaylistId(playlistId);
    setRemoveVideoReason("");
    setRemoveVideoConfirmed(false);
  };

  const cancelRemoveVideo = () => {
    if (saving) return;
    setRemovingPlaylistId("");
    setRemoveVideoReason("");
    setRemoveVideoConfirmed(false);
  };

  const deleteVideo = async () => {
    const playlistId = removingPlaylistId;
    const reason = removeVideoReason.trim();

    if (!playlistId || !deviceUuid) return;

    if (reason.length < 5) {
      showAdminNotification(
        "warning",
        "Add a reason of at least 5 characters before removing media.",
      );
      return;
    }

    if (!removeVideoConfirmed) {
      showAdminNotification("warning", "Confirm the removal before continuing.");
      return;
    }

    const response = await fetch(`/api/admin/devices/${deviceUuid}/media`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playlistId, reason }),
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      showAdminNotification(
        "error",
        result.error || "Could not remove video from playlist.",
      );
      return;
    }

    await loadDeviceAndPlaylist();
    cancelRemoveVideo();
    showAdminNotification("success", "Video removed from playlist.");
  };

  useEffect(() => {
    loadDeviceAndPlaylist();
  }, [loadDeviceAndPlaylist]);

  useEffect(() => {
    const section = searchParams.get("section");
    if (deviceSectionIds.includes(section as DeviceSection)) {
      setActiveSection(section as DeviceSection);
    }
  }, [searchParams]);

  const navigateToSection = (section: DeviceSection) => {
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("section", section);
    router.push(`/admin/devices/${deviceId}?${nextParams.toString()}`);
  };

  if (loading) {
    return (
      <div className="admin-card p-6">
        <p className="admin-muted">Loading device...</p>
      </div>
    );
  }

  if (!deviceUuid) {
    return (
      <div>
        <div className="admin-page-header">
          <h1 className="admin-title">Device not found</h1>
          <p className="admin-subtitle">Device code: {deviceId}</p>
        </div>
      </div>
    );
  }

  const sections: Array<{ id: DeviceSection; label: string; count?: number }> = [
    { id: "overview", label: "Overview" },
    { id: "details", label: "Details" },
    { id: "preview", label: "Preview" },
    { id: "media", label: "Media", count: playlist.length },
    { id: "display", label: "Display URL" },
  ];

  return (
    <div>
      {/* Page Header */}
      <div className="admin-page-header">
        <Link
          href="/admin/devices"
          className="text-sm font-semibold text-[var(--admin-cyan)] no-underline"
        >
          ← Back to devices
        </Link>

        <div className="mt-4 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <h1 className="admin-title">{deviceName}</h1>
            <p className="admin-subtitle">Device code: {deviceId}</p>
          </div>

          <span
            className={`inline-flex w-fit rounded-full px-3 py-1 text-sm font-semibold ${
              isActive
                ? "bg-green-100 text-green-700"
                : "bg-red-100 text-red-700"
            }`}
          >
            {isActive ? "Active" : "Inactive"}
          </span>
        </div>
      </div>

      <div className="admin-section-tabs" aria-label="Device sections">
        {sections.map((section) => (
          <button
            key={section.id}
            type="button"
            onClick={() => navigateToSection(section.id)}
            className={`admin-section-tab ${
              activeSection === section.id ? "is-active" : ""
            }`}
          >
            {section.label}
            {typeof section.count === "number" ? ` (${section.count})` : ""}
          </button>
        ))}
      </div>

      {/* Device Summary */}
      {activeSection === "overview" && device && (
        <div className="admin-card p-6">
          <h2 className="admin-card-title text-xl">Device summary</h2>

          <div className="mt-4 grid gap-4 text-sm md:grid-cols-2">
            <InfoRow label="Make" value={device.make || "Not set"} />
            <InfoRow label="Model" value={device.model || "Not set"} />
            <InfoRow
              label="Serial number"
              value={device.serial_number || "Not set"}
            />
            <InfoRow label="Location" value={device.location || "Not set"} />
            <InfoRow
              label="Purchase cost"
              value={device.purchase_cost || "Not set"}
            />
            <InfoRow
              label="Purchase date"
              value={device.purchase_date || "Not set"}
            />
            <InfoRow
              label="Warranty period"
              value={
                device.warranty_period_months
                  ? `${device.warranty_period_months} months`
                  : "Not set"
              }
            />
            <InfoRow label="Supplier" value={device.supplier || "Not set"} />
          </div>

          <div className="mt-4 rounded-2xl bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Notes
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {device.internal_notes || "None"}
            </p>
          </div>

          <div className="admin-operation-panel mt-5">
            <div className="admin-operation-header">
              <div>
                <p className="admin-operation-kicker">Device operation flow</p>
                <h3>Activation and deletion</h3>
                <p>
                  Choose a sensitive device action, add the audit reason, then
                  confirm before changing the live device state.
                </p>
              </div>
              <div className="admin-operation-summary">
                <span>Current state</span>
                <strong>{isActive ? "Active" : "Inactive"}</strong>
              </div>
            </div>

            <div className="admin-pricing-operation-choice">
              <button
                type="button"
                className={`admin-operation-card ${
                  deviceOperationDraft?.operation === "status"
                    ? "is-selected"
                    : ""
                }`}
                onClick={() =>
                  setDeviceOperationDraft({
                    operation: "status",
                    reason: "",
                    confirmed: false,
                  })
                }
              >
                <span>
                  <strong>
                    {isActive ? "Deactivate device" : "Activate device"}
                  </strong>
                  <small>
                    Controls whether this display device is allowed to serve
                    live screen content.
                  </small>
                </span>
                <em>
                  {deviceOperationDraft?.operation === "status"
                    ? "Open"
                    : "Choose"}
                </em>
              </button>
              <button
                type="button"
                className={`admin-operation-card admin-operation-danger ${
                  deviceOperationDraft?.operation === "delete"
                    ? "is-selected"
                    : ""
                }`}
                onClick={() =>
                  setDeviceOperationDraft({
                    operation: "delete",
                    reason: "",
                    confirmed: false,
                  })
                }
              >
                <span>
                  <strong>Delete device</strong>
                  <small>
                    Removes this device and its playlist. Use only for wrong or
                    duplicate records.
                  </small>
                </span>
                <em>
                  {deviceOperationDraft?.operation === "delete"
                    ? "Open"
                    : "Choose"}
                </em>
              </button>
            </div>

            {deviceOperationDraft && (
              <div className="admin-operation-flow">
                <div className="admin-operation-flow-header">
                  <p className="admin-operation-kicker">Audit checkpoint</p>
                  <h4>
                    {deviceOperationDraft.operation === "delete"
                      ? "Delete this device"
                      : isActive
                        ? "Deactivate this device"
                        : "Activate this device"}
                  </h4>
                  <p>
                    {deviceOperationDraft.operation === "delete"
                      ? "This will remove the device record and its playlist."
                      : "This changes whether the display can be used operationally."}
                  </p>
                </div>

                <label className="admin-operation-reason">
                  Reason for audit history
                  <textarea
                    value={deviceOperationDraft.reason}
                    onChange={(event) =>
                      setDeviceOperationDraft((current) =>
                        current
                          ? {
                              ...current,
                              reason: event.target.value,
                              confirmed: false,
                            }
                          : current,
                      )
                    }
                    placeholder="Example: Duplicate test device created during setup."
                  />
                </label>

                <label className="admin-operation-confirm">
                  <input
                    type="checkbox"
                    checked={deviceOperationDraft.confirmed}
                    onChange={(event) =>
                      setDeviceOperationDraft((current) =>
                        current
                          ? {
                              ...current,
                              confirmed: event.target.checked,
                            }
                          : current,
                      )
                    }
                  />
                  <span>
                    I checked this device and want to save this audited
                    operation.
                  </span>
                </label>

                <div className="admin-operation-actions">
                  <button
                    type="button"
                    className={
                      deviceOperationDraft.operation === "delete"
                        ? "admin-button-danger"
                        : "admin-button-primary"
                    }
                    onClick={submitDeviceOperation}
                  >
                    {deviceOperationDraft.operation === "delete"
                      ? "Delete device"
                      : isActive
                        ? "Deactivate device"
                        : "Activate device"}
                  </button>
                  <button
                    type="button"
                    className="admin-button-secondary"
                    onClick={() => setDeviceOperationDraft(null)}
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Rename */}
      {activeSection === "details" && (
      <div className="admin-card p-6">
        <h2 className="admin-card-title text-xl">Rename device</h2>

        <div className="mt-4 flex flex-col gap-3 md:flex-row">
          <input
            value={newDeviceName}
            onChange={(e) => setNewDeviceName(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none transition focus:border-[var(--admin-cyan)] focus:ring-2 focus:ring-cyan-100"
          />

          <button
            onClick={renameDevice}
            disabled={renaming || !renameReason.trim()}
            className="admin-button-primary disabled:opacity-50"
          >
            {renaming ? "Saving..." : "Save"}
          </button>
        </div>
        <label className="admin-operation-reason">
          Reason for audit history
          <textarea
            value={renameReason}
            onChange={(event) => setRenameReason(event.target.value)}
            rows={3}
            placeholder="Example: Customer asked to rename this screen location."
          />
        </label>
      </div>
      )}

      {/* Device Details Form */}
      {activeSection === "details" && (
      <div className="admin-card mt-6 p-6">
        <h2 className="admin-card-title text-xl">Device details</h2>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Input label="Make" value={editMake} onChange={setEditMake} />
          <Input label="Model" value={editModel} onChange={setEditModel} />
          <Input
            label="Serial number"
            value={editSerialNumber}
            onChange={setEditSerialNumber}
          />
          <Input
            label="Location"
            value={editLocation}
            onChange={setEditLocation}
          />
          <Input
            label="Purchase cost"
            type="number"
            value={editPurchaseCost}
            onChange={setEditPurchaseCost}
          />
          <Input
            label="Purchase date"
            type="date"
            value={editPurchaseDate}
            onChange={setEditPurchaseDate}
          />
          <Input
            label="Warranty period months"
            type="number"
            value={editWarrantyPeriod}
            onChange={setEditWarrantyPeriod}
          />
          <Input
            label="Supplier"
            value={editSupplier}
            onChange={setEditSupplier}
          />
        </div>

        <textarea
          value={editInternalNotes}
          onChange={(e) => setEditInternalNotes(e.target.value)}
          placeholder="Internal notes"
          className="mt-4 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none transition focus:border-[var(--admin-cyan)] focus:ring-2 focus:ring-cyan-100"
          rows={3}
        />

        <label className="admin-operation-reason">
          Reason for audit history
          <textarea
            value={detailsReason}
            onChange={(event) => setDetailsReason(event.target.value)}
            rows={3}
            placeholder="Example: Serial number corrected after checking the device label."
          />
        </label>

        <button
          onClick={saveDeviceDetails}
          disabled={saving || !detailsReason.trim()}
          className="admin-button-primary mt-4 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save device details"}
        </button>
      </div>
      )}

      {/* Live Preview */}
      {activeSection === "preview" && (
      <div className="rounded-3xl border border-slate-800 bg-black p-3 shadow-xl">
        <div className="mb-3 flex items-center justify-between text-white">
          <p className="text-sm font-semibold">Live screen preview</p>

          <a
            href={`/display/${deviceId}`}
            target="_blank"
            className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-black no-underline"
          >
            Open full screen
          </a>
        </div>

        <div className="aspect-video overflow-hidden rounded-2xl bg-black">
          <iframe
            src={`/display/${deviceId}`}
            className="h-full w-full border-0"
            title="Display preview"
          />
        </div>
      </div>
      )}

      {/* Upload Video */}
      {activeSection === "media" && (
      <div className="admin-operation-panel">
        <div className="admin-operation-header">
          <div>
            <p className="admin-operation-kicker">Playlist media flow</p>
            <h3>Add display video</h3>
            <p>
              Choose an MP4, record the operational reason, then add it to the
              playlist in one audited step.
            </p>
          </div>
          <div className="admin-operation-summary">
            <span>Playlist items</span>
            <strong>{playlist.length}</strong>
          </div>
        </div>

        <div className="admin-device-media-flow">
          <label className="admin-device-file-picker">
            MP4 video file
            <input
              type="file"
              accept="video/mp4"
              onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
            />
            <span>
              {videoFile
                ? `${videoFile.name} (${Math.ceil(videoFile.size / 1024)} KB)`
                : "No file selected"}
            </span>
          </label>

          <label className="admin-operation-reason">
            Reason for audit history
            <textarea
              value={videoUploadReason}
              onChange={(event) => setVideoUploadReason(event.target.value)}
              rows={3}
              placeholder="Example: initial menu playlist for installed device."
            />
          </label>

          <div className="admin-operation-actions">
            <button
              type="button"
              onClick={uploadVideo}
              disabled={saving || !videoFile}
              className="admin-button-primary disabled:opacity-50"
            >
              {saving ? "Uploading..." : "Upload and add to playlist"}
            </button>
            <button
              type="button"
              onClick={() => {
                setVideoFile(null);
                setVideoUploadReason("");
              }}
              disabled={saving || (!videoFile && !videoUploadReason)}
              className="admin-button-secondary disabled:opacity-50"
            >
              Clear
            </button>
          </div>
        </div>
      </div>
      )}

      {/* Playlist */}
      {activeSection === "media" && (
      <div className="admin-card mt-6 p-6">
        <h2 className="admin-card-title text-xl">Current playlist</h2>

        {playlist.length === 0 ? (
          <p className="admin-muted mt-3">No videos assigned yet.</p>
        ) : (
          <div className="mt-4 space-y-4">
            {playlist.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl border border-slate-200 bg-white/70 p-4"
              >
                <p className="mb-2 text-sm font-semibold text-slate-500">
                  Order: {item.order_index}
                </p>

                <video src={item.src} controls className="w-full rounded-xl" />

                {removingPlaylistId === item.id ? (
                  <div className="admin-device-remove-flow">
                    <label className="admin-operation-reason">
                      Reason for removing this media
                      <textarea
                        value={removeVideoReason}
                        onChange={(event) =>
                          setRemoveVideoReason(event.target.value)
                        }
                        rows={3}
                        placeholder="Record why this video is being removed from the playlist."
                      />
                    </label>
                    <label className="admin-operation-confirm">
                      <input
                        type="checkbox"
                        checked={removeVideoConfirmed}
                        onChange={(event) =>
                          setRemoveVideoConfirmed(event.target.checked)
                        }
                      />
                      I have reviewed that this removes the video from the
                      display playlist.
                    </label>
                    <div className="admin-operation-actions">
                      <button
                        type="button"
                        onClick={deleteVideo}
                        disabled={saving}
                        className="admin-button-danger"
                      >
                        {saving ? "Removing..." : "Remove from playlist"}
                      </button>
                      <button
                        type="button"
                        onClick={cancelRemoveVideo}
                        disabled={saving}
                        className="admin-button-secondary"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => startRemoveVideo(item.id)}
                    className="admin-button-danger mt-3"
                  >
                    Remove from playlist
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      )}

      {/* Display URL */}
      {activeSection === "display" && (
      <div className="admin-card p-6">
        <h2 className="admin-card-title text-xl">Display URL</h2>

        <div className="mt-3 flex flex-col justify-between gap-3 rounded-2xl bg-slate-50 p-4 md:flex-row md:items-center">
          <span className="break-all font-mono text-xs text-slate-700">
            /display/{deviceId}
          </span>

          <a
            href={`/display/${deviceId}`}
            target="_blank"
            className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-semibold text-white no-underline"
          >
            Preview
          </a>
        </div>
      </div>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 break-all text-sm font-semibold text-slate-900">
        {value}
      </p>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="text-sm font-semibold text-slate-700">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none transition focus:border-[var(--admin-cyan)] focus:ring-2 focus:ring-cyan-100"
      />
    </div>
  );
}
