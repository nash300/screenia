import type { AuditEvent } from "./types";

export const journalCategories = [
  "general",
  "customer_question",
  "investigation",
  "troubleshooting",
  "decision",
  "follow_up",
] as const;

export type JournalCategory = (typeof journalCategories)[number];

export type CustomerJournalEntry = {
  id: string;
  category: JournalCategory;
  title: string;
  body: string;
  source: string;
  createdAt: string;
  actorLabel?: string;
};

const categoryLabels: Record<JournalCategory, string> = {
  general: "General",
  customer_question: "Customer question",
  investigation: "Investigation",
  troubleshooting: "Troubleshooting",
  decision: "Decision",
  follow_up: "Follow-up",
};

const noteMetadataKeys = [
  "note",
  "adminNote",
  "reason",
  "admin_reason",
  "adminReason",
  "customer_reason",
  "customerReason",
  "quoteNotes",
  "setupFeeWaiverReason",
] as const;

export function journalCategoryLabel(category: JournalCategory) {
  return categoryLabels[category];
}

export function normalizeJournalCategory(value: unknown): JournalCategory {
  const category = String(value || "").trim() as JournalCategory;
  return journalCategories.includes(category) ? category : "general";
}

function inferAuditCategory(eventType: string): JournalCategory {
  if (/message|inquiry|reply/i.test(eventType)) return "customer_question";
  if (/device|inventory|media|playlist|asset/i.test(eventType)) {
    return "troubleshooting";
  }
  if (/refund|payment|subscription|discount|cancel|pause|resume/i.test(eventType)) {
    return "decision";
  }
  if (/preview|production|review/i.test(eventType)) return "investigation";
  return "general";
}

function auditNoteTexts(metadata: Record<string, unknown>) {
  const texts = noteMetadataKeys
    .map((key) => metadata[key])
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  return Array.from(new Set(texts));
}

export function journalEntriesFromAuditEvents(events: AuditEvent[]) {
  return events.flatMap<CustomerJournalEntry>((event) => {
    if (event.event_type === "customer_journal_entry_created") {
      const note = String(event.metadata.note || "").trim();
      if (!note) return [];

      const category = normalizeJournalCategory(event.metadata.category);
      return [
        {
          id: `journal-${event.id}`,
          category,
          title:
            String(event.metadata.title || "").trim() ||
            journalCategoryLabel(category),
          body: note,
          source: "Journal entry",
          createdAt: event.created_at,
          actorLabel: event.actor_type,
        },
      ];
    }

    if (event.event_type === "payment_failed") {
      const invoiceId = String(event.metadata.invoiceId || "").trim();
      const stripeSubscriptionId = String(
        event.metadata.stripeSubscriptionId || "",
      ).trim();
      const troubleshootingDetails = [
        invoiceId ? `Invoice: ${invoiceId}` : null,
        stripeSubscriptionId ? `Subscription: ${stripeSubscriptionId}` : null,
        "Display access was blocked automatically.",
        "Review the Stripe invoice and ask the customer to update payment details.",
      ]
        .filter(Boolean)
        .join(" ");

      return [
        {
          id: `payment-failed-${event.id}`,
          category: "troubleshooting",
          title: "Payment failed — access blocked",
          body: troubleshootingDetails,
          source: "Stripe payment event",
          createdAt: event.created_at,
          actorLabel: event.actor_type,
        },
      ];
    }

    return auditNoteTexts(event.metadata).map((body, index) => ({
      id: `audit-note-${event.id}-${index}`,
      category: inferAuditCategory(event.event_type),
      title: event.event_description || event.event_type.replaceAll("_", " "),
      body,
      source: "Operational action",
      createdAt: event.created_at,
      actorLabel: event.actor_type,
    }));
  });
}

export function mergeJournalEntries(...groups: CustomerJournalEntry[][]) {
  const entries = groups.flat();
  const seen = new Set<string>();

  return entries
    .filter((entry) => {
      const key = `${entry.source}\u0000${entry.title}\u0000${entry.body}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort(
      (left, right) =>
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
    );
}
