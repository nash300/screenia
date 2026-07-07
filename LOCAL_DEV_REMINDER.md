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

## Production Configuration Checklist

Use this checklist after buying the domain and before accepting real customers.

### Domain And Hosting

1. Buy/choose the production domain.
2. Deploy the app to the production host.
3. Set `NEXT_PUBLIC_APP_URL` to the final HTTPS site URL.
4. Add the final domain to any hosting/domain DNS settings.
5. Confirm these public routes work on HTTPS:

```text
/
/login
/admin-login
/onboarding/payment-success
/email-preview.html
```

### Supabase Database

1. Run every SQL file in timestamp order from:

```text
supabase/migrations/
```

2. Verify the live database has the required tables and columns for:

```text
customers
customer_subscriptions
customer_display_assets
customer_messages
devices
playlists
videos
inventory_items
admin_notifications
audit_events
consent_records
customer_legal_agreements
pricing_plans
```

3. Verify Row Level Security policies still allow:

```text
admins -> admin area
service role -> server-side writes/webhooks
customers -> only their own account data
public -> only intended landing/onboarding/display reads
```

4. Confirm storage buckets exist and permissions are correct:

```text
videos
customer-display-assets
customer-message-files
email-assets
```

5. Confirm the live `pricing_plans` rows match the current business model:

```text
Standard FHD
Premium 4K
setup fee
device fee
shipping fee
monthly fee
trial days
active status
Stripe price ids
```

6. Create real staff admin users in Supabase Auth and set:

```text
app_metadata.role = admin
```

7. Remove or clearly separate old test customer data before launch.

### Supabase Auth Emails

Supabase Auth sends the password/account setup emails. This must be production
ready before launch.

1. Open Supabase Dashboard:

```text
Authentication -> SMTP Settings
Authentication -> Email Templates
Authentication -> URL Configuration
```

2. Configure SMTP/custom email delivery through the verified sending provider.
3. Set the production site URL.
4. Add allowed redirect URLs:

```text
https://your-domain.example/auth/callback
https://your-domain.example/account/activate
https://your-domain.example/account/reset-password
```

5. Test that a paid customer receives the account creation/password email in a
   normal inbox, not only in Supabase logs.

### Resend

Resend sends InfoSync application emails such as request confirmation and
quote/onboarding emails.

1. Open:

```text
https://resend.com/domains
```

2. Add the production domain.
3. Add Resend DNS records at the domain/DNS provider.
4. Wait until Resend shows the domain as verified.
5. Set production `RESEND_FROM_EMAIL`, for example:

```text
InfoSync <onboarding@your-domain.example>
```

6. Send and inspect these emails in Gmail:

```text
landing request confirmation
quote/onboarding email
branded email images
Swedish characters
links to HTTPS production pages
```

### Stripe

Use Stripe test mode for QA. Switch to live mode only when launch is approved.

1. Confirm products/prices are synced from `/admin/pricing` for:

```text
Standard FHD setup
Standard FHD device
Standard FHD shipping
Standard FHD monthly
Premium 4K setup
Premium 4K device
Premium 4K shipping
Premium 4K monthly
```

2. Confirm price tax behavior matches InfoSync pricing:

```text
Customer-facing prices are totals including Swedish moms.
Do not add moms on top of the promised price.
```

3. Configure the production webhook endpoint:

```text
https://your-domain.example/api/stripe/webhook
```

4. Add webhook events needed by the app:

```text
checkout.session.completed
invoice.payment_failed
customer.subscription.deleted
```

5. Set the production `STRIPE_WEBHOOK_SECRET`.
6. Confirm `STRIPE_SECRET_KEY` uses the correct Stripe mode.
7. Confirm Stripe customer portal settings allow subscription/payment-method
   management in the way InfoSync wants.
8. Confirm refund workflow manually before launch:

```text
before layout starts -> setup fee can be refundable
after layout starts -> setup fee is locked/non-refundable
subscription cancellation -> Stripe and Supabase statuses stay aligned
```

9. Keep `STRIPE_AUTOMATIC_TAX_ENABLED=false` unless Stripe Tax is fully
   configured with Swedish registration, tax codes, and the correct included-tax
   behavior.

### Google OAuth

Enable only after the production domain and Supabase redirect URLs are ready.

1. Configure Google Cloud OAuth consent screen.
2. Add the production domain as an authorized domain.
3. Create a web OAuth Client ID.
4. Add Supabase callback URL:

```text
https://<project-ref>.supabase.co/auth/v1/callback
```

5. Enable Google in Supabase:

```text
Authentication -> Providers -> Google
```

6. Add local and production redirect URLs in Supabase.
7. Test Google login with a paid customer email.
8. Set:

```text
NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true
```

9. Retest that a random unpaid Google account cannot access `/account`.

### Production Environment Variables

Set these in the production host. Do not commit real values.

```text
NEXT_PUBLIC_APP_URL
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_AUTOMATIC_TAX_ENABLED
RESEND_API_KEY
RESEND_FROM_EMAIL
NEXT_PUBLIC_COMPANY_LEGAL_NAME
NEXT_PUBLIC_COMPANY_ORG_NUMBER
NEXT_PUBLIC_COMPANY_ADDRESS
NEXT_PUBLIC_COMPANY_EMAIL
NEXT_PUBLIC_GOOGLE_AUTH_ENABLED
```

### Final Launch QA

Run a full real-life test in production mode before publishing ads or accepting
real customers:

1. Customer submits request from landing page.
2. Customer receives request confirmation email.
3. Admin sees request.
4. Admin sends quote/onboarding/payment link.
5. Customer receives quote/onboarding email.
6. Customer completes onboarding details and terms.
7. Customer completes Stripe payment.
8. Stripe webhook updates Supabase.
9. Customer receives account setup email.
10. Customer creates password.
11. Customer logs in.
12. Customer submits screen material/content brief.
13. Admin sees content, payment, audit events, and notifications.
14. Admin starts layout work and verifies refund boundary timestamps.
15. Admin assigns device/media and verifies display playback.
16. Test customer cancellation before and after layout-start state.
17. Confirm all important actions have timestamps in audit/admin records.

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
