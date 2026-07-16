import { redirect } from "next/navigation";

export default async function NewSubscriptionPage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string | string[] }>;
}) {
  const params = await searchParams;
  const rawCustomerId = params.customerId;
  const customerId = Array.isArray(rawCustomerId)
    ? rawCustomerId[0]
    : rawCustomerId;

  if (customerId) {
    redirect(`/admin/customers/${customerId}?section=onboarding`);
  }

  redirect("/admin/customers");
}
