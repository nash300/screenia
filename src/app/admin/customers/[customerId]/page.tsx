"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { showAdminNotification } from "@/lib/admin/notifications";
import { getCustomerWorkflowAction } from "@/lib/admin/customer-workflow";
import { PRICING_PLANS } from "@/lib/pricing/plans";
import { includedVatFromGross } from "@/lib/pricing/vat";
import { calculateIncrementalSetupFeeSek } from "@/lib/pricing/setup-fee";
import {
  ADDITIONAL_SHIPPING_FEE_PER_DEVICE_SEK,
  INCLUDED_SHIPPING_DEVICE_COUNT,
  calculateShippingFeeSek,
} from "@/lib/pricing/shipping-fee";
import { isValidSwedishRegistrationNumber } from "@/lib/business/sweden";
import {
  deviceCountsTowardEntitlement,
  formatSek,
  formatStripeSek,
  inventoryTypeLabel,
  isSchemaMismatch,
  normalizeCustomer,
  normalizeSubscription,
  subscriptionCountsTowardDeviceEntitlement,
} from "./customer-detail-utils";
import type {
  AuditEvent,
  CommunicationView,
  Customer,
  CustomerAsset,
  CustomerDetailSection,
  CustomerMessage,
  CustomerOperation,
  CustomerOperationId,
  CustomerRefundCase,
  CustomerSubscription,
  Device,
  InventoryStockItem,
  PricingPlan,
  QuoteItem,
  SupabaseSchemaError,
} from "./types";

