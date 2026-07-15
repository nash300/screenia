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
  - QA-only active discounts were removed from the Stripe test subscription after verification, and local adjustment rows were marked inactive.
- Remove temporary discount:
  - Added and deployed an audited admin operation for removing/revoking a temporary Stripe discount.
  - Retested visually on the live admin customer page by applying a 3% one-month test discount, confirming the `Remove temporary discount` action appeared, then removing it through the new operation flow.
  - Stripe subscription ended with `discountCount=0`.
  - Local active `subscription_adjustments` ended at `0`, with the QA adjustment row marked `inactive`.
  - Audit events included `subscription_discount_applied` and `subscription_discount_removed`.
  - Customer and subscription remained `active`, and order fulfillment remained `layout_started`.

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
- `Cancel now` and actual refund-before-layout require separate destructive test customers; the main Premium 4K test customer was preserved in active/layout-started state.

### Refund Before Layout QA - 2026-07-15

Scenario tested:
- Disposable Standard FHD customer requests a quote, accepts onboarding, pays first Stripe payment, then admin refunds before layout work starts.

First run:
- Customer `10000045` / `ea071626-a2ac-4a3a-87cf-0fa98cdd2268`.
- Stripe Checkout correctly showed first payment `2 397 kr`, included VAT `479,40 kr`, and monthly `249 kr` after 21-day trial.
- Payment succeeded, customer became `paid`, service access became `active`, production stayed `not_started`, and setup fee remained refundable.
- Admin refund action succeeded, Stripe charge was fully refunded (`239700` ore), and Stripe subscription was canceled.
- Issue found: Stripe webhook evidence overwrote the customer record's admin refund context with a generic Stripe cancellation/refund source.

Fix completed:
- Updated admin refund route to set `inactive_reason=refunded_before_production`.
- Updated Stripe refund webhook customer lookup and full-refund sync so app/admin initiated refund context is preserved instead of being overwritten by later Stripe refund/subscription webhooks.

Retest after deployment:
- Deployment: `dpl_GaZztUKgHBq7Mz5P7jYLGRwcMHoH`, aliased to `https://screenia.se`.
- Customer `10000046` / `47e6e4ca-1b45-480b-a5c2-adb6540a0ece`.
- Stripe Checkout initially rendered `Moms 0,00 kr`, but the Checkout Session API already had correct `automatic_tax.status=complete` and `total_details.amount_tax=47940`; after refresh, Checkout visually showed `Moms 479,40 kr`.
- Payment succeeded, then the refund was executed and Stripe fully refunded charge `ch_3TtSCyGhi0eDHRQZ1hC6JNwR` with refund `re_3TtSCyGhi0eDHRQZ1hIlNkVN`.
- After Stripe refund and subscription deletion webhooks, customer state remained correct:
  - `status=suspended`
  - `payment_status=refunded`
  - `service_access_status=refunded`
  - `production_status=not_started`
  - `layout_started_at=null`
  - `setup_fee_locked_at=null`
  - `inactive_reason=refunded_before_production`
  - `cancellation_reason=refunded_before_production`
  - `cancellation_source=admin`
- Audit events include admin `payment_refunded`, Stripe `payment_refunded_externally`, and Stripe `subscription_cancelled`.

Result:
- Refund-before-layout business rule now works and preserves the admin/legal reason after Stripe webhook sync.
- Launch note: Stripe test-mode branding still shows `New business sandbox`; Stripe account branding/name must be changed to Screenia before live launch.

### Immediate Cancellation QA - 2026-07-15

Scenario tested:
- Disposable paid Standard FHD customer is cancelled immediately by admin using the `Cancel now` operation.

Customer and payment:
- Customer `10000047` / `df98ab11-01fd-4670-b357-62e88ecfa860`.
- Stripe customer `cus_UtF09JMwW8o2oo`.
- Stripe subscription `sub_1TtSWJGhi0eDHRQZl3dEQtHI`.
- Stripe invoice `in_1TtSWJGhi0eDHRQZiOvRbNTy` remained paid: `2 397 kr`, not refunded.
- Local order/payment evidence: `total_amount_sek=239700`, `tax_amount_sek=47940`, `setup_fee_paid=true`.

Admin flow results:
- Admin customer page showed `Cancel now` only while the subscription was active/trialing.
- The selected action panel explained that Stripe cancellation happens immediately and display access is blocked.
- The action required an operational reason and impact-review checkbox.
- After running the action, Stripe subscription became `canceled`.
- Customer state became:
  - `status=suspended`
  - `payment_status=cancelled`
  - `service_access_status=cancelled`
  - `inactive_reason=subscription_cancelled`
  - `cancellation_reason=admin_immediate`
  - `cancellation_source=admin`
  - `production_status=not_started`
- Local subscription state became:
  - `status=cancelled`
  - `stripe_payment_status=paid`
  - `fulfillment_status=cancelled`
  - `cancel_at_period_end=false`
  - `cancellation_effective_at=2026-07-15T13:08:39.9+00:00`

Issues found and fixed:
- Admin overview incorrectly showed `Setup fee refund boundary: Not paid yet` for a cancelled-but-paid customer.
- Fixed admin subscription data loading to include `setup_fee_paid` and `stripe_payment_status`.
- Admin overview now shows `Setup fee refund boundary: Paid; not refunded`.
- After immediate cancellation, the admin operation panel still showed invalid Stripe actions such as pause, discounts, and cancel again.
- Fixed operation availability so terminal `cancelled` / `refunded` states hide further Stripe/customer actions.

Retest after deployment:
- Deployment: `dpl_DSi12xxsmi9XAhgL8nH9ovdGSmYo`, aliased to `https://screenia.se`.
- Reloaded the cancelled customer page visually.
- Verified `Paid; not refunded` appears.
- Verified no terminal-state action buttons appear and the panel says `No customer operations are currently available for this state.`

Cleanup:
- Removed orphan Stripe test customers created during failed setup attempts: `cus_UtEzdc8KDZYuYE`, `cus_UtEyecHN3SHX8H`.
- Archived temporary Stripe QA products created for the cancel-now setup.

Result:
- Immediate cancellation works and is auditable.
- Admin UI no longer invites invalid post-cancellation Stripe operations.

### Supabase Auth Sender QA - 2026-07-15

Scenario tested:
- Verify that customer account/password emails do not expose the removed `hello@screenia.se` address and use the public service sender instead.

Issue found:
- A controlled customer password reset email was delivered, but Resend evidence showed the sender as `"Screenia" <hello@screenia.se>`.
- This was not caused by the app transactional email helper; `.env.example`, README, and `src/lib/server/email.ts` already point customer mail to `service@screenia.se`.
- Root cause was Supabase Auth custom SMTP configuration: the Supabase dashboard SMTP sender email had drifted to `hello@screenia.se`.

Fix completed:
- Updated Supabase Authentication -> Emails -> SMTP Settings so the sender email is `service@screenia.se`.
- Kept sender name as `Screenia`, SMTP host as `smtp.resend.com`, port `465`, and username `resend`.

Retest:
- Triggered a second controlled password reset request for `service@screenia.se` from the live `/login` page.
- Resend/Supabase delivery evidence:
  - Before fix: Resend email `cdac70d6-6e55-413c-b4e6-3dc7cc6f9b60`, from `"Screenia" <hello@screenia.se>`.
  - After fix: Resend email `958cdc4d-f3ab-44c2-b84c-bb735890244d`, from `"Screenia" <service@screenia.se>`.
  - After-fix delivery events included `email.sent` and `email.delivered`.
  - Audit evidence includes `password_reset_email_requested` and `resend_delivery_event_received`.

Result:
- Supabase Auth password reset emails now use `service@screenia.se` as the sender.
- Remaining gate: open a real password reset/activation link from the mailbox UI, submit a compliant password, and confirm `/account` login before setting `SCREENIA_SUPABASE_AUTH_EMAIL_VERIFIED=true`.

### Launch Readiness Page QA - 2026-07-15

Scenario tested:
- Admin logs into production and opens `/admin/launch-readiness` to verify the prelaunch readiness dashboard.

Issue found:
- The admin login page accepted the QA admin account, but the launch-readiness page initially showed `Could not check readiness`.
- Direct API verification showed `/api/admin/launch-readiness` returned `500` after authentication.
- Vercel logs showed `ENOENT`, caused by source/doc file checks that worked locally but were not included in the Vercel serverless trace.
- The requested temporary admin password `12345` could not be used because Supabase enforces a minimum of 6 characters.

Fix completed:
- Updated `/api/admin/launch-readiness` to preserve refreshed Supabase auth cookies in JSON responses.
- Added explicit Next.js output file tracing includes for the launch-readiness route so production has access to the source, docs, Supabase migration, and public files it checks.
- Reset the QA admin account to the compliant temporary password `Screenia12345`.

Retest:
- Local build passed.
- Production deployment `dpl_8krGRzft1EHUpDkYoGtcNXui2jez` was aliased to `https://screenia.se`.
- Direct authenticated API check returned HTTP 200.
- Visible browser retest showed:
  - `Passed`: 52
  - `Needs review`: 10
  - `Blocked`: 1
  - `Progress`: 83%

Result:
- Launch-readiness dashboard is usable in production after admin login.
- Follow-up fix: uploaded the existing QA MP4 asset through the admin device media API for active device `QRWXVA`, creating playlist `4b0e1b0e-4a95-4717-80b4-86e074e87432`.
- Verified `/api/display/QRWXVA/playlist` returns HTTP 200 with one signed playlist item.
- Final visible browser retest showed:
  - `Passed`: 53
  - `Needs review`: 10
  - `Blocked`: 0
  - `Progress`: 84%
- Remaining items are review/manual launch gates, not blocked technical checks.

### Customer Portal, Billing Portal, And Display Playback QA - 2026-07-15

Scenario tested:
- Active Premium 4K dummy customer logs into the production customer portal, reviews subscription/billing details, opens Stripe billing portal, and confirms the assigned display plays content.

