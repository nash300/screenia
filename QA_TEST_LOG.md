# Screenia QA Test Log

This file records end-to-end business-flow tests, issues found, fixes applied, and remaining launch risks.

## 2026-07-07 - Premium 4K Journey, First Pass

Scenario: customer selects Premium 4K, admin sends onboarding/payment link, customer completes details and payment, account is created, customer logs in, customer submits content, admin verifies order and content.

Result: passed after fixes.

Verified:
- Landing page Premium 4K selection.
- Request submission and admin request visibility.
- Admin quote/onboarding creation.
- Quote email delivery to verified Gmail test recipient.
- Stripe Checkout initial payment: 2,797 kr including moms.
- Stripe Checkout included moms: 559.40 kr.
- Stripe subscription: 349 kr/month after 21-day trial.
- Local webhook updates customer and order to paid.
- Customer portal login works.
- Customer content brief submission works.
- Admin sees paid order, Stripe IDs, tax, total, and uploaded text material.

Issues found:
- Resend sandbox only sends to the exact verified email address. Gmail also marked the sandbox email as spam.
- Supabase timeouts could freeze onboarding profile completion.
- Stripe checkout could fail if pricing plan lookup timed out.
- Local Stripe webhook listener was not running, so paid Stripe sessions did not update Supabase until the event was replayed.
- Reusing an existing Gmail auth user prevented a fresh customer password creation email from being tested.

Fixes completed:
- Customer profile completion waits until required terms/privacy consent and
  legal-agreement evidence is stored before payment can proceed.
- Customer profile completion rejects missing/expired onboarding tokens and
  cannot rewrite customer details after paid/refunded/cancelled payment states.
- Non-critical optional consent/audit writes still run without blocking the
  customer response.
- Legal document lookup now has a timeout and stores the agreement without `legal_document_id` if the lookup is slow.
- Stripe Checkout now blocks both customer and admin checkout paths when the
  current terms/privacy evidence is missing.
- Stripe Checkout now requires either a valid admin session or the customer's
  unexpired onboarding token before creating a payment session.
- Customer account content setup and display-material upload APIs now require
  active paid service entitlement; support messages remain available for
  billing, refund, cancellation, and access issues.
- Customer account display-material download URLs are only generated while
  paid service entitlement is active.
- Admin subscription cancellation now verifies the subscription belongs to the
  selected customer locally and in Stripe before scheduling cancellation.
- Refund before layout start now explicitly marks service access as refunded,
  and refuses to run if entitlement columns are missing.
- Layout work can only be started for paid customers whose service entitlement
  is still active or active until period end.
- Permanent customer deletion is blocked for customers with payment or Stripe
  history; those records must be suspended, refunded, cancelled, or anonymized
  instead so accounting and dispute evidence remains traceable.
- Admin customer anonymization removes contact/profile content, support
  messages, uploaded material, and technical identifiers while preserving
  payment/order/Stripe references for retention obligations. It preflights the
  required profile columns before removing files or operational records.
- Stripe checkout now falls back to the already quoted/local plan data if the pricing lookup is temporarily unavailable.
- Stripe CLI listener was started locally and the paid checkout event was replayed successfully.

Manual launch actions:
- Verify a real sending domain in Resend and change the sender to that domain.
- Configure a real deployed Stripe webhook endpoint before launch.
- Test a brand-new customer email invite/password activation after cleaning old test auth users.

## 2026-07-07 - Premium 4K Journey, Clean Repeat

Status: passed with one external email-delivery issue.

Goal: repeat the same Premium 4K flow from an empty customer database and verify that a brand-new customer can create their own password after payment.

Setup:
- Removed all customer records from Supabase.
- Removed the old linked customer auth user for `nadeesha7314@gmail.com`.
- Kept admin, pricing, Stripe, and service configuration.

Verified:
- Fresh customer database started with 0 customers.
- Landing page Premium 4K request created one new customer: `Clean Premium 4K 20260707195553 AB`.
- Admin onboarding preview showed correct pricing:
  - Setup: 1,599 kr
  - Device: 1,099 kr
  - Shipping: 99 kr
  - Initial payment: 2,797 kr
  - Included moms: 559.40 kr
  - Monthly after trial: 349 kr
- Admin sent quote/onboarding link for order `1000000034`.
- Quote email arrived in Gmail, but was placed in Spam because it uses the Resend sandbox sender.
- Customer completed onboarding details without the previous saving hang.
- Stripe Checkout opened without pricing-plan errors.
- Stripe Checkout showed total 2,797 kr, moms 559.40 kr, and monthly 349 kr after the trial.
- Stripe test payment succeeded.
- Local Stripe listener received `checkout.session.completed` automatically and the app updated Supabase without manual replay.
- Customer record became `paid`.
- Subscription/order became `paid`, with Stripe subscription `sub_1Tqf7xGhi0eDHRQZFZZyxlD7`.
- Supabase created a new customer auth user `71314101-ad81-4fe9-8b42-6ebe2a46dfdb`.
- Generated activation link landed on `/account/activate`.
- Customer chose own password and logged into the customer portal.
- Customer portal showed the correct paid customer.
- Customer submitted content brief.
- Admin saw paid order `1000000034`, tax 559.40 kr, total 2,797 kr, and uploaded text material.

