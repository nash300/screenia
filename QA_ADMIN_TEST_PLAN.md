# InfoSync Admin QA Test Plan

Use this checklist with Stripe test mode, Supabase test data, and a test email address.
Prefix test companies with `TEST -` so they can be cleaned up safely.

## Test Run Log

| Date | Tester | Environment | Result | Notes |
| --- | --- | --- | --- | --- |
| 2026-06-28 | Codex + admin | Localhost + live Supabase/Stripe test services | In progress | Landing request, quote/onboarding, payment webhook, account activation, password login, and content setup passed. |

## Scenario 1: Customer Request From Landing Page

Expected:
- Customer can submit a request from the landing page with only the needed first-stage details.
- A customer record is created in Supabase.
- Admin can see the customer in the admin panel.
- Customer receives a confirmation email when email is configured.
- Admin activity/history has timestamped records for the request.

Result:
- Pass on 2026-06-28.

Evidence:
- Test customer: `TEST - InfoSync QA 202606281359`
- Customer id: `c13cbcd6-0bf6-4b33-a2cc-c0291ee43af8`
- Customer number: `10000008`
- Status: `new_request`
- Admin list: visible under `Requests (1)`.
- Admin notification: `New customer request`, priority `high`, timestamp `2026-06-28T13:58:58.404133+00:00`.
- Audit events: `customers_insert`, `landing_purchase_request_created`, `request_confirmation_email_sent`.
- Resend confirmation email id: `74d03575-bac1-4038-b6c9-365b99c5ca85`.

## Scenario 2: Admin Quote And Onboarding Link

Expected:
- Admin can prepare a quote from the customer detail page.
- Customer receives the quote/onboarding email.
- Customer status/order state changes are visible to admin.
- Activity/history includes timestamped quote and email events.

Result:
- Pass on 2026-06-28.

Evidence:
- Customer status changed from `new_request` to `invited`.
- Onboarding token: `0b9178ee-c02e-43f2-9f7a-34243579996c`
- Token expiry: `2026-07-12T14:00:32.495+00:00`
- Order id: `10e46485-f76a-443d-9507-9fd62745012b`
- Order number: `1000000003`
- Order status: `quote_sent`
- Quote email audit event: `quote_onboarding_email_sent` at `2026-06-28T14:00:15.871909+00:00`.
- Customer detail UI: status `invited`, `Orders (1)`, `History (8)`.

Observation:
- Dashboard admin notifications show the new request. Quote-sent is recorded in audit history, but it is not currently shown as an admin notification.

## Scenario 3: Customer Onboarding

Expected:
- Customer can open the onboarding link.
- Customer can provide only required follow-up details.
- Required uploads are accepted and visible to admin.
- Legal acceptance is recorded with timestamp, IP/user agent when available.

Result:
- Pass on 2026-06-28 for profile/legal data collection.

Evidence:
- Test customer: `TEST - Webhook QA 202606281408`
- Customer id: `4005c51c-38bd-4f79-b67f-5f452b551acc`
- Customer number: `10000009`
- Customer entered contact, organization number, billing email, delivery address, business category, and website.
- Customer status changed to `accepted_terms` before payment.
- Consent records were created for terms, privacy, marketing, analytics, and remote support.
- Legal agreement records were created for terms and privacy.
- Audit event: `onboarding_profile_completed`.

Observation:
- Fixed in code: onboarding follow-up fields now have stable `id`, `name`, and `aria-label` attributes for accessibility and reliable automated testing.

## Scenario 4: Stripe Test Payment

Expected:
- Customer can complete payment/card setup in Stripe test mode.
- Stripe webhook updates the customer/order/subscription.
- Admin sees payment/order status update.
- Activity/history includes payment-started and payment-completed timestamps.

Result:
- Pass on 2026-06-28 when the Stripe CLI webhook listener is running.

Evidence:
- Stripe Checkout session: `cs_test_b1NFLLqEOCLr92QCQtuHeNcImh8ewxraJVNuiAInnoDohEn7kSMMF6wMx4`
- Stripe customer id: `cus_UmtBismUQQ4PdY`
- Stripe subscription id: `sub_1TnJPQGhi0eDHRQZQOstodmV`
- Order id: `ced33df6-dccb-4974-8567-75e016f31601`
- Order number: `1000000004`
- Customer status: `paid`
- Customer payment status: `paid`
- Order status: `paid`
- Order setup fee paid: `true`
- Fulfillment status: `content_collection`
- Inventory status: `ready_to_reserve`
- Admin notification: `Payment completed`, priority `urgent`, timestamp `2026-06-28T14:10:13.349006+00:00`.
- Audit event: `payment_completed` at `2026-06-28T14:10:13.211905+00:00`.