Customer:
- Customer `10000044` / `a0fe0b3d-d3f4-45a5-9316-1e0bc8588009`.
- Email `service@screenia.se`.
- Auth user `4a501388-d257-4300-90af-b084d0fadc54`.
- Stripe customer `cus_Ut43Oaq32pKmj7`.
- Stripe subscription `sub_1TtHxgGhi0eDHRQZnv0vnynm`.
- Temporary QA password was set directly through Supabase Admin for this portal test: `ScreeniaCustomer123`.

Customer portal results:
- Login from `https://screenia.se/login` succeeded and redirected to `/account?section=overview`.
- Overview showed the customer as active, with Premium 4K context, 1 screen, and layout-started/refund-boundary information.
- Billing section showed:
  - Package: `Premium 4K`
  - First payment: `2 797 kr`
  - Monthly price after trial: `349 kr`
  - Latest invoice amount: `2 797 kr`
  - Latest VAT: `559,40 kr`
  - Trial period: `21 dagar`
  - Explanation: first payment is setup `1 599 kr`, device `1 099 kr`, shipping `99 kr`, all including moms.

Stripe billing portal results:
- `Öppna betalningsportal` opened Stripe billing portal successfully.
- Stripe portal showed the current trial subscription ending `5 Aug 2026`.
- Stripe portal showed `Screenia Premium 4K månadsabonnemang`, `SEK 349.00 per month`, card `4242`, billing info for the QA customer, and invoice history `SEK 2,797.00 Paid`.
- Audit event `billing_portal_session_created` was stored with Stripe portal session `bps_1TtTAzGhi0eDHRQZo3mLHMZa`.
- Audit event `customer_login_success` was stored with the customer auth user.

Display playback results:
- `/api/display/QRWXVA/playlist` returned HTTP 200 with one signed playlist item.
- Visible `/display/QRWXVA` page rendered one video element.
- Video was playing, muted, readyState `4`, and rendered at `1280x720`.

Issue found:
- Stripe billing portal branding still says `New business sandbox`. This is an external Stripe account branding/configuration item and must be changed to Screenia before real customers.

Result:
- Customer portal login, Premium 4K billing display, Stripe billing portal connection, audit tracking, and display playback all passed for the active QA customer.
- Remaining account proof gate is still the real mailbox activation/password-reset link submission; this pass used a direct Supabase Admin temporary password and does not prove the email-link password setup flow.

### Pause And Resume Subscription QA - 2026-07-15

Scenario tested:
- Active Premium 4K customer subscription is paused by admin, display access is blocked, then subscription is resumed and display playback is restored.

Baseline:
- Customer `10000044` / `a0fe0b3d-d3f4-45a5-9316-1e0bc8588009`.
- Stripe subscription `sub_1TtHxgGhi0eDHRQZnv0vnynm`.
- Device `QRWXVA`.
- Before pause:
  - Customer `status=active`, `payment_status=paid`, `service_access_status=active`.
  - Local subscription `status=active`, `stripe_payment_status=trialing`, `pause_started_at=null`.
  - Stripe subscription `status=trialing`, `pause_collection=null`.
  - `/api/display/QRWXVA/playlist` returned HTTP 200 with one playlist item.

Pause action:
- Called production admin subscription API with `action=pause_subscription`.
- Reason: `QA pause/resume test: verify paused subscription blocks display access and is auditable.`
- Result: HTTP 200.

Paused-state verification:
- Stripe subscription kept `status=trialing` and set `pause_collection.behavior=void`.
- Local subscription became `status=paused`, `pause_started_at=2026-07-15T13:52:03.513+00:00`, with the QA pause reason stored.
- Customer became `status=suspended`, `service_access_status=paused`, `inactive_reason=paused`, `cancellation_source=admin`.
- Audit event `subscription_paused` was stored with the admin reason and Stripe subscription id.
- `/api/display/QRWXVA/playlist` returned HTTP 403 with `Display is not active.`
- Visible `/display/QRWXVA` showed `Display inactive`, no video element.

Resume action:
- Initial resume attempt through `/api/auth/login` was blocked by login rate limiting after repeated QA admin logins; this confirms rate limiting works.
- Used a valid Supabase admin session through `/auth/session` to call the same production admin subscription API with `action=resume_subscription`.
- Reason: `QA pause/resume test cleanup: restore active access after verifying paused display blocking.`
- Result: HTTP 200.

Restored-state verification:
- Stripe subscription returned to `status=trialing`, `pause_collection=null`, `cancel_at_period_end=false`.
- Customer returned to `status=active`, `payment_status=paid`, `service_access_status=active`, `inactive_reason=null`, `cancellation_source=null`.
- Local subscription returned to `status=active`, `pause_started_at=null`, `pause_resumes_at=null`, `pause_reason=null`.
- Audit event `subscription_resumed` was stored with the admin reason and Stripe subscription id.
- `/api/display/QRWXVA/playlist` returned HTTP 200 with one playlist item.
- Visible `/display/QRWXVA` rendered one playing muted video, readyState `4`, at `1280x720`.

Result:
- Pause/resume lifecycle passed.
- Display entitlement correctly blocks during pause and restores after resume.
- Future automated admin tests should reuse an authenticated session instead of repeatedly calling `/api/auth/login`, because the login rate limiter is active.

### Scheduled Cancellation At Period End QA - 2026-07-15

Scenario tested:
- Active Premium 4K subscription is scheduled to cancel at period end, display access remains active during the paid-through/trial period, then the scheduled cancellation is undone.

Baseline:
- Customer `10000044` / `a0fe0b3d-d3f4-45a5-9316-1e0bc8588009`.
- Stripe subscription `sub_1TtHxgGhi0eDHRQZnv0vnynm`.
- Device `QRWXVA`.
- Before scheduling:
  - Customer `status=active`, `payment_status=paid`, `service_access_status=active`, no cancellation fields.
  - Local subscription `status=active`, `cancel_at_period_end=false`, `cancellation_effective_at=null`.
  - Stripe subscription `status=trialing`, `cancel_at_period_end=false`, `cancel_at=null`, `pause_collection=null`.
  - `/api/display/QRWXVA/playlist` returned HTTP 200 with one playlist item.

Schedule action:
- Called production admin subscription API with `action=cancel_period_end`.
- Reason: `QA scheduled cancellation test: verify paid-through access remains active until trial period end.`
- Result: HTTP 200 with `cancellationEffectiveAt=2026-08-05T01:50:10.000Z`.

Scheduled-state verification:
- Stripe subscription stayed `status=trialing`, set `cancel_at_period_end=true`, and set `cancel_at=1785894610`.
- Local subscription stayed `status=active`, set `cancel_at_period_end=true`, and set `cancellation_effective_at=2026-08-05T01:50:10+00:00`.
- Customer stayed `status=active`, `payment_status=paid`, and became `service_access_status=active_until_period_end` with `service_access_until=2026-08-05T01:50:10+00:00`.
- Audit event `subscription_cancel_scheduled` was stored with the admin reason and effective date.
- `/api/display/QRWXVA/playlist` still returned HTTP 200 with one playlist item.
- Visible `/display/QRWXVA` still played one muted video, readyState `4`.

Undo action:
- Called production admin subscription API with `action=resume_subscription`.
- Reason: `QA scheduled cancellation cleanup: undo period-end cancellation after verifying paid-through access.`
- Result: HTTP 200.

Restored-state verification:
- Stripe subscription returned to `status=trialing`, `cancel_at_period_end=false`, `cancel_at=null`, `pause_collection=null`.
- Customer returned to `status=active`, `payment_status=paid`, `service_access_status=active`, and cancellation fields cleared.
- Local subscription returned to `status=active`, `cancel_at_period_end=false`, `cancellation_effective_at=null`.
- Audit event `subscription_resumed` was stored with the cleanup reason.
- `/api/display/QRWXVA/playlist` returned HTTP 200 with one playlist item.
- Launch readiness stayed HTTP 200 with `53 passed`, `10 review`, `0 blocked`.

Result:
- Period-end cancellation lifecycle passed.
- Display entitlement remains active until the paid-through/trial end date and restores cleanly when the scheduled cancellation is undone.

### Failed Payment And Recovery QA - 2026-07-15

Scenario tested:
- Active Premium 4K subscription receives a Stripe failed-payment invoice event, display access is blocked, admin/audit evidence is created, then a paid invoice recovery restores access.

Baseline:
- Customer `10000044` / `a0fe0b3d-d3f4-45a5-9316-1e0bc8588009`.
- Stripe customer `cus_Ut43Oaq32pKmj7`.
- Stripe subscription `sub_1TtHxgGhi0eDHRQZnv0vnynm`.
- Device `QRWXVA`.
- Before failure:
  - Customer `status=active`, `payment_status=paid`, `service_access_status=active`.
  - Local subscription `status=active`, `stripe_payment_status=trialing`.
  - Stripe subscription `status=trialing`, no pause/cancellation flags.
  - `/api/display/QRWXVA/playlist` returned HTTP 200.

Failure action:
- Sent a signed synthetic Stripe test webhook to the local Screenia webhook route connected to the shared Supabase/Stripe test services.
- Production webhook endpoint rejected a stale local signing secret with HTTP 400, confirming signature protection; Vercel hides the current production webhook secret after pull, so the controlled behavior test used the same committed route locally.
- Accepted failed-payment event: `evt_qa_invoice_payment_failed_20260715141053`.
- Failed invoice id: `in_qa_payment_failed_fix_20260715141053`.

Failed-state verification:
- Customer became `status=suspended`, `payment_status=failed`, `service_access_status=payment_failed`, `inactive_reason=payment_failed`, `cancellation_source=stripe`.
- Local subscription became `status=payment_failed`, `stripe_payment_status=failed`, `fulfillment_status=payment_failed`, with total `34900` ore and VAT `6980` ore.
- Stripe subscription itself remained `status=trialing`, proving the test did not damage the real Stripe test subscription.
- Production `/api/display/QRWXVA/playlist` returned HTTP 403 with `Display is not active.`
- Visible `https://screenia.se/display/QRWXVA` showed `Display inactive`, no video element.
- Audit event `payment_failed` was stored.
- Urgent admin notification `Payment failed` was stored.

Issue found and fixed:
- Recovery initially restored payment/access correctly, but set local `fulfillment_status` to generic `active`, losing the previous layout-work progress label.
- Fixed `src/app/api/stripe/webhook/route.ts` so `invoice.paid` recovery derives the fulfillment status from customer journey fields such as `production_status`, `layout_started_at`, `preview_status`, and `content_collected_at`.