const customerDetailSectionIds: CustomerDetailSection[] = [
  "overview",
  "onboarding",
  "communication",
  "orders",
  "devices",
  "history",
];

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
  const [stockItems, setStockItems] = useState<InventoryStockItem[]>([]);
  const [subscriptions, setSubscriptions] = useState<CustomerSubscription[]>([]);
  const [refundCases, setRefundCases] = useState<CustomerRefundCase[]>([]);
  const [pricingPlans, setPricingPlans] = useState<PricingPlan[]>([]);
  const [messages, setMessages] = useState<CustomerMessage[]>([]);
  const [messageDrafts, setMessageDrafts] = useState<
    Record<string, { status: string; adminNote: string; reason: string }>
  >({});
  const [messageReplyDrafts, setMessageReplyDrafts] = useState<
    Record<string, string>
  >({});
  const [assets, setAssets] = useState<CustomerAsset[]>([]);
  const [assetDrafts, setAssetDrafts] = useState<
    Record<string, { status: string; adminNote: string; reason: string }>
  >({});
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageLoadedAt] = useState(() => Date.now());
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
  const [anonymizeReason, setAnonymizeReason] = useState("");
  const [anonymizeConfirmed, setAnonymizeConfirmed] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);
  const [isEditingCustomer, setIsEditingCustomer] = useState(false);
  const [activeSection, setActiveSection] =
    useState<CustomerDetailSection>("overview");
  const [communicationView, setCommunicationView] =
    useState<CommunicationView>("messages");
  const [stockTypeFilter, setStockTypeFilter] = useState("all");
  const [stockModelFilter, setStockModelFilter] = useState("all");
  const [stockAllocationLocation, setStockAllocationLocation] = useState("");
  const [stockAllocationReason, setStockAllocationReason] = useState("");
  const [allocatingStockItemId, setAllocatingStockItemId] = useState<string | null>(
    null,
  );
  const [quotePlanCode, setQuotePlanCode] = useState("");
  const [quoteNotes, setQuoteNotes] = useState("");
  const [quoteResultUrl, setQuoteResultUrl] = useState("");
  const [quoteItems, setQuoteItems] = useState<QuoteItem[]>([
    { id: "quote-item-1", pricingPlanCode: "", quantity: 1 },
  ]);
  const [quoteDiscountPercent, setQuoteDiscountPercent] = useState(0);
  const [quoteDiscountMonths, setQuoteDiscountMonths] = useState(0);
  const [schemaNotice, setSchemaNotice] = useState("");
  const [selectedOperationId, setSelectedOperationId] =
    useState<CustomerOperationId | "">("");
  const [operationReason, setOperationReason] = useState("");
  const [operationDiscountPercent, setOperationDiscountPercent] = useState("20");
  const [operationDiscountMonths, setOperationDiscountMonths] = useState("3");
  const [operationRefundAmountSek, setOperationRefundAmountSek] = useState("100");
  const [operationConfirmed, setOperationConfirmed] = useState(false);
  const [activeDiscountCount, setActiveDiscountCount] = useState(0);
  const [previewUrlDraft, setPreviewUrlDraft] = useState("");
  const [previewPublishReason, setPreviewPublishReason] = useState("");

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

  const formatTrialRemaining = (
    value: string | null | undefined,
    currentPeriodStart?: string | null,
  ) => {
    if (!value) return "No trial end recorded";
    const trialEnd = new Date(value);
    if (Number.isNaN(trialEnd.getTime())) return "Invalid trial end date";

    const periodStart = currentPeriodStart ? new Date(currentPeriodStart) : null;
    const billingHasPassedTrial =
      periodStart &&
      !Number.isNaN(periodStart.getTime()) &&
      periodStart.getTime() >= trialEnd.getTime();

    if (billingHasPassedTrial) {
      return `Trial ended ${formatDateTime(value)}`;
    }

    const daysRemaining = Math.max(
      0,
      Math.ceil((trialEnd.getTime() - pageLoadedAt) / (24 * 60 * 60 * 1000)),
    );

    return daysRemaining > 0
      ? `${daysRemaining} day${daysRemaining === 1 ? "" : "s"} remaining (ends ${formatDateTime(value)})`
      : `Trial ended ${formatDateTime(value)}`;
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
        preview_url,
        preview_status,
        preview_feedback,
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
      setStockItems([]);
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
    setPreviewUrlDraft(loadedCustomer.preview_url || "");
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
      .select("id, name, device_code, is_active, inventory_status, make, model, serial_number, playlists(count)")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false });

    if (devicesError) {
      console.error("Devices error:", devicesError);
      setDevices([]);
    } else {
      setDevices((devicesData || []) as Device[]);
    }

    const { data: stockData, error: stockError } = await supabase
      .from("inventory_items")
      .select(
        "id, item_code, item_type, status, condition, make, model, serial_number, seller, notes",
      )
      .eq("status", "in_stock")
      .is("device_id", null)
      .order("created_at", { ascending: false });

    if (stockError) {
      if (!isSchemaMismatch(stockError)) {
        console.error("Inventory stock error:", stockError);
      }
      setStockItems([]);
    } else {
      setStockItems((stockData || []) as InventoryStockItem[]);
    }

    const subscriptionSelects = [
      `
          id,
          order_number,
          status,
          setup_fee_sek,
          setup_fee_paid,
          hardware_fee_sek,
          shipping_fee_sek,
          base_shipping_fee_sek,
          shipping_included_devices,
          additional_shipping_fee_per_device_sek,
          additional_shipping_device_count,
          monthly_fee_sek,
          tax_amount_sek,
          total_amount_sek,
          tax_status,
          fulfillment_status,
          inventory_status,
          stripe_checkout_session_id,
          stripe_subscription_id,
          stripe_invoice_id,
          stripe_payment_status,
          trial_starts_at,
          trial_ends_at,
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
          quote_items,
          quote_notes,
          created_at
        `,
      `
          id,
          order_number,
          status,
          setup_fee_sek,
          monthly_fee_sek,
          quote_items,
          quote_notes,
          stripe_checkout_session_id,
          stripe_subscription_id,
          trial_starts_at,
          trial_ends_at,
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
          setup_fee_paid: null,
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
          stripe_payment_status: null,
          trial_starts_at: null,
          trial_ends_at: null,
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
          quote_items: null,
          quote_notes: null,
          created_at: subscription.created_at,
        })),
      );
    } else {
      if (usedSubscriptionFallback) {
        setSchemaNotice(
          "The database is missing the latest order columns. Some order details are hidden until migrations are applied.",
        );
      }
      const normalizedSubscriptions = (subscriptionData || []).map(
        normalizeSubscription,
      );
      setSubscriptions(normalizedSubscriptions);

      const latestQuotedSubscription = normalizedSubscriptions.find(
        (subscription) =>
          Array.isArray(subscription.quote_items) &&
          subscription.quote_items.length > 0,
      );

      if (latestQuotedSubscription?.quote_items?.length) {
        setQuoteItems(
          latestQuotedSubscription.quote_items.map((item, index) => ({
            id: `quoted-${latestQuotedSubscription.id}-${index}`,
            pricingPlanCode: item.pricingPlanCode || "",
            quantity: Math.min(50, Math.max(1, Number(item.quantity) || 1)),
          })),
        );
        setQuotePlanCode(
          latestQuotedSubscription.quote_items[0]?.pricingPlanCode || "",
        );
        setQuoteDiscountPercent(
          Number(latestQuotedSubscription.device_discount_percent) || 0,
        );
        setQuoteDiscountMonths(
          Number(latestQuotedSubscription.device_discount_months) || 0,
        );
        setQuoteNotes(latestQuotedSubscription.quote_notes || "");
      }
    }

    const { data: activeDiscountData, error: activeDiscountError } =
      await supabase
        .from("subscription_adjustments")
        .select("id")
        .eq("customer_id", customerId)
        .eq("status", "active");

    if (activeDiscountError) {
      console.warn("Active discounts could not be loaded.", activeDiscountError);
      setActiveDiscountCount(0);
    } else {
      setActiveDiscountCount((activeDiscountData || []).length);
    }

    const { data: refundCaseData, error: refundCaseError } = await supabase
      .from("customer_refund_cases")
      .select(
        "id, order_number, request_type, requested_amount_ore, approved_amount_ore, currency, customer_reason, admin_decision, admin_reason, status, stripe_payment_intent_id, stripe_refund_id, requested_at, decided_at, created_at",
      )
      .eq("customer_id", customerId)
      .order("requested_at", { ascending: false });

    if (refundCaseError) {
      if (!isSchemaMismatch(refundCaseError)) {
        console.warn("Refund cases could not be loaded.", refundCaseError);
      }
      setRefundCases([]);
    } else {
      setRefundCases((refundCaseData || []) as CustomerRefundCase[]);
    }

    const { data: pricingData, error: pricingError } = await supabase
      .from("pricing_plans")
      .select(
        "id, code, name, resolution, setup_fee_sek, hardware_fee_sek, shipping_fee_sek, shipping_included_devices, additional_shipping_fee_sek, monthly_fee_sek, trial_days, currency",
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
        shipping_included_devices: plan.shippingIncludedDevices,
        additional_shipping_fee_sek: plan.additionalShippingFeeSek,
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
              reason: "",
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
              reason: "",
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

  const pauseSubscription = async (reason: string) => {
    await runSubscriptionAction({
      action: "pause_subscription",
      payload: { reason },
      successMessage: "Subscription paused. Display access is blocked.",
    });
  };

  const resumeSubscription = async (reason: string) => {
    await runSubscriptionAction({
      action: "resume_subscription",
      payload: { reason },
      successMessage: "Subscription resumed.",
    });
  };

  const startLayoutWork = async (reason: string) => {
    if (!customer) return;

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
      reason: "",
    };
    const reason = draft.reason.trim();
    if (reason.length < 5) {
      showAdminNotification(
        "error",
        "Add a reason of at least 5 characters before saving this message review.",
      );
      return;
    }

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
    setMessageDrafts((current) => ({
      ...current,
      [message.id]: { ...draft, reason: "" },
    }));
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
      reason: "",
    };
    const replyStatus =
      draft.status === "resolved" ? "resolved" : "waiting_for_customer";

    setSaving(true);
    const response = await fetch("/api/admin/customer-messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerId: customer?.id,
        messageId: message.id,
        reply,
        status: replyStatus,
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
      reason: "",
    };
    const reason = draft.reason.trim();
    if (reason.length < 5) {
      showAdminNotification(
        "error",
        "Add a reason of at least 5 characters before saving this material review.",
      );
      return;
    }

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
    setAssetDrafts((current) => ({
      ...current,
      [asset.id]: { ...draft, reason: "" },
    }));
    showAdminNotification("success", "Display material updated.");
    setSaving(false);
  };

  const publishCustomerPreview = async () => {
    if (!customer) return;
    if (!/^https?:\/\//i.test(previewUrlDraft.trim())) {
      showAdminNotification("warning", "Enter a complete http or https preview URL.");
      return;
    }
    if (previewPublishReason.trim().length < 5) {
      showAdminNotification(
        "warning",
        "Add a reason of at least 5 characters before publishing the preview.",
      );
      return;
    }

    setSaving(true);
    const response = await fetch(`/api/admin/customers/${customer.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "publish_preview",
        previewUrl: previewUrlDraft.trim(),
        reason: previewPublishReason.trim(),
      }),
    });
    const result = await response.json();

    if (!response.ok) {
      showAdminNotification("error", result.error || "Could not publish preview.");
      setSaving(false);
      return;
    }

    setPreviewPublishReason("");
    await loadData();
    showAdminNotification(
      result.warning ? "warning" : "success",
      result.warning
        ? `Preview published, but email was not sent: ${result.warning}`
        : "Preview published and customer email sent.",
    );
    setSaving(false);
  };

  const refundFirstPayment = async (reason: string) => {
    if (!customer) return;

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

  const runRefundCaseAction = async ({
    action,
    reason,
    amountSek,
    successMessage,
  }: {
    action: "record_post_layout_request" | "issue_partial_refund";
    reason: string;
    amountSek: number;
    successMessage: string;
  }) => {
    if (!customer) return false;

    setSaving(true);
    const response = await fetch(
      `/api/admin/customers/${customer.id}/refund-case`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason, amountSek }),
      },
    );
    const result = await response.json();

    if (!response.ok) {
      showAdminNotification(
        "error",
        result.error || "Could not record the refund case.",
      );
      setSaving(false);
      return false;
    }

    await loadData();
    showAdminNotification("success", successMessage);
    setSaving(false);
    return true;
  };

  const openCustomerOperation = (operationId: CustomerOperationId) => {
    setSelectedOperationId(operationId);
    setOperationReason("");
    setOperationDiscountPercent("20");
    setOperationDiscountMonths("3");
    setOperationRefundAmountSek(
      operationId === "record_post_layout_refund_request"
        ? String((subscriptions[0]?.total_amount_sek || 0) / 100)
        : "100",
    );
    setOperationConfirmed(false);
  };

  const closeCustomerOperation = () => {
    if (saving) return;
    setSelectedOperationId("");
    setOperationReason("");
    setOperationConfirmed(false);
  };

  const completeCustomerOperation = async () => {
    if (!customer || !selectedOperationId) return;

    const cleanedReason = operationReason.trim();
    if (cleanedReason.length < 5) {
      showAdminNotification(
        "warning",
        "A reason of at least 5 characters is required before continuing.",
      );
      return;
    }

    const selectedOperation = customerOperations.find(
      (operation) => operation.id === selectedOperationId,
    );

    if (selectedOperation?.requiresConfirmation && !operationConfirmed) {
      showAdminNotification("warning", "Confirm the impact before continuing.");
      return;
    }

    const finish = () => {
      setSelectedOperationId("");
      setOperationReason("");
      setOperationConfirmed(false);
    };

    if (selectedOperationId === "start_layout") {
      await startLayoutWork(cleanedReason);
      finish();
      return;
    }

    if (selectedOperationId === "refund_first_payment") {
      await refundFirstPayment(cleanedReason);
      finish();
      return;
    }

    if (
      selectedOperationId === "record_post_layout_refund_request" ||
      selectedOperationId === "issue_partial_refund"
    ) {
      const amountSek = Number(operationRefundAmountSek);
      if (!Number.isFinite(amountSek) || amountSek <= 0) {
        showAdminNotification("warning", "Enter a refund amount greater than zero.");
        return;
      }

      const success = await runRefundCaseAction({
        action:
          selectedOperationId === "record_post_layout_refund_request"
            ? "record_post_layout_request"
            : "issue_partial_refund",
        reason: cleanedReason,
        amountSek,
        successMessage:
          selectedOperationId === "record_post_layout_refund_request"
            ? "Post-layout refund request recorded. No Stripe refund was created."
            : "Partial refund issued and recorded. Customer service remains active.",
      });
      if (success) finish();
      return;
    }

    if (selectedOperationId === "apply_temporary_discount") {
      const percentOff = Number(operationDiscountPercent);
      const durationMonths = Number(operationDiscountMonths);

      if (!Number.isFinite(percentOff) || percentOff <= 0 || percentOff > 100) {
        showAdminNotification("warning", "Enter a discount between 1 and 100%.");
        return;
      }

      if (
        !Number.isFinite(durationMonths) ||
        durationMonths < 1 ||
        durationMonths > 36
      ) {
        showAdminNotification(
          "warning",
          "Enter a duration between 1 and 36 months.",
        );
        return;
      }

      await runSubscriptionAction({
        action: "apply_temporary_discount",
        payload: {
          percentOff,
          durationMonths,
          reason: cleanedReason,
        },
        successMessage: "Temporary Stripe discount applied and recorded.",
      });
      finish();
      return;
    }

    if (selectedOperationId === "remove_temporary_discount") {
      await runSubscriptionAction({
        action: "remove_temporary_discount",
        payload: { reason: cleanedReason },
        successMessage: "Temporary Stripe discount removed and recorded.",
      });
      finish();
      return;
    }

    if (selectedOperationId === "pause_subscription") {
      await pauseSubscription(cleanedReason);
      finish();
      return;
    }

    if (selectedOperationId === "resume_subscription") {
      await resumeSubscription(cleanedReason);
      finish();
      return;
    }

    const successMessages: Record<CustomerOperationId, string> = {
      activate_customer: "Customer activated and audit history recorded.",
      suspend_customer: "Customer suspended and audit history recorded.",
      reactivate_customer: "Customer reactivated and audit history recorded.",
      pause_subscription: "Subscription paused. Display access is blocked.",
      resume_subscription: "Subscription resumed.",
      apply_temporary_discount: "Temporary Stripe discount applied and recorded.",
      remove_temporary_discount: "Temporary Stripe discount removed and recorded.",
      cancel_period_end:
        "Cancellation scheduled. Customer keeps access until the paid period ends.",
      cancel_immediately: "Subscription cancelled immediately and access blocked.",
      start_layout: "Layout work started.",
      refund_first_payment: "First payment refunded.",
      record_post_layout_refund_request: "Post-layout refund request recorded.",
      issue_partial_refund: "Partial refund issued and recorded.",
    };

    await runSubscriptionAction({
      action: selectedOperationId,
      payload: { reason: cleanedReason },
      successMessage: successMessages[selectedOperationId],
    });
    finish();
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

    const reason = deleteReason.trim();
    if (reason.length < 5) {
      showAdminNotification(
        "error",
        "Add a deletion reason of at least 5 characters.",
      );
      return;
    }

    if (!deleteConfirmed) {
      showAdminNotification("error", "Confirm customer deletion before continuing.");
      return;
    }

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
    setDeleteReason("");
    setDeleteConfirmed(false);
    router.push("/admin/customers");
  };

  const anonymizeCustomer = async () => {
    if (!customer) return;

    const reason = anonymizeReason.trim();
    if (reason.length < 5) {
      showAdminNotification(
        "error",
        "Add an anonymization reason of at least 5 characters.",
      );
      return;
    }

    if (!anonymizeConfirmed) {
      showAdminNotification("error", "Confirm customer anonymization before continuing.");
      return;
    }

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
    setAnonymizeReason("");
    setAnonymizeConfirmed(false);
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

  const allocateStockItemToCustomer = async (item: InventoryStockItem) => {
    const reason = stockAllocationReason.trim();

    if (!reason) {
      showAdminNotification("warning", "Add a reason before allocating stock.");
      return;
    }

    setSaving(true);
    setAllocatingStockItemId(item.id);

    const response = await fetch(`/api/admin/inventory/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "allocate_new_device",
        customer_id: customerId,
        location: stockAllocationLocation,
        reason,
      }),
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      showAdminNotification(
        "error",
        result.error || "Could not allocate this stock item.",
      );
      setSaving(false);
      setAllocatingStockItemId(null);
      return;
    }

    showAdminNotification(
      "success",
      `Allocated stock item to display ${result.device?.device_code || "created display"}.`,
    );
    setStockAllocationReason("");
    setStockAllocationLocation("");
    await loadData();
    setSaving(false);
    setAllocatingStockItemId(null);
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
    stage: string;
    description: string;
  }> = [
    {
      id: "overview",
      label: "Overview",
      stage: "1",
      description: "Identity, contact, consent, and notes",
    },
    {
      id: "onboarding",
      label: "Request & quote",
      stage: "2",
      description: "Offer, setup link, and onboarding start",
    },
    {
      id: "communication",
      label: "Communication & material",
      count: messages.length + assets.length,
      stage: "3",
      description: "Messages, uploads, and screen content",
    },
    {
      id: "orders",
      label: "Orders & billing",
      count: subscriptions.length,
      stage: "4",
      description: "Stripe, invoices, refunds, and subscriptions",
    },
    {
      id: "devices",
      label: "Device allocation",
      count: devices.length,
      stage: "5",
      description: "Customer screens and stock assignment",
    },
    {
      id: "history",
      label: "Audit trail",
      count: auditEvents.length,
      stage: "6",
      description: "Legal and troubleshooting evidence",
    },
  ];
  const communicationWorkflows: Array<{
    id: CommunicationView;
    stage: string;
    label: string;
    count: number;
    description: string;
  }> = [
    {
      id: "messages",
      stage: "1",
      label: "Support inbox",
      count: messages.length,
      description: "Customer questions, replies, and troubleshooting notes",
    },
    {
      id: "uploads",
      stage: "2",
      label: "Material review",
      count: assets.length,
      description: "Uploaded logos, images, videos, and display content",
    },
  ];
  const paidDeviceQuantity = subscriptions
    .filter(subscriptionCountsTowardDeviceEntitlement)
    .reduce(
      (total, subscription) =>
        total + Math.max(0, Number(subscription.screen_quantity) || 0),
      0,
    );
  const activeDeviceCount = devices.filter(deviceCountsTowardEntitlement).length;
  const remainingDeviceSlots = Math.max(0, paidDeviceQuantity - activeDeviceCount);
  const stockModelOptions = Array.from(
    new Set(
      stockItems
        .map((item) => (item.model || "").trim())
        .filter(Boolean),
    ),
  ).sort((a, b) => a.localeCompare(b));
  const filteredStockItems = stockItems.filter((item) => {
    const matchesType =
      stockTypeFilter === "all" || item.item_type === stockTypeFilter;
    const matchesModel =
      stockModelFilter === "all" || (item.model || "") === stockModelFilter;

    return matchesType && matchesModel;
  });
  const quoteLines = quoteItems
    .map((item) => {
      const plan =
        pricingPlans.find(
          (pricingPlan) => pricingPlan.code === item.pricingPlanCode,
        ) || pricingPlans[0];
      const quantity = Math.min(50, Math.max(1, Number(item.quantity) || 1));
      const hardwareFee =
        plan?.hardware_fee_sek ?? 0;

      return {
        ...item,
        plan,
        quantity,
        hardwareFee,
        deviceSubtotal: plan ? hardwareFee * quantity : 0,
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
  const quoteShippingSubtotal = calculateShippingFeeSek(
    quoteScreenQuantity,
    primaryQuotePlan?.shipping_fee_sek ?? 99,
    primaryQuotePlan?.shipping_included_devices ?? INCLUDED_SHIPPING_DEVICE_COUNT,
    primaryQuotePlan?.additional_shipping_fee_sek ??
      ADDITIONAL_SHIPPING_FEE_PER_DEVICE_SEK,
  );
  const quoteMonthlySubtotal = quoteLines.reduce(
    (sum, item) => sum + item.monthlySubtotal,
    0,
  );
  const quoteMonthlyDiscountAmount = Math.round(
    quoteMonthlySubtotal * (quoteDiscountPercent / 100),
  );
  const quoteSetupSubtotal = primaryQuotePlan
    ? calculateIncrementalSetupFeeSek(
        paidDeviceQuantity,
        quoteScreenQuantity,
        primaryQuotePlan.setup_fee_sek,
      )
    : 0;
  const quoteStartupTotal = primaryQuotePlan
    ? quoteSetupSubtotal + quoteDeviceSubtotal + quoteShippingSubtotal
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
  const currentSubscription = subscriptions[0] || null;
  const hasPreparedQuote = Boolean(
    currentSubscription &&
      ["quote_prepared", "quote_sent", "checkout_started"].includes(
        currentSubscription.status,
      ),
  );
  const setupFeeWasPaid = Boolean(
    currentSubscription?.setup_fee_paid ||
      currentSubscription?.stripe_payment_status === "paid" ||
      currentSubscription?.status === "paid" ||
      currentSubscription?.status === "active" ||
      (currentSubscription?.total_amount_sek || 0) > 0,
  );
  const terminalAccessStatuses = ["cancelled", "refunded"];
  const terminalPaymentStatuses = ["cancelled", "refunded"];
  const terminalSubscriptionStatuses = ["cancelled", "refunded"];
  const stripeSubscriptionOperational = Boolean(
    customer.stripe_subscription_id &&
      currentSubscription &&
      !terminalAccessStatuses.includes(customer.service_access_status || "") &&
      !terminalPaymentStatuses.includes(customer.payment_status || "") &&
      !terminalSubscriptionStatuses.includes(currentSubscription.status || ""),
  );
  const hasScheduledCancellation = Boolean(
    currentSubscription?.cancel_at_period_end,
  );
  const customerOperations: CustomerOperation[] = [
    customer.payment_status === "paid" &&
    customer.status !== "active" &&
    customer.status !== "suspended"
      ? {
          id: "activate_customer",
          title: "Activate customer",
          description: "Use after payment, content, and display assignment are ready.",
          result: "Customer status becomes active and qualified displays can run.",
          tone: "success",
          requiresConfirmation: true,
        }
      : null,
    customer.status === "active"
      ? {
          id: "suspend_customer",
          title: "Suspend customer",
          description: "Use for manual business holds that should stop displays.",
          result: "Customer access is suspended and displays are blocked.",
          tone: "warning",
          requiresConfirmation: true,
        }
      : null,
    customer.status === "suspended" &&
    !["paused", ...terminalAccessStatuses].includes(
      customer.service_access_status || "",
    )
      ? {
          id: "reactivate_customer",
          title: "Reactivate customer",
          description: "Use when the manual hold is resolved.",
          result: "Customer status is restored and audit history records the reason.",
          tone: "success",
          requiresConfirmation: true,
        }
      : null,
    productionTrackingReady &&
    !customer.setup_fee_locked_at &&
    customer.payment_status === "paid"
      ? {
          id: "start_layout",
          title: "Start layout work",
          description: "Use only when production actually begins.",
          result: "The setup/layout fee becomes non-refundable from this point.",
          tone: "warning",
          requiresConfirmation: true,
        }
      : null,
    productionTrackingReady &&
    Boolean(customer.setup_fee_locked_at) &&
    customer.payment_status === "paid"
      ? {
          id: "record_post_layout_refund_request",
          title: "Record post-layout refund request",
          description: "Use when a customer asks for a full refund after production began.",
          result: "The request and denial boundary are recorded; Stripe is not changed.",
          tone: "warning",
          requiresRefundAmount: true,
          requiresConfirmation: true,
        }
      : null,
    productionTrackingReady &&
    Boolean(customer.setup_fee_locked_at) &&
    customer.payment_status === "paid"
      ? {
          id: "issue_partial_refund",
          title: "Issue partial refund",
          description: "Use only for a specifically approved partial amount.",
          result: "Stripe refunds only the entered amount; the customer remains paid and active.",
          tone: "danger",
          requiresStripe: true,
          requiresRefundAmount: true,
          requiresConfirmation: true,
        }
      : null,
    productionTrackingReady &&
    !customer.setup_fee_locked_at &&
    customer.payment_status === "paid"
      ? {
          id: "refund_first_payment",
          title: "Refund first payment",
          description: "Use only before layout work starts.",
          result: "The first payment is refunded and the customer is suspended.",
          tone: "danger",
          requiresConfirmation: true,
        }
      : null,
    stripeSubscriptionOperational &&
    customer.service_access_status !== "paused" &&
    !hasScheduledCancellation
      ? {
          id: "pause_subscription",
          title: "Pause subscription",
          description: "Use when billing collection and display access should pause.",
          result: "Stripe collection is paused and displays are blocked immediately.",
          tone: "warning",
          requiresStripe: true,
          requiresConfirmation: true,
        }
      : null,
    stripeSubscriptionOperational &&
    (customer.service_access_status === "paused" || hasScheduledCancellation)
      ? {
          id: "resume_subscription",
          title: "Resume subscription",
          description: hasScheduledCancellation
            ? "Use to undo a scheduled cancellation before the period ends."
            : "Use when billing and display access can restart.",
          result: hasScheduledCancellation
            ? "Stripe cancellation is removed and the subscription stays active."
            : "Stripe collection resumes and access is restored if otherwise paid.",
          tone: "success",
          requiresStripe: true,
          requiresConfirmation: true,
        }
      : null,
    stripeSubscriptionOperational
      ? {
          id: "apply_temporary_discount",
          title: "Apply temporary discount",
          description: "Use for post-sale customer-specific discount adjustments.",
          result: "A temporary Stripe coupon is applied and recorded.",
          tone: "primary",
          requiresStripe: true,
          requiresDiscount: true,
        }
      : null,
    stripeSubscriptionOperational && activeDiscountCount > 0
      ? {
          id: "remove_temporary_discount",
          title: "Remove temporary discount",
          description: "Use when a customer-specific Stripe discount should end.",
          result: "Stripe discount is removed and local discount records are closed.",
          tone: "warning",
          requiresStripe: true,
          requiresConfirmation: true,
        }
      : null,
    stripeSubscriptionOperational && !hasScheduledCancellation
      ? {
          id: "cancel_period_end",
          title: "Cancel at period end",
          description: "Default cancellation path for normal customer/admin cancellations.",
          result: "Customer keeps access until the paid-through period ends.",
          tone: "warning",
          requiresStripe: true,
          requiresConfirmation: true,
        }
      : null,
    stripeSubscriptionOperational
      ? {
          id: "cancel_immediately",
          title: "Cancel now",
          description: "Exceptional path for urgent cases only.",
          result: "Stripe cancellation happens now and display access is blocked.",
          tone: "danger",
          requiresStripe: true,
          requiresConfirmation: true,
        }
      : null,
  ].filter(Boolean) as CustomerOperation[];
  const selectedOperation = customerOperations.find(
    (operation) => operation.id === selectedOperationId,
  );
  const selectedOperationReasonLabel =
    selectedOperationId === "activate_customer"
      ? "Reason for activating this customer"
      : selectedOperationId === "resume_subscription"
        ? "Reason for resuming billing and display access"
        : selectedOperationId === "pause_subscription"
          ? "Reason for pausing billing and display access"
          : selectedOperationId === "suspend_customer"
            ? "Reason for suspending this customer"
            : selectedOperationId === "reactivate_customer"
              ? "Reason for reactivating this customer"
              : selectedOperationId === "cancel_period_end"
                ? "Reason for scheduling cancellation at period end"
                : selectedOperationId === "cancel_immediately"
                  ? "Reason for immediate subscription cancellation"
                  : selectedOperationId === "apply_temporary_discount"
                    ? "Reason for applying this temporary discount"
                    : selectedOperationId === "remove_temporary_discount"
                      ? "Reason for removing this temporary discount"
                      : selectedOperationId === "start_layout"
                        ? "Reason for starting layout work"
                  : selectedOperationId === "refund_first_payment"
                          ? "Reason for refunding the first payment"
                          : selectedOperationId === "record_post_layout_refund_request"
                            ? "Customer request and reason the automatic full refund is denied"
                            : selectedOperationId === "issue_partial_refund"
                              ? "Reason for approving this exact partial refund amount"
                        : "Reason for audit history";
  const recommendedAction = getCustomerWorkflowAction({
    id: customer.id,
    status: customer.status,
    paymentStatus: customer.payment_status,
    serviceAccessStatus: customer.service_access_status,
    deviceCount: devices.length,
    firstDeviceCode: devices[0]?.device_code,
    firstDeviceWithoutPlaylistCode: devices.find(
      (device) => (device.playlists?.[0]?.count || 0) === 0,
    )?.device_code,
  });

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
          Back to customers
        </Link>

        <div className="mt-4 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <h1 className="admin-title">{customer.name}</h1>
            <p className="admin-subtitle">
              Manage the customer journey from request and quote to material,
              billing, device allocation, and audit trail.
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

      <section className="admin-customer-workflow admin-card" aria-label="Customer workflow">
        {detailSections.map((section) => (
          <button
            key={section.id}
            type="button"
            onClick={() => navigateToSection(section.id)}
            className={
              activeSection === section.id
                ? "admin-customer-workflow-step admin-customer-workflow-step-active"
                : "admin-customer-workflow-step"
            }
          >
            <span>{section.stage}</span>
            <strong>
              {section.label}
              {typeof section.count === "number" ? <em>{section.count}</em> : null}
            </strong>
            <small>{section.description}</small>
          </button>
        ))}
      </section>

      {recommendedAction && (
        <section
          className={`admin-customer-next-step admin-customer-next-step-${recommendedAction.priority}`}
          aria-label="Recommended next step"
        >
          <div className="admin-customer-next-stage">
            <span>Step {recommendedAction.stage} of 6</span>
            <strong>{recommendedAction.stageLabel}</strong>
          </div>
          <div className="admin-customer-next-copy">
            <p className="admin-operation-kicker">Recommended next step</p>
            <h2>{recommendedAction.title}</h2>
            <p>{recommendedAction.description}</p>
          </div>
          <Link href={recommendedAction.href} className="admin-button-primary">
            Continue workflow
          </Link>
        </section>
      )}

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
          <label className="mt-4 block text-sm font-semibold text-red-900">
            Reason for anonymizing this customer
            <textarea
              value={anonymizeReason}
              onChange={(event) => {
                setAnonymizeReason(event.target.value);
                setAnonymizeConfirmed(false);
              }}
              rows={2}
              placeholder="Example: Customer requested deletion of personal data under GDPR."
              className="mt-1 w-full rounded-xl border border-red-200 px-3 py-2 text-slate-900 outline-none"
            />
          </label>
          <label className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] items-start gap-2 text-sm font-semibold text-red-900">
            <input
              type="checkbox"
              checked={anonymizeConfirmed}
              onChange={(event) => setAnonymizeConfirmed(event.target.checked)}
              className="mt-1"
            />
            I understand anonymization removes contact details, uploaded
            material, and support messages while retained payment/order/audit
            references stay.
          </label>
          <div className="mt-3 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={anonymizeCustomer}
              disabled={saving || !anonymizeReason.trim() || !anonymizeConfirmed}
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
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none transition focus:border-[var(--admin-focus)] focus:ring-2 focus:ring-cyan-100"
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
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none transition focus:border-[var(--admin-focus)] focus:ring-2 focus:ring-cyan-100"
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
                  Introductory discount %
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
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none transition focus:border-[var(--admin-focus)] focus:ring-2 focus:ring-cyan-100"
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
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none transition focus:border-[var(--admin-focus)] focus:ring-2 focus:ring-cyan-100"
                  />
                </label>
              </div>

              <p className="rounded-2xl bg-blue-50 p-3 text-xs font-semibold text-blue-800">
                The introductory discount only reduces the monthly subscription
                for the selected number of months. The first payment, setup,
                devices, and shipping are never discounted here.
              </p>

              <label className="text-sm font-semibold text-slate-700">
                Message on quote email
                <textarea
                  value={quoteNotes}
                  onChange={(event) => setQuoteNotes(event.target.value)}
                  rows={3}
                  placeholder="Optional internal/customer-facing note for this quote"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none transition focus:border-[var(--admin-focus)] focus:ring-2 focus:ring-cyan-100"
                />
              </label>

              <button
                type="button"
                onClick={prepareQuoteAndOnboarding}
                disabled={saving || quoteLines.length === 0}
                className="admin-button-primary disabled:opacity-50"
              >
                {saving
                  ? hasPreparedQuote
                    ? "Resending..."
                    : "Preparing..."
                  : hasPreparedQuote
                    ? "Resend current offer and replace link"
                    : "Prepare quote and send onboarding"}
              </button>

              {hasPreparedQuote && (
                <p className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-900">
                  Resending keeps the current order and prices, creates a new
                  14-day secure link, and makes the previous link invalid.
                  Confirm the email address before continuing.
                </p>
              )}

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
                        <span>Device</span>
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
                    <strong>{formatSek(quoteSetupSubtotal)}</strong>
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
                    New screens in this quote: {quoteScreenQuantity}. Already
                    paid screen entitlement: {paidDeviceQuantity}. Free trial:{" "}
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
                  {formatInactiveReason(customer.inactive_reason)} |{" "}
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
                    : setupFeeWasPaid
                      ? "Paid; not refunded"
                      : "Not paid yet"}
                </td>
                <td>{formatDateTime(customer.setup_fee_locked_at)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="admin-operation-panel mt-6">
          <div className="admin-operation-header">
            <div>
              <p className="admin-operation-kicker">Customer operation flow</p>
              <h3>Account, billing, and production actions</h3>
              <p>
                Use this panel for changes that affect service access, Stripe
                billing, production status, refunds, or cancellation. Messages
                and uploaded material stay in Communication & material.
              </p>
            </div>
            <div className="admin-operation-summary">
              <span>{customer.status || "draft"}</span>
              <strong>{customer.service_access_status || "access not set"}</strong>
            </div>
          </div>

          {customer.onboarding_token && (
            <p className="admin-operation-link">
              Onboarding link: /onboarding/{customer.onboarding_token}
            </p>
          )}

          {!customer.onboarding_token && (
            <p className="admin-operation-note">
              No onboarding link yet. Use the quote workflow above to create the
              order, setup link, material upload path, and payment flow together.
            </p>
          )}

          <div className="admin-operation-grid">
            <div className="admin-operation-list" aria-label="Available customer operations">
              {customerOperations.length === 0 ? (
                <p className="admin-muted">
                  No customer operations are currently available for this state.
                </p>
              ) : (
                customerOperations.map((operation) => (
                  <button
                    key={operation.id}
                    type="button"
                    onClick={() => openCustomerOperation(operation.id)}
                    disabled={saving}
                    className={`admin-operation-card admin-operation-${operation.tone} ${
                      selectedOperationId === operation.id
                        ? "admin-operation-card-selected"
                        : ""
                    }`}
                  >
                    <span>
                      <strong>{operation.title}</strong>
                      <small>{operation.description}</small>
                    </span>
                    <em>{operation.requiresStripe ? "Stripe" : "Screenia"}</em>
                  </button>
                ))
              )}
            </div>

            <div className="admin-operation-flow">
              {selectedOperation ? (
                <>
                  <div className="admin-operation-flow-header">
                    <p className="admin-operation-kicker">Selected action</p>
                    <h4>{selectedOperation.title}</h4>
                    <p>{selectedOperation.result}</p>
                  </div>

                  {selectedOperation.requiresDiscount && (
                    <div className="admin-operation-fields">
                      <label>
                        Discount percent
                        <input
                          type="number"
                          min="1"
                          max="100"
                          value={operationDiscountPercent}
                          onChange={(event) =>
                            setOperationDiscountPercent(event.target.value)
                          }
                        />
                      </label>
                      <label>
                        Duration months
                        <input
                          type="number"
                          min="1"
                          max="36"
                          value={operationDiscountMonths}
                          onChange={(event) =>
                            setOperationDiscountMonths(event.target.value)
                          }
                        />
                      </label>
                    </div>
                  )}

                  {selectedOperation.requiresRefundAmount && (
                    <div className="admin-operation-fields">
                      <label>
                        Amount including VAT (SEK)
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={operationRefundAmountSek}
                          onChange={(event) =>
                            setOperationRefundAmountSek(event.target.value)
                          }
                        />
                      </label>
                      <p className="admin-operation-critical-note">
                        {selectedOperationId === "issue_partial_refund"
                          ? "This action moves money immediately. Enter only the approved partial amount; customer payment and service status remain active."
                          : "This records the request and the post-layout denial boundary. It does not create a Stripe refund."}
                      </p>
                    </div>
                  )}

                  <label className="admin-operation-reason">
                    {selectedOperationReasonLabel}
                    <textarea
                      value={operationReason}
                      onChange={(event) => setOperationReason(event.target.value)}
                      rows={4}
                      placeholder="Write the operational reason before saving."
                    />
                  </label>

                  {selectedOperation.requiresConfirmation && (
                    <label className="admin-operation-confirm">
                      <input
                        type="checkbox"
                        checked={operationConfirmed}
                        onChange={(event) =>
                          setOperationConfirmed(event.target.checked)
                        }
                      />
                      I have reviewed the impact of this action.
                    </label>
                  )}

                  <div className="admin-operation-actions">
                    <button
                      type="button"
                      onClick={completeCustomerOperation}
                      disabled={saving}
                      className={
                        selectedOperation.tone === "danger"
                          ? "admin-button-danger"
                          : selectedOperation.tone === "warning"
                            ? "admin-button-warning"
                            : "admin-button-primary"
                      }
                    >
                      {saving ? "Saving..." : `Run: ${selectedOperation.title}`}
                    </button>
                    <button
                      type="button"
                      onClick={closeCustomerOperation}
                      disabled={saving}
                      className="admin-button-secondary"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <div className="admin-operation-empty">
                  <p className="admin-operation-kicker">Step 1</p>
                  <h4>Select an action</h4>
                  <p>
                    Pick one business action from the left. The next step will
                    show the required reason, Stripe fields, or impact
                    confirmation.
                  </p>
                </div>
              )}
            </div>
          </div>
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
          </div>

          <div className="admin-communication-workflow">
            {communicationWorkflows.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => navigateCommunicationView(item.id)}
                className={
                  communicationView === item.id
                    ? "admin-communication-workflow-step admin-communication-workflow-step-active"
                    : "admin-communication-workflow-step"
                }
              >
                <span>{item.stage}</span>
                <strong>
                  {item.label}
                  <em>{item.count}</em>
                </strong>
                <small>{item.description}</small>
              </button>
            ))}
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
          <div className="admin-scroll-region mt-4 space-y-3">
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
                      {item.ticketNumber || "No ticket"} |{" "}
                      {item.requestType.replace(/_/g, " ")} | {item.priority}
                      {item.relatedTicketNumber
                        ? ` | Reply to ${item.relatedTicketNumber}`
                        : ""}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {new Date(item.createdAt).toLocaleString("sv-SE")} |{" "}
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
                              reason: current[item.id]?.reason || "",
                            },
                          }))
                        }
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none transition focus:border-[var(--admin-focus)] focus:ring-2 focus:ring-cyan-100"
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
                              reason: current[item.id]?.reason || "",
                            },
                          }))
                        }
                        rows={3}
                        placeholder="Record troubleshooting notes or the next action."
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none transition focus:border-[var(--admin-focus)] focus:ring-2 focus:ring-cyan-100"
                      />
                    </label>
                  </div>
                  <label className="mt-3 block text-sm font-semibold text-slate-700">
                    Reason for updating this support message review *
                    <textarea
                      value={messageDrafts[item.id]?.reason || ""}
                      onChange={(event) =>
                        setMessageDrafts((current) => ({
                          ...current,
                          [item.id]: {
                            status: current[item.id]?.status || item.status,
                            adminNote:
                              current[item.id]?.adminNote || item.adminNote || "",
                            reason: event.target.value,
                          },
                        }))
                      }
                      rows={2}
                      placeholder="Example: Customer issue reviewed and assigned to support."
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none transition focus:border-[var(--admin-focus)] focus:ring-2 focus:ring-cyan-100"
                    />
                  </label>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => updateCustomerMessage(item)}
                      disabled={saving || !(messageDrafts[item.id]?.reason || "").trim()}
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
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none transition focus:border-[var(--admin-focus)] focus:ring-2 focus:ring-cyan-100"
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

        <div className="mt-5 rounded-2xl border border-cyan-200 bg-cyan-50/70 p-4">
          <div className="flex flex-col justify-between gap-2 md:flex-row md:items-start">
            <div>
              <h3 className="font-semibold text-slate-950">Customer design preview</h3>
              <p className="mt-1 text-sm text-slate-600">
                Publish a view-only Canva or web preview. The customer can approve it or
                request changes from the portal.
              </p>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-cyan-800">
              {customer?.preview_status
                ? customer.preview_status.replaceAll("_", " ")
                : "not published"}
            </span>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_320px]">
            <label className="text-sm font-semibold text-slate-700">
              View-only preview URL
              <input
                value={previewUrlDraft}
                onChange={(event) => setPreviewUrlDraft(event.target.value)}
                placeholder="https://www.canva.com/design/.../view"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none transition focus:border-[var(--admin-focus)] focus:ring-2 focus:ring-cyan-100"
              />
            </label>
            <label className="text-sm font-semibold text-slate-700">
              Reason and verification *
              <textarea
                value={previewPublishReason}
                onChange={(event) => setPreviewPublishReason(event.target.value)}
                rows={2}
                maxLength={1000}
                placeholder="Example: View-only link checked and first draft ready for review."
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none transition focus:border-[var(--admin-focus)] focus:ring-2 focus:ring-cyan-100"
              />
            </label>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-2xl text-xs font-semibold text-slate-600">
              Warning: verify that the link has no edit permission and exposes no other
              customer data. Publishing resets earlier feedback and emails the customer.
              Paid, active service access is required.
            </p>
            <button
              type="button"
              onClick={publishCustomerPreview}
              disabled={
                saving ||
                customer?.payment_status !== "paid" ||
                customer?.service_access_status !== "active" ||
                !previewUrlDraft.trim() ||
                previewPublishReason.trim().length < 5
              }
              className="admin-button-primary disabled:opacity-50"
            >
              {saving ? "Publishing..." : customer?.preview_url ? "Update preview" : "Publish preview"}
            </button>
          </div>
          {customer?.preview_feedback && (
            <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Latest customer feedback: {customer.preview_feedback}
            </p>
          )}
        </div>

        {assets.length === 0 ? (
          <p className="admin-muted mt-4">No display material yet.</p>
        ) : (
          <div className="admin-scroll-region mt-4 space-y-3">
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
                      {new Date(asset.createdAt).toLocaleString("sv-SE")} |{" "}
                      {asset.category} | {asset.source} | {asset.status}
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
                              reason: current[asset.id]?.reason || "",
                            },
                          }))
                        }
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none transition focus:border-[var(--admin-focus)] focus:ring-2 focus:ring-cyan-100"
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
                              reason: current[asset.id]?.reason || "",
                            },
                          }))
                        }
                        rows={3}
                        maxLength={1000}
                        placeholder="Record review outcome, content risks, or next action."
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none transition focus:border-[var(--admin-focus)] focus:ring-2 focus:ring-cyan-100"
                      />
                    </label>
                  </div>
                  <label className="mt-3 block text-sm font-semibold text-slate-700">
                    Reason for updating this display material review *
                    <textarea
                      value={assetDrafts[asset.id]?.reason || ""}
                      onChange={(event) =>
                        setAssetDrafts((current) => ({
                          ...current,
                          [asset.id]: {
                            status:
                              current[asset.id]?.status || asset.status || "new",
                            adminNote:
                              current[asset.id]?.adminNote || asset.adminNote || "",
                            reason: event.target.value,
                          },
                        }))
                      }
                      rows={2}
                      placeholder="Example: Uploaded display material reviewed for publishing."
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none transition focus:border-[var(--admin-focus)] focus:ring-2 focus:ring-cyan-100"
                    />
                  </label>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => updateCustomerAsset(asset)}
                      disabled={saving || !(assetDrafts[asset.id]?.reason || "").trim()}
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
          <div className="admin-scroll-region mt-4 space-y-3">
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
                      Status: {subscription.status} | Fulfillment:{" "}
                      {subscription.fulfillment_status || "pending"} | Stock allocation:{" "}
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
                    <p className="mt-1 text-sm font-semibold text-blue-700">
                      Trial: {formatTrialRemaining(
                        subscription.trial_ends_at,
                        subscription.stripe_current_period_start,
                      )}
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
                      First payment discount:{" "}
                      {formatSek(subscription.device_discount_amount_sek || 0)}
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

        <div className="mt-6 border-t border-slate-200 pt-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="text-base font-black text-slate-950">Refund cases</h3>
              <p className="mt-1 text-sm text-slate-500">
                Requests, decisions, exact amounts, and Stripe references remain separate from the order status.
              </p>
            </div>
            <span className="text-xs font-bold text-slate-500">
              {refundCases.length} recorded
            </span>
          </div>
          {refundCases.length === 0 ? (
            <p className="admin-muted mt-3">No refund request or partial refund recorded.</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="admin-table min-w-[760px]">
                <thead>
                  <tr>
                    <th>Requested</th>
                    <th>Order</th>
                    <th>Type</th>
                    <th>Requested amount</th>
                    <th>Decision</th>
                    <th>Approved amount</th>
                    <th>Stripe refund</th>
                  </tr>
                </thead>
                <tbody>
                  {refundCases.map((refundCase) => (
                    <tr key={refundCase.id}>
                      <td>{formatDateTime(refundCase.requested_at)}</td>
                      <td>{refundCase.order_number || "-"}</td>
                      <td>{refundCase.request_type}</td>
                      <td>{formatStripeSek(refundCase.requested_amount_ore)}</td>
                      <td>{refundCase.admin_decision.replaceAll("_", " ")}</td>
                      <td>{formatStripeSek(refundCase.approved_amount_ore)}</td>
                      <td>{refundCase.stripe_refund_id || "No Stripe refund"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      )}

      {/* ==============================
          History
      ============================== */}
      {activeSection === "history" && (
      <div className="admin-card p-6">
        <h2 className="admin-card-title text-xl">History</h2>
        <p className="admin-muted mt-2 text-sm">
          A searchable change trail for customer data, orders, displays,
          uploaded material, payment events, and admin actions.
        </p>

        {auditEvents.length === 0 ? (
          <p className="admin-muted mt-4">No history events yet.</p>
        ) : (
          <div className="admin-scroll-region mt-4 space-y-3">
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
                      {new Date(event.created_at).toLocaleString("sv-SE")} |{" "}
                      {event.actor_type}
                      {event.actor_id ? ` | ${event.actor_id}` : ""}
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
          Device allocation
      ============================== */}
      {activeSection === "devices" && (
      <>
      <div className="admin-card p-6">
        <h2 className="admin-card-title text-xl">Device allocation</h2>

        <p className="admin-muted mt-2 text-sm">
          Assign available stock to this customer&apos;s paid device entitlement and
          create display endpoints after onboarding. Stock purchase records,
          warranty, returns, and repairs stay in Hardware stock.
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <InfoTile
            label="Paid display slots"
            value={paidDeviceQuantity ? String(paidDeviceQuantity) : "None"}
          />
          <InfoTile label="Active displays" value={String(activeDeviceCount)} />
          <InfoTile
            label="Available slots"
            value={String(remainingDeviceSlots)}
          />
        </div>

        {remainingDeviceSlots < 1 ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
            {paidDeviceQuantity < 1
              ? "This customer has no eligible paid display entitlement. Resolve payment and service access before assigning hardware or creating a display endpoint."
              : "This customer already has the paid number of active displays. Return or deactivate a faulty display before assigning a replacement, or update the subscription quantity first."}
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-3">
          {remainingDeviceSlots > 0 ? (
            <Link
              href={`/admin/devices/new?customerId=${customer.id}`}
              className="admin-button-primary"
            >
              Create display endpoint
            </Link>
          ) : (
            <span
              aria-disabled="true"
              className="admin-button-primary cursor-not-allowed opacity-50"
              title="A paid available display slot is required."
            >
              Create display endpoint
            </span>
          )}
          <Link href="/admin/inventory" className="admin-button-secondary">
            Open Hardware stock
          </Link>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="text-base font-black text-slate-950">
                Allocate existing stock
              </h3>
              <p className="admin-muted mt-1 text-sm">
                Filter available stock by package type or hardware model, then
                allocate a physical unit to this customer.
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="text-sm font-semibold text-slate-700">
              Package type
              <select
                value={stockTypeFilter}
                onChange={(event) => setStockTypeFilter(event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none transition focus:border-[var(--admin-focus)] focus:ring-2 focus:ring-cyan-100"
              >
                <option value="all">All package types</option>
                <option value="standard_fhd">Standard FHD</option>
                <option value="premium_4k">Premium 4K</option>
                <option value="spare">Spare part</option>
                <option value="other">Other</option>
              </select>
            </label>

            <label className="text-sm font-semibold text-slate-700">
              Hardware model
              <select
                value={stockModelFilter}
                onChange={(event) => setStockModelFilter(event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none transition focus:border-[var(--admin-focus)] focus:ring-2 focus:ring-cyan-100"
              >
                <option value="all">All models</option>
                {stockModelOptions.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="text-sm font-semibold text-slate-700">
              Customer screen location
              <input
                value={stockAllocationLocation}
                onChange={(event) => setStockAllocationLocation(event.target.value)}
                placeholder="Reception, entrance, menu board..."
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none transition focus:border-[var(--admin-focus)] focus:ring-2 focus:ring-cyan-100"
              />
            </label>
            <label className="text-sm font-semibold text-slate-700">
              Allocation reason
              <textarea
                value={stockAllocationReason}
                onChange={(event) => setStockAllocationReason(event.target.value)}
                placeholder="Example: Customer paid for Premium 4K and this unit is prepared for installation."
                rows={3}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none transition focus:border-[var(--admin-focus)] focus:ring-2 focus:ring-cyan-100"
              />
            </label>
          </div>

          {filteredStockItems.length === 0 ? (
            <p className="admin-muted mt-4 text-sm">
              No available stock matches this filter.
            </p>
          ) : (
            <div className="admin-scroll-region mt-4 grid gap-3 lg:grid-cols-2">
              {filteredStockItems.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black text-slate-950">
                        {item.item_code}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        {inventoryTypeLabel(item.item_type)} |{" "}
                        {item.model || "Model missing"}
                      </p>
                    </div>
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black uppercase text-emerald-700">
                      In stock
                    </span>
                  </div>
                  <dl className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                    <div>
                      <dt className="font-bold text-slate-900">Serial</dt>
                      <dd>{item.serial_number || "Missing"}</dd>
                    </div>
                    <div>
                      <dt className="font-bold text-slate-900">Condition</dt>
                      <dd>{item.condition}</dd>
                    </div>
                    <div>
                      <dt className="font-bold text-slate-900">Make</dt>
                      <dd>{item.make || "Not set"}</dd>
                    </div>
                    <div>
                      <dt className="font-bold text-slate-900">Seller</dt>
                      <dd>{item.seller || "Not set"}</dd>
                    </div>
                  </dl>
                  <button
                    type="button"
                    onClick={() => allocateStockItemToCustomer(item)}
                    disabled={
                      saving ||
                      allocatingStockItemId === item.id ||
                      remainingDeviceSlots < 1 ||
                      !stockAllocationReason.trim()
                    }
                    className="admin-button-primary mt-4 disabled:opacity-50"
                  >
                    {allocatingStockItemId === item.id
                      ? "Allocating..."
                      : "Allocate to this customer"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ==============================
          Displays
      ============================== */}
      <div className="admin-card mt-6 p-6">
        <h2 className="admin-card-title text-xl">Displays</h2>

        {devices.length === 0 ? (
          <p className="admin-muted mt-4">No displays yet.</p>
        ) : (
          <div className="admin-scroll-region mt-4 space-y-3">
            {devices.map((device) => (
              <div
                key={device.id}
                className="rounded-2xl border border-slate-200 bg-white/70 p-4"
              >
                <p className="font-semibold text-slate-950">
                  {device.name || "Unnamed display"}
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  Display code: {device.device_code}
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

              <label className="block text-sm font-semibold text-red-900">
                Reason for permanently deleting this draft customer *
                <textarea
                  value={deleteReason}
                  onChange={(event) => {
                    setDeleteReason(event.target.value);
                    setDeleteConfirmed(false);
                  }}
                  rows={3}
                  placeholder="Example: Duplicate draft created during testing and no payment history exists."
                  className="mt-1 w-full rounded-xl border border-red-200 px-3 py-2 text-slate-900 outline-none"
                />
              </label>

              <label className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-2 text-sm font-semibold text-red-900">
                <input
                  type="checkbox"
                  checked={deleteConfirmed}
                  onChange={(event) => setDeleteConfirmed(event.target.checked)}
                  className="mt-1"
                />
                I checked that this is a wrong draft or duplicate without
                payment history, and I want to delete it.
              </label>

              <div className="flex flex-wrap justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setDeleteConfirmationOpen(false);
                    setDeleteReason("");
                    setDeleteConfirmed(false);
                  }}
                  disabled={saving}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={deleteCustomer}
                  disabled={saving || !deleteReason.trim() || !deleteConfirmed}
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

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="admin-customer-detail-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/80 p-4">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
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
        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none transition focus:border-[var(--admin-focus)] focus:ring-2 focus:ring-cyan-100"
      />
    </div>
  );
}
