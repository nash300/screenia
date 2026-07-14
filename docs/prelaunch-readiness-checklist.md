# Screenia Pre-Launch Readiness Checklist

Use this checklist before enabling live Stripe payments or inviting real paying
customers.

## Business and tax

- Register the business in Sweden before live customer payments.
- Use enskild näringsverksamhet as the default first step unless an accountant
  recommends aktiebolag.
- Confirm F-skatt or FA-skatt status.
- Confirm VAT/moms registration decision and invoice wording.
- Confirm optional billing email is validated and used for Stripe invoices while
  the customer account email remains the login/account identity.
- Confirm Swedish organisation/registration numbers are validated before
  onboarding can proceed to payment and before admin customer edits are saved.
  The admin Launch Readiness screen should show the customer organisation-number
  check as passing before live payments.
- Confirm active pricing plans are SEK-based, VAT-inclusive, and synced to
  Stripe price IDs. The admin Launch Readiness screen should show the pricing
  configuration check as passing before live payments.
- Confirm the admin accounting CSV export is available from Orders and includes
  order numbers, customer numbers, organisation numbers, billing email, VAT
  amounts, total amounts, payment status, and Stripe invoice/session references.
- Confirm the admin VAT summary export is available from Orders and includes
  gross, net, VAT, customer identifiers, and Stripe invoice references for the
  selected VAT period.
- Confirm the admin tax payment register is available from the Tax admin page
  and can record VAT/moms period status, paid date, reference, notes, and admin
  reason.
- Keep Loopia, Vercel, Supabase, Stripe, Resend, and other receipts for
  bookkeeping.
- Keep `docs/data-processor-register.md` current for Supabase, Stripe, Resend,
  Vercel, Loopia, and any future processor before live customer data is handled.

## Technical launch gates

- Apply all Supabase migrations in timestamp order, including
  `202607120000_subscription_operations.sql`,
  `202607120001_prelaunch_legal_documents.sql`, and
  `202607120002_private_display_videos.sql`, and
  `202607120003_stripe_webhook_events.sql`, and
  `202607120004_opt_in_consent_defaults.sql`, and
  `202607120005_display_asset_review_notes.sql`, and
  `202607120006_request_privacy_consent_readiness.sql`, and
  `202607120007_private_sensitive_customer_storage.sql`, and
  `202607120008_payment_dispute_readiness.sql`, and
  `202607120009_privacy_incident_register.sql`, and
  `202607120010_data_subject_request_register.sql`, and
  `202607120011_admin_access_reviews.sql`, and
  `202607120012_backup_restore_drills.sql`, and
  `202607120013_data_retention_reviews.sql`, and
  `202607120014_processor_compliance_reviews.sql`, and
  `202607120015_resend_delivery_events.sql`, and
  `202607120016_legal_change_notices.sql`, and
  `202607120017_customer_preview_decisions.sql`.
- Confirm the admin Launch Readiness screen has no failed checks before live
  payments; the live checkout API must mirror the same business-critical
  blockers, including production app URL, company identity, final legal
  versions, legal documents, subscription entitlement operations, pricing,
  private storage, financial-risk webhooks, fulfillment, support,
  tax/accounting registers, privacy/GDPR workflows, email delivery, security
  headers, no-store policy, and cross-origin request protection.
- Confirm Stripe webhook duplicate protection is active so retried webhook
  events do not repeat customer invites, audit entries, notifications, or state
  transitions.
- Confirm failed Stripe webhook processing creates an urgent admin notification
  and a failed ledger row so payment-sync issues are visible.
- Confirm Stripe dispute and external refund webhooks create urgent admin
  notifications, write audit events, and block display access when payment is
  disputed or fully refunded outside the admin panel.
- Keep the admin Launch Readiness screen after launch as an operational control.
  Review it before accepting live customers, changing billing/legal/security
  settings, or making major production deployments.
- Keep Stripe in test mode until business/tax/legal readiness is complete.
- Keep all live-payment flags unset or `false` unless the matching item has
  been verified:
  `SCREENIA_LIVE_PAYMENTS_ENABLED`,
  `SCREENIA_BUSINESS_REGISTRATION_CONFIRMED`,
  `SCREENIA_VERCEL_PRO_CONFIRMED`,
  `SCREENIA_VAT_DECISION_CONFIRMED`,
  `SCREENIA_LEGAL_REVIEW_CONFIRMED`, and
  `SCREENIA_LIVE_WEBHOOK_VERIFIED`, and
  `SCREENIA_SUPABASE_AUTH_EMAIL_VERIFIED`.
- Set every live-payment flag to `true` only after the business registration,
  tax/VAT decision, final policy review, and live webhook verification are done.
- Verify Resend domain authentication for `screenia.se` and set
  `RESEND_FROM_EMAIL` to a verified `screenia.se` sender before real customers.
- Confirm onboarding, quote, and request-confirmation emails use the shared
  transactional email sender, record audited delivery state, and create urgent
  admin notifications when delivery fails, email is not configured, or Resend
  cannot be reached before returning a response. Admin-created quote/onboarding
  links must require an admin reason and include that reason in audit history.
  Direct admin onboarding-link preparation must fail visibly if link-preparation
  audit evidence, delivery audit evidence, or failure-notification evidence
  cannot be stored.
  Quote/onboarding emails must fail visibly if the email was sent but the order
  cannot be marked `quote_sent`, or if sent-delivery audit evidence cannot be
  stored. Email-not-configured and email-failed quote paths must also fail
  visibly if their audit evidence or urgent admin notification cannot be stored.
- Configure the Resend webhook endpoint at `/api/resend/webhook`, set
  `RESEND_WEBHOOK_SECRET`, and confirm bounce/complaint/failure events are
  stored, audited, visible to admins, and create admin notifications.
- Verify Supabase Auth email delivery uses a production-safe sender, then set
  `SCREENIA_SUPABASE_AUTH_EMAIL_VERIFIED=true` only after password setup and
  password reset emails arrive correctly for a real test recipient.
