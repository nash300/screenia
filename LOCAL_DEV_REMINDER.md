# InfoSync Platform Runbook

When you restart the computer, these services do not start automatically.

Use this file as the quick "what do I open and what do I run" guide for
local development, QA, and future launch checks.

## Local Project Folder

Open PowerShell:

```powershell
cd "$env:USERPROFILE\Desktop\infosync-git"
```

Check the current branch:

```powershell
git status --short --branch
```

The active working branch for the current launch-testing work is:

```text
codex/local-service-setup
```

## Start the App

Run this from the project folder:

```powershell
npm.cmd run dev
```

Then open:

```text
http://localhost:3000
```

Important local pages:

```text
http://localhost:3000
http://localhost:3000/admin-login
http://localhost:3000/admin
http://localhost:3000/account
http://localhost:3000/email-preview.html
```

## Start Stripe Webhooks When Testing Payments

Open a second PowerShell window:

```powershell
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Keep that Stripe window open while testing checkout, subscriptions, or webhook behavior.

If Stripe prints a new webhook signing secret, update `STRIPE_WEBHOOK_SECRET`
in `.env.local`, then restart the app.

## External Dashboards

Supabase project:

```text
https://supabase.com/dashboard/project/wcmhvldpelfhurlsuwwy
```

Stripe test dashboard:

```text
https://dashboard.stripe.com/test/dashboard
```

Stripe test customers:

```text
https://dashboard.stripe.com/test/customers
```

Resend emails:

```text
https://resend.com/emails
```

Resend domains:

```text
https://resend.com/domains
```

Gmail test inbox:

```text
https://mail.google.com/
```

## Environment Variables

Keep secret values in `.env.local` locally and in the hosting provider's
environment settings in production. Do not commit real secrets.

Supabase:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

Stripe:

```text
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_AUTOMATIC_TAX_ENABLED=false
```

Resend:

```text
RESEND_API_KEY
RESEND_FROM_EMAIL
```

Public app and company details:

```text
NEXT_PUBLIC_APP_URL
NEXT_PUBLIC_COMPANY_LEGAL_NAME
NEXT_PUBLIC_COMPANY_ORG_NUMBER
NEXT_PUBLIC_COMPANY_ADDRESS
NEXT_PUBLIC_COMPANY_EMAIL
```

Social login feature flags:

```text
NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=false
```

## Current Pricing Rule

Customer-facing prices are Swedish customer-pay totals including moms.

The first Stripe payment should include:

```text
start/setup fee + screen device price + shipping
```

The monthly subscription starts after the trial period. Do not add moms on top
of the customer-facing prices. Keep detailed net/moms accounting detail in
admin/audit views, not as clutter in the customer portal.

## Social Login Plan

This project uses Supabase Auth, so customer social login is possible through
Supabase OAuth providers.

Current app support:

```text
/login now has "Fortsatt med Google".
/auth/callback links a Google user only when the email belongs to an existing
paid/content-received/active customer.
```

Recommended order:

1. Add Google login first. This is what customers usually mean by "login with Gmail".
2. Add Facebook later only if real customers ask for it.

Important rule for InfoSync:

```text
Social login must link to an existing paid/approved customer record.
It must not create a usable customer portal account for any random visitor.
```

Suggested implementation shape:

1. Keep the order, admin quote, onboarding, and Stripe payment flow as the gate.
2. After successful payment, let the customer either create a password or connect
   a Google account.
3. On OAuth callback, find the matching `customers` row by a secure token or by
   the paid customer's expected email, then store the Supabase Auth user id in
   `customers.auth_user_id`.
4. If a social-login user has no linked paid customer, redirect them to a clear
   "No active InfoSync account found" page.
5. Record an audit event when a social account is connected.

Configuration locations when implementing:

```text
Supabase Dashboard -> Authentication -> Providers -> Google
Supabase Dashboard -> Authentication -> URL Configuration
Google Cloud Console -> APIs and services -> Credentials
```

Manual Google setup checklist:

1. Open Google Cloud Console and create/select the InfoSync project.
2. Go to `APIs and services -> OAuth consent screen` and set the app name,
   support email, logo, and authorized domains.
3. Go to `APIs and services -> Credentials`.
4. Create an OAuth Client ID for a web application.
5. Add the Supabase callback URL below as an authorized redirect URI.
6. Copy the Google Client ID and Client Secret.
7. Open Supabase `Authentication -> Providers -> Google`.
8. Enable Google and paste the Client ID and Client Secret.
9. Open Supabase `Authentication -> URL Configuration`.
10. Add local and production app redirect URLs.
11. Set `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true` only after the provider and
    redirect URLs are working, then restart the app.

Supabase OAuth callback URL shape:

```text
https://<project-ref>.supabase.co/auth/v1/callback
```

Local app callback route already exists:

```text
http://localhost:3000/auth/callback
```

Local redirect URL to allow in Supabase:

```text
http://localhost:3000/auth/callback
```

Production will need the final domain in Supabase redirect URLs before launch.

## Launch Email Notes

Current local/dev email sending works through Resend, but production should use
a verified sending domain. Gmail may place sandbox/dev sender emails in Spam and
block remote images there.

Before launch:

1. Buy/choose the domain.
2. Verify the domain in Resend.
3. Set `RESEND_FROM_EMAIL` to an address on that domain.
4. Configure Supabase Auth SMTP/custom email delivery so password/invite emails
   are reliable.

## Database And QA Notes

Run all migration files in timestamp order from:

```text
supabase/migrations/
```

Main QA records:

```text
QA_ADMIN_TEST_PLAN.md
QA_TEST_LOG.md
NEXT_EDIT_BOOKMARK.md
```

## Notes

- `.env.local` has the Supabase and Stripe keys.
- The Stripe listener is only needed for local payment/webhook testing.
- Keep the server and Stripe listener windows open while testing payments.
