# Screenia Real-World Testing Runbook

Last updated: 2026-07-15

Use this runbook when the domain, mailbox, Resend, Supabase Auth, Vercel, and Stripe test-mode setup are ready for real scenario testing. Keep Stripe in test mode until business registration, VAT/tax, legal review, and live webhook verification are complete.

## Stop Rules

- Check `/admin/launch-readiness` before any long test pass.
- Do not enable live Stripe keys or `SCREENIA_LIVE_PAYMENTS_ENABLED=true` during this runbook.
- Do not set `SCREENIA_SUPABASE_AUTH_EMAIL_VERIFIED=true` until a real invite/password setup or password reset email is received and a password is submitted successfully.
- Do not set business, VAT, legal, or live webhook confirmation flags until each item has human/legal/business proof.
- Do not set `SCREENIA_VERCEL_PRO_CONFIRMED=true` until Vercel Pro or another commercial-ready hosting plan is active for Screenia production.
- Stop and record evidence if any payment, email, auth, display entitlement, or audit step fails.

## Current Manual Gates

1. Mailbox proof
   - Completed 2026-07-15: Gmail to `service@screenia.se` delivered into Zoho Mail for `admin@screenia.se` through the `service@screenia.se` alias.
   - Completed 2026-07-15: Zoho Mail from `service@screenia.se` to Gmail delivered to Gmail inbox.
   - Completed 2026-07-15: production request confirmation from `https://screenia.se` delivered to Gmail from `service@screenia.se`.
   - Keep `info@screenia.se` reserved for newsletters/broadcasts; do not use it for one-to-one customer service tests.

2. Supabase Auth proof
   - Completed 2026-07-15: a controlled password reset request to `service@screenia.se` was delivered through Supabase Auth SMTP/Resend from `"Screenia" <service@screenia.se>`.
   - Completed 2026-07-15: latest production reset proof stored Resend email `423246f2-223a-4ebc-8d96-14d2fb128eee` with `email.sent` and `email.delivered`, plus audit event `password_reset_email_requested` at `2026-07-15T15:31:16.857471+00:00`.
   - Completed 2026-07-15: the earlier Supabase Auth SMTP sender drift was corrected from `hello@screenia.se` to `service@screenia.se` in the Supabase dashboard.
   - Open the link and confirm it lands on `https://screenia.se/account/activate` or `https://screenia.se/account/reset-password`.
   - Submit a test password that satisfies the policy: at least 10 characters with letters and numbers.
   - Confirm the user lands in `/account`.
   - Only after that, set `SCREENIA_SUPABASE_AUTH_EMAIL_VERIFIED=true`.

3. Vercel plan and deployment proof
   - Upgrade/use Vercel Pro before real commercial production.
   - Set `SCREENIA_VERCEL_PRO_CONFIRMED=true` only after the commercial hosting plan is active.
   - Reconnect GitHub-to-Vercel deployments when GitHub OAuth allows it.
   - Confirm production still aliases to `https://screenia.se`.

4. Business/legal/tax proof
   - Register or confirm the Swedish business identity path.
   - Confirm organisation number and registered address before setting company identity env vars.
   - Confirm VAT/moms registration or exemption decision.
   - Complete final legal/accounting review of terms, privacy, cookie, subscription, support, refund, and public company details.

## Test Order

1. Preflight
   - Open `https://screenia.se/admin/launch-readiness`.
   - Record pass/review/blocked counts.
   - Current production proof from 2026-07-15: 53 passed, 10 review warnings, 0 blocked, 84% progress.
   - Fix blocked items before continuing.

2. Public request flow
   - Submit a real-looking customer request from `https://screenia.se`.
   - Verify the customer/request appears in admin.
   - Verify confirmation email and admin notification behavior.
   - Completed 2026-07-15: production Premium 4K request modal opened from `Välj Premium`, request `Screenia Public Request QA 20260715154349 AB` saved as customer `10000052`, admin list showed it under requests, audit/admin notification records were created, and Resend delivered confirmation email `d4c4a3c2-069b-4ac4-8d55-30ea3f6fb3c3` from `Screenia <service@screenia.se>`.
   - Completed 2026-07-15 cleanup: unpaid/no-Stripe dummy request `10000052` was permanently deleted through the admin DELETE endpoint with audit evidence retained and detached.

3. Admin quote and onboarding
   - Open the new customer in admin.
   - Prepare quote/onboarding with a clear audit reason.
   - Confirm onboarding email delivery and Resend event logging.

4. Customer onboarding
   - Open the onboarding link.
   - Complete customer profile, legal consent, billing details, and content setup.
   - Confirm the app blocks incomplete legal/payment prerequisites.

