# InfoSync Admin QA Test Plan

Use this checklist with Stripe test mode, Supabase test data, and a test email address.
Prefix test companies with `TEST -` so they can be cleaned up safely.

## Test Run Log

| Date | Tester | Environment | Result | Notes |
| --- | --- | --- | --- | --- |
| 2026-06-28 | Codex + admin | Localhost + live Supabase/Stripe test services | In progress | Initial structured admin acceptance run. |

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
- The onboarding input fields are visually labelled by placeholders but have no stable `id`, `name`, or `aria-label`. This should be improved for accessibility and reliable automated testing.

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
- Pending.

## Scenario 6: Admin Communication And Support

Expected:
- Admin can view customer uploads/messages.
- Admin can respond or record support activity.
- Each important message/event has a timestamped record.

Result:
- Pending.

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