- Verify Vercel production environment variables are separated from local/test
  secrets.
- Verify the data processor register, public privacy disclosure, provider
  DPAs/data-processing terms, account ownership, and provider security settings
  before enabling live checkout.
- Record processor compliance reviews for Supabase, Stripe, Resend, Vercel,
  and Loopia before live customer data is processed. Each review must track DPA
  evidence, security review, account owner verification, provider region or
  location, evidence reference, next review due date, admin reason, and
  before/after audit evidence for updates.
- Confirm browser/service-worker caching does not store or replay customer,
  admin, auth, checkout, onboarding, or display entitlement API responses.
- Confirm the admin Launch Readiness screen shows the service-worker cache
  safety check as passing before live payments.
- Confirm sensitive routes return no-store response headers:
  `/api/*`, `/auth/*`, `/account`, `/admin`, `/display`, `/onboarding`,
  `/login`, and `/admin-login`.
- Confirm production responses include baseline browser security headers:
  HSTS, `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy`, and `Permissions-Policy`.
- Confirm unsafe API methods reject cross-origin browser requests, while
  requests without same-origin source evidence fail closed and
  `/api/stripe/webhook` remains reachable for Stripe signature-verified events.
- Confirm public request forms have basic abuse protection, including a
  honeypot field and rate limiting for repeated landing-page requests.
- Confirm public request forms require privacy acknowledgement and store a
  consent record before admin notification or follow-up. The admin Launch
  Readiness screen should show this check as passing before live payments.
- Confirm the admin Launch Readiness screen shows the public request intake
  workflow as passing. It should verify landing-page rate limiting, honeypot
  handling, privacy consent storage, admin notification, audit history, and
  request-confirmation email delivery state. If audit storage fails, the saved
  lead/request record must be removed; if admin notification storage fails, the
  route must return a visible error and write
  `landing_purchase_request_notification_failed`. Confirmation-email delivery
  state must also fail visibly if audit storage fails, and failed confirmation
  emails must create urgent admin visibility or write
  `request_confirmation_email_notification_failed`.
- Confirm optional analytics, marketing, and remote-support consent defaults
  are opt-in only. The admin Launch Readiness screen should show this check as
  passing before live payments.
- Confirm customers can review and withdraw optional analytics, marketing, and
  remote-support consent from the account legal section. Consent changes must
  create current privacy-version consent records with a customer-account
  collection point for both grants and withdrawals, update customer consent
  flags, and create audit events. If consent-record or audit evidence storage
  fails, the customer consent flag update must roll back and create urgent
  admin visibility.
- Confirm customers can submit privacy/data subject requests from the account
  support form and that those requests create deadline-tracked admin records.
  Registration failures must create urgent admin notifications, and admin
  status updates must require a reason, keep before/after audit evidence, and
  surface overdue requests in the admin register.
- Confirm the cookie/tracking governance check passes before live payments.
  Non-essential analytics, pixels, remarketing, or tracking must remain absent
  unless an actual cookie/tracking consent mechanism is implemented.
- Confirm uploaded display material can be marked new, reviewed, or archived
  with an internal note and admin reason. The admin Launch Readiness screen
  should show this workflow check as passing before live payments.
- Confirm the admin Launch Readiness screen and live checkout gate verify the
  display material workflow before live payments, including paid-customer
  access checks, file count/type/size limits, private bucket storage,
  orphan-file cleanup when metadata writes fail, admin notifications, audit
  events, short-lived signed admin download URLs, review notes, reviewed-by
  evidence, reason-required review updates with before/after audit evidence,
  and customer/order state movement into admin review. Content setup must roll
  back customer, order, and newly uploaded material changes if fulfillment sync,
  audit evidence storage, or the admin review notification fails, and rollback
  failure notifications must fail visibly if admin visibility cannot be stored.
  Standalone display-material uploads must
  remove newly uploaded files/metadata if audit storage fails. If admin
  notification storage fails, the route must return a visible error plus audit
  evidence; if that failure audit cannot be stored, the route must roll back the
  newly uploaded files/metadata and return a visible support error.
- Confirm customers can approve the first screen preview or request changes
  from the account portal. The decision route must require paid service access,
  block decisions until a preview exists, require feedback for change requests,
  store decision and request evidence, create an audit event, notify admins,
  and update customer preview status plus subscription fulfillment status.
- Confirm sensitive upload buckets are private: display playback videos,
  customer display material, and support attachments. These files must be served
  only through server routes that verify entitlement/admin/customer access and
  return short-lived signed URLs.
- Confirm suspected privacy/security incidents can be recorded in the admin
  incident register with severity, status, affected data, containment notes,
  notification decisions, admin notification, and audit history. High and
  critical incidents must create urgent admin notifications, incident updates
  must require an admin reason, and audit history must include before/after
  changed-field evidence.
- Confirm backup and restore readiness can be recorded in the admin backup
  register with provider, scope, backup date, restore-test date, evidence
  reference, notes, admin reason, and audit history. Restore-tested records must
  have restore-test evidence, attention-needed records must create urgent admin
  notifications, and updates must keep before/after changed-field evidence.

## Customer and legal safety

- Final-review terms, privacy policy, cookie policy, subscription/billing
  policy, and support/service policy before live launch.
- Record future legal/policy version changes in the admin legal notice register,
  including whether customer notice or re-acceptance is required. Notice-required
  changes must not be marked not-required, sent notices must include sent-date
  and evidence reference, pending required notices must create admin
  notifications, and updates must keep before/after audit evidence.
- Confirm current terms/privacy PDF URLs point to real public PDF assets in
  `public/legal`, and that the admin Launch Readiness screen checks both the
  active Supabase `legal_documents` rows and PDF files.
- Keep consent records for terms, privacy, marketing, analytics, and remote
  support.
- Make withdrawal of optional marketing, analytics, and remote-support consent
  available from the customer account portal, not only by manual support
  request.