Observation:
- A first payment attempt succeeded in Stripe but did not update Supabase because the local Stripe webhook listener was not running. Local payment testing must start `stripe listen --forward-to localhost:3000/api/stripe/webhook` before checkout.

## Scenario 5: Admin Fulfillment

Expected:
- Admin can assign inventory/device to customer.
- Admin can upload or assign display content.
- Device, inventory, and customer history update with timestamps.

Result:
- Pass on 2026-06-28 for device assignment, order fulfillment state, customer activation, playlist assignment, and display playback.

Evidence:
- Test customer: `TEST - Account Portal QA 14:27:39`
- Customer id: `e0cedda7-b4e2-48ce-ae9e-4d5bc5f325ef`
- Device: `QA Fulfillment Screen 143248`
- Device code: `RPNJAV`
- Order number: `1000000006`
- Admin created a device from the customer detail page.
- Admin updated order fulfillment/inventory/tracking from the Orders page.
- Admin marked the paid customer active from the customer onboarding section.
- Customer status: `active`
- Order status: `active`
- Fulfillment status: `completed`
- Inventory status: `assigned`
- Display URL `/display/RPNJAV` rendered an assigned video playlist item.
- Device media page showed `Media (1)`.
- Audit events include `devices_insert`, `customers_update`, and `customer_subscriptions_update` with timestamps.

Observation:
- Fixed in code: paid customers now have a `Mark customer active` admin action so assigned displays can run after content/device readiness.
- Fixed in code: the Add Device form now has stable accessible labels for reliable QA and screen-reader support.
- Added migration `202606280001_devices_updated_at_alignment.sql` to align missing live timestamp columns on `devices` and `playlists`.

## Scenario 5A: Customer Account Activation And Content Setup

Expected:
- Paid customer can set a password from the email link.
- Customer can log in later with that password.
- Customer can submit first content setup from the portal.
- Submission updates customer/order state and creates timestamped audit/admin records.

Result:
- Pass on 2026-06-28 with synthetic QA customer.

Evidence:
- Test customer: `TEST - Account Portal QA`
- Customer id: `e0cedda7-b4e2-48ce-ae9e-4d5bc5f325ef`
- Order number: `1000000006`
- Account link session synced successfully into server cookies.
- Password login landed on `/account`.
- Customer status after setup: `content_received`
- Content option: `template`
- Preview status: `waiting_for_admin`
- Subscription fulfillment status: `content_received`
- Audit event: `content_setup_submitted`
- Admin notification: `Content setup submitted`, priority `high`, unread.

Observation:
- Fixed in code: account activation/reset email links now sync Supabase browser hash sessions into server cookies before redirecting to the account portal.
- Fixed in code: customer portal content setup fields now have stable accessible labels for testing and screen-reader support.

## Scenario 6: Admin Communication And Support

Expected:
- Admin can view customer uploads/messages.
- Admin can respond or record support activity.
- Each important message/event has a timestamped record.

Result:
- Pass on 2026-06-28 with synthetic QA customer.

Evidence:
- Test customer: `TEST - Account Portal QA 14:27:39`
- Customer id: `e0cedda7-b4e2-48ce-ae9e-4d5bc5f325ef`
- Customer sent support ticket `IS-260628-1030F5` from `/account`.
- Ticket id: `7a566e2a-cd16-407c-a9ae-317a4ed7cb56`
- Ticket subject: `[IS-260628-1030F5] QA support ticket 14:46:35`
- Customer message was stored with timestamp `2026-06-28T14:46:19.229213+00:00`.
- Audit event `customer_message_sent` was stored with timestamp `2026-06-28T14:46:19.450137+00:00`.
- Admin communication tab displayed the ticket, request type, priority, customer message, timestamp, and status.
- Admin changed ticket status to `in_progress` from the customer communication tab.
- Audit event `customer_message_admin_update` was stored with timestamp `2026-06-28T14:52:26.338309+00:00`.
- Applied migration `supabase/migrations/202606280002_customer_message_admin_notes.sql` in Supabase SQL editor.
- Admin changed ticket status to `waiting_for_customer` and saved internal admin note.
- Internal note was stored in `customer_messages.admin_note`.
- Note timestamp was stored in `customer_messages.admin_note_updated_at` as `2026-06-28T18:08:35.381+00:00`.
- Latest audit event `customer_message_admin_update` stored metadata with `adminNoteStored: true`.

