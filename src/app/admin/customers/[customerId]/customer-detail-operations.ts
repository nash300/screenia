import type {
  Customer,
  CustomerOperation,
  CustomerOperationId,
  CustomerSubscription,
} from "./types";

type CustomerOperationsInput = {
  customer: Customer;
  currentSubscription: CustomerSubscription | null;
  productionTrackingReady: boolean;
  activeDiscountCount: number;
};

const terminalStatuses = new Set(["cancelled", "refunded"]);

export function getCustomerOperations({
  customer,
  currentSubscription,
  productionTrackingReady,
  activeDiscountCount,
}: CustomerOperationsInput): CustomerOperation[] {
  const stripeSubscriptionOperational = Boolean(
    customer.stripe_subscription_id &&
      currentSubscription &&
      !terminalStatuses.has(customer.service_access_status || "") &&
      !terminalStatuses.has(customer.payment_status || "") &&
      !terminalStatuses.has(currentSubscription.status || ""),
  );
  const hasScheduledCancellation = Boolean(
    currentSubscription?.cancel_at_period_end,
  );

  const operations: Array<CustomerOperation | null> = [
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
    !["paused", ...terminalStatuses].includes(customer.service_access_status || "")
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
          result:
            "Stripe refunds only the entered amount; the customer remains paid and active.",
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
  ];

  return operations.filter(
    (operation): operation is CustomerOperation => operation !== null,
  );
}

const operationReasonLabels: Partial<Record<CustomerOperationId, string>> = {
  activate_customer: "Reason for activating this customer",
  resume_subscription: "Reason for resuming billing and display access",
  pause_subscription: "Reason for pausing billing and display access",
  suspend_customer: "Reason for suspending this customer",
  reactivate_customer: "Reason for reactivating this customer",
  cancel_period_end: "Reason for scheduling cancellation at period end",
  cancel_immediately: "Reason for immediate subscription cancellation",
  apply_temporary_discount: "Reason for applying this temporary discount",
  remove_temporary_discount: "Reason for removing this temporary discount",
  start_layout: "Reason for starting layout work",
  refund_first_payment: "Reason for refunding the first payment",
  record_post_layout_refund_request:
    "Customer request and reason the automatic full refund is denied",
  issue_partial_refund: "Reason for approving this exact partial refund amount",
};

export function getCustomerOperationReasonLabel(
  operationId: CustomerOperationId | "" | null,
) {
  return operationId
    ? operationReasonLabels[operationId] || "Reason for audit history"
    : "Reason for audit history";
}