- Keep consent records for public request-form privacy acknowledgement before
  storing or acting on contact requests.
- Confirm onboarding cannot proceed to payment unless required terms and
  privacy consent evidence is stored successfully.
- Confirm onboarding profile completion does not silently accept mismatched
  consent state: optional consent records and `onboarding_profile_completed`
  audit evidence must be stored, or the profile update must roll back and
  create urgent admin visibility with `onboarding_profile_evidence_failed`.
- Confirm the admin Launch Readiness screen shows the legal-before-payment
  workflow check as passing before live payments.
- Do not enable optional analytics or marketing tracking without consent.
- Do not add Google Analytics, Tag Manager, Meta Pixel, Hotjar, Clarity,
  Plausible, PostHog, TikTok Pixel, LinkedIn Insight, or similar tracking until
  cookie/tracking consent is implemented and the cookie policy is updated.
- Treat customer contact details, uploaded display material, support messages,
  Stripe identifiers, and device/display data as GDPR-sensitive.
- Treat display material files and support attachments as private customer data;
  never make `videos`, `customer-display-assets`, or `customer-message-files`
  public buckets.
- Confirm display playback serves private video objects only through
  entitlement-checked short-lived signed URLs. The display playlist API must not
  fall back to direct public `http` video URLs, and display responses must use
  no-store caching.
- Keep data processor/subprocessor information consistent between the public
  privacy policy and the internal data processor register.
- Keep a data retention review record for customer, billing, support, display,
  device, and audit data that needs retention, anonymization, deletion, or
  further review. Each retention decision must include legal basis, retention
  reason, retention date where applicable, recommended action, admin reason,
  before/after audit evidence for updates, and admin notification when
  anonymization or deletion is recommended.

## Operational audit

- Confirm admin actions go through server routes and create audit events.
- Confirm refunds, cancellations, pauses, resumes, discounts, display access
  changes, Stripe billing-portal access, customer deletion, email failures, and
  payment failures are logged.
- Confirm the admin Launch Readiness screen and live checkout gate verify the
  subscription operations workflow before live payments, including customer
  period-end cancellation with paid-through access, admin period-end and
  immediate cancellation paths, any exposed Stripe cancellation API route,
  pause/resume display blocking, temporary Stripe discounts with local
  adjustment records, reason-required admin actions, and webhook syncing for
  subscription updates/deletions and invoice paid/failed events.
- Confirm Stripe disputes, won disputes, and external refunds are logged and
  visible to admins.
- Confirm pricing changes and Stripe price syncs require an admin reason and
  store that reason in audit history.
- Confirm admin notification acknowledgement uses the admin API and creates an
  audit event when notifications are marked read or unread. Bulk "mark all read"
  must require an admin reason, preserve updated/urgent counts in audit
  metadata, reject missing or too-short reasons, and roll back notification
  state if the acknowledgement audit event cannot be stored. If rollback fails,
  `admin_notification_acknowledgement_rollback_failed` urgent admin visibility
  must be stored, and if that visibility fails the admin must receive a visible
  support error before retrying. The admin Launch Readiness screen and live
  checkout gate should show this workflow check as passing before live payments.
- Confirm uploaded display material review status changes are routed through
  the admin API, store internal review notes, create audit events, and roll
  back if audit storage fails.
- Confirm customer preview approvals and change requests are routed through
  `/api/account/preview-decision`, store decision history, and create audit
  events/admin notifications.
- Confirm refund actions require an admin reason and store that reason in
  Stripe metadata, audit history, and admin notifications.
- Confirm starting layout work requires an admin reason and stores it in audit
  history, because this locks the setup/layout fee as non-refundable.
- Confirm the admin Launch Readiness screen shows the refund and production
  boundary workflow check as passing before live payments.
- Confirm customer anonymization removes personal profile data, uploaded
  material, message files, and the linked Supabase Auth login while retaining
  payment/order/audit references needed for accounting and disputes.
  Anonymization must store a `customer_anonymization_started` audit event before
  removing login access or private files, and must fail closed if that audit
  event cannot be stored. If final `customer_anonymized` audit storage fails
  after anonymization has completed, the API must return a visible non-success
  response and create an urgent admin notification.
- Confirm customer anonymization and permanent deletion require an admin reason.
  Permanent deletion must stay blocked for customers with payment or Stripe
  history; use anonymization for retained customer history instead. Permanent
  deletion must fail before deleting records if the deletion audit event cannot
  be stored, and must create urgent admin visibility if private storage cleanup
  fails after database deletion.
- Confirm the admin Launch Readiness screen and live checkout gate verify
  customer deletion/anonymization safety before live payments, including linked
  auth-user removal, private file cleanup, retained technical identifier
  removal, audit history, and accounting/dispute traceability.
- Confirm display devices only show content for paid entitled customers.
- Confirm display playlist success, entitlement denial, and server-error
  responses all send no-store headers before the display client clears stale
  content.
- Confirm display/account/admin pages always refetch entitlement and operational
  state from the server; stale cached data must not keep access alive.
- Confirm the service worker only caches explicit static assets, excludes
  sensitive route prefixes, respects no-store/private response headers, and
  clears older cache names during activation.
- Confirm customer cancellation keeps access until the paid-through date.
  If Stripe accepts the cancellation but Screenia cannot update local customer
  access, subscription state, or audit evidence, the customer API must return a
  non-success response and create urgent admin visibility with
  `customer_cancellation_sync_failed` or `customer_cancellation_audit_failed`.
  If Screenia cannot store that urgent failure evidence, the customer API must
  return a visible support error instead of saying Screenia was notified.
- Confirm customer account activation and password reset enforce the shared
  password policy: at least 10 characters with letters and numbers. The admin
  Readiness screen should show the customer password policy check as passing.
- Confirm password reset requests go through `/api/auth/password-reset`, use a
  generic response, are rate limited per email and per IP, and create an urgent
  admin notification if the reset email cannot be sent. Audit storage failures
  and failed admin notifications for reset-email failures must create internal
  operational visibility without changing the generic customer response.