Recovery action:
- Sent a signed paid-invoice recovery event after the fix.
- Accepted recovery event: `evt_qa_invoice_paid_20260715141054`.
- Recovery invoice id: `in_qa_payment_recovered_fix_20260715141054`.

Restored-state verification:
- Customer returned to `status=active`, `payment_status=paid`, `service_access_status=active`; failure fields were cleared.
- Local subscription returned to `status=active`, `stripe_payment_status=trialing`, `fulfillment_status=layout_started`, total `279700` ore, VAT `55940` ore.
- Stripe subscription stayed `status=trialing`, no pause/cancellation flags.
- Production `/api/display/QRWXVA/playlist` returned HTTP 200 with one playlist item.
- Visible `https://screenia.se/display/QRWXVA` rendered one muted playing video, readyState `4`, video size `1280x720`.
- Audit event `subscription_invoice_paid` was stored for recovery.

Result:
- Failed-payment lifecycle passed after the fulfillment recovery fix.
- Display entitlement blocks on failed payment and restores after payment recovery.
- Production deployment `dpl_CzYPFEbnZ5VEX1yRWuj5ytKh7WLZ` was aliased to `https://screenia.se` after the fix.
- Post-deploy smoke checks passed: `/api/display/QRWXVA/playlist` returned HTTP 200, `/login` returned HTTP 200, unsigned Stripe webhook POST returned HTTP 400 `Missing signature`, visible `/display/QRWXVA` played one muted video, and launch readiness stayed 53 pass / 10 warning / 0 fail.

### Temporary Discount Lifecycle QA - 2026-07-15

Scenario tested:
- Admin applies a short temporary discount to an active Premium 4K subscription, Stripe/local/audit evidence is created, then admin removes it and the subscription returns to a clean no-discount state.

Baseline:
- Customer `10000044` / `a0fe0b3d-d3f4-45a5-9316-1e0bc8588009`.
- Stripe subscription `sub_1TtHxgGhi0eDHRQZnv0vnynm`.
- Before applying the discount:
  - Stripe subscription `status=trialing`.
  - Stripe subscription had no active discounts.
  - `subscription_adjustments` had no active adjustment for this subscription, only older inactive QA records.
  - Production `/api/display/QRWXVA/playlist` returned HTTP 200.

Apply action:
- Called production admin subscription API with `action=apply_temporary_discount`.
- Discount: `15%` for `2` months.
- Reason: `QA temporary discount lifecycle test: apply 15 percent for two months.`
- Result: HTTP 200 with Stripe coupon id `IrF6uzVo`.

Applied-state verification:
- Stripe subscription stayed `status=trialing`.
- Stripe subscription had one discount after apply.
- Local `subscription_adjustments` row `55f6a5e4-d47d-419a-855d-2ae7de792ad8` became `active`, with `percent_off=15`, `duration_months=2`, `stripe_coupon_id=IrF6uzVo`.
- Audit event `subscription_discount_applied` was stored with coupon `IrF6uzVo`.
- Production display playlist stayed HTTP 200.

Remove action:
- Called production admin subscription API with `action=remove_temporary_discount`.
- Reason: `QA temporary discount lifecycle cleanup: remove test discount.`
- Result: HTTP 200.

Removed-state verification:
- Stripe subscription returned to zero active discounts.
- Local adjustment `55f6a5e4-d47d-419a-855d-2ae7de792ad8` became `inactive`.
- Audit event `subscription_discount_removed` was stored with removed coupon `IrF6uzVo`.
- Production display playlist stayed HTTP 200.
- Visible admin login and customer page loaded successfully after the test; customer stayed active.

Result:
- Temporary discount apply/remove lifecycle passed.
- Note for final cleanup: older inactive QA discount rows and old test Stripe coupons remain as historical test evidence. They are harmless for live subscription state, but should be cleaned or archived before a final production data reset if we want a pristine database/Stripe test account.

### Refund Boundary QA - 2026-07-15

Scenario tested:
- Admin refund behavior before and after layout work starts.

Locked-layout negative test:
- Customer `10000044` / `a0fe0b3d-d3f4-45a5-9316-1e0bc8588009` already has `layout_started_at` and `setup_fee_locked_at`.
- Called production admin refund API with reason: `QA refund boundary test: layout already started, automatic refund must be blocked.`
- Result: HTTP 409.
- Error shown by API: `The setup fee is locked because layout work has started. Handle this refund manually if an exception is approved.`
- Result: passed. Automatic refund is blocked after layout work starts.

Refund-before-layout positive test:
- Created a throwaway Premium 4K paid test customer with no `layout_started_at` or `setup_fee_locked_at`.
- Customer `10000048` / `5b34b942-82b1-4b0b-a4c2-a3e01d33a302`.
- Order `1000000048`.
- Stripe customer `cus_UtGDjqrzrr7CkA`.
- Stripe payment intent `pi_3TtTh7Ghi0eDHRQZ0hHLCP9l`.
- Stripe subscription `sub_1TtTh8Ghi0eDHRQZiTaxoYtd`.
- First payment amount: `279700` ore / `2 797 kr`; VAT: `55940` ore / `559,40 kr`.

Positive refund action:
- Called production admin refund API with reason: `QA refund-before-layout positive test: refund first payment before layout work starts.`
- Result: HTTP 200.
- Stripe refund `re_3TtTh7Ghi0eDHRQZ0A7rF7NW` succeeded for `279700` ore.
- Stripe subscription cancellation status returned `canceled`.

Positive refund verification:
- Customer became `status=suspended`, `payment_status=refunded`, `service_access_status=refunded`, `inactive_reason=refunded_before_production`, `cancellation_source=admin`.
- Local subscription became `status=refunded`, `stripe_payment_status=refunded`, `fulfillment_status=cancelled`.
- Stripe subscription `sub_1TtTh8Ghi0eDHRQZiTaxoYtd` is `canceled`.
- Admin audit/notification evidence was created for the refund.

Issue found and fixed:
- Stripe emitted multiple refund-related webhook events for the same refund id, creating duplicate `payment_refunded_externally` audit/notification rows.
- Fixed `src/app/api/stripe/webhook/route.ts` so Stripe refund webhook evidence is recorded once per customer/refund id.
- Verification: replayed `refund.updated` twice for refund `re_3TtTh7Ghi0eDHRQZ0A7rF7NW`; both returned HTTP 200 and the existing counts stayed at 2 audit / 2 notification rows, with no new duplicates added.

Result:
- Refund boundary lifecycle passed.
- Automatic refund is correctly blocked after layout work starts.
- Refund before layout correctly refunds Stripe, cancels the Stripe subscription, suspends/refunds local access, and records admin evidence.
- Production deployment `dpl_CFp597dXQr2M6Wy3taAqdeo5URo8` was aliased to `https://screenia.se` after the webhook de-duplication fix.
- Post-deploy smoke checks passed: `/api/display/QRWXVA/playlist` returned HTTP 200, `/login` returned HTTP 200, and unsigned Stripe webhook POST returned HTTP 400 `Missing signature`.

### Accounting And VAT Export QA - 2026-07-15

Scenario tested:
- Admin accounting CSV and VAT summary exports for paid/refunded Premium 4K test data.

Initial production result:
- `GET /api/admin/accounting-export` returned HTTP 500 with `Could not create accounting export.`
- Root cause: accounting export still selected old `discount_percent` / `discount_months` columns, while the current schema uses `device_discount_percent` / `device_discount_months`.
- `GET /api/admin/vat-summary?from=2026-07-01T00:00:00.000Z&to=2026-08-01T00:00:00.000Z` returned HTTP 200 but zero rows.
- Root cause: VAT summary filtered to `stripe_payment_status in ["paid", "succeeded"]`, but the active setup payment row can later sync to `stripe_payment_status=trialing` because the subscription is in its free-trial period.

Fixes completed:
- Fixed `src/app/api/admin/accounting-export/route.ts` to use `device_discount_percent` and `device_discount_months`.
- Fixed `src/app/api/admin/vat-summary/route.ts` to include active/paid rows with `tax_status=complete`, so paid setup orders remain reportable during the free-trial period.
- Updated launch-readiness scanners to expect the new VAT rule.

Local verification:
- `GET http://localhost:3000/api/admin/accounting-export` returned HTTP 200.
- Accounting export row count: 5.
- Accounting export included active order `1000000036` / customer `10000044` with `total_amount_ore=279700`, `vat_amount_ore=55940`, `tax_behavior=inclusive`.
- Accounting export included refunded order `1000000048` / customer `10000048` with `customer_payment_status=refunded`, `service_access_status=refunded`, `order_status=refunded`, `payment_status=refunded`, `total_amount_ore=279700`, `vat_amount_ore=55940`.
- `GET http://localhost:3000/api/admin/vat-summary?from=2026-07-01T00:00:00.000Z&to=2026-08-01T00:00:00.000Z` returned HTTP 200.
- VAT summary row count: 1.
- VAT summary totals: gross `279700` ore / `2797.00` SEK, VAT `55940` ore / `559.40` SEK, net `223760` ore / `2237.60` SEK.
- Visible production `/admin/orders` page shows both export controls: `Export accounting CSV` and `Export VAT summary`.

Result:
- Accounting/VAT export lifecycle passed locally after fixes.
- Production deployment `dpl_HQpYeMKN9XU9cRGJo8qPn43pJNwu` was aliased to `https://screenia.se` after the accounting/VAT export fixes.
- Production `GET /api/admin/accounting-export` returned HTTP 200 CSV with 5 rows, including active order `1000000036` and refunded order `1000000048`.
- Production `GET /api/admin/vat-summary?from=2026-07-01T00:00:00.000Z&to=2026-08-01T00:00:00.000Z` returned HTTP 200 with gross `279700` ore / VAT `55940` ore / net `223760` ore.
- Production launch readiness remained 53 pass / 10 warning / 0 fail.

### Dispute And Chargeback Lifecycle QA - 2026-07-15

Scenario tested:
- Stripe dispute/chargeback access control and recovery for the active Premium 4K customer.

