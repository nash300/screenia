# InfoSync QA Test Log

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
- Customer profile completion no longer waits on non-critical legal/audit writes before responding.
- Legal document lookup now has a timeout and stores the agreement without `legal_document_id` if the lookup is slow.
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