- Confirm customer and admin email/password logins go through `/api/auth/login`
  and are rate limited per email and per IP.
- Confirm the admin Launch Readiness screen verifies password-reset and login
  route behavior, including rate-limit audit events and generic error handling.
- Confirm customer support tickets validate message length, subject length,
  attachment count, attachment type, and attachment size before storage, and
  create admin notifications for new customer messages. Support tickets must
  require an authenticated customer, store attachments only in the private
  message-file bucket, preserve ticket numbers/threading, escalate urgent
  tickets to urgent admin notifications, and turn privacy requests into
  deadline-tracked data subject requests. If customer-message audit storage
  fails, the ticket and attachments must be removed and
  `customer_message_audit_failed` urgent admin visibility must be stored; if
  admin notification storage fails, the route must return a visible error and
  write `customer_message_notification_failed`. If that failure audit cannot
  be stored, the route must return a visible support error.
- Confirm the admin Launch Readiness screen shows customer support ticket
  intake as passing before live payments.
- Confirm admins can send customer-visible support replies from the customer
  detail page. Replies must be stored in the customer portal history, threaded
  to the original ticket, audited, and emailed through the shared sender; failed
  or unconfigured email sends must create urgent admin notifications. If the
  support-reply audit cannot be stored, the reply and original ticket status
  update must roll back and `customer_support_reply_audit_failed` urgent admin
  visibility must be stored. If email-delivery audit evidence cannot be stored
  after sending, admins must see `customer_support_reply_email_audit_failed`.
  Internal support-message review/status updates must require an admin reason
  and keep before/after audit evidence.
- Confirm the admin Launch Readiness screen and live checkout gate show the
  customer support reply and support-message review workflow as passing before
  live payments.
- Confirm customer billing portal access is available from the account billing
  section. The route must authenticate the customer, require a linked Stripe
  customer ID, return customers to `/account`, audit successful sessions with
  Stripe portal session evidence before returning the portal URL, and create
  urgent admin notifications for Stripe portal failures. If audit or
  notification evidence cannot be stored, the route must fail visibly.
- Keep `/admin/launch-readiness` as a permanent admin operations page. It must
  show billing, legal, email, security, entitlement, and fulfillment blockers
  before live payments are enabled, and its API response must use
  `Cache-Control: no-store`.
- Confirm the admin Launch Readiness screen shows the data processor register
  check as passing before live payments.
- Confirm the admin Launch Readiness screen shows the legal change notice
  workflow check as passing before live payments.
- Confirm the admin Launch Readiness screen shows the processor compliance
  review workflow check as passing before live payments.
- Confirm the admin Launch Readiness screen shows the privacy incident workflow
  check as passing before live payments.
- Confirm the admin Launch Readiness screen shows the data subject request
  workflow check as passing before live payments.
- Confirm the admin Launch Readiness screen shows the admin access review and
  backup restore drill workflow checks as passing before live payments. Access
  reviews must track admin email/auth ID, MFA verification, whether access is
  still required, reviewer/time evidence, admin reason, notifications for MFA
  or access review gaps, and before/after audit evidence for updates.
- Confirm the admin Launch Readiness screen shows the data retention review
  workflow check as passing before live payments.
- Confirm admin order operations go through `/api/admin/orders/[orderId]`, not
  direct browser writes to Supabase, and that status, inventory, fulfillment,
  and tracking changes require a reason and create audit events. Shipped or
  completed orders must be rejected unless a tracking number or tracking URL is
  present. If audit storage fails, changed order operation fields must be
  restored. If rollback fails, `admin_order_operation_rollback_failed` urgent
  admin visibility must be stored; if that visibility cannot be stored, the
  admin must get a visible support error before retrying.
- Confirm admin inventory operations go through `/api/admin/inventory` and
  `/api/admin/inventory/[itemId]`, not direct browser writes to Supabase, and
  that stock creation, stock edits, status changes, allocation, and device
  linking require a reason and create audit events. Stock creation, stock
  detail edits, and stock status changes must fail closed and verify rollback
  if audit storage fails. Stock creation rollback failures must store
  `admin_inventory_item_create_rollback_failed`; item edit rollback failures
  must store `admin_inventory_item_update_rollback_failed`; status rollback
  failures must store `admin_inventory_status_update_rollback_failed`.
  Allocation to a new device must remove the created device if inventory
  linking or allocation audit storage fails, and rollback failures must store
  `admin_inventory_allocation_rollback_failed`. Linking to an existing device
  must restore inventory and copied device fields if audit storage fails, and
  rollback failures must store `admin_inventory_device_link_rollback_failed`.
- Confirm the admin Launch Readiness screen and live checkout gate verify the
  inventory workflow before live payments, including admin-authenticated server
  routes, serial-number validation, item/status/condition validation, reason
  prompts, allocation/linking safeguards, database event history, and admin
  audit events.
- Confirm admin device operations go through `/api/admin/devices`,
  `/api/admin/devices/[deviceId]`, and
  `/api/admin/devices/[deviceId]/media`, not direct browser writes to Supabase,
  and that device creation, edits, activation/deactivation, deletion, media
  uploads, and playlist removal require a reason and create audit events.
- Confirm the admin Launch Readiness screen and live checkout gate verify the
  device/media workflow before live payments, including admin-authenticated
  server routes, customer/name validation, reason-required actions, before/after
  audit evidence, playlist cleanup on device deletion, MP4-only media uploads,
  storage cleanup on failed media writes, and audited playlist add/remove
  actions. Device creation, device edits/status changes, media upload, and
  playlist removal must roll back if audit storage fails. Device creation
  rollback failures must create `admin_device_create_rollback_failed` urgent
  admin visibility; device update rollback failures must create
  `admin_device_update_rollback_failed`; device deletion rollback failures
  must create `admin_device_delete_rollback_failed`; media upload rollback
  failures must create `admin_device_media_upload_rollback_failed`; media
  removal rollback failures must create
  `admin_device_media_removal_rollback_failed`.