Customer and payment under test:
- Customer `10000044` / `a0fe0b3d-d3f4-45a5-9316-1e0bc8588009`.
- Stripe customer `cus_Ut43Oaq32pKmj7`.
- Stripe subscription `sub_1TtHxgGhi0eDHRQZnv0vnynm`.
- Stripe charge `ch_3TtHxeGhi0eDHRQZ0lvBL0fo`.
- Payment intent `pi_3TtHxeGhi0eDHRQZ0BZTvQS4`.
- Display device `QRWXVA`.

Dispute-open verification:
- Replayed a signed local Stripe `charge.dispute.created` event for the active customer.
- Webhook returned HTTP 200.
- Customer became `status=suspended`, `payment_status=disputed`, `service_access_status=payment_disputed`, `inactive_reason=payment_disputed`, `cancellation_source=stripe`.
- Local subscription became `status=disputed`, `stripe_payment_status=disputed`, `fulfillment_status=payment_failed`.
- Production display playlist returned HTTP 403 and the visible display page showed inactive behavior.
- Audit/notification evidence included `payment_disputed`.

Issues found and fixed:
- Financial-event subscription updates could miss the active local subscription row when `stripe_payment_intent_id` was empty, even though `stripe_customer_id` was present.
- Won-dispute recovery could restore payment/subscription state but leave the customer row suspended if a prior partial recovery had already cleared `inactive_reason`.
- Fixed `src/app/api/stripe/webhook/route.ts` so dispute/refund financial updates match by Stripe customer id or payment intent, and won-dispute recovery explicitly restores the customer access row from the current Stripe subscription entitlement.
- Fixed won-dispute recovery so it no longer depends on `inactive_reason=payment_disputed` being present.

Won-dispute recovery verification:
- Replayed signed local Stripe `charge.dispute.closed` events with `status=won`.
- Final accepted event: `evt_qa_dispute_restore_skipfix_20260715144756`.
- Webhook returned HTTP 200.
- Customer recovered to `status=active`, `payment_status=paid`, `service_access_status=active`, `inactive_reason=null`, `cancellation_source=null`.
- Local subscription recovered to `status=active`, `stripe_payment_status=trialing`, `fulfillment_status=layout_started`.
- Production `/api/display/QRWXVA/playlist` returned HTTP 200.
- Visible production `/display/QRWXVA` rendered a playing muted video with `readyState=4`.

Result:
- Dispute open and won-dispute recovery passed locally after fixes.
- Production deployment `dpl_AL3AHsKEM5FrH2gg9XbqjGynLaJJ` was aliased to `https://screenia.se` after the dispute recovery fix.
- Post-deploy smoke checks passed: `/login` returned HTTP 200, `/api/display/QRWXVA/playlist` returned HTTP 200, unsigned Stripe webhook POST returned HTTP 400 `Missing signature`, admin launch readiness returned HTTP 200 with `53 pass`, `10 warning`, `0 fail`, accounting export returned HTTP 200 CSV, and VAT summary returned HTTP 200 with gross `2797.00` SEK / VAT `559.40` SEK.
- Visible production `/display/QRWXVA` still rendered a playing muted video after deployment with `readyState=4`.

### Stripe Pricing Configuration Cleanup QA - 2026-07-15

Scenario tested:
- Stripe test-mode product/price cleanliness and Premium 4K checkout line-item correctness after the customer-facing pricing model was finalized.

Cleanup completed:
- Created dedicated setup-fee products:
  - `Screenia Standard FHD setup and configuration` / product `prod_UtGmEczHwcMBIY` / price `price_1TtUEVGhi0eDHRQZc2KtT7EN`.
  - `Screenia Premium 4K setup and configuration` / product `prod_UtGmfAcdTnwUoX` / price `price_1TtUEWGhi0eDHRQZUq8olf0U`.
- Updated Supabase `pricing_plans` so Standard and Premium setup fees reference those new setup prices.
- Restored the Standard and Premium monthly subscription products to use their recurring monthly prices as default prices.
- Archived 7 old active unreferenced Stripe prices plus the 2 old setup prices that were attached to monthly products.
- Wrote system audit events `stripe_pricing_configuration_cleanup` and `stripe_product_default_price_cleanup`.

Verification:
- Stripe now has exactly 8 active prices for the two live plans.
- Every active Stripe price is referenced by Supabase `pricing_plans`.
- All active Stripe prices use `tax_behavior=inclusive`.
- Premium 4K dry-run Checkout session `cs_test_b1m7fhoxFMtHoW9t0YHo3nJJo0chQ5aPcUajLzGLVAziznqCWDXak4I3oE` was created and immediately expired without payment.
- Dry-run line items:
  - `Screenia Premium 4K setup and configuration`: `159900` ore.
  - `Screenia Premium 4K screen device`: `109900` ore.
  - `Screenia Premium 4K shipping`: `9900` ore.
  - `Screenia Premium 4K monthly subscription`: `0` ore during the 21-day trial.
- Dry-run first payment total was `279700` ore / `2 797 kr`, matching setup + device + shipping.

Result:
- Stripe test-mode pricing is clean for the active Standard FHD and Premium 4K plans.
- Checkout line-item names now match the business model and should be clearer for customers.

### Stripe Branding And Static Checkout Route QA - 2026-07-15

Scenario tested:
- Stripe-hosted customer payment surfaces and the app checkout route after Stripe catalogue cleanup.

Branding/configuration completed:
- Updated Stripe test dashboard account name from `New business sandbox` to `Screenia` in the Stripe Dashboard.
- Set Stripe branding colors to primary `#0b4dff` and secondary `#071e49`.
- Updated the default billing portal configuration:
  - headline: `Hantera ditt Screenia-abonnemang`
  - privacy policy: `https://screenia.se/privacy`
  - terms: `https://screenia.se/terms`
- Logo/icon upload remains a manual Stripe dashboard polish item because the Stripe API cannot update this account's own branding files with the current secret key.

Route fix completed:
- Updated `src/app/api/stripe/checkout/route.ts` so normal Standard FHD and Premium 4K checkout sessions use the Supabase-referenced Stripe price IDs instead of creating dynamic `price_data` products/prices on every checkout.
- Dynamic `price_data` remains as a fallback for custom quoted amounts, such as discounted hardware.
- The route still requires Swedish shipping address collection and required billing address collection when Stripe automatic tax is enabled.

Verification:
- `npm.cmd run text:check`, `npm.cmd run lint`, and `npm.cmd run build` passed.
- Disposable local checkout-route test customer `93f0ef4e-59f4-4d18-a177-2bc1a4ae27c5` created session `cs_test_b1MtsxqnUs1WmwDzMDtZjw4P6QycfL2yrLK7RaugtKw2vw3JehyRmawpV3`, which was expired without payment and the local disposable records were marked cancelled.
- Route-created line items used the expected static prices:
  - setup `price_1TtUEWGhi0eDHRQZUq8olf0U`
  - device `price_1TpytlGhi0eDHRQZ0B8iJOZd`
  - shipping `price_1TpyT9Ghi0eDHRQZ3mV5Pu0c`
  - monthly `price_1TpyTAGhi0eDHRQZ9hccVL3r`
- No new active Stripe prices were created by the route test.
- Stripe verification after the test: exactly 8 active prices, zero unreferenced active prices, account display name `Screenia`, and customer portal policy URLs set.

Result:
- Stripe-hosted Checkout branding no longer shows `New business sandbox`.
- The app checkout route should no longer clutter Stripe test mode with new active product/price objects for standard checkouts.
- Production deployment `dpl_BSr9N6ME8Dvq1g3scJvEexVRafSo` was aliased to `https://screenia.se` after the static checkout route fix.
- Post-deploy smoke checks passed: `/login` HTTP 200, `/api/display/QRWXVA/playlist` HTTP 200, unsigned Stripe webhook HTTP 400 `Missing signature`, launch readiness HTTP 200 with `53 pass`, `10 warning`, `0 fail`, pricing API returned the expected 8 Stripe price IDs across Standard/Premium, accounting export HTTP 200, and VAT summary HTTP 200.

### Production Password Reset And Export Smoke QA - 2026-07-15

Scenario tested:
- Final production smoke check after Stripe static checkout cleanup, focusing on customer password-reset email delivery and admin accounting/VAT evidence exports.

Verification:
- Live `/login` loaded visually at `https://screenia.se/login` with Screenia branding, no visible error alerts, and the expected login, Google-coming-soon, password-reset, and home controls.
- Live `/display/QRWXVA` loaded visually at `https://screenia.se/display/QRWXVA` and rendered one video element with no visible error state.
- Supabase audit recorded `password_reset_email_requested` for `service@screenia.se` at `2026-07-15T15:31:16.857471+00:00`.
- Resend webhook audit recorded `email.sent` and `email.delivered` for Resend email `423246f2-223a-4ebc-8d96-14d2fb128eee` to `service@screenia.se`.
- `resend_delivery_events` stored the same `email.sent` and `email.delivered` events with subject `Reset Your Password`.
- Production `/api/admin/launch-readiness` returned HTTP 200 with `53 pass`, `10 warning`, `0 fail`.
- Production `/api/admin/accounting-export` returned HTTP 200 CSV with the expected accounting/VAT/order evidence columns.
- Production `/api/admin/vat-summary?format=csv` returned HTTP 200 CSV with the expected VAT summary columns.
- Unsigned production `/api/stripe/webhook` continued to reject requests with HTTP 400 `Missing signature`.

Result:
- Password reset email delivery through Supabase Auth SMTP/Resend is service-level verified.
- Manual remaining step: open the real reset email link and submit a compliant test password. Do not set `SCREENIA_SUPABASE_AUTH_EMAIL_VERIFIED=true` until that final password-change and `/account` login are confirmed.

### Public Premium Request And Cleanup QA - 2026-07-15

Scenario tested:
- A visitor selects the Premium 4K package on the production landing page, submits a request, admin sees the request, the customer receives confirmation email, and the unpaid dummy request is safely removed afterward.

