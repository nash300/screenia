"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { LandingNav } from "@/components/LandingNav";

type AccountSection = "overview" | "setup" | "material" | "messages" | "billing" | "legal";

const accountSectionIds: AccountSection[] = [
  "overview",
  "setup",
  "material",
  "messages",
  "billing",
  "legal",
];

function getInitialAccountSection(): AccountSection {
  if (typeof window === "undefined") return "overview";

  const section = new URLSearchParams(window.location.search).get("section");
  return accountSectionIds.includes(section as AccountSection)
    ? (section as AccountSection)
    : "overview";
}

type AccountData = {
  customer: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    contact_person: string | null;
    organisation_number: string | null;
    address: string | null;
    city: string | null;
    country: string | null;
    status: string;
    payment_status: string | null;
    stripe_customer_id: string | null;
    stripe_subscription_id: string | null;
    service_access_status: string | null;
    service_access_until: string | null;
    activated_at: string | null;
    cancelled_at: string | null;
    created_at: string;
    website_url: string | null;
    business_description: string | null;
    opening_hours: string | null;
    promotions: string | null;
    social_media: string | null;
    content_option: string | null;
    content_collected_at: string | null;
    preview_status: string | null;
    preview_url: string | null;
    preview_feedback: string | null;
    production_status: string | null;
    layout_started_at: string | null;
    setup_fee_locked_at: string | null;
    marketing_consent: boolean | null;
    analytics_consent: boolean | null;
    remote_support_consent: boolean | null;
  };
  subscriptions: Array<{
    id: string;
    order_number: string;
    status: string;
    setup_fee_paid: boolean;
    setup_fee_sek: number | null;
    hardware_fee_sek: number | null;
    shipping_fee_sek: number | null;
    base_shipping_fee_sek: number | null;
    shipping_included_devices: number | null;
    additional_shipping_fee_per_device_sek: number | null;
    additional_shipping_device_count: number | null;
    monthly_fee_sek: number | null;
    trial_days: number | null;
    trial_starts_at: string | null;
    trial_ends_at: string | null;
    screen_quantity: number | null;
    device_discount_amount_sek: number | null;
    monthly_discount_amount_sek: number | null;
    device_discount_months: number | null;
    quote_items: Array<{
      pricingPlanCode?: string;
      name?: string;
      resolution?: string;
      quantity?: number;
      hardwareFeeSek?: number;
      shippingFeeSek?: number;
      monthlyFeeSek?: number;
    }> | null;
    tax_status: string | null;
    tax_amount_sek: number | null;
    total_amount_sek: number | null;
    fulfillment_status: string | null;
    inventory_status: string | null;
    tracking_number: string | null;
    tracking_url: string | null;
    stripe_subscription_id: string | null;
    stripe_invoice_id: string | null;
    stripe_payment_status: string | null;
    stripe_current_period_start: string | null;
    stripe_current_period_end: string | null;
    cancel_at_period_end: boolean | null;
    cancellation_effective_at: string | null;
    pause_started_at: string | null;
    pause_resumes_at: string | null;
    pause_reason: string | null;
    created_at: string;
    pricing_plans?: {
      name: string;
      resolution: string;
      code: string;
    } | null;
  }>;
  devices: Array<{
    id: string;
    device_code: string;
    name: string | null;
    is_active: boolean;
    location: string | null;
    inventory_status: string | null;
    assigned_at: string | null;
  }>;
  devicePauses: Array<{
    id: string;
    customer_subscription_id: string;
    device_id: string;
    stripe_subscription_id: string;
    pricing_plan_code: string | null;
    monthly_fee_sek: number | null;
    status: string;
    pause_started_at: string;
    pause_resumes_at: string;
    reason: string | null;
    resumed_at: string | null;
    devices?: {
      device_code: string | null;
      name: string | null;
      location: string | null;
    } | null;
  }>;
  deviceCancellations: Array<{
    id: string;
    customer_subscription_id: string;
    device_id: string;
    stripe_subscription_id: string;
    pricing_plan_code: string | null;
    monthly_fee_sek: number | null;
    status: string;
    reason: string | null;
    cancellation_requested_at: string;
    cancellation_effective_at: string | null;
    devices?: {
      device_code: string | null;
      name: string | null;
      location: string | null;
    } | null;
  }>;
  messages: Array<{
    id: string;
    ticket_number: string | null;
    request_type: string;
    priority: string;
    related_ticket_number: string | null;
    subject: string | null;
    message: string;
    status: string;
    created_at: string;
    files: Array<{
      id: string;
      fileName: string;
      contentType: string;
      fileSize: number;
      downloadUrl: string | null;
    }>;
  }>;
  displayAssets: Array<{
    id: string;
    file_name: string | null;
    content_type: string | null;
    file_size: number | null;
    asset_category: string;
    description: string | null;
    source: string;
    status: string;
    created_at: string;
    downloadUrl: string | null;
  }>;
  previewDecisions: Array<{
    id: string;
    decision: string;
    feedback: string | null;
    preview_url: string | null;
    decided_at: string;
  }>;
  agreements: Array<{
    id: string;
    document_type: string;
    document_title: string;
    document_version: string;
    document_effective_at: string | null;
    document_url: string | null;
    pdf_url: string | null;
    content_snapshot: string;
    accepted_at: string;
    collection_point: string;
  }>;
  legalDocuments: Array<{
    id: string;
    document_type: string;
    title: string;
    version: string;
    effective_at: string;
    status: string;
    summary: string | null;
    pdf_url: string | null;
  }>;
  subscriptionAdjustments: Array<{
    id: string;
    customer_subscription_id: string;
    percent_off: number;
    duration_months: number;
    status: string;
    created_at: string;
    ended_at: string | null;
  }>;
};

type MaterialUploadItem = {
  file: File;
  category: string;
};