- Confirm manual admin customer creation goes through `/api/admin/customers`,
  not a direct browser write to Supabase, requires a reason, rejects duplicate
  email addresses, defaults optional consents to false, and creates an audit
  event. If audit storage fails, the draft must roll back; if rollback fails,
  `admin_customer_draft_create_rollback_failed` urgent admin visibility must be
  stored. Confirm admin profile edits go through the customer API, require a
  reason, validate and normalize Swedish organisation numbers, validate billing
  email, postal code, and preferred contact channel, and audit changed-field
  evidence. If audit storage fails, customer profile edits must roll back the
  changed fields; if rollback fails,
  `customer_details_update_rollback_failed` urgent admin visibility must be
  stored.
- Confirm customer data export is available from the account legal section,
  downloads JSON through `/api/account/export`, and writes a
  `customer_data_export_downloaded` audit event.
- Confirm the admin Launch Readiness screen and live checkout gate verify the
  customer data export workflow before live payments, including authentication,
  rate limiting, no-store download headers, audit events, and exclusion of
  internal admin/provider metadata.
- Confirm admin accounting export is available from Orders, downloads CSV
  through `/api/admin/accounting-export`, sends no-store download headers, and
  writes an `admin_accounting_export_downloaded` audit event before returning
  the file; if audit storage fails, the export must fail closed.
- Confirm admin VAT summary export is available from Orders, downloads CSV
  through `/api/admin/vat-summary?format=csv`, sends no-store download headers,
  includes a total row, and writes an `admin_vat_summary_exported` audit event
  before returning the file; if audit storage fails, the export must fail
  closed.
- Confirm the admin Launch Readiness screen and live checkout gate verify the
  accounting and VAT export workflows before live payments, including admin
  authentication, CSV download headers, no-store caching, audit events, Stripe
  payment identifiers, customer billing/tax identifiers, and gross/VAT/net
  totals.
- Confirm admin tax payment records are created through
  `/api/admin/tax-payments`, require an admin reason, and write an
  `admin_tax_payment_recorded` audit event. If audit storage fails, the created
  tax payment record must be rolled back. If rollback fails,
  `admin_tax_payment_create_rollback_failed` urgent admin visibility must be
  stored.
- Confirm admin tax payment status updates go through
  `/api/admin/tax-payments/[taxPaymentId]`, require an admin reason, and write
  an `admin_tax_payment_updated` audit event when records move to submitted or
  paid. If audit storage fails, the tax payment update must be rolled back. If
  rollback fails, `admin_tax_payment_update_rollback_failed` urgent admin
  visibility must be stored.
- Confirm the admin Launch Readiness screen and live checkout gate verify the
  tax payment register before live payments, including admin authentication,
  no-store list responses, valid periods, non-negative whole-ore amounts,
  allowed statuses, paid payment references, reason-required actions, and
  before/after audit evidence for updates.
- Confirm operational fulfillment readiness passes before live payments: paid
  or active customers have active display devices, active devices have
  playlists, shipped/completed orders have tracking evidence, and the admin
  order API prevents shipped/completed orders from being saved without that
  evidence.

## Required QA before live payments

- `npm.cmd run text:check` to catch corrupted customer-facing Swedish text
  before email/legal/support copy reaches customers.
- `npm.cmd run lint`
- `npm.cmd run build`
- Full Stripe test checkout with VAT totals.
- Stripe invoice/receipt uses billing email when provided; account invite still
  goes to the customer account email.
- Stripe checkout rejects missing or invalid account, submitted, or billing
  email addresses before creating Stripe customer/session records.
- Stripe checkout rejects missing or invalid Swedish organisation numbers
  before creating Stripe customer/session records.
- Stripe checkout creation failures after customer/order context is known write
  a `stripe_checkout_failed` audit event and create an urgent admin
  notification for follow-up. If that audit or admin notification evidence
  cannot be stored, the checkout route must return a visible support error.
- Stripe checkout local sync failures after Stripe creates a customer or
  checkout session write `stripe_checkout_local_sync_failed`, create an urgent
  admin notification, and do not return the Stripe checkout URL to the customer.
  If that audit or admin notification evidence cannot be stored, the checkout
  route must return a visible support error and still withhold the Stripe URL.
- Stripe checkout must not return the Stripe checkout URL unless
  `stripe_checkout_started` audit evidence is stored. If that audit fails,
  Screenia must create urgent admin visibility with
  `stripe_checkout_started_audit_failed`.
- Recurring `invoice.paid` and `invoice.payment_failed` webhooks update the
  local subscription with the latest Stripe invoice id, total, and VAT/tax
  amount. A failed payment must suspend display access, and a later paid
  invoice must restore customers suspended by that failed payment when the
  Stripe subscription entitlement is active or active-until-period-end. Failed
  payment webhooks must fail for Stripe retry when customer suspension,
  subscription sync, audit storage, or urgent admin notification evidence
  cannot be stored. Paid invoice webhooks must also fail for Stripe retry when
  the customer/subscription match, local subscription update, entitlement sync,
  access restore, or required `subscription_invoice_paid` audit evidence cannot
  be stored.
- Stripe subscription update sync failures must create urgent admin visibility
  with `stripe_subscription_customer_sync_failed` or
  `stripe_subscription_local_sync_failed` evidence, and the webhook must fail
  for Stripe retry when customer entitlement sync, local subscription sync, no
  customer match, or required `subscription_synced` audit evidence cannot be
  stored.
- Customer account billing and admin customer orders show the latest payment
  status, Stripe invoice id, total, and VAT/tax amount for support matching.
- Onboarding legal evidence failure blocks the payment step.
- Legal before payment readiness: onboarding must store current terms/privacy
  consent records and legal agreement snapshots, and checkout must reject
  payment when current evidence is missing.
