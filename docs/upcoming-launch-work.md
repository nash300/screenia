# Screenia Upcoming Launch Work

Last updated: 2026-07-15

## Current Readiness Snapshot

- Launch readiness: 53 passed, 10 needs review, 0 blocked.
- Progress: about 84% strict readiness.
- Critical technical blockers are cleared for now; remaining items are manual/business/legal/service review gates.
- Detailed end-to-end testing should resume after domain, hosting, and email services are purchased/configured.

Critical validation checkpoint on 2026-07-14:

- `npm.cmd run lint` passed.
- `npm.cmd run text:check` passed.
- `npm.cmd run build` passed with Next.js 16.2.6.
- Admin operation readiness blockers were cleared locally: notification acknowledgement wording, audited customer draft creation wording, quote/onboarding reason wording, support/display review reason wording, deletion/anonymization reason wording, and reason-required subscription operation helpers.
- Local `/admin/launch-readiness` showed 52 passed, 11 needs review, 0 blocked after adding the explicit Vercel Pro / commercial hosting gate.
- The admin Launch Readiness page now shows a progress KPI, manual gates first, grouped readiness sections, and a clear sign-in/error state if the protected readiness API cannot be loaded.
- UI polish checkpoint on 2026-07-14:
  - Commit `270981c` polished admin and auth layouts.
  - Commit `8c96be9` polished customer-flow states for account loading/errors, onboarding start-link loading/invalid/expired states, and display-device loading/inactive/empty states.
  - `npm.cmd run text:check`, `npm.cmd run lint`, and `npm.cmd run build` passed after the customer-flow polish.
  - Focused browser checks found no horizontal overflow on `/account`, `/onboarding/test-token`, `/display/test-device`, `/onboarding/payment-success`, and `/onboarding/payment-cancelled`.
- No broad real-world testing loop is needed right now. Continue only with the service/account gates below until the external setup is complete.

Current critical next actions:

- Use `docs/real-world-testing-runbook.md` for the next full scenario pass.
- Use `.env.example` as the safe variable template for local/Vercel setup checks; it contains placeholders only and keeps live-payment gates false by default.

Production deployment checkpoint on 2026-07-15 03:06 Europe/Stockholm:

- Deployed the latest clean local state to Vercel production for online dummy-data scenario testing.
- Vercel production deployment `dpl_3599mQ6jNd2e5Z1BpWphrYZ1wH78` reached Ready.
- Production URL: `https://screenia-jck8upktg-nadeesha7314-1449s-projects.vercel.app`.
- Aliased to `https://screenia.se` and `https://www.screenia.se`.
- Verified `https://screenia.se` returned HTTP 200 with title `Screenia | Digital skyltning för företag i Sverige`.
- Verified the live page includes `service@screenia.se` and does not include `hello@screenia.se`.
- Verified unauthenticated `https://screenia.se/api/admin/launch-readiness` returns HTTP 401.
- Verified unauthenticated GET `https://screenia.se/api/onboarding-requests` returns HTTP 405.

Production deployment checkpoint on 2026-07-14 17:04 Europe/Stockholm:

- Production was redeployed from the local `C:\Users\nadee\Desktop\screenia` worktree after standardizing the email identities.
- Vercel production deployment `dpl_Fg8z37KoGeBfy6zmGEtndkyamwRY` reached Ready.
- `https://screenia.se` is aliased to `https://screenia-e479m5nqd-nadeesha7314-1449s-projects.vercel.app`.
- Production env audit confirms:
  - `RESEND_FROM_EMAIL=Screenia <service@screenia.se>`
  - `RESEND_NEWSLETTER_FROM_EMAIL=Screenia <info@screenia.se>`
  - `NEXT_PUBLIC_COMPANY_EMAIL=service@screenia.se`
- Live HTML check confirms `service@screenia.se` is present and `hello@screenia.se` is absent.
- Verify human mailbox delivery both ways: Gmail to `service@screenia.se`, then `service@screenia.se` to Gmail with spam-placement check.
- Verify the Supabase Auth account activation/password path end to end before marking `SCREENIA_SUPABASE_AUTH_EMAIL_VERIFIED=true`.
- Upgrade/use Vercel Pro before real commercial production, and reconnect GitHub-to-Vercel deploys when GitHub OAuth allows it.
- Keep Stripe in test mode until business registration, VAT/tax decision, legal review, and live webhook verification are done.
- Keep the long checkout/subscription/display test pass for after the mailbox, auth, and live-service gates above are ready.

## Next Services To Finish

Current service setup progress: about 95%.

### Service Purchase And Setup Runbook

Current deployment status:

