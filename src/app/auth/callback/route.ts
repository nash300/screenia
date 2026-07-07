import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { recordAuditEvent, getRequestIp } from "@/lib/server/audit";
import { supabaseAdmin } from "@/lib/server/customer-account";

const customerPortalStatuses = new Set(["paid", "content_received", "active"]);
const customerPaymentStatuses = new Set(["paid", "trialing", "active"]);

function getSafeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/account";
  }

  return value;
}

function withLoginMessage(origin: string, message: string) {
  const url = new URL("/login", origin);
  url.searchParams.set("message", message);
  return url;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = getSafeNextPath(requestUrl.searchParams.get("next"));
  const provider = requestUrl.searchParams.get("provider");

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (items) => {
            items.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      },
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      return NextResponse.redirect(
        withLoginMessage(requestUrl.origin, "Inloggningen kunde inte slutföras. Försök igen."),
      );
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (provider === "google" && next.startsWith("/account")) {
      if (user?.app_metadata?.role === "admin") {
        return NextResponse.redirect(new URL("/admin", requestUrl.origin));
      }

      if (!user?.email) {
        await supabase.auth.signOut();
        return NextResponse.redirect(
          withLoginMessage(
            requestUrl.origin,
            "Google-kontot saknar verifierad e-postadress.",
          ),
        );
      }

      const normalizedEmail = user.email.toLowerCase();
      const { data: customer, error: customerError } = await supabaseAdmin
        .from("customers")
        .select("id, email, status, payment_status, auth_user_id")
        .ilike("email", normalizedEmail)
        .maybeSingle();

      const isEligibleCustomer =
        customer &&
        (customer.auth_user_id === user.id || !customer.auth_user_id) &&
        (customerPortalStatuses.has(customer.status) ||
          customerPaymentStatuses.has(customer.payment_status));

      if (customerError || !isEligibleCustomer) {
        await supabase.auth.signOut();
        return NextResponse.redirect(
          withLoginMessage(
            requestUrl.origin,
            "Google-kontot är inte kopplat till ett betalt Screenia-konto.",
          ),
        );
      }

      if (!customer.auth_user_id) {
        const { error: linkError } = await supabaseAdmin
          .from("customers")
          .update({ auth_user_id: user.id })
          .eq("id", customer.id);

        if (linkError) {
          await supabase.auth.signOut();
          return NextResponse.redirect(
            withLoginMessage(
              requestUrl.origin,
              "Screenia-kontot hittades, men Google-kopplingen kunde inte sparas.",
            ),
          );
        }
      }

      await supabaseAdmin.auth.admin.updateUserById(user.id, {
        user_metadata: {
          ...(user.user_metadata || {}),
          customer_id: customer.id,
          login_provider: "google",
        },
      });

      await recordAuditEvent(supabaseAdmin, {
        customerId: customer.id,
        actorType: "customer",
        actorId: user.id,
        eventType: "customer_google_login_linked",
        eventDescription: "Customer signed in with Google and was linked to the customer portal.",
        metadata: {
          provider: "google",
          email: normalizedEmail,
          wasAlreadyLinked: Boolean(customer.auth_user_id),
        },
        ipAddress: getRequestIp(request),
        userAgent: request.headers.get("user-agent"),
      });
    }
  }

  return NextResponse.redirect(new URL(next, requestUrl.origin));
}
