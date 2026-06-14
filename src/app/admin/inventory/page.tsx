"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { showAdminNotification } from "@/lib/admin/notifications";

type CustomerOption = {
  id: string;
  name: string;
  email: string | null;
};

type DeviceOption = {
  id: string;
  device_code: string;
  name: string | null;
  customer_id: string;
  serial_number: string | null;
  customers: {
    name: string | null;
  } | null;
};

type InventoryItem = {
  id: string;
  item_code: string;
  item_type: string;
  status: string;
  condition: string;
  make: string | null;
  model: string | null;
  serial_number: string | null;
  seller: string | null;
  invoice_number: string | null;
  purchase_cost: number | null;
  purchase_currency: string | null;
  purchase_date: string | null;
  warranty_period_months: number | null;
  warranty_until: string | null;
  customer_id: string | null;
  device_id: string | null;
  assigned_at: string | null;
  shipped_at: string | null;
  returned_at: string | null;
  last_checked_at: string | null;
  defect_description: string | null;
  return_notes: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string | null;
  customers: {
    id: string;
    name: string | null;
    email: string | null;
  } | null;
  devices: {
    device_code: string;
    name: string | null;
  } | null;
};

type InventoryEvent = {
  id: string;
  inventory_item_id: string;
  event_type: string;
  from_status: string | null;
  to_status: string | null;
  notes: string | null;
  created_at: string;
};

type InventoryForm = {
  item_type: string;
  status: string;
  condition: string;
  make: string;
  model: string;
  serial_number: string;
  seller: string;
  invoice_number: string;
  purchase_cost: string;
  purchase_date: string;
  warranty_period_months: string;
  warranty_until: string;
  defect_description: string;
  return_notes: string;
  notes: string;
};

const itemTypes = [
  { value: "standard_fhd", label: "Standard FHD" },
  { value: "premium_4k", label: "Premium 4K" },
  { value: "spare", label: "Spare part" },
  { value: "other", label: "Other" },
];

const statuses = [
  { value: "in_stock", label: "In stock" },
  { value: "reserved", label: "Reserved" },
  { value: "assigned", label: "Assigned" },
  { value: "shipped", label: "Shipped" },
  { value: "returned", label: "Returned" },
  { value: "defective", label: "Defective" },
  { value: "in_repair", label: "In repair" },
  { value: "retired", label: "Retired" },
  { value: "lost", label: "Lost" },
];

const conditions = [
  { value: "new", label: "New" },
  { value: "tested", label: "Tested" },
  { value: "used", label: "Used" },
  { value: "returned", label: "Returned" },
  { value: "defective", label: "Defective" },
  { value: "repaired", label: "Repaired" },
];

function createEmptyForm(): InventoryForm {
  return {
    item_type: "standard_fhd",
    status: "in_stock",
    condition: "new",
    make: "Xiaomi",
    model: "",
    serial_number: "",
    seller: "",
    invoice_number: "",
    purchase_cost: "",
    purchase_date: new Date().toISOString().slice(0, 10),
    warranty_period_months: "",
    warranty_until: "",
    defect_description: "",
    return_notes: "",
    notes: "",
  };
}