Remaining issue:
- Supabase Auth marked `confirmation_sent_at`, but the invite/password email did not appear in Gmail. The password creation page works when the activation link is opened, so the remaining issue is Supabase Auth email delivery/configuration, not the app page.

Manual launch action:
- Configure and verify production email delivery for both Resend and Supabase Auth before launch.

## Pending - Subscription Operations Compatibility

Planned verification after implementation:
- Cancel-at-period-end keeps Screenia access until the paid-through date.
- Pause blocks display access immediately and resume restores it.
- Temporary admin discount applies a Stripe coupon and stores an adjustment row.
- Display pages require active paid entitlement, not just customer status.
- Sensitive admin actions write audit events with reasons.

## 2026-07-07 - Customer Password Policy

Status: implemented.

Rule:
- Password must be at least 6 characters.
- Password must contain at least one letter.
- Password must contain at least one number.

Applied to:
- First-time customer account activation.
- Customer password reset.

Verification:
- `abc12` rejected.
- `abcdef` rejected.
- `123456` rejected.
- `abc123` accepted.

## 2026-07-07 - Premium 4K Journey, Clean Repeat With Google Gate

Status: passed, with Google OAuth provider setup still manual.

Goal: repeat the Premium 4K customer scenario from an empty customer database and include the new Google login entry point.

Setup:
- Cleaned customer-side state before the run.
- Verified `customers`, `customer_subscriptions`, `customer_messages`, `customer_display_assets`, `devices`, and `playlists` were all `0`.
- Stripe listener was already running locally.

Customer:
- Submitted landing-page request for `TEST - Clean Google Premium 4K 20260707202409 AB`.
- Email: `nadeesha7314@gmail.com`.
- Customer id: `936ae36e-744a-4c10-96d9-4a88a2f56cd1`.
- Customer number: `10000041`.
- Requested package metadata stored as `premium_4k`, `Premium`, `4K`, quantity `1`.
- Request confirmation email was sent through Resend. Resend id: `38ef202b-b4b3-43c1-a9c9-ceb510f7f4e9`.

Admin:
- Admin prepared and sent quote/onboarding link.
- Order number: `1000000035`.
- Onboarding token: `8a5a0c42-9eaf-4313-8585-b4b44f9bf25d`.
- Admin quote preview showed Premium 4K, setup `1 599 kr`, device `1 099 kr`, shipping `99 kr`, first payment `2 797 kr`, included VAT `559,40 kr`, monthly `349 kr`, and trial `21` days.

Onboarding and payment:
- Customer completed required onboarding profile fields.
- Required terms and privacy consent were accepted.
- Optional marketing, analytics, and remote-support consents were left off for GDPR-minimal testing.
- Stripe Checkout showed today's payment `2 797,00 kr`, included VAT `559,40 kr`, and monthly `349,00 kr` after `21 dagar gratis`.
- Stripe test card payment succeeded and redirected to the payment-success page.
- Stripe customer id: `cus_UqMHKFSmRzUIH2`.
- Stripe subscription id: `sub_1TqfaWGhi0eDHRQZL0gQvmpf`.

Database and audit:
- Customer ended as `status: paid`, `payment_status: paid`.
- Subscription `1000000035` ended as `status: paid`, `setup_fee_paid: true`, `stripe_payment_status: paid`, `fulfillment_status: content_collection`, `inventory_status: ready_to_reserve`.
- Stored subscription amounts were setup `1599`, hardware `1099`, shipping `99`, monthly `349`, tax amount `55940` ore, total `279700` ore.
- Audit events included `landing_purchase_request_created`, `request_confirmation_email_sent`, `quote_onboarding_email_sent`, `onboarding_profile_completed`, `stripe_checkout_started`, and `payment_completed`.
- Admin notification `Payment completed` was created with priority `urgent`.

Account:
- Supabase Auth customer user was created and linked as `auth_user_id: 0cc2069a-c4e0-4dbb-9822-0e07a121cf2e`.
- Generated a secure Supabase recovery/activation link for QA because Supabase Auth email delivery remains a known manual configuration issue.
- Customer chose password `Test202409` and landed in `/account?section=overview`.
- Customer logged out and logged back in with email/password successfully.