- Vercel project `screenia` was created on the Hobby plan for setup/testing.
- Production deployment is live at `https://screenia.se`.
- Launch-readiness production check on 2026-07-15:
  - Fixed production readiness API crash caused by Vercel not bundling dynamically-read source/doc files.
  - Deployment `dpl_8krGRzft1EHUpDkYoGtcNXui2jez` is aliased to `https://screenia.se`.
  - Initial visible browser result after the API fix: 52 passed, 10 review warnings, 1 blocked, 83% progress.
  - The blocked item was operational fulfillment: one active display device had no playlist.
  - Uploaded the existing QA MP4 asset through the admin media API for device `QRWXVA`, creating playlist `4b0e1b0e-4a95-4717-80b4-86e074e87432`.
  - Verified `/api/display/QRWXVA/playlist` returns HTTP 200 with one signed playlist item.
  - Final visible browser result: 53 passed, 10 review warnings, 0 blocked, 84% progress.
  - QA admin login uses `admin@screenia.se`; the requested password `12345` is not allowed by Supabase's 6-character minimum, so the temporary QA password was set to `Screenia12345`.
  - Customer portal/billing/display QA on 2026-07-15:
    - Active Premium 4K QA customer `10000044` logged in with a direct temporary Supabase Admin password for portal testing.
    - Customer account overview and billing page rendered correct Premium 4K status and prices: first payment `2 797 kr`, monthly price `349 kr`, latest VAT `559,40 kr`.
    - Stripe billing portal opened for the QA customer and showed the trial subscription, invoice history, card `4242`, and billing details.
    - `/display/QRWXVA` rendered one playing muted video at 1280x720.
    - Stripe account/customer-portal branding still says `New business sandbox`; update Stripe branding to Screenia before real customer tests.
    - This is not the final Supabase Auth email-link proof, because the password was set directly for QA.
  - Customer portal/admin visibility/display entitlement regression QA on 2026-07-15:
    - `service@screenia.se` was temporarily pointed back to active customer `10000044` and tested with QA password `ScreeniaCustomer123`.
    - Customer portal login, support ticket creation, display-material text submission, full content setup submission, data export, consent update, and Stripe billing portal creation passed against production.
    - Admin customer communication showed ticket `IS-260715-084E99`; uploaded-media view showed the new text material and corrected content setup notes with timestamps.
    - Found a real display regression after content setup: `customers.status=content_received` made `/display/QRWXVA` show `Display inactive` even though payment/access fields were active.
    - Fixed `src/lib/server/subscription-entitlements.ts` so display entitlement is driven by `payment_status` plus `service_access_status`, with explicit blocked customer states, rather than requiring the workflow status to equal `active`.
    - Production deployment `dpl_3QF4CJEXaDpKcd4dDmyGSaxuAqpm` was aliased to `https://screenia.se`; `/api/display/QRWXVA/playlist` returned HTTP 200 and visible `/display/QRWXVA` played one muted 1280x720 video again.
    - Launch readiness remained `53 passed`, `10 review`, `0 blocked`.
  - Password reset and login-boundary QA on 2026-07-15:
    - Visible customer login reset request worked: after entering `service@screenia.se`, `Glömt lösenord?` enabled and showed the generic reset-link message.
    - `POST /api/auth/password-reset` for invalid email returned the same generic HTTP 200 response.
    - `service@screenia.se` reset request created audit event `password_reset_email_requested` at `2026-07-15T16:24:28.973151+00:00`; Supabase Auth user updated at `2026-07-15T16:24:28.786072Z`.
    - Found that valid admin credentials on the customer login endpoint redirected to `/admin`.
    - Fixed `src/app/api/auth/login/route.ts` so admin accounts must use `/admin-login`; customer-mode admin attempts now sign out, audit `admin_login_wrong_surface`, and return the generic login error.
    - Production deployment `dpl_e1J67wHxnRucFsnNg85tXnJk4pjT` was aliased to `https://screenia.se`.
    - Retest passed: admin-on-customer login returns HTTP 401, admin-on-admin login returns HTTP 200, customer-on-admin login returns HTTP 401, wrong customer password returns HTTP 401, display playlist still returns HTTP 200, and launch readiness remains `53 passed`, `10 review`, `0 blocked`.
  - Admin support reply and delivery QA on 2026-07-15:
    - Admin replied to active customer ticket `IS-260715-084E99`; reply message `13a69cbf-1fe2-4fef-bf98-28b6f8cf30d1` was created with status `waiting_for_customer`.
    - Original support ticket `e8c626e9-38f1-41a9-a653-6c263c9f6866` also moved to `waiting_for_customer`.
    - Audit events `customer_support_reply_sent` and `customer_support_reply_email_sent` were stored.
    - Resend email id `489cb91d-ffc0-4f3c-8cd4-c9a29193a509` reached both `email.sent` and `email.delivered` in the webhook ledger for `service@screenia.se`.
    - Customer portal message history, admin customer communication, and admin Email Events page all visibly showed the reply/delivery evidence.
    - Display playlist smoke remained HTTP 200 and launch readiness stayed `53 passed`, `10 review`, `0 blocked`.
  - Customer privacy/data-subject request QA on 2026-07-15:
    - Customer submitted privacy request ticket `IS-260715-430977` from the account portal; customer history showed type `Integritet eller personuppgifter`, priority `Hög`, and status `Nytt`.
    - Data-subject request `bcc2729d-57a9-43d3-8d40-6291731528ad` was created from source message `2c8b8643-4577-4027-a10a-3d1f4e2af5ef` with due date `2026-08-14T16:37:02.805+00:00`.
    - Audit events `customer_message_sent`, `data_subject_request_received`, and trigger insert evidence were stored, plus a high-priority admin notification.
    - Authenticated admin API returned the request in `/api/admin/data-subject-requests`.
    - Admin update moved it to `in_progress` with a QA note and stored `data_subject_request_updated` audit evidence with before/after fields and reason.
    - Display playlist smoke remained HTTP 200 and launch readiness stayed `53 passed`, `10 review`, `0 blocked`.
  - VAT/tax payment register QA on 2026-07-15:
    - Admin created tax payment record `fd736f0c-68f4-4a95-bf59-620743731742` for `2026-07-01` to `2026-08-01`, taxable amount `223760` ore, VAT `55940` ore, status `draft`.
    - Audit `admin_tax_payment_recorded` was stored with period, amount, and admin reason metadata.
    - Admin updated the same record to `paid` with paid-at `2026-07-15T16:45:00+00:00`, reference `QA-VAT-202607-SCREENIA-TEST`, and QA notes.
    - Audit `admin_tax_payment_updated` stored changed fields plus before/after values and reason.
    - Authenticated admin `GET /api/admin/tax-payments` listed the paid record; visible `/admin/tax-payments` redirected to `/admin-login` without an admin browser session, confirming page protection.
    - Display playlist smoke remained HTTP 200 and launch readiness stayed `53 passed`, `10 review`, `0 blocked`.
  - Backup/restore drill QA on 2026-07-15:
    - Admin created backup drill `cb59c489-43f8-4afa-9a9e-d5aea5df7549` with evidence `QA-BACKUP-20260715165004`, then updated it from `backup_verified` to `restore_tested`.
    - Audit events `backup_restore_drill_recorded` and `backup_restore_drill_updated` were stored with reason, changed fields, and before/after metadata.
    - Admin created needs-attention drill `160e1bd0-0c6e-4abf-aff0-384e61a5bf84` with evidence `QA-BACKUP-ATTENTION-20260715165004`.
    - Urgent admin notification `1190bc82-e1b3-4642-892b-9dd2dc27ba8d` was created for the needs-attention drill.
    - Visible `https://screenia.se/admin/backup-drills` showed both records and the `1 need evidence` badge.
    - Display playlist smoke remained HTTP 200 and launch readiness stayed `53 passed`, `10 review`, `0 blocked`.
  - Privacy incident register QA on 2026-07-15:
    - Admin created high-severity incident `60789a3e-a41b-4a06-9766-66b5866413a6` with authority/customer notification required.
    - Admin moved the incident through `detected`, `investigating`, `contained`, and `resolved`, adding containment notes and notification timestamps.
    - Audit events `privacy_incident_created` and `privacy_incident_updated` were stored with before/after values and admin reasons.
    - Urgent admin notifications were created while the high-severity incident still needed follow-up; no follow-up notification was created after final resolution.
    - Visible `https://screenia.se/admin/privacy-incidents` showed the incident as `high`, `resolved`, `Authority: yes`, `Customer: yes`, and `0 open`.
    - Display playlist smoke remained HTTP 200 and launch readiness stayed `53 passed`, `10 review`, `0 blocked`.
  - Data retention review QA on 2026-07-15:
    - Admin created support-message retention review `506a6b37-b306-4c7c-8d89-494afa07ec6e` for customer `a0fe0b3d-d3f4-45a5-9316-1e0bc8588009` and related ticket `IS-260715-430977`.
    - Initial recommended action `anonymize` created high-priority notification `8a8f5218-2eef-4c8d-aeef-db2ba823d532`.
    - Admin updated the review to `retain` and then to `completed`, with audit events `data_retention_review_recorded` and `data_retention_review_updated` storing reasons and before/after metadata.
    - Found and fixed a completed-row UI issue: completed retention reviews no longer show Retain/Anonymize/Complete controls, and instead show `Completed`.
    - Production deployment `dpl_DjbeKayKLu871tzpkYXMjimkuD9J` was aliased to `https://screenia.se` after the fix.
    - Post-deploy smoke checks passed: display playlist HTTP 200, login HTTP 200, unsigned Stripe webhook HTTP 400 `Missing signature`, and launch readiness 53 pass / 10 warning / 0 fail.
  - Processor compliance review QA on 2026-07-15:
    - Admin created Vercel processor review `47b90289-4a97-45f1-b72b-ec70cec92819` with evidence `QA-PROCESSOR-VERCEL-20260715170524`.
    - The initial `needs_review` state with incomplete DPA/account-owner evidence created high-priority notification `eebe9383-d1cb-4a23-be44-7de1735680ce`.
    - Admin approved the review with DPA/security/account-owner all verified and next review due `2027-07-15`.
    - Audit events `processor_compliance_review_recorded` and `processor_compliance_review_updated` were stored with reasons and before/after metadata.
    - Found and fixed an approved-row UI issue: fully approved processor reviews no longer show Approve/Needs review/Disabled controls, and instead show `Approved`.
    - Production deployment `dpl_CusYPT6dBbtvd2JqXxdu8LZcNGc9` was aliased to `https://screenia.se` after the fix.
    - Post-deploy smoke checks passed: display playlist HTTP 200, login HTTP 200, unsigned Stripe webhook HTTP 400 `Missing signature`, and launch readiness 53 pass / 10 warning / 0 fail.
  - Admin access review QA on 2026-07-15:
    - Admin created access review `45892266-6ed7-4dbe-b97a-00e26ff62476` for `admin@screenia.se` / auth user `d3078ba0-133c-4146-b0de-ab62a1c6f310`.
    - Initial `needs_review` state with missing MFA evidence created high-priority notification `c2edd6ec-0c3a-48cd-8663-afaf55f52983`.
    - Admin approved the review with MFA/access evidence and reviewed timestamp `2026-07-15T17:12:27.91+00:00`.
    - Audit events `admin_access_review_recorded` and `admin_access_review_updated` were stored with reasons, reviewed-by id, and before/after metadata.
    - Found and fixed an approved-row UI issue: fully approved access reviews no longer show Approve/Needs review/Removed controls, and instead show `Approved`.
    - Production deployment `dpl_13HxtyitzkGBfRrZ1gkfbJEFvY41` was aliased to `https://screenia.se` after the fix.
    - Post-deploy smoke checks passed: display playlist HTTP 200, login HTTP 200, unsigned Stripe webhook HTTP 400 `Missing signature`, and launch readiness 53 pass / 10 warning / 0 fail.
  - Legal change notice QA on 2026-07-15:
    - Admin created terms notice `97a0e285-ed2a-4cb6-af72-db1ae8612248` for version `qa-terms-20260715171949`, with customer notice and re-acceptance required.
    - Admin moved it from `draft` to `approved` to `sent`, with sent timestamp `2026-07-15T17:19:52.75+00:00` and evidence `QA-LEGAL-SENT-20260715171949`.
    - Audit events `legal_change_notice_recorded` and `legal_change_notice_updated` were stored with reasons and before/after metadata.
    - High-priority notifications were created while customer notice was required but unsent; no additional follow-up notification was created after `sent`.
    - Found and fixed a sent-row UI issue: sent legal notices no longer show Approve/Sent/Needs review controls, and instead show `Sent`.
    - Production deployment `dpl_Zj7AL573qGTkigTAYvuwmDC9Rqgg` was aliased to `https://screenia.se` after the fix.
    - Post-deploy smoke checks passed: display playlist HTTP 200, login HTTP 200, unsigned Stripe webhook HTTP 400 `Missing signature`, and launch readiness 53 pass / 10 warning / 0 fail.
  - Pause/resume QA on 2026-07-15:
    - Pausing Premium 4K subscription `sub_1TtHxgGhi0eDHRQZnv0vnynm` set Stripe `pause_collection.behavior=void`, local subscription/customer access to paused, and blocked `/display/QRWXVA`.
    - Resuming the same subscription cleared Stripe pause collection, restored active local/customer access, and restored visible display playback.
    - Audit events `subscription_paused` and `subscription_resumed` were stored with admin reasons.
    - Repeated QA admin password logins triggered the login rate limiter, so future automated admin tests should reuse a session.
  - Scheduled cancellation QA on 2026-07-15:
    - Scheduling period-end cancellation set Stripe `cancel_at_period_end=true`, local `cancel_at_period_end=true`, and customer `service_access_status=active_until_period_end` through `2026-08-05T01:50:10Z`.
    - Display playback stayed active while the subscription was scheduled to cancel at period end.
    - Undoing the scheduled cancellation cleared Stripe/local/customer cancellation fields and launch readiness remained `53 passed`, `10 review`, `0 blocked`.
    - Audit events `subscription_cancel_scheduled` and cleanup `subscription_resumed` were stored with admin reasons.
  - Failed-payment/recovery QA on 2026-07-15:
    - A signed Stripe failed-payment test event suspended customer `10000044`, set `service_access_status=payment_failed`, created urgent admin/audit evidence, and made production `/display/QRWXVA` show `Display inactive`.
    - A paid-invoice recovery test restored customer/display access and verified the local subscription returns to `fulfillment_status=layout_started` after the webhook recovery fix.
    - Production webhook signing stayed protected: an event signed with the stale local secret was rejected with HTTP 400 before the local connected-services test was used.
    - Production deployment `dpl_CzYPFEbnZ5VEX1yRWuj5ytKh7WLZ` was aliased to `https://screenia.se` after the webhook recovery fix.
    - Post-deploy smoke checks passed: display playlist HTTP 200, login HTTP 200, unsigned Stripe webhook HTTP 400 `Missing signature`, visible display playback restored, and launch readiness remained 53 pass / 10 warning / 0 fail.
  - Billing/refund QA on 2026-07-15:
    - Temporary discount lifecycle passed: a 15% / 2 month discount was applied and removed through the production admin API, with Stripe/local/audit evidence and display access remaining active.
    - Refund boundary passed: the layout-started customer returned HTTP 409 for automatic refund, while a separate paid-before-layout Premium 4K test customer refunded `2 797 kr`, canceled its trialing Stripe subscription, and moved local access to refunded/suspended.
    - Stripe refund webhook de-duplication was fixed and verified locally by replaying the same refund id twice without creating new duplicate audit/notification rows.
    - Production deployment `dpl_CFp597dXQr2M6Wy3taAqdeo5URo8` was aliased to `https://screenia.se` after the refund webhook de-duplication fix.
    - Post-deploy smoke checks passed: display playlist HTTP 200, login HTTP 200, and unsigned Stripe webhook HTTP 400 `Missing signature`.
  - Dispute/chargeback QA on 2026-07-15:
    - Signed local Stripe dispute-open events suspended customer `10000044`, set `service_access_status=payment_disputed`, updated the local subscription to disputed/payment failed, recorded admin/audit evidence, and blocked production display access.
    - Signed local Stripe won-dispute recovery events now restore customer status, payment status, service access, cancellation source, subscription status, and display playback while preserving `fulfillment_status=layout_started`.
    - Production deployment `dpl_AL3AHsKEM5FrH2gg9XbqjGynLaJJ` was aliased to `https://screenia.se` after the dispute recovery fix.
    - Post-deploy smoke checks passed: display playlist HTTP 200, visible display playback active, login HTTP 200, unsigned Stripe webhook HTTP 400 `Missing signature`, launch readiness 53 pass / 10 warning / 0 fail, accounting export HTTP 200, and VAT summary HTTP 200.
  - Stripe pricing cleanup on 2026-07-15:
    - Stripe test mode now has exactly 8 active prices, all referenced by Supabase `pricing_plans` and all `tax_behavior=inclusive`.
    - Dedicated setup-fee products/prices were created for Standard FHD and Premium 4K, replacing old setup prices that were attached to monthly subscription products.
    - A Premium 4K dry-run Checkout session was created and immediately expired; line items showed setup `1 599 kr`, device `1 099 kr`, shipping `99 kr`, monthly subscription `0 kr` during trial, and first payment total `2 797 kr`.
    - System audit events were written for the Stripe pricing cleanup.
  - Stripe branding/static-checkout cleanup on 2026-07-15:
    - Stripe dashboard account name now shows `Screenia`; branding colors are set to Screenia blue/navy.
    - Billing portal headline, privacy URL, and terms URL are set for Screenia.
    - The app checkout route was updated to use the 8 existing Stripe price IDs for standard checkouts instead of creating new dynamic Stripe products/prices.
    - Local disposable route test session `cs_test_b1MtsxqnUs1WmwDzMDtZjw4P6QycfL2yrLK7RaugtKw2vw3JehyRmawpV3` used the expected Premium 4K static price IDs and created no new active prices.
    - Production deployment `dpl_BSr9N6ME8Dvq1g3scJvEexVRafSo` was aliased to `https://screenia.se` after the static checkout route fix.
    - Post-deploy smoke checks passed: login HTTP 200, display playlist HTTP 200, unsigned Stripe webhook HTTP 400, launch readiness 53 pass / 10 warning / 0 fail, pricing API with expected Stripe price IDs, accounting export HTTP 200, and VAT summary HTTP 200.
    - Remaining Stripe branding polish: upload logo/icon in Stripe Dashboard before real customer payments.
  - Fresh Premium 4K repeat QA on 2026-07-15:
    - A live visitor request, admin quote, onboarding form, Stripe Checkout payment, tax evidence, account setup email request, and admin refund cleanup were completed for customer `10000057` / order `1000000043`.
    - Premium 4K pricing matched the confirmed business model: setup `1 599 kr`, device `1 099 kr`, shipping `99 kr`, first payment `2 797 kr`, monthly subscription `349 kr` after a 21-day trial, all prices including Swedish moms.
    - Found and fixed duplicate-email Supabase Auth relinking: an existing auth user for another customer now records `customer_auth_user_conflict`, creates an urgent admin notification, and does not reassign login metadata.
    - Production deployment `dpl_GGo1FvUACVwxvhXCoaA8JGRxHJgX` was aliased to `https://screenia.se` after the duplicate-email guard.
    - Disposable paid test customer was refunded before production work started; Stripe refund `re_3TtYPoGhi0eDHRQZ0UIS8f7l` succeeded and the trialing subscription was cancelled.
    - Post-deploy smoke checks passed: login HTTP 200, authenticated customer account returned the original active customer `10000044`, display playlist HTTP 200, unsigned Stripe webhook HTTP 400, and launch readiness 53 pass / 10 warning / 0 fail.
  - Unique-email activation QA on 2026-07-15:
    - A fresh Premium 4K customer `10000058` used `service+activation-20260715193724@screenia.se`, completed onboarding, paid Stripe Checkout, created a password, logged in from `/login`, and was then refunded/cancelled before layout work started.
    - Customer billing and admin screens both showed the confirmed VAT-inclusive model: first payment `2 797 kr`, monthly `349 kr`, latest included VAT `559,40 kr`, 21-day trial.
    - Password validation rejected `abcdef` and accepted `Screenia123`, proving the 6-character letters-plus-numbers rule in the customer-facing page.
    - Account setup email was delivered by Resend, but Zoho Mail was signed out, so literal mailbox-click proof remains a manual gate before setting `SCREENIA_SUPABASE_AUTH_EMAIL_VERIFIED=true`.
    - Cleanup succeeded: Stripe refund `re_3TtYjmGhi0eDHRQZ1luyPVXW` fully refunded `2 797 kr`, subscription `sub_1TtYjoGhi0eDHRQZbRDrbds4` was cancelled, and local order `1000000044` moved to refunded/cancelled.
    - Smoke checks stayed green: login HTTP 200, display playlist HTTP 200, unsigned Stripe webhook POST HTTP 400 `Missing signature`, and launch readiness 53 pass / 10 warning / 0 fail.
  - Final manual gate review on 2026-07-15:
    - Production readiness remains `53 passed`, `10 review`, `0 blocked`, with live payments intentionally disabled.
    - Stripe test mode has active Swedish tax registration, exactly 8 active SEK prices, and every active price is `tax_behavior=inclusive`.
    - Stripe branding still needs logo/icon upload and the Stripe business/support profile still needs final company details before real payments.
    - Vercel project `screenia` points to `https://screenia.se`; core production env vars are present, while company org/address and live-payment flags remain intentionally unset.
    - DNS MX points to Zoho and DMARC exists; the current Resend key is send-only, so Resend domain/DKIM status must be checked in the Resend dashboard or with a read-capable key.
    - Legal PDFs and public policy pages return HTTP 200, but active Supabase legal versions are still `2026-07-12-prelaunch`; final legal review/versioning remains open.
    - Use `npx.cmd vercel ...` on this Windows machine because PowerShell blocks `npx.ps1`.
  - Zoho mailbox-click proof recheck on 2026-07-15:
    - Zoho Mail still redirected to the Zoho Accounts sign-in page instead of the inbox.
    - The remaining proof is external-account gated: sign in to Zoho, open the actual setup/reset email, click the link, and confirm it reaches the Screenia password page.
    - Do not set `SCREENIA_SUPABASE_AUTH_EMAIL_VERIFIED=true` until that literal mailbox-click proof is complete.
  - Zoho mailbox-click proof completed on 2026-07-16:
    - Zoho inbox was signed in as `admin@screenia.se`.
    - A fresh Screenia password reset email appeared in Zoho at `12:08 AM`, addressed to `service+activation-20260715193724@screenia.se`.
    - The actual email link landed on `https://screenia.se/account/reset-password` with the customer password form visible and no expired-link error.
    - `SCREENIA_SUPABASE_AUTH_EMAIL_VERIFIED=true` was added to Vercel production and production was redeployed as `dpl_7DRuG53sETkuSwPPBDWwvgMAVT2B`.
    - Post-deploy readiness improved to `54 passed`, `9 review`, `0 blocked`; the Supabase Auth email verification check now passes.
