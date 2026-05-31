"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { showAdminNotification } from "@/lib/admin/notifications";
import { PRICING_PLANS } from "@/lib/pricing/plans";

type Customer = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  contact_person: string | null;
  organisation_number: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  notes: string | null;
  status: string | null;
  onboarding_token: string | null;
  onboarding_token_expires_at: string | null;
  terms_accepted_at: string | null;
  privacy_accepted_at: string | null;
  marketing_consent: boolean | null;
  payment_status: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  activated_at: string | null;
  inactive_reason: string | null;
  cancelled_at: string | null;
  cancellation_source: string | null;
};

type Device = {
  id: string;
  name: string | null;
  device_code: string;
};

type CustomerSubscription = {
  id: string;
  order_number: string | null;
  status: string;
  setup_fee_sek: number | null;
  hardware_fee_sek: number | null;
  shipping_fee_sek: number | null;
  monthly_fee_sek: number | null;
  tax_amount_sek: number | null;
  total_amount_sek: number | null;
  tax_status: string | null;
  fulfillment_status: string | null;
  inventory_status: string | null;
  stripe_checkout_session_id: string | null;
  stripe_subscription_id: string | null;
  screen_quantity: number | null;
  device_discount_percent: number | null;
  device_discount_months: number | null;
  device_discount_amount_sek: number | null;
  monthly_discount_amount_sek: number | null;
  created_at: string;
};

type PricingPlan = {
  id: string;
  code: string;
  name: string;
  resolution: string;
  setup_fee_sek: number;
  hardware_fee_sek: number | null;
  shipping_fee_sek: number | null;
  monthly_fee_sek: number;
  trial_days: number;
  currency: string | null;
};

type QuoteItem = {
  id: string;
  pricingPlanCode: string;
  quantity: number;
};

type CustomerMessage = {
  id: string;
  subject: string | null;
  message: string;
  status: string;
  createdAt: string;
  files: Array<{
    id: string;
    fileName: string;
    contentType: string;
    fileSize: number;
    downloadUrl: string | null;
  }>;
};

type CustomerAsset = {
  id: string;
  fileName: string | null;
  contentType: string | null;
  fileSize: number | null;
  category: string;
  description: string | null;
  source: string;
  status: string;
  createdAt: string;
  downloadUrl: string | null;
};

type CustomerDetailSection =
  | "overview"
  | "onboarding"
  | "communication"
  | "orders"
  | "devices";

type CommunicationView = "messages" | "uploads";

