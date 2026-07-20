export type CustomerWorkflowSnapshot = {
  id: string;
  status: string | null;
  paymentStatus?: string | null;
  serviceAccessStatus?: string | null;
  deviceCount: number;
  firstDeviceCode?: string | null;
  firstDeviceWithoutPlaylistCode?: string | null;
};

export type CustomerWorkflowAction = {
  stage: number;
  stageLabel: string;
  title: string;
  description: string;
  href: string;
  priority: "urgent" | "high" | "normal";
};

const terminalStatuses = new Set(["cancelled", "refunded"]);
const billingExceptions = new Set(["failed", "payment_failed", "disputed"]);

export function getCustomerWorkflowAction(
  customer: CustomerWorkflowSnapshot,
): CustomerWorkflowAction | null {
  const status = customer.status || "draft";
  const paymentStatus = customer.paymentStatus || "";
  const accessStatus = customer.serviceAccessStatus || "";
  const customerHref = `/admin/customers/${customer.id}`;

  if (
    terminalStatuses.has(status) ||
    terminalStatuses.has(paymentStatus) ||
    terminalStatuses.has(accessStatus)
  ) {
    return null;
  }

  if (
    status === "suspended" ||
    accessStatus === "suspended" ||
    billingExceptions.has(paymentStatus)
  ) {
    return {
      stage: 3,
      stageLabel: "Billing exception",
      title: "Resolve service or payment issue",
      description: "Review Stripe status and decide whether service access should change.",
      href: `${customerHref}?section=orders`,
      priority: "urgent",
    };
  }

  if (["draft", "new_request"].includes(status)) {
    return {
      stage: 1,
      stageLabel: "Request received",
      title: "Review request and prepare quote",
      description: "Confirm the request, choose the package, and send one setup link.",
      href: `${customerHref}?section=onboarding`,
      priority: "high",
    };
  }

  if (["invited", "accepted_terms", "completed_profile"].includes(status)) {
    return {
      stage: 2,
      stageLabel: "Customer setup",
      title: "Check setup and payment progress",
      description: "See what the customer has completed and whether follow-up is needed.",
      href: `${customerHref}?section=onboarding`,
      priority: "normal",
    };
  }

  if (["paid", "content_pending"].includes(status)) {
    return {
      stage: 4,
      stageLabel: "Material collection",
      title: "Review customer material",
      description: "Check uploads and messages before display preparation starts.",
      href: `${customerHref}?section=communication&view=uploads`,
      priority: "high",
    };
  }

  if (["content_received", "active"].includes(status) && customer.deviceCount === 0) {
    return {
      stage: 5,
      stageLabel: "Device allocation",
      title: "Assign display hardware",
      description: "Allocate an in-stock device and confirm the installation details.",
      href: `${customerHref}?section=devices`,
      priority: "high",
    };
  }

  if (
    ["content_received", "active"].includes(status) &&
    customer.firstDeviceWithoutPlaylistCode
  ) {
    return {
      stage: 6,
      stageLabel: "Content publishing",
      title: "Add playlist content",
      description: "Prepare and verify playable content on the assigned display.",
      href: `/admin/devices/${customer.firstDeviceWithoutPlaylistCode}?section=media`,
      priority: "high",
    };
  }

  if (status === "content_received" && customer.firstDeviceCode) {
    return {
      stage: 6,
      stageLabel: "Final activation",
      title: "Verify display and activate service",
      description: "Confirm the assigned display is ready, then complete activation.",
      href: `${customerHref}?section=overview`,
      priority: "normal",
    };
  }

  return null;
}