- Vercel environment variables were added for production, preview, and development.
- Production `NEXT_PUBLIC_APP_URL` now points to `https://screenia.se`.
- Vercel environment metadata audit on 2026-07-14:
  - Core Supabase, Stripe, Resend, app URL, company legal name, and company email variables exist in Vercel.
  - `NEXT_PUBLIC_COMPANY_ORG_NUMBER` and `NEXT_PUBLIC_COMPANY_ADDRESS` are not set in Vercel yet. This is intentional until the Swedish business registration/legal identity is ready, and it explains the remaining company identity review gate.
  - Live-payment confirmation flags are not set yet: `SCREENIA_LIVE_PAYMENTS_ENABLED`, `SCREENIA_BUSINESS_REGISTRATION_CONFIRMED`, `SCREENIA_VERCEL_PRO_CONFIRMED`, `SCREENIA_VAT_DECISION_CONFIRMED`, `SCREENIA_LEGAL_REVIEW_CONFIRMED`, `SCREENIA_LIVE_WEBHOOK_VERIFIED`, and `SCREENIA_SUPABASE_AUTH_EMAIL_VERIFIED`. Keep them unset/false until each item is actually verified.
- Temporary Vercel CLI token `screenia-local-deploy` was created for setup and then revoked after deployment.
- GitHub App access was limited to `nash300/screenia`.
- GitHub login connection in Vercel is still blocked by GitHub OAuth (`Authorize` disabled), so current deployment was done from local CLI. Reconnect GitHub later so future pushes deploy automatically.
- `screenia.se` was added to the Vercel project.
- Loopia nameserver panel showed Vercel nameservers after update attempt: `ns1.vercel-dns.com` and `ns2.vercel-dns.com` (order does not matter).
- Public DNS still showed Loopia nameservers on 2026-07-13 at 20:37 Europe/Stockholm after the Vercel domain setup; re-check after propagation.
- Loopia Kundzon direct verification currently requires logging in again before nameserver settings can be rechecked in the browser.
- Loopia Kundzon was rechecked on 2026-07-13 at 20:49 Europe/Stockholm after login:
  - `screenia.se` still appeared as `Parkerad`.
  - The nameserver fields showed Vercel values: `ns2.vercel-dns.com` and `ns1.vercel-dns.com` (order is not important).
  - `Tvinga ändring?` was checked.
  - Clicking `Byt namnservrar` twice returned Loopia's backend error: `Hoppsan, nu gick något fel i bakgrunden. Försök gärna igen!`
  - Public DNS still showed `ns1.loopia.se` and `ns2.loopia.se` from Cloudflare and Google after the failed re-save attempts.