5. Stripe test checkout
   - Complete Stripe Checkout using test-mode payment details.
   - Confirm success redirect.
   - Confirm customer, order, payment status, Stripe customer/subscription/session IDs, VAT totals, and audit events in admin.

6. Supabase Auth customer access
   - Confirm the customer receives the account activation/reset email.
   - Set a password and log into `/account`.
   - Verify account details, subscription state, messages, content, and billing portal behavior.
   - Current partial proof from 2026-07-15: direct temporary-password login for active Premium 4K QA customer succeeded, account/billing details rendered correctly, Stripe billing portal opened, and audit events were stored.
   - Remaining proof: complete the real mailbox activation/reset link and submit a password from the email flow.

7. Display entitlement
   - Assign or use a test display device.
   - Confirm active paid customer content plays.
   - Completed 2026-07-15 for active test device `QRWXVA`: visible display page rendered one playing muted video at 1280x720.
   - Completed 2026-07-15: pausing the Premium 4K subscription set Stripe `pause_collection.behavior=void`, local/customer access to paused, made `/api/display/QRWXVA/playlist` return HTTP 403, and showed `Display inactive`.
   - Completed 2026-07-15: resuming the same subscription cleared Stripe pause collection, restored local/customer active access, and restored visible display playback.
   - Completed 2026-07-15: scheduling cancellation at period end set Stripe/local cancellation flags and `active_until_period_end`, while display content stayed playable until `2026-08-05T01:50:10Z`.
   - Completed 2026-07-15: undoing the scheduled cancellation cleared Stripe/local/customer cancellation fields and kept display playback active.
   - Completed 2026-07-15: a signed Stripe failed-payment test event suspended the customer, set `service_access_status=payment_failed`, created urgent admin/audit evidence, and made `/display/QRWXVA` show `Display inactive`.
   - Completed 2026-07-15: a paid-invoice recovery test restored customer/display access and now preserves `fulfillment_status=layout_started` instead of losing production progress.

8. Billing operations
   - Completed 2026-07-15: applied and removed a 15% / 2 month temporary discount through the production admin API, confirming Stripe discount state, local `subscription_adjustments`, audit events, and display access.
   - Completed 2026-07-15: triggered payment failed behavior in test mode and confirmed display access blocks.
   - Completed 2026-07-15: confirmed refund is blocked after layout starts, then refunded a separate paid-before-layout Premium 4K test customer through the production admin refund API.
   - Completed 2026-07-15: fixed Stripe refund webhook evidence de-duplication so repeated refund events do not create new duplicate admin audit/notification rows.
   - Completed 2026-07-15: tested Stripe dispute/chargeback behavior with signed local webhook events. Open disputes block customer display access and record urgent evidence; won disputes restore the customer, subscription, and display access while preserving `fulfillment_status=layout_started`.
   - Completed 2026-07-15: cleaned Stripe test-mode active prices so only the 8 Supabase-referenced Standard FHD and Premium 4K prices remain active, with dedicated setup-fee products and inclusive tax behavior.
   - Completed 2026-07-15: updated Stripe branding/account display name to Screenia where dashboard/API access allowed, and updated the checkout route to use static Stripe price IDs for standard checkouts instead of creating new active product/price objects.

9. Evidence export
   - Completed 2026-07-15: fixed accounting CSV old discount-column names and verified production export includes active/refunded orders with customer/order/payment/VAT evidence.
   - Completed 2026-07-15: fixed VAT summary to include paid setup orders during trial by using active/paid rows with `tax_status=complete`.
   - Completed 2026-07-15: production VAT summary returned gross `2797.00` SEK, VAT `559.40` SEK, net `2237.60` SEK for active order `1000000036`.
   - Completed 2026-07-15: final production smoke confirmed `/api/admin/accounting-export` returns HTTP 200 CSV and `/api/admin/vat-summary?format=csv` returns HTTP 200 CSV. Use `/api/admin/accounting-export`; the older `/api/admin/accounting/export?format=csv` path is not a valid route.

## Evidence To Record

- Date/time and test operator.
- Customer test email/domain used.
- Launch-readiness counts before and after.
- Mail delivery placement for Gmail and Zoho both ways.
- Resend event types observed.
- Supabase Auth activation/reset result.
- Stripe test checkout session, subscription, invoice, and webhook event IDs.
- Admin audit event names for each sensitive action.
- Display result for active, paused, payment failed, and cancelled/paid-through states.
- Any errors, screenshots, or support actions needed.
- Note for automated admin testing: reuse an authenticated admin session where possible. Repeated `/api/auth/login` calls can correctly hit the login rate limiter.

## Expected Remaining Review Gates

- Business registration and company identity.
- VAT/tax decision.
- Final legal/accounting review.
- Vercel Pro for commercial production.
- Live Stripe webhook verification.
- Supabase Auth email verified after real password setup/reset proof.
- Final live-payment switch.