Observation:
- Fixed in code: admin can update customer message status and record a timestamped audit event.
- Fixed in code: admin message update UI has stable form ids/names for testing and accessibility.
- Applied migration `supabase/migrations/202606280002_customer_message_admin_notes.sql` for internal admin notes and resolved timestamps.
- The fallback path was tested before migration and correctly saved status plus audit metadata with `adminNoteStored: false`.

## Scenario 7: Error And Edge Cases

Expected:
- Invalid or missing landing page fields show clear errors.
- Expired onboarding links are blocked.
- Failed payment is handled without corrupting customer state.
- Email sending failure is surfaced clearly to admin.
- Unauthenticated users cannot access admin APIs.

Result:
- Pass on 2026-06-28 with synthetic QA customers.

Evidence:
- Landing request validation rejects invalid plan with HTTP `400` and message `Valj ett giltigt paket.`
- Landing request validation rejects missing company name with HTTP `400` and message `Foretagsnamn maste anges.`
- Landing request validation rejects invalid email with HTTP `400` and message `Ange en giltig e-postadress.`
- Expired onboarding token was tested with customer `TEST - Edge Cases QA 20260628181332`.
- Expired profile completion returned HTTP `410` and message `Den har startlanken har gatt ut.`
- Synthetic payment-failed Stripe webhook returned HTTP `200` with `{ received: true }`.
- Payment-failed customer id: `5b8b6dfc-4b51-4c47-ac18-c9df355e3ef0`.
- Payment-failed subscription id: `006f4d03-9ed9-4ac0-a61c-b5115493087d`.
- Payment-failed webhook changed customer status to `suspended`, payment status to `failed`, inactive reason to `payment_failed`, and cancellation source to `stripe`.
- Payment-failed webhook changed subscription status to `payment_failed` and Stripe payment status to `failed`.
- Audit event `payment_failed` was stored with timestamp `2026-06-28T18:14:09.762235+00:00`.
- Stripe webhook without signature returned HTTP `400` and message `Missing signature`.
- Unauthenticated `GET /api/admin/customer-messages` returned HTTP `401`.
- Unauthenticated `PATCH /api/admin/customer-messages` returned HTTP `401`.
- Email failure was tested by temporarily running the server with an intentionally invalid Resend API key.
- Email-failure customer id: `fabef3bd-cc1b-4606-bb5e-1404ccc125e3`.
- Landing request returned HTTP `200`, `success: true`, `emailSent: false`, and warning `API key is invalid`.
- Audit event `request_confirmation_email_failed` was stored with timestamp `2026-06-28T18:17:21.862505+00:00`.
- Admin notification `Customer email not sent` was stored with priority `urgent` at `2026-06-28T18:17:21.953896+00:00`.

Observation:
- Failed emails do not block customer request creation; they are surfaced to the admin and tracked for troubleshooting.
- Failed payments suspend the customer and mark the subscription as `payment_failed` without deleting order/subscription history.
- Protected admin message endpoints reject unauthenticated requests.
- Normal dev server was restarted after the temporary invalid-email test and responds on `http://localhost:3000`.

## Scenario 8: Cleanup And Delete Test Customer

Expected:
- Admin can delete a test customer.
- Related records are removed or detached safely.
- Protected delete endpoint rejects unauthenticated requests.
- No broken references remain in admin views.

Result:
- Pass on 2026-06-28 with synthetic QA customers.

