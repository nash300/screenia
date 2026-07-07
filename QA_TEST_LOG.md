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
