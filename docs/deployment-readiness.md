# Deployment readiness checkpoint

This file is the internal readiness reference. Readiness checks are intentionally
not exposed in the daily admin panel. This document is not permission to enable
live payments.

## Verified

- `npm run release:check` passes lint, encoding checks, billing invariants, TypeScript, and the production build.
- Standard FHD: first payment 1 297 SEK for one device, then 99 SEK/month after 21 days.
- Premium 4K: first payment 1 697 SEK for one device, then 129 SEK/month after 21 days. Premium includes customer MP4/WEBM uploads for Screenia review before publication.
- These totals include moms. The 499 SEK base setup fee includes up to three screens and each screen after the third adds 249 SEK. Selected new clients can receive an explicitly recorded waiver of the 499 SEK base fee. Shipping is a fixed 99 SEK per order regardless of device quantity.
- Stripe test mode has 499 SEK base administrative Prices for both active plans, one shared 249 SEK additional-screen setup Price, and package monthly Prices of 99/129 SEK. Checkout omits the base line for an approved waiver and preserves separately quoted historical amounts.
- Supabase stores the base setup amount, waiver flag/reason, included-screen threshold, additional-screen unit price, additional-screen count, and calculated setup total on each prepared order.
- Branded email, landing footer, contact page, confirmation pages, policy pages, and admin guide were visually checked at desktop and phone widths without horizontal overflow.
- Public contact inquiries, email delivery evidence, audit events, subscriptions, and hardware inventory tables exist in Supabase.

## Clean baseline

- Confirm operational and test-record counts immediately before each clean test cycle; do not rely on an old fixed count in this document.
- The two active pricing plans share the additional-screen setup Price while retaining package-specific setup, device, fixed-shipping, and monthly Price references. The historical Premium Plus plan is inactive.
- Future real payment history must not be deleted merely to make dashboards look empty.

## Billing verification

1. Run `npm run billing:check` to verify the one-time setup arithmetic, fixed shipping, and required checkout evidence.
2. Run `npm run pricing:verify-services` to compare Supabase pricing rules with every referenced Stripe test Price.
3. The preparatory `npm run pricing:sync-services:test` command is restricted to Stripe test keys and idempotently synchronizes both active packages, unchanged device prices, fixed 99 SEK shipping, and the shared 249 SEK additional-screen setup Price.
4. A real browser checkout remains required to prove the generated Stripe invoice lines, webhook evidence, emails, and stored order totals together.

## Manual gates before live payments

1. Confirm the registered legal business name, organisation number, postal address, F/FA-skatt status, and VAT registration or exemption decision.
2. Enter the confirmed identity in production environment variables and Stripe invoice/business settings.
3. Complete legal/accounting review of terms, privacy, cookies, subscription/billing, refunds, invoices, and support wording.
4. Confirm Vercel Pro or equivalent commercial hosting and set `NEXT_PUBLIC_APP_URL=https://screenia.se` in production.
5. Configure and test the Stripe live webhook, live products/prices, Swedish tax registration, tax codes, and inclusive price behavior.
6. Verify Supabase Auth production email for account activation and password reset.
7. Give each administrator an individual account, enable MFA in Supabase, and complete the admin-access review. Reset forgotten admin passwords through `/admin-login`; admin resets require a strong 12-character password.
8. Run a production test-mode order from inquiry through email, onboarding, Checkout, webhook, account setup, login, admin evidence, device assignment, cancellation, and refund.
9. Set live-payment confirmation flags only after every manual item has evidence.

## Deployment sequence

1. Run `npm run release:check`.
2. Review this reference and record evidence for every manual gate outside the customer operations UI.
3. Commit and push the reviewed state.
4. Deploy the reviewed commit without enabling live Stripe keys.
5. Run production test-mode smoke tests.
6. Enable live payments in a separate, reviewed change after all manual gates pass.
