import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createAdminNotification } from "@/lib/server/admin-notifications";
import { getRequestIp, recordAuditEvent } from "@/lib/server/audit";
import {
  getAuthenticatedUser,
  getCustomerForUser,
  supabaseAdmin,
} from "@/lib/server/customer-account";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-04-22.dahlia",
});

export async function POST(request: Request) {
  const user = await getAuthenticatedUser();
  const customer = await getCustomerForUser(user);
  const ipAddress = getRequestIp(request);
  const userAgent = request.headers.get("user-agent");

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

  let session: Stripe.BillingPortal.Session;

  try {
    session = await stripe.billingPortal.sessions.create({
      customer: customer.stripe_customer_id,
      return_url: `${appUrl}/account`,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown Stripe billing portal error.";

    try {
      await recordAuditEvent(
        supabaseAdmin,
        {
          customerId: customer.id,
          actorType: "customer",
          actorId: user.id,
          eventType: "billing_portal_session_failed",
          eventDescription: "Customer could not open the Stripe billing portal.",
          metadata: {
            stripeCustomerId: customer.stripe_customer_id,
            error: message,
          },
          ipAddress,
          userAgent,
        },
        { throwOnError: true },
      );
      await createAdminNotification(
        supabaseAdmin,
        {
          customerId: customer.id,
          eventType: "billing_portal_session_failed",
          title: "Billing portal failed",
          message: `${customer.name} could not open the Stripe billing portal: ${message}`,
          priority: "urgent",
          metadata: {
            stripeCustomerId: customer.stripe_customer_id,
            error: message,
          },
        },
        { throwOnError: true },
      );
    } catch (evidenceError) {
      console.error("Billing portal failure evidence error:", evidenceError);
      return NextResponse.json(
        {
          error:
            "Could not open the billing portal and Screenia could not store failure evidence. Contact support.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { error: "Det gick inte att öppna betalningsportalen just nu." },
      { status: 502 },
    );
  }

  try {
    await recordAuditEvent(
      supabaseAdmin,
      {
        customerId: customer.id,
        actorType: "customer",
        actorId: user.id,
        eventType: "billing_portal_session_created",
        eventDescription: "Customer opened the Stripe billing portal.",
        metadata: {
          stripeCustomerId: customer.stripe_customer_id,
          billingPortalSessionId: session.id,
        },
        ipAddress,
        userAgent,
      },
      { throwOnError: true },
    );
  } catch (auditError) {
    console.error("Billing portal success audit error:", auditError);
    return NextResponse.json(
      {
        error:
          "Billing portal session was created, but Screenia could not store access evidence. Contact support.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ url: session.url });
}
