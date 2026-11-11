import CheckoutSuccessClient from "./CheckoutSuccessClient";

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const params = await searchParams;
  return <CheckoutSuccessClient order={params.order || null} />;
}