export default function AdminInventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [devices, setDevices] = useState<DeviceOption[]>([]);
  const [events, setEvents] = useState<InventoryEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [schemaWarning, setSchemaWarning] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [form, setForm] = useState<InventoryForm>(() => createEmptyForm());
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [allocationCustomerId, setAllocationCustomerId] = useState("");
  const [allocationLocation, setAllocationLocation] = useState("");
  const [existingDeviceId, setExistingDeviceId] = useState("");
  const [nowMs] = useState(() => Date.now());

  const selectedItem = items.find((item) => item.id === selectedId) || null;

  const loadInventory = async () => {
    setLoading(true);

    const [
      { data: itemData, error: itemError },
      { data: customerData, error: customerError },
      { data: deviceData, error: deviceError },
    ] =
      await Promise.all([
        supabase
          .from("inventory_items")
          .select(
            `
            id,
            item_code,
            item_type,
            status,
            condition,
            make,
            model,
            serial_number,
            seller,
            invoice_number,
            purchase_cost,
            purchase_currency,
            purchase_date,
            warranty_period_months,
            warranty_until,
            customer_id,
            device_id,
            assigned_at,
            shipped_at,
            returned_at,
            last_checked_at,
            defect_description,
            return_notes,
            notes,
            created_at,
            updated_at,
            customers(id, name, email),
            devices(device_code, name)
          `,
          )
          .order("created_at", { ascending: false }),
        supabase
          .from("customers")
          .select("id, name, email")
          .order("name", { ascending: true }),
        supabase
          .from("devices")
          .select("id, device_code, name, customer_id, serial_number, customers(name)")
          .order("created_at", { ascending: false }),
      ]);

    if (itemError) {
      if (itemError.code === "PGRST205") {
        setSchemaWarning(
          "Inventory tables are missing in Supabase. Apply the inventory migration before adding stock items.",
        );
      } else {
        console.error("Load inventory error:", itemError);
        showAdminNotification("error", "Could not load inventory.");
      }
      setItems([]);
    } else {
      setSchemaWarning("");
      const nextItems = (itemData || []) as unknown as InventoryItem[];
      setItems(nextItems);
      if (!selectedId && nextItems[0]) {
        setSelectedId(nextItems[0].id);
      }
    }

    if (customerError) {
      console.error("Load customers error:", customerError);
      setCustomers([]);
    } else {
      setCustomers((customerData || []) as CustomerOption[]);
    }

    if (deviceError) {
      console.error("Load devices error:", deviceError);
      setDevices([]);
    } else {
      setDevices((deviceData || []) as unknown as DeviceOption[]);
    }

    setLoading(false);
  };

  const loadEvents = async (itemId: string | null) => {
    if (!itemId) {
      setEvents([]);
      return;
    }

    const { data, error } = await supabase
      .from("inventory_events")
      .select("id, inventory_item_id, event_type, from_status, to_status, notes, created_at")
      .eq("inventory_item_id", itemId)
      .order("created_at", { ascending: false })
      .limit(30);

    if (error) {
      if (error.code !== "PGRST205") {
        console.error("Load inventory events error:", error);
      }
      setEvents([]);
      return;
    }

    setEvents((data || []) as InventoryEvent[]);
  };

  useEffect(() => {
    loadInventory();
  }, []);

  useEffect(() => {
    loadEvents(selectedId);
  }, [selectedId]);

  useEffect(() => {
    if (selectedItem) {
      setAllocationCustomerId(selectedItem.customer_id || "");
      setAllocationLocation("");
      setExistingDeviceId("");
    }
  }, [selectedItem?.id]);

  const counts = useMemo(() => {
    return statuses.reduce<Record<string, number>>(
      (acc, status) => {
        acc[status.value] = items.filter((item) => item.status === status.value).length;
        return acc;
      },
      { all: items.length },
    );
  }, [items]);

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return items.filter((item) => {
      const haystack = [
        item.item_code,
        itemTypeLabel(item.item_type),
        statusLabel(item.status),
        item.condition,
        item.make,
        item.model,
        item.serial_number,
        item.seller,
        item.customers?.name,
        item.customers?.email,
        item.devices?.device_code,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesStatus = statusFilter === "all" || item.status === statusFilter;
      const matchesType = typeFilter === "all" || item.item_type === typeFilter;

      return matchesStatus && matchesType && (!normalizedQuery || haystack.includes(normalizedQuery));
    });
  }, [items, query, statusFilter, typeFilter]);

  const stockSummary = {
    ready: items.filter((item) => ["in_stock", "returned"].includes(item.status)).length,
    allocated: items.filter((item) => ["assigned", "shipped"].includes(item.status)).length,
    attention: items.filter((item) => ["defective", "in_repair", "lost"].includes(item.status)).length,
    warrantySoon: items.filter((item) => {
      if (!item.warranty_until) return false;
      const diff = new Date(item.warranty_until).getTime() - nowMs;
      return diff > 0 && diff <= 1000 * 60 * 60 * 24 * 60;
    }).length,
  };

  const linkableDevices = useMemo(() => {
    const linkedDeviceIds = new Set(
      items
        .filter((item) => item.device_id && item.id !== selectedItem?.id)
        .map((item) => item.device_id),
    );

    return devices.filter((device) => !linkedDeviceIds.has(device.id));
  }, [devices, items, selectedItem?.id]);

  const updateForm = (field: keyof InventoryForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const resetForm = () => {
    setForm(createEmptyForm());
    setEditingId(null);
    setShowForm(false);
  };

  const startAddItem = () => {
    setForm(createEmptyForm());
    setEditingId(null);
    setShowForm(true);
  };

  const editItem = (item: InventoryItem) => {
    setSelectedId(item.id);
    setEditingId(item.id);
    setShowForm(true);
    setForm({
      item_type: item.item_type,
      status: item.status,
      condition: item.condition,
      make: item.make || "",
      model: item.model || "",
      serial_number: item.serial_number || "",
      seller: item.seller || "",
      invoice_number: item.invoice_number || "",
      purchase_cost: item.purchase_cost?.toString() || "",
      purchase_date: item.purchase_date || "",
      warranty_period_months: item.warranty_period_months?.toString() || "",
      warranty_until: item.warranty_until || "",
      defect_description: item.defect_description || "",
      return_notes: item.return_notes || "",
      notes: item.notes || "",
    });
  };

  const saveInventoryItem = async () => {
    if (!form.serial_number.trim()) {
      showAdminNotification("warning", "Serial number is required.");
      return;
    }

    setSaving(true);

    const payload = {
      item_type: form.item_type,
      status: form.status,
      condition: form.condition,
      make: form.make.trim() || null,
      model: form.model.trim() || null,
      serial_number: form.serial_number.trim(),
      seller: form.seller.trim() || null,
      invoice_number: form.invoice_number.trim() || null,
      purchase_cost: form.purchase_cost ? Number(form.purchase_cost) : null,
      purchase_currency: "sek",
      purchase_date: form.purchase_date || null,
      warranty_period_months: form.warranty_period_months
        ? Number(form.warranty_period_months)
        : null,
      warranty_until: form.warranty_until || null,
      defect_description: form.defect_description.trim() || null,
      return_notes: form.return_notes.trim() || null,
      notes: form.notes.trim() || null,
      last_checked_at: form.status === "in_stock" ? new Date().toISOString() : undefined,
    };

    const queryBuilder = editingId
      ? supabase.from("inventory_items").update(payload).eq("id", editingId)
      : supabase.from("inventory_items").insert(payload);

    const { error } = await queryBuilder;

    if (error) {
      console.error("Save inventory error:", error);
      showAdminNotification("error", error.message || "Could not save stock item.");
      setSaving(false);
      return;
    }

    showAdminNotification("success", editingId ? "Inventory item updated." : "Inventory item added.");
    resetForm();
    await loadInventory();
    setSaving(false);
  };

  const updateItemStatus = async (
    item: InventoryItem,
    status: string,
    condition: string,
    extra: Partial<InventoryItem> = {},
  ) => {
    setSaving(true);
    const timestamp = new Date().toISOString();
    const payload: Record<string, string | number | boolean | null> = {
      status,
      condition,
    };

    if (typeof extra.customer_id !== "undefined") {
      payload.customer_id = extra.customer_id;
    }
    if (typeof extra.return_notes !== "undefined") {
      payload.return_notes = extra.return_notes;
    }
    if (typeof extra.defect_description !== "undefined") {
      payload.defect_description = extra.defect_description;
    }

    if (status === "returned") payload.returned_at = timestamp;
    if (status === "shipped") payload.shipped_at = timestamp;
    if (status === "in_stock") payload.last_checked_at = timestamp;
    const { error } = await supabase
      .from("inventory_items")
      .update(payload)
      .eq("id", item.id);

    if (error) {
      console.error("Update inventory status error:", error);
      showAdminNotification("error", "Could not update inventory item.");
      setSaving(false);
      return;
    }

    showAdminNotification("success", "Inventory status updated.");
    await loadInventory();
    await loadEvents(item.id);
    setSaving(false);
  };

  const allocateSelectedItem = async () => {
    if (!selectedItem) return;
    if (!allocationCustomerId) {
      showAdminNotification("warning", "Select a customer before allocation.");
      return;
    }
    if (selectedItem.device_id) {
      showAdminNotification("warning", "This stock item is already linked to a device.");
      return;
    }

    setSaving(true);

    const selectedCustomer = customers.find((customer) => customer.id === allocationCustomerId);
    const deviceName = `${itemTypeLabel(selectedItem.item_type)} - ${
      selectedCustomer?.name || "Customer screen"
    }`;

    const { data: deviceData, error: deviceError } = await supabase
      .from("devices")
      .insert({
        id: crypto.randomUUID(),
        customer_id: allocationCustomerId,
        name: deviceName,
        make: selectedItem.make,
        model: selectedItem.model,
        serial_number: selectedItem.serial_number,
        purchase_cost: selectedItem.purchase_cost,
        purchase_date: selectedItem.purchase_date,
        warranty_period_months: selectedItem.warranty_period_months,
        supplier: selectedItem.seller,
        location: allocationLocation.trim() || null,
        inventory_status: "assigned",
        inventory_notes: selectedItem.notes,
        is_active: true,
      })
      .select("id, device_code")
      .single();

    if (deviceError || !deviceData) {
      console.error("Allocate device error:", deviceError);
      showAdminNotification("error", deviceError?.message || "Could not create device.");
      setSaving(false);
      return;
    }

    const { error: inventoryError } = await supabase
      .from("inventory_items")
      .update({
        status: "assigned",
        condition: selectedItem.condition === "new" ? "tested" : selectedItem.condition,
        customer_id: allocationCustomerId,
        device_id: deviceData.id,
        assigned_at: new Date().toISOString(),
      })
      .eq("id", selectedItem.id);

    if (inventoryError) {
      console.error("Update allocated inventory error:", inventoryError);
      showAdminNotification(
        "error",
        "Device was created, but inventory could not be linked. Open the device manager and check this item.",
      );
      setSaving(false);
      return;
    }

    showAdminNotification("success", `Allocated to device ${deviceData.device_code}.`);
    await loadInventory();
    await loadEvents(selectedItem.id);
    setSaving(false);
  };

  const linkExistingDevice = async () => {
    if (!selectedItem) return;
    if (!existingDeviceId) {
      showAdminNotification("warning", "Select an existing device to link.");
      return;
    }

    const device = devices.find((item) => item.id === existingDeviceId);
    if (!device) {
      showAdminNotification("warning", "Selected device was not found.");
      return;
    }

    setSaving(true);

    const { error: inventoryError } = await supabase
      .from("inventory_items")
      .update({
        status: "assigned",
        condition: selectedItem.condition === "new" ? "tested" : selectedItem.condition,
        customer_id: device.customer_id,
        device_id: device.id,
        assigned_at: new Date().toISOString(),
      })
      .eq("id", selectedItem.id);

    if (inventoryError) {
      console.error("Link existing device error:", inventoryError);
      showAdminNotification("error", "Could not link existing device.");
      setSaving(false);
      return;
    }

    const { error: deviceError } = await supabase
      .from("devices")
      .update({
        make: selectedItem.make,
        model: selectedItem.model,
        serial_number: selectedItem.serial_number || device.serial_number,
        purchase_cost: selectedItem.purchase_cost,
        purchase_date: selectedItem.purchase_date,
        warranty_period_months: selectedItem.warranty_period_months,
        supplier: selectedItem.seller,
        inventory_status: "assigned",
        inventory_notes: selectedItem.notes,
      })
      .eq("id", device.id);

    if (deviceError) {
      console.error("Update linked device error:", deviceError);
      showAdminNotification(
        "warning",
        "Inventory was linked, but some device details could not be copied.",
      );
    } else {
      showAdminNotification("success", `Linked to existing device ${device.device_code}.`);
    }

    await loadInventory();
    await loadEvents(selectedItem.id);
    setSaving(false);
  };

  return (
    <div className="admin-inventory-page">
      <div className="admin-page-header admin-inventory-header">
        <div>
          <h1 className="admin-title">Inventory</h1>
          <p className="admin-subtitle">
            Add Android boxes to stock, track warranty and seller details,
            allocate hardware to customers, and manage returns or defects.
          </p>
        </div>
        <div className="admin-inventory-header-actions">
          <button type="button" className="admin-button-primary" onClick={startAddItem}>
            Add stock item
          </button>
          <Link href="/admin/devices" className="admin-button-secondary">
            Device manager
          </Link>
        </div>
      </div>

      <section className="admin-inventory-kpis">
        <InventoryKpi label="Ready stock" value={stockSummary.ready} tone="success" />
        <InventoryKpi label="Allocated / shipped" value={stockSummary.allocated} tone="info" />
        <InventoryKpi label="Needs attention" value={stockSummary.attention} tone="danger" />
        <InventoryKpi label="Warranty soon" value={stockSummary.warrantySoon} tone="warning" />
      </section>

      <section className="admin-card p-6">
        {schemaWarning && (
          <div className="admin-inventory-warning" role="status">
            <strong>Database setup needed</strong>
            <p>{schemaWarning}</p>
            <code>supabase/migrations/202606070000_inventory_management.sql</code>
          </div>
        )}
        <div className="admin-inventory-toolbar">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search serial, item code, seller, customer, device code..."
          />
          <div className="admin-inventory-filter-row">
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className={statusFilter === "all" ? "is-active" : ""}
            >
              All ({counts.all})
            </button>
            {statuses.map((status) => (
              <button
                key={status.value}
                type="button"
                onClick={() => setStatusFilter(status.value)}
                className={statusFilter === status.value ? "is-active" : ""}
              >
                {status.label} ({counts[status.value] || 0})
              </button>
            ))}
          </div>
          <div className="admin-inventory-type-row">
            <SelectValue
              label="Type filter"
              value={typeFilter}
              onChange={setTypeFilter}
              options={[{ value: "all", label: "All types" }, ...itemTypes]}
            />
          </div>
        </div>
      </section>

      <div className="admin-inventory-layout">
        <section className="admin-card p-6">
          <div className="admin-inventory-panel-title">
            <div>
              <h2 className="admin-card-title text-xl">Stock items</h2>
              <p className="admin-muted">Select a box to allocate, update, or inspect history.</p>
            </div>
            <span>{filteredItems.length} shown</span>
          </div>

          <div className="admin-inventory-list">
            {loading ? (
              <p className="admin-muted">Loading inventory...</p>
            ) : filteredItems.length === 0 ? (
              <p className="admin-muted">No inventory items found.</p>
            ) : (
              filteredItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  className={`admin-inventory-item ${
                    selectedId === item.id ? "is-active" : ""
                  }`}
                >
                  <div>
                    <span className={`admin-inventory-status admin-inventory-status-${item.status}`}>
                      {statusLabel(item.status)}
                    </span>
                    <h3>{itemTypeLabel(item.item_type)}</h3>
                    <p>
                      {item.make || "Make not set"} {item.model || ""} · Serial{" "}
                      {item.serial_number || "missing"}
                    </p>
                    <p>
                      {item.customers?.name
                        ? `Customer: ${item.customers.name}`
                        : `Purchased: ${formatDate(item.purchase_date)}`}
                    </p>
                  </div>
                  <strong>{item.item_code}</strong>
                </button>
              ))
            )}
          </div>
        </section>

        <section className="admin-inventory-side">
          {showForm && (
            <InventoryFormCard
              form={form}
              editingId={editingId}
              saving={saving}
              onCancel={resetForm}
              onSave={saveInventoryItem}
              onChange={updateForm}
            />
          )}

          {selectedItem && (
            <section className="admin-card p-6">
              <div className="admin-inventory-panel-title">
                <div>
                  <h2 className="admin-card-title text-xl">{selectedItem.item_code}</h2>
                  <p className="admin-muted">
                    {itemTypeLabel(selectedItem.item_type)} · {statusLabel(selectedItem.status)}
                  </p>
                </div>
                <button type="button" className="admin-button-secondary" onClick={() => editItem(selectedItem)}>
                  Edit details
                </button>
              </div>

              <div className="admin-inventory-detail-grid">
                <InfoTile label="Serial number" value={selectedItem.serial_number || "Missing"} />
                <InfoTile label="Seller" value={selectedItem.seller || "Not set"} />
                <InfoTile label="Warranty until" value={formatDate(selectedItem.warranty_until)} />
                <InfoTile label="Condition" value={conditionLabel(selectedItem.condition)} />
                <InfoTile label="Customer" value={selectedItem.customers?.name || "Not assigned"} />
                <InfoTile
                  label="Device"
                  value={selectedItem.devices?.device_code || "Not created"}
                  href={selectedItem.devices?.device_code ? `/admin/devices/${selectedItem.devices.device_code}` : undefined}
                />
              </div>

              <div className="admin-inventory-allocation">
                <h3>Allocate box to customer</h3>
                <p>
                  Use this after the customer has paid and you are configuring
                  the physical box. The system creates the matching Device
                  Manager record automatically.
                </p>
                <SelectValue
                  label="Customer"
                  value={allocationCustomerId}
                  onChange={setAllocationCustomerId}
                  options={[
                    { value: "", label: "Select customer" },
                    ...customers.map((customer) => ({
                      value: customer.id,
                      label: customer.email
                        ? `${customer.name} (${customer.email})`
                        : customer.name,
                    })),
                  ]}
                />
                <TextValue
                  label="Customer screen location"
                  value={allocationLocation}
                  onChange={setAllocationLocation}
                  placeholder="Reception, entrance, menu board..."
                />
                <button
                  type="button"
                  className="admin-button-primary"
                  disabled={saving || Boolean(selectedItem.device_id)}
                  onClick={allocateSelectedItem}
                >
                  {selectedItem.device_id ? "Already allocated" : "Allocate and create device"}
                </button>

                {!selectedItem.device_id && (
                  <div className="admin-inventory-existing-device">
                    <p>
                      Already configured the screen in Device Manager? Link this
                      inventory item to that existing device instead.
                    </p>
                    <SelectValue
                      label="Existing device"
                      value={existingDeviceId}
                      onChange={setExistingDeviceId}
                      options={[
                        { value: "", label: "Select existing device" },
                        ...linkableDevices.map((device) => ({
                          value: device.id,
                          label: `${device.device_code} - ${
                            device.name || device.customers?.name || "Unnamed device"
                          }`,
                        })),
                      ]}
                    />
                    <button
                      type="button"
                      className="admin-button-secondary"
                      disabled={saving || !existingDeviceId}
                      onClick={linkExistingDevice}
                    >
                      Link existing device
                    </button>
                  </div>
                )}
              </div>

              <div className="admin-inventory-actions">
                <div className="admin-inventory-action-group">
                  <h3>Shipping</h3>
                  <button
                    type="button"
                    className="admin-button-primary"
                    disabled={saving}
                    onClick={() => updateItemStatus(selectedItem, "shipped", selectedItem.condition)}
                  >
                    Mark shipped
                  </button>
                </div>
                <div className="admin-inventory-action-group">
                  <h3>Returns</h3>
                  <button
                    type="button"
                    className="admin-button-warning"
                    disabled={saving}
                    onClick={() =>
                      updateItemStatus(selectedItem, "returned", "returned", {
                        customer_id: null,
                        return_notes: selectedItem.return_notes || "Returned from customer.",
                      })
                    }
                  >
                    Mark returned
                  </button>
                </div>
                <div className="admin-inventory-action-group">
                  <h3>Service</h3>
                  <button
                    type="button"
                    className="admin-button-danger"
                    disabled={saving}
                    onClick={() =>
                      updateItemStatus(selectedItem, "defective", "defective", {
                        defect_description:
                          selectedItem.defect_description || "Needs diagnosis.",
                      })
                    }
                  >
                    Mark defective
                  </button>
                  <button
                    type="button"
                    className="admin-button-secondary"
                    disabled={saving}
                    onClick={() => updateItemStatus(selectedItem, "in_repair", "defective")}
                  >
                    Send to repair
                  </button>
                  <button
                    type="button"
                    className="admin-button-success"
                    disabled={saving}
                    onClick={() => updateItemStatus(selectedItem, "in_stock", "repaired")}
                  >
                    Back to stock
                  </button>
                </div>
                <div className="admin-inventory-action-group">
                  <h3>Lifecycle</h3>
                  <button
                    type="button"
                    className="admin-button-secondary"
                    disabled={saving}
                    onClick={() => updateItemStatus(selectedItem, "retired", selectedItem.condition)}
                  >
                    Retire
                  </button>
                </div>
              </div>

              {(selectedItem.defect_description || selectedItem.return_notes || selectedItem.notes) && (
                <div className="admin-inventory-notes">
                  {selectedItem.defect_description && (
                    <p>
                      <strong>Defect:</strong> {selectedItem.defect_description}
                    </p>
                  )}
                  {selectedItem.return_notes && (
                    <p>
                      <strong>Return:</strong> {selectedItem.return_notes}
                    </p>
                  )}
                  {selectedItem.notes && (
                    <p>
                      <strong>Notes:</strong> {selectedItem.notes}
                    </p>
                  )}
                </div>
              )}
            </section>
          )}

          {selectedItem && (
            <section className="admin-card p-6">
              <h2 className="admin-card-title text-xl">Inventory history</h2>
              <div className="admin-inventory-events">
                {events.length === 0 ? (
                  <p className="admin-muted">No events yet.</p>
                ) : (
                  events.map((event) => (
                    <article key={event.id}>
                      <span>{new Date(event.created_at).toLocaleString("sv-SE")}</span>
                      <strong>{event.event_type.replace(/_/g, " ")}</strong>
                      <p>
                        {event.from_status ? `${statusLabel(event.from_status)} -> ` : ""}
                        {event.to_status ? statusLabel(event.to_status) : "No status change"}
                      </p>
                      {event.notes && <p>{event.notes}</p>}
                    </article>
                  ))
                )}
              </div>
            </section>
          )}
        </section>
      </div>
    </div>
  );
}