Visual customer-side result:
- `https://screenia.se/` loaded with package cards showing customer-facing inclusive prices.
- Clicking `Välj Premium` opened the `Starta med Premium 4K` request dialog.
- The dialog collected company name, email, contact person, phone, screen quantity, message, and privacy-policy consent.
- Submitted dummy request `Screenia Public Request QA 20260715154349 AB` with email `service@screenia.se`.
- The page showed the Swedish success message: `Tack. Din förfrågan är mottagen och Screenia återkommer med en personlig startguide.`

Database, admin, audit, and email result:
- Supabase created customer `10000052` / `9e6f51df-8c27-4782-94ad-24e6b763b9dc` with status `new_request`, service access `inactive`, and no payment/Stripe IDs.
- Saved request metadata included `planCode=premium_4k`, `planResolution=4K`, `screenQuantity=1`, and privacy version `2026-07-12-prelaunch`.
- Admin notification `New customer request` was created for the dummy customer.
- Audit events included `landing_purchase_request_created`, `request_confirmation_email_sent`, and trigger-level `customers_insert`.
- Resend delivered confirmation email `d4c4a3c2-069b-4ac4-8d55-30ea3f6fb3c3` to `service@screenia.se` from `Screenia <service@screenia.se>` with subject `Screenia har tagit emot din förfrågan`.
- The production admin customer list visually showed the new request under `Requests (1)` with customer number `10000052`.

Cleanup:
- Because the dummy customer had no payment or Stripe history, production admin DELETE safely removed the customer with reason `QA cleanup after verified public Premium request flow on 2026-07-15.`
- Delete response was HTTP 200 / `{ "success": true }`.
- The customer record no longer exists.
- Deletion evidence remains in audit as `customer_deleted` and `customers_delete`, with customer references detached for traceability.
- Post-cleanup footprint returned to 6 customers: 1 active paid, 3 refunded, 2 cancelled; no remaining `Screenia Public Request QA 20260715154349` customer.

### Premium Onboarding, Stripe Payment, Account Email, And Refund Cleanup QA - 2026-07-15

Scenario tested:
- Full production Premium 4K flow from request creation through admin quote/onboarding, customer profile/legal details, Stripe test checkout, payment success, account-access email evidence, and cleanup refund before layout work started.

Flow evidence:
- Created dummy request `Screenia Onboarding QA 20260715154834 AB`, customer `10000053` / `3ac0fe17-5f33-48b7-936d-cf2a7f4cc9a3`.
- Admin prepare-onboarding created order `1000000041` / `58e440a7-c1e6-4d59-b882-bf8ace5803de` and onboarding URL `https://screenia.se/onboarding/b0492224-3f2d-4740-abc0-1a9ed6d18002`.
- Quote email was delivered through Resend email `21e1f09c-bfed-4c9b-b124-08a5c56bf0d1` to `service@screenia.se` from `Screenia <service@screenia.se>` with subject `Din Screenia-offert 1000000041`.
- Customer onboarding page loaded visually with the correct customer/company context.
- Customer profile/legal form accepted valid Swedish organisation number `556016-0680`, delivery address, billing email, terms consent, and privacy consent, then advanced to the payment step.
- Stripe Checkout session `cs_test_b1OefeYtW9YKV0yp1EEWpSXKuPCsA8py9RegRf4OcCtkV0B5ihXL4JhlAQ` displayed:
  - Premium 4K setup `1 599 kr`
  - Premium 4K device `1 099 kr`
  - Premium 4K shipping `99 kr`
  - Premium 4K monthly subscription `349 kr/månad efter 21 dagar gratis`
  - Total due today `2 797 kr`
  - Included VAT `559,40 kr`
- Stripe API confirmed automatic tax `enabled=true`, `status=complete`, `amount_total=279700`, and `amount_tax=55940`.
- Stripe test payment succeeded and redirected to `/onboarding/payment-success?customer_id=3ac0fe17-5f33-48b7-936d-cf2a7f4cc9a3`.
- App state after payment: customer `status=paid`, `payment_status=paid`, `service_access_status=active`; order `status=paid`, `stripe_payment_status=paid`, `tax_status=complete`, `fulfillment_status=content_collection`, `inventory_status=ready_to_reserve`.
- Stripe subscription `sub_1TtV6mGhi0eDHRQZzvNyuMEC` entered `trialing` with paid period ending `2026-08-05T15:52:26+00:00`.

Issue found and fixed:
- Existing-user payment scenario updated Supabase Auth `user_metadata.customer_id`, but the paid customer did not get `auth_user_id` because `customers.auth_user_id` is unique and `service@screenia.se` was already linked to the earlier active QA customer.
- The payment success page told the customer they would receive an account/password email, but no new account email was sent for the existing-user case.
- Fixed `src/app/api/stripe/webhook/route.ts` so `ensureCustomerAuthUser` finds an existing Supabase Auth user before inviting, updates customer metadata, requests a Supabase password setup/reset email, and audits `customer_password_setup_email_requested` or failure.
- The fix also avoids false error logging for the expected `customers_auth_user_id_key` unique constraint when account routing is handled by metadata for an existing user.
- Local verification passed: `npm.cmd run lint`, `npm.cmd run text:check`, and `npm.cmd run build`.
- Production deployment `dpl_7s1hiGdiSk6LAad3DpBNoXYFzjh4` was aliased to `https://screenia.se`.

Account email proof:
- Backfilled the paid QA customer with the fixed account-access behavior.
- Supabase Auth password setup/reset email was requested for `service@screenia.se` and audited as `customer_password_setup_email_requested`.
- Resend delivered email `01bea64b-38f2-4b03-8cd4-a8460183db05` to `service@screenia.se` from `"Screenia" <service@screenia.se>` with subject `Reset Your Password`.
- Manual remaining step: open the real email link and submit a compliant password. The final password-change form was not submitted by Codex.

Cleanup:
- Refunded the temporary paid QA customer before layout work started through the production admin refund endpoint.
- Refund response was HTTP 200 with refund `re_3TtV6lGhi0eDHRQZ1WlMpAUu`, amount `279700`, status `succeeded`, and Stripe subscription cancellation status `canceled`.
- Stripe charge `ch_3TtV6lGhi0eDHRQZ1819dxPD` is fully refunded.
- Customer `10000053` is now `status=suspended`, `payment_status=refunded`, `service_access_status=refunded`, `inactive_reason=refunded_before_production`, `cancellation_source=admin`.
- Order `1000000041` is now `status=refunded`, `stripe_payment_status=refunded`, `fulfillment_status=cancelled`, with VAT evidence retained.

Post-deploy smoke:
- `/login` returned HTTP 200.
- `/api/display/QRWXVA/playlist` returned HTTP 200.
- Unsigned `/api/stripe/webhook` returned HTTP 400 `Missing signature`.
- Launch readiness remained `53 pass`, `10 warning`, `0 fail`.

### Customer Portal, Admin Visibility, And Display Entitlement Regression QA - 2026-07-15

Scenario tested:
- Active Premium 4K customer `10000044` / `a0fe0b3d-d3f4-45a5-9316-1e0bc8588009` uses the production customer portal after payment, then admin verifies submitted support/content/material records and display playback.

Customer portal result:
- Restored the QA auth metadata for `service@screenia.se` to active customer `10000044` and set the temporary test password `ScreeniaCustomer123` for this controlled portal pass.
- Visual login from `https://screenia.se/login` succeeded and showed the correct active Premium 4K customer account.
- Portal sections loaded correctly: overview, content setup, display material, support cases, billing, and legal/data export.
- Customer support ticket submission returned HTTP 200 with ticket `IS-260715-084E99`.
- Customer display-material text submission returned HTTP 200 and created a new material record.
- Customer data export returned HTTP 200 with no-store JSON download headers and file name `screenia-data-export-2026-07-15.json`.
- Stripe billing portal creation returned HTTP 200 with a Stripe billing portal URL.
- Corrected content setup submission with full required business details returned HTTP 200.
- Consent update retest used the correct `PATCH /api/account/consents` method and returned HTTP 200; marketing and analytics consent were set to false while remote support stayed true.

Admin-side result:
- Visual admin login with `admin@screenia.se` / `Screenia12345` succeeded.
- Admin customer communication page showed the latest support ticket with request type, priority, timestamp, status controls, internal note field, and customer reply field.
- Admin uploaded-media tab showed three text material records, including the corrected content setup notes from this pass.
- Admin device media page for `QRWXVA` showed the assigned Premium 4K device, one playlist item, and audited upload/remove controls.

Issue found and fixed:
- Retesting `https://screenia.se/display/QRWXVA` initially showed `Display inactive`.
- Root cause: `POST /api/account/content-setup` updates `customers.status` to `content_received`; the display entitlement helper required `customers.status === "active"` even though `payment_status=paid` and `service_access_status=active`.
- Fixed `src/lib/server/subscription-entitlements.ts` so display access is blocked by explicit inactive/refunded/cancelled/suspended/deleted customer states, while workflow statuses such as `content_received` no longer disable a paid active display.
- Local checks passed: `npm.cmd run lint`, `npm.cmd run text:check`, and `npm.cmd run build`.
- Production deployment `dpl_3QF4CJEXaDpKcd4dDmyGSaxuAqpm` was aliased to `https://screenia.se`.

Retest:
- Production `GET /api/display/QRWXVA/playlist` returned HTTP 200 with signed playlist item `4b0e1b0e-4a95-4717-80b4-86e074e87432`.
- Visible `https://screenia.se/display/QRWXVA` rendered one muted playing video at 1280x720 with `readyState=4`.
- Production launch readiness remained `53 pass`, `10 warning`, `0 fail`.

Remaining:
- This pass still used a temporary Supabase Admin-set customer password. The final real email-link password setup remains a manual launch gate before setting `SCREENIA_SUPABASE_AUTH_EMAIL_VERIFIED=true`.

### Password Reset And Login Surface Boundary QA - 2026-07-15

Scenario tested:
- Production customer login password-reset request and account-boundary behavior for customer/admin identities.

Visual customer result:
- Opened `https://screenia.se/login` in the in-app browser.
- Entered `service@screenia.se`; `Glömt lösenord?` became enabled.
- Clicking `Glömt lösenord?` showed the generic customer-safe message: `Om e-postadressen finns hos Screenia skickar vi en återställningslänk.`
- No final password-change form was submitted by Codex.