- Public DNS moved to Vercel nameservers on 2026-07-13 at 21:42 Europe/Stockholm:
  - Cloudflare and Google returned `ns1.vercel-dns.com` and `ns2.vercel-dns.com`.
  - `screenia.se` resolved to Vercel IPs.
- Vercel domain setup now has `screenia.se` valid for production and `www.screenia.se` redirecting permanently (`308`) to `screenia.se`.
- Production was redeployed after updating `NEXT_PUBLIC_APP_URL`; latest Vercel deployment id prefix shown in Vercel was `7wHaL5ZE7`.
- Production was redeployed again after updating the Stripe deployed webhook secret; the redeploy of `7wHaL5ZE7` reached Ready.
- Production was redeployed again after correcting production `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_COMPANY_EMAIL`, and `RESEND_FROM_EMAIL`; deployment `dpl_A6BwQHZjUPbeWnGn56aPRAzecD4f` reached Ready and was aliased to `https://screenia.se`.
- Production was redeployed again on 2026-07-14 after the Screenia visual refresh; deployment `dpl_5SphRo8dkhtKR8ofZZG2xAiFDUvo` reached Ready and was aliased to `https://screenia.se`.
- Production was redeployed again on 2026-07-14 after clearing admin readiness blockers; deployment `dpl_4gdtJgpwTbFPtrXog4sBB6sDMbJa` reached Ready and was aliased to `https://screenia.se`.
- Production was redeployed again on 2026-07-14 after admin/auth/customer-flow polish; deployment `dpl_ckydJBryTgA39BfKKUY67a51wsSs` reached Ready and was aliased to `https://screenia.se`.
- Production was redeployed again on 2026-07-14 after Launch Readiness progress/manual-gate tracking; deployment `dpl_5HdcasubrUvds2m7z7Ybju3fgVDm` reached Ready and was aliased to `https://screenia.se`.
- Production was redeployed again on 2026-07-14 after standardizing Screenia email identities; deployment `dpl_GL8BAj5o5SFYdQN7pxuRQpTWCJaj` reached Ready and was aliased to `https://screenia.se`.
- Latest production smoke checks after deployment `dpl_GL8BAj5o5SFYdQN7pxuRQpTWCJaj`:
  - `https://screenia.se` returned HTTP 200 and included `service@screenia.se`.
  - `https://screenia.se/login` returned HTTP 200.
  - `https://screenia.se/api/admin/launch-readiness` returned HTTP 401 when unauthenticated.
- Latest production smoke checks after deployment `dpl_5HdcasubrUvds2m7z7Ybju3fgVDm`:
  - `https://screenia.se/login` returned HTTP 200.
  - `https://screenia.se/admin/launch-readiness` redirected unauthenticated visitors with HTTP 307.
  - `https://screenia.se/api/admin/launch-readiness` returned HTTP 401 when unauthenticated, confirming the protected admin readiness API still blocks public access.
- Latest production smoke checks after deployment `dpl_ckydJBryTgA39BfKKUY67a51wsSs`:
  - `https://screenia.se/display/test-device` returned HTTP 200, included `Preparing display`, and visually showed the new full-screen display status card with no horizontal overflow.
  - `https://screenia.se/onboarding/test-token` returned HTTP 200 and included the new start-link loading copy.
  - `https://screenia.se/login` returned HTTP 200 and included the Screenia customer portal login copy.
  - `https://screenia.se/account` returned HTTP 200 and included the customer portal loading copy.
- Real-domain smoke checks passed after redeploy:
  - `https://screenia.se` returned HTTP 200 with the Screenia title.
  - `https://www.screenia.se` returned HTTP 308 to `https://screenia.se/`.
  - `https://screenia.se/robots.txt` returned `Host: https://screenia.se` and `Sitemap: https://screenia.se/sitemap.xml`.
  - `https://screenia.se/sitemap.xml` used `https://screenia.se` URLs and no longer referenced `screenia-ten.vercel.app`.
  - `https://screenia.se/login` returned HTTP 200 and included the refreshed Screenia auth styling.
  - `https://screenia.se/api/admin/launch-readiness` returned HTTP 401 when unauthenticated, confirming the protected admin readiness API still blocks public access.
- Public DNS and mail record audit on 2026-07-14:
  - `screenia.se` nameservers resolve to `ns1.vercel-dns.com` and `ns2.vercel-dns.com`.
  - `screenia.se` resolves to Vercel A records `216.198.79.65` and `64.29.17.65`.
  - `www.screenia.se` resolves to Vercel A records and redirects with HTTP 308 to `https://screenia.se/`.
  - Root mailbox MX records point to Zoho EU: `mx.zoho.eu` priority 10, `mx2.zoho.eu` priority 20, and `mx3.zoho.eu` priority 50.
  - Root SPF is `v=spf1 include:zohomail.eu ~all`, keeping normal human mailbox sending on Zoho.
  - Zoho verification TXT and `zmail._domainkey.screenia.se` DKIM are publicly visible.
  - Resend return-path records stay isolated on `send.screenia.se`: MX `feedback-smtp.eu-west-1.amazonses.com` priority 10 and SPF `v=spf1 include:amazonses.com ~all`.
  - Resend DKIM selector `resend._domainkey.screenia.se` is publicly visible.
  - DMARC is `v=DMARC1; p=none;`, which is suitable for launch testing and monitoring before tightening policy.
- Production security and webhook rejection audit on 2026-07-14:
  - `https://screenia.se` returns the configured security header baseline: HSTS, `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: origin-when-cross-origin`, `Permissions-Policy`, and `X-DNS-Prefetch-Control: on`.
  - Content Security Policy is not currently part of Screenia's configured launch-readiness header baseline.
  - `https://screenia.se/login` returns no-store cache headers.
  - `https://screenia.se/api/account` returns HTTP 401 when unauthenticated.
  - `https://screenia.se/api/admin/launch-readiness` returns HTTP 401 when unauthenticated.
  - `https://screenia.se/api/admin/customers` does not expose a public GET surface and returns HTTP 405 to unauthenticated GET.
  - Unsigned `POST https://screenia.se/api/stripe/webhook` returns HTTP 400 with missing-signature handling.
  - Unsigned/invalid `POST https://screenia.se/api/resend/webhook` returns HTTP 400 with invalid-webhook handling.
- Customer-facing production page audit on 2026-07-14:
  - `https://screenia.se/terms`, `/privacy`, `/cookie-policy`, `/subscription-billing-policy`, `/support-service-policy`, and `/sa-fungerar-det` all return HTTP 200, include Screenia content, and do not reference the old `screenia-ten.vercel.app` domain.
  - `https://screenia.se` returns HTTP 200 and includes plan content.
  - `https://screenia.se/api/landing-assets` returns HTTP 200 with landing media metadata.
  - `GET https://screenia.se/api/onboarding-requests` returns HTTP 405, so the request endpoint does not expose a public read surface.
  - Direct empty cross-origin `POST https://screenia.se/api/onboarding-requests` returns HTTP 403, confirming the proxy blocks unsafe cross-origin state-changing requests before a customer record can be created.