Google login:
- Initial test found that clicking Google redirected to Supabase raw JSON: `Unsupported provider: provider is not enabled`.
- Fixed in code: Google login is now gated by `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED`.
- With the provider not configured, `/login` now shows disabled `Google-inloggning kommer snart` and explanatory text instead of sending customers to a raw provider error.
- Full Google OAuth account linking still requires manual Google Cloud and Supabase provider setup, then `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true`.

Admin final visual check:
- Logged in with the QA admin account.
- Admin customer onboarding page showed the paid customer, order `1000000035`, Stripe IDs, correct Premium 4K pricing, setup-fee refund boundary, and available admin actions.

## 2026-07-15 - Online Production Dummy Scenario Start

Status: started; customer request step passed. Admin-side continuation requires live admin login.

Scope:
- Production environment: `https://screenia.se`.
- Live payments remain disabled/not confirmed; Stripe must stay in test mode for the continuation.
- Dummy customer data was intentionally inserted for the first online scenario.

Customer request:
- Package selected visually on live site: Premium 4K.
- Company: `Screenia Dummy Premium 4K 2026-07-15T01-16-13-277Z`.
- Email: `service@screenia.se`.
- Contact: `Screenia Test Customer`.
- Phone: `+46700000000`.
- Requested screens: `1`.
- Message: `Controlled online dummy scenario test. Premium 4K full flow. Test id: 2026-07-15T01-16-13-277Z`.

Database evidence:
- Customer id: `45fbeab1-9cdf-4ba0-9cc7-6d37fa5c6ffc`.
- Customer number: `10000043`.
- Status: `new_request`.
- Requested package metadata stored as `premium_4k`, `Premium`, `4K`, quantity `1`.

Consent, audit, and notification evidence:
- Privacy request consent was stored in `consent_records` with document version `2026-07-12-prelaunch`.
- Audit events include `customers_insert`, `landing_purchase_request_created`, and `request_confirmation_email_sent`.
- Admin notification `New customer request` was created with priority `high`.

Email evidence:
- Request confirmation email was sent to `service@screenia.se`.
- Resend email id: `f09a83d1-3b1a-4126-83d1-9a5b1a7e4ee2`.
- `resend_delivery_events` recorded both `email.sent` and `email.delivered` for subject `Screenia har tagit emot din förfrågan`.

Next required step:
- Log into live `/admin-login`.
- Open customer `45fbeab1-9cdf-4ba0-9cc7-6d37fa5c6ffc`.
- Continue with admin quote/onboarding link, customer onboarding, Stripe test checkout, account activation, and admin/customer verification.

## 2026-07-15 - Fresh Testing Reset

Status: completed.

Goal: reset the online testing environment so the next real-life scenario starts from a clean state.

Supabase:
- Cleared operational test data from customers, subscriptions, devices, playlists, videos, customer messages/assets, consent records, email delivery records, Stripe webhook records, admin notifications, and audit events.
- Kept baseline configuration data: `pricing_plans=2` and `legal_documents=4`.
- Removed old customer/admin auth users.
- Created one confirmed admin auth user: `admin@screenia.se` with `app_metadata.role=admin`.
- Did not store the temporary admin password in the repository.

Stripe test mode:
- Cancelled the remaining active trial subscriptions.
- Deleted old Stripe test customers.
- Archived old/QA Stripe products and prices.
- Kept only the active products and price IDs referenced by the current Screenia pricing plans.
- Verified Stripe has `0` customers and `0` active subscriptions after cleanup.

Visual verification:
- Logged into the live admin dashboard at `https://screenia.se/admin-login` as `admin@screenia.se`.
- Dashboard showed `0` new requests, `0` invited customers, `0` content setup customers, `0` devices, and `0` unread notifications.

Next required step:
- Start the next production dummy scenario from the live landing page using fresh customer data.

## 2026-07-15 - Production Premium 4K Customer Lifecycle Scenario

Status: passed for the tested Premium 4K happy path and reversible billing operations, with launch blockers still listed below.

Scope:
- Production environment: `https://screenia.se`.
- Stripe test mode only.
- Customer journey tested visually in the in-app browser from landing page through admin, onboarding, Stripe Checkout, account activation/login, customer portal, device assignment, display entitlement, and admin billing operations.

Customer and order:
- Customer id: `a0fe0b3d-d3f4-45a5-9316-1e0bc8588009`.
- Customer number: `10000044`.
- Company: `Screenia Live Premium 4K 20260715014357 AB`.
- Email: `service@screenia.se`.
- Order number: `1000000036`.
- Onboarding token: `43e0fa79-7df2-4c32-9498-59c7c65b45a4`.
- Package: `premium_4k`, Premium, 4K, quantity `1`.
- Device code: `QRWXVA`.
- Stripe customer: `cus_Ut43Oaq32pKmj7`.
- Stripe subscription: `sub_1TtHxgGhi0eDHRQZnv0vnynm`.
- Stripe checkout session: `cs_test_b1lr992plRqhP3jA7hwJ0RfJjLWXcTDaYHne0gmmjx1lulcyiAWLrlvqxV`.
- Stripe invoice: `in_1TtHxeGhi0eDHRQZmEU7FVET`.