function InventoryFormCard({
  form,
  editingId,
  saving,
  onCancel,
  onSave,
  onChange,
}: {
  form: InventoryForm;
  editingId: string | null;
  saving: boolean;
  onCancel: () => void;
  onSave: () => void;
  onChange: (field: keyof InventoryForm, value: string) => void;
}) {
  return (
    <section className="admin-card p-6">
      <div className="admin-inventory-panel-title">
        <div>
          <h2 className="admin-card-title text-xl">
            {editingId ? "Edit stock item" : "Add Android box to stock"}
          </h2>
          <p className="admin-muted">
            Keep serial, warranty, seller, and defect details in one place.
          </p>
        </div>
      </div>

      <div className="admin-inventory-form-sections">
        <fieldset>
          <legend>Box identity</legend>
          <div className="admin-inventory-form-grid">
            <SelectValue label="Package type" value={form.item_type} onChange={(value) => onChange("item_type", value)} options={itemTypes} />
            <TextValue label="Serial number *" value={form.serial_number} onChange={(value) => onChange("serial_number", value)} />
            <TextValue label="Make" value={form.make} onChange={(value) => onChange("make", value)} />
            <TextValue label="Model" value={form.model} onChange={(value) => onChange("model", value)} />
          </div>
        </fieldset>

        <fieldset>
          <legend>Stock status</legend>
          <div className="admin-inventory-form-grid">
            <SelectValue label="Status" value={form.status} onChange={(value) => onChange("status", value)} options={statuses} />
            <SelectValue label="Condition" value={form.condition} onChange={(value) => onChange("condition", value)} options={conditions} />
          </div>
        </fieldset>

        <fieldset>
          <legend>Purchase & warranty</legend>
          <div className="admin-inventory-form-grid">
            <TextValue label="Seller" value={form.seller} onChange={(value) => onChange("seller", value)} />
            <TextValue label="Purchase cost" type="number" value={form.purchase_cost} onChange={(value) => onChange("purchase_cost", value)} />
            <TextValue label="Purchased date" type="date" value={form.purchase_date} onChange={(value) => onChange("purchase_date", value)} />
            <TextValue label="Invoice number" value={form.invoice_number} onChange={(value) => onChange("invoice_number", value)} />
            <TextValue label="Warranty months" type="number" value={form.warranty_period_months} onChange={(value) => onChange("warranty_period_months", value)} />
            <TextValue label="Warranty until" type="date" value={form.warranty_until} onChange={(value) => onChange("warranty_until", value)} />
          </div>
        </fieldset>

        <fieldset>
          <legend>Service notes</legend>
          <TextAreaValue label="Defect description" value={form.defect_description} onChange={(value) => onChange("defect_description", value)} />
          <TextAreaValue label="Return notes" value={form.return_notes} onChange={(value) => onChange("return_notes", value)} />
          <TextAreaValue label="Internal notes" value={form.notes} onChange={(value) => onChange("notes", value)} />
        </fieldset>
      </div>

      <div className="admin-inventory-form-actions">
        <button type="button" className="admin-button-primary" disabled={saving} onClick={onSave}>
          {saving ? "Saving..." : editingId ? "Save changes" : "Add to stock"}
        </button>
        <button type="button" className="admin-button-secondary" onClick={onCancel}>
          {editingId ? "Cancel edit" : "Close form"}
        </button>
      </div>
    </section>
  );
}

function InventoryKpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "success" | "info" | "danger" | "warning";
}) {
  return (
    <article className={`admin-inventory-kpi admin-inventory-kpi-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function InfoTile({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href?: string;
}) {
  const content = (
    <>
      <span>{label}</span>
      <strong>{value}</strong>
    </>
  );

  if (href) {
    return (
      <Link href={href} className="admin-inventory-info-tile">
        {content}
      </Link>
    );
  }

  return <div className="admin-inventory-info-tile">{content}</div>;
}

function TextValue({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="admin-inventory-field">
      <span>{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function TextAreaValue({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="admin-inventory-field admin-inventory-field-wide">
      <span>{label}</span>
      <textarea value={value} rows={3} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function SelectValue({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="admin-inventory-field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function itemTypeLabel(value: string) {
  return itemTypes.find((item) => item.value === value)?.label || value;
}

function statusLabel(value: string) {
  return statuses.find((status) => status.value === value)?.label || value;
}

function conditionLabel(value: string) {
  return conditions.find((condition) => condition.value === value)?.label || value;
}

function formatDate(value: string | null) {
  if (!value) return "Not set";
  return new Date(value).toLocaleDateString("sv-SE");
}