- Resend domain `screenia.se` was added in region `Ireland (eu-west-1)`.
- Resend DNS records were staged in Vercel DNS for `screenia.se`: DKIM TXT `resend._domainkey`, return-path MX `send`, SPF TXT `send`, and DMARC TXT `_dmarc`.
- Resend region check on 2026-07-13 22:17 Europe/Stockholm:
  - `Ireland (eu-west-1)` is the correct EU-region choice for Sweden-facing launch testing.
  - The public `send.screenia.se` MX record also points to `feedback-smtp.eu-west-1.amazonses.com`, so there is no Resend region mismatch.
  - Sending is not a separate toggle to enable; custom-domain sending depends on the domain verifying and `RESEND_FROM_EMAIL` using that verified domain.
  - Do not add Resend's pending apex/root `@` inbound MX record before the human mailbox provider is chosen. The root MX should be reserved for the real mailbox provider such as Zoho or Migadu.
- Resend status check on 2026-07-13 after Zoho setup:
  - Resend dashboard shows `Partially Verified`.
  - Domain verification and sending records are verified.
  - DKIM, `send` MX, and `send` SPF are verified.
  - The only pending Resend item is inbound receiving at root/apex `@`, which should remain pending because Zoho owns the human mailbox MX records for `screenia.se`.
- Resend controlled send test on 2026-07-13:
  - A setup test email was accepted by Resend from the verified `screenia.se` sender to `service@screenia.se`.
  - Supabase recorded the Resend webhook event as `email.sent` for `service@screenia.se`.
  - Local `.env.local` was aligned to the verified `screenia.se` sender; this file is ignored by git and was not committed.
  - Vercel Preview and Development `NEXT_PUBLIC_COMPANY_EMAIL` and `RESEND_FROM_EMAIL` were also aligned to `service@screenia.se` / the verified `screenia.se` sender for future test deployments.
  - Zoho mailbox proof confirmed the Supabase Auth invite reached the `admin@screenia.se` mailbox through the `service@screenia.se` alias.
  - Next mailbox proof still requires sending `service@screenia.se` back to Gmail and checking placement.

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
   - Desired human/client addresses: `service@screenia.se`, `support@screenia.se`, and `billing@screenia.se`.
   - Newsletter sender identity: `info@screenia.se`; use it for newsletters/broadcasts only, not one-to-one customer support.
   - Then point `screenia.se` and `www.screenia.se` to Vercel once Vercel provides the exact DNS records.
   - Zoho Mail setup progress as of 2026-07-13 22:28 Europe/Stockholm:
     - Zoho EU organization signup was completed far enough to add `screenia.se`.
     - Domain verification TXT was added in Vercel DNS at root/`@`: `zoho-verification=zb79122508.zmverify.zoho.eu`.
     - Public DNS confirms the Zoho verification TXT is visible.
     - Zoho accepted the TXT record and verified domain ownership.
   - Zoho Mail setup progress as of 2026-07-13 22:52 Europe/Stockholm:
     - Super Administrator mailbox exists as `admin@screenia.se` on Zoho Mail Free.
     - `service@screenia.se` was added as an alias on the admin mailbox, so it should not consume another user license.
     - Zoho setup completion reached the Admin Console.
     - Root/apex MX, SPF, and DKIM records were added in Vercel DNS and verified publicly through Cloudflare DNS:
       - MX `@` -> `mx.zoho.eu`, priority `10`.
       - MX `@` -> `mx2.zoho.eu`, priority `20`.
       - MX `@` -> `mx3.zoho.eu`, priority `50`.
       - TXT `@` -> `v=spf1 include:zohomail.eu ~all`.
       - TXT `zmail._domainkey` -> Zoho DKIM record.
     - Zoho's own dashboard may still take time to refresh MX status; external DNS is correct.
     - Supabase Auth invite delivery was confirmed in the Zoho Inbox on 2026-07-13. The visible invite references `https://screenia.se`, and the accept button points to the Supabase Auth verify endpoint with `redirect_to`, `token`, and `type` parameters.
     - Clicking the invite completed the redirect check and landed on `https://screenia.se/account/activate` with the Screenia password setup form. No password was submitted.
   - Zoho Mail setup proof as of 2026-07-15 02:31 Europe/Stockholm:
     - `service@screenia.se` and `info@screenia.se` exist as aliases on the `admin@screenia.se` Zoho mailbox.
     - Gmail -> `service@screenia.se` was received in Zoho Inbox with subject `Screenia mailbox test Gmail to service 2026-07-15T00-24-48-849Z`.
     - Zoho Mail -> Gmail was sent with the From identity set to `service@screenia.se`; Gmail search `from:service@screenia.se` found subject `Screenia mailbox test service to Gmail 2026-07-15T00-29-10-253Z` in the inbox.
     - Production request confirmation was triggered through `https://screenia.se` with test company `Screenia Live Email Test 2026-07-15T00-31-28-834Z`; Gmail search `from:service@screenia.se` found subject `Screenia har tagit emot din förfrågan` in the inbox.
     - Zoho outgoing display names were corrected from the personal account name to `Screenia` for the active mailbox/sender identities.
     - Gmail confirmed the corrected manual Zoho sender display with subject `Screenia sender name proof 2026-07-15T00-42-15-102Z`; the visible sender name is `Screenia`.
     - The unused legacy alias `hello@screenia.se` was removed from Zoho on 2026-07-15 so clients only reply to `service@screenia.se`.
     - `info@screenia.se` remains reserved for newsletter/broadcast sender identity; transactional/customer-service email should continue to use `service@screenia.se`.

   Human mailbox setup runbook:

   - Current choice: try Zoho Mail Forever Free first, if the free plan is available for the selected data center/account. Use it only for human inboxes, not bulk newsletters.
     - Current official pricing check on 2026-07-13: Forever Free is listed as email hosting for one domain, up to 5 users, 5 GB storage per user, with IMAP/POP/Active Sync not included and availability limited to select data centers.
     - Current official paid fallback inside Zoho: Mail Lite is listed at `EUR 0.90/user/month` billed annually.
   - Fallback: Migadu Micro or the lowest suitable Migadu plan if Zoho Free is unavailable or if IMAP/standard mail-client access becomes important.
     - Current official pricing check on 2026-07-13: Migadu Micro is listed at `$19/year`, not available monthly, with unlimited addresses/domains subject to account usage limits.
   - Current real mailbox: `admin@screenia.se`.
   - Current public alias: `service@screenia.se` on the admin mailbox.
   - Current newsletter/broadcast alias: `info@screenia.se` on the admin mailbox.
   - Removed legacy alias: `hello@screenia.se`. Do not recreate or use it for customer communication.
   - Add aliases or mailboxes for `support@screenia.se` and `billing@screenia.se` after the first send/receive test passes.
   - Keep transactional/product email separate in Resend. Use `service@screenia.se` for app/client emails such as quotes, onboarding links, password reset, support notifications, and delivery-status webhooks.
   - Keep newsletter/broadcast identity separate as `info@screenia.se`.
   - Keep human mailbox MX records at the apex/root domain, for example Zoho or Migadu records for `screenia.se`.
   - Keep Resend return-path records on the `send` subdomain. The existing Resend MX for `send.screenia.se` does not replace the human inbox MX for `screenia.se`.
   - Do not add two different providers' apex MX records at the same time. Pick exactly one human-mail provider before entering MX records.
   - After mailbox DNS is added in Vercel DNS, verify:
     - MX lookup for `screenia.se` points to the selected mailbox provider.
     - SPF includes the selected mailbox provider and does not break the existing Resend `send` subdomain SPF.
     - DKIM is verified for the selected mailbox provider.
     - DMARC stays at monitoring mode (`p=none`) until real send/receive tests are stable.
     - `service@screenia.se` can receive from Gmail and can send to Gmail without spam warnings. Completed on 2026-07-15 with inbox placement.
   - Save provider plan, billing receipt, DPA/data-processing terms, account owner, and DNS evidence for bookkeeping/GDPR launch records.

   Human mailbox handoff checklist:

   - Open Zoho EU free organization signup: `https://workplace.zoho.eu/signup?type=org&plan=free`.
   - Choose organization/business email, not personal email.
   - User-owned private fields to complete manually:
     - Account owner first name and last name.
     - Current contact email or phone for verification.
     - Strong Zoho account password.
     - Sweden as country/region if asked.
     - OTP/CAPTCHA/phone verification.
   - Suggested organization/display name: `Screenia`.
   - First domain to add: `screenia.se`.
   - Completed: first mailbox created as `admin@screenia.se`.
   - Completed: first public alias created as `service@screenia.se`.
   - Next aliases or mailboxes after first send/receive test passes: `support@screenia.se`, `billing@screenia.se`.
   - Do not enable bulk/newsletter sending from Zoho during setup; reserve `info@screenia.se` for newsletter/broadcast use and keep product/transactional email in Resend.
   - Do not remove the existing Resend `send.screenia.se` MX/SPF records; they are only for Resend's return-path subdomain.
   - After Zoho displays DNS records, Codex should add only the Zoho-provided apex/root mailbox records in Vercel DNS:
     - Zoho MX records for `screenia.se`.
     - Zoho SPF/TXT for `screenia.se`, merged carefully with any existing apex SPF if present.
     - Zoho DKIM TXT selector for `screenia.se`.
     - Keep `_dmarc.screenia.se` as `v=DMARC1; p=none;` during testing unless Zoho requires a compatible monitoring value.
   - After DNS is saved, verify externally:
     - `nslookup -type=MX screenia.se 1.1.1.1`
     - `nslookup -type=TXT screenia.se 1.1.1.1`
     - `nslookup -type=TXT <zoho-selector>._domainkey.screenia.se 1.1.1.1`
     - Send Gmail -> `service@screenia.se`, then `service@screenia.se` -> Gmail.
   - Only after mailbox send/receive works:
     - Use `service@screenia.se` as the public company contact address if not already configured.
     - Continue Resend verification separately for app/transactional email.