Pricing and payment evidence:
- Landing and admin quote selected Premium 4K correctly.
- First payment shown in Stripe Checkout: `2 797,00 kr`.
- Breakdown: setup `1 599 kr`, Premium 4K device `1 099 kr`, shipping `99 kr`.
- Included VAT: `559,40 kr`.
- Monthly subscription after trial: `349 kr/month`, included monthly VAT `69,80 kr`.
- Trial period: 21 days, `2026-07-15` to `2026-08-05`.
- Customer portal and admin order views showed the same customer-facing totals after previous VAT/pricing corrections.

Customer journey results:
- Landing order form saved customer details and created admin notification/audit events.
- Invalid Swedish organisation number was rejected; valid test number `556016-0680` was accepted.
- Quote/onboarding email was sent and delivered.
- Onboarding profile, legal acceptance, and Stripe test payment completed.
- Supabase Auth invite/account activation email arrived and the customer created a password successfully.
- Customer could log out and log in again.
- Customer portal showed billing, content setup, support messages, consent controls, and data export.
- Customer content setup and support messages created admin notifications and audit events.
- Data export created an audit event.

Admin and device results:
- Admin could see the customer, order, communication, devices, and history.
- Admin assigned a Premium 4K inventory item and created device `QRWXVA`.
- Display endpoint after activation showed `No content assigned`, which is correct for an active device without a published playlist.
- Display endpoint while paused showed `Display inactive`.
- Display endpoint after resume returned to `No content assigned`.

Billing lifecycle operations tested:
- Start layout work:
  - Admin page warned that setup/layout fee becomes non-refundable.
  - Customer `production_status` became `layout_started`.
  - `layout_started_at`, `setup_fee_locked_at`, and subscription `setup_started_at` were recorded.
  - The admin refund-first-payment action disappeared after the lock.
- Pause subscription:
  - Stripe `pause_collection` was set.
  - Local customer access became paused/suspended.
  - Display endpoint was blocked.
- Resume subscription:
  - Stripe `pause_collection` was cleared.
  - Local customer access became active again.
  - Display endpoint became active/no-content again.
- Cancel at period end:
  - Stripe `cancel_at_period_end` was set.
  - Local access became `active_until_period_end` until `2026-08-05T01:50:10+00:00`.
  - Display remained active during the paid/trial period.
- Undo scheduled cancellation:
  - Added/fixed admin resume path for scheduled cancellations.
  - Stripe `cancel_at_period_end` was cleared.
  - Local cancellation reason/source/details were cleared.
- Temporary discount:
  - Admin applied Stripe test coupons through the operation flow.
  - Local `subscription_adjustments` rows were recorded.
  - Production fulfillment status stayed `layout_started` after the webhook preservation fix.

Fixes completed during this scenario:
- Fixed payment-success page heading contrast.
- Fixed Stripe trial/current-period sync so local subscription stores `trial_starts_at`, `trial_ends_at`, and period dates.
- Fixed customer activation timestamp sync after password setup/login.
- Fixed customer portal content submission access for paid customers before final admin activation.
- Fixed customer portal message/material submissions to refresh visible state immediately.
- Fixed admin order status separators.
- Removed stale pre-Screenia MP4 media and replaced the landing service video with safe Screenia imagery.
- Fixed layout-start operation to write subscription `setup_started_at`.
- Fixed admin scheduled-cancellation UX to show `Resume subscription` as the undo action.
- Fixed resume subscription to clear stale cancellation reason/source/details.
- Fixed admin billing operations and Stripe webhook sync so billing changes do not overwrite production fulfillment state such as `layout_started`.

Remaining launch blockers / manual action:
- Supabase Auth sender must be rechecked before launch. During this scenario one invite showed `hello@screenia.se`; clients should see/reply to `service@screenia.se` only.
- Admin media native file-picker upload was not fully automated visually; a fresh Screenia-branded MP4 asset is still needed for final playback QA.
- Inventory form field labels/field mapping need polish: a service-note style entry appeared under a defect-related field during inventory creation.
- Legal consent checkboxes work but need better stable labels/ids for accessibility and automated testing.
- There is no admin operation to remove/revoke a temporary Stripe discount after applying it; add this before launch if customer-specific discounts will be managed from the admin panel.
- `Cancel now` and actual refund-before-layout require separate destructive test customers; the main Premium 4K test customer was preserved in active/layout-started state.