API and audit result:
- `POST /api/auth/password-reset` with invalid email returned HTTP 200 and the same generic message, so the route does not reveal whether an account exists.
- `POST /api/auth/password-reset` for `service@screenia.se` returned HTTP 200 and created audit event `password_reset_email_requested` at `2026-07-15T16:24:28.973151+00:00` with `error=null`.
- Supabase Auth user `service@screenia.se` was updated at `2026-07-15T16:24:28.786072Z`, matching the reset request.

Issue found and fixed:
- Before this pass, an admin could post valid admin credentials to the customer login endpoint and receive `{ success: true, next: "/admin" }`.
- Fixed `src/app/api/auth/login/route.ts` so admin accounts must use the admin login surface. Customer-mode login now signs out the admin session, records `admin_login_wrong_surface`, and returns the generic login error.
- Local checks passed: `npm.cmd run lint`, `npm.cmd run text:check`, and `npm.cmd run build`.
- Production deployment `dpl_e1J67wHxnRucFsnNg85tXnJk4pjT` was aliased to `https://screenia.se`.

Retest:
- Admin credentials on customer mode returned HTTP 401 with generic error and audit `admin_login_wrong_surface`.
- Admin credentials on admin mode returned HTTP 200 with `next=/admin` and audit `admin_login_success`.
- Customer credentials on admin mode returned HTTP 401 with generic error and audit `admin_login_denied`.
- Wrong customer password returned HTTP 401 with generic error and audit `login_failed`.
- Display smoke after deployment still passed: `/api/display/QRWXVA/playlist` returned HTTP 200 with a signed Supabase playlist URL.
- Production launch readiness remained `53 pass`, `10 warning`, `0 fail`.

Remaining:
- Supabase Auth reset/setup email request is now verified at API/audit level. The final manual mailbox step is still opening the real email link and submitting a compliant password, then marking `SCREENIA_SUPABASE_AUTH_EMAIL_VERIFIED=true` only after that full customer login proof.

### Admin Support Reply, Customer Portal History, And Email Delivery QA - 2026-07-15

Scenario tested:
- Admin sends a customer-visible support reply for the active Premium 4K customer, the customer can see the reply in the portal, the email is sent/delivered, and admin/audit evidence is stored.

Flow evidence:
- Customer: `10000044` / `a0fe0b3d-d3f4-45a5-9316-1e0bc8588009`.
- Original support ticket: `IS-260715-084E99`, message `e8c626e9-38f1-41a9-a653-6c263c9f6866`.
- Admin reply API returned HTTP 200 with `success=true`, `emailSent=true`, and `warning=null`.
- Reply message created: `13a69cbf-1fe2-4fef-bf98-28b6f8cf30d1`, subject `[IS-260715-084E99] Reply from Screenia`, status `waiting_for_customer`.
- Original ticket status also changed from `new` to `waiting_for_customer`.

Email and audit result:
- Audit `customer_support_reply_sent` was stored at `2026-07-15T16:31:46.621405+00:00`.
- Audit `customer_support_reply_email_sent` was stored at `2026-07-15T16:31:46.857299+00:00`.
- Email was sent to `service@screenia.se` with Resend email id `489cb91d-ffc0-4f3c-8cd4-c9a29193a509`.
- Resend webhook ledger stored both `email.sent` and `email.delivered` for subject `[IS-260715-084E99] Reply from Screenia`, from `Screenia <service@screenia.se>`.

Visual verification:
- Customer portal `https://screenia.se/account?section=messages` showed `[IS-260715-084E99] Reply from Screenia` and the reply body in the customer-visible history.
- Admin `Email Events` page showed `email.delivered`, recipient `service@screenia.se`, subject `[IS-260715-084E99] Reply from Screenia`, and Resend id `489cb91d-ffc0-4f3c-8cd4-c9a29193a509`.
- Admin customer communication page showed `Communication (7)`, `Conversations (4)`, the reply message, and the original ticket marked `waiting_for_customer`.

Post-test smoke:
- `/api/display/QRWXVA/playlist` returned HTTP 200 with a signed Supabase playlist URL.
- Production launch readiness remained `53 pass`, `10 warning`, `0 fail`.

### Admin VAT/Tax Payment Register QA - 2026-07-15

Scenario tested:
- Admin records a VAT/tax period, updates it to paid with reference evidence, verifies audit history, and confirms the admin API lists the record.

Create result:
- `POST /api/admin/tax-payments` returned HTTP 201.
- Created tax payment record `fd736f0c-68f4-4a95-bf59-620743731742`.
- Period: `2026-07-01` to `2026-08-01`.
- Currency: `sek`.
- Taxable amount: `223760` ore.
- VAT amount: `55940` ore.
- Initial status: `draft`.
- Initial notes: `QA VAT register test for Screenia production test mode. Values mirror one Premium 4K test payment net/VAT evidence.`
- Audit `admin_tax_payment_recorded` was stored at `2026-07-15T16:43:53.548405+00:00` with the admin reason and amount/period metadata.

Update result:
- `PATCH /api/admin/tax-payments/fd736f0c-68f4-4a95-bf59-620743731742` returned HTTP 200.
- Status changed to `paid`.
- Paid at: `2026-07-15T16:45:00+00:00`.
- Reference: `QA-VAT-202607-SCREENIA-TEST`.
- Notes changed to `QA VAT register test marked paid after validating required reference and audit trail.`
- Audit `admin_tax_payment_updated` was stored at `2026-07-15T16:43:54.475119+00:00` with changed fields, before/after values, and admin reason.

Admin visibility:
- Authenticated admin `GET /api/admin/tax-payments` returned HTTP 200 and listed the record with status `paid`, reference `QA-VAT-202607-SCREENIA-TEST`, taxable amount `223760`, and VAT amount `55940`.
- Browser navigation to `/admin/tax-payments` redirected to `/admin-login` when the visible tab had no admin session, which confirms the page is protected; the authenticated admin API list is the visibility proof for this pass.

Post-test smoke:
- `/api/display/QRWXVA/playlist` returned HTTP 200 with a signed Supabase playlist URL.
- Production launch readiness remained `53 pass`, `10 warning`, `0 fail`.

### Customer Privacy Request And Data Subject Register QA - 2026-07-15

Scenario tested:
- Customer submits a privacy/GDPR request from the account portal, the system creates the support ticket and data-subject request register entry, admin can see and update it, and audit evidence is stored.

Customer-side result:
- Submitted `POST /api/account/messages` as customer `10000044` with `requestType=privacy_request`, `priority=high`, and no files.
- Response returned HTTP 200 with ticket `IS-260715-430977`.
- Customer portal `https://screenia.se/account?section=messages` visibly showed `[IS-260715-430977] Privacy request QA 20260715163701`, type `Integritet eller personuppgifter`, priority `Hög`, date `15 juli 2026`, and status `Nytt`.

Register, audit, and notification result:
- Data-subject request register entry `bcc2729d-57a9-43d3-8d40-6291731528ad` was created for customer `10000044`.
- Source support message id: `2c8b8643-4577-4027-a10a-3d1f4e2af5ef`.
- Register status started as `received`; due date was `2026-08-14T16:37:02.805+00:00`, 30 days after request creation.
- Audit `customer_message_sent` and trigger-level `customer_messages_insert` were stored.
- Audit `data_subject_request_received` was stored at `2026-07-15T16:37:03.233875+00:00`, including request id, ticket number, message id, and due date.
- High-priority admin notification `New customer message` was stored with request type `privacy_request` and ticket `IS-260715-430977`.

Admin-side result:
- Authenticated admin `GET /api/admin/data-subject-requests` returned HTTP 200 and included the register entry with customer number `10000044`, customer email `service@screenia.se`, status `received`, and due date.
- Admin update `PATCH /api/admin/data-subject-requests/bcc2729d-57a9-43d3-8d40-6291731528ad` returned HTTP 200.
- Admin moved the request to `in_progress` with note `QA admin review started. Verify exported customer data and support history before closing this test request.`
- Audit `data_subject_request_updated` was stored at `2026-07-15T16:40:28.536395+00:00`, including changed fields, before/after values, and admin reason.

Post-test smoke:
- `/api/display/QRWXVA/playlist` returned HTTP 200 with a signed Supabase playlist URL.
- Production launch readiness remained `53 pass`, `10 warning`, `0 fail`.

### Backup Restore Drill And Admin Evidence QA - 2026-07-15

Scenario tested:
- Admin records backup coverage, updates the record to restore-tested, creates a needs-attention backup follow-up item, and verifies audit/notification evidence.

Create and update result:
- Initial authenticated admin `GET /api/admin/backup-drills` returned an empty register for this fresh pass.
- `POST /api/admin/backup-drills` returned HTTP 201 and created backup drill `cb59c489-43f8-4afa-9a9e-d5aea5df7549`.
- Evidence reference: `QA-BACKUP-20260715165004`.
- Initial status: `backup_verified`.
- `PATCH /api/admin/backup-drills/cb59c489-43f8-4afa-9a9e-d5aea5df7549` returned HTTP 200 and updated the drill to `restore_tested`.
- Restore tested at: `2026-07-15T16:50:06.270Z`.
- Audit `backup_restore_drill_recorded` was stored at `2026-07-15T16:50:06.223475+00:00`.
- Audit `backup_restore_drill_updated` was stored at `2026-07-15T16:50:06.891678+00:00` with changed fields, before/after values, and admin reason.

Needs-attention visibility result:
- `POST /api/admin/backup-drills` returned HTTP 201 and created needs-attention drill `160e1bd0-0c6e-4abf-aff0-384e61a5bf84`.
- Evidence reference: `QA-BACKUP-ATTENTION-20260715165004`.
- Audit `backup_restore_drill_recorded` was stored at `2026-07-15T16:50:07.410579+00:00`.
- Urgent admin notification `1190bc82-e1b3-4642-892b-9dd2dc27ba8d` was created with title `Backup/restore needs attention`.

Visual/admin verification:
- Browser login to `https://screenia.se/admin` succeeded with the QA admin account.
- Browser page `https://screenia.se/admin/backup-drills` showed both new records in the Backup restore register.
- The page badge showed `1 need evidence`, matching the deliberate needs-attention follow-up item.
- Authenticated admin list returned both new records.