2. Vercel hosting
   - Vercel project and real-domain production deploy are complete.
   - `screenia.se` is attached to production in Vercel and has a valid configuration.
   - `www.screenia.se` is attached in Vercel and configured as a permanent `308` redirect to `screenia.se`.
   - Production `NEXT_PUBLIC_APP_URL` is set to `https://screenia.se` and the production deployment was refreshed.
  - Buy/use Vercel Pro before real commercial production because the app is commercial.
  - The admin Launch Readiness page and live checkout blocker now track this explicitly through `SCREENIA_VERCEL_PRO_CONFIRMED`; keep it false until the paid/commercial hosting plan is actually active.
   - Reconnect the Screenia GitHub repository through Vercel after GitHub OAuth allows the login connection.
   - Preview and Development `NEXT_PUBLIC_APP_URL` still need review if preview deployments should use `https://screenia.se` or remain environment-specific.

   Loopia support message if the backend error repeats:

   ```text
   Hej Loopia Support,

   Jag försöker byta namnservrar för domänen screenia.se från Loopias namnservrar till Vercels namnservrar.

   Önskade namnservrar:
   ns1.vercel-dns.com
   ns2.vercel-dns.com

   I Kundzonen visas fälten med Vercels namnservrar och "Tvinga ändring?" är ikryssad, men när jag klickar på "Byt namnservrar" får jag felet:
   "Hoppsan, nu gick något fel i bakgrunden. Försök gärna igen!"

   Offentliga DNS-kontroller visar fortfarande:
   ns1.loopia.se
   ns2.loopia.se

   Kan ni hjälpa mig att genomföra namnserverbytet för screenia.se?

   Tack!
   ```

3. Resend transactional email
   - Start with Resend Free while volume is low.
   - `screenia.se` was added to Resend; domain id `645099e3-8522-4949-95aa-f9ee63c2001b`.
   - Resend dashboard shows `Partially Verified`, with domain verification and sending records verified.
   - Resend still shows a pending apex/root `@` MX record for inbound receiving. Keep that pending because it conflicts with Zoho's human mailbox MX records for `service@screenia.se`.
   - Resend sending DNS records are staged in Vercel DNS:
     - TXT `resend._domainkey` = `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCt8Z7H7RzjQQ+s0/HTMefefAl1atfepdP/4aZ9oojVCDKoYu3UD4YYYSspOJS0YGPt/IoOdbiqonZvKR5Ne/StRX57JR4DGTQccSWKM/AzNWXZZaVuWlNVKPRbAc6WUNp2ewSwOvZPspdTWq7XI0nTn6uNiEz3zMeyPIeQWskdgQIDAQAB`
     - MX `send` = `feedback-smtp.eu-west-1.amazonses.com`, priority `10`
     - TXT `send` = `v=spf1 include:amazonses.com ~all`
     - TXT `_dmarc` = `v=DMARC1; p=none;`
   - Public DNS verification at 21:42 showed:
     - TXT `resend._domainkey.screenia.se` returns the Resend DKIM value.
     - MX `send.screenia.se` returns `feedback-smtp.eu-west-1.amazonses.com` with priority `10`.
     - TXT `send.screenia.se` returns `v=spf1 include:amazonses.com ~all`.
     - TXT `_dmarc.screenia.se` returns `v=DMARC1; p=none;`.
   - Keep DMARC at `p=none` during launch testing, then tighten after successful mail flow monitoring.
   - Production `RESEND_FROM_EMAIL` was corrected to use a `screenia.se` sender after Resend sending verification.
   - Keep the application Resend API key send-restricted for least privilege. It can send mail but cannot query domain-management status; use the Resend dashboard or a temporary full-access admin key only when domain-management verification is needed.
   - Webhook already created for `https://screenia.se/api/resend/webhook`; a real Resend `email.sent` event was stored in Supabase after the setup test.
   - Confirm delivered, bounce, complaint, failed, and unsubscribe events during deeper email testing.

4. Supabase production readiness
   - Keep Free during setup/testing if usage stays low.
   - Upgrade to Supabase Pro before real paid customers if production backups, no project pausing, and support are required.
   - Production Auth URL configuration was updated on 2026-07-13 after the domain went live.
   - Auth email templates/sender are now configured through custom SMTP.
   - Earlier Supabase Auth email check on 2026-07-13:
     - The Auth Emails page originally showed Screenia using Supabase's built-in email service.
     - Supabase warned the built-in email service has rate limits and is not meant for production apps.
     - The fix was to enable custom SMTP with Resend after explicit approval.
   - Supabase Auth SMTP setup completed after explicit approval:
     - Custom SMTP is enabled.
     - Sender email is `service@screenia.se`.
     - Sender name is `Screenia`.
     - Host is `smtp.resend.com`.
     - Port is `465`.
     - Username is `resend`.
     - Supabase saved the settings and no longer shows the built-in email service warning on the SMTP page.
     - Do not set `SCREENIA_SUPABASE_AUTH_EMAIL_VERIFIED=true` until a real account activation/password reset email is received successfully.
   - Supabase Auth SMTP delivery test:
     - A controlled Supabase Auth invite was sent to `service@screenia.se`.
     - Resend/Supabase delivery events were recorded for the invite:
       - `email.sent`
       - `email.delivered`
     - The temporary auth user for `service@screenia.se` exists with setup-test metadata and is still unconfirmed.
     - Zoho Inbox visibility was confirmed on 2026-07-13, and clicking the invite redirected through Supabase Auth to `https://screenia.se/account/activate`.
     - The temporary setup-test auth user for `service@screenia.se` was deleted after the redirect proof so the company mailbox is not left as a customer account.
     - Leave `SCREENIA_SUPABASE_AUTH_EMAIL_VERIFIED=false` until a password is submitted successfully or the reset path is checked end-to-end.
   - Supabase Auth sender correction on 2026-07-15:
     - During cancellation/payment QA, one Auth email showed `"Screenia" <hello@screenia.se>`.
     - Root cause was Supabase Authentication -> Emails -> SMTP Settings: `Sender email` / `SMTP_ADMIN_EMAIL` had drifted to `hello@screenia.se`.
     - Corrected the Supabase dashboard value to `service@screenia.se` and saved it with custom SMTP still enabled.
     - Retest password reset request for `service@screenia.se` delivered through Resend with from `"Screenia" <service@screenia.se>`.
     - Evidence: before-fix Resend email `cdac70d6-6e55-413c-b4e6-3dc7cc6f9b60`; after-fix Resend email `958cdc4d-f3ab-44c2-b84c-bb735890244d`; corresponding audit events include `password_reset_email_requested` and Resend `email.sent` / `email.delivered`.
     - The local Resend key cannot retrieve stored email bodies, so do not expose or log Auth reset tokens from API calls. Complete the next password-reset link proof from the mailbox UI.
   - Storage privacy was spot-checked on 2026-07-13:
     - `customer-display-assets` is not marked public and has a storage policy count.
     - `email-assets` is intentionally public-looking for email image assets and is limited to image MIME types.
   - Re-run launch readiness after deployment.

   Supabase setup runbook after `screenia.se` resolves to Vercel:

   - Completed: Site URL is `https://screenia.se`.
   - Completed: Redirect URLs include `https://screenia.se/auth/callback`, `https://screenia.se/account/activate`, and `https://screenia.se/account/reset-password`.
   - Configure Auth email sender/templates to use a verified professional sender only after Resend or the mailbox provider is verified.
   - Test password setup and password reset with a real test recipient before setting `SCREENIA_SUPABASE_AUTH_EMAIL_VERIFIED=true`.
   - Static Auth flow audit on 2026-07-14:
     - Production `https://screenia.se/account/activate` returns HTTP 200 and loads the Screenia app bundle.
     - Production `https://screenia.se/account/reset-password` returns HTTP 200 and loads the Screenia app bundle.
     - Production `/auth/callback?next=/account/reset-password` redirects with HTTP 307 to `/account/reset-password`.
     - Activation and reset pages both call `syncEmailLinkSession`, enforce the shared password policy, update the Supabase Auth password, sync server cookies, and redirect to `/account`.
     - `/api/auth/password-reset` uses the production app URL for Supabase reset links, returns a generic response, rate limits by IP and email, audits requests/failures, and creates urgent admin visibility for reset email failures.
     - This proves route/code readiness only. `SCREENIA_SUPABASE_AUTH_EMAIL_VERIFIED` must remain false until a real invite/password setup or password reset email is received and a password is submitted successfully.
   - Completed spot check: `customer-display-assets` remains non-public after production deployment.
   - Keep `email-assets` public only if it is used for non-sensitive email images.