- Failed payment webhook.
- Invoice paid webhook.
- Subscription cancelled at period end. Final `customer.subscription.deleted`
  webhooks must fail for Stripe retry when customer matching, display-access
  blocking, local subscription cancellation, or required `subscription_cancelled`
  audit evidence cannot be stored.
- Duplicate Stripe webhook event returns as already handled and does not repeat
  side effects.
- Failed Stripe webhook processing creates an urgent admin notification.
- Stripe dispute webhook blocks display access, marks the payment disputed,
  writes an audit event, and creates an urgent admin notification. Dispute
  webhooks must fail for Stripe retry when customer matching, display-access
  blocking, local subscription sync, won-dispute entitlement restore, or
  required audit/admin notification evidence cannot be stored.
- Stripe won-dispute webhook writes an audit event, creates a high-priority
  admin notification, and syncs the subscription entitlement when the customer
  was suspended only because of the dispute.
- Stripe full external refund webhook marks access refunded, blocks display,
  writes an audit event, and creates an urgent admin notification. Refund
  webhooks must fail for Stripe retry when customer matching, refunded access
  blocking, local subscription sync, or required audit/admin notification
  evidence cannot be stored.
- Admin activate/reactivate, suspend, pause/resume, period-end cancellation,
  immediate cancellation, exposed Stripe cancellation route, and temporary
  discount actions reject missing or too-short admin reasons and store the
  reason in audit history. Local customer activation/reactivation and
  suspension must roll back customer entitlement and latest subscription status
  changes if audit evidence cannot be stored.
- Admin Stripe subscription operations create urgent admin visibility if Stripe
  succeeds but the local `customer_subscriptions` row cannot be updated or
  found. Customer-access sync failures and discount-adjustment storage failures
  after successful Stripe operations must return a non-success API response and
  create `admin_subscription_customer_sync_failed` urgent admin visibility. If
  Screenia cannot store urgent failure audit/notification evidence, the route
  must return a visible non-success response telling the admin to review the
  customer immediately.
- Successful admin Stripe subscription operations must store required success
  audit evidence before returning success. If the success audit cannot be
  stored, the route must create urgent admin visibility when possible and return
  a visible non-success response telling the admin to review the customer
  immediately.
- Refund before production work starts.
- Refund reason: missing or too-short admin reason returns `400`; valid refund
  stores the reason in Stripe metadata, audit event metadata, and notification
  metadata. If Stripe refund succeeds but local customer/subscription sync fails,
  Screenia must write `payment_refund_local_sync_failed` and create an urgent
  admin notification. If Stripe subscription cancellation fails after refund,
  Screenia must still mark local access refunded/blocked and create
  `payment_refund_subscription_cancel_failed` urgent admin visibility.
- Layout-start reason: missing or too-short admin reason returns `400`; valid
  layout start stores the reason in audit event metadata, syncs subscription
  fulfillment state, and requires audit storage before returning success. If
  fulfillment sync or audit storage fails, customer production/fee-lock state
  and subscription fulfillment state must roll back. If rollback fails,
  `layout_start_rollback_failed` urgent admin visibility must be stored; if
  that visibility cannot be stored, the admin must get a visible support error
  before retrying.
- Refund and production boundary readiness: missing production/refund columns,
  missing reason enforcement, missing audit metadata, or missing display-access
  blocking after refund fail the launch-readiness screen.
- Customer detail edits: invalid organisation number, billing email, or postal
  code returns `400`; missing or too-short admin reason returns `400`; valid
  admin edits are saved through the server API and create an audit event
  listing changed fields and the reason. If audit storage fails, changed
  customer fields are restored and the API returns an error. If rollback fails,
  urgent admin visibility must be created.
- Pricing edits: missing or too-short admin reason returns `400`; valid pricing
  save and Stripe sync actions store the reason in audit event metadata.
- Pricing readiness: active plans must have inclusive tax behavior, sane
  amounts/trial values, and setup/shipping/monthly Stripe price IDs before live
  payments.
- Order operations: missing or too-short admin reason returns `400`; valid
  status, fulfillment, inventory, and tracking updates create
  `admin_order_operation_updated` audit events. If audit storage fails, changed
  order operation fields are restored and the API returns an error. If rollback
  fails, urgent admin visibility must be created.
- Inventory operations: missing or too-short admin reason returns `400`; valid
  stock creation, stock edits, status changes, allocation to a new device, and
  linking to an existing device create admin audit events. Stock creation,
  stock detail edits, and stock status changes roll back if audit storage
  fails. If any stock or status rollback fails, urgent admin visibility must be
  created. Allocation/linking operations roll back device and inventory writes
  if audit storage fails, and rollback failures must create urgent admin
  visibility.
- Device operations: missing or too-short admin reason returns `400`; valid
  device creation, rename, detail update, activation/deactivation, deletion,
  media upload, and playlist removal create admin audit events. Device creation
  rollback failures create urgent admin visibility. Device creation, device
  updates, deletion, media upload, and playlist removal roll back if audit
  storage fails; rollback failures must create urgent admin visibility.
- Manual customer draft creation: invalid email, duplicate email, or missing
  admin reason returns an error; valid creation stores opt-in-safe consent
  defaults and creates an `admin_customer_draft_created` audit event.
- Customer data export: authenticated customers can download account,
  subscription, device, message, uploaded-material metadata, legal agreement,
  consent, and customer-visible audit records as JSON; internal admin notes,
  raw audit metadata, provider secrets, and full database row dumps are
  excluded through an explicit customer field allowlist; unauthenticated
  requests return `401`; repeated export requests are rate limited and
  rate-limit events are audited. If any source section cannot be loaded, the
  route must not return a partial export; it must write
  `customer_data_export_failed` and create an urgent admin notification.
- Data subject request workflow: authenticated customers can submit a privacy
  request ticket; the system creates a `data_subject_requests` record with a
  due date and writes `data_subject_request_received` with required audit
  storage before returning success; authenticated admins can
  list and update request status; invalid status or missing admin reason returns
  `400`; completion or rejection without outcome notes of at least 10
  characters returns `400`; valid updates write
  `data_subject_request_updated` with the computed changed-field list and
  before/after evidence. If audit storage fails after the status update,
  Screenia must roll back the data subject request update and return a visible
  error.