Post-test smoke:
- `/api/display/QRWXVA/playlist` returned HTTP 200.
- Production launch readiness remained `53 pass`, `10 warning`, `0 fail`.

### Privacy Incident Register QA - 2026-07-15

Scenario tested:
- Admin records a simulated privacy/security incident, escalates investigation status, contains it, resolves it with notification timestamps, and verifies audit/notification evidence.

Lifecycle result:
- Initial authenticated admin `GET /api/admin/privacy-incidents` returned an empty register for this fresh pass.
- `POST /api/admin/privacy-incidents` returned HTTP 201 and created incident `60789a3e-a41b-4a06-9766-66b5866413a6`.
- Title: `QA privacy incident 20260715165529`.
- Severity: `high`.
- Initial status: `detected`.
- Authority notification required: `true`.
- Customer notification required: `true`.
- `PATCH /api/admin/privacy-incidents/60789a3e-a41b-4a06-9766-66b5866413a6` moved the incident to `investigating`.
- A second `PATCH` moved the incident to `contained` with containment notes.
- A final `PATCH` moved the incident to `resolved` with `authority_notified_at` and `customer_notified_at` set to `2026-07-15T16:55:32.664+00:00`.

Audit and notification result:
- Audit `privacy_incident_created` was stored at `2026-07-15T16:55:30.678233+00:00`.
- Audit `privacy_incident_updated` was stored for the `investigating`, `contained`, and `resolved` transitions, each with changed fields, before/after values, and admin reason.
- Urgent admin notification `872d0d8f-4408-40d3-9a50-0dfc0e83af23` was created for the high-severity incident.
- Urgent follow-up notifications `6bef6c0b-dda7-4ec7-ad94-e9202ee0f3cc` and `bdc415e3-a479-44df-8ef9-d9f50ca4f2de` were created while notification-required fields were still unresolved.
- No follow-up notification was created after final resolution with notification timestamps.

Visual/admin verification:
- Browser page `https://screenia.se/admin/privacy-incidents` showed the incident in the register.
- The row showed severity `high`, status `resolved`, detected timestamp `2026-07-15 18:55:30`, and `Authority: yes` / `Customer: yes`.
- Page badge showed `0 open`.
- Browser console had no errors for the page.

Post-test smoke:
- `/api/display/QRWXVA/playlist` returned HTTP 200.
- Production launch readiness remained `53 pass`, `10 warning`, `0 fail`.

### Data Retention Review QA - 2026-07-15

Scenario tested:
- Admin records a retention review for customer support/privacy-request records, verifies anonymization-review visibility, updates retention decision, completes the review, and confirms completed reviews no longer expose confusing action controls.

Lifecycle result:
- Initial authenticated admin `GET /api/admin/data-retention` returned an empty register for this fresh pass.
- `POST /api/admin/data-retention` returned HTTP 201 and created review `506a6b37-b306-4c7c-8d89-494afa07ec6e`.
- Record area: `support_messages`.
- Related customer id: `a0fe0b3d-d3f4-45a5-9316-1e0bc8588009`.
- Related record id: `IS-260715-430977`.
- Initial status: `pending_review`.
- Initial recommended action: `anonymize`.
- Retention until: `2026-12-31`.
- `PATCH /api/admin/data-retention/506a6b37-b306-4c7c-8d89-494afa07ec6e` updated the review to `retain` / `retain`.
- Final `PATCH` updated the review to `completed` / `review` and set `completed_at=2026-07-15T16:57:46.837+00:00`.

Audit and notification result:
- Audit `data_retention_review_recorded` was stored at `2026-07-15T16:57:45.186843+00:00`.
- Audit `data_retention_review_updated` was stored for both updates, with changed fields, before/after values, and admin reasons.
- High-priority admin notification `8a8f5218-2eef-4c8d-aeef-db2ba823d532` was created because the initial recommended action was `anonymize`.

Issue found and fixed:
- Completed rows still showed the `Retain`, `Anonymize`, and `Complete` controls, which made a closed review look editable.
- Fixed `src/app/admin/data-retention/page.tsx` so completed rows show a simple `Completed` label instead of action buttons.
- Local checks passed: `npm.cmd run lint`, `npm.cmd run text:check`, and `npm.cmd run build`.
- Production deployment `dpl_DjbeKayKLu871tzpkYXMjimkuD9J` was aliased to `https://screenia.se`.

Visual/admin verification:
- Browser page `https://screenia.se/admin/data-retention` showed the review with status `completed`, until date `2026-12-31`, and action `review`.
- After the production fix, the row controls showed only `Completed`.
- Browser console had no errors for the page.

Post-test smoke:
- `/api/display/QRWXVA/playlist` returned HTTP 200.
- `/login` returned HTTP 200.
- Unsigned `/api/stripe/webhook` returned HTTP 400 with `Missing signature`.
- Production launch readiness remained `53 pass`, `10 warning`, `0 fail`.

### Processor Compliance Review QA - 2026-07-15

Scenario tested:
- Admin records third-party processor evidence for a launch-critical provider, verifies incomplete-evidence admin visibility, approves the provider after DPA/security/account-owner evidence, and confirms the approved row is not presented as still needing action.

Lifecycle result:
- Initial authenticated admin `GET /api/admin/processor-reviews` returned an empty register for this fresh pass.
- `POST /api/admin/processor-reviews` returned HTTP 201 and created review `47b90289-4a97-45f1-b72b-ec70cec92819`.
- Provider: `Vercel`.
- Processing purpose: hosting the Screenia production application, serverless functions, logs, and deployment metadata for customer onboarding and admin operations.
- Evidence reference: `QA-PROCESSOR-VERCEL-20260715170524`.
- Initial status: `needs_review`.
- Initial evidence flags: DPA `false`, security `true`, account owner `false`.
- `PATCH /api/admin/processor-reviews/47b90289-4a97-45f1-b72b-ec70cec92819` approved the review with DPA/security/account-owner all `true`.
- Next review due: `2027-07-15`.

Audit and notification result:
- Audit `processor_compliance_review_recorded` was stored at `2026-07-15T17:05:26.394184+00:00`.
- Audit `processor_compliance_review_updated` was stored at `2026-07-15T17:05:27.467508+00:00` with changed fields, before/after values, and admin reason.
- High-priority admin notification `eebe9383-d1cb-4a23-be44-7de1735680ce` was created because the initial processor evidence was incomplete.

Issue found and fixed:
- Approved processor rows still showed `Approve`, `Needs review`, and `Disabled` controls, which made a fully verified provider look unfinished.
- Fixed `src/app/admin/processor-reviews/page.tsx` so fully approved rows show a simple `Approved` label instead of action buttons.
- Local checks passed: `npm.cmd run lint`, `npm.cmd run text:check`, and `npm.cmd run build`.
- Production deployment `dpl_CusYPT6dBbtvd2JqXxdu8LZcNGc9` was aliased to `https://screenia.se`.

Visual/admin verification:
- Browser page `https://screenia.se/admin/processor-reviews` showed the Vercel review as `approved`.
- The row showed `DPA: yes | Security: yes | Owner: yes`, evidence `QA-PROCESSOR-VERCEL-20260715170524`, next review `2027-07-15`, and a final `Approved` label.
- The page badge showed `0 need review`.
- Browser console had no errors for the page.

Post-test smoke:
- `/api/display/QRWXVA/playlist` returned HTTP 200.
- `/login` returned HTTP 200.
- Unsigned `/api/stripe/webhook` returned HTTP 400 with `Missing signature`.
- Production launch readiness remained `53 pass`, `10 warning`, `0 fail`.

### Admin Access Review QA - 2026-07-15

Scenario tested:
- Admin records admin-account access evidence, verifies missing MFA follow-up visibility, approves the admin account after MFA/access evidence, and confirms the approved row does not look unfinished.

Lifecycle result:
- Initial authenticated admin `GET /api/admin/access-reviews` returned an empty register for this fresh pass.
- `POST /api/admin/access-reviews` returned HTTP 201 and created review `45892266-6ed7-4dbe-b97a-00e26ff62476`.
- Admin email: `admin@screenia.se`.
- Auth user id: `d3078ba0-133c-4146-b0de-ab62a1c6f310`.
- Initial status: `needs_review`.
- Initial MFA evidence: `false`.
- Access confirmed: `true`.
- `PATCH /api/admin/access-reviews/45892266-6ed7-4dbe-b97a-00e26ff62476` approved the review with MFA and access both `true`.
- Reviewed at: `2026-07-15T17:12:27.91+00:00`.

Audit and notification result:
- Audit `admin_access_review_recorded` was stored at `2026-07-15T17:12:27.132302+00:00`.
- Audit `admin_access_review_updated` was stored at `2026-07-15T17:12:28.828932+00:00` with changed fields, before/after values, reviewed-by id, and admin reason.
- High-priority admin notification `c2edd6ec-0c3a-48cd-8663-afaf55f52983` was created because MFA evidence was initially missing.

Issue found and fixed:
- Approved admin access review rows still showed `Approve`, `Needs review`, and `Removed` controls, which made a verified admin account look unfinished.
- Fixed `src/app/admin/access-reviews/page.tsx` so fully approved rows show a simple `Approved` label instead of action buttons.
- Local checks passed: `npm.cmd run lint`, `npm.cmd run text:check`, and `npm.cmd run build`.
- Production deployment `dpl_13HxtyitzkGBfRrZ1gkfbJEFvY41` was aliased to `https://screenia.se`.

Visual/admin verification:
- Browser page `https://screenia.se/admin/access-reviews` showed the admin access review as `approved`.
- The row showed MFA `verified`, access `required`, reviewed timestamp `2026-07-15 19:12:27`, and a final `Approved` label.
- The page badge showed `0 need review`.
- Browser console had no errors for the page.

Post-test smoke:
- `/api/display/QRWXVA/playlist` returned HTTP 200.
- `/login` returned HTTP 200.
- Unsigned `/api/stripe/webhook` returned HTTP 400 with `Missing signature`.
- Production launch readiness remained `53 pass`, `10 warning`, `0 fail`.

### Legal Change Notice QA - 2026-07-15