Evidence:
- Unauthenticated `DELETE /api/admin/customers/5b8b6dfc-4b51-4c47-ac18-c9df355e3ef0` returned HTTP `401` and message `Not authenticated.`
- Admin session was created through `/auth/session` using the temporary admin QA user.
- Authenticated `DELETE /api/admin/customers/fabef3bd-cc1b-4606-bb5e-1404ccc125e3` returned HTTP `200` with `{ success: true }`.
- Authenticated `DELETE /api/admin/customers/5b8b6dfc-4b51-4c47-ac18-c9df355e3ef0` returned HTTP `200` with `{ success: true }`.
- Deleted email-failure customer id: `fabef3bd-cc1b-4606-bb5e-1404ccc125e3`.
- Deleted payment-failed customer id: `5b8b6dfc-4b51-4c47-ac18-c9df355e3ef0`.
- Database verification showed `customers` count `0` for both deleted customers.
- Database verification showed `0` remaining rows by `customer_id` in `customer_message_files`, `customer_messages`, `customer_display_assets`, `customer_legal_agreements`, `consent_records`, `customer_subscriptions`, and `devices`.
- Database verification showed `0` lingering `customer_id` references in `admin_notifications`, `audit_events`, `inventory_events`, `inventory_items`, and `videos`.
- Detached audit history remains with `customer_id: null`, including `customer_deleted`, `customers_delete`, and `customer_subscriptions_delete` events.
- Admin customer list loaded after deletion without errors.
- Admin customer list no longer showed `TEST - Email Failure QA 20260628181738` or `TEST - Edge Cases QA 20260628181332`.
- Admin customer list still showed the main account-portal QA customer `TEST - Account Portal QA 14:27:39`.

Observation:
- Delete protection, child-row cleanup, log detachment, and admin list rendering passed.
- Browser automation could not trigger the `window.prompt` confirmation reliably, so the destructive operation was executed through the same protected admin DELETE route using an authenticated admin session cookie.

## Scenario 9: Realistic End-To-End Dress Rehearsal

Expected:
- A fresh customer can start on the landing page and move through the full live workflow.
- Admin can prepare a quote, send onboarding, verify payment, handle content/support, and assign display content.
- Customer-facing subpages and transactional emails follow the InfoSync visual theme.
- Each major activity has a timestamped audit/admin record.
- Final device display renders assigned content without broken states.

Result:
- In progress.

