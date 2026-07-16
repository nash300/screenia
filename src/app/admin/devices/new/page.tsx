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
  const [entryMode, setEntryMode] = useState<"stock" | "customer">(
    preselectedCustomerId ? "customer" : "stock",
  );
  const [customerId, setCustomerId] = useState(preselectedCustomerId);

  const [name, setName] = useState("");
  const [itemType, setItemType] = useState(
    searchParams.get("itemType") || "standard_fhd",
  );
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
    if (entryMode === "customer" && !customerId) {
      showAdminNotification("warning", "Please select a customer.");
      return;
    }

    if (entryMode === "customer" && !name.trim()) {
      showAdminNotification("warning", "Device name is required.");
      return;
    }

    if (entryMode === "stock" && !serialNumber.trim()) {
      showAdminNotification("warning", "Serial number is required for stock.");
      return;
    }

    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      showAdminNotification("warning", "Add a reason before saving this device record.");
      return;
    }

    setSaving(true);

    const response = await fetch(
      entryMode === "stock" ? "/api/admin/inventory" : "/api/admin/devices",
      {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        entryMode === "stock"
          ? {
              item_type: itemType,
              status: "in_stock",
              condition: "new",
              make,
              model,
              serial_number: serialNumber,
              seller: supplier,
              purchase_cost: purchaseCost,
              purchase_date: purchaseDate,
              warranty_period_months: warrantyPeriod,
              notes: internalNotes,
              reason: trimmedReason,
            }
          : {
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
            },
      ),
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

    if (entryMode === "stock") {
      showAdminNotification("success", "Stock device added successfully.");
      router.push("/admin/inventory");
      return;
    }

    showAdminNotification("success", "Customer device created successfully.");
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
          Add hardware to stock or create a customer device after onboarding.
        </p>
      </div>

      {/* Device Form */}
      <div className="admin-card p-6">
        <div className="mb-5 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-2">
          <button
            type="button"
            onClick={() => setEntryMode("stock")}
            className={`rounded-xl border px-4 py-3 text-left text-sm font-semibold ${
              entryMode === "stock"
                ? "border-blue-500 bg-white text-blue-950 shadow-sm"
                : "border-transparent text-slate-600"
            }`}
          >
            Add to stock
            <span className="mt-1 block text-xs font-normal text-slate-500">
              Register hardware without assigning it to a customer.
            </span>
          </button>
          <button
            type="button"
            onClick={() => setEntryMode("customer")}
            className={`rounded-xl border px-4 py-3 text-left text-sm font-semibold ${
              entryMode === "customer"
                ? "border-blue-500 bg-white text-blue-950 shadow-sm"
                : "border-transparent text-slate-600"
            }`}
          >
            Add for customer
            <span className="mt-1 block text-xs font-normal text-slate-500">
              Create an active display device for a paid customer.
            </span>
          </button>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {entryMode === "customer" ? (
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
          ) : (
            <SelectInput
              id="device-item-type"
              name="itemType"
              label="Stock type *"
              value={itemType}
              onChange={setItemType}
            >
              <option value="standard_fhd">Standard FHD</option>
              <option value="premium_4k">Premium 4K</option>
              <option value="spare">Spare part</option>
              <option value="other">Other</option>
            </SelectInput>
          )}

          {entryMode === "customer" ? (
            <TextInput
              id="device-name"
              name="deviceName"
              label="Device name *"
              value={name}
              onChange={setName}
              placeholder="Menu screen, price list, special offers..."
            />
          ) : null}

          {entryMode === "customer" ? (
            <TextInput
              id="device-location"
              name="location"
              label="Location"
              value={location}
              onChange={setLocation}
              placeholder="Reception, entrance, waiting area..."
            />
          ) : null}

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
            label={entryMode === "stock" ? "Serial number *" : "Serial number"}
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
            label={entryMode === "stock" ? "Seller / supplier" : "Supplier"}
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
            placeholder={
              entryMode === "stock"
                ? "Example: New hardware purchased for stock before customer allocation."
                : "Example: Paid customer needs a registered display device for installation."
            }
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none transition focus:border-[var(--admin-cyan)] focus:ring-2 focus:ring-cyan-100"
            rows={3}
          />
        </div>

        <button
          onClick={createDevice}
          disabled={saving || !reason.trim()}
          className="admin-button-primary mt-6 disabled:opacity-50"
        >
          {saving
            ? "Saving..."
            : entryMode === "stock"
              ? "Add stock device"
              : "Create customer device"}
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