export default function CustomerDetailPage({
  params,
}: {
  params: Promise<{ customerId: string }>;
}) {
  const { customerId } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [subscriptions, setSubscriptions] = useState<CustomerSubscription[]>([]);
  const [pricingPlans, setPricingPlans] = useState<PricingPlan[]>([]);
  const [messages, setMessages] = useState<CustomerMessage[]>([]);
  const [assets, setAssets] = useState<CustomerAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editName, setEditName] = useState("");
  const [editContactPerson, setEditContactPerson] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editCountry, setEditCountry] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [activeSection, setActiveSection] =
    useState<CustomerDetailSection>("overview");
  const [communicationView, setCommunicationView] =
    useState<CommunicationView>("messages");
  const [quotePlanCode, setQuotePlanCode] = useState("");
  const [quoteNotes, setQuoteNotes] = useState("");
  const [quoteResultUrl, setQuoteResultUrl] = useState("");
  const [quoteItems, setQuoteItems] = useState<QuoteItem[]>([
    { id: "quote-item-1", pricingPlanCode: "", quantity: 1 },
  ]);
  const [quoteDiscountPercent, setQuoteDiscountPercent] = useState(0);
  const [quoteDiscountMonths, setQuoteDiscountMonths] = useState(0);
  const [schemaNotice, setSchemaNotice] = useState("");

  const formatInactiveReason = (reason: string | null) => {
    if (reason === "manual_suspend") return "Manually suspended";
    if (reason === "payment_failed") return "Payment failed";
    if (reason === "subscription_cancelled") return "Subscription cancelled";
    if (reason === "customer_cancelled") return "Cancelled by customer";
    return "None";
  };

  const formatCancellationSource = (source: string | null) => {
    if (source === "admin") return "Admin";
    if (source === "customer") return "Customer";
    if (source === "stripe") return "Stripe";
    return "None";
  };

  const getStatusClass = (status: string | null) => {
    if (status === "active") return "bg-green-100 text-green-700";
    if (status === "invited") return "bg-blue-100 text-blue-700";
    if (status === "suspended") return "bg-red-100 text-red-700";
    if (status === "completed_profile") return "bg-purple-100 text-purple-700";
    if (status === "accepted_terms") return "bg-yellow-100 text-yellow-700";
    return "bg-slate-100 text-slate-700";
  };

  const loadData = async () => {
    setLoading(true);
    setSchemaNotice("");

    const { data: customerData, error: customerError } = await supabase
      .from("customers")
      .select(
        `
        id,
        name,
        email,
        phone,
        contact_person,
        organisation_number,
        address,
        city,
        country,
        notes,
        status,
        onboarding_token,
        onboarding_token_expires_at,
        terms_accepted_at,
        privacy_accepted_at,
        marketing_consent,
        payment_status,
        stripe_customer_id,
        stripe_subscription_id,
        activated_at,
        inactive_reason,
        cancelled_at,
        cancellation_source
      `,
      )
      .eq("id", customerId)
      .single();

    if (customerError || !customerData) {
      console.error("Customer error:", customerError);
      setCustomer(null);
      setDevices([]);
      setSubscriptions([]);
      setMessages([]);
      setAssets([]);
      setLoading(false);
      return;
    }

    const loadedCustomer = customerData as Customer;

    setCustomer(loadedCustomer);
    setEditName(loadedCustomer.name || "");
    setEditContactPerson(loadedCustomer.contact_person || "");
    setEditPhone(loadedCustomer.phone || "");
    setEditAddress(loadedCustomer.address || "");
    setEditCity(loadedCustomer.city || "");
    setEditCountry(loadedCustomer.country || "");
    setEditNotes(loadedCustomer.notes || "");

    const { data: devicesData, error: devicesError } = await supabase
      .from("devices")
      .select("id, name, device_code")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false });

    if (devicesError) {
      console.error("Devices error:", devicesError);
      setDevices([]);
    } else {
      setDevices(devicesData || []);
    }

    const { data: subscriptionData, error: subscriptionError } =
      await supabase
        .from("customer_subscriptions")
        .select(
          `
          id,
          order_number,
          status,
          setup_fee_sek,
          hardware_fee_sek,
          shipping_fee_sek,
          monthly_fee_sek,
          tax_amount_sek,
          total_amount_sek,
          tax_status,
          fulfillment_status,
          inventory_status,
          stripe_checkout_session_id,
          stripe_subscription_id,
          screen_quantity,
          device_discount_percent,
          device_discount_months,
          device_discount_amount_sek,
          monthly_discount_amount_sek,
          created_at
        `,
        )
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false });

    if (subscriptionError) {
      if (subscriptionError.code === "42703") {
        setSchemaNotice(
          "The database is missing the latest order columns. Apply the latest Supabase migrations before sending quotes or taking payments.",
        );
      } else {
        console.warn("Subscriptions could not be loaded.", subscriptionError);
      }
      const { data: fallbackSubscriptions } = await supabase
        .from("customer_subscriptions")
        .select("id, status, stripe_checkout_session_id, stripe_subscription_id, created_at")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false });

      setSubscriptions(
        (fallbackSubscriptions || []).map((subscription) => ({
          id: subscription.id,
          order_number: null,
          status: subscription.status,
          setup_fee_sek: null,
          hardware_fee_sek: null,
          shipping_fee_sek: null,
          monthly_fee_sek: null,
          tax_amount_sek: null,
          total_amount_sek: null,
          tax_status: null,
          fulfillment_status: null,
          inventory_status: null,
          stripe_checkout_session_id: subscription.stripe_checkout_session_id,
          stripe_subscription_id: subscription.stripe_subscription_id,
          screen_quantity: 1,
          device_discount_percent: 0,
          device_discount_months: 0,
          device_discount_amount_sek: 0,
          monthly_discount_amount_sek: 0,
          created_at: subscription.created_at,
        })),
      );
    } else {
      setSubscriptions((subscriptionData || []) as CustomerSubscription[]);
    }

    const { data: pricingData, error: pricingError } = await supabase
      .from("pricing_plans")
      .select(
        "id, code, name, resolution, setup_fee_sek, hardware_fee_sek, shipping_fee_sek, monthly_fee_sek, trial_days, currency",
      )
      .eq("is_active", true)
      .order("monthly_fee_sek", { ascending: true });

    if (pricingError) {
      if (pricingError.code === "42703") {
        setSchemaNotice(
          "The database is missing the latest pricing/order columns. Apply the latest Supabase migrations before sending quotes or taking payments.",
        );
      } else {
        console.warn("Pricing plans could not be loaded.", pricingError);
      }
      const fallbackPlans = PRICING_PLANS.map((plan) => ({
        id: plan.code,
        code: plan.code,
        name: plan.name,
        resolution: plan.resolution,
        setup_fee_sek: plan.setupFeeSek,
        hardware_fee_sek: plan.hardwareFeeSek,
        shipping_fee_sek: plan.shippingFeeSek,
        monthly_fee_sek: plan.monthlyFeeSek,
        trial_days: plan.trialDays,
        currency: "sek",
      }));
      setPricingPlans(fallbackPlans);
      setQuotePlanCode((current) => current || fallbackPlans[0]?.code || "");
      setQuoteItems((current) =>
        current.map((item) => ({
          ...item,
          pricingPlanCode:
            item.pricingPlanCode || fallbackPlans[0]?.code || "",
        })),
      );
    } else {
      const plans = (pricingData || []) as PricingPlan[];
      setPricingPlans(plans);
      setQuotePlanCode((current) => current || plans[0]?.code || "");
      setQuoteItems((current) =>
        current.map((item) => ({
          ...item,
          pricingPlanCode: item.pricingPlanCode || plans[0]?.code || "",
        })),
      );
    }

    try {
      const response = await fetch(
        `/api/admin/customer-messages?customerId=${customerId}`,
      );
      const data = await response.json();
      setMessages(response.ok ? data.messages || [] : []);
    } catch (error) {
      console.error("Customer messages error:", error);
      setMessages([]);
    }

    try {
      const response = await fetch(
        `/api/admin/customer-assets?customerId=${customerId}`,
      );
      const data = await response.json();
      setAssets(response.ok ? data.assets || [] : []);
    } catch (error) {
      console.error("Customer assets error:", error);
      setAssets([]);
    }

    setLoading(false);
  };

  const saveCustomerDetails = async () => {
    if (!customer) return;

    if (!editName.trim()) {
      showAdminNotification("warning", "Company name is required.");
      return;
    }

    setSaving(true);

    const { error } = await supabase
      .from("customers")
      .update({
        name: editName.trim(),
        contact_person: editContactPerson.trim() || null,
        phone: editPhone.trim() || null,
        address: editAddress.trim() || null,
        city: editCity.trim() || null,
        country: editCountry.trim() || null,
        notes: editNotes.trim() || null,
      })
      .eq("id", customer.id);

    if (error) {
      console.error("Save customer details error:", error);
      showAdminNotification("error", "Could not save customer details.");
      setSaving(false);
      return;
    }

    await loadData();
    showAdminNotification("success", "Customer details updated.");
    setSaving(false);
  };

  const suspendCustomer = async () => {
    if (!customer) return;
    if (!confirm("Suspend this customer")) return;

    setSaving(true);

    const { error } = await supabase
      .from("customers")
      .update({
        status: "suspended",
        inactive_reason: "manual_suspend",
        cancellation_source: "admin",
      })
      .eq("id", customer.id);

    if (error) {
      console.error("Suspend customer error:", error);
      showAdminNotification("error", "Could not suspend customer.");
      setSaving(false);
      return;
    }

    await loadData();
    showAdminNotification("warning", "Customer suspended.");
    setSaving(false);
  };

  const cancelSubscription = async () => {
    if (!customer) return;

    if (!customer.stripe_subscription_id) {
      showAdminNotification("warning", "No Stripe subscription found.");
      return;
    }

    if (
      !confirm(
        "Cancel this customer's Stripe subscription and suspend the customer",
      )
    ) {
      return;
    }

    setSaving(true);

    const response = await fetch("/api/stripe/cancel-subscription", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        customerId: customer.id,
        subscriptionId: customer.stripe_subscription_id,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Cancel subscription error:", data);
      showAdminNotification(
        "error",
        data.error || "Could not cancel subscription.",
      );
      setSaving(false);
      return;
    }

    await loadData();
    showAdminNotification("success", "Subscription cancelled and customer suspended.");
    setSaving(false);
  };

  const reactivateCustomer = async () => {
    if (!customer) return;
    if (!confirm("Reactivate this customer")) return;

    setSaving(true);

    const { error } = await supabase
      .from("customers")
      .update({
        status: "active",
        inactive_reason: null,
        cancelled_at: null,
        cancellation_source: null,
      })
      .eq("id", customer.id);

    if (error) {
      console.error("Reactivate customer error:", error);
      showAdminNotification("error", "Could not reactivate customer.");
      setSaving(false);
      return;
    }

    await loadData();
    showAdminNotification("success", "Customer reactivated.");
    setSaving(false);
  };

  const prepareQuoteAndOnboarding = async () => {
    if (!customer) return;

    const normalizedQuoteItems = quoteItems
      .map((item) => ({
        pricingPlanCode: item.pricingPlanCode || quotePlanCode,
        quantity: Math.min(50, Math.max(1, Number(item.quantity) || 1)),
      }))
      .filter((item) => item.pricingPlanCode);

    if (normalizedQuoteItems.length === 0) {
      showAdminNotification("warning", "Add at least one screen package.");
      return;
    }

    setSaving(true);
    setQuoteResultUrl("");

    const response = await fetch("/api/admin/prepare-onboarding", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        customerId: customer.id,
        pricingPlanCode: normalizedQuoteItems[0].pricingPlanCode,
        quoteNotes,
        quoteItems: normalizedQuoteItems,
        screenQuantity: normalizedQuoteItems.reduce(
          (sum, item) => sum + item.quantity,
          0,
        ),
        deviceDiscountPercent: quoteDiscountPercent,
        deviceDiscountMonths: quoteDiscountMonths,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Prepare quote and onboarding error:", data);
      showAdminNotification(
        "error",
        data.error || "Could not prepare quote and onboarding.",
      );
      setSaving(false);
      return;
    }

    setQuoteResultUrl(data.onboardingUrl || "");
    setQuoteNotes("");
    await loadData();
    showAdminNotification(
      data.emailSent ? "success" : "warning",
      data.emailSent
        ? `Quote ${data.orderNumber} sent to customer.`
        : data.warning || `Quote ${data.orderNumber} prepared.`,
    );
    setSaving(false);
  };

  const deleteCustomer = async () => {
    if (!customer) return;

    const confirmation = window.prompt(
      `Type DELETE to permanently delete ${customer.name}.`,
    );

    if (confirmation !== "DELETE") return;

    setSaving(true);

    const response = await fetch(`/api/admin/customers/${customer.id}`, {
      method: "DELETE",
    });
    const data = await response.json();

    if (!response.ok) {
      console.error("Delete customer error:", data);
      showAdminNotification(
        "error",
        data.error || "Could not delete customer.",
      );
      setSaving(false);
      return;
    }

    showAdminNotification("success", "Customer deleted.");
    router.push("/admin/customers");
  };

  useEffect(() => {
    loadData();
  }, [customerId]);

  useEffect(() => {
    const section = searchParams.get("section");
    if (
      section === "overview" ||
      section === "onboarding" ||
      section === "communication" ||
      section === "orders" ||
      section === "devices"
    ) {
      setActiveSection(section);
    }
  }, [searchParams]);

  if (loading) {
    return (
      <div className="admin-card p-6">
        <p className="admin-muted">Loading customer...</p>
      </div>
    );
  }

  if (!customer) {
    return (
      <div>
        <div className="admin-page-header">
          <h1 className="admin-title">Customer not found</h1>
          <p className="admin-subtitle">
            This customer could not be found in the database.
          </p>
        </div>

        <Link href="/admin/customers" className="admin-button-primary">
          Back to customers
        </Link>
      </div>
    );
  }

  const detailSections: Array<{
    id: CustomerDetailSection;
    label: string;
    count?: number;
  }> = [
    { id: "overview", label: "Overview" },
    { id: "onboarding", label: "Onboarding" },
    {
      id: "communication",
      label: "Communication",
      count: messages.length + assets.length,
    },
    { id: "orders", label: "Orders", count: subscriptions.length },
    { id: "devices", label: "Devices", count: devices.length },
  ];
  const quoteLines = quoteItems
    .map((item) => {
      const plan =
        pricingPlans.find(
          (pricingPlan) => pricingPlan.code === item.pricingPlanCode,
        ) || pricingPlans[0];
      const quantity = Math.min(50, Math.max(1, Number(item.quantity) || 1));
      const hardwareFee =
        plan?.hardware_fee_sek ?? (plan?.code === "premium_4k" ? 1099 : 699);
      const shippingFee = plan?.shipping_fee_sek ?? 99;

      return {
        ...item,
        plan,
        quantity,
        hardwareFee,
        shippingFee,
        deviceSubtotal: plan ? hardwareFee * quantity : 0,
        shippingSubtotal: plan ? shippingFee * quantity : 0,
        monthlySubtotal: plan ? plan.monthly_fee_sek * quantity : 0,
      };
    })
    .filter((item) => item.plan);
  const primaryQuotePlan = quoteLines[0]?.plan || pricingPlans[0];
  const quoteScreenQuantity = quoteLines.reduce(
    (sum, item) => sum + item.quantity,
    0,
  );
  const quoteDeviceSubtotal = quoteLines.reduce(
    (sum, item) => sum + item.deviceSubtotal,
    0,
  );
  const quoteShippingSubtotal = quoteLines.reduce(
    (sum, item) => sum + item.shippingSubtotal,
    0,
  );
  const quoteMonthlySubtotal = quoteLines.reduce(
    (sum, item) => sum + item.monthlySubtotal,
    0,
  );
  const quoteDeviceDiscountAmount = Math.round(
    quoteDeviceSubtotal * (quoteDiscountPercent / 100),
  );
  const quoteMonthlyDiscountAmount = Math.round(
    quoteMonthlySubtotal * (quoteDiscountPercent / 100),
  );
  const quoteStartupTotal = primaryQuotePlan
    ? primaryQuotePlan.setup_fee_sek +
      quoteDeviceSubtotal -
      quoteDeviceDiscountAmount +
      quoteShippingSubtotal
    : 0;
  const currentOnboardingLink = customer.onboarding_token
    ? `/onboarding/${customer.onboarding_token}`
    : "";

  return (
    <div>
      {/* ==============================
          Page Header
      ============================== */}
      <div className="admin-page-header">
        <Link
          href="/admin/customers"
          className="text-sm font-semibold text-[rgb(8,184,238)] no-underline"
        >
          ← Back to customers
        </Link>

        <div className="mt-4 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <h1 className="admin-title">{customer.name}</h1>
            <p className="admin-subtitle">
              Manage this customer’s onboarding and display screens.
            </p>
          </div>

          <span
            className={`inline-flex w-fit rounded-full px-3 py-1 text-sm font-semibold ${getStatusClass(
              customer.status,
            )}`}
          >
            {customer.status || "draft"}
          </span>
        </div>
      </div>

      <div className="admin-section-tabs" aria-label="Customer detail sections">
        {detailSections.map((section) => (
          <button
            key={section.id}
            type="button"
            onClick={() => setActiveSection(section.id)}
            className={`admin-section-tab ${
              activeSection === section.id ? "is-active" : ""
            }`}
          >
            {section.label}
            {typeof section.count === "number" ? ` (${section.count})` : ""}
          </button>
        ))}
      </div>

      {schemaNotice && (
        <div className="mb-4 rounded-2xl border border-yellow-200 bg-yellow-50 p-4 text-sm font-semibold text-yellow-800">
          {schemaNotice}
        </div>
      )}

      {/* ==============================
          Customer Details
      ============================== */}
      {activeSection === "overview" && (
      <div className="admin-card p-6">
        <h2 className="admin-card-title text-xl">Customer details</h2>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Input
            label="Company name"
            value={editName}
            onChange={setEditName}
            required
          />
          <Input
            label="Contact person"
            value={editContactPerson}
            onChange={setEditContactPerson}
          />
          <Input label="Phone" value={editPhone} onChange={setEditPhone} />
          <Input label="City" value={editCity} onChange={setEditCity} />
          <Input
            label="Address"
            value={editAddress}
            onChange={setEditAddress}
          />
          <Input
            label="Country"
            value={editCountry}
            onChange={setEditCountry}
          />
        </div>

        <div className="mt-4">
          <label className="text-sm font-semibold text-slate-700">
            Internal notes
          </label>
          <textarea
            value={editNotes}
            onChange={(event) => setEditNotes(event.target.value)}
            rows={3}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none transition focus:border-[var(--admin-cyan)] focus:ring-2 focus:ring-cyan-100"
          />
        </div>

        <div className="mt-4 grid gap-4 text-sm md:grid-cols-3">
          <InfoRow label="Customer ID" value={customer.id} />
          <InfoRow label="Contact email" value={customer.email || "Not set"} />
          <InfoRow
            label="Organisation number"
            value={customer.organisation_number || "Not set"}
          />
        </div>

        <button
          onClick={saveCustomerDetails}
          disabled={saving}
          className="admin-button-primary mt-4 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save customer details"}
        </button>

        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50/70 p-4">
          <h3 className="font-semibold text-red-900">Danger zone</h3>
          <p className="mt-1 text-sm text-red-700">
            Permanently delete this customer and related database records. Use
            this only for wrong drafts, duplicates, or test customers.
          </p>
          <button
            type="button"
            onClick={deleteCustomer}
            disabled={saving}
            className="mt-3 rounded-xl bg-red-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? "Deleting..." : "Delete customer"}
          </button>
        </div>
      </div>
      )}

      {/* ==============================
          Onboarding
      ============================== */}
      {activeSection === "onboarding" && (
      <div className="admin-card p-6">
        <h2 className="admin-card-title text-xl">Onboarding</h2>

        <div className="mt-4 rounded-3xl border border-blue-100 bg-white/80 p-5 shadow-sm">
          <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">
                Quote and onboarding workflow
              </p>
              <h3 className="mt-2 text-lg font-black text-slate-950">
                Send quote, setup link, material upload, and payment in one flow
              </h3>
              <p className="admin-muted mt-2 text-sm">
                Select the package the customer requested. InfoSync prepares an
                order number, stores the quoted items, creates the secure
                onboarding link, and emails the customer when email is
                configured.
              </p>
            </div>

            {currentOnboardingLink && (
              <span className="rounded-full bg-blue-50 px-3 py-2 text-xs font-black text-blue-700">
                Link ready
              </span>
            )}
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.85fr)]">
            <div className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-700">
                    Screens / package lines
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      setQuoteItems((items) => [
                        ...items,
                        {
                          id: crypto.randomUUID(),
                          pricingPlanCode: pricingPlans[0]?.code || "",
                          quantity: 1,
                        },
                      ])
                    }
                    className="rounded-full bg-blue-600 px-3 py-2 text-xs font-black text-white"
                  >
                    + Add screen package
                  </button>
                </div>

                {quoteItems.map((item, index) => (
                  <div
                    key={item.id}
                    className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-[minmax(0,1fr)_120px_auto]"
                  >
                    <label className="text-sm font-semibold text-slate-700">
                      Package
                      <select
                        value={item.pricingPlanCode}
                        onChange={(event) => {
                          const nextCode = event.target.value;
                          if (index === 0) setQuotePlanCode(nextCode);
                          setQuoteItems((items) =>
                            items.map((line) =>
                              line.id === item.id
                                ? { ...line, pricingPlanCode: nextCode }
                                : line,
                            ),
                          );
                        }}
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none transition focus:border-[var(--admin-cyan)] focus:ring-2 focus:ring-cyan-100"
                      >
                        {pricingPlans.map((plan) => (
                          <option key={plan.id} value={plan.code}>
                            {plan.name} {plan.resolution} -{" "}
                            {formatSek(plan.monthly_fee_sek)} / month
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="text-sm font-semibold text-slate-700">
                      Quantity
                      <input
                        type="number"
                        min="1"
                        max="50"
                        value={item.quantity}
                        onChange={(event) =>
                          setQuoteItems((items) =>
                            items.map((line) =>
                              line.id === item.id
                                ? {
                                    ...line,
                                    quantity: Math.min(
                                      50,
                                      Math.max(
                                        1,
                                        Number(event.target.value) || 1,
                                      ),
                                    ),
                                  }
                                : line,
                            ),
                          )
                        }
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none transition focus:border-[var(--admin-cyan)] focus:ring-2 focus:ring-cyan-100"
                      />
                    </label>

                    <button
                      type="button"
                      onClick={() =>
                        setQuoteItems((items) =>
                          items.length === 1
                            ? items
                            : items.filter((line) => line.id !== item.id),
                        )
                      }
                      disabled={quoteItems.length === 1}
                      className="self-end rounded-xl bg-red-800 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="text-sm font-semibold text-slate-700">
                  Device discount %
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={quoteDiscountPercent}
                    onChange={(event) =>
                      setQuoteDiscountPercent(
                        Math.min(
                          100,
                          Math.max(0, Number(event.target.value) || 0),
                        ),
                      )
                    }
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none transition focus:border-[var(--admin-cyan)] focus:ring-2 focus:ring-cyan-100"
                  />
                </label>

                <label className="text-sm font-semibold text-slate-700">
                  Discount months
                  <input
                    type="number"
                    min="0"
                    max="36"
                    value={quoteDiscountMonths}
                    onChange={(event) =>
                      setQuoteDiscountMonths(
                        Math.min(
                          36,
                          Math.max(0, Number(event.target.value) || 0),
                        ),
                      )
                    }
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none transition focus:border-[var(--admin-cyan)] focus:ring-2 focus:ring-cyan-100"
                  />
                </label>
              </div>

              <p className="rounded-2xl bg-blue-50 p-3 text-xs font-semibold text-blue-800">
                Discounts are applied to screen/device charges only. The setup
                fee is never discounted.
              </p>

              <label className="text-sm font-semibold text-slate-700">
                Message on quote email
                <textarea
                  value={quoteNotes}
                  onChange={(event) => setQuoteNotes(event.target.value)}
                  rows={3}
                  placeholder="Optional internal/customer-facing note for this quote"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none transition focus:border-[var(--admin-cyan)] focus:ring-2 focus:ring-cyan-100"
                />
              </label>

              <button
                type="button"
                onClick={prepareQuoteAndOnboarding}
                disabled={saving || quoteLines.length === 0}
                className="admin-button-primary disabled:opacity-50"
              >
                {saving ? "Preparing..." : "Prepare quote and send onboarding"}
              </button>

              {(quoteResultUrl || currentOnboardingLink) && (
                <p className="break-all rounded-2xl bg-slate-100 p-4 text-sm text-slate-700">
                  Onboarding link: {quoteResultUrl || currentOnboardingLink}
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                Quote preview
              </p>
              {primaryQuotePlan ? (
                <div className="mt-3 space-y-2 text-sm text-slate-700">
                  {quoteLines.map((line) => (
                    <div
                      key={line.id}
                      className="rounded-xl bg-white/80 p-3 text-slate-700"
                    >
                      <div className="flex justify-between gap-3">
                        <span>
                          {line.plan?.name} {line.plan?.resolution}
                        </span>
                        <strong>x {line.quantity}</strong>
                      </div>
                      <div className="mt-1 flex justify-between gap-3 text-xs">
                        <span>Hardware</span>
                        <strong>{formatSek(line.deviceSubtotal)}</strong>
                      </div>
                      <div className="mt-1 flex justify-between gap-3 text-xs">
                        <span>Monthly</span>
                        <strong>{formatSek(line.monthlySubtotal)} / month</strong>
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-between gap-3">
                    <span>Setup fee</span>
                    <strong>{formatSek(primaryQuotePlan.setup_fee_sek)}</strong>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span>Device discount</span>
                    <strong>-{formatSek(quoteDeviceDiscountAmount)}</strong>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span>Shipping</span>
                    <strong>{formatSek(quoteShippingSubtotal)}</strong>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span>Monthly</span>
                    <strong>{formatSek(quoteMonthlySubtotal)} / month</strong>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span>Monthly discount</span>
                    <strong>
                      {quoteDiscountMonths > 0
                        ? `-${formatSek(quoteMonthlyDiscountAmount)} / month`
                        : "No recurring discount"}
                    </strong>
                  </div>
                  <div className="flex justify-between gap-3 border-t border-slate-200 pt-2">
                    <span>Due at checkout before trial</span>
                    <strong>{formatSek(quoteStartupTotal)}</strong>
                  </div>
                  <p className="text-xs text-slate-500">
                    Screens: {quoteScreenQuantity}. Trial:{" "}
                    {primaryQuotePlan.trial_days} days. Monthly
                    discount duration: {quoteDiscountMonths} months. Stripe
                    handles the subscription after checkout.
                  </p>
                </div>
              ) : (
                <p className="admin-muted mt-3 text-sm">
                  No active pricing plans found.
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-4 text-sm md:grid-cols-2">
          <InfoRow
            label="Onboarding token"
            value={customer.onboarding_token || "Not generated yet"}
          />
          <InfoRow
            label="Token expires"
            value={customer.onboarding_token_expires_at || "Not generated yet"}
          />
          <InfoRow
            label="Terms accepted"
            value={customer.terms_accepted_at ? "Yes" : "No"}
          />
          <InfoRow
            label="Privacy accepted"
            value={customer.privacy_accepted_at ? "Yes" : "No"}
          />
          <InfoRow
            label="Marketing consent"
            value={customer.marketing_consent ? "Yes" : "No"}
          />
          <InfoRow
            label="Payment status"
            value={customer.payment_status || "Not paid"}
          />
          <InfoRow
            label="Stripe customer"
            value={customer.stripe_customer_id || "Not created yet"}
          />
          <InfoRow
            label="Stripe subscription"
            value={customer.stripe_subscription_id || "Not created yet"}
          />
          <InfoRow
            label="Activated at"
            value={customer.activated_at || "Not active yet"}
          />
          <InfoRow
            label="Inactive reason"
            value={formatInactiveReason(customer.inactive_reason)}
          />
          <InfoRow
            label="Cancelled at"
            value={customer.cancelled_at || "Not cancelled"}
          />
          <InfoRow
            label="Cancellation source"
            value={formatCancellationSource(customer.cancellation_source)}
          />
        </div>

        <div className="mt-6">
          {customer.status === "active" ? (
            <>
              <p className="rounded-2xl bg-green-50 p-4 text-sm font-medium text-green-700">
                Onboarding completed. Customer is active and paid.
              </p>

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  onClick={suspendCustomer}
                  disabled={saving}
                  className="rounded-xl bg-yellow-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Suspend customer"}
                </button>

                {customer.stripe_subscription_id && (
                  <button
                    onClick={cancelSubscription}
                    disabled={saving}
                    className="rounded-xl bg-red-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {saving ? "Saving..." : "Cancel subscription"}
                  </button>
                )}
              </div>
            </>
          ) : customer.status === "suspended" ? (
            <>
              <p className="rounded-2xl bg-red-50 p-4 text-sm font-medium text-red-700">
                Customer is suspended. Displays should not run for this
                customer.
              </p>

              <button
                onClick={reactivateCustomer}
                disabled={saving}
                className="mt-4 rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving ? "Saving..." : "Reactivate customer"}
              </button>
            </>
          ) : (
            <>
              {customer.onboarding_token && (
                <p className="mt-4 break-all rounded-2xl bg-slate-100 p-4 text-sm text-slate-700">
                  Onboarding link: /onboarding/{customer.onboarding_token}
                </p>
              )}

              {!customer.onboarding_token && (
                <p className="rounded-2xl bg-blue-50 p-4 text-sm font-medium text-blue-700">
                  No onboarding link yet. Use the quote workflow above to create
                  the order, setup link, material upload path, and payment flow
                  together.
                </p>
              )}
            </>
          )}
        </div>
      </div>
      )}

      {activeSection === "communication" && (
        <div className="admin-card p-6">
          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
            <div>
              <h2 className="admin-card-title text-xl">Communication center</h2>
              <p className="admin-muted mt-2 text-sm">
                Conversations, troubleshooting requests, new order discussions,
                and uploaded screen material for this customer.
              </p>
            </div>
            <div className="admin-communication-tabs">
              <button
                type="button"
                onClick={() => setCommunicationView("messages")}
                className={communicationView === "messages" ? "is-active" : ""}
              >
                Conversations ({messages.length})
              </button>
              <button
                type="button"
                onClick={() => setCommunicationView("uploads")}
                className={communicationView === "uploads" ? "is-active" : ""}
              >
                Uploaded media ({assets.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==============================
          Customer Messages
      ============================== */}
      {activeSection === "communication" && communicationView === "messages" && (
      <div className="admin-card p-6">
        <h2 className="admin-card-title text-xl">Customer messages</h2>

        {messages.length === 0 ? (
          <p className="admin-muted mt-4">No customer messages yet.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {messages.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl border border-slate-200 bg-white/70 p-4"
              >
                <div className="flex flex-col justify-between gap-2 md:flex-row">
                  <div>
                    <p className="font-semibold text-slate-950">
                      {item.subject || "Message"}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {new Date(item.createdAt).toLocaleString("sv-SE")} ·{" "}
                      {item.status}
                    </p>
                  </div>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">
                  {item.message}
                </p>

                {item.files.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {item.files.map((file) =>
                      file.downloadUrl ? (
                        <a
                          key={file.id}
                          href={file.downloadUrl}
                          target="_blank"
                          className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 no-underline"
                        >
                          {file.fileName}
                        </a>
                      ) : (
                        <span
                          key={file.id}
                          className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-400"
                        >
                          {file.fileName}
                        </span>
                      ),
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      )}

      {/* ==============================
          Customer Display Material
      ============================== */}
      {activeSection === "communication" && communicationView === "uploads" && (
      <div className="admin-card p-6">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <div>
            <h2 className="admin-card-title text-xl">Display material</h2>
            <p className="admin-muted mt-2 text-sm">
              Material uploaded from onboarding and the customer portal.
            </p>
          </div>
        </div>

        {assets.length === 0 ? (
          <p className="admin-muted mt-4">No display material yet.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {assets.map((asset) => (
              <div
                key={asset.id}
                className="rounded-2xl border border-slate-200 bg-white/70 p-4"
              >
                <div className="flex flex-col justify-between gap-2 md:flex-row">
                  <div>
                    <p className="font-semibold text-slate-950">
                      {asset.fileName || "Text material"}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {new Date(asset.createdAt).toLocaleString("sv-SE")} ·{" "}
                      {asset.category} · {asset.source} · {asset.status}
                    </p>
                  </div>
                  {asset.downloadUrl && (
                    <a
                      href={asset.downloadUrl}
                      target="_blank"
                      className="admin-button-primary"
                    >
                      Download
                    </a>
                  )}
                </div>
                {asset.description && (
                  <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">
                    {asset.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      )}

      {/* ==============================
          Orders
      ============================== */}
      {activeSection === "orders" && (
      <div className="admin-card p-6">
        <h2 className="admin-card-title text-xl">Orders</h2>

        {subscriptions.length === 0 ? (
          <p className="admin-muted mt-4">No orders yet.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {subscriptions.map((subscription) => (
              <div
                key={subscription.id}
                className="rounded-2xl border border-slate-200 bg-white/70 p-4"
              >
                <div className="flex flex-col justify-between gap-3 md:flex-row">
                  <div>
                    <p className="font-semibold text-slate-950">
                      {subscription.order_number || "Order number pending"}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      Status: {subscription.status} ? Fulfillment:{" "}
                      {subscription.fulfillment_status || "pending"} ? Inventory:{" "}
                      {subscription.inventory_status || "not reserved"}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      Stripe checkout:{" "}
                      {subscription.stripe_checkout_session_id || "Not started"}
                    </p>
                  </div>

                  <div className="text-sm text-slate-600 md:text-right">
                    <p>
                      Setup:{" "}
                      {formatSek(subscription.setup_fee_sek) || "Not recorded"}
                    </p>
                    <p>
                      Hardware:{" "}
                      {formatSek(subscription.hardware_fee_sek) || "Not recorded"}
                      {" "}x {subscription.screen_quantity || 1}
                    </p>
                    <p>
                      Device discount:{" "}
                      {subscription.device_discount_percent || 0}%{" "}
                      ({formatSek(subscription.device_discount_amount_sek || 0)})
                    </p>
                    <p>
                      Shipping:{" "}
                      {formatSek(subscription.shipping_fee_sek) || "Not recorded"}
                    </p>
                    <p>
                      Monthly:{" "}
                      {formatSek(subscription.monthly_fee_sek) || "Not recorded"}
                      {" "}x {subscription.screen_quantity || 1}
                    </p>
                    <p>
                      Monthly discount:{" "}
                      {formatSek(subscription.monthly_discount_amount_sek || 0)}{" "}
                      for {subscription.device_discount_months || 0} months
                    </p>
                    <p>
                      Tax: {formatSek(subscription.tax_amount_sek) || "Pending"}{" "}
                      ({subscription.tax_status || "not calculated"})
                    </p>
                    <p>
                      Total:{" "}
                      {formatSek(subscription.total_amount_sek) || "Pending"}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      )}

      {/* ==============================
          Device Management
      ============================== */}
      {activeSection === "devices" && (
      <>
      <div className="admin-card p-6">
        <h2 className="admin-card-title text-xl">Device management</h2>

        <p className="admin-muted mt-2 text-sm">
          Add a device through Device Management so inventory, warranty, and
          assignment records are stored correctly.
        </p>

        <Link
          href={`/admin/devices/new?customerId=${customer.id}`}
          className="admin-button-primary mt-4"
        >
          Add device for this customer
        </Link>
      </div>

      {/* ==============================
          Devices
      ============================== */}
      <div className="admin-card mt-6 p-6">
        <h2 className="admin-card-title text-xl">Devices</h2>

        {devices.length === 0 ? (
          <p className="admin-muted mt-4">No devices yet.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {devices.map((device) => (
              <div
                key={device.id}
                className="rounded-2xl border border-slate-200 bg-white/70 p-4"
              >
                <p className="font-semibold text-slate-950">
                  {device.name || "Unnamed device"}
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  Device code: {device.device_code}
                </p>

                <p className="text-sm text-slate-500">
                  Display: /display/{device.device_code}
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    href={`/admin/devices/${device.device_code}`}
                    className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-semibold text-white no-underline"
                  >
                    Manage
                  </Link>

                  <a
                    href={`/display/${device.device_code}`}
                    target="_blank"
                    className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 no-underline"
                  >
                    Preview
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      </>
      )}
    </div>
  );
}

function formatSek(amount: number | null) {
  if (amount === null) return "";

  return `${amount.toLocaleString("sv-SE")} kr`;
}

function InfoRow({ label, value }: { label: string; value: string }) {
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
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <div>
      <label className="text-sm font-semibold text-slate-700">
        {label}
        {required ? " *" : ""}
      </label>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none transition focus:border-[var(--admin-cyan)] focus:ring-2 focus:ring-cyan-100"
      />
    </div>
  );
}