Verified so far:
- Fresh landing request submitted through the public landing page for `TEST - Dress Rehearsal QA 20260628184005`.
- New customer created as `10000013` with status `new_request` and requested package `Standard FHD`, quantity `1`.
- Admin notification created for the new request with priority `high`.
- Customer confirmation email failed for the plus-address because Resend test mode only allows `nadeesha7314@gmail.com`; urgent admin notification and audit event were created for the failed email.
- Admin prepared quote/order `1000000009` and sent onboarding to `nadeesha7314@gmail.com`.
- Customer onboarding profile/legal step accepted and recorded terms, privacy, marketing, analytics, and remote-support consent records with timestamps.
- Stripe Checkout completed in test mode and redirected to `/onboarding/payment-success?customer_id=a2be5fb4-d4c3-4bff-92f6-5a54ed958d6c`.
- Customer status is `paid`, `payment_status` is `paid`, and Stripe customer/subscription IDs are stored.
- Subscription `1000000009` is `paid`, setup fee is paid, Stripe payment status is `paid`, fulfillment status is `content_collection`, and inventory status is `ready_to_reserve`.
- Audit trail includes `landing_purchase_request_created`, `quote_onboarding_prepared`, `stripe_checkout_started`, and `payment_completed` with timestamps.
- Admin notification created for `payment_completed` with priority `urgent`.
- Customer account portal login was verified through the Supabase email-link session for `nadeesha7314@gmail.com`.
- Account portal resolved to the new paid dress rehearsal customer using Supabase Auth metadata, even though the email had an older QA customer linked by `auth_user_id`.
- Customer content setup was submitted with InfoSync template choice, business description, opening hours, promotions, social media, and display instructions.
- Customer moved to `content_received`, preview status moved to `waiting_for_admin`, subscription fulfillment moved to `content_received`, and `content_collected_at` was timestamped.
- Customer display instructions were stored as a text display asset and appended to customer notes for admin review.
- Latest content setup audit/admin notification includes `hasDisplayNotes: true`.
- Admin customer order view originally displayed Stripe checkout total as `239 700 kr`; fixed Stripe total/tax formatting so order `1000000009` now displays `2 397 kr`.
- Admin device creation was verified for `Scenario 9 Welcome Screen`; device code `XACRVK` was created for the customer and appears active.
- Display URL safety gate was verified: before customer activation `/display/XACRVK` showed `Display inactive`; after activation and before playlist assignment it showed `No content assigned`.
- Admin activation moved the customer to `active`, set `activated_at`, and moved the subscription to `active` / fulfillment `completed` / inventory `assigned`.
- A QA playlist item was attached to device `XACRVK` using a public MP4 sample because no local MP4 or ffmpeg tool was available for browser upload testing.
- `/display/XACRVK` rendered playable video with a nonblank screenshot, readyState `4`, dimensions `960x540`, and no media error.
- Live Supabase `playlists` schema was aligned with local migrations by adding `video_id`, `created_at`, `updated_at`, and the `set_updated_at` trigger.
- Existing QA playlist row `70579921-0138-4c67-a3f9-a5c468b52ab6` was linked to video row `dfe9b634-26d7-4f4d-9d3a-26aafcfb51d2`; `updated_at` changed on update, proving the trigger works.
- Admin media tab now shows `Media (1)` for `XACRVK`, and `/display/XACRVK` still plays the assigned MP4 after schema alignment.
- Quote/onboarding and standalone onboarding-link emails now use the shared branded InfoSync email wrapper.
- Branded email sample was sent successfully through Resend to `nadeesha7314@gmail.com`; Resend id `fc673bc7-b3ac-4ced-b97b-e58cc7751dd9`.
- Gmail visual check showed the first branded email could not load the logo because email clients cannot fetch `localhost` images.
- Email-safe brand assets were uploaded to public Supabase Storage bucket `email-assets` and the shared email wrapper now uses those HTTPS URLs for the logo and InfoSync helper image.
- Public email asset URLs were verified with HTTP `200` for `brand/infosync-logo-full-dark-bg.png` and `brand/infosync-helper.png`.
- Follow-up email image test was sent successfully through Resend to `nadeesha7314@gmail.com`; Resend id `0c4b2dc6-471b-46fd-b21f-e9afcc87e323`.
- User confirmed the email images now load in Gmail; the helper image was then reduced from full-width to a compact `220px` centered image in the shared email wrapper.
- Live Supabase `devices.updated_at` alignment was applied through the Supabase SQL editor and verified from the app connection; updating `XACRVK` changed `updated_at` from `2026-06-28T19:37:43.387699+00:00` to `2026-06-28T19:38:10.198654+00:00`.
- Backend MP4 media upload path was verified with `.tmp/infosync-upload-test.mp4`: file uploaded to Supabase Storage bucket `videos`, video row `2de58957-bb3b-4ad9-8b82-08e547cf241b` was created, and playlist row `2029af42-ea7d-493c-b453-332854dbf392` was added as order `2`.
- Admin media tab now shows `Media (2)` for `XACRVK`.
- `/display/XACRVK` advanced from the public sample MP4 to the Supabase Storage MP4 URL and played it with readyState `4`, dimensions `960x540`, and no media error.
- Browser check of `/admin/devices/XACRVK` confirmed the Media tab loads with the MP4-only upload area, disabled `Upload video` button before file selection, and both playlist items listed.
- Database check confirmed device `XACRVK` is active, customer `a2be5fb4-d4c3-4bff-92f6-5a54ed958d6c` is active, and both playlist rows remain assigned with `updated_at` timestamps.
- Admin device safety-gate toggle was tested: deactivating `XACRVK` from the admin UI showed success, changed the UI to `Inactive`, and `/display/XACRVK` showed `Display inactive` with no video element.
- Reactivating `XACRVK` from the admin UI showed success, changed the UI back to `Active`, left the database `is_active` as `true`, updated `devices.updated_at` to `2026-06-28T19:42:26.909704+00:00`, and `/display/XACRVK` resumed video playback with readyState `4`, dimensions `960x540`, and no media error.
- Admin smoke test loaded Dashboard, Customers, Orders, Inventory, Devices, and Pricing without console errors; Orders initially matched the broad error-text detector only because it displays normal `payment failed` status labels.
- Admin tracking save was tested on dress rehearsal order `1000000009`. Initial save exposed a bug where saving tracking on a `completed` order downgraded fulfillment to `shipped`.
- Fixed in code: saving tracking now preserves terminal fulfillment states `completed` and `cancelled`; it only auto-marks `shipped` for non-terminal orders.
- Retest saved tracking number `QA-XACRVK-FIX-1782675926743` and URL `https://example.com/track/QA-XACRVK-FIX-1782675926743`; database verification showed order `1000000009` stayed `completed` and `updated_at` changed to `2026-06-28T19:45:27.098957+00:00`.
- Product gap: no Canva-specific assignment/integration workflow was found. Today the system tracks customer content setup, preview status/URL, admin device assignment, video upload, playlist assignment, and display playback; Canva design/assignment remains an external admin production step.
- Product gap: admin Pricing page is currently informational/static from local pricing constants. Stripe Checkout uses the current app pricing data with dynamic `price_data`, so old Stripe Price IDs should not drive checkout, but pricing is not yet editable or synced from the admin UI.
- Customer portal login was verified with a Supabase magic link for `nadeesha7314@gmail.com`; `/account` resolved to the dress rehearsal customer through Auth metadata.
- Customer portal overview showed active customer status, one active screen, journey steps, and device `Scenario 9 Welcome Screen`.
- Customer billing section showed order `1000000009`, package `Standard FHD`, monthly price `249 kr`, setup fee `1 599 kr`, fulfillment `completed`, tracking number `QA-XACRVK-FIX-1782675926743`, and the matching tracking URL.
- Stripe customer billing portal button created a valid `billing.stripe.com` test portal session.
- Customer cancellation validation was tested without selecting a reason; the portal showed `Välj en avslutsorsak först.` and did not continue to subscription cancellation.
- Customer portal smoke test loaded Overview, Content setup, Screen material, Messages, Billing, and Legal sections without console errors or obvious error states.
- Customer portal notice handling was tested after cancellation validation; fixed in code so section-level notices clear when switching portal sections and do not leak into unrelated workflows.
- Active customer submitted a text-only screen material update from the `Skärmmaterial` section: `QA material update 2026-06-28T19:51:38.517Z`.
- The material update appeared immediately in customer history, created `customer_display_assets` row `31fc9284-d0af-4cf0-b650-323cb291b418` with `source: account`, `status: new`, and timestamp `2026-06-28T19:51:39.456832+00:00`.
- Audit event `customer_display_material_uploaded` was stored at `2026-06-28T19:51:39.720398+00:00`, and admin notification `New display material` was stored with priority `high` at `2026-06-28T19:51:39.897057+00:00`.
- Customer image/PDF upload API was tested with `infosync-qa-logo.png` and `infosync-qa-menu.pdf`; the route returned HTTP `200` with `{ success: true }`.
- Supabase stored `infosync-qa-logo.png` as customer display asset `0d790f98-94b0-4bae-888f-f0d900a062b0` with `content_type: image/png`, `asset_category: logo`, timestamp `2026-06-28T20:00:19.723121+00:00`, and a working signed download URL.
- Supabase stored `infosync-qa-menu.pdf` as customer display asset `94e2bf71-3c83-4226-b9fe-cd6c140a2a05` with `content_type: application/pdf`, `asset_category: menu`, timestamp `2026-06-28T20:00:20.316103+00:00`, and a working signed download URL.
- File upload audit event `customer_display_material_uploaded` was stored at `2026-06-28T20:00:20.488515+00:00`, and admin notification `New display material` was stored with priority `high` at `2026-06-28T20:00:20.628168+00:00`.
- Customer material UI showed both uploaded files after reload with `Ladda ner` actions.
- Invalid customer upload with MIME type `application/x-msdownload` returned HTTP `400` and message `Endast JPG, PNG, WEBP, HEIC och PDF kan laddas upp.`
- Responsive smoke test ran on mobile `390x844`, tablet `768x1024`, and desktop `1366x768` for `/`, `/sa-fungerar-det`, `/account`, `/admin/orders`, and `/display/XACRVK`.
- Found and fixed tablet navigation overflow: at `768px`, the customer/public top navigation previously kept the desktop layout and pushed `Kontakta oss`, `Logga in`, or `Logga ut` offscreen. The shared landing/customer navigation now switches to the compact menu at `900px`.
- Responsive retest confirmed no visible horizontal overflow on the landing page, how-it-works page, account portal, admin-login redirect page, or display page at the tested mobile/tablet/desktop sizes.
- Account portal responsive retest confirmed the customer session loads the dress rehearsal account, overview counters, section navigation, and no stuck loading state at mobile/tablet/desktop sizes.
- `/admin/orders` in the current customer browser session redirects to `/admin-login` at all tested viewport sizes. This is the expected security behavior; logged-in admin responsive views still need a separate admin-session pass.
- `/display/XACRVK` responsive retest confirmed video playback at all tested viewport sizes with readyState `4`, dimensions `960x540`, no media error, and no horizontal overflow.
- Database verification confirmed `XACRVK` remains active, its customer remains active, and the playlist has two videos: the sample MP4 at order `1` and the uploaded Supabase MP4 at order `2`.
- Admin customer deletion UI was simplified from manual `DELETE` typing to a clear warning modal with explicit Cancel/Delete actions. The API still records a `customer_deleted` audit event before cleanup.
- Unauthorized delete protection was tested against `/api/admin/customers/00000000-0000-0000-0000-000000000000`; with no admin session it returned HTTP `401` and `Not authenticated.`
- `npx tsc --noEmit` passed.
- `npm run lint` passed with warnings only. Existing warnings are unused variables in `public/sw.js`, existing exhaustive-deps warnings in admin/display pages, and existing `<img>` optimization warnings.
- Added production/refund-boundary tracking for setup/layout work. Supabase migration `202606280004_production_refund_boundary.sql` adds `customers.production_status`, `layout_started_at`, and `setup_fee_locked_at`.
- Applied the production/refund-boundary migration in the Supabase SQL editor and verified the live database accepts `production_status`, `layout_started_at`, and `setup_fee_locked_at`.
- Added admin-only API route `/api/admin/customers/[customerId]/production` for `start_layout`; unauthenticated/non-admin POST returned HTTP `401`.
- Customer portal smoke test confirmed the overview page shows `Setup och avbokning`, production status `Ej startat`, the refundable-before-layout-start message, and no horizontal overflow.
- Payment success page smoke test confirmed the old `Till inloggning` button is gone; it now shows `Servicevillkor` and `Jag har redan skapat lösenord`, with no horizontal overflow.

