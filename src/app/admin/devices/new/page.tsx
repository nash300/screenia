"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { showAdminNotification } from "@/lib/admin/notifications";

type Customer = {
  id: string;
  name: string;
  status: string | null;
};

export default function NewDevicePage() {
  return (
    <Suspense fallback={<NewDeviceFallback />}>
      <NewDevicePageContent />
    </Suspense>
  );
}

function NewDeviceFallback() {
  return (
    <div className="admin-card p-6">
      <p className="admin-muted">Loading device form...</p>
    </div>
  );
}

function NewDevicePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedCustomerId = searchParams.get("customerId") || "";

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState(preselectedCustomerId);

  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [make, setMake] = useState("Xiaomi");
  const [model, setModel] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [purchaseCost, setPurchaseCost] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [warrantyPeriod, setWarrantyPeriod] = useState("");
  const [supplier, setSupplier] = useState("");
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
      showAdminNotification("warning", "Device name is required.");
      return;
    }

    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      showAdminNotification("warning", "Add a reason before creating this display device.");
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
        make,
        model,
        serial_number: serialNumber,
        purchase_cost: purchaseCost,
        purchase_date: purchaseDate,
        warranty_period_months: warrantyPeriod,
        supplier,
        internal_notes: internalNotes,
        reason: trimmedReason,
      }),
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      showAdminNotification(
        "error",
        result.error || "Could not create device.",
      );
      setSaving(false);
      return;
    }

    showAdminNotification("success", "Device created successfully.");
    router.push(`/admin/devices/${result.device.device_code}`);
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  return (
    <div>
      {/* Page Header */}
      <div className="admin-page-header">
        <h1 className="admin-title">Add device</h1>
        <p className="admin-subtitle">
          Register a physical device and assign it to a customer.
        </p>
      </div>

      {/* Device Form */}
      <div className="admin-card p-6">
        <div className="grid gap-4 md:grid-cols-2">
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
            label="Device name *"
            value={name}
            onChange={setName}
            placeholder="Menu screen, price list, special offers..."
          />

          <TextInput
            id="device-location"
            name="location"
            label="Location"
            value={location}
            onChange={setLocation}
            placeholder="Reception, entrance, waiting area..."
          />

          <TextInput id="device-make" name="make" label="Make" value={make} onChange={setMake} />

          <TextInput
            id="device-model"
            name="model"
            label="Model"
            value={model}
            onChange={setModel}
            placeholder="TV Box S 2nd Gen"
          />

          <TextInput
            id="device-serial-number"
            name="serialNumber"
            label="Serial number"
            value={serialNumber}
            onChange={setSerialNumber}
          />

          <TextInput
            id="device-purchase-cost"
            name="purchaseCost"
            label="Purchase cost"
            type="number"
            value={purchaseCost}
            onChange={setPurchaseCost}
            placeholder="599"
          />

          <TextInput
            id="device-purchase-date"
            name="purchaseDate"
            label="Purchase date"
            type="date"
            value={purchaseDate}
            onChange={setPurchaseDate}
          />

          <TextInput
            id="device-warranty-period"
            name="warrantyPeriod"
            label="Warranty period (months)"
            type="number"
            value={warrantyPeriod}
            onChange={setWarrantyPeriod}
            placeholder="12"
          />

          <TextInput
            id="device-supplier"
            name="supplier"
            label="Supplier"
            value={supplier}
            onChange={setSupplier}
            placeholder="Elgiganten, Amazon, etc."
          />
        </div>

        <div className="mt-4">
          <label htmlFor="device-internal-notes" className="text-sm font-semibold text-slate-700">
            Internal notes
          </label>
          <textarea
            id="device-internal-notes"
            name="internalNotes"
            value={internalNotes}
            onChange={(e) => setInternalNotes(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none transition focus:border-[var(--admin-cyan)] focus:ring-2 focus:ring-cyan-100"
            rows={4}
          />
        </div>

        <div className="mt-4">
          <label htmlFor="device-create-reason" className="text-sm font-semibold text-slate-700">
            Creation reason *
          </label>
          <textarea
            id="device-create-reason"
            name="createReason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Example: Paid customer needs a registered display device for installation."
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none transition focus:border-[var(--admin-cyan)] focus:ring-2 focus:ring-cyan-100"
            rows={3}
          />
        </div>

        <button
          onClick={createDevice}
          disabled={saving || !reason.trim()}
          className="admin-button-primary mt-6 disabled:opacity-50"
        >
          {saving ? "Creating..." : "Create device"}
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
    <div>
      <label htmlFor={id} className="text-sm font-semibold text-slate-700">{label}</label>
      <input
        id={id}
        name={name}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none transition focus:border-[var(--admin-cyan)] focus:ring-2 focus:ring-cyan-100"
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
    <div>
      <label htmlFor={id} className="text-sm font-semibold text-slate-700">{label}</label>
      <select
        id={id}
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none transition focus:border-[var(--admin-cyan)] focus:ring-2 focus:ring-cyan-100"
      >
        {children}
      </select>
    </div>
  );
}
