# Screenia Subscription Operations

This document defines how Screenia handles subscription lifecycle operations in
the admin panel, customer portal, Stripe, Supabase, and display devices.

## Entitlement Matrix

| State | Stripe behavior | Screenia access | Display devices |
| --- | --- | --- | --- |
| `active` | Subscription active and paid | Customer can use portal and service | Content plays |
| `active_until_period_end` | `cancel_at_period_end = true` | Customer keeps paid access until `service_access_until` | Content plays until paid-through date |
| `paused` | Stripe `pause_collection` enabled | Customer is suspended operationally | Content blocked immediately |
| `payment_failed` | Stripe invoice failed or unpaid | Customer is suspended | Content blocked immediately |
| `payment_disputed` | Stripe dispute or chargeback opened | Customer is suspended until review or won-dispute sync | Content blocked immediately |
| `cancelled` | Stripe subscription ended | Subscription no longer valid | Content blocked |
| `refunded` | First payment refunded before production | Subscription no longer valid | Content blocked |

The display page and display RLS policies must both enforce the same rule:
device active, customer active, payment paid, access state active or
active-until-period-end, and paid-through date not expired.
If the display device lookup is blocked or hidden by RLS, the display page must
fail closed and clear cached playlist/video data instead of playing stale
content from local storage or the browser Cache API.
Display playback should use the server route
`/api/display/[deviceId]/playlist`, which verifies entitlement with the service
role and returns short-lived signed URLs for private video objects. The
`videos` storage bucket should not be public in production.

## Admin Operations

- **Cancel at period end** is the default cancellation path. It sets
  `cancel_at_period_end` in Stripe and keeps access until the current period
  end.
- **Cancel now** is only for exceptional cases. It cancels Stripe immediately,
  blocks display access, and records the admin reason.
- **Pause** uses Stripe `pause_collection`, sets Screenia access to `paused`,
  and blocks display access immediately.
- **Resume** clears Stripe pause collection and restores access when the
  subscription is otherwise paid/active.
- **Temporary discount** creates a Stripe coupon, applies it to the active
  subscription for a fixed number of months, stores a
  `subscription_adjustments` row, and records an audit event.
- **Activate, reactivate, suspend** must go through admin server routes so the
  audit trail records who changed service access and why.

## Required QA

- Customer cancellation schedules period-end cancellation and keeps display
  content live until `service_access_until`.
- Final Stripe cancellation/deletion webhook blocks display access.
- Admin immediate cancellation blocks display access immediately.
- Admin pause blocks display access immediately and creates audit history.
- Admin resume restores display access for paid active subscriptions.
- Admin temporary discount appears on the Stripe subscription and creates a
  local adjustment row.
- Failed Stripe payment sets access to `payment_failed` and blocks displays.
- Stripe dispute sets access to `payment_disputed`, blocks displays, creates an
  urgent admin notification, and records audit history.
- Stripe full external refund sets access to `refunded`, blocks displays,
  creates an urgent admin notification, and records audit history.
- Previously cached display content is cleared when the device/customer is no
  longer entitled, so paused, failed, disputed, expired, refunded, and cancelled
  customers cannot keep playing stale content.
- Display videos are served through signed URLs after entitlement is checked;
  old public video URLs should not be required for new uploads.
- `npm.cmd run lint` and `npm.cmd run build` must pass before deployment.