## Scenario 10: Refund Boundary And Cancellation Source Preservation

Expected:
- Admin can mark layout/design work as started.
- Starting layout work timestamps the refund boundary and records audit history.
- Customer portal data shows the setup fee lock once layout work has started.
- Customer cancellation after layout start preserves the app/customer cancellation source when the Stripe cancellation webhook arrives.
- Customer cancellation before layout start cancels Stripe and the local subscription while leaving layout/lock timestamps empty.

Result:
- Pass on 2026-06-28 with synthetic QA customers.

Evidence:
- Admin `start_layout` route was tested with an authenticated admin session against dress rehearsal customer `a2be5fb4-d4c3-4bff-92f6-5a54ed958d6c`.
- The route returned HTTP `200` and changed the customer to `production_status: layout_started`.
- `layout_started_at` and `setup_fee_locked_at` were set to `2026-06-28T20:30:10.271+00:00`.
- Audit event `layout_work_started` was stored with previous production status `not_started`.
- Subscription/order `1000000009` moved to `fulfillment_status: layout_started`.
- Account API verification returned the locked production fields for the same customer.
- Browser visual verification of that specific locked account message was blocked by an in-app browser automation timeout, but the account API returned the correct data.
- Cancellation after layout start initially exposed a race where the Stripe `customer.subscription.deleted` webhook overwrote app/customer cancellation source fields.
- Fixed in code: customer cancellation now stores `inactive_reason: customer_cancelled`, keeps the detailed reason in `cancellation_reason`, persists the local cancellation before calling Stripe, and the Stripe webhook preserves existing `customer` or `admin` cancellation sources.
- After-lock cancellation retest passed with customer `182bd0fb-4c4f-425f-9e2a-1f05dc3aae3f`, order `1000000017`, Stripe subscription `sub_1TnPViGhi0eDHRQZLPB3f9GV`.
- After-lock cancellation retest ended with Stripe status `canceled`, customer `status: suspended`, `payment_status: cancelled`, `inactive_reason: customer_cancelled`, `cancellation_reason: technical_issue`, `cancellation_source: customer`, and preserved `production_status: layout_started`.
- Before-layout cancellation retest passed with customer `aaa9cc01-bd64-4c63-8c7c-ad585765d68c`, subscription/order number `2679641253`, Stripe subscription `sub_1TnPbqGhi0eDHRQZOLBZaLQV`.
- Before-layout cancellation retest ended with Stripe status `canceled`, local subscription `status: cancelled`, `fulfillment_status: cancelled`, customer `cancellation_source: customer`, `cancellation_reason: temporary_pause`, `production_status: not_started`, and both `layout_started_at` and `setup_fee_locked_at` empty.
- Public visual smoke test passed for `/`, `/display/XACRVK`, and `/email-preview.html`; no broken images or browser console errors were detected.
- Landing MP4 loaded with readyState `4` and dimensions `1920x1080`.
- Display `XACRVK` loaded the assigned Supabase MP4 with readyState `4` and dimensions `960x540`.
- Static email preview page was restored at `/email-preview.html` so the branded email layout can be checked from the Git-backed project.
- Logged-in admin responsive pass was completed with the QA admin session on Dashboard, Customers, Orders, Inventory, Devices, and Pricing at mobile `390x844`, tablet `768x1024`, and desktop `1366x768`.
- The logged-in admin responsive pass found no admin redirects, no page-level horizontal overflow, and no browser console errors.
- Customers table content remains wider than mobile/tablet viewports, but it stays contained as an admin data table and does not create page-level horizontal overflow.
- Admin device media page `/admin/devices/XACRVK?section=media` loaded with `Media (2)`, one visible file input accepting `video/mp4`, disabled `Upload video` button before file selection, visible playlist rows, no console errors, and no page overflow.
- Gmail rendering check resumed after the user signed in.
- Older manual branded email `InfoSync email image test` in Inbox showed both remote images loading, but the helper image was oversized in that previously sent email and the manual test copy had mojibake.
- Fixed in code: shared branded email wrapper now declares UTF-8 metadata and constrains the helper image to `220px` width / `331px` height for email clients.
- Fixed in code: Swedish email copy in landing request, quote/onboarding, and onboarding-link routes no longer contains mojibake source strings.
- Real app quote email `Din InfoSync-offert 1000000009` in Gmail rendered Swedish characters correctly: `Här`, `Skärmenhet`, `Månadsabonnemang`, `Öppna`, `Länken`, and `Vänliga hälsningar`; no mojibake was detected in that app-generated email.
- Fresh direct branded test email was accepted by Resend with id `2e527e76-2b41-4b5c-83e5-5640d88184c0`, but Gmail placed it in Spam. In Spam, Gmail blocked remote image sources, so image loading could not be fully reverified there; sizing attributes were visible as `220 x 331`.
- Fresh app-generated landing confirmation email was sent successfully through `/api/onboarding-requests` for customer `6d3bfeda-e15c-4026-818f-9f37c5d71d6a` / `TEST - Gmail Email Render 20260628211036`; response returned `emailSent: true`.
- Gmail found the fresh app-generated email, but it was also placed in Spam/Bin. The rendered Spam view showed correct Swedish characters with no mojibake and showed the logo/helper placeholders sized correctly: logo `180px` wide and helper `220 x 331`.
- Conclusion: current app-generated email content and sizing are corrected; full remote image loading in Gmail Inbox still depends on deliverability/domain trust because Gmail blocks remote images for messages it classifies as Spam/Bin.
- Final MP4 upload-path smoke test uploaded `public/brand/infosync-service-overview.mp4` to Supabase Storage path `XACRVK/1782681267486-native-picker-final-smoke.mp4`.
- Supabase Storage returned a public video URL with HTTP `200`; playlist row `2633a2f4-3a55-44a1-b1b8-51789ec7bbe4` was inserted as order `3` with timestamp `2026-06-28T21:14:29.124777+00:00`.
- Admin media page retest showed `Media (3)`, `Order: 3`, MP4-only input, disabled upload button before file selection, no page overflow, and no console errors.
- `/display/XACRVK` retest played the newly uploaded Supabase MP4 with readyState `4`, dimensions `1920x1080`, no media error, no console errors, and no page overflow.
- Final route smoke returned HTTP `200` for `/`, `/admin`, `/display/XACRVK`, and `/email-preview.html`.
- Database verification confirmed device `XACRVK` remains active, its customer remains active, and the playlist has three ordered videos.

Observation:
- Setup-fee refund handling is now technically trackable because the system can distinguish before-layout and after-layout cancellation states.
- Actual Stripe refund action/amount decision is still an admin/business workflow decision; no automatic setup-fee refund has been added yet.

Remaining:
- Functional QA is complete for the tested landing, onboarding, payment, admin, customer portal, email-template, media upload, and display playback flows.
- Native Windows file-picker selection itself cannot be driven by the current browser automation tool, but the MP4-only upload UI, Supabase Storage upload path, playlist insert, admin media listing, and display playback are verified.
- Improve email deliverability before launch by using a verified domain instead of the Resend test sender; current Gmail test places fresh dev/test emails in Spam/Bin, which blocks remote image loading. Content, UTF-8 Swedish text, and image sizing are verified.
- Optionally verify the `Start layout work` button itself in a logged-in browser session; the protected admin route, timestamps, audit event, account data, and subscription fulfillment transition have passed.
- Decide whether Canva production tracking should be added as first-class admin fields/actions, for example design status, Canva link, preview approval, assigned device/layout, and timestamped admin/customer notifications.
- Decide whether admin pricing should become editable and optionally synced to Stripe products/prices, instead of being a static reference page.
