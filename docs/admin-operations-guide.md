# Screenia admin and system operations guide

This document is the versioned technical reference for daily administration and safe changes.

## System ownership

- Next.js and Vercel: website, customer portal, admin area, server routes, and deployment.
- Supabase: authentication, application data, storage, row-level access, and audit records.
- Stripe: checkout, subscriptions, invoices, tax calculation, refunds, and payment evidence.
- Resend and Zoho: transactional delivery and the `service@screenia.se` customer mailbox.
- Loopia: `screenia.se`, DNS, and mailbox/domain administration.

Never place API keys, passwords, signing secrets, or customer card data in this document, source control, admin notes, or email.

Each admin must use an individual account. Admin password resets require at least 12 characters with letters, numbers, and a special character. Do not share an admin password or reuse the customer password policy for administrators.

## Billing invariants

1. Catalog prices shown to customers are final prices including Swedish moms.
2. First Stripe payment is `start fee + (device price x screen quantity) + order shipping`. Order shipping is 99 SEK for up to three devices, then 29 SEK per additional device.
3. The monthly package price is recurring and starts after the configured 21-day trial.
4. Do not add 25% to customer totals that already include moms. For a 25% inclusive price, net is `gross / 1.25` and moms is `gross - net`.
5. Plan configuration fields use whole SEK. Stripe API amounts and stored payment evidence such as `total_amount_sek` and `tax_amount_sek` use ore integers despite the historical column suffix.
6. All calculations use integers. Never use floating-point money for persisted amounts.
7. Pricing changes belong in `/admin/pricing` and must be synchronized with Stripe test mode before live mode.
8. Refunds and subscription changes belong in `/admin/orders`; record a clear operational reason for every action.

## Customer order procedure

1. Review the inquiry in `/admin/customers` and verify package, quantity, email, phone, company, and privacy acceptance.
2. Prepare the quote and verify the first-payment formula and future monthly amount.
3. Send the onboarding link. If delivery fails, open Troubleshooting and then Email delivery evidence.
4. Review the customer's setup details and uploaded material.
5. Let Stripe Checkout collect payment. Never request card details by message or phone.
6. Confirm Stripe payment, webhook processing, customer account creation, and account email evidence.
7. Assign physical hardware from the customer's profile or `/admin/inventory`.
8. Configure the screen endpoint and media in `/admin/devices`.
9. Check the customer history and global audit evidence before closing the work item.

## Admin page responsibilities

- `/admin/customers`: customer lifecycle, quote, onboarding, communication, uploads, account, device assignment, and customer audit history.
- `/admin/contact-inquiries`: public contact questions and reply history.
- `/admin/orders`: payment status, invoices, refunds, cancellation, and accounting export.
- `/admin/pricing`: package, start fee, hardware, shipping, trial, moms behavior, and Stripe price synchronization.
- `/admin/inventory`: physical hardware lifecycle, serial numbers, warranty, assignment, return, repair, loss, and retirement.
- `/admin/devices`: digital screen endpoints, playlists, media, activation, and display URL.
- `/admin/troubleshooting`: technical diagnostics used only when an operational problem needs investigation.
- `/admin/email-events`: email delivery evidence reached through Troubleshooting when needed.

## Email procedure

- Customer-visible sender and reply address: `service@screenia.se`.
- Public questions are answered from Visitor messages so the visitor sees their original question and Screenia's reply.
- Order communication is sent from the customer profile so it remains attached to the customer record.
- Verify delivery evidence after sending. Investigate bounces and complaints before retrying.
- Email templates must include plain text, readable mobile HTML, a descriptive subject, the company identity, and the support address.

## Change and deployment procedure

1. Work locally and preserve unrelated worktree changes.
2. Verify the affected public, customer, and admin flow visually.
3. Run `npm run lint`, `npm run text:check`, the billing catalog check, and `npm run build`.
4. Review `docs/deployment-readiness.md` and document every warning requiring an external dashboard or legal decision.
5. Commit and push a named checkpoint. Deploy only the reviewed commit; do not deploy incidental local changes.
6. After deployment, test inquiry, email, onboarding, Stripe Checkout, webhook, account setup/login, and admin evidence in production test mode.
7. Enable Stripe live mode only after legal identity, VAT registration/tax settings, live webhook, production URLs, email authentication, and policy review are confirmed.

## Invoice and legal identity checklist

Before accepting live payments, configure the registered seller name, organisation number, VAT number when applicable, postal address, support email, invoice numbering, invoice date, customer identity/address, item description, net amount, VAT rate, VAT amount, and total. These values must match the registered business and Stripe invoice settings; do not invent placeholders.