5. Stripe production readiness
   - Keep test mode until business, tax, and legal gates are complete.
   - Activate live payments only after business identity, VAT decision, legal documents, and live webhooks are verified.
   - A Stripe test-mode webhook endpoint now exists for the deployed production-domain app.
   - Vercel Production `STRIPE_WEBHOOK_SECRET` was updated to the endpoint-specific signing secret and redeployed.
   - A signed synthetic webhook check to `https://screenia.se/api/stripe/webhook` returned HTTP 200 with `{"received":true}` after redeploy.
   - Stripe Tax/VAT app integration is present, but business/VAT readiness is not complete:
     - Checkout sends `automatic_tax.enabled` from `STRIPE_AUTOMATIC_TAX_ENABLED`.
     - Checkout requires billing address and tax ID collection when automatic tax is enabled.
     - Checkout line items use configured `tax_behavior`, defaulting to inclusive.
     - Local setup has `STRIPE_AUTOMATIC_TAX_ENABLED=true`.
     - Dashboard/legal confirmation is still required before live payments.

   Stripe setup runbook after `screenia.se` resolves to Vercel:

   - Keep Stripe in test mode for current real-world scenario tests unless the business/tax/legal gates are explicitly complete.
   - Completed: test-mode webhook endpoint `we_1TspvBGhi0eDHRQZh7hbAA3v` points to `https://screenia.se/api/stripe/webhook`.
   - Completed: endpoint listens to `checkout.session.completed`, `invoice.payment_failed`, `invoice.paid`, `customer.subscription.updated`, `customer.subscription.deleted`, `charge.dispute.created`, `charge.dispute.updated`, `charge.dispute.closed`, `charge.refunded`, `refund.created`, and `refund.updated`.
   - Completed: Vercel Production `STRIPE_WEBHOOK_SECRET` was updated with the endpoint-specific value, then production was redeployed.
   - Completed smoke check: a harmless signed synthetic webhook event reached the deployed route and returned `{"received":true}`.
   - Completed code/config check: Screenia's checkout route supports Stripe Automatic Tax through `STRIPE_AUTOMATIC_TAX_ENABLED`, with billing address and tax ID collection enabled when that flag is true.
   - Re-test checkout, subscription update, invoice paid, invoice failed, cancellation, pause/resume, refund, and dispute webhooks against the deployed URL.
   - Only create live-mode webhooks and enable live payments after business registration, VAT decision, legal review, company identity, and live checkout gates are complete.

## Review Items Still Open

- Live payments enabled
- Business registration
- Vercel Pro / commercial hosting
- VAT decision
- Legal review
- Live webhook verified
- Supabase Auth email verified
- Stripe Tax / VAT legal/dashboard confirmation
- Transactional email
- Company identity
- Legal documents

## Focused Verification Checkpoints

2026-07-13 22:06 Europe/Stockholm:

- Live domain smoke check passed:
  - `https://screenia.se` returned HTTP 200 with title `Screenia | Digital skyltning för företag i Sverige`.
  - `https://screenia.se/robots.txt` still uses `Host: https://screenia.se`.
  - `https://screenia.se/sitemap.xml` contains `https://screenia.se` and does not contain `vercel.app`.
- Public DNS still points `screenia.se` to Vercel nameservers.
- Resend DNS records are publicly present from Cloudflare and Google:
  - DKIM TXT `resend._domainkey.screenia.se`.
  - MX `send.screenia.se` to `feedback-smtp.eu-west-1.amazonses.com`.
  - SPF TXT `send.screenia.se` with `v=spf1 include:amazonses.com ~all`.
  - DMARC TXT `_dmarc.screenia.se` with `v=DMARC1; p=none;`.
- Resend dashboard still shows the domain and individual records as `Pending`; do not switch `RESEND_FROM_EMAIL` to `@screenia.se` until Resend verifies the domain.
- Short repo checks passed:
  - `npm.cmd run lint`
  - `npm.cmd run text:check`
  - `npm.cmd run build`

2026-07-13 22:09 Europe/Stockholm:

- Resend dashboard still shows `Pending` for the domain and records, despite public DNS remaining correct.
- Production admin readiness access check:
  - Visiting `https://screenia.se/admin/launch-readiness` redirects to `/admin-login` when not authenticated.
  - Direct unauthenticated request to `https://screenia.se/api/admin/launch-readiness` returns HTTP 401 with `{"error":"Unauthorized"}`.
- This is expected and confirms the readiness surface is not publicly exposed.

2026-07-13 22:13 Europe/Stockholm:

- Resend public DNS recheck passed again:
  - DKIM TXT `resend._domainkey.screenia.se` is present.
  - MX `send.screenia.se` points to `feedback-smtp.eu-west-1.amazonses.com`.
  - SPF TXT `send.screenia.se` is `v=spf1 include:amazonses.com ~all` from both Cloudflare and Google DNS.
  - Apex nameservers still resolve to Vercel nameservers.
- Stripe Tax/VAT app integration check:
  - Checkout code reads `STRIPE_AUTOMATIC_TAX_ENABLED`.
  - Automatic tax, billing address collection, and tax ID collection are wired into Stripe Checkout when enabled.
  - Local setup has automatic tax enabled; live legal/VAT/business confirmation remains open.

2026-07-13 22:17 Europe/Stockholm:

- Resend status clarification:
  - Resend's Ireland region is acceptable and preferred for the Sweden/EU launch path.
  - Public sending records match the configured Ireland region.
  - Resend custom-domain sending still depends on dashboard verification; do not switch production `RESEND_FROM_EMAIL` to an `@screenia.se` sender until Resend verifies the domain.
  - Do not add Resend's root/apex inbound MX record until the human mailbox provider is selected, because the root MX will be needed for `service@screenia.se`.
- Environment key inventory was checked by key name only; no secret values were printed.
  - Local core keys are present for Supabase, Stripe, Resend, app URL, company identity placeholders, and Stripe automatic tax.
  - Required live-payment gate flags are intentionally not set locally: `SCREENIA_LIVE_PAYMENTS_ENABLED`, `SCREENIA_BUSINESS_REGISTRATION_CONFIRMED`, `SCREENIA_VERCEL_PRO_CONFIRMED`, `SCREENIA_VAT_DECISION_CONFIRMED`, `SCREENIA_LEGAL_REVIEW_CONFIRMED`, `SCREENIA_LIVE_WEBHOOK_VERIFIED`, and `SCREENIA_SUPABASE_AUTH_EMAIL_VERIFIED`.
  - Optional public keys not present locally: `NEXT_PUBLIC_EMAIL_ASSET_BASE_URL` and `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED`.

2026-07-13 22:19 Europe/Stockholm:

- Focused production refresh stayed clean:
  - `https://screenia.se` returned HTTP 200 with the Screenia title.
  - `https://www.screenia.se` returned HTTP 308.
  - `robots.txt` and `sitemap.xml` use `https://screenia.se`; sitemap has no `vercel.app` URLs.
  - Direct unauthenticated request to `/api/admin/launch-readiness` returned HTTP 401, as expected.
  - Public DNS still points to Vercel nameservers.
  - Apex/root MX for `screenia.se` is still empty, which is intentional until the human mailbox provider is selected.
  - Resend sending records on `send.screenia.se` and DKIM/DMARC records are still visible publicly.
- Resend API status check:
  - The local Resend API key is restricted to sending emails and returned `restricted_api_key` for domain-management lookup.
  - Keep this least-privilege key for the app; check domain verification in the dashboard or with a temporary full-access admin key only if needed.

2026-07-13 22:28 Europe/Stockholm:

- Zoho mailbox setup progress:
  - `screenia.se` was added to Zoho Mail EU on the free-plan setup path.
  - Vercel DNS record created for Zoho domain verification: root TXT `zoho-verification=zb79122508.zmverify.zoho.eu`.
  - Cloudflare DNS lookup returned the Zoho TXT value.
  - Zoho verified domain ownership and advanced to Account Creation.
  - Account Creation is paused before creating the Super Administrator mailbox; recommended choice is `admin@screenia.se`.
  - Root/apex MX is still empty and should stay empty until Zoho provides the MX records in the DNS Mapping step.

2026-07-13 22:52 Europe/Stockholm:

- Zoho mailbox setup advanced from setup wizard to Admin Console:
  - `admin@screenia.se` exists as the Super Administrator mailbox on Zoho Mail Free.
  - `service@screenia.se` exists as an alias on the admin mailbox.
  - Zoho root MX records are publicly visible: `mx.zoho.eu`, `mx2.zoho.eu`, and `mx3.zoho.eu`.
  - Zoho root SPF is publicly visible: `v=spf1 include:zohomail.eu ~all`.
  - Zoho DKIM selector `zmail._domainkey.screenia.se` is publicly visible.
  - Zoho's dashboard can lag on MX status even after external DNS is correct.
- Remaining mailbox validation:
  - Send Gmail -> `service@screenia.se`.
  - Send `service@screenia.se` -> Gmail.
  - Check spam placement and sender authentication details.

2026-07-13 post-Zoho production refresh:

- Resend dashboard status is now `Partially Verified`, not fully pending:
  - Domain verification is complete.
  - Sending records are verified.
  - The only pending record is Resend inbound receiving at root/apex `@`; this should stay pending while Zoho handles human mail.
