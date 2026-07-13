# Screenia Upcoming Launch Work

Last updated: 2026-07-13

## Current Readiness Snapshot

- Launch readiness: 51 passed, 11 needs review, 0 blocked.
- Progress: about 82% strict readiness, 100% non-blocked readiness.
- Critical blockers are cleared for now.
- Detailed end-to-end testing should resume after domain, hosting, and email services are purchased/configured.

## Next Services To Finish

Current service setup progress: about 30%.

### Service Purchase And Setup Runbook

1. Loopia domain and professional email
   - Status: `screenia.se` domain payment completed on 2026-07-13.
   - Bought only `screenia.se` at Loopia.
   - Verified first-year checkout total after removing Loopia hosting: `6.25 SEK` including moms (`5.00 SEK` ex moms, `1.25 SEK` moms).
   - Payment confirmation email received from Loopia Support for faktura `1132956903`.
   - Receipt attachment shown in Gmail as `receipt-1132956903.pdf`.
   - User confirmed the receipt PDF was downloaded.
   - Domain registration confirmation email received: `Registrering av screenia.se genomförd`.
   - Loopia says the domain can now be administered in Loopia Kundzon; DNS/domain propagation can take 24-48 hours.
   - User confirmed Loopia Kundzon login is working.
   - LoopiaDomän includes nameserver configuration, but not advanced DNS editing. Keep the cheap plan and use Vercel nameservers/DNS later instead of buying LoopiaDNS unless Vercel setup proves otherwise.
   - Receipt/payment evidence should be saved from Loopia Kundzon when available.
   - Business purpose note for later bookkeeping: Screenia domain name, brand identity, and production launch setup.
   - Do not add Loopia `Webbhotell`, Microsoft 365, separate E-post, LoopiaDNS, SEO, Listings, Sitebuilder, or the free `.online` domain during the first purchase.
   - Reason: Screenia will be hosted on Vercel, so Loopia web hosting is unnecessary and renews too expensively for the startup phase.
   - After purchase, configure human inboxes through Zoho Mail Free first if available for the selected data center; use Migadu Micro as the low-cost paid fallback.
   - Desired human addresses: `hello@screenia.se`, `support@screenia.se`, and `billing@screenia.se`.
   - Then point `screenia.se` and `www.screenia.se` to Vercel once Vercel provides the exact DNS records.

2. Vercel hosting
   - Buy/use Vercel Pro before production because the app is commercial.
   - Connect the Screenia GitHub repository and deploy the Next.js app.
   - Add `screenia.se` and `www.screenia.se` to the Vercel project.
   - Copy the DNS records Vercel gives into Loopia DNS.
   - Add production environment variables only after reviewing local/test values.
   - Confirm `https://screenia.se` loads the production app.

3. Resend transactional email
   - Start with Resend Free while volume is low.
   - Add and verify `screenia.se` in Resend.
   - Add Resend SPF/DKIM records in Loopia DNS.
   - Configure DMARC for the domain before sending real customer email.
   - Use a verified sender such as `hello@screenia.se` or `no-reply@screenia.se` for transactional mail.
   - Webhook already created for `https://screenia.se/api/resend/webhook`; re-test after the domain points to Vercel.
   - Confirm delivery, bounce, complaint, failed, and unsubscribe events are stored.

4. Supabase production readiness
   - Keep Free during setup/testing if usage stays low.
   - Upgrade to Supabase Pro before real paid customers if production backups, no project pausing, and support are required.
   - Set production Auth URLs and email templates after the domain is live.
   - Confirm storage buckets remain private.
   - Re-run launch readiness after deployment.

5. Stripe production readiness
   - Keep test mode until business, tax, and legal gates are complete.
   - Activate live payments only after business identity, VAT decision, legal documents, and live webhooks are verified.
   - Add production webhook endpoint after Vercel deployment.
   - Confirm Stripe Tax/VAT mode.

## Review Items Still Open

- Application URL
- Live payments enabled
- Business registration
- VAT decision
- Legal review
- Live webhook verified
- Supabase Auth email verified
- Stripe Tax / VAT mode
- Transactional email
- Company identity
- Legal documents

## Admin Panel Consistency Work

Completed in this pass:

- Customer detail onboarding operations were grouped into a guided customer operation flow.
- Device detail media upload/removal actions were moved into inline audited flows.
- Orders status, fulfillment, inventory, and shipment tracking updates now use an inline order operation flow instead of browser prompts.
- Inventory add/edit, allocation/linking, and stock lifecycle actions now use inline reason/confirmation fields instead of browser prompts.
- Pricing plan edits and Stripe sync now use a per-plan audited pricing operation flow.
- Manual customer draft creation and new device creation now require inline creation reasons before submit.
- Device detail activation/deactivation, deletion, rename, and detail updates now use inline audited flows or reason fields.
- Customer detail quote preparation, message/material review, anonymization, and deletion now use inline reason/confirmation fields instead of browser prompts.
- Compliance/review registers, tax payment status updates, and dashboard bulk notification actions now use inline reason flows instead of browser prompts.
- Main admin navigation was simplified: compliance, tax, privacy, access, backup, retention, legal, and processor tools are grouped under `/admin/compliance` instead of cluttering daily operations.

Next admin areas to clean up before broad real-world testing:

- Continue visual spot checks as new admin workflows are added; avoid reintroducing browser prompts for audited actions.

## Detailed Test Pass To Run Later

Run the long real-world testing pass after the services above are ready:

- Request quote from public site.
- Admin prepares quote/onboarding link.
- Customer completes onboarding and legal consent.
- Stripe Checkout succeeds.
- Subscription entitlement syncs from Stripe.
- Customer account shows active status.
- Admin can pause/resume/cancel subscription.
- Cancel-at-period-end keeps access until paid-through date.
- Display device plays only for qualified paid customers.
- Paused/payment-failed/cancelled customers are blocked from display.
- Resend delivery events arrive and create admin visibility when needed.
- Refund and production boundary behavior is correct.
- VAT/accounting exports include required evidence.
- Data/privacy/admin audit workflows write expected records.

## Session Rule

Before doing any long test pass, check `/admin/launch-readiness` first and fix only critical blockers. Avoid repeating broad tests until domain, hosting, email, Stripe, and Supabase production settings are ready.
