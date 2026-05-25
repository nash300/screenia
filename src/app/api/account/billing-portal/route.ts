import { NextResponse } from "next/server";
import Stripe from "stripe";
import {
  getAuthenticatedUser,
  getCustomerForUser,
} from "@/lib/server/customer-account";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-04-22.dahlia",
});

export async function POST() {
  const user = await getAuthenticatedUser();
  const customer = await getCustomerForUser(user);

  if (!user || !customer) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (!customer.stripe_customer_id) {
    return NextResponse.json(
      { error: "No Stripe customer is connected to this account." },
      { status: 400 },
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) {
    return NextResponse.json({ error: "App URL is not configured." }, { status: 500 });
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: customer.stripe_customer_id,
    return_url: `${appUrl}/account`,
  });

  return NextResponse.json({ url: session.url });
}