- Production Vercel environment was corrected for the live site:
  - `NEXT_PUBLIC_APP_URL` was set to `https://screenia.se`.
  - `NEXT_PUBLIC_COMPANY_EMAIL` was set to `service@screenia.se`.
  - `RESEND_FROM_EMAIL` was set to a `screenia.se` sender.
  - Vercel hides pulled sensitive env values after re-adding them, so use live-site behavior and Vercel dashboard as the verification surface for these values.
- Vercel Preview and Development environment values were later aligned for:
  - `NEXT_PUBLIC_COMPANY_EMAIL`
  - `RESEND_FROM_EMAIL`
- Production redeploy `dpl_A6BwQHZjUPbeWnGn56aPRAzecD4f` reached Ready and was aliased to `https://screenia.se`.
- Focused live checks after redeploy:
  - `https://screenia.se` returned HTTP 200 with the Screenia title.
  - The live page contains `service@screenia.se`.
  - `https://www.screenia.se` returned HTTP 308 to `https://screenia.se/`.
  - Direct unauthenticated request to `/api/admin/launch-readiness` returned HTTP 401.

2026-07-13 controlled Resend email test:

- Local sender configuration was aligned to the verified `screenia.se` sender.
- Resend accepted a controlled setup test email to `service@screenia.se`.
- Supabase recorded the corresponding Resend webhook event:
  - `event_type`: `email.sent`
  - `event_status`: `received`
  - `recipient_email`: `service@screenia.se`
- This proves the transactional sender can send from the verified domain and the deployed Resend webhook can store at least the sent event.
- Vercel Preview and Development sender/contact values were aligned to the same verified `screenia.se` sender/contact setup after the production test passed.
- Still unverified:
  - The message must be visibly received in Zoho.
  - `service@screenia.se` must send successfully back to Gmail.
  - Delivered/bounce/complaint webhook behavior should be checked during the detailed email test pass.

2026-07-13 Supabase Auth email check before SMTP setup:

- Supabase Auth Emails still used the built-in email service at this checkpoint.
- This was acceptable for temporary setup, but not production-ready for customer password setup/reset emails.
- The SMTP Settings page showed custom SMTP was not enabled yet.
- Recommended custom SMTP configuration is Resend SMTP:
  - Sender email: `service@screenia.se`.
  - Sender name: `Screenia`.
  - Host: `smtp.resend.com`.
  - Port: `465`.
  - Username: `resend`.
  - Password: Resend API key.
- Stop point: entering the Resend API key into Supabase requires explicit user approval in chat.

2026-07-13 Supabase Auth SMTP enabled:

- After explicit approval, custom SMTP was enabled in Supabase Auth using Resend SMTP.
- Saved settings:
  - Sender email: `service@screenia.se`.
  - Sender name: `Screenia`.
  - Host: `smtp.resend.com`.
  - Port: `465`.
  - Username: `resend`.
  - Password: Resend API key, stored in Supabase and hidden after save.
- Supabase showed `Successfully updated settings`.
- The custom SMTP switch remained enabled and the built-in-service warning was gone from the SMTP page.
- Remaining verification:
  - Trigger a real customer activation or password reset email.
  - Confirm the email arrives through Resend/Supabase.
  - Check Resend logs/webhook event and mailbox placement.
  - Only then set `SCREENIA_SUPABASE_AUTH_EMAIL_VERIFIED=true`.

2026-07-13 Supabase Auth SMTP delivery test:

- Sent one controlled Supabase Auth invite to `service@screenia.se` using the custom Resend SMTP settings.
- Supabase accepted the invite and created a setup-test auth user for `service@screenia.se`.
- Supabase/Resend delivery event records were stored:
  - `email.sent`
  - `email.delivered`
- The invite was visible in the Zoho Inbox for `admin@screenia.se` via the `service@screenia.se` alias.
- The visible invite references `https://screenia.se`; the accept action points to the Supabase Auth verify endpoint and includes `redirect_to`, `token`, and `type` parameters.
- Clicking the invite redirected through Supabase Auth and landed on `https://screenia.se/account/activate` with the Screenia password setup form.
- No password was submitted during this setup check.
- Cleanup completed: the temporary setup-test auth user for `service@screenia.se` was deleted after the redirect proof.
- Remaining verification:
  - Submit a controlled test password with a future real test customer or run a password reset flow to confirm account activation fully completes.
  - Set `SCREENIA_SUPABASE_AUTH_EMAIL_VERIFIED=true` only after password setup or reset is verified end-to-end.

2026-07-15 production password reset delivery proof:

- Live `/api/auth/password-reset`/Supabase Auth reset flow produced audit event `password_reset_email_requested` for `service@screenia.se`.
- Resend delivery event records were stored for email `423246f2-223a-4ebc-8d96-14d2fb128eee`:
  - `email.sent`
  - `email.delivered`
- Subject was `Reset Your Password`.
- Manual remaining verification:
  - Open the real reset email link.
  - Submit a compliant password.
  - Confirm `/account` login.
  - Only then set `SCREENIA_SUPABASE_AUTH_EMAIL_VERIFIED=true`.

2026-07-15 paid onboarding account-access fix:

- Full Premium 4K onboarding/payment test found that an already-existing Supabase Auth user could receive updated metadata after payment without receiving a fresh account/password email.
- Fixed `src/app/api/stripe/webhook/route.ts` so the Stripe paid webhook:
  - Looks up an existing auth user by email before trying to invite.
  - Updates `user_metadata.customer_id` and `account_type`.
  - Requests a Supabase password setup/reset email for existing users.
  - Audits success/failure as `customer_password_setup_email_requested` or `customer_password_setup_email_failed`.
- Deployed production fix `dpl_7s1hiGdiSk6LAad3DpBNoXYFzjh4` and aliased it to `https://screenia.se`.
- Backfill proof for paid QA customer `10000053`: reset email `01bea64b-38f2-4b03-8cd4-a8460183db05` delivered to `service@screenia.se`.
- Manual remaining verification stays the same: open the real email link, submit a compliant password, and confirm `/account` login before setting `SCREENIA_SUPABASE_AUTH_EMAIL_VERIFIED=true`.

2026-07-16 online/email-ready closing checkpoint:

- Site is online at `https://screenia.se`.
- Zoho mailbox proof completed: a live Supabase Auth reset email arrived in the Screenia mailbox and the real email link opened `https://screenia.se/account/reset-password`.
- Vercel production has `SCREENIA_SUPABASE_AUTH_EMAIL_VERIFIED=true`.
- Latest verified production deployment for that proof: `dpl_7DRuG53sETkuSwPPBDWwvgMAVT2B`.
- Authenticated launch readiness returned `54 pass`, `9 warning`, `0 fail`, with `readyForLivePayments=false`.
- Current retained test state: 12 Supabase customers total, 11 terminal cancelled/refunded test records kept for audit/accounting traceability, and 1 active QA customer/subscription kept for the next real-world test session.
- Do not delete cancelled/refunded payment-history rows casually; use admin anonymization/deletion workflows only when there is a clear legal/privacy reason and after considering accounting/audit retention.

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
- Inventory/device lifecycle was production-tested with a Premium 4K QA item. Returned, defective, repair, retired, and lost stock now releases the linked device; only explicitly `in_stock` hardware can be allocated or linked to a device.
- Subscription billing lifecycle was production-tested: admin pause/resume, admin period-end cancellation, customer period-end cancellation, immediate admin cancellation on disposable Stripe test subscriptions, and temporary discount apply/remove all sync Stripe, customer access, local subscription state, display entitlement, and audit evidence.
- Accounting/VAT exports were production-tested: accounting CSV includes paid/cancelled/refunded order evidence, VAT summary includes only active paid taxable rows, export downloads are audited, and terminal orders now close inventory status as `cancelled`.
- Customer account/email/support flow was production-tested: customer login, password reset delivery evidence, customer support ticket submission, admin communication reply, customer-visible reply email delivery, and customer account data export all work. Admin replies now move tickets to `waiting_for_customer` after fix `bfa88d9` / deployment `dpl_8n32qM7UYuVLtiKFS36Tru6UEWUV`.
- Stripe failed-payment recovery was production-tested with official Stripe CLI test events on disposable customer `10000056`: `invoice.payment_failed` suspended service and display access, created audit/admin notification evidence, `invoice.paid` restored access, and audited cleanup then cancelled the disposable subscription and deactivated display `PF0DFB`. Launch readiness returned to `53 pass`, `10 warning`, `0 fail`.
- Customer password reset/setup was production-tested as far as current mailbox access allowed: real Supabase Auth reset email was sent and delivered by Resend from `Screenia <service@screenia.se>`, the reset page accepted a Supabase recovery session, password update redirected to the customer portal, and restored-password login succeeded. The confirmed password rule is 6+ characters with letters and numbers. The remaining gate is only the literal Zoho mailbox-click proof, because Zoho was signed out in the browser during this pass.

Next admin areas to clean up before broad real-world testing:

- Continue visual spot checks as new admin workflows are added; avoid reintroducing browser prompts for audited actions.
- Complete the remaining manual email-link gate: sign in to Zoho, open the real Supabase reset/setup email link from the mailbox UI, submit a compliant password, confirm `/account` login, then set `SCREENIA_SUPABASE_AUTH_EMAIL_VERIFIED=true`.

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