Scenario tested:
- Admin records a legal/policy change, marks customer notice and re-acceptance as required, approves the change, marks the notice as sent with evidence, and verifies the admin page shows the finished notice cleanly.

Lifecycle result:
- Initial authenticated admin `GET /api/admin/legal-change-notices` returned an empty register for this fresh pass.
- `POST /api/admin/legal-change-notices` returned HTTP 201 and created notice `97a0e285-ed2a-4cb6-af72-db1ae8612248`.
- Document type: `terms`.
- Document version: `qa-terms-20260715171949`.
- Initial status: `draft`.
- Customer notice required: `true`.
- Re-acceptance required: `true`.
- Effective at: `2026-08-01T00:00:00+02:00`.
- First `PATCH /api/admin/legal-change-notices/97a0e285-ed2a-4cb6-af72-db1ae8612248` moved the notice to `approved`.
- Final `PATCH` moved the notice to `sent`, set `notice_sent_at=2026-07-15T17:19:52.75+00:00`, and changed evidence reference to `QA-LEGAL-SENT-20260715171949`.

Audit and notification result:
- Audit `legal_change_notice_recorded` was stored at `2026-07-15T17:19:51.270893+00:00`.
- Audit `legal_change_notice_updated` was stored for both updates, with changed fields, before/after values, and admin reasons.
- High-priority admin notification `a40e0217-4522-49ba-a2ba-0d5dcc771198` was created when the required customer notice was first recorded.
- High-priority admin notification `11b6d2a8-03e4-4c9f-9c89-4c49530feddf` was created while the notice was approved but still unsent.
- No additional follow-up notification was created after the notice was marked `sent`.

Issue found and fixed:
- Sent legal notices still showed `Approve`, `Sent`, and `Needs review` controls, which made a completed notice look unfinished.
- Fixed `src/app/admin/legal-change-notices/page.tsx` so sent rows show a simple `Sent` label instead of action buttons.
- Local checks passed: `npm.cmd run lint`, `npm.cmd run text:check`, and `npm.cmd run build`.
- Production deployment `dpl_Zj7AL573qGTkigTAYvuwmDC9Rqgg` was aliased to `https://screenia.se`.

Visual/admin verification:
- Browser page `https://screenia.se/admin/legal-change-notices` showed the legal notice as `sent`.
- The row showed `Required: yes`, `Re-accept: yes`, sent timestamp `2026-07-15 19:19:52`, evidence `QA-LEGAL-SENT-20260715171949`, and final `Sent` label.
- The page badge showed `0 need notice`.
- Browser console had no errors for the page.

Post-test smoke:
- `/api/display/QRWXVA/playlist` returned HTTP 200.
- `/login` returned HTTP 200.
- Unsigned `/api/stripe/webhook` returned HTTP 400 with `Missing signature`.
- Production launch readiness remained `53 pass`, `10 warning`, `0 fail`.

### Inventory And Device Stock Lifecycle QA - 2026-07-15

Scenario tested:
- Admin manages a Premium 4K hardware item through the real stock lifecycle: create stock, edit bench-tested details, allocate to a customer, mark shipped, mark returned, process defect/repair, return to stock, and retire the temporary QA item.

Lifecycle result:
- `POST /api/admin/inventory` created Premium 4K item `e4b299e6-5a4d-448f-92df-7357cf1ace27`.
- Item code: `1AFEBC62`.
- Serial number: `QA-INV-P4K-FIX-20260715173249`.
- Allocation created device `43f07ee3-cb46-45e2-b42f-a744ad7b8b43` with device code `MK3FFY`.
- The item successfully moved through `in_stock -> assigned -> shipped -> returned -> defective -> in_repair -> in_stock -> retired`.
- Final item state: `retired`, condition `tested`, no customer, no linked device, no assigned timestamp.
- Inventory history stored 8 lifecycle records for the item.

Issue found and fixed:
- Returned hardware stayed linked to an active device after the return operation. That could leave phantom active devices and prevent clean reuse of returned stock.
- Fixed `src/app/api/admin/inventory/[itemId]/route.ts` so returned, in-stock, defective, in-repair, retired, and lost stock releases the linked device, deactivates it, stores the released device in audit metadata, and rolls back both inventory and device state if audit storage fails.
- A retired item still looked allocatable in the admin UI.
- Fixed `src/app/api/admin/inventory/[itemId]/route.ts` so only `in_stock` inventory can be allocated or linked to a device.
- Fixed `src/app/admin/inventory/page.tsx` so Ready stock counts only `in_stock` items, retired/unavailable items show `Not available for allocation`, and existing-device linking is hidden unless the item is in stock.

Retest result:
- Production return retest passed: the returned Premium 4K item detached from the device, set customer/device/assigned fields to `null`, and set the created device inactive with `inventory_status=returned`.
- Production retired-allocation guard returned HTTP 400 with `Only in-stock inventory items can be allocated.`
- Browser page `https://screenia.se/admin/inventory` showed the retired QA item as `RETIRED`, `Not assigned`, `Not created`, Ready stock `0`, button `Not available for allocation`, and no existing-device link action.
- Local checks passed: `npm.cmd run lint`, `npm.cmd run text:check`, and `npm.cmd run build`.
- Production deployments:
  - `dpl_5ynrw9FMUJH5ipJGWTNguDuAMkRJ` for device-release behavior.
  - `dpl_7BcN2b9VMzJJ2PztqEMHF8KjqNw7` for allocation guards and admin UI tightening.

Post-test smoke:
- `/api/display/QRWXVA/playlist` returned HTTP 200.
- `/login` returned HTTP 200.
- Unsigned `/api/stripe/webhook` returned HTTP 400 with `Missing signature`.
- Authenticated production launch readiness remained `53 pass`, `10 warning`, `0 fail`.

### Subscription Billing Lifecycle QA - 2026-07-15

Scenario tested:
- Admin and customer subscription operations for the live Premium 4K QA customer, plus irreversible immediate cancellation using disposable Stripe test subscriptions.

Admin lifecycle result:
- Customer: `a0fe0b3d-d3f4-45a5-9316-1e0bc8588009`, customer number `10000044`.
- Stripe subscription: `sub_1TtHxgGhi0eDHRQZnv0vnynm`.
- Display device: `QRWXVA`.
- Admin pause set customer access to `paused`, Stripe `pause_collection.behavior=void`, stored `subscription_paused`, and `/api/display/QRWXVA/playlist` returned HTTP 403 with `Display is not active.`
- Admin resume cleared Stripe pause collection, restored customer access to `active`, stored `subscription_resumed`, and `/api/display/QRWXVA/playlist` returned HTTP 200.
- Admin period-end cancellation set Stripe `cancel_at_period_end=true`, local `cancel_at_period_end=true`, customer access `active_until_period_end`, effective date `2026-08-05T01:50:10Z`, stored `subscription_cancel_scheduled`, and display access stayed HTTP 200.
- Admin resume cleared the period-end cancellation in Stripe and locally.
- Admin discount flow applied a temporary 10% / 1 month Stripe discount, recorded local adjustment `dc29272a-d3b5-49f7-b725-a74e72abdfe9`, stored `subscription_discount_applied`, then removed the discount, marked the adjustment inactive, stored `subscription_discount_removed`, and deleted the temporary QA Stripe coupon `5bqceQ7m` after removal to avoid Stripe clutter.

Immediate cancellation result:
- Disposable customer `10000055` / `d3a64a82-1b7f-4144-a63a-2afa92e05a92` used Stripe subscription `sub_1TtWvyGhi0eDHRQZz7sSXnd4`.
- Admin immediate cancel returned HTTP 200.
- Stripe subscription ended as `canceled`.
- Customer ended as `payment_status=cancelled`, `service_access_status=cancelled`, `inactive_reason=subscription_cancelled`, `cancellation_source=admin`.
- Local subscription ended as `status=cancelled`, `fulfillment_status=cancelled`, `stripe_payment_status=canceled`, `cancel_at_period_end=false`.
- Audit `subscription_cancelled_immediately` was stored with the admin reason.

Customer-side cancellation result:
- Customer account cancellation endpoint scheduled period-end cancellation with reason `temporary_pause`.
- Stripe and local subscription set `cancel_at_period_end=true`.
- Customer access became `active_until_period_end`; display access stayed HTTP 200 until the paid-through date.
- Admin resume then cleared cancellation and restored active access.
- Audit records included customer `subscription_cancel_scheduled` with customer reason/details and admin `subscription_resumed` cleanup.

Issues found and fixed:
- Immediate admin cancellation changed local subscription status to `cancelled`, but left `stripe_payment_status=trialing`. Fixed `src/app/api/admin/customers/[customerId]/subscription/route.ts` so immediate cancellation stores `stripe_payment_status=canceled`.
- Stripe webhook sync cleared `cancellation_source` after customer-side period-end cancellation. Fixed `src/app/api/stripe/webhook/route.ts` so `active_until_period_end` sync preserves the source set by the customer/admin route.
- Two disposable QA customers initially had invalid Swedish organisation numbers. Corrected them to valid dummy numbers `5599999991` and `5599999983`; readiness returned to green.

Visual/admin verification:
- Browser page `https://screenia.se/admin/customers/a0fe0b3d-d3f4-45a5-9316-1e0bc8588009?section=onboarding` showed the Customer operation flow with `Pause subscription`, `Apply temporary discount`, `Cancel at period end`, and `Cancel now`.
- Browser Orders section showed the active Premium 4K order, Stripe subscription, paid period, setup/device/shipping/monthly amounts, included VAT, and total.

Checks and deployment:
- Local checks passed: `npm.cmd run lint`, `npm.cmd run text:check`, and `npm.cmd run build`.
- Production deployments:
  - `dpl_3aLv5s1xtK4Vm7YXwQchFfmqj6gR` for immediate-cancel Stripe payment-status sync.
  - `dpl_BMvGJq4mDMw5CrebXKSrE3GKrN6L` for cancellation-source preservation in Stripe webhook sync.

Post-test smoke:
- `/api/display/QRWXVA/playlist` returned HTTP 200.
- `/login` returned HTTP 200.
- Unsigned `/api/stripe/webhook` returned HTTP 400 with `Missing signature`.
- Authenticated production launch readiness remained `53 pass`, `10 warning`, `0 fail`.
