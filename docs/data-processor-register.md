# Screenia Data Processor Register

Use this register before live launch and whenever a vendor, region, or data
category changes. It is an operational GDPR control, not a substitute for final
legal review.

## Current Processors And Services

| Provider | Purpose | Typical data | Launch evidence to verify |
| --- | --- | --- | --- |
| Supabase | Application database, authentication, storage, and audit records | Customer profile, login identity, consent records, support messages, uploaded display material metadata, order state, device data | Project region, access controls, private buckets, Auth email settings, DPA/data processing terms |
| Stripe | Checkout, subscriptions, invoices, refunds, disputes, and billing portal | Billing contact, organisation number where sent, payment status, Stripe customer/subscription/invoice/payment identifiers | Stripe account business details, VAT/tax settings, webhook endpoint, DPA/data processing terms |
| Resend | Transactional email delivery | Recipient email, message subject/body, delivery status, support/onboarding/request email content | Verified `screenia.se` domain, sender identity, suppression/bounce handling, DPA/data processing terms |
| Vercel | Hosting, deployment, logs, and edge/runtime infrastructure | Request metadata, IP/user-agent in logs, application runtime data needed to serve Screenia | Production domain, environment separation, team access, logging settings, DPA/data processing terms |
| Loopia | Domain, DNS, and business email services | Domain/contact/account details, email account metadata, email content if mailbox is used | Domain ownership, DNS records, mailbox security, DPA/data processing terms |

## Launch Checklist

- Verify each provider account is controlled by the business owner and protected
  with strong authentication.
- Accept or download each provider's data processing terms before live customer
  data is processed.
- Confirm where customer data is stored or routed, especially for Supabase,
  Stripe, Vercel logs, Resend delivery events, and Loopia mailboxes.
- Keep billing receipts and DPA evidence with business records.
- Update the public privacy policy whenever a provider, purpose, or data
  category changes.
- Review this register before enabling live payments, adding analytics, adding
  support tools, or changing storage/email providers.
