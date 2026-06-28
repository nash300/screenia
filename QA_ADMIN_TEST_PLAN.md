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
- Partial pass on 2026-06-28 with synthetic QA customer.

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

Observation:
- Fixed in code: admin can update customer message status and record a timestamped audit event.
- Fixed in code: admin message update UI has stable form ids/names for testing and accessibility.
- Added migration `supabase/migrations/202606280002_customer_message_admin_notes.sql` for internal admin notes and resolved timestamps.
- Live database still needs that migration applied before internal admin notes persist. The fallback correctly saved status and audit metadata with `adminNoteStored: false`.

## Scenario 7: Error And Edge Cases

Expected:
- Invalid or missing landing page fields show clear errors.
- Expired onboarding links are blocked.
- Failed payment is handled without corrupting customer state.
- Email sending failure is surfaced clearly to admin.
- Unauthenticated users cannot access admin APIs.

Result:
- Pending.

## Scenario 8: Cleanup And Delete Test Customer

Expected:
- Admin can delete a test customer.
- Related records are removed or detached safely.
- Protected delete endpoint rejects unauthenticated requests.
- No broken references remain in admin views.

Result:
- Pending.
