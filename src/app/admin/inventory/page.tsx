"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { showAdminNotification } from "@/lib/admin/notifications";
import {
  conditions,
  conditionLabel,
  createEmptyForm,
  formatDate,
  inventoryOperations,
  itemTypeLabel,
  itemTypes,
  statusLabel,
  statuses,
} from "./inventory-utils";
import type {
  InventoryEvent,
  InventoryForm,
  InventoryItem,
  InventoryOperationDraft,
  InventorySelectOption,
} from "./types";

export default function AdminInventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [events, setEvents] = useState<InventoryEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [schemaWarning, setSchemaWarning] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [modelFilter, setModelFilter] = useState("all");
  const [sortBy, setSortBy] = useState("updated_desc");
  const [form, setForm] = useState<InventoryForm>(() => createEmptyForm());
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [operationDraft, setOperationDraft] =
    useState<InventoryOperationDraft | null>(null);
  const [nowMs] = useState(() => Date.now());

  const selectedItem = items.find((item) => item.id === selectedId) || null;

  const loadInventory = useCallback(async () => {
    setLoading(true);

    const { data: itemData, error: itemError } = await supabase
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
      .order("created_at", { ascending: false });

    if (itemError) {
      if (itemError.code === "PGRST205") {
        setSchemaWarning(
          "Hardware stock is not ready in the database yet. Ask the developer to apply the inventory setup before adding boxes.",
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

    setLoading(false);
  }, [selectedId]);

  const loadEvents = useCallback(async (itemId: string | null) => {
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
  }, []);

  useEffect(() => {
    loadInventory();
  }, [loadInventory]);

  useEffect(() => {
    loadEvents(selectedId);
  }, [loadEvents, selectedId]);

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
      const matchesModel = modelFilter === "all" || (item.model || "") === modelFilter;

      return (
        matchesStatus &&
        matchesType &&
        matchesModel &&
        (!normalizedQuery || haystack.includes(normalizedQuery))
      );
    }).sort((left, right) => {
      if (sortBy === "code_asc") return left.item_code.localeCompare(right.item_code, "sv");
      if (sortBy === "model_asc") return (left.model || "").localeCompare(right.model || "", "sv");
      if (sortBy === "status") return left.status.localeCompare(right.status, "sv");
      return Date.parse(right.updated_at || right.created_at) - Date.parse(left.updated_at || left.created_at);
    });
  }, [items, modelFilter, query, sortBy, statusFilter, typeFilter]);

  const modelOptions = useMemo(
    () =>
      Array.from(
        new Set(items.map((item) => (item.model || "").trim()).filter(Boolean)),
      ).sort((a, b) => a.localeCompare(b)),
    [items],
  );

  const stockSummary = {
    ready: items.filter((item) => item.status === "in_stock").length,
    allocated: items.filter((item) => ["assigned", "shipped"].includes(item.status)).length,
    attention: items.filter((item) => ["defective", "in_repair", "lost"].includes(item.status)).length,
    warrantySoon: items.filter((item) => {
      if (!item.warranty_until) return false;
      const diff = new Date(item.warranty_until).getTime() - nowMs;
      return diff > 0 && diff <= 1000 * 60 * 60 * 24 * 60;
    }).length,
  };
  const stockWorkflow = [
    {
      stage: "1",
      label: "Register purchase",
      value: counts.all,
      description: "Add each Android box with serial, seller, invoice, and warranty.",
    },
    {
      stage: "2",
      label: "Prepare stock",
      value: stockSummary.ready,
      description: "Keep tested hardware ready for customer assignment.",
    },
    {
      stage: "3",
      label: "Allocate from customer",
      value: stockSummary.allocated,
      description: "Reserve hardware from the customer profile after onboarding.",
    },
    {
      stage: "4",
      label: "Service lifecycle",
      value: stockSummary.attention,
      description: "Track shipped, returned, defective, repair, lost, and retired boxes.",
    },
  ];

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
      reason: "",
    });
  };

  const saveInventoryItem = async () => {
    if (!form.serial_number.trim()) {
      showAdminNotification("warning", "Serial number is required.");
      return;
    }

    const reason = form.reason.trim();
    if (!reason) {
      showAdminNotification("warning", "Add an audit reason before saving.");
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

    const response = await fetch(
      editingId ? `/api/admin/inventory/${editingId}` : "/api/admin/inventory",
      {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, reason }),
      },
    );
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      showAdminNotification(
        "error",
        result.error || "Could not save stock item.",
      );
      setSaving(false);
      return;
    }

    showAdminNotification("success", editingId ? "Stock item updated." : "Stock item added.");
    resetForm();
    await loadInventory();
    setSaving(false);
  };

  const updateItemStatus = async (
    item: InventoryItem,
    status: string,
    condition: string,
    reason: string,
    extra: Partial<InventoryItem> = {},
  ) => {
    setSaving(true);
    const timestamp = new Date().toISOString();
    const payload: Record<string, string | number | boolean | null> = {
      action: "update_status",
      status,
      condition,
      reason,
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
    const response = await fetch(`/api/admin/inventory/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      showAdminNotification(
        "error",
        result.error || "Could not update inventory item.",
      );
      setSaving(false);
      return;
    }

    showAdminNotification("success", "Hardware stock status updated.");
    setOperationDraft(null);
    await loadInventory();
    await loadEvents(item.id);
    setSaving(false);
  };

  const submitInventoryOperation = async () => {
    if (!selectedItem || !operationDraft) return;
    const reason = operationDraft.reason.trim();

    if (!reason) {
      showAdminNotification("warning", "Add a reason before saving this inventory operation.");
      return;
    }

    if (!operationDraft.confirmed) {
      showAdminNotification("warning", "Confirm the inventory operation before saving.");
      return;
    }

    const operation = inventoryOperations.find(
      (item) => item.id === operationDraft.operation,
    );
    if (!operation) return;

    const extra: Partial<InventoryItem> = {};
    if (operation.id === "returned") {
      extra.customer_id = null;
      extra.return_notes =
        selectedItem.return_notes || "Returned from customer.";
    }
    if (operation.id === "defective") {
      extra.defect_description =
        selectedItem.defect_description || "Needs diagnosis.";
    }

    await updateItemStatus(
      selectedItem,
      operation.status,
      operation.id === "shipped" || operation.id === "retired"
        ? selectedItem.condition
        : operation.condition,
      reason,
      extra,
    );
  };

  return (
    <div className="admin-inventory-page">
      <div className="admin-page-header admin-inventory-header">
        <div>
          <h1 className="admin-title">Hardware stock</h1>
          <p className="admin-subtitle">
            Add physical hardware to stock, track serial numbers, warranty,
            seller details, returns, defects, repair, and retirement.
          </p>
        </div>
        <div className="admin-inventory-header-actions">
          <button type="button" className="admin-button-primary" onClick={startAddItem}>
            Add stock item
          </button>
          <Link href="/admin/devices" className="admin-button-secondary">
            Displays
          </Link>
        </div>
      </div>

      <section className="admin-inventory-kpis">
        <InventoryKpi label="Ready stock" value={stockSummary.ready} tone="success" />
        <InventoryKpi label="Allocated / shipped" value={stockSummary.allocated} tone="info" />
        <InventoryKpi label="Needs attention" value={stockSummary.attention} tone="danger" />
        <InventoryKpi label="Warranty soon" value={stockSummary.warrantySoon} tone="warning" />
      </section>

      <section className="admin-card admin-inventory-workflow" aria-label="Hardware stock workflow">
        {stockWorkflow.map((item) => (
          <div key={item.stage} className="admin-inventory-workflow-step">
            <span>{item.stage}</span>
            <strong>
              {item.label}
              <em>{item.value}</em>
            </strong>
            <small>{item.description}</small>
          </div>
        ))}
      </section>

      <section className="admin-card p-6">
        {schemaWarning && (
          <div className="admin-inventory-warning" role="status">
            <strong>Hardware stock setup needed</strong>
            <p>{schemaWarning}</p>
          </div>
        )}
        <div className="admin-inventory-toolbar">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search serial, item code, seller, customer, display code..."
          />
          <div className="admin-inventory-type-row">
            <SelectValue
              label="Status filter"
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: "all", label: `All (${counts.all})` },
                ...statuses.map((status) => ({
                  value: status.value,
                  label: `${status.label} (${counts[status.value] || 0})`,
                })),
              ]}
            />
            <SelectValue
              label="Type filter"
              value={typeFilter}
              onChange={setTypeFilter}
              options={[{ value: "all", label: "All types" }, ...itemTypes]}
            />
            <SelectValue
              label="Model filter"
              value={modelFilter}
              onChange={setModelFilter}
              options={[
                { value: "all", label: "All models" },
                ...modelOptions.map((model) => ({
                  value: model,
                  label: model,
                })),
              ]}
            />
            <SelectValue
              label="Sort by"
              value={sortBy}
              onChange={setSortBy}
              options={[
                { value: "updated_desc", label: "Recently updated" },
                { value: "code_asc", label: "Item code" },
                { value: "model_asc", label: "Model" },
                { value: "status", label: "Status" },
              ]}
            />
          </div>
        </div>
      </section>

      <div className="admin-inventory-layout">
        <section className="admin-card p-6">
          <div className="admin-inventory-panel-title">
            <div>
              <h2 className="admin-card-title text-xl">Stock items</h2>
              <p className="admin-muted">
                Select a box to update physical status or inspect hardware history.
                Assign stock from the customer profile after onboarding.
              </p>
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
                  className={
                    selectedId === item.id
                      ? "admin-inventory-item admin-inventory-item-active"
                      : "admin-inventory-item"
                  }
                >
                  <div>
                    <span className={`admin-inventory-status admin-inventory-status-${item.status}`}>
                      {statusLabel(item.status)}
                    </span>
                    <h3>{itemTypeLabel(item.item_type)}</h3>
                    <p>
                      {item.make || "Make not set"} {item.model || ""} - Serial{" "}
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
                    {itemTypeLabel(selectedItem.item_type)} - {statusLabel(selectedItem.status)}
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
                  label="Display"
                  value={selectedItem.devices?.device_code || "Not created"}
                  href={selectedItem.devices?.device_code ? `/admin/devices/${selectedItem.devices.device_code}` : undefined}
                />
              </div>

              <div className="admin-inventory-allocation">
                <h3>Hardware stock ownership</h3>
                <p>
                  Hardware stock is the physical stock ledger: purchase details, serial
                  numbers, warranty, condition, returns, repair, and retirement.
                  Customer assignment is handled from the customer profile so
                  Screenia can compare allocated devices with the paid subscription.
                </p>
                {selectedItem.customer_id ? (
                  <a
                    href={`/admin/customers/${selectedItem.customer_id}?section=devices`}
                    className="admin-button-secondary"
                  >
                    Open customer device allocation
                  </a>
                ) : (
                  <p className="admin-muted">
                    To assign this stock item, open the customer profile after
                    onboarding and use the Device allocation tab.
                  </p>
                )}
              </div>

              <div className="admin-inventory-actions">
                <div className="admin-operation-panel admin-inventory-operation-panel">
                  <div className="admin-operation-header">
                    <div>
                      <p className="admin-operation-kicker">Stock ledger action</p>
                      <h3>Physical stock lifecycle</h3>
                      <p>
                        Use this panel only for the physical box: shipping,
                        returns, defects, repair, and retirement. Customer
                        assignment starts from the customer Device allocation tab.
                      </p>
                    </div>
                    <div className="admin-operation-summary">
                      <span>Current status</span>
                      <strong>{statusLabel(selectedItem.status)}</strong>
                    </div>
                  </div>

                  <div className="admin-operation-grid">
                    <div className="admin-operation-list">
                      <p className="admin-operation-list-note">
                        Choose the audited stock event that matches what has
                        happened to the physical device.
                      </p>
                      {inventoryOperations.map((operation) => (
                        <button
                          key={operation.id}
                          type="button"
                          className={`admin-operation-card ${
                            operation.tone
                              ? `admin-operation-${operation.tone}`
                              : ""
                          } ${
                            operationDraft?.operation === operation.id
                              ? "is-selected"
                              : ""
                          }`}
                          disabled={saving}
                          onClick={() =>
                            setOperationDraft({
                              operation: operation.id,
                              reason: "",
                              confirmed: false,
                            })
                          }
                        >
                          <span>
                            <strong>{operation.label}</strong>
                            <small>{operation.description}</small>
                          </span>
                          <em>
                            {operationDraft?.operation === operation.id
                              ? "Open"
                              : "Choose"}
                          </em>
                        </button>
                      ))}
                    </div>

                    {operationDraft ? (
                      <div className="admin-operation-flow">
                        <div className="admin-operation-flow-header">
                          <p className="admin-operation-kicker">Selected operation</p>
                          <h4>
                            {
                              inventoryOperations.find(
                                (operation) =>
                                  operation.id === operationDraft.operation,
                              )?.label
                            }
                          </h4>
                          <p>
                            This updates the stock ledger and writes an
                            inventory history event with timestamp and reason.
                          </p>
                        </div>

                        <label className="admin-operation-reason">
                          Reason for audit log
                          <textarea
                            value={operationDraft.reason}
                            disabled={saving}
                            onChange={(event) =>
                              setOperationDraft((current) =>
                                current
                                  ? {
                                      ...current,
                                      reason: event.target.value,
                                      confirmed: false,
                                    }
                                  : current,
                              )
                            }
                            placeholder="Example: Box tested successfully and packed for delivery."
                          />
                        </label>

                        <label className="admin-operation-confirm">
                          <input
                            type="checkbox"
                            checked={operationDraft.confirmed}
                            disabled={saving}
                            onChange={(event) =>
                              setOperationDraft((current) =>
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
                            I checked this stock item and want to save this
                            audited inventory operation.
                          </span>
                        </label>

                        <div className="admin-operation-actions">
                          <button
                            type="button"
                            className="admin-button-primary"
                            disabled={saving}
                            onClick={submitInventoryOperation}
                          >
                            {saving ? "Saving..." : "Save operation"}
                          </button>
                          <button
                            type="button"
                            className="admin-button-secondary"
                            disabled={saving}
                            onClick={() => setOperationDraft(null)}
                          >
                            Close
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="admin-operation-empty">
                        <p>
                          Select an operation to see the required reason and
                          confirmation before changing this stock item.
                        </p>
                      </div>
                    )}
                  </div>
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
              <h2 className="admin-card-title text-xl">Hardware stock history</h2>
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

        <fieldset>
          <legend>Audit reason</legend>
          <TextAreaValue
            label={editingId ? "Reason for updating" : "Reason for adding"}
            value={form.reason}
            onChange={(value) => onChange("reason", value)}
            placeholder={
              editingId
                ? "Example: Warranty date corrected from purchase invoice."
                : "Example: New Android box purchased for launch stock."
            }
          />
        </fieldset>
      </div>

      <div className="admin-inventory-form-actions">
        <button
          type="button"
          className="admin-button-primary"
          disabled={saving || !form.reason.trim()}
          onClick={onSave}
        >
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
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="admin-inventory-field admin-inventory-field-wide">
      <span>{label}</span>
      <textarea
        value={value}
        rows={3}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
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
  options: InventorySelectOption[];
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