- Admin accounting export: authenticated admins can download the Orders CSV;
  unauthenticated requests return `401`; the CSV includes VAT/totals, order and
  customer identifiers, billing email, payment status, and Stripe invoice/session
  references, plus customer payment/access state and cancellation/refund reason
  evidence; the response uses no-store headers; every download creates an
  `admin_accounting_export_downloaded` audit event before the file is returned.
- Admin VAT summary export: authenticated admins can download the VAT period
  CSV; unauthenticated requests return `401`; invalid periods return `400`; the
  CSV includes only active paid subscription records, gross/net/VAT amounts,
  Stripe invoice references, and a `TOTAL` row; refunded/cancelled subscription
  rows are excluded from the normal paid VAT summary; the response uses no-store
  headers; every download creates an `admin_vat_summary_exported` audit event
  before the file is returned.
- Admin tax payment register: authenticated admins can list and create VAT/tax
  payment records; unauthenticated requests return `401`; invalid periods,
  invalid amounts, invalid status, or missing admin reason return `400`; valid
  records store payment evidence and create an `admin_tax_payment_recorded`
  audit event, rolling back the created record and creating urgent admin
  visibility if rollback fails.
  Authenticated admins can update existing records to submitted or
  paid; missing reason, missing payment reference, invalid status, or invalid
  paid-at date returns `400`; valid updates create an
  `admin_tax_payment_updated` audit event, rolling back the update if audit
  storage fails, including restored timestamp evidence and rollback-failure
  urgent admin visibility.
- Privacy incident workflow: authenticated admins can list, create, and update
  incidents; unauthenticated requests return `401`; missing title,
  description, severity, status, or admin reason returns `400`; valid create
  actions write `privacy_incident_created`, create an admin notification, and
  roll back the incident record if audit or notification evidence cannot be
  stored. Valid updates write `privacy_incident_updated` and roll back changed
  incident fields if audit or required follow-up notification evidence cannot be
  stored. Updates that escalate severity to high/critical or leave required
  authority/customer notifications unsent must create high/urgent admin
  notifications.
- Admin access review workflow: authenticated admins can list, create, and
  update admin access reviews; unauthenticated requests return `401`; invalid
  email, invalid status, or missing admin reason returns `400`; valid creates
  write `admin_access_review_recorded` and roll back the created record if
  audit or required MFA/access notification evidence cannot be stored; valid
  updates write `admin_access_review_updated` and roll back changed access
  evidence fields if audit evidence cannot be stored; records track MFA
  verification, access need, status, notes, and reviewed timestamp.
- Backup restore drill workflow: authenticated admins can list, create, and
  update recovery evidence; unauthenticated requests return `401`; invalid
  provider, scope, date, status, or missing admin reason returns `400`; valid
  creates write `backup_restore_drill_recorded` and roll back the created drill
  if audit or required urgent notification evidence cannot be stored; valid
  updates write `backup_restore_drill_updated` and roll back changed recovery
  evidence fields if audit evidence cannot be stored; records track provider,
  backup scope, successful backup date, restore-test date, evidence reference,
  notes, and status.
- Data retention review workflow: authenticated admins can list, create, and
  update retention decisions; unauthenticated requests return `401`; invalid
  record area, legal basis, retention reason, status, action, date, or missing
  admin reason returns `400`; valid creates write
  `data_retention_review_recorded` and roll back the created record if audit or
  required delete/anonymize notification evidence cannot be stored; valid
  updates write `data_retention_review_updated` and roll back changed retention
  fields if audit evidence cannot be stored; records track legal basis,
  retention-until date, recommended action, status, notes, and related
  customer/record ids.
- Processor compliance review workflow: authenticated admins can list, create,
  and update provider evidence; unauthenticated requests return `401`; invalid
  provider, processing purpose, date, status, or missing admin reason returns
  `400`; valid creates write `processor_compliance_review_recorded` and roll
  back the created record if audit or required follow-up notification evidence
  cannot be stored; valid updates write
  `processor_compliance_review_updated` and roll back changed provider evidence
  fields if audit evidence cannot be stored; records track DPA, security,
  account-owner, region/location, evidence reference, next review date, and
  status.
- Stripe financial-risk webhooks: disputed payments and full external refunds
  block display access immediately, won disputes are audited for review, and
  unmatched Stripe events fail for Stripe retry with urgent admin visibility.
- Operational fulfillment readiness: active/paid customers without active
  devices, active devices without playlists, or shipped/completed orders without
  tracking references fail the launch-readiness screen; the live checkout gate
  also verifies that admin order operations require tracking evidence before
  saving shipped/completed orders.
- Launch readiness: the Swedish organisation-number check fails if the checksum
  helper is broken or if any post-onboarding/payment customer record has a
  missing or invalid organisation number.
- Launch readiness: the data processor register check fails if Supabase,
  Stripe, Resend, Vercel, or Loopia is missing from the internal register or
  public privacy disclosure.
- Display entitlement allow/block matrix.
- Email delivery for onboarding, confirmation, support, and password flows.
- Transactional email workflow: onboarding-link, quote/onboarding, and public
  request confirmation emails use the shared sender helper; direct Resend calls
  must stay isolated in `src/lib/server/email.ts`; failed or unconfigured sends
  must create audit events and admin notifications, including network/runtime
  failures before Resend returns a response. Admin onboarding-link and
  quote/onboarding routes reject missing or too-short admin reasons before
  creating payment-path links.
- Resend delivery event workflow: Resend webhooks must verify Svix signatures
  using `RESEND_WEBHOOK_SECRET`, store duplicate-safe delivery events by
  `svix-id`, audit receipt, expose events to admins, and notify admins about
  bounces, complaints, failures, or unsubscribes.
