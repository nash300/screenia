"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { showAdminNotification } from "@/lib/admin/notifications";
import { PRICING_PLANS } from "@/lib/pricing/plans";
import { includedVatFromGross } from "@/lib/pricing/vat";
import { isValidSwedishRegistrationNumber } from "@/lib/business/sweden";

type Customer = {
  id: string;
  customer_number: string | null;
  requested_screen_quantity: number | null;
  requested_quote_items: QuoteItemRecord[] | null;
  name: string;
  email: string | null;
  phone: string | null;
  contact_person: string | null;
  organisation_number: string | null;
  billing_email: string | null;
  address: string | null;
  postal_code: string | null;
  city: string | null;
  country: string | null;
  business_category: string | null;
  website_url: string | null;
  preferred_contact_channel: string | null;
  remote_support_consent: boolean | null;
  analytics_consent: boolean | null;
  notes: string | null;
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
  onboarding_token: string | null;
  onboarding_token_expires_at: string | null;
  terms_accepted_at: string | null;
  privacy_accepted_at: string | null;
  marketing_consent: boolean | null;
  payment_status: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  service_access_status: string | null;
  service_access_until: string | null;
  production_status: string | null;
  layout_started_at: string | null;
  setup_fee_locked_at: string | null;
  activated_at: string | null;
  inactive_reason: string | null;
  cancellation_reason: string | null;
  cancellation_details: string | null;
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
  stripe_invoice_id: string | null;
  stripe_current_period_start: string | null;
  stripe_current_period_end: string | null;
  cancel_at_period_end: boolean | null;
  cancellation_effective_at: string | null;
  pause_started_at: string | null;
  pause_resumes_at: string | null;
  pause_reason: string | null;
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

type QuoteItemRecord = {
  pricingPlanCode?: string;
  name?: string;
  resolution?: string;
  quantity?: number;
};

type CustomerMessage = {
  id: string;
  ticketNumber: string | null;
  requestType: string;
  priority: string;
  relatedTicketNumber: string | null;
  subject: string | null;
  message: string;
  status: string;
  adminNote: string | null;
  adminNoteUpdatedAt: string | null;
  resolvedAt: string | null;
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
  adminNote: string | null;
  adminNoteUpdatedAt: string | null;
  reviewedAt: string | null;
  createdAt: string;
  downloadUrl: string | null;
};

type AuditEvent = {
  id: string;
  actor_type: string;
  actor_id: string | null;
  event_type: string;
  event_description: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

type CustomerDetailSection =
  | "overview"
  | "onboarding"
  | "communication"
  | "orders"
  | "devices"
  | "history";

type CommunicationView = "messages" | "uploads";

const customerDetailSectionIds: CustomerDetailSection[] = [
  "overview",
  "onboarding",
  "communication",
  "orders",
  "devices",
  "history",
];

type SupabaseSchemaError = {
  code?: string;
  message?: string;
};

const isSchemaMismatch = (error: SupabaseSchemaError | null | undefined) =>
  error?.code === "42703" || error?.code === "PGRST204";

const normalizeCustomer = (row: Partial<Customer>): Customer => ({
  id: row.id || "",
  customer_number: row.customer_number ?? null,
  requested_screen_quantity: row.requested_screen_quantity ?? null,
  requested_quote_items: row.requested_quote_items ?? null,
  name: row.name || "Unknown customer",
  email: row.email ?? null,
  phone: row.phone ?? null,
  contact_person: row.contact_person ?? null,
  organisation_number: row.organisation_number ?? null,
  billing_email: row.billing_email ?? null,
  address: row.address ?? null,
  postal_code: row.postal_code ?? null,
  city: row.city ?? null,
  country: row.country ?? null,
  business_category: row.business_category ?? null,
  website_url: row.website_url ?? null,
  preferred_contact_channel: row.preferred_contact_channel ?? null,
  remote_support_consent: row.remote_support_consent ?? null,
  analytics_consent: row.analytics_consent ?? null,
  notes: row.notes ?? null,
  status: row.status ?? null,
  created_at: row.created_at ?? null,
  updated_at: row.updated_at ?? null,
  onboarding_token: row.onboarding_token ?? null,
  onboarding_token_expires_at: row.onboarding_token_expires_at ?? null,
  terms_accepted_at: row.terms_accepted_at ?? null,
  privacy_accepted_at: row.privacy_accepted_at ?? null,
  marketing_consent: row.marketing_consent ?? null,
  payment_status: row.payment_status ?? null,
  stripe_customer_id: row.stripe_customer_id ?? null,
  stripe_subscription_id: row.stripe_subscription_id ?? null,
  service_access_status: row.service_access_status ?? null,
  service_access_until: row.service_access_until ?? null,
  production_status: row.production_status ?? null,
  layout_started_at: row.layout_started_at ?? null,
  setup_fee_locked_at: row.setup_fee_locked_at ?? null,
  activated_at: row.activated_at ?? null,
  inactive_reason: row.inactive_reason ?? null,
  cancellation_reason: row.cancellation_reason ?? null,
  cancellation_details: row.cancellation_details ?? null,
  cancelled_at: row.cancelled_at ?? null,
  cancellation_source: row.cancellation_source ?? null,
});

const normalizeSubscription = (
  row: Partial<CustomerSubscription>,
): CustomerSubscription => ({
  id: row.id || "",
  order_number: row.order_number ?? null,
  status: row.status || "pending",
  setup_fee_sek: row.setup_fee_sek ?? null,
  hardware_fee_sek: row.hardware_fee_sek ?? null,
  shipping_fee_sek: row.shipping_fee_sek ?? null,
  monthly_fee_sek: row.monthly_fee_sek ?? null,
  tax_amount_sek: row.tax_amount_sek ?? null,
  total_amount_sek: row.total_amount_sek ?? null,
  tax_status: row.tax_status ?? null,
  fulfillment_status: row.fulfillment_status ?? null,
  inventory_status: row.inventory_status ?? null,
  stripe_checkout_session_id: row.stripe_checkout_session_id ?? null,
  stripe_subscription_id: row.stripe_subscription_id ?? null,
  stripe_invoice_id: row.stripe_invoice_id ?? null,
  stripe_current_period_start: row.stripe_current_period_start ?? null,
  stripe_current_period_end: row.stripe_current_period_end ?? null,
  cancel_at_period_end: row.cancel_at_period_end ?? false,
  cancellation_effective_at: row.cancellation_effective_at ?? null,
  pause_started_at: row.pause_started_at ?? null,
  pause_resumes_at: row.pause_resumes_at ?? null,
  pause_reason: row.pause_reason ?? null,
  screen_quantity: row.screen_quantity ?? 1,
  device_discount_percent: row.device_discount_percent ?? 0,
  device_discount_months: row.device_discount_months ?? 0,
  device_discount_amount_sek: row.device_discount_amount_sek ?? 0,
  monthly_discount_amount_sek: row.monthly_discount_amount_sek ?? 0,
  created_at: row.created_at || new Date().toISOString(),
});

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
  const [messageDrafts, setMessageDrafts] = useState<
    Record<string, { status: string; adminNote: string }>
  >({});
  const [messageReplyDrafts, setMessageReplyDrafts] = useState<
    Record<string, string>
  >({});
  const [assets, setAssets] = useState<CustomerAsset[]>([]);
  const [assetDrafts, setAssetDrafts] = useState<
    Record<string, { status: string; adminNote: string }>
  >({});
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editContactPerson, setEditContactPerson] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editOrganisationNumber, setEditOrganisationNumber] = useState("");
  const [editBillingEmail, setEditBillingEmail] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editPostalCode, setEditPostalCode] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editCountry, setEditCountry] = useState("");
  const [editBusinessCategory, setEditBusinessCategory] = useState("");
  const [editWebsiteUrl, setEditWebsiteUrl] = useState("");
  const [editPreferredContactChannel, setEditPreferredContactChannel] =
    useState("email");
  const [editNotes, setEditNotes] = useState("");
  const [editReason, setEditReason] = useState("");
  const [isEditingCustomer, setIsEditingCustomer] = useState(false);
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

  const formatInactiveReason = (
    reason: string | null,
    cancellationReason?: string | null,
  ) => {
    if (cancellationReason === "refunded_before_production") {
      return "Refunded before production";
    }
    if (reason === "manual_suspend") return "Manually suspended";
    if (reason === "payment_failed") return "Payment failed";
    if (reason === "payment_disputed") return "Payment disputed";
    if (reason === "subscription_cancelled") return "Subscription cancelled / refunded";
    if (reason === "customer_cancelled") return "Cancelled by customer";
    return "None";
  };

  const formatCancellationSource = (source: string | null) => {
    if (source === "admin") return "Admin";
    if (source === "customer") return "Customer";
    if (source === "stripe") return "Stripe";
    return "None";
  };

  const formatProductionStatus = (status: string | null) => {
    if (status === "layout_started") return "Layout work started";
    if (status === "ready_for_preview") return "Ready for preview";
    if (status === "approved") return "Approved";
    if (status === "published") return "Published";
    if (status === "not_started") return "Not started";
    return status ? status.replaceAll("_", " ") : "Not tracked yet";
  };

  const formatDateTime = (value: string | null | undefined) => {
    if (!value) return "Not recorded";
    return new Date(value).toLocaleString("sv-SE");
  };

  const getStatusClass = (status: string | null) => {
    if (status === "active") return "bg-green-100 text-green-700";
    if (status === "invited") return "bg-blue-100 text-blue-700";
    if (status === "suspended") return "bg-red-100 text-red-700";
    if (status === "completed_profile") return "bg-purple-100 text-purple-700";
    if (status === "accepted_terms") return "bg-yellow-100 text-yellow-700";
    return "bg-slate-100 text-slate-700";
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    setSchemaNotice("");

    const customerSelects = [`
        id,
        customer_number,
        requested_screen_quantity,
        requested_quote_items,
        name,
        email,
        phone,
        contact_person,
        organisation_number,
        billing_email,
        address,
        postal_code,
        city,
        country,
        business_category,
        website_url,
        preferred_contact_channel,
        remote_support_consent,
        analytics_consent,
        notes,
        status,
        created_at,
        updated_at,
        onboarding_token,
        onboarding_token_expires_at,
        terms_accepted_at,
        privacy_accepted_at,
        marketing_consent,
        payment_status,
        stripe_customer_id,
        stripe_subscription_id,
        service_access_status,
        service_access_until,
        production_status,
        layout_started_at,
        setup_fee_locked_at,
        activated_at,
        inactive_reason,
        cancellation_reason,
        cancellation_details,
        cancelled_at,
        cancellation_source
      `,
      `
        id,
        requested_screen_quantity,
        requested_quote_items,
        name,
        email,
        phone,
        contact_person,
        organisation_number,
        billing_email,
        address,
        postal_code,
        city,
        country,
        business_category,
        website_url,
        preferred_contact_channel,
        remote_support_consent,
        analytics_consent,
        notes,
        status,
        created_at,
        updated_at,
        onboarding_token,
        onboarding_token_expires_at,
        terms_accepted_at,
        privacy_accepted_at,
        marketing_consent,
        payment_status,
        stripe_customer_id,
        stripe_subscription_id,
        service_access_status,
        service_access_until,
        activated_at,
        inactive_reason,
        cancellation_reason,
        cancellation_details,
        cancelled_at,
        cancellation_source
      `,
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
        created_at,
        updated_at,
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
        cancellation_reason,
        cancellation_details,
        cancelled_at,
        cancellation_source
      `,
      `
        id,
        name,
        email,
        phone,
        status,
        created_at,
        updated_at
      `,
    ];

    let customerData: Partial<Customer> | null = null;
    let customerError: SupabaseSchemaError | null = null;

    for (const selectStatement of customerSelects) {
      const result = await supabase
        .from("customers")
        .select(selectStatement)
        .eq("id", customerId)
        .single();

      if (!result.error) {
        customerData = result.data as Partial<Customer>;
        customerError = null;
        break;
      }

      customerError = result.error;
      if (!isSchemaMismatch(result.error)) break;
    }

    if (customerError || !customerData) {
      console.error("Customer error:", customerError);
      setCustomer(null);
      setDevices([]);
      setSubscriptions([]);
      setMessages([]);
      setAssets([]);
      setAuditEvents([]);
      setLoading(false);
      return;
    }

    const loadedCustomer = normalizeCustomer(customerData);

    setCustomer(loadedCustomer);
    setEditName(loadedCustomer.name || "");
    setEditContactPerson(loadedCustomer.contact_person || "");
    setEditPhone(loadedCustomer.phone || "");
    setEditOrganisationNumber(loadedCustomer.organisation_number || "");
    setEditBillingEmail(loadedCustomer.billing_email || "");
    setEditAddress(loadedCustomer.address || "");
    setEditPostalCode(loadedCustomer.postal_code || "");
    setEditCity(loadedCustomer.city || "");
    setEditCountry(loadedCustomer.country || "Sverige");
    setEditBusinessCategory(loadedCustomer.business_category || "");
    setEditWebsiteUrl(loadedCustomer.website_url || "");
    setEditPreferredContactChannel(
      loadedCustomer.preferred_contact_channel || "email",
    );
    setEditNotes(loadedCustomer.notes || "");
    setEditReason("");
    if (
      Array.isArray(loadedCustomer.requested_quote_items) &&
      loadedCustomer.requested_quote_items.length > 0
    ) {
      setQuoteItems(
        loadedCustomer.requested_quote_items.map((item, index) => ({
          id: `requested-${index}-${item.pricingPlanCode || "plan"}`,
          pricingPlanCode: item.pricingPlanCode || "",
          quantity: Math.min(50, Math.max(1, Number(item.quantity) || 1)),
        })),
      );
      setQuotePlanCode(
        loadedCustomer.requested_quote_items[0]?.pricingPlanCode || "",
      );
    }

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

    const subscriptionSelects = [
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
          stripe_invoice_id,
          stripe_current_period_start,
          stripe_current_period_end,
          cancel_at_period_end,
          cancellation_effective_at,
          pause_started_at,
          pause_resumes_at,
          pause_reason,
          screen_quantity,
          device_discount_percent,
          device_discount_months,
          device_discount_amount_sek,
          monthly_discount_amount_sek,
          created_at
        `,
      `
          id,
          order_number,
          status,
          setup_fee_sek,
          monthly_fee_sek,
          stripe_checkout_session_id,
          stripe_subscription_id,
          stripe_current_period_start,
          stripe_current_period_end,
          cancel_at_period_end,
          cancellation_effective_at,
          pause_started_at,
          pause_resumes_at,
          pause_reason,
          created_at
        `,
      `
          id,
          status,
          stripe_checkout_session_id,
          stripe_subscription_id,
          created_at
        `,
    ];
    let subscriptionData: Partial<CustomerSubscription>[] | null = null;
    let subscriptionError: SupabaseSchemaError | null = null;
    let usedSubscriptionFallback = false;

    for (const [index, selectStatement] of subscriptionSelects.entries()) {
      const result = await supabase
        .from("customer_subscriptions")
        .select(selectStatement)
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false });

      if (!result.error) {
        subscriptionData = result.data as Partial<CustomerSubscription>[];
        subscriptionError = null;
        usedSubscriptionFallback = index > 0;
        break;
      }

      subscriptionError = result.error;
      if (!isSchemaMismatch(result.error)) break;
    }

    if (subscriptionError) {
      if (isSchemaMismatch(subscriptionError)) {
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
          stripe_invoice_id: null,
          stripe_current_period_start: null,
          stripe_current_period_end: null,
          cancel_at_period_end: false,
          cancellation_effective_at: null,
          pause_started_at: null,
          pause_resumes_at: null,
          pause_reason: null,
          screen_quantity: 1,
          device_discount_percent: 0,
          device_discount_months: 0,
          device_discount_amount_sek: 0,
          monthly_discount_amount_sek: 0,
          created_at: subscription.created_at,
        })),
      );
    } else {
      if (usedSubscriptionFallback) {
        setSchemaNotice(
          "The database is missing the latest order columns. Some order details are hidden until migrations are applied.",
        );
      }
      setSubscriptions((subscriptionData || []).map(normalizeSubscription));
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
      const nextMessages = response.ok ? data.messages || [] : [];
      setMessages(nextMessages);
      setMessageDrafts(
        Object.fromEntries(
          nextMessages.map((message: CustomerMessage) => [
            message.id,
            {
              status: message.status || "new",
              adminNote: message.adminNote || "",
            },
          ]),
        ),
      );
      setMessageReplyDrafts((current) =>
        Object.fromEntries(
          nextMessages.map((message: CustomerMessage) => [
            message.id,
            current[message.id] || "",
          ]),
        ),
      );
    } catch (error) {
      console.error("Customer messages error:", error);
      setMessages([]);
      setMessageDrafts({});
      setMessageReplyDrafts({});
    }

    try {
      const response = await fetch(
        `/api/admin/customer-assets?customerId=${customerId}`,
      );
      const data = await response.json();
      const nextAssets = response.ok ? data.assets || [] : [];
      setAssets(nextAssets);
      setAssetDrafts(
        Object.fromEntries(
          nextAssets.map((asset: CustomerAsset) => [
            asset.id,
            {
              status: asset.status || "new",
              adminNote: asset.adminNote || "",
            },
          ]),
        ),
      );
    } catch (error) {
      console.error("Customer assets error:", error);
      setAssets([]);
      setAssetDrafts({});
    }

    const { data: auditData, error: auditError } = await supabase
      .from("audit_events")
      .select("id, actor_type, actor_id, event_type, event_description, metadata, created_at")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (auditError) {
      console.error("Audit events error:", auditError);
      setAuditEvents([]);
    } else {
      setAuditEvents((auditData || []) as AuditEvent[]);
    }

    setLoading(false);
  }, [customerId]);

  const saveCustomerDetails = async () => {
    if (!customer) return;

    if (!editName.trim()) {
      showAdminNotification("warning", "Company name is required.");
      return;
    }

    if (
      editOrganisationNumber.trim() &&
      !isValidSwedishRegistrationNumber(editOrganisationNumber)
    ) {
      showAdminNotification(
        "warning",
        "Enter a valid Swedish organisation number.",
      );
      return;
    }

    if (editReason.trim().length < 5) {
      showAdminNotification(
        "warning",
        "Add a reason of at least 5 characters before saving customer details.",
      );
      return;
    }

    setSaving(true);

    const fullPayload = {
      name: editName.trim(),
      contact_person: editContactPerson.trim() || null,
      phone: editPhone.trim() || null,
      organisation_number: editOrganisationNumber.trim() || null,
      billing_email: editBillingEmail.trim() || null,
      address: editAddress.trim() || null,
      postal_code: editPostalCode.replace(/\s/g, "") || null,
      city: editCity.trim() || null,
      country: editCountry.trim() || "Sverige",
      business_category: editBusinessCategory.trim() || null,
      website_url: editWebsiteUrl.trim() || null,
      preferred_contact_channel: editPreferredContactChannel,
      notes: editNotes.trim() || null,
      reason: editReason.trim(),
    };
    const response = await fetch(`/api/admin/customers/${customer.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fullPayload),
    });
    const result = await response.json();

    if (!response.ok) {
      console.error("Save customer details error:", result);
      showAdminNotification(
        "error",
        result.error || "Could not save customer details.",
      );
      setSaving(false);
      return;
    }

    await loadData();
    showAdminNotification("success", "Customer details updated.");
    setIsEditingCustomer(false);
    setEditReason("");
    setSaving(false);
  };

  const runSubscriptionAction = async ({
    action,
    payload = {},
    successMessage,
  }: {
    action: string;
    payload?: Record<string, unknown>;
    successMessage: string;
  }) => {
    if (!customer) return;

    setSaving(true);
    const response = await fetch(
      `/api/admin/customers/${customer.id}/subscription`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
      },
    );
    const result = await response.json();

    if (!response.ok) {
      showAdminNotification(
        "error",
        result.error || "Could not update subscription operation.",
      );
      setSaving(false);
      return;
    }

    await loadData();
    showAdminNotification("success", successMessage);
    setSaving(false);
  };

  const requireReason = (message: string) => {
    const reason = window.prompt(message);
    const cleanedReason = reason?.trim() || "";

    if (cleanedReason && cleanedReason.length < 5) {
      showAdminNotification(
        "error",
        "A reason of at least 5 characters is required.",
      );
      return "";
    }

    return cleanedReason;
  };

  const suspendCustomer = async () => {
    if (!customer) return;
    const reason = requireReason("Reason for suspending this customer:");
    if (!reason) return;
    await runSubscriptionAction({
      action: "suspend_customer",
      payload: { reason },
      successMessage: "Customer suspended and audit history recorded.",
    });
  };

  const activateCustomer = async () => {
    if (!customer) return;
    const reason = requireReason("Reason for activating this customer:");
    if (!reason) return;
    if (!confirm("Mark this customer active and allow assigned displays to run")) return;
    await runSubscriptionAction({
      action: "activate_customer",
      payload: { reason },
      successMessage: "Customer activated and audit history recorded.",
    });
  };

  const startLayoutWork = async () => {
    if (!customer) return;
    const reason = requireReason(
      "Reason for starting layout work and locking the setup fee:",
    );
    if (!reason) return;

    if (
      !confirm(
        "Mark layout work as started? This locks the setup/layout fee as non-refundable.",
      )
    ) {
      return;
    }

    setSaving(true);

    const response = await fetch(`/api/admin/customers/${customer.id}/production`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "start_layout", reason }),
    });
    const result = await response.json();

    if (!response.ok) {
      showAdminNotification(
        "error",
        result.error || "Could not mark layout work as started.",
      );
      setSaving(false);
      return;
    }

    await loadData();
    showAdminNotification(
      result.alreadyStarted ? "success" : "warning",
      result.alreadyStarted
        ? "Layout work was already marked as started."
        : "Layout work started. Setup fee is now non-refundable.",
    );
    setSaving(false);
  };

  const updateCustomerMessage = async (message: CustomerMessage) => {
    const draft = messageDrafts[message.id] || {
      status: message.status,
      adminNote: message.adminNote || "",
    };
    const reason = requireReason(
      "Reason for updating this support message review:",
    );
    if (!reason) return;

    setSaving(true);
    const response = await fetch("/api/admin/customer-messages", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerId: customer?.id,
        messageId: message.id,
        status: draft.status,
        adminNote: draft.adminNote,
        reason,
      }),
    });
    const result = await response.json();

    if (!response.ok) {
      console.error("Update message error:", result);
      showAdminNotification("error", result.error || "Could not update message.");
      setSaving(false);
      return;
    }

    await loadData();
    showAdminNotification("success", "Message updated.");
    setSaving(false);
  };

  const sendCustomerMessageReply = async (message: CustomerMessage) => {
    const reply = (messageReplyDrafts[message.id] || "").trim();

    if (reply.length < 5) {
      showAdminNotification(
        "error",
        "Write a customer-visible reply of at least 5 characters.",
      );
      return;
    }

    const draft = messageDrafts[message.id] || {
      status: "waiting_for_customer",
      adminNote: message.adminNote || "",
    };

    setSaving(true);
    const response = await fetch("/api/admin/customer-messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerId: customer?.id,
        messageId: message.id,
        reply,
        status: draft.status || "waiting_for_customer",
      }),
    });
    const result = await response.json();

    if (!response.ok) {
      console.error("Send support reply error:", result);
      showAdminNotification(
        "error",
        result.error || "Could not send support reply.",
      );
      setSaving(false);
      return;
    }

    setMessageReplyDrafts((current) => ({ ...current, [message.id]: "" }));
    await loadData();
    showAdminNotification(
      result.warning ? "warning" : "success",
      result.warning
        ? `Reply saved, but email was not sent: ${result.warning}`
        : "Reply saved and email notification sent.",
    );
    setSaving(false);
  };

  const updateCustomerAsset = async (asset: CustomerAsset) => {
    const draft = assetDrafts[asset.id] || {
      status: asset.status || "new",
      adminNote: asset.adminNote || "",
    };
    const reason = requireReason(
      "Reason for updating this display material review:",
    );
    if (!reason) return;

    setSaving(true);
    const response = await fetch("/api/admin/customer-assets", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerId: customer?.id,
        assetId: asset.id,
        status: draft.status,
        adminNote: draft.adminNote,
        reason,
      }),
    });
    const result = await response.json();

    if (!response.ok) {
      console.error("Update material error:", result);
      showAdminNotification(
        "error",
        result.error || "Could not update display material.",
      );
      setSaving(false);
      return;
    }

    await loadData();
    showAdminNotification("success", "Display material updated.");
    setSaving(false);
  };

  const cancelSubscription = async () => {
    if (!customer) return;

    if (!customer.stripe_subscription_id) {
      showAdminNotification("warning", "No Stripe subscription found.");
      return;
    }

    const reason = requireReason(
      "Reason for scheduling cancellation at the end of the paid period:",
    );
    if (!reason) return;

    await runSubscriptionAction({
      action: "cancel_period_end",
      payload: { reason },
      successMessage:
        "Cancellation scheduled. Customer keeps access until the paid period ends.",
    });
  };

  const cancelSubscriptionImmediately = async () => {
    if (!customer) return;
    const reason = requireReason(
      "Reason for immediate cancellation. This blocks display access now:",
    );
    if (!reason) return;
    if (!confirm("Immediately cancel Stripe subscription and block displays now?")) {
      return;
    }
    await runSubscriptionAction({
      action: "cancel_immediately",
      payload: { reason },
      successMessage: "Subscription cancelled immediately and access blocked.",
    });
  };

  const pauseSubscription = async () => {
    if (!customer) return;
    const reason = requireReason("Reason for pausing billing and display access:");
    if (!reason) return;
    await runSubscriptionAction({
      action: "pause_subscription",
      payload: { reason },
      successMessage: "Subscription paused. Display access is blocked.",
    });
  };

  const resumeSubscription = async () => {
    if (!customer) return;
    const reason = requireReason("Reason for resuming billing and display access:");
    if (!reason) return;
    if (!confirm("Resume billing collection and display access?")) return;
    await runSubscriptionAction({
      action: "resume_subscription",
      payload: { reason },
      successMessage: "Subscription resumed.",
    });
  };

  const applyTemporaryDiscount = async () => {
    if (!customer) return;
    const percentOff = Number(window.prompt("Discount percent, 1-100:"));
    if (!Number.isFinite(percentOff) || percentOff <= 0 || percentOff > 100) {
      showAdminNotification("warning", "Enter a discount between 1 and 100%.");
      return;
    }
    const durationMonths = Number(window.prompt("Discount duration in months, 1-36:"));
    if (
      !Number.isFinite(durationMonths) ||
      durationMonths < 1 ||
      durationMonths > 36
    ) {
      showAdminNotification("warning", "Enter a duration between 1 and 36 months.");
      return;
    }
    const reason = requireReason("Reason for this temporary discount:");
    if (!reason) return;
    await runSubscriptionAction({
      action: "apply_temporary_discount",
      payload: {
        percentOff,
        durationMonths,
        reason,
      },
      successMessage: "Temporary Stripe discount applied and recorded.",
    });
  };

  const refundFirstPayment = async () => {
    if (!customer) return;
    const reason = requireReason("Reason for refunding the first payment:");
    if (!reason) return;

    if (
      !confirm(
        "Refund this customer's first payment? This is only allowed before layout work starts.",
      )
    ) {
      return;
    }

    setSaving(true);

    const response = await fetch(`/api/admin/customers/${customer.id}/refund`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    const data = await response.json();

    if (!response.ok) {
      console.error("Refund payment error:", data);
      showAdminNotification(
        "error",
        data.error || "Could not refund the first payment.",
      );
      setSaving(false);
      return;
    }

    await loadData();
    showAdminNotification("success", "First payment refunded and customer suspended.");
    setSaving(false);
  };

  const reactivateCustomer = async () => {
    if (!customer) return;
    const reason = requireReason("Reason for reactivating this customer:");
    if (!reason) return;
    if (!confirm("Reactivate this customer")) return;
    await runSubscriptionAction({
      action: "reactivate_customer",
      payload: { reason },
      successMessage: "Customer reactivated and audit history recorded.",
    });
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

    const reason = requireReason("Reason for preparing this quote and onboarding link:");
    if (!reason) return;

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
        reason,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Prepare quote and onboarding error:", data);
      if (data.onboardingUrl) {
        setQuoteResultUrl(data.onboardingUrl);
        await loadData();
      }
      showAdminNotification(
        data.onboardingUrl ? "warning" : "error",
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

    const reason = window.prompt(
      "Reason for permanently deleting this draft customer:",
    )?.trim();

    if (!reason) return;

    setSaving(true);

    const response = await fetch(`/api/admin/customers/${customer.id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
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
    setDeleteConfirmationOpen(false);
    router.push("/admin/customers");
  };

  const anonymizeCustomer = async () => {
    if (!customer) return;

    const confirmed = window.confirm(
      "Anonymize this customer? Contact details, uploaded material, and support messages will be removed, while payment/order/audit references are retained.",
    );

    if (!confirmed) return;

    const reason = window.prompt(
      "Reason for anonymizing this customer and removing personal data:",
    )?.trim();

    if (!reason) return;

    setSaving(true);
    const response = await fetch(`/api/admin/customers/${customer.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "anonymize_customer", reason }),
    });
    const data = await response.json();

    if (!response.ok) {
      console.error("Anonymize customer error:", data);
      showAdminNotification(
        "error",
        data.error || "Could not anonymize customer.",
      );
      setSaving(false);
      return;
    }

    await loadData();
    showAdminNotification("success", "Customer anonymized.");
    setSaving(false);
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const section = searchParams.get("section");
    if (customerDetailSectionIds.includes(section as CustomerDetailSection)) {
      setActiveSection(section as CustomerDetailSection);
    }

    const view = searchParams.get("view");
    if (view === "messages" || view === "uploads") {
      setCommunicationView(view);
    }
  }, [searchParams]);

  const navigateToSection = (section: CustomerDetailSection) => {
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("section", section);
    if (section !== "communication") nextParams.delete("view");
    router.push(`/admin/customers/${customerId}?${nextParams.toString()}`);
  };

  const navigateCommunicationView = (view: CommunicationView) => {
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("section", "communication");
    nextParams.set("view", view);
    router.push(`/admin/customers/${customerId}?${nextParams.toString()}`);
  };

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
    { id: "history", label: "History", count: auditEvents.length },
  ];
  const quoteLines = quoteItems
    .map((item) => {
      const plan =
        pricingPlans.find(
          (pricingPlan) => pricingPlan.code === item.pricingPlanCode,
        ) || pricingPlans[0];
      const quantity = Math.min(50, Math.max(1, Number(item.quantity) || 1));
      const hardwareFee =
        plan?.hardware_fee_sek ?? 0;
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
  const quoteStartupVat = includedVatFromGross(quoteStartupTotal);
  const quoteMonthlyVat = includedVatFromGross(
    quoteMonthlySubtotal -
      (quoteDiscountMonths > 0 ? quoteMonthlyDiscountAmount : 0),
  );
  const currentOnboardingLink = customer.onboarding_token
    ? `/onboarding/${customer.onboarding_token}`
    : "";
  const productionTrackingReady =
    customer.production_status !== null ||
    customer.layout_started_at !== null ||
    customer.setup_fee_locked_at !== null;

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
        <div className="admin-compact-heading">
          <h2 className="admin-card-title text-xl">Customer overview</h2>
          <button
            type="button"
            className="admin-button-primary"
            onClick={() => setIsEditingCustomer((current) => !current)}
          >
            {isEditingCustomer ? "Close edit" : "Edit customer details"}
          </button>
        </div>

        <div className="admin-compact-info-grid mt-4">
          <InfoRow label="Customer number" value={customer.customer_number || "Pending"} />
          <InfoRow label="Created" value={formatDateTime(customer.created_at)} />
          <InfoRow label="Updated" value={formatDateTime(customer.updated_at)} />
          <InfoRow label="Company" value={customer.name} />
          <InfoRow label="Contact person" value={customer.contact_person || "Not set"} />
          <InfoRow label="Contact email" value={customer.email || "Not set"} />
          <InfoRow label="Phone" value={customer.phone || "Not set"} />
          <InfoRow label="Billing email" value={customer.billing_email || customer.email || "Not set"} />
          <InfoRow
            label="Organisation number"
            value={customer.organisation_number || "Not set"}
          />
          <InfoRow label="Category" value={customer.business_category || "Not set"} />
          <InfoRow label="Website/social" value={customer.website_url || "Not set"} />
          <InfoRow label="Preferred contact" value={customer.preferred_contact_channel || "Email"} />
          <InfoRow label="Address" value={[customer.address, customer.postal_code, customer.city, customer.country].filter(Boolean).join(", ") || "Not set"} />
          <InfoRow
            label="Requested screens"
            value={
              customer.requested_screen_quantity
                ? String(customer.requested_screen_quantity)
                : "Not set"
            }
          />
          <InfoRow label="Remote support" value={customer.remote_support_consent ? "Consent given" : "No consent"} />
          <InfoRow label="Statistics" value={customer.analytics_consent ? "Allowed" : "Not allowed"} />
          <InfoRow label="Marketing" value={customer.marketing_consent ? "Allowed" : "Not allowed"} />
          <InfoRow label="Activated" value={formatDateTime(customer.activated_at)} />
          <InfoRow label="Cancelled" value={formatDateTime(customer.cancelled_at)} />
          <InfoRow label="Customer ID" value={customer.id} />
        </div>

        {customer.notes && (
          <div className="admin-compact-note mt-4">
            <strong>Internal notes</strong>
            <p>{customer.notes}</p>
          </div>
        )}

        {isEditingCustomer && (
          <div className="admin-edit-panel mt-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Input label="Company name" value={editName} onChange={setEditName} required />
              <Input label="Contact person" value={editContactPerson} onChange={setEditContactPerson} />
              <Input label="Phone" value={editPhone} onChange={setEditPhone} />
              <Input label="Billing email" value={editBillingEmail} onChange={setEditBillingEmail} />
              <Input label="Organisation number" value={editOrganisationNumber} onChange={setEditOrganisationNumber} />
              <Input label="Business category" value={editBusinessCategory} onChange={setEditBusinessCategory} />
              <Input label="Website or social link" value={editWebsiteUrl} onChange={setEditWebsiteUrl} />
              <label className="text-sm font-semibold text-slate-700">
                Preferred contact
                <select
                  value={editPreferredContactChannel}
                  onChange={(event) => setEditPreferredContactChannel(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none"
                >
                  <option value="email">Email</option>
                  <option value="phone">Phone</option>
                  <option value="sms">SMS</option>
                </select>
              </label>
              <Input label="Address" value={editAddress} onChange={setEditAddress} />
              <Input label="Postal code" value={editPostalCode} onChange={setEditPostalCode} />
              <Input label="City" value={editCity} onChange={setEditCity} />
              <Input label="Country" value={editCountry} onChange={setEditCountry} />
            </div>
            <label className="mt-4 block text-sm font-semibold text-slate-700">
              Internal notes
              <textarea
                value={editNotes}
                onChange={(event) => setEditNotes(event.target.value)}
                rows={3}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none"
              />
            </label>
            <label className="mt-4 block text-sm font-semibold text-slate-700">
              Reason for this customer detail change *
              <textarea
                value={editReason}
                onChange={(event) => setEditReason(event.target.value)}
                rows={2}
                placeholder="Example: corrected billing email after customer confirmation."
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none"
              />
            </label>
            <button
              onClick={saveCustomerDetails}
              disabled={saving}
              className="admin-button-primary mt-4 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save customer details"}
            </button>
          </div>
        )}

        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50/70 p-4">
          <h3 className="font-semibold text-red-900">Danger zone</h3>
          <p className="mt-1 text-sm text-red-700">
            Permanently delete this customer and related database records. Use
            this only for wrong drafts or duplicates without payment history.
            Use anonymization for retained customer history.
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={anonymizeCustomer}
              disabled={saving}
              className="rounded-xl bg-amber-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {saving ? "Saving..." : "Anonymize customer"}
            </button>
            <button
              type="button"
              onClick={() => setDeleteConfirmationOpen(true)}
              disabled={saving}
              className="rounded-xl bg-red-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {saving ? "Deleting..." : "Delete customer"}
            </button>
          </div>
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
                        <span>Screen device</span>
                        <strong>{formatSek(line.deviceSubtotal)}</strong>
                  </div>
                  <div className="mt-1 flex justify-between gap-3 text-xs">
                    <span>Monthly incl. VAT</span>
                    <strong>{formatSek(line.monthlySubtotal)} / month</strong>
                  </div>
                    </div>
                  ))}
                  <div className="flex justify-between gap-3">
                    <span>Setup fee incl. VAT</span>
                    <strong>{formatSek(primaryQuotePlan.setup_fee_sek)}</strong>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span>Device discount</span>
                    <strong>-{formatSek(quoteDeviceDiscountAmount)}</strong>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span>Shipping incl. VAT</span>
                    <strong>{formatSek(quoteShippingSubtotal)}</strong>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span>Monthly incl. VAT</span>
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
                    <span>Initial payment incl. VAT</span>
                    <strong>{formatSek(quoteStartupTotal)}</strong>
                  </div>
                  <div className="flex justify-between gap-3 text-xs text-slate-500">
                    <span>Included VAT</span>
                    <strong>{formatSek(quoteStartupVat.vat)}</strong>
                  </div>
                  <p className="text-xs text-slate-500">
                    Screens: {quoteScreenQuantity}. Free trial:{" "}
                    {primaryQuotePlan.trial_days} days. Monthly
                    discount duration: {quoteDiscountMonths} months. Monthly
                    VAT included: {formatSek(quoteMonthlyVat.vat)}. Stripe
                    shows the VAT portion without increasing these totals.
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

        <div className="admin-table-wrap mt-4">
          <table className="admin-data-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Status / value</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Onboarding token</td>
                <td>{customer.onboarding_token || "Not generated yet"}</td>
                <td>{formatDateTime(customer.onboarding_token_expires_at)}</td>
              </tr>
              <tr>
                <td>Terms accepted</td>
                <td>{customer.terms_accepted_at ? "Yes" : "No"}</td>
                <td>{formatDateTime(customer.terms_accepted_at)}</td>
              </tr>
              <tr>
                <td>Privacy accepted</td>
                <td>{customer.privacy_accepted_at ? "Yes" : "No"}</td>
                <td>{formatDateTime(customer.privacy_accepted_at)}</td>
              </tr>
              <tr>
                <td>Payment</td>
                <td>{customer.payment_status || "Not paid"}</td>
                <td>{formatDateTime(customer.activated_at)}</td>
              </tr>
              <tr>
                <td>Stripe customer</td>
                <td>{customer.stripe_customer_id || "Not created yet"}</td>
                <td>{formatDateTime(customer.created_at)}</td>
              </tr>
              <tr>
                <td>Stripe subscription</td>
                <td>{customer.stripe_subscription_id || "Not created yet"}</td>
                <td>{formatDateTime(customer.updated_at)}</td>
              </tr>
              <tr>
                <td>Cancellation</td>
                <td>
                  {formatInactiveReason(customer.inactive_reason)} ·{" "}
                  {formatCancellationSource(customer.cancellation_source)}
                </td>
                <td>{formatDateTime(customer.cancelled_at)}</td>
              </tr>
              <tr>
                <td>Service access</td>
                <td>{customer.service_access_status || "Not set"}</td>
                <td>{formatDateTime(customer.service_access_until)}</td>
              </tr>
              <tr>
                <td>Production</td>
                <td>{formatProductionStatus(customer.production_status)}</td>
                <td>{formatDateTime(customer.layout_started_at)}</td>
              </tr>
              <tr>
                <td>Setup fee refund boundary</td>
                <td>
                  {!productionTrackingReady
                    ? "Migration needed"
                    : customer.setup_fee_locked_at
                    ? "Locked as non-refundable"
                    : customer.payment_status === "refunded"
                      ? "Already refunded before production"
                    : customer.payment_status === "paid"
                      ? "Refundable until layout work starts"
                      : "Not paid yet"}
                </td>
                <td>{formatDateTime(customer.setup_fee_locked_at)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div
          className={`mt-6 rounded-2xl border p-4 ${
            customer.setup_fee_locked_at
              ? "border-amber-200 bg-amber-50"
              : "border-blue-200 bg-blue-50"
          }`}
        >
          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                Refund rule
              </p>
              <h3 className="mt-1 text-lg font-black text-slate-950">
                {customer.setup_fee_locked_at
                  ? "Layout work has started"
                  : customer.payment_status === "refunded"
                    ? "First payment refunded before production"
                  : !productionTrackingReady
                    ? "Production tracking migration is needed"
                  : "Setup fee still refundable before production starts"}
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                {customer.setup_fee_locked_at
                  ? `Started ${formatDateTime(customer.layout_started_at)}. The setup/layout fee is marked non-refundable from this point.`
                  : customer.payment_status === "refunded"
                    ? "The first payment was refunded before layout work started. Keep the customer suspended unless a new quote and payment are created."
                  : !productionTrackingReady
                    ? "Apply the latest Supabase migration before using the layout-start and refund-boundary tools."
                  : "If the customer cancels before layout work starts, the setup/layout fee can still be handled as refundable. Mark layout work started only when production actually begins."}
              </p>
            </div>

            {productionTrackingReady && !customer.setup_fee_locked_at && customer.payment_status === "paid" && (
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={startLayoutWork}
                  disabled={saving}
                  className="rounded-xl bg-amber-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Mark layout work started"}
                </button>
                <button
                  type="button"
                  onClick={refundFirstPayment}
                  disabled={saving}
                  className="rounded-xl bg-red-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Refund first payment"}
                </button>
              </div>
            )}
          </div>
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
                  <>
                    <button
                      onClick={pauseSubscription}
                      disabled={saving}
                      className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      {saving ? "Saving..." : "Pause subscription"}
                    </button>
                    <button
                      onClick={applyTemporaryDiscount}
                      disabled={saving}
                      className="rounded-xl bg-purple-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      {saving ? "Saving..." : "Apply discount"}
                    </button>
                    <button
                      onClick={cancelSubscription}
                      disabled={saving}
                      className="rounded-xl bg-red-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      {saving ? "Saving..." : "Cancel at period end"}
                    </button>
                    <button
                      onClick={cancelSubscriptionImmediately}
                      disabled={saving}
                      className="rounded-xl bg-red-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      {saving ? "Saving..." : "Cancel now"}
                    </button>
                  </>
                )}
              </div>
            </>
          ) : customer.status === "suspended" ? (
            <>
              <p className="rounded-2xl bg-red-50 p-4 text-sm font-medium text-red-700">
                Customer is suspended. Displays should not run for this
                customer.
              </p>

              {customer.stripe_subscription_id &&
              customer.service_access_status === "paused" ? (
                  <button
                    onClick={resumeSubscription}
                    disabled={saving}
                    className="mt-4 rounded-xl bg-green-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {saving ? "Saving..." : "Resume subscription"}
                  </button>
                ) : (
                  <button
                    onClick={reactivateCustomer}
                    disabled={saving}
                    className="mt-4 rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {saving ? "Saving..." : "Reactivate customer"}
                  </button>
                )}
            </>
          ) : (
            <>
              {customer.payment_status === "paid" && (
                <div className="mb-4 rounded-2xl border border-green-200 bg-green-50 p-4">
                  <p className="text-sm font-medium text-green-800">
                    Payment is complete. Activate the customer when content and
                    device assignment are ready; assigned display URLs will then
                    be allowed to run.
                  </p>
                  <button
                    type="button"
                    onClick={activateCustomer}
                    disabled={saving}
                    className="mt-4 rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {saving ? "Saving..." : "Mark customer active"}
                  </button>
                  {customer.stripe_subscription_id && (
                    <>
                      <button
                        type="button"
                        onClick={pauseSubscription}
                        disabled={saving}
                        className="ml-3 mt-4 rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                      >
                        {saving ? "Saving..." : "Pause subscription"}
                      </button>
                      <button
                        type="button"
                        onClick={applyTemporaryDiscount}
                        disabled={saving}
                        className="ml-3 mt-4 rounded-xl bg-purple-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                      >
                        {saving ? "Saving..." : "Apply discount"}
                      </button>
                      <button
                        type="button"
                        onClick={cancelSubscription}
                        disabled={saving}
                        className="ml-3 mt-4 rounded-xl bg-red-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                      >
                        {saving ? "Saving..." : "Cancel at period end"}
                      </button>
                    </>
                  )}
                </div>
              )}

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
                onClick={() => navigateCommunicationView("messages")}
                className={communicationView === "messages" ? "is-active" : ""}
              >
                Conversations ({messages.length})
              </button>
              <button
                type="button"
                onClick={() => navigateCommunicationView("uploads")}
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
                    <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      {item.ticketNumber || "No ticket"} ·{" "}
                      {item.requestType.replace(/_/g, " ")} · {item.priority}
                      {item.relatedTicketNumber
                        ? ` · Reply to ${item.relatedTicketNumber}`
                        : ""}
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

                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="grid gap-3 md:grid-cols-[220px_1fr]">
                    <label className="text-sm font-semibold text-slate-700">
                      Status
                      <select
                        id={`message-status-${item.id}`}
                        name={`messageStatus-${item.id}`}
                        value={messageDrafts[item.id]?.status || item.status}
                        onChange={(event) =>
                          setMessageDrafts((current) => ({
                            ...current,
                            [item.id]: {
                              status: event.target.value,
                              adminNote:
                                current[item.id]?.adminNote || item.adminNote || "",
                            },
                          }))
                        }
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none transition focus:border-[var(--admin-cyan)] focus:ring-2 focus:ring-cyan-100"
                      >
                        <option value="new">New</option>
                        <option value="customer_reply">Customer reply</option>
                        <option value="in_progress">In progress</option>
                        <option value="waiting_for_customer">Waiting for customer</option>
                        <option value="resolved">Resolved</option>
                      </select>
                    </label>
                    <label className="text-sm font-semibold text-slate-700">
                      Internal admin note
                      <textarea
                        id={`message-admin-note-${item.id}`}
                        name={`messageAdminNote-${item.id}`}
                        value={messageDrafts[item.id]?.adminNote || ""}
                        onChange={(event) =>
                          setMessageDrafts((current) => ({
                            ...current,
                            [item.id]: {
                              status: current[item.id]?.status || item.status,
                              adminNote: event.target.value,
                            },
                          }))
                        }
                        rows={3}
                        placeholder="Record troubleshooting notes or the next action."
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none transition focus:border-[var(--admin-cyan)] focus:ring-2 focus:ring-cyan-100"
                      />
                    </label>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => updateCustomerMessage(item)}
                      disabled={saving}
                      className="admin-button-primary disabled:opacity-50"
                    >
                      {saving ? "Saving..." : "Save message update"}
                    </button>
                    {item.adminNoteUpdatedAt && (
                      <span className="text-xs font-semibold text-slate-500">
                        Note updated {new Date(item.adminNoteUpdatedAt).toLocaleString("sv-SE")}
                      </span>
                    )}
                  </div>
                  <div className="mt-4 border-t border-slate-200 pt-4">
                    <label className="text-sm font-semibold text-slate-700">
                      Customer-visible reply
                      <textarea
                        id={`message-customer-reply-${item.id}`}
                        name={`messageCustomerReply-${item.id}`}
                        value={messageReplyDrafts[item.id] || ""}
                        onChange={(event) =>
                          setMessageReplyDrafts((current) => ({
                            ...current,
                            [item.id]: event.target.value,
                          }))
                        }
                        rows={4}
                        placeholder="Write the reply that the customer should see in the portal and receive by email."
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none transition focus:border-[var(--admin-cyan)] focus:ring-2 focus:ring-cyan-100"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => sendCustomerMessageReply(item)}
                      disabled={saving}
                      className="admin-button-primary mt-3 disabled:opacity-50"
                    >
                      {saving ? "Sending..." : "Send customer reply"}
                    </button>
                  </div>
                </div>

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
                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="grid gap-3 md:grid-cols-[220px_1fr]">
                    <label className="text-sm font-semibold text-slate-700">
                      Review status
                      <select
                        id={`asset-status-${asset.id}`}
                        name={`assetStatus-${asset.id}`}
                        value={assetDrafts[asset.id]?.status || asset.status || "new"}
                        onChange={(event) =>
                          setAssetDrafts((current) => ({
                            ...current,
                            [asset.id]: {
                              status: event.target.value,
                              adminNote:
                                current[asset.id]?.adminNote || asset.adminNote || "",
                            },
                          }))
                        }
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none transition focus:border-[var(--admin-cyan)] focus:ring-2 focus:ring-cyan-100"
                      >
                        <option value="new">New</option>
                        <option value="reviewed">Reviewed</option>
                        <option value="archived">Archived</option>
                      </select>
                    </label>
                    <label className="text-sm font-semibold text-slate-700">
                      Internal review note
                      <textarea
                        id={`asset-admin-note-${asset.id}`}
                        name={`assetAdminNote-${asset.id}`}
                        value={assetDrafts[asset.id]?.adminNote || ""}
                        onChange={(event) =>
                          setAssetDrafts((current) => ({
                            ...current,
                            [asset.id]: {
                              status: current[asset.id]?.status || asset.status || "new",
                              adminNote: event.target.value,
                            },
                          }))
                        }
                        rows={3}
                        maxLength={1000}
                        placeholder="Record review outcome, content risks, or next action."
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none transition focus:border-[var(--admin-cyan)] focus:ring-2 focus:ring-cyan-100"
                      />
                    </label>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => updateCustomerAsset(asset)}
                      disabled={saving}
                      className="admin-button-primary disabled:opacity-50"
                    >
                      {saving ? "Saving..." : "Save material review"}
                    </button>
                    {asset.reviewedAt && (
                      <span className="text-xs font-semibold text-slate-500">
                        Reviewed {new Date(asset.reviewedAt).toLocaleString("sv-SE")}
                      </span>
                    )}
                    {asset.adminNoteUpdatedAt && (
                      <span className="text-xs font-semibold text-slate-500">
                        Note updated {new Date(asset.adminNoteUpdatedAt).toLocaleString("sv-SE")}
                      </span>
                    )}
                  </div>
                </div>
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
                    <p className="mt-1 text-sm text-slate-500">
                      Stripe subscription:{" "}
                      {subscription.stripe_subscription_id || "Not created yet"}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      Latest Stripe invoice:{" "}
                      {subscription.stripe_invoice_id || "Not recorded yet"}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      Paid period: {formatDateTime(subscription.stripe_current_period_start)} -{" "}
                      {formatDateTime(subscription.stripe_current_period_end)}
                    </p>
                    {subscription.cancel_at_period_end && (
                      <p className="mt-1 text-sm font-semibold text-amber-700">
                        Cancels at period end:{" "}
                        {formatDateTime(subscription.cancellation_effective_at)}
                      </p>
                    )}
                    {subscription.pause_started_at && (
                      <p className="mt-1 text-sm font-semibold text-blue-700">
                        Paused: {formatDateTime(subscription.pause_started_at)}
                        {subscription.pause_reason
                          ? ` - ${subscription.pause_reason}`
                          : ""}
                      </p>
                    )}
                  </div>

                  <div className="text-sm text-slate-600 md:text-right">
                    <p>
                      Setup:{" "}
                      {formatSek(subscription.setup_fee_sek) || "Not recorded"}
                    </p>
                    <p>
                      Device: {formatSek(subscription.hardware_fee_sek)} x {subscription.screen_quantity || 1}
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
                      Tax: {formatStripeSek(subscription.tax_amount_sek) || "Pending"}{" "}
                      ({subscription.tax_status || "not calculated"})
                    </p>
                    <p>
                      Total:{" "}
                      {formatStripeSek(subscription.total_amount_sek) || "Pending"}
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
          History
      ============================== */}
      {activeSection === "history" && (
      <div className="admin-card p-6">
        <h2 className="admin-card-title text-xl">History</h2>
        <p className="admin-muted mt-2 text-sm">
          A searchable change trail for customer data, orders, devices,
          uploaded material, payment events, and admin actions.
        </p>

        {auditEvents.length === 0 ? (
          <p className="admin-muted mt-4">No history events yet.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {auditEvents.map((event) => (
              <div
                key={event.id}
                className="rounded-2xl border border-slate-200 bg-white/70 p-4"
              >
                <div className="flex flex-col justify-between gap-2 md:flex-row">
                  <div>
                    <p className="font-semibold text-slate-950">
                      {event.event_type.replace(/_/g, " ")}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {new Date(event.created_at).toLocaleString("sv-SE")} ·{" "}
                      {event.actor_type}
                      {event.actor_id ? ` · ${event.actor_id}` : ""}
                    </p>
                  </div>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">
                  {event.event_description}
                </p>
                <details className="mt-3 text-xs text-slate-600">
                  <summary className="cursor-pointer font-bold text-slate-800">
                    Metadata
                  </summary>
                  <pre className="mt-2 max-h-72 overflow-auto rounded-xl bg-slate-950 p-3 text-white">
                    {JSON.stringify(event.metadata, null, 2)}
                  </pre>
                </details>
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
      {deleteConfirmationOpen && customer && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 px-4 py-6 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-customer-title"
        >
          <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-red-200 bg-white shadow-2xl">
            <div className="bg-gradient-to-br from-slate-950 via-red-950 to-red-800 p-6 text-white">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-red-100">
                Permanent action
              </p>
              <h2 id="delete-customer-title" className="mt-3 text-2xl font-black">
                Delete customer?
              </h2>
              <p className="mt-2 text-sm leading-6 text-red-50">
                This removes the customer and cleanup-safe related records. Audit
                history is kept without the customer link for troubleshooting.
              </p>
            </div>

            <div className="space-y-4 p-6">
              <div className="rounded-2xl border border-red-100 bg-red-50 p-4">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-red-700">
                  Customer
                </p>
                <p className="mt-1 break-words text-base font-black text-red-950">
                  {customer.name}
                </p>
                <p className="mt-1 break-all text-xs font-semibold text-red-700">
                  {customer.email || customer.id}
                </p>
              </div>

              <p className="text-sm leading-6 text-slate-700">
                This cannot be undone from the admin panel. Use it only for
                wrong drafts or duplicates without Stripe/payment history.
                Customer history with payments should be suspended, refunded,
                cancelled, or anonymized instead of deleted.
              </p>

              <div className="flex flex-wrap justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setDeleteConfirmationOpen(false);
                  }}
                  disabled={saving}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={deleteCustomer}
                  disabled={saving}
                  className="rounded-xl bg-red-800 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-red-950/20 transition hover:bg-red-900 disabled:opacity-50"
                >
                  {saving ? "Deleting..." : "Delete customer"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function formatSek(amount: number | null) {
  if (amount === null) return "";

  return `${amount.toLocaleString("sv-SE", {
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  })} kr`;
}

function formatStripeSek(amount: number | null) {
  if (amount === null) return "";

  const hasOre = amount % 100 !== 0;
  return `${(amount / 100).toLocaleString("sv-SE", {
    minimumFractionDigits: hasOre ? 2 : 0,
    maximumFractionDigits: 2,
  })} kr`;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="admin-customer-detail-row">
      <span>{label}</span>
      <strong>{value}</strong>
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
