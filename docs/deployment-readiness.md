# Deployment readiness checkpoint

This file is the internal readiness reference. Readiness checks are intentionally
not exposed in the daily admin panel. This document is not permission to enable
live payments.

## Verified

- `npm run release:check` passes lint, encoding checks, billing invariants, TypeScript, and the production build.
- Standard FHD: first payment 2 397 SEK, then 249 SEK/month after 21 days.
- Premium 4K: first payment 2 797 SEK, then 349 SEK/month after 21 days.
- These totals include moms. The 1 599 SEK base setup fee includes up to three screens. Each screen after the third adds 249 SEK to setup; device and shipping still multiply with screen quantity.
- Stripe test mode has one shared 249 SEK additional-screen setup Price. Checkout adds it as a separate invoice line with the exact extra-screen quantity.
- Supabase stores the base setup amount, included-screen threshold, additional-screen unit price, additional-screen count, and calculated setup total on each prepared order.
- Branded email, landing footer, contact page, confirmation pages, policy pages, and admin guide were visually checked at desktop and phone widths without horizontal overflow.
- Public contact inquiries, email delivery evidence, audit events, subscriptions, and hardware inventory tables exist in Supabase.

## Clean baseline

- Confirm operational and test-record counts immediately before each clean test cycle; do not rely on an old fixed count in this document.
- The two active pricing plans share one additional-screen setup Price while retaining package-specific base setup, device, shipping, and monthly Price references.
- Future real payment history must not be deleted merely to make dashboards look empty.

## Billing verification

1. Run `npm run billing:check` to verify the 1-, 3-, and 4-screen arithmetic and required checkout evidence.
2. Run `npm run pricing:verify-services` to compare Supabase pricing rules with every referenced Stripe test Price.
3. The preparatory `npm run pricing:sync-additional-setup:test` command is restricted to Stripe test keys and idempotently reuses the shared 249 SEK Price.
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