const formatter = new Intl.NumberFormat("sv-SE");
const preciseCurrencyFormatter = new Intl.NumberFormat("sv-SE", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const sections: Array<{
  id: AccountSection;
  label: string;
  detail: string;
}> = [
  { id: "overview", label: "Översikt", detail: "Företag, skärmar, status" },
  { id: "setup", label: "Innehåll", detail: "Första setup och underlag" },
  { id: "material", label: "Skärmmaterial", detail: "Ladda upp filer och text" },
  { id: "messages", label: "Ärenden", detail: "Support, retur och historik" },
  { id: "billing", label: "Abonnemang", detail: "Betalning och avslut" },
  { id: "legal", label: "Avtal", detail: "Villkor och godkännanden" },
];

const requestTypes = [
  { value: "general", label: "Allmän fråga" },
  { value: "issue", label: "Rapportera problem" },
  { value: "return", label: "Registrera retur" },
  { value: "material_update", label: "Ändra skärminnehåll" },
  { value: "billing", label: "Faktura eller betalning" },
  { value: "technical_support", label: "Teknisk support" },
  { value: "privacy_request", label: "Integritet eller personuppgifter" },
];

const priorities = [
  { value: "low", label: "Låg" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "Hög" },
  { value: "urgent", label: "Akut" },
];

const cancellationReasons = [
  { value: "", label: "Välj orsak" },
  { value: "too_expensive", label: "För dyrt" },
  { value: "missing_features", label: "Saknar funktioner" },
  { value: "not_using", label: "Använder inte tjänsten" },
  { value: "switching_provider", label: "Byter leverantör" },
  { value: "technical_issue", label: "Tekniskt problem" },
  { value: "temporary_pause", label: "Tillfälligt uppehåll" },
  { value: "other", label: "Annan orsak" },
];

const pauseDurationOptions = [
  { value: 1, label: "1 månad" },
  { value: 2, label: "2 månader" },
  { value: 3, label: "3 månader" },
  { value: 4, label: "4 månader" },
];

function money(amount: number | null) {
  if (typeof amount !== "number") return "-";
  return `${formatter.format(amount)} kr`;
}

function preciseMoney(amount: number) {
  return `${preciseCurrencyFormatter.format(amount)} kr`;
}

function date(value: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("sv-SE", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function addMonths(value: Date, months: number) {
  const next = new Date(value);
  const day = next.getDate();
  next.setMonth(next.getMonth() + months);

  if (next.getDate() !== day) {
    next.setDate(0);
  }

  return next;
}

function trialStatus(subscription: AccountData["subscriptions"][number]) {
  if (!subscription.trial_ends_at) {
    return `${subscription.trial_days || 0} dagar`;
  }

  const trialEnd = new Date(subscription.trial_ends_at);
  const currentPeriodStart = subscription.stripe_current_period_start
    ? new Date(subscription.stripe_current_period_start)
    : null;
  const billingHasPassedTrial =
    currentPeriodStart &&
    !Number.isNaN(currentPeriodStart.getTime()) &&
    currentPeriodStart.getTime() >= trialEnd.getTime();

  if (billingHasPassedTrial || trialEnd.getTime() <= Date.now()) {
    return `Avslutad ${date(subscription.trial_ends_at)}`;
  }

  const daysRemaining = Math.max(
    0,
    Math.ceil((trialEnd.getTime() - Date.now()) / (24 * 60 * 60 * 1000)),
  );
  return `${daysRemaining} dag${daysRemaining === 1 ? "" : "ar"} kvar (till ${date(
    subscription.trial_ends_at,
  )})`;
}

function subscriptionPackageLabel(subscription: AccountData["subscriptions"][number]) {
  const quoteItems = subscription.quote_items || [];

  if (quoteItems.length) {
    return quoteItems
      .map((item) => {
        const quantity = Math.max(1, item.quantity || 1);
        const name = [item.name, item.resolution].filter(Boolean).join(" ");
        return `${quantity} x ${name || "Screenia"}`;
      })
      .join(" + ");
  }

  return `${subscription.pricing_plans?.name || "Paket"} ${
    subscription.pricing_plans?.resolution || ""
  }`.trim();
}

function subscriptionPausePlanOptions(
  subscription: AccountData["subscriptions"][number],
) {
  const quoteItems = subscription.quote_items || [];

  if (quoteItems.length) {
    return quoteItems.map((item, index) => {
      const pricingPlanCode = String(item.pricingPlanCode || "");
      const name = [item.name, item.resolution].filter(Boolean).join(" ").trim();
      return {
        value: pricingPlanCode || `item-${index}`,
        pricingPlanCode,
        label: name || "Screenia",
        monthlyFeeSek: item.monthlyFeeSek || 0,
      };
    });
  }

  return [
    {
      value: subscription.id,
      pricingPlanCode: "",
      label: subscriptionPackageLabel(subscription),
      monthlyFeeSek: subscription.monthly_fee_sek || 0,
    },
  ];
}

function subscriptionInitialPaymentSek(subscription: AccountData["subscriptions"][number]) {
  return (
    (subscription.setup_fee_sek || 0) +
    (subscription.hardware_fee_sek || 0) +
    (subscription.shipping_fee_sek || 0) -
    (subscription.device_discount_amount_sek || 0)
  );
}

function subscriptionMonthlyTotalSek(subscription: AccountData["subscriptions"][number]) {
  const quoteItems = subscription.quote_items || [];

  if (quoteItems.length) {
    return quoteItems.reduce(
      (sum, item) => sum + (item.monthlyFeeSek || 0) * Math.max(1, item.quantity || 1),
      0,
    );
  }

  return (subscription.monthly_fee_sek || 0) * Math.max(1, subscription.screen_quantity || 1);
}

function subscriptionIsBillable(subscription: AccountData["subscriptions"][number]) {
  return (
    ["paid", "active"].includes(subscription.status || "") ||
    ["paid", "active", "trialing"].includes(subscription.stripe_payment_status || "")
  );
}

function fileSize(value: number | null) {
  if (!value) return "-";
  if (value < 1024 * 1024) return `${Math.ceil(value / 1024)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function assetCategoryLabel(value: string) {
  if (value === "logo") return "Logo";
  if (value === "image") return "Bild";
  if (value === "menu") return "Meny eller prislista";
  if (value === "text") return "Text";
  return "Annat";
}

function requestTypeLabel(value: string) {
  return requestTypes.find((item) => item.value === value)?.label || "Allmän fråga";
}

function priorityLabel(value: string) {
  return priorities.find((item) => item.value === value)?.label || "Normal";
}

function statusLabel(value: string | null) {
  if (value === "active") return "Aktiv";
  if (value === "paid") return "Betald";
  if (value === "new_request") return "Förfrågan mottagen";
  if (value === "accepted_terms") return "Redo för betalning";
  if (value === "content_collection") return "Innehåll samlas in";
  if (value === "content_pending") return "Innehåll väntar";
  if (value === "content_received") return "Innehåll mottaget";
  if (value === "inactive") return "Inaktiv";
  if (value === "suspended") return "Pausad";
  if (value === "cancelled") return "Avslutad";
  if (value === "active_until_period_end") return "Aktiv till periodens slut";
  if (value === "paused") return "Pausad";
  if (value === "payment_failed" || value === "past_due" || value === "unpaid") {
    return "Betalning misslyckades";
  }
  if (value === "payment_disputed" || value === "disputed") return "Betalning bestridd";
  if (value === "refunded") return "Återbetald";
  if (value === "new") return "Nytt";
  if (value === "customer_reply") return "Kundsvar";
  if (value === "in_progress") return "Pågår";
  if (value === "resolved") return "Löst";
  if (value === "layout_started") return "Layoutarbete startat";
  if (value === "not_started") return "Ej startat";
  return value || "-";
}

function contentOptionLabel(value: string | null) {
  if (value === "upload") return "Eget material";
  if (value === "template") return "Screenia-mall";
  if (value === "later") return "Skickas senare";
  return "-";
}

function journeySteps(data: AccountData) {
  const subscription = data.subscriptions[0];
  const customerStatus = data.customer.status;
  const paymentStatus = data.customer.payment_status;
  const fulfillment = subscription?.fulfillment_status;
  const inventory = subscription?.inventory_status;
  const productionStatus = data.customer.production_status;
  const hasDevice = data.devices.length > 0;
  const hasContent = data.displayAssets.length > 0 || customerStatus === "content_received";

  return [
    {
      label: "Förfrågan",
      detail: "Screenia har tagit emot din förfrågan.",
      done: Boolean(data.customer.created_at),
    },
    {
      label: "Godkänd order",
      detail: "Vi har granskat uppgifterna och skickat startlänken.",
      done: ["accepted_terms", "paid", "content_pending", "content_received", "active"].includes(customerStatus),
    },
    {
      label: "Betalning",
      detail: "Betalningen är klar innan vi samlar in material.",
      done: paymentStatus === "paid" || ["paid", "active"].includes(subscription?.status || ""),
    },
    {
      label: "Innehåll",
      detail: "Material, öppettider och önskemål är skickade eller planerade.",
      done: hasContent || ["content_pending", "content_received", "active"].includes(customerStatus),
    },
    {
      label: "Förhandsvisning",
      detail: "Screenia tar fram första skärmförslaget.",
      done:
        productionStatus === "layout_started" ||
        ["layout_started", "preview_approved", "in_production", "ready_to_ship", "shipped", "completed"].includes(fulfillment || ""),
    },
    {
      label: "Hårdvara",
      detail: "Enheten förbereds och kopplas till din skärm.",
      done: hasDevice || ["assigned", "shipped"].includes(inventory || ""),
    },
    {
      label: "Leverans",
      detail: "Ordern är skickad och kan följas med spårning.",
      done: fulfillment === "shipped" || inventory === "shipped" || customerStatus === "active",
    },
    {
      label: "Aktiv",
      detail: "Skärmen är inkopplad och visar innehåll.",
      done: customerStatus === "active",
    },
  ];
}

export default function AccountPage() {
  const [data, setData] = useState<AccountData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<AccountSection>(
    getInitialAccountSection,
  );
  const [messageSubject, setMessageSubject] = useState("");
  const [messageText, setMessageText] = useState("");
  const [messageFiles, setMessageFiles] = useState<File[]>([]);
  const [requestType, setRequestType] = useState("general");
  const [requestPriority, setRequestPriority] = useState("normal");
  const [relatedTicketNumber, setRelatedTicketNumber] = useState("");
  const [materialDescription, setMaterialDescription] = useState("");
  const [materialCategory, setMaterialCategory] = useState("image");
  const [materialFiles, setMaterialFiles] = useState<MaterialUploadItem[]>([]);
  const [previewFeedback, setPreviewFeedback] = useState("");
  const [savingPreviewDecision, setSavingPreviewDecision] = useState(false);
  const [setupBusinessName, setSetupBusinessName] = useState("");
  const [setupBusinessDescription, setSetupBusinessDescription] = useState("");
  const [setupOpeningHours, setSetupOpeningHours] = useState("");
  const [setupPromotions, setSetupPromotions] = useState("");
  const [setupWebsiteUrl, setSetupWebsiteUrl] = useState("");
  const [setupSocialMedia, setSetupSocialMedia] = useState("");
  const [setupContentOption, setSetupContentOption] = useState("template");
  const [setupNotes, setSetupNotes] = useState("");
  const [setupFiles, setSetupFiles] = useState<MaterialUploadItem[]>([]);
  const [savingSetup, setSavingSetup] = useState(false);
  const [notice, setNotice] = useState("");
  const [sending, setSending] = useState(false);
  const [uploadingMaterial, setUploadingMaterial] = useState(false);
  const [cancellationReason, setCancellationReason] = useState("");
  const [cancellationDetails, setCancellationDetails] = useState("");
  const [cancelConfirmationOpen, setCancelConfirmationOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [pauseDetails, setPauseDetails] = useState("");
  const [pauseDurationMonths, setPauseDurationMonths] = useState(1);
  const [pauseConfirmationOpen, setPauseConfirmationOpen] = useState(false);
  const [pausingSubscription, setPausingSubscription] = useState(false);
  const [selectedPauseDeviceId, setSelectedPauseDeviceId] = useState("");
  const [selectedPauseSubscriptionId, setSelectedPauseSubscriptionId] = useState("");
  const [selectedPausePricingPlanCode, setSelectedPausePricingPlanCode] = useState("");
  const [devicePauseConfirmationOpen, setDevicePauseConfirmationOpen] =
    useState(false);
  const [pausingDevice, setPausingDevice] = useState(false);
  const [selectedCancelDeviceIds, setSelectedCancelDeviceIds] = useState<string[]>([]);
  const [selectedCancelSubscriptionId, setSelectedCancelSubscriptionId] = useState("");
  const [selectedCancelPricingPlanCode, setSelectedCancelPricingPlanCode] =
    useState("");
  const [deviceCancelConfirmationOpen, setDeviceCancelConfirmationOpen] =
    useState(false);
  const [cancellingDevices, setCancellingDevices] = useState(false);
  const [resumeConfirmationOpen, setResumeConfirmationOpen] = useState(false);
  const [resumingSubscription, setResumingSubscription] = useState(false);
  const [exportingData, setExportingData] = useState(false);
  const [savingConsents, setSavingConsents] = useState(false);
  const [consentDrafts, setConsentDrafts] = useState({
    marketingConsent: false,
    analyticsConsent: false,
    remoteSupportConsent: false,
  });
  const router = useRouter();

  const billableSubscriptions = useMemo(
    () => (data?.subscriptions || []).filter(subscriptionIsBillable),
    [data?.subscriptions],
  );
  const activeSubscription = billableSubscriptions[0] || data?.subscriptions[0];
  const activeDevicePauses = useMemo(
    () => (data?.devicePauses || []).filter((pause) => pause.status === "active"),
    [data?.devicePauses],
  );
  const activeDevicePauseByDeviceId = useMemo(
    () =>
      new Map(activeDevicePauses.map((pause) => [pause.device_id, pause])),
    [activeDevicePauses],
  );
  const openDeviceCancellations = useMemo(
    () =>
      (data?.deviceCancellations || []).filter((cancellation) =>
        ["scheduled", "active_until_period_end"].includes(cancellation.status),
      ),
    [data?.deviceCancellations],
  );
  const openDeviceCancellationByDeviceId = useMemo(
    () =>
      new Map(
        openDeviceCancellations.map((cancellation) => [
          cancellation.device_id,
          cancellation,
        ]),
      ),
    [openDeviceCancellations],
  );
  const selectedPauseSubscription =
    billableSubscriptions.find(
      (subscription) => subscription.id === selectedPauseSubscriptionId,
    ) ||
    (billableSubscriptions.length === 1 ? billableSubscriptions[0] : null);
  const selectedPausePlanOptions = selectedPauseSubscription
    ? subscriptionPausePlanOptions(selectedPauseSubscription)
    : [];
  const selectedPausePlan =
    selectedPausePlanOptions.find(
      (option) =>
        option.pricingPlanCode === selectedPausePricingPlanCode ||
        option.value === selectedPausePricingPlanCode,
    ) || selectedPausePlanOptions[0];
  const selectedPauseDevice = data?.devices.find(
    (device) => device.id === selectedPauseDeviceId,
  );
  const selectedCancelSubscription =
    billableSubscriptions.find(
      (subscription) => subscription.id === selectedCancelSubscriptionId,
    ) ||
    (billableSubscriptions.length === 1 ? billableSubscriptions[0] : null);
  const selectedCancelPlanOptions = selectedCancelSubscription
    ? subscriptionPausePlanOptions(selectedCancelSubscription)
    : [];
  const selectedCancelPlan =
    selectedCancelPlanOptions.find(
      (option) =>
        option.pricingPlanCode === selectedCancelPricingPlanCode ||
        option.value === selectedCancelPricingPlanCode,
    ) || selectedCancelPlanOptions[0];
  const selectedCancelDevices =
    data?.devices.filter((device) => selectedCancelDeviceIds.includes(device.id)) || [];
  const activeTemporaryDiscount = data?.subscriptionAdjustments.find(
    (adjustment) => adjustment.customer_subscription_id === activeSubscription?.id,
  );
  const quotedItems = activeSubscription?.quote_items || [];
  const screenQuantity = Math.max(1, activeSubscription?.screen_quantity || 1);
  const hardwareSubtotalSek = activeSubscription
    ? quotedItems.length
      ? quotedItems.reduce(
          (sum, item) => sum + (item.hardwareFeeSek || 0) * Math.max(1, item.quantity || 1),
          0,
        )
      : (activeSubscription.hardware_fee_sek || 0) * screenQuantity
    : 0;
  const shippingSubtotalSek = activeSubscription
    ? activeSubscription.base_shipping_fee_sek !== null
      ? activeSubscription.shipping_fee_sek || 0
      : quotedItems.length
        ? quotedItems.reduce(
            (sum, item) => sum + (item.shippingFeeSek || 0) * Math.max(1, item.quantity || 1),
            0,
          )
        : (activeSubscription.shipping_fee_sek || 0) * screenQuantity
    : 0;
  const monthlySubtotalSek = activeSubscription
    ? quotedItems.length
      ? quotedItems.reduce(
          (sum, item) => sum + (item.monthlyFeeSek || 0) * Math.max(1, item.quantity || 1),
          0,
        )
      : (activeSubscription.monthly_fee_sek || 0) * screenQuantity
    : 0;
  const initialPaymentSek = activeSubscription
    ? subscriptionInitialPaymentSek(activeSubscription)
    : 0;
  const monthlyPaymentSek = monthlySubtotalSek;
  const combinedScreenQuantity = billableSubscriptions.reduce(
    (sum, subscription) => sum + Math.max(0, subscription.screen_quantity || 0),
    0,
  );
  const combinedMonthlyPaymentSek = billableSubscriptions.reduce(
    (sum, subscription) => sum + subscriptionMonthlyTotalSek(subscription),
    0,
  );
  const activeDevicePauseAmountSek = activeDevicePauses.reduce(
    (sum, pause) => sum + (pause.monthly_fee_sek || 0),
    0,
  );
  const openDeviceCancellationAmountSek = openDeviceCancellations.reduce(
    (sum, cancellation) => sum + (cancellation.monthly_fee_sek || 0),
    0,
  );
  const monthlyAmountRemovedByDeviceChangesSek =
    activeDevicePauseAmountSek + openDeviceCancellationAmountSek;
  const adjustedCombinedMonthlyPaymentSek = Math.max(
    0,
    (combinedMonthlyPaymentSek || monthlyPaymentSek) -
      monthlyAmountRemovedByDeviceChangesSek,
  );
  const combinedPackageLabel =
    billableSubscriptions.length > 0
      ? billableSubscriptions.map(subscriptionPackageLabel).join(" + ")
      : activeSubscription
        ? subscriptionPackageLabel(activeSubscription)
        : "-";
  const latestPaymentStatus =
    billableSubscriptions.find((subscription) => subscription.stripe_payment_status)
      ?.stripe_payment_status ||
    activeSubscription?.stripe_payment_status ||
    null;
  const subscriptionPaused =
    data?.customer.service_access_status === "paused" ||
    billableSubscriptions.some(
      (subscription) =>
        subscription.status === "paused" || Boolean(subscription.pause_started_at),
    );
  const paymentFailed =
    data?.customer.payment_status === "failed" ||
    data?.customer.service_access_status === "payment_failed" ||
    billableSubscriptions.some(
      (subscription) =>
        subscription.status === "payment_failed" ||
        subscription.stripe_payment_status === "payment_failed" ||
        subscription.stripe_payment_status === "past_due" ||
        subscription.fulfillment_status === "payment_failed",
    );
  const visibleCustomerStatus = paymentFailed ? "payment_failed" : data?.customer.status || null;
  const pauseResumeDate = addMonths(new Date(), pauseDurationMonths);
  const discountedMonthlyPaymentSek = activeTemporaryDiscount
    ? monthlyPaymentSek * (1 - activeTemporaryDiscount.percent_off / 100)
    : monthlyPaymentSek;
  const dashboardStats = useMemo(
    () => [
      { label: "Skärmar", value: String(data?.devices.length || 0) },
      { label: "Nya uppladdningar", value: String(data?.displayAssets.filter((item) => item.status === "new").length || 0) },
      { label: "Ärenden", value: String(data?.messages.length || 0) },
    ],
    [data],
  );

  const loadAccount = useCallback(async () => {
    const response = await fetch("/api/account");
    if (response.status === 401) {
      router.push("/login");
      return;
    }

    const nextData = await response.json();
    setData(nextData);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    loadAccount();
  }, [loadAccount]);

  useEffect(() => {
    setNotice("");
  }, [activeSection]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.set("section", activeSection);
    window.history.replaceState(null, "", `?${params.toString()}`);
  }, [activeSection]);

  useEffect(() => {
    const onPopState = () => setActiveSection(getInitialAccountSection());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    if (!data?.customer) return;
    setSetupBusinessName(data.customer.name || "");
    setSetupBusinessDescription(data.customer.business_description || "");
    setSetupOpeningHours(data.customer.opening_hours || "");
    setSetupPromotions(data.customer.promotions || "");
    setSetupWebsiteUrl(data.customer.website_url || "");
    setSetupSocialMedia(data.customer.social_media || "");
    setSetupContentOption(data.customer.content_option || "template");
    setConsentDrafts({
      marketingConsent: Boolean(data.customer.marketing_consent),
      analyticsConsent: Boolean(data.customer.analytics_consent),
      remoteSupportConsent: Boolean(data.customer.remote_support_consent),
    });
  }, [data?.customer]);

  useEffect(() => {
    if (!data) return;

    setSelectedPauseDeviceId((current) => {
      if (
        current &&
        data.devices.some(
          (device) =>
            device.id === current &&
            device.is_active &&
            !activeDevicePauseByDeviceId.has(device.id) &&
            !openDeviceCancellationByDeviceId.has(device.id),
        )
      ) {
        return current;
      }

      return (
        data.devices.find(
          (device) =>
            device.is_active &&
            !activeDevicePauseByDeviceId.has(device.id) &&
            !openDeviceCancellationByDeviceId.has(device.id),
        )?.id || ""
      );
    });

    setSelectedPauseSubscriptionId((current) => {
      if (
        current &&
        billableSubscriptions.some((subscription) => subscription.id === current)
      ) {
        return current;
      }

      return billableSubscriptions.length === 1 ? billableSubscriptions[0].id : "";
    });
  }, [
    activeDevicePauseByDeviceId,
    billableSubscriptions,
    data,
    openDeviceCancellationByDeviceId,
  ]);

  useEffect(() => {
    if (!data) return;

    setSelectedCancelDeviceIds((current) =>
      current.filter((deviceId) =>
        data.devices.some(
          (device) =>
            device.id === deviceId &&
            device.is_active &&
            !activeDevicePauseByDeviceId.has(device.id) &&
            !openDeviceCancellationByDeviceId.has(device.id),
        ),
      ),
    );

    setSelectedCancelSubscriptionId((current) => {
      if (
        current &&
        billableSubscriptions.some((subscription) => subscription.id === current)
      ) {
        return current;
      }

      return billableSubscriptions.length === 1 ? billableSubscriptions[0].id : "";
    });
  }, [
    activeDevicePauseByDeviceId,
    billableSubscriptions,
    data,
    openDeviceCancellationByDeviceId,
  ]);

  useEffect(() => {
    if (!selectedPauseSubscription) {
      setSelectedPausePricingPlanCode("");
      return;
    }

    const options = subscriptionPausePlanOptions(selectedPauseSubscription);
    setSelectedPausePricingPlanCode((current) => {
      if (
        current &&
        options.some(
          (option) => option.pricingPlanCode === current || option.value === current,
        )
      ) {
        return current;
      }

      return options.length === 1 ? options[0].pricingPlanCode || options[0].value : "";
    });
  }, [selectedPauseSubscription]);

  useEffect(() => {
    if (!selectedCancelSubscription) {
      setSelectedCancelPricingPlanCode("");
      return;
    }

    const options = subscriptionPausePlanOptions(selectedCancelSubscription);
    setSelectedCancelPricingPlanCode((current) => {
      if (
        current &&
        options.some(
          (option) => option.pricingPlanCode === current || option.value === current,
        )
      ) {
        return current;
      }

      return options.length === 1 ? options[0].pricingPlanCode || options[0].value : "";
    });
  }, [selectedCancelSubscription]);

  const fileToPayload = (file: File, category = "other") => {
    return new Promise<{
      name: string;
      type: string;
      size: number;
      data: string;
      category: string;
    }>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () =>
        resolve({
          name: file.name,
          type: file.type,
          size: file.size,
          data: String(reader.result || ""),
          category,
        });
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  };

  const addMaterialFiles = (files: FileList | File[]) => {
    const nextFiles = Array.from(files).map((file) => ({
      file,
      category: materialCategory,
    }));
    setMaterialFiles((current) => [...current, ...nextFiles].slice(0, 8));
  };

  const downloadDataExport = async () => {
    setExportingData(true);
    setNotice("");

    const response = await fetch("/api/account/export");

    if (!response.ok) {
      setNotice("Kunde inte skapa dataexporten. Kontakta Screenia om problemet kvarstår.");
      setExportingData(false);
      return;
    }

    const blob = await response.blob();
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const disposition = response.headers.get("Content-Disposition") || "";
    const fileName =
      disposition.match(/filename="([^"]+)"/u)?.[1] ||
      `screenia-data-export-${new Date().toISOString().slice(0, 10)}.json`;

    link.href = downloadUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(downloadUrl);
    setNotice("Dataexporten har laddats ner.");
    setExportingData(false);
  };

  const saveConsentSettings = async () => {
    setSavingConsents(true);
    setNotice("");

    const response = await fetch("/api/account/consents", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(consentDrafts),
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      setNotice(
        result.error ||
          "Kunde inte uppdatera samtycken. Kontakta Screenia om problemet kvarstår.",
      );
      setSavingConsents(false);
      return;
    }

    await loadAccount();
    setNotice(
      result.changedConsents?.length
        ? "Samtycken har uppdaterats."
        : "Inga samtycken ändrades.",
    );
    setSavingConsents(false);
  };

  const addSetupFiles = (files: FileList | File[]) => {
    const nextFiles = Array.from(files).map((file) => ({
      file,
      category: "image",
    }));
    setSetupFiles((current) => [...current, ...nextFiles].slice(0, 8));
  };

  const submitContentSetup = async () => {
    if (!setupBusinessName.trim() || !setupBusinessDescription.trim()) {
      setNotice("Företagsnamn och kort beskrivning måste anges.");
      return;
    }

    if (setupContentOption === "upload" && !setupNotes.trim() && setupFiles.length === 0) {
      setNotice("Lägg till filer eller skriv vad skärmen ska visa.");
      return;
    }

    setSavingSetup(true);
    setNotice("");
    const files = await Promise.all(
      setupFiles.map((item) => fileToPayload(item.file, item.category)),
    );

    const response = await fetch("/api/account/content-setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessName: setupBusinessName,
        businessDescription: setupBusinessDescription,
        openingHours: setupOpeningHours,
        promotions: setupPromotions,
        websiteUrl: setupWebsiteUrl,
        socialMedia: setupSocialMedia,
        contentOption: setupContentOption,
        displayNotes: setupNotes,
        displayFiles: files,
      }),
    });
    const result = await response.json();

    if (!response.ok) {
      setNotice(result.error || "Kunde inte spara innehållsunderlaget.");
      setSavingSetup(false);
      return;
    }

    setSetupFiles([]);
    setSetupNotes("");
    setNotice("Innehållsunderlaget har skickats till Screenia.");
    setSavingSetup(false);
    loadAccount();
  };

  const submitPreviewDecision = async (
    decision: "approved" | "changes_requested",
  ) => {
    if (decision === "changes_requested" && previewFeedback.trim().length < 5) {
      setNotice("Beskriv vad du vill att Screenia ska ändra.");
      return;
    }

    setSavingPreviewDecision(true);
    setNotice("");

    const response = await fetch("/api/account/preview-decision", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        decision,
        feedback: previewFeedback,
      }),
    });
    const result = await response.json();

    if (!response.ok) {
      setNotice(result.error || "Kunde inte spara svaret på förhandsvisningen.");
      setSavingPreviewDecision(false);
      return;
    }

    setPreviewFeedback("");
    setNotice(
      decision === "approved"
        ? "Förhandsvisningen är godkänd."
        : "Dina ändringar har skickats till Screenia.",
    );
    setSavingPreviewDecision(false);
    await loadAccount();
  };

  const uploadDisplayMaterial = async () => {
    if (!materialDescription.trim() && materialFiles.length === 0) {
      setNotice("Lägg till en beskrivning eller minst en fil innan du skickar.");
      return;
    }

    setUploadingMaterial(true);
    setNotice("");
    const files = await Promise.all(
      materialFiles.map((item) => fileToPayload(item.file, item.category)),
    );
    const response = await fetch("/api/account/display-assets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description: materialDescription,
        files,
      }),
    });
    const result = await response.json();

    if (!response.ok) {
      setNotice(result.error || "Kunde inte ladda upp materialet.");
      setUploadingMaterial(false);
      return;
    }

    setMaterialDescription("");
    setMaterialFiles([]);
    setNotice("Materialet har skickats till Screenia.");
    await loadAccount();
    setUploadingMaterial(false);
  };

  const sendMessage = async () => {
    if (!messageText.trim()) {
      setNotice("Skriv ett meddelande innan du skickar.");
      return;
    }

    setSending(true);
    setNotice("");
    const files = await Promise.all(messageFiles.map((file) => fileToPayload(file)));
    const response = await fetch("/api/account/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subject: messageSubject,
        message: messageText,
        requestType,
        priority: requestPriority,
        relatedTicketNumber: relatedTicketNumber || null,
        files,
      }),
    });
    const result = await response.json();

    if (!response.ok) {
      setNotice(result.error || "Kunde inte skicka ärendet.");
      setSending(false);
      return;
    }

    setMessageSubject("");
    setMessageText("");
    setMessageFiles([]);
    setRelatedTicketNumber("");
    setNotice(
      result.ticketNumber
        ? `Ärendet har skickats. Ärendenummer: ${result.ticketNumber}`
        : "Ärendet har skickats till Screenia.",
    );
    await loadAccount();
    setSending(false);
  };

  const openBillingPortal = async () => {
    setNotice("");
    const response = await fetch("/api/account/billing-portal", {
      method: "POST",
    });
    const result = await response.json();
    if (!response.ok || !result.url) {
      setNotice(result.error || "Kunde inte öppna betalningsportalen.");
      return;
    }
    window.location.href = result.url;
  };

  const requestCancellation = () => {
    if (!cancellationReason) {
      setNotice("Välj en avslutsorsak först.");
      return;
    }

    setNotice("");
    setCancelConfirmationOpen(true);
  };

  const cancelSubscription = async () => {
    setCancelConfirmationOpen(false);

    setCancelling(true);
    setNotice("");
    const response = await fetch("/api/account/cancel-subscription", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reason: cancellationReason,
        details: cancellationDetails,
      }),
    });
    const result = await response.json();
    if (!response.ok) {
      setNotice(result.error || "Kunde inte avsluta abonnemanget.");
      setCancelling(false);
      return;
    }
    setNotice(
      result.cancellationEffectiveAt
        ? `Abonnemanget avslutas ${date(result.cancellationEffectiveAt)}. Tjänsten fungerar fram till dess.`
        : "Abonnemanget avslutas vid periodens slut. Tjänsten fungerar fram till dess.",
    );
    setCancelling(false);
    loadAccount();
  };

  const requestPause = () => {
    setNotice("");
    setPauseConfirmationOpen(true);
  };

  const requestDevicePause = () => {
    if (!selectedPauseDeviceId) {
      setNotice("Välj skärmen som ska pausas.");
      return;
    }

    if (!selectedPauseSubscriptionId) {
      setNotice("Välj vilken abonnemangsdel skärmen hör till.");
      return;
    }

    if (!selectedPausePlan) {
      setNotice("Välj teknisk nivå för skärmen som ska pausas.");
      return;
    }

    setNotice("");
    setDevicePauseConfirmationOpen(true);
  };

  const pauseSubscription = async () => {
    setPauseConfirmationOpen(false);
    setPausingSubscription(true);
    setNotice("");

    const response = await fetch("/api/account/pause-subscription", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reason: pauseDetails,
        durationMonths: pauseDurationMonths,
      }),
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      setNotice(result.error || "Kunde inte pausa abonnemanget.");
      setPausingSubscription(false);
      return;
    }

    setPauseDetails("");
    setNotice(
      result.warning
        ? `Abonnemanget är pausat, men bekräftelsemejlet behöver kontrolleras: ${result.warning}`
        : result.pauseResumesAt
          ? `Abonnemanget är pausat till ${date(result.pauseResumesAt)}. En bekräftelse har skickats till kontots e-postadress.`
          : "Abonnemanget är pausat. En bekräftelse har skickats till kontots e-postadress.",
    );
    setPausingSubscription(false);
    await loadAccount();
  };

  const pauseDevice = async () => {
    setDevicePauseConfirmationOpen(false);
    setPausingDevice(true);
    setNotice("");

    const response = await fetch("/api/account/pause-device", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deviceId: selectedPauseDeviceId,
        customerSubscriptionId: selectedPauseSubscriptionId,
        pricingPlanCode: selectedPausePlan?.pricingPlanCode || "",
        durationMonths: pauseDurationMonths,
        reason: pauseDetails,
      }),
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      setNotice(result.error || "Kunde inte pausa vald skärm.");
      setPausingDevice(false);
      return;
    }

    setPauseDetails("");
    setNotice(
      result.warning
        ? `Skärmen är pausad, men bekräftelsemejlet behöver kontrolleras: ${result.warning}`
        : result.pauseResumesAt
          ? `Skärmen ${result.deviceLabel || ""} är pausad till ${date(result.pauseResumesAt)}. Övriga skärmar fortsätter som vanligt.`
          : "Vald skärm är pausad. Övriga skärmar fortsätter som vanligt.",
    );
    setPausingDevice(false);
    await loadAccount();
  };

  const toggleCancelDevice = (deviceId: string) => {
    setSelectedCancelDeviceIds((current) =>
      current.includes(deviceId)
        ? current.filter((id) => id !== deviceId)
        : [...current, deviceId],
    );
  };

  const requestDeviceCancellation = () => {
    if (!selectedCancelDeviceIds.length) {
      setNotice("Välj minst en skärm som ska avslutas.");
      return;
    }

    if (!selectedCancelSubscriptionId) {
      setNotice("Välj vilken abonnemangsdel skärmarna hör till.");
      return;
    }

    if (!selectedCancelPlan) {
      setNotice("Välj teknisk nivå för skärmarna som ska avslutas.");
      return;
    }

    setNotice("");
    setDeviceCancelConfirmationOpen(true);
  };

  const cancelSelectedDevices = async () => {
    setDeviceCancelConfirmationOpen(false);
    setCancellingDevices(true);
    setNotice("");

    const response = await fetch("/api/account/cancel-devices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deviceIds: selectedCancelDeviceIds,
        customerSubscriptionId: selectedCancelSubscriptionId,
        pricingPlanCode: selectedCancelPlan?.pricingPlanCode || "",
        reason: cancellationDetails || "Kunden avslutade valda skärmar i kundportalen.",
      }),
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      setNotice(result.error || "Kunde inte avsluta valda skärmar.");
      setCancellingDevices(false);
      return;
    }

    setSelectedCancelDeviceIds([]);
    setNotice(
      result.warning
        ? `Valda skärmar är markerade för avslut, men bekräftelsemejlet behöver kontrolleras: ${result.warning}`
        : result.cancellationEffectiveAt
          ? `Valda skärmar avslutas från ${date(result.cancellationEffectiveAt)}. Övriga skärmar fortsätter som vanligt.`
          : "Valda skärmar är markerade för avslut. Övriga skärmar fortsätter som vanligt.",
    );
    setCancellingDevices(false);
    await loadAccount();
  };

  const requestResume = () => {
    setNotice("");
    setResumeConfirmationOpen(true);
  };

  const resumeSubscription = async () => {
    setResumeConfirmationOpen(false);
    setResumingSubscription(true);
    setNotice("");

    const response = await fetch("/api/account/resume-subscription", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reason: "Kunden återaktiverade abonnemanget i kundportalen.",
      }),
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      setNotice(result.error || "Kunde inte återaktivera abonnemanget.");
      setResumingSubscription(false);
      return;
    }

    setNotice(
      result.warning
        ? `Abonnemanget är återaktiverat, men bekräftelsemejlet behöver kontrolleras: ${result.warning}`
        : "Abonnemanget är återaktiverat. En bekräftelse har skickats till kontots e-postadress.",
    );
    setResumingSubscription(false);
    await loadAccount();
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  if (loading) {
    return (
      <AccountShell onSignOut={signOut}>
        <AccountStatePanel
          eyebrow="Kundportal"
          title="Laddar ditt konto"
          text="Vi hämtar abonnemang, skärmar, material och ärenden."
        />
      </AccountShell>
    );
  }

  if (!data) {
    return (
      <AccountShell onSignOut={signOut}>
        <AccountStatePanel
          eyebrow="Kundportal"
          title="Kunde inte ladda ditt konto"
          text="Logga in igen eller kontakta Screenia om problemet kvarstår."
        />
      </AccountShell>
    );
  }

  return (
    <AccountShell onSignOut={signOut}>
      <div className="account-dashboard">
        <aside className="account-sidebar" aria-label="Account sections">
          <div className="account-sidebar-profile">
            <span className="account-avatar">{data.customer.name.slice(0, 1).toUpperCase()}</span>
            <div>
              <strong>{data.customer.name}</strong>
              <span>{data.customer.email}</span>
            </div>
          </div>

          <nav className="account-menu">
            {sections.map((section) => (
              <button
                key={section.id}
                type="button"
                className={
                  activeSection === section.id
                    ? "account-menu-button-active"
                    : undefined
                }
                onClick={() => setActiveSection(section.id)}
              >
                <strong>{section.label}</strong>
                <span>{section.detail}</span>
              </button>
            ))}
          </nav>
        </aside>

        <main className="account-main">
          <section className="account-hero-panel">
            <div>
              <p className="landing-eyebrow">Kundportal</p>
              <h1>{sections.find((item) => item.id === activeSection)?.label}</h1>
              <p>
                Hantera abonnemang, skärmmaterial, ärenden och kontohistorik på ett samlat ställe.
              </p>
            </div>
            <StatusPill label={statusLabel(visibleCustomerStatus)} />
          </section>

          {notice && <p className="flow-message">{notice}</p>}

          {activeSection === "overview" && (
            <div className="account-panel-stack">
              <section className="account-stat-grid">
                {dashboardStats.map((item) => (
                  <div key={item.label} className="account-stat">
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </div>
                ))}
              </section>

              <AccountCard title="Orderstatus">
                <div className="account-status-timeline">
                  {journeySteps(data).map((step, index) => (
                    <div
                      key={step.label}
                      className={`account-status-step ${
                        step.done ? "account-status-step-done" : ""
                      }`}
                    >
                      <span>{index + 1}</span>
                      <div>
                        <strong>{step.label}</strong>
                        <p>{step.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </AccountCard>

              <AccountCard title="Setup och avbokning">
                <div
                  className={`account-policy-card ${
                    data.customer.setup_fee_locked_at
                      ? "account-policy-card-locked"
                      : "account-policy-card-open"
                  }`}
                >
                  <strong>
                    {data.customer.setup_fee_locked_at
                      ? "Layoutarbetet har startat"
                      : "Layoutarbetet har inte startat ännu"}
                  </strong>
                  <p>
                    {data.customer.setup_fee_locked_at
                      ? `Startavgiften är markerad som ej återbetalningsbar från ${date(data.customer.setup_fee_locked_at)}.`
                      : "Om du avbokar innan Screenia har startat layoutarbetet kan startavgiften hanteras som återbetalningsbar."}
                  </p>
                </div>
                <div className="account-facts">
                  <Fact
                    label="Produktion"
                    value={statusLabel(data.customer.production_status || "not_started")}
                  />
                  <Fact
                    label="Startat"
                    value={date(data.customer.layout_started_at)}
                  />
                </div>
              </AccountCard>

              <section className="account-grid">
                <AccountCard title="Företagsuppgifter">
                  <div className="account-facts">
                    <Fact label="E-post" value={data.customer.email} />
                    <Fact label="Kontakt" value={data.customer.contact_person || "-"} />
                    <Fact label="Telefon" value={data.customer.phone || "-"} />
                    <Fact
                      label="Adress"
                      value={[data.customer.address, data.customer.city, data.customer.country]
                        .filter(Boolean)
                        .join(", ") || "-"}
                    />
                    <Fact label="Aktiverat" value={date(data.customer.activated_at)} />
                    <Fact label="Betalning" value={data.customer.payment_status || "-"} />
                  </div>
                </AccountCard>

                <AccountCard title="Skärmar">
                  {data.devices.length ? (
                    <div className="account-list">
                      {data.devices.map((device) => (
                        <div key={device.id} className="account-list-item">
                          <strong>{device.name || device.device_code}</strong>
                          <span>
                            {device.location || "Ingen plats"} |{" "}
                            {device.is_active ? "Aktiv" : "Inaktiv"}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p>Din skärm visas här när den är förberedd.</p>
                  )}
                </AccountCard>
              </section>
            </div>
          )}

          {activeSection === "setup" && (
            <div className="account-panel-stack">
              <AccountCard title="Första innehållssetup">
                <p>
                  Här samlar vi allt Screenia behöver för att skapa första
                  skärmförslaget. Du kan skicka filer nu, välja mall eller be oss
                  kontakta dig senare.
                </p>
                <div className="account-facts">
                  <Fact label="Status" value={statusLabel(visibleCustomerStatus)} />
                  <Fact label="Senast skickat" value={date(data.customer.content_collected_at)} />
                  <Fact label="Förhandsvisning" value={statusLabel(data.customer.preview_status)} />
                  <Fact label="Valt innehållssätt" value={contentOptionLabel(data.customer.content_option)} />
                </div>

                <div className="flow-form-grid">
                  <input
                    id="setup-business-name"
                    name="setupBusinessName"
                    aria-label="Företagsnamn"
                    value={setupBusinessName}
                    onChange={(event) => setSetupBusinessName(event.target.value)}
                    placeholder="Företagsnamn *"
                    autoComplete="organization"
                    required
                    className="account-input"
                  />
                  <input
                    id="setup-website-url"
                    name="setupWebsiteUrl"
                    aria-label="Webbplats"
                    value={setupWebsiteUrl}
                    onChange={(event) => setSetupWebsiteUrl(event.target.value)}
                    placeholder="Webbplats"
                    autoComplete="url"
                    inputMode="url"
                    className="account-input"
                  />
                  <input
                    id="setup-social-media"
                    name="setupSocialMedia"
                    aria-label="Sociala medier"
                    value={setupSocialMedia}
                    onChange={(event) => setSetupSocialMedia(event.target.value)}
                    placeholder="Sociala medier"
                    inputMode="url"
                    className="account-input"
                  />
                  <input
                    id="setup-opening-hours"
                    name="setupOpeningHours"
                    aria-label="Öppettider"
                    value={setupOpeningHours}
                    onChange={(event) => setSetupOpeningHours(event.target.value)}
                    placeholder="Öppettider"
                    className="account-input"
                  />
                </div>
                <textarea
                  id="setup-business-description"
                  name="setupBusinessDescription"
                  aria-label="Beskriv verksamheten kort"
                  value={setupBusinessDescription}
                  onChange={(event) => setSetupBusinessDescription(event.target.value)}
                  placeholder="Beskriv verksamheten kort. Exempel: restaurang med lunchmeny, kampanjer och QR-kod till onlinebeställning. *"
                  rows={4}
                  required
                  className="account-input"
                />
                <textarea
                  id="setup-promotions"
                  name="setupPromotions"
                  aria-label="Aktuella kampanjer, priser eller budskap"
                  value={setupPromotions}
                  onChange={(event) => setSetupPromotions(event.target.value)}
                  placeholder="Aktuella kampanjer, priser eller budskap"
                  rows={3}
                  className="account-input"
                />
              </AccountCard>

              <AccountCard title="Innehållsalternativ">
                <div className="account-service-grid">
                  <AccountChoice
                    active={setupContentOption === "upload"}
                    title="Jag har material"
                    text="Ladda upp logotyp, meny, bilder eller PDF."
                    onClick={() => setSetupContentOption("upload")}
                  />
                  <AccountChoice
                    active={setupContentOption === "template"}
                    title="Använd Screenia-mall"
                    text="Vi skapar första versionen utifrån dina uppgifter."
                    onClick={() => setSetupContentOption("template")}
                  />
                  <AccountChoice
                    active={setupContentOption === "later"}
                    title="Skicka senare"
                    text="Vi kontaktar dig när det är dags för material."
                    onClick={() => setSetupContentOption("later")}
                  />
                </div>

                <div className="account-upload-workspace">
                  <label
                    className="account-dropzone"
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault();
                      addSetupFiles(event.dataTransfer.files);
                    }}
                  >
                    <input
                      id="setup-display-files"
                      name="setupDisplayFiles"
                      aria-label="Välj innehållsfiler"
                      type="file"
                      multiple
                      accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
                      onChange={(event) => addSetupFiles(event.target.files || [])}
                    />
                    <span className="account-upload-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" focusable="false">
                        <path d="M11 16h2V7.8l3.6 3.6L18 10l-6-6-6 6 1.4 1.4L11 7.8V16Z" />
                        <path d="M5 14h2v4h10v-4h2v4a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-4Z" />
                      </svg>
                    </span>
                    <strong>Välj filer</strong>
                    <em>eller släpp filer här</em>
                    <small>Stöds: .png, .jpg, .webp, .heic, .pdf</small>
                  </label>

                  <div className="account-upload-side">
                    <h3>Valda filer</h3>
                    <div className="account-file-list">
                      {setupFiles.length ? (
                        setupFiles.map((item, index) => (
                          <div key={`${item.file.name}-${item.file.size}-${index}`} className="account-file-row">
                            <span className="account-file-icon">FIL</span>
                            <div>
                              <strong>{item.file.name}</strong>
                              <span>{fileSize(item.file.size)}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                setSetupFiles((current) =>
                                  current.filter((_, fileIndex) => fileIndex !== index),
                                )
                              }
                              aria-label={`Ta bort ${item.file.name}`}
                            >
                              x
                            </button>
                          </div>
                        ))
                      ) : (
                        <p>Inga filer valda ännu.</p>
                      )}
                    </div>
                  </div>
                </div>

                <textarea
                  id="setup-notes"
                  name="setupNotes"
                  aria-label="Önskemål för skärmen"
                  value={setupNotes}
                  onChange={(event) => setSetupNotes(event.target.value)}
                  placeholder="Skriv önskemål för skärmen: färger, meny, kampanj, QR-kod, bilder eller annat vi ska tänka på."
                  rows={5}
                  maxLength={1200}
                  className="account-input"
                />
                <button
                  type="button"
                  disabled={savingSetup}
                  onClick={submitContentSetup}
                  className="landing-button landing-button-primary"
                >
                  {savingSetup ? "Skickar..." : "Skicka innehållsunderlag"}
                </button>
              </AccountCard>

              <AccountCard title="Förhandsvisning">
                {data.customer.preview_url ? (
                  <div className="account-card-stack">
                    <div className="account-list-item account-history-row">
                      <div>
                        <strong>Första skärmförslaget</strong>
                        <span>{statusLabel(data.customer.preview_status)}</span>
                        {data.customer.preview_feedback && (
                          <p>{data.customer.preview_feedback}</p>
                        )}
                      </div>
                      <a href={data.customer.preview_url} target="_blank" rel="noreferrer">
                        Öppna preview
                      </a>
                    </div>

                    <label>
                      Feedback eller ändringar
                      <textarea
                        rows={4}
                        value={previewFeedback}
                        onChange={(event) => setPreviewFeedback(event.target.value)}
                        placeholder="Skriv bara om något ska ändras innan godkännande."
                      />
                    </label>

                    <div className="account-action-row">
                      <button
                        type="button"
                        className="landing-button landing-button-primary"
                        disabled={savingPreviewDecision}
                        onClick={() => submitPreviewDecision("approved")}
                      >
                        {savingPreviewDecision ? "Sparar..." : "Godkänn preview"}
                      </button>
                      <button
                        type="button"
                        className="landing-button landing-button-secondary"
                        disabled={savingPreviewDecision}
                        onClick={() => submitPreviewDecision("changes_requested")}
                      >
                        Begär ändringar
                      </button>
                    </div>

                    {data.previewDecisions.length > 0 && (
                      <div className="account-history-list">
                        {data.previewDecisions.map((item) => (
                          <div key={item.id} className="account-history-row">
                            <div>
                              <strong>{statusLabel(item.decision)}</strong>
                              {item.feedback && <p>{item.feedback}</p>}
                            </div>
                            <span>{date(item.decided_at)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <p>Förhandsvisningen visas här när Screenia har skapat första förslaget.</p>
                )}
              </AccountCard>
            </div>
          )}

          {activeSection === "material" && (
            <div className="account-panel-stack">
              <AccountCard title="Skicka skärmmaterial">
                <div className="account-upload-workspace">
                  <label
                    className="account-dropzone"
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault();
                      addMaterialFiles(event.dataTransfer.files);
                    }}
                  >
                    <input
                      type="file"
                      multiple
                      accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
                      onChange={(event) => addMaterialFiles(event.target.files || [])}
                    />
                    <span className="account-upload-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" focusable="false">
                        <path d="M11 16h2V7.8l3.6 3.6L18 10l-6-6-6 6 1.4 1.4L11 7.8V16Z" />
                        <path d="M5 14h2v4h10v-4h2v4a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-4Z" />
                      </svg>
                    </span>
                    <strong>Bläddra</strong>
                    <em>släpp filer här</em>
                    <small>Stöds: .png, .jpg, .webp, .heic, .pdf</small>
                  </label>

                  <div className="account-upload-side">
                    <div className="account-upload-controls">
                      <label>
                        Kategori
                        <select
                          value={materialCategory}
                          onChange={(event) => setMaterialCategory(event.target.value)}
                          className="account-input"
                        >
                          <option value="logo">Logo</option>
                          <option value="image">Bildmaterial</option>
                          <option value="menu">Meny eller prislista</option>
                          <option value="other">Annat material</option>
                        </select>
                      </label>
                    </div>

                    <h3>Valda filer</h3>
                    <div className="account-file-list">
                      {materialFiles.length ? (
                        materialFiles.map((item, index) => (
                          <div key={`${item.file.name}-${item.file.size}-${index}`} className="account-file-row">
                            <span className="account-file-icon">IMG</span>
                            <div>
                              <strong>{item.file.name}</strong>
                              <span>{assetCategoryLabel(item.category)} | {fileSize(item.file.size)}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                setMaterialFiles((current) =>
                                  current.filter((_, fileIndex) => fileIndex !== index),
                                )
                              }
                              aria-label={`Remove ${item.file.name}`}
                            >
                              x
                            </button>
                          </div>
                        ))
                      ) : (
                        <p>Inga filer valda ännu.</p>
                      )}
                    </div>
                  </div>
                </div>

                <textarea
                  value={materialDescription}
                  onChange={(event) => setMaterialDescription(event.target.value)}
                  placeholder="Beskriv vad som ska ändras på skärmen, var filerna ska användas eller vilket budskap som ska visas."
                  rows={5}
                  maxLength={1200}
                  className="account-input"
                />

                <button
                  disabled={uploadingMaterial}
                  onClick={uploadDisplayMaterial}
                  className="landing-button landing-button-primary"
                >
                  {uploadingMaterial ? "Skickar..." : "Skicka till Screenia"}
                </button>
              </AccountCard>

              <AccountCard title="Tidigare uppladdat material">
                <HistoryList empty="Inget skärmmaterial har skickats ännu.">
                  {data.displayAssets.map((item) => (
                    <div key={item.id} className="account-list-item account-history-row">
                      <div>
                        <strong>{item.file_name || "Textinstruktion"}</strong>
                        <span>
                          {date(item.created_at)} | {assetCategoryLabel(item.asset_category)} | {statusLabel(item.status)}
                        </span>
                        {item.description && <p>{item.description}</p>}
                      </div>
                      {item.downloadUrl && (
                        <a href={item.downloadUrl} target="_blank" rel="noreferrer">
                          Ladda ner
                        </a>
                      )}
                    </div>
                  ))}
                </HistoryList>
              </AccountCard>
            </div>
          )}

          {activeSection === "messages" && (
            <div className="account-panel-stack">
              <AccountCard title="Skapa eller följ upp ett ärende">
                <div className="account-service-grid">
                  <label>
                    Ärendetyp
                    <select
                      id="support-request-type"
                      name="requestType"
                      value={requestType}
                      onChange={(event) => setRequestType(event.target.value)}
                      className="account-input"
                    >
                      {requestTypes.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Prioritet
                    <select
                      id="support-priority"
                      name="requestPriority"
                      value={requestPriority}
                      onChange={(event) => setRequestPriority(event.target.value)}
                      className="account-input"
                    >
                      {priorities.map((priority) => (
                        <option key={priority.value} value={priority.value}>
                          {priority.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <input
                  id="support-subject"
                  name="messageSubject"
                  aria-label="Rubrik"
                  value={messageSubject}
                  onChange={(event) => setMessageSubject(event.target.value)}
                  placeholder="Rubrik"
                  maxLength={160}
                  className="account-input"
                />
                <input
                  id="support-related-ticket"
                  name="relatedTicketNumber"
                  aria-label="Svar på ärendenummer"
                  value={relatedTicketNumber}
                  onChange={(event) => setRelatedTicketNumber(event.target.value)}
                  placeholder="Svar på ärendenummer, t.ex. IS-260613-ABC123 (valfritt)"
                  className="account-input"
                />
                <textarea
                  id="support-message"
                  name="messageText"
                  aria-label="Beskriv ärendet"
                  value={messageText}
                  onChange={(event) => setMessageText(event.target.value)}
                  placeholder="Beskriv problemet, returen, frågan eller uppdateringen. Ange gärna ordernummer, skärmkod, returorsak och önskat nästa steg."
                  rows={5}
                  maxLength={4000}
                  className="account-input"
                />
                <label className="account-compact-upload">
                  <input
                    id="support-files"
                    name="messageFiles"
                    aria-label="Bifoga filer"
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp,image/heic,application/pdf,text/plain"
                    onChange={(event) => setMessageFiles(Array.from(event.target.files || []))}
                  />
                  Bifoga filer
                </label>
                {messageFiles.length > 0 && (
                  <div className="account-file-list account-file-list-compact">
                    {messageFiles.map((file, index) => (
                      <div key={`${file.name}-${index}`} className="account-file-row">
                        <span className="account-file-icon">FILE</span>
                        <div>
                          <strong>{file.name}</strong>
                          <span>{fileSize(file.size)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  disabled={sending}
                  onClick={sendMessage}
                  className="landing-button landing-button-primary"
                >
                  {sending ? "Skickar..." : "Skicka ärende"}
                </button>
              </AccountCard>

              <AccountCard title="Ärendehistorik och konversationer">
                <HistoryList empty="Inga ärenden ännu.">
                  {data.messages.map((item) => (
                    <div key={item.id} className="account-list-item">
                      <strong>{item.subject || "Ärende"}</strong>
                      <span>
                        {item.ticket_number ? `${item.ticket_number} | ` : ""}
                        {requestTypeLabel(item.request_type)} | {priorityLabel(item.priority)} |{" "}
                        {date(item.created_at)} | {statusLabel(item.status)}
                      </span>
                      {item.related_ticket_number && (
                        <p>Uppföljning på ärende {item.related_ticket_number}</p>
                      )}
                      <p>{item.message}</p>
                      {item.files.length > 0 && (
                        <div className="account-history-links">
                          {item.files.map((file) =>
                            file.downloadUrl ? (
                              <a key={file.id} href={file.downloadUrl} target="_blank" rel="noreferrer">
                                {file.fileName}
                              </a>
                            ) : (
                              <span key={file.id}>{file.fileName}</span>
                            ),
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </HistoryList>
              </AccountCard>
            </div>
          )}

          {activeSection === "billing" && (
            <div className="account-panel-stack">
              {paymentFailed && (
                <AccountCard title="Betalning behöver åtgärdas">
                  <div className="account-payment-alert">
                    <strong>Den senaste betalningen kunde inte genomföras.</strong>
                    <p>
                      Skärmtjänsten är tillfälligt stoppad tills betalningen är
                      uppdaterad. Öppna betalningsportalen, kontrollera kort eller
                      betalningsmetod och genomför betalningen. När Stripe bekräftar
                      betalningen återaktiveras tjänsten automatiskt.
                    </p>
                    <button
                      className="landing-button landing-button-primary"
                      onClick={openBillingPortal}
                    >
                      Uppdatera betalning
                    </button>
                  </div>
                </AccountCard>
              )}
              <section className="account-grid">
                <AccountCard title="Abonnemang">
                  {activeSubscription ? (
                    <div className="account-facts">
                      <div className="account-subscription-summary">
                        <h3>Aktuellt abonnemang</h3>
                        <div className="account-subscription-summary-grid">
                          <Fact
                            label="Aktiva beställningar"
                            value={String(billableSubscriptions.length || 1)}
                          />
                          <Fact label="Paket och skärmar" value={combinedPackageLabel} />
                          <Fact
                            label="Totalt antal skärmar"
                            value={String(combinedScreenQuantity || screenQuantity)}
                          />
                          <Fact
                            label={
                              monthlyAmountRemovedByDeviceChangesSek
                                ? "Kommande månadspris"
                                : "Månadspris totalt"
                            }
                            value={money(adjustedCombinedMonthlyPaymentSek)}
                          />
                          <Fact
                            label="Senaste betalningsstatus"
                            value={statusLabel(latestPaymentStatus)}
                          />
                        </div>
                      </div>
                      <Fact label="Beställning" value={activeSubscription.order_number} />
                      <Fact
                        label="Paket"
                        value={subscriptionPackageLabel(activeSubscription)}
                      />
                      <Fact label="Status" value={statusLabel(activeSubscription.status)} />
                      <Fact
                        label="Antal skärmar"
                        value={String(screenQuantity)}
                      />
                      {activeSubscription.cancel_at_period_end && (
                        <Fact
                          label="Avslutas"
                          value={date(activeSubscription.cancellation_effective_at)}
                        />
                      )}
                      {activeSubscription.pause_started_at && (
                        <Fact
                          label="Pausad sedan"
                          value={date(activeSubscription.pause_started_at)}
                        />
                      )}
                      <Fact label="Första betalning" value={money(initialPaymentSek)} />
                      <Fact
                        label={
                          monthlyAmountRemovedByDeviceChangesSek
                            ? "Kommande månadspris"
                            : "Månadspris efter provperiod"
                        }
                        value={money(
                          monthlyAmountRemovedByDeviceChangesSek
                            ? adjustedCombinedMonthlyPaymentSek
                            : monthlyPaymentSek,
                        )}
                      />
                      {activeTemporaryDiscount && (
                        <>
                          <Fact
                            label="Aktiv tillfällig rabatt"
                            value={`${formatter.format(activeTemporaryDiscount.percent_off)} % i ${activeTemporaryDiscount.duration_months} månader`}
                          />
                          <Fact
                            label="Månadspris med rabatt"
                            value={preciseMoney(discountedMonthlyPaymentSek)}
                          />
                        </>
                      )}
                      {(activeSubscription.monthly_discount_amount_sek || 0) > 0 &&
                        (activeSubscription.device_discount_months || 0) > 0 && (
                          <Fact
                            label={`Rabatt första ${activeSubscription.device_discount_months} månader`}
                            value={`-${money(activeSubscription.monthly_discount_amount_sek)} per månad`}
                          />
                        )}
                      <Fact
                        label="Senaste betalningsstatus"
                        value={statusLabel(activeSubscription.stripe_payment_status)}
                      />
                      <Fact label="Provperiod" value={trialStatus(activeSubscription)} />
                      <p className="account-price-note">
                        Första betalningen består av startavgift {money(activeSubscription.setup_fee_sek)},
                        skärmenhet {money(hardwareSubtotalSek)} och frakt {money(shippingSubtotalSek)}
                        {(activeSubscription.device_discount_amount_sek || 0) > 0
                          ? `, minus rabatt ${money(activeSubscription.device_discount_amount_sek)}`
                          : ""}.
                        Alla priser visas inklusive moms.
                        {activeTemporaryDiscount
                          ? ` Den tillfälliga rabatten används på upp till ${activeTemporaryDiscount.duration_months} månadsfakturor. Därefter återgår priset automatiskt till ${money(monthlyPaymentSek)}.`
                          : ""}
                        {(activeSubscription.monthly_discount_amount_sek || 0) > 0 &&
                        (activeSubscription.device_discount_months || 0) > 0
                          ? " Stripe tillämpar rabatten på de första månadsfakturorna."
                          : ""}
                      </p>
                      {billableSubscriptions.length > 1 && (
                        <div className="account-order-breakdown">
                          <h3>Aktiva delar i abonnemanget</h3>
                          <div className="account-list">
                            {billableSubscriptions.map((subscription) => (
                              <div className="account-list-item" key={subscription.id}>
                                <div>
                                  <strong>{subscriptionPackageLabel(subscription)}</strong>
                                  <span>Beställning {subscription.order_number}</span>
                                </div>
                                <div>
                                  <strong>{money(subscription.monthly_fee_sek || 0)} / månad</strong>
                                  <span>
                                    Första betalning {money(subscriptionInitialPaymentSek(subscription))}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p>Inget abonnemang är kopplat till kontot ännu.</p>
                  )}
                  <button className="landing-button landing-button-primary" onClick={openBillingPortal}>
                    Öppna betalningsportal
                  </button>
                </AccountCard>

                <AccountCard title="Avslut och feedback">
                  <p>
                    Om du avslutar fortsätter tjänsten till sista dagen i perioden
                    som redan är betald. Vi samlar in orsaken så att vi kan
                    förbättra tjänsten.
                  </p>
                  <select
                    value={cancellationReason}
                    onChange={(event) => setCancellationReason(event.target.value)}
                    className="account-input"
                  >
                    {cancellationReasons.map((reason) => (
                      <option key={reason.value} value={reason.value}>
                        {reason.label}
                      </option>
                    ))}
                  </select>
                  <textarea
                    value={cancellationDetails}
                    onChange={(event) => setCancellationDetails(event.target.value)}
                    placeholder="Mer information (valfritt)"
                    rows={5}
                    maxLength={1200}
                    className="account-input"
                  />
                  <button
                    className="landing-button landing-button-secondary"
                    disabled={cancelling}
                    onClick={requestCancellation}
                  >
                    {cancelling ? "Avslutar..." : "Avsluta abonnemang"}
                  </button>
                </AccountCard>

                <AccountCard title="Avsluta valda skärmar">
                  <p>
                    Använd detta när bara vissa skärmar ska avslutas. Valda skärmar
                    fortsätter till slutet av aktuell betald period och tas bort från
                    kommande månadsfakturor.
                  </p>
                  {openDeviceCancellations.length > 0 && (
                    <div className="account-list account-list-compact">
                      {openDeviceCancellations.map((cancellation) => (
                        <div key={cancellation.id} className="account-list-item">
                          <div>
                            <strong>
                              {cancellation.devices?.name ||
                                cancellation.devices?.device_code ||
                                "Skärm under avslut"}
                            </strong>
                            <span>
                              Avslutas {date(cancellation.cancellation_effective_at)} |{" "}
                              {money(cancellation.monthly_fee_sek)} per månad tas bort
                            </span>
                          </div>
                          <StatusPill label="Avslutas" />
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flow-form-grid">
                    <label>
                      Abonnemangsdel
                      <select
                        value={selectedCancelSubscriptionId}
                        onChange={(event) =>
                          setSelectedCancelSubscriptionId(event.target.value)
                        }
                        className="account-input"
                        disabled={cancellingDevices || billableSubscriptions.length <= 1}
                      >
                        <option value="">Välj abonnemangsdel</option>
                        {billableSubscriptions.map((subscription) => (
                          <option key={subscription.id} value={subscription.id}>
                            {subscriptionPackageLabel(subscription)}
                          </option>
                        ))}
                      </select>
                    </label>
                    {selectedCancelPlanOptions.length > 1 && (
                      <label>
                        Teknisk nivå
                        <select
                          value={selectedCancelPricingPlanCode}
                          onChange={(event) =>
                            setSelectedCancelPricingPlanCode(event.target.value)
                          }
                          className="account-input"
                          disabled={cancellingDevices}
                        >
                          <option value="">Välj teknisk nivå</option>
                          {selectedCancelPlanOptions.map((option) => (
                            <option
                              key={option.value}
                              value={option.pricingPlanCode || option.value}
                            >
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                  </div>
                  <div className="account-device-selection-list" aria-label="Skärmar att avsluta">
                    {data.devices.map((device) => {
                      const pause = activeDevicePauseByDeviceId.get(device.id);
                      const cancellation = openDeviceCancellationByDeviceId.get(device.id);
                      const disabled =
                        cancellingDevices ||
                        !device.is_active ||
                        Boolean(pause) ||
                        Boolean(cancellation);

                      return (
                        <label
                          key={device.id}
                          className={`account-device-selection-item ${
                            disabled ? "account-device-selection-item-disabled" : ""
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedCancelDeviceIds.includes(device.id)}
                            disabled={disabled}
                            onChange={() => toggleCancelDevice(device.id)}
                          />
                          <span>
                            <strong>{device.name || device.device_code}</strong>
                            <small>
                              {device.location || device.device_code}
                              {pause
                                ? ` | pausad till ${date(pause.pause_resumes_at)}`
                                : ""}
                              {cancellation
                                ? ` | avslutas ${date(cancellation.cancellation_effective_at)}`
                                : ""}
                              {!device.is_active && !pause && !cancellation
                                ? " | inte aktiv"
                                : ""}
                            </small>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    className="landing-button landing-button-secondary"
                    disabled={
                      cancellingDevices ||
                      !selectedCancelDeviceIds.length ||
                      !selectedCancelSubscriptionId ||
                      !selectedCancelPlan
                    }
                    onClick={requestDeviceCancellation}
                  >
                    {cancellingDevices
                      ? "Markerar skärmar..."
                      : `Avsluta valda skärmar${
                          selectedCancelDeviceIds.length
                            ? ` (${selectedCancelDeviceIds.length})`
                            : ""
                        }`}
                  </button>
                </AccountCard>

                <AccountCard title="Tillfällig paus">
                  <div
                    className={`account-policy-card ${
                      subscriptionPaused
                        ? "account-policy-card-locked"
                        : "account-policy-card-open"
                    }`}
                  >
                    <strong>
                      {subscriptionPaused
                        ? "Abonnemanget är pausat"
                        : "Pausa abonnemanget tillfälligt"}
                    </strong>
                    <p>
                      En paus stoppar skärmtjänsten och kommande debiteringar tills
                      abonnemanget återaktiveras. Pausen kan väljas för högst fyra
                      månader. En bekräftelse skickas till kontots e-postadress.
                    </p>
                  </div>
                  <div className="account-device-pause-box">
                    <h3>Pausa en enskild skärm</h3>
                    <p>
                      Välj en skärm när endast den skärmen ska pausas. Övriga skärmar
                      fortsätter att visas och debiteras som vanligt.
                    </p>
                    {activeDevicePauses.length > 0 && (
                      <div className="account-list account-list-compact">
                        {activeDevicePauses.map((pause) => (
                          <div key={pause.id} className="account-list-item">
                            <div>
                              <strong>
                                {pause.devices?.name ||
                                  pause.devices?.device_code ||
                                  "Pausad skärm"}
                              </strong>
                              <span>
                                Pausad till {date(pause.pause_resumes_at)} |{" "}
                                {money(pause.monthly_fee_sek)} per månad
                              </span>
                            </div>
                            <StatusPill label="Pausad" />
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flow-form-grid">
                      <label>
                        Skärm
                        <select
                          value={selectedPauseDeviceId}
                          onChange={(event) => setSelectedPauseDeviceId(event.target.value)}
                          className="account-input"
                          disabled={pausingDevice || !data.devices.length}
                        >
                          <option value="">Välj skärm</option>
                          {data.devices.map((device) => {
                            const pause = activeDevicePauseByDeviceId.get(device.id);
                            const cancellation = openDeviceCancellationByDeviceId.get(device.id);
                            return (
                              <option
                                key={device.id}
                                value={device.id}
                                disabled={
                                  !device.is_active ||
                                  Boolean(pause) ||
                                  Boolean(cancellation)
                                }
                              >
                                {device.name || device.device_code}
                                {device.location ? `, ${device.location}` : ""}
                                {pause ? ` (pausad till ${date(pause.pause_resumes_at)})` : ""}
                                {cancellation
                                  ? ` (avslutas ${date(cancellation.cancellation_effective_at)})`
                                  : ""}
                              </option>
                            );
                          })}
                        </select>
                      </label>
                      <label>
                        Abonnemangsdel
                        <select
                          value={selectedPauseSubscriptionId}
                          onChange={(event) => setSelectedPauseSubscriptionId(event.target.value)}
                          className="account-input"
                          disabled={pausingDevice || billableSubscriptions.length <= 1}
                        >
                          <option value="">Välj abonnemangsdel</option>
                          {billableSubscriptions.map((subscription) => (
                            <option key={subscription.id} value={subscription.id}>
                              {subscriptionPackageLabel(subscription)}
                            </option>
                          ))}
                        </select>
                      </label>
                      {selectedPausePlanOptions.length > 1 && (
                        <label>
                          Teknisk nivå
                          <select
                            value={selectedPausePricingPlanCode}
                            onChange={(event) =>
                              setSelectedPausePricingPlanCode(event.target.value)
                            }
                            className="account-input"
                            disabled={pausingDevice}
                          >
                            <option value="">Välj teknisk nivå</option>
                            {selectedPausePlanOptions.map((option) => (
                              <option
                                key={option.value}
                                value={option.pricingPlanCode || option.value}
                              >
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                    </div>
                    <button
                      type="button"
                      className="landing-button landing-button-primary"
                      disabled={
                        pausingDevice ||
                        !selectedPauseDeviceId ||
                        !selectedPauseSubscriptionId ||
                        !selectedPausePlan
                      }
                      onClick={requestDevicePause}
                    >
                      {pausingDevice ? "Pausar skärm..." : "Pausa vald skärm"}
                    </button>
                  </div>
                  <label>
                    Pauslängd
                    <select
                      value={pauseDurationMonths}
                      onChange={(event) =>
                        setPauseDurationMonths(Number(event.target.value))
                      }
                      className="account-input"
                      disabled={subscriptionPaused || pausingSubscription}
                    >
                      {pauseDurationOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <textarea
                    value={pauseDetails}
                    onChange={(event) => setPauseDetails(event.target.value)}
                    placeholder="Notering till Screenia, exempelvis önskat pausdatum eller orsak (valfritt)"
                    rows={4}
                    maxLength={300}
                    className="account-input"
                    disabled={subscriptionPaused || pausingSubscription}
                  />
                  <button
                    type="button"
                    className="landing-button landing-button-secondary"
                    disabled={!activeSubscription || subscriptionPaused || pausingSubscription}
                    onClick={requestPause}
                  >
                    {pausingSubscription
                      ? "Pausar..."
                      : subscriptionPaused
                        ? "Redan pausat"
                        : "Pausa abonnemang"}
                  </button>
                  {subscriptionPaused && (
                    <button
                      type="button"
                      className="landing-button landing-button-primary"
                      disabled={resumingSubscription}
                      onClick={requestResume}
                    >
                      {resumingSubscription
                        ? "Återaktiverar..."
                        : "Återaktivera abonnemang"}
                    </button>
                  )}
                </AccountCard>
              </section>
            </div>
          )}

          {activeSection === "legal" && (
            <div className="account-panel-stack">
              <AccountCard title="Samtycken">
                <div className="account-list">
                  <label className="account-list-item account-history-row">
                    <div>
                      <strong>Marknadsföring</strong>
                      <span>Nyheter, erbjudanden och annan frivillig kommunikation.</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={consentDrafts.marketingConsent}
                      onChange={(event) =>
                        setConsentDrafts((current) => ({
                          ...current,
                          marketingConsent: event.target.checked,
                        }))
                      }
                    />
                  </label>
                  <label className="account-list-item account-history-row">
                    <div>
                      <strong>Statistik</strong>
                      <span>Frivillig statistik för att förbättra Screenia.</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={consentDrafts.analyticsConsent}
                      onChange={(event) =>
                        setConsentDrafts((current) => ({
                          ...current,
                          analyticsConsent: event.target.checked,
                        }))
                      }
                    />
                  </label>
                  <label className="account-list-item account-history-row">
                    <div>
                      <strong>Fjärrsupport</strong>
                      <span>Screenia får ge fjärrsupport när du ber om hjälp.</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={consentDrafts.remoteSupportConsent}
                      onChange={(event) =>
                        setConsentDrafts((current) => ({
                          ...current,
                          remoteSupportConsent: event.target.checked,
                        }))
                      }
                    />
                  </label>
                </div>
                <button
                  type="button"
                  disabled={savingConsents}
                  onClick={saveConsentSettings}
                  className="landing-button landing-button-secondary"
                >
                  {savingConsents ? "Sparar..." : "Spara samtycken"}
                </button>
              </AccountCard>

              <AccountCard title="Dataexport">
                <div className="account-list-item account-history-row">
                  <div>
                    <strong>Ladda ner kontodata</strong>
                    <span>JSON-export med konto, abonnemang, enheter, ärenden, materialmetadata, samtycken, avtal och kundrelaterad historik.</span>
                    <p>
                      Själva filerna laddas fortfarande ner från respektive historiklista med tidsbegränsade länkar.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={exportingData}
                    onClick={downloadDataExport}
                    className="landing-button landing-button-secondary"
                  >
                    {exportingData ? "Skapar..." : "Ladda ner data"}
                  </button>
                </div>
              </AccountCard>

              <AccountCard title="Godkända avtal">
                <HistoryList empty="Inga godkända villkor finns registrerade ännu.">
                  {data.agreements.map((agreement) => (
                    <div key={agreement.id} className="account-list-item account-history-row">
                      <div>
                        <strong>
                          {agreement.document_title} v{agreement.document_version}
                        </strong>
                        <span>Godkänt {date(agreement.accepted_at)}</span>
                        <p>{agreement.content_snapshot}</p>
                      </div>
                      <div className="account-history-links">
                        {agreement.document_url && <a href={agreement.document_url}>Dokument</a>}
                        {agreement.pdf_url && <a href={agreement.pdf_url}>PDF</a>}
                      </div>
                    </div>
                  ))}
                </HistoryList>
              </AccountCard>

              <AccountCard title="Aktuella dokument">
                <HistoryList empty="Inga aktuella dokument är publicerade.">
                  {data.legalDocuments.map((document) => (
                    <div key={document.id} className="account-list-item account-history-row">
                      <div>
                        <strong>
                          {document.title} v{document.version}
                        </strong>
                        <span>Gäller från {date(document.effective_at)}</span>
                        <p>{document.summary || "-"}</p>
                      </div>
                      {document.pdf_url && <a href={document.pdf_url}>PDF</a>}
                    </div>
                  ))}
                </HistoryList>
              </AccountCard>
            </div>
          )}
        </main>
      </div>

      {cancelConfirmationOpen && activeSubscription && (
        <div className="account-dialog-backdrop" role="presentation">
          <section
            className="account-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="account-cancel-title"
          >
            <p className="landing-eyebrow">Bekräfta avslut</p>
            <h2 id="account-cancel-title">Avsluta vid periodens slut?</h2>
            <p>
              Abonnemanget och skärmtjänsten fortsätter att fungera till den
              redan betalda periodens slut
              {activeSubscription.stripe_current_period_end
                ? `, ${date(activeSubscription.stripe_current_period_end)}`
                : ""}.
              Därefter stoppas kommande månadsdebiteringar.
            </p>
            <dl className="account-dialog-summary">
              <div>
                <dt>Paket</dt>
                <dd>{subscriptionPackageLabel(activeSubscription)}</dd>
              </div>
              <div>
                <dt>Månadspris</dt>
                <dd>{money(monthlyPaymentSek)}</dd>
              </div>
              <div>
                <dt>Orsak</dt>
                <dd>
                  {cancellationReasons.find(
                    (reason) => reason.value === cancellationReason,
                  )?.label || cancellationReason}
                </dd>
              </div>
            </dl>
            {cancellationDetails.trim() && (
              <p className="account-dialog-note">{cancellationDetails.trim()}</p>
            )}
            <div className="account-dialog-actions">
              <button
                type="button"
                className="landing-button landing-button-secondary"
                onClick={() => setCancelConfirmationOpen(false)}
                disabled={cancelling}
              >
                Behåll abonnemanget
              </button>
              <button
                type="button"
                className="landing-button landing-button-primary"
                onClick={cancelSubscription}
                disabled={cancelling}
              >
                {cancelling ? "Avslutar..." : "Bekräfta avslut"}
              </button>
            </div>
          </section>
        </div>
      )}

      {devicePauseConfirmationOpen && selectedPauseDevice && selectedPauseSubscription && (
        <div className="account-dialog-backdrop" role="presentation">
          <section
            className="account-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="account-device-pause-title"
          >
            <p className="landing-eyebrow">Bekräfta skärmpaus</p>
            <h2 id="account-device-pause-title">Pausa vald skärm?</h2>
            <p>
              Endast den valda skärmen pausas. Övriga skärmar i kontot fortsätter
              att visas och debiteras som vanligt.
            </p>
            <dl className="account-dialog-summary">
              <div>
                <dt>Skärm</dt>
                <dd>
                  {selectedPauseDevice.name || selectedPauseDevice.device_code}
                  {selectedPauseDevice.location
                    ? `, ${selectedPauseDevice.location}`
                    : ""}
                </dd>
              </div>
              <div>
                <dt>Abonnemangsdel</dt>
                <dd>{selectedPausePlan?.label || subscriptionPackageLabel(selectedPauseSubscription)}</dd>
              </div>
              <div>
                <dt>Månadsbelopp som pausas</dt>
                <dd>{money(selectedPausePlan?.monthlyFeeSek || 0)}</dd>
              </div>
              <div>
                <dt>Pauslängd</dt>
                <dd>
                  {
                    pauseDurationOptions.find(
                      (option) => option.value === pauseDurationMonths,
                    )?.label
                  }
                </dd>
              </div>
              <div>
                <dt>Planerad återaktivering</dt>
                <dd>{date(pauseResumeDate.toISOString())}</dd>
              </div>
            </dl>
            {pauseDetails.trim() && (
              <p className="account-dialog-note">{pauseDetails.trim()}</p>
            )}
            <div className="account-dialog-actions">
              <button
                type="button"
                className="landing-button landing-button-secondary"
                onClick={() => setDevicePauseConfirmationOpen(false)}
                disabled={pausingDevice}
              >
                Behåll skärmen aktiv
              </button>
              <button
                type="button"
                className="landing-button landing-button-primary"
                onClick={pauseDevice}
                disabled={pausingDevice}
              >
                {pausingDevice ? "Pausar skärm..." : "Bekräfta skärmpaus"}
              </button>
            </div>
          </section>
        </div>
      )}

      {deviceCancelConfirmationOpen && selectedCancelSubscription && (
        <div className="account-dialog-backdrop" role="presentation">
          <section
            className="account-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="account-device-cancel-title"
          >
            <p className="landing-eyebrow">Bekräfta skärmavslut</p>
            <h2 id="account-device-cancel-title">Avsluta valda skärmar?</h2>
            <p>
              Valda skärmar fortsätter till slutet av aktuell betald period. De
              tas bort från kommande månadsfakturor, medan övriga skärmar
              fortsätter som vanligt.
            </p>
            <dl className="account-dialog-summary">
              <div>
                <dt>Skärmar</dt>
                <dd>
                  {selectedCancelDevices
                    .map((device) => device.name || device.device_code)
                    .join(", ")}
                </dd>
              </div>
              <div>
                <dt>Abonnemangsdel</dt>
                <dd>
                  {selectedCancelPlan?.label ||
                    subscriptionPackageLabel(selectedCancelSubscription)}
                </dd>
              </div>
              <div>
                <dt>Månadsbelopp som tas bort</dt>
                <dd>
                  {money(
                    (selectedCancelPlan?.monthlyFeeSek || 0) *
                      selectedCancelDeviceIds.length,
                  )}
                </dd>
              </div>
              <div>
                <dt>Gäller från</dt>
                <dd>{date(selectedCancelSubscription.stripe_current_period_end)}</dd>
              </div>
            </dl>
            {cancellationDetails.trim() && (
              <p className="account-dialog-note">{cancellationDetails.trim()}</p>
            )}
            <div className="account-dialog-actions">
              <button
                type="button"
                className="landing-button landing-button-secondary"
                onClick={() => setDeviceCancelConfirmationOpen(false)}
                disabled={cancellingDevices}
              >
                Behåll skärmarna
              </button>
              <button
                type="button"
                className="landing-button landing-button-primary"
                onClick={cancelSelectedDevices}
                disabled={cancellingDevices}
              >
                {cancellingDevices ? "Markerar avslut..." : "Bekräfta avslut"}
              </button>
            </div>
          </section>
        </div>
      )}

      {pauseConfirmationOpen && activeSubscription && (
        <div className="account-dialog-backdrop" role="presentation">
          <section
            className="account-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="account-pause-title"
          >
            <p className="landing-eyebrow">Bekräfta paus</p>
            <h2 id="account-pause-title">Pausa abonnemanget?</h2>
            <p>
              Skärmtjänsten stoppas under pausen och kommande debiteringar pausas
              i Stripe. Screenia skickar en bekräftelse till kontots e-postadress.
            </p>
            <dl className="account-dialog-summary">
              <div>
                <dt>Aktiva beställningar</dt>
                <dd>{String(billableSubscriptions.length || 1)}</dd>
              </div>
              <div>
                <dt>Skärmar</dt>
                <dd>{String(combinedScreenQuantity || screenQuantity)}</dd>
              </div>
              <div>
                <dt>Månadspris</dt>
                <dd>{money(adjustedCombinedMonthlyPaymentSek)}</dd>
              </div>
              <div>
                <dt>Pauslängd</dt>
                <dd>
                  {
                    pauseDurationOptions.find(
                      (option) => option.value === pauseDurationMonths,
                    )?.label
                  }
                </dd>
              </div>
              <div>
                <dt>Planerad återaktivering</dt>
                <dd>{date(pauseResumeDate.toISOString())}</dd>
              </div>
            </dl>
            {pauseDetails.trim() && (
              <p className="account-dialog-note">{pauseDetails.trim()}</p>
            )}
            <div className="account-dialog-actions">
              <button
                type="button"
                className="landing-button landing-button-secondary"
                onClick={() => setPauseConfirmationOpen(false)}
                disabled={pausingSubscription}
              >
                Behåll aktivt
              </button>
              <button
                type="button"
                className="landing-button landing-button-primary"
                onClick={pauseSubscription}
                disabled={pausingSubscription}
              >
                {pausingSubscription ? "Pausar..." : "Bekräfta paus"}
              </button>
            </div>
          </section>
        </div>
      )}

      {resumeConfirmationOpen && activeSubscription && (
        <div className="account-dialog-backdrop" role="presentation">
          <section
            className="account-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="account-resume-title"
          >
            <p className="landing-eyebrow">Bekräfta återaktivering</p>
            <h2 id="account-resume-title">Återaktivera abonnemanget?</h2>
            <p>
              Skärmtjänsten öppnas igen och kommande abonnemangsdebiteringar
              fortsätter enligt Stripe-abonnemanget. Screenia skickar en
              bekräftelse till kontots e-postadress.
            </p>
            <dl className="account-dialog-summary">
              <div>
                <dt>Aktiva beställningar</dt>
                <dd>{String(data.subscriptions.length || 1)}</dd>
              </div>
              <div>
                <dt>Skärmar</dt>
                <dd>{String(combinedScreenQuantity || screenQuantity)}</dd>
              </div>
              <div>
                <dt>Månadspris</dt>
                <dd>{money(adjustedCombinedMonthlyPaymentSek)}</dd>
              </div>
            </dl>
            <div className="account-dialog-actions">
              <button
                type="button"
                className="landing-button landing-button-secondary"
                onClick={() => setResumeConfirmationOpen(false)}
                disabled={resumingSubscription}
              >
                Fortsätt pausa
              </button>
              <button
                type="button"
                className="landing-button landing-button-primary"
                onClick={resumeSubscription}
                disabled={resumingSubscription}
              >
                {resumingSubscription ? "Återaktiverar..." : "Bekräfta återaktivering"}
              </button>
            </div>
          </section>
        </div>
      )}
    </AccountShell>
  );
}

function AccountShell({
  children,
  onSignOut,
}: {
  children: ReactNode;
  onSignOut?: () => void;
}) {
  return (
    <div className="landing-page account-page">
      <LandingNav currentPath="/account" accountMode onSignOut={onSignOut} />
      <div className="account-shell">{children}</div>
    </div>
  );
}

function AccountCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="account-card">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function AccountStatePanel({
  eyebrow,
  title,
  text,
}: {
  eyebrow: string;
  title: string;
  text: string;
}) {
  return (
    <section className="account-state-panel">
      <span className="account-state-mark" aria-hidden="true" />
      <p className="landing-eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p>{text}</p>
    </section>
  );
}

function AccountChoice({
  active,
  title,
  text,
  onClick,
}: {
  active: boolean;
  title: string;
  text: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={active ? "account-card account-card-active" : "account-card"}
      onClick={onClick}
    >
      <strong>{title}</strong>
      <span>{text}</span>
    </button>
  );
}

function HistoryList({
  children,
  empty,
}: {
  children: ReactNode[];
  empty: string;
}) {
  return children.length ? <div className="account-list">{children}</div> : <p>{empty}</p>;
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function StatusPill({ label }: { label: string }) {
  return <span className="account-status">{label.replaceAll("_", " ")}</span>;
}
