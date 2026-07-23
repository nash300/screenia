"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { showAdminNotification } from "@/lib/admin/notifications";

type Customer = {
  id: string;
  name: string;
  status: string | null;
};

export default function NewDevicePage() {
  const router = useRouter();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState("");

  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [reason, setReason] = useState("");

  const [saving, setSaving] = useState(false);

  const loadCustomers = async () => {
    const { data, error } = await supabase
      .from("customers")
      .select("id, name, status")
      .order("name", { ascending: true });

    if (error) {
      console.error("Load customers error:", error);
      setCustomers([]);
      return;
    }

    setCustomers(data || []);
  };

  const createDevice = async () => {
    if (!customerId) {
      showAdminNotification("warning", "Please select a customer.");
      return;
    }

    if (!name.trim()) {
      showAdminNotification("warning", "Display name is required.");
      return;
    }

    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      showAdminNotification("warning", "Add a reason before creating this display endpoint.");
      return;
    }

    setSaving(true);

    const response = await fetch("/api/admin/devices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customer_id: customerId,
        name,
        location,
        internal_notes: internalNotes,
        reason: trimmedReason,
      }),
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      showAdminNotification(
        "error",
        result.error || "Could not create display.",
      );
      setSaving(false);
      return;
    }

    showAdminNotification("success", "Display endpoint created successfully.");
    router.push(`/admin/devices/${result.device.device_code}`);
  };

  useEffect(() => {
    setCustomerId(new URLSearchParams(window.location.search).get("customerId") || "");
    loadCustomers();
  }, []);

  return (
    <div>
      {/* Page Header */}
      <div className="admin-page-header">
        <h1 className="admin-title">Create display endpoint</h1>
        <p className="admin-subtitle">
          Create the customer screen URL and playlist target. Physical boxes,
          serial numbers, warranty, and repairs stay in Hardware stock.
        </p>
      </div>

      {/* Display Form */}
      <div className="admin-card admin-device-create-panel">
        <div className="admin-device-create-info-panel">
          <p className="admin-device-create-info-title">
            Where this fits in the workflow
          </p>
          <p className="admin-device-create-info-copy">
            Use the customer profile&apos;s Device allocation tab to connect paid
            customers to available stock. Use this page only when you need to
            create or replace the live endpoint that serves screen content.
            Register purchase data, serial numbers, warranty, condition, returns,
            repairs, and retirement in Hardware stock.
          </p>
        </div>
        <div className="admin-device-create-grid">
          <SelectInput
            id="device-customer"
            name="customerId"
            label="Customer *"
            value={customerId}
            onChange={setCustomerId}
          >
            <option value="">Select customer</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name} ({customer.status || "draft"})
              </option>
            ))}
          </SelectInput>

          <TextInput
            id="device-name"
            name="deviceName"
            label="Endpoint name *"
            value={name}
            onChange={setName}
            placeholder="Menu screen, price list, special offers..."
          />

          <TextInput
            id="device-location"
            name="location"
            label="Screen location"
            value={location}
            onChange={setLocation}
            placeholder="Reception, entrance, waiting area..."
          />
        </div>

        <div className="admin-device-create-field admin-device-create-field-wide">
          <label htmlFor="device-internal-notes" className="admin-device-create-label">
            Internal notes
          </label>
          <textarea
            id="device-internal-notes"
            name="internalNotes"
            value={internalNotes}
            onChange={(e) => setInternalNotes(e.target.value)}
            className="admin-device-create-control"
            rows={4}
          />
        </div>

        <div className="admin-device-create-field admin-device-create-field-wide">
          <label htmlFor="device-create-reason" className="admin-device-create-label">
            Creation reason *
          </label>
          <textarea
            id="device-create-reason"
            name="createReason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Example: Paid customer needs a screen URL for the entrance display."
            className="admin-device-create-control"
            rows={3}
          />
        </div>

        <button
          onClick={createDevice}
          disabled={saving || !reason.trim()}
          className="admin-button-primary admin-device-create-submit disabled:opacity-50"
        >
          {saving ? "Creating..." : "Create display endpoint"}
        </button>
      </div>
    </div>
  );
}

function TextInput({
  id,
  name,
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  id: string;
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div className="admin-device-create-field">
      <label htmlFor={id} className="admin-device-create-label">{label}</label>
      <input
        id={id}
        name={name}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="admin-device-create-control"
      />
    </div>
  );
}

function SelectInput({
  id,
  name,
  label,
  value,
  onChange,
  children,
}: {
  id: string;
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="admin-device-create-field">
      <label htmlFor={id} className="admin-device-create-label">{label}</label>
      <select
        id={id}
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="admin-device-create-control"
      >
        {children}
      </select>
    </div>
  );
}
