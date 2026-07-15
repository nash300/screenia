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
