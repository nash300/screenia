import { createAdminNotification } from "@/lib/server/admin-notifications";

async function getSupabaseAdmin() {
  const { supabaseAdmin } = await import("@/lib/server/admin-api");
  return supabaseAdmin;
}

export async function markCheckoutOrderActivated(customerId: string) {
  const supabaseAdmin = await getSupabaseAdmin();
  const activatedAt = new Date().toISOString();
  const { data: orders, error } = await supabaseAdmin
    .from("checkout_orders")
    .update({ status: "content_pending", account_activated_at: activatedAt })
    .eq("customer_id", customerId)
    .eq("status", "activation_pending")
    .select("id");

  if (error) {
    console.warn("Checkout activation state could not be stored:", error.message);
    return;
  }

  await supabaseAdmin
    .from("customers")
    .update({ onboarding_stage: "content_pending" })
    .eq("id", customerId);

  if (orders?.length) {
    await createAdminNotification(supabaseAdmin, {
      customerId,
      eventType: "customer_account_activated",
      dedupeKey: `customer_account_activated:${customerId}`,
      title: "Customer account activated",
      message: "The customer has chosen a password and can now submit display material.",
      priority: "high",
      metadata: { checkoutOrderId: orders[0].id, activatedAt },
    });
  }
}

export async function markCheckoutOrderMaterialsSubmitted(customerId: string) {
  const supabaseAdmin = await getSupabaseAdmin();
  const submittedAt = new Date().toISOString();
  const { data: orders } = await supabaseAdmin
    .from("checkout_orders")
    .update({ status: "materials_submitted", materials_submitted_at: submittedAt })
    .eq("customer_id", customerId)
    .in("status", ["content_pending", "activation_pending"])
    .select("id");

  await supabaseAdmin
    .from("customers")
    .update({ onboarding_stage: "materials_submitted" })
    .eq("id", customerId);

  if (orders?.length) {
    await createAdminNotification(supabaseAdmin, {
      customerId,
      eventType: "materials_submitted",
      dedupeKey: `materials_submitted:${customerId}`,
      title: "Customer material submitted",
      message: "New customer material is ready for admin review and layout work.",
      priority: "urgent",
      metadata: { checkoutOrderId: orders[0].id, submittedAt },
    });
  }
}