- Legal change notice workflow: authenticated admins can list, create, and
  update policy/version notices; unauthenticated requests return `401`; invalid
  document type, version, summary, status, date, or missing admin reason returns
  `400`; valid creates write `legal_change_notice_recorded` and roll back the
  created notice if audit or required customer-notice follow-up evidence cannot
  be stored; valid updates write `legal_change_notice_updated`, notify admins
  when customer notice remains required, and roll back changed legal-notice
  fields if audit or notification evidence cannot be stored; records track
  notice requirement, re-acceptance requirement, effective date, sent date,
  evidence reference, and status.
- Customer support tickets: invalid attachments are rejected with `400`; valid
  messages create audit events and admin notifications. Attachment storage or
  metadata failures must remove partial ticket/file records, write
  `customer_message_attachment_failed`, create an urgent admin notification, and
  return an error instead of saving an incomplete ticket. Failure to store that
  attachment-failure audit or urgent admin notification must return a visible
  support error. Audit storage failure must remove the saved ticket and
  attachments and create `customer_message_audit_failed` urgent admin
  visibility; notification storage failure must write
  `customer_message_notification_failed` and return a visible error.
  Failure to store that fallback audit must also return a visible support error.
- Customer support ticket intake readiness: message/subject limits,
  attachment count/type/size checks, audit events, admin notifications, and
  privacy-request escalation must remain intact.
- Privacy request tickets: customer request type `privacy_request` creates a
  deadline-tracked data subject request record and urgent admin visibility if
  registration fails. If that register-failure notification cannot be stored,
  the customer must get a visible support error. If the data subject request
  receipt audit cannot be stored, the deadline register entry must roll back,
  `data_subject_request_audit_failed` urgent admin visibility must be stored,
  and the customer must get a visible support error if that visibility fails.
- Customer support replies: missing or too-short admin replies return `400`;
  valid replies create customer-visible ticket history, update the ticket state,
  send an email notification through the shared sender, and write audit events.
  Failed or unconfigured reply emails create urgent admin notifications.
  Support-message review/status updates reject missing or too-short admin
  reasons, write before/after audit evidence, and roll back if audit storage
  fails.
- Display material review: admin can mark uploaded material as new, reviewed,
  or archived; missing or too-short admin reason returns `400`; the update
  creates an audit event with before/after evidence, retains the internal note,
  and rolls back if audit storage fails. If audit storage fails,
  `customer_display_asset_review_audit_failed` urgent admin visibility must be
  stored; if that visibility cannot be stored, the admin must see a visible
  support error before retrying.
- Customer preview decision workflow: customer can approve the preview or
  request changes from the account setup section; the decision appears in
  history and updates the order fulfillment status. If fulfillment sync or
  audit storage fails, or the admin review notification cannot be stored, the
  decision history and customer/subscription status updates must roll back and
  create urgent admin visibility. If that urgent visibility cannot be stored,
  the customer must get a visible support error.
- Sensitive storage privacy: the `videos`, `customer-display-assets`, and
  `customer-message-files` buckets are private; display, customer account, and
  admin routes use signed URLs instead of public object URLs.
- Privacy incident register: record a test incident, move it to investigating,
  contained, and resolved, and verify audit events and admin notifications.
- Admin notifications: individual mark-read/mark-unread and mark-all-read
  actions update notification state, create audit events, and fail closed with
  verified rollback if audit storage fails. If rollback fails, urgent admin
  visibility must be created.
- Operational register updates must store the computed changed-field list, not
  helper/function references, alongside before/after audit evidence.
- Billing portal access: successful session creation is audited before the
  portal URL is returned, Stripe portal failures create urgent admin
  notifications, and audit/notification storage failures return visible
  non-success responses.
- Launch readiness: the billing portal workflow check fails if the account page
  cannot open the Stripe billing portal, successful sessions are not audited, or
  portal failures do not notify admins urgently.
- Customer anonymization removes the linked Supabase Auth login and blocks
  future customer-portal access for that identity.
- Customer anonymization/deletion safety: missing or too-short admin reason
  returns `400`; permanent deletion of customers with payment/Stripe history
  returns `409`; valid anonymization records the reason before removing auth
  access/private files and keeps accounting, order, and audit references
  traceable. Anonymization final-audit failures create urgent admin visibility.
  Permanent deletion writes `customer_deleted` before destructive deletes begin,
  fails closed if that audit event cannot be stored, and flags private storage
  cleanup failures as urgent admin incidents.
- Password reset abuse controls: repeated reset requests receive `429` after
  the configured threshold and do not reveal whether an email exists.
- Password reset email failure creates an urgent admin notification while the
  customer still receives the generic response.
- Login abuse controls: repeated customer/admin login attempts receive `429`
  after the configured threshold.
- Login readiness: failed logins, rate limits, admin-denied logins, and
  customer-unlinked logins create audit events without leaking account
  existence, role, or account-link state through the visible response.
- Landing-page spam controls: honeypot submissions do not create customers, and
  repeated requests receive `429` after the configured threshold.
- Landing-page privacy acknowledgement: missing acknowledgement returns `400`;
  valid requests store `privacy_request` consent before notifying admins.
- Consent defaults: a newly created draft customer has analytics, marketing,
  and remote-support consent set to `false` unless the customer actively opts in
  during onboarding.
- Customer consent management: authenticated customers can turn optional
  marketing, analytics, and remote-support consent on or off in the account
  legal section; each changed value writes a consent record and
  `customer_consent_settings_updated` audit event. Evidence storage failures
  roll back the changed consent flags and create
  `customer_consent_evidence_failed` urgent admin visibility.
- Cookie/tracking governance: launch readiness fails if common non-essential
  tracking providers are detected without a dedicated cookie/tracking consent
  mechanism; the cookie policy must state that non-essential tracking requires
  active consent. The scan must cover the app/source tree, not only the landing
  page, so analytics added in account, admin, or shared components cannot bypass
  the live-payment gate.
