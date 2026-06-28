# InfoSync Next Edit Bookmark

Date: 2026-06-28
Branch: `codex/local-service-setup`
Current clean commit: this commit, `Fix cancellation source preservation`
Server: `http://localhost:3000`

## Current Status Bookmark

- QA state is recorded in `QA_ADMIN_TEST_PLAN.md`.
- The latest work verifies refund-boundary tracking and fixes cancellation source preservation.
- TypeScript passed with `npx tsc --noEmit`.
- ESLint passed with warnings only.
- Current requested test batch status: 5 of 5 tests passed, 0 left.
- Current remaining QA items:
  - Native Windows file-picker MP4 upload with a real customer video.
  - Fresh app-generated branded email rendering in Gmail Inbox after the UTF-8/helper-size fix.
  - Product decisions for Canva tracking and admin/Stripe pricing sync.

## Next Edit List

### Stripe Payment / Refund Rules

Business rule to add:
- The initial setup/layout price is refundable only until InfoSync starts layout/design work.
- Once layout/design work starts, the setup/layout fee should be marked non-refundable.

Current system state:
- Added migration `202606280004_production_refund_boundary.sql`.
- Live Supabase now has `customers.production_status`, `layout_started_at`, and `setup_fee_locked_at`.
- Added admin-only route `/api/admin/customers/[customerId]/production` with action `start_layout`.
- Customer portal now shows the setup/refund boundary card.
- Payment success page no longer presents login as the primary next action.
- Protected admin `start_layout` route was tested successfully and recorded `layout_work_started`.
- Customer cancellation after layout start and before layout start were both tested successfully against Stripe test subscriptions.
- Cancellation code now preserves app/customer/admin cancellation source when the Stripe deleted-subscription webhook arrives later.
- Logged-in admin responsive pass is complete for Dashboard, Customers, Orders, Inventory, Devices, and Pricing at mobile/tablet/desktop sizes.
- Admin media upload UI is verified for `video/mp4`; the remaining native picker check requires manual Windows file selection.
- Gmail check found an old manual branded email with oversized helper image and mojibake test copy; fixed the shared email wrapper and Swedish email source strings.
- Gmail check confirmed a real app quote email renders Swedish characters correctly. A fresh direct branded test went to Spam, where Gmail blocks remote images, so a fresh app-generated Inbox email still needs final image-loading confirmation.

Recommended future implementation:
- Add admin/customer cancellation logic:
  - Before `layout_started_at`: allow cancellation and guide/admin-trigger Stripe refund for setup fee if already paid.
  - After `layout_started_at`: allow subscription cancellation, but show setup/layout fee as non-refundable.
- Add audit events for every status change with timestamps.
- Optional polish: verify the `Start layout work` button itself visually in a logged-in admin browser session; the route/data behavior has passed.

### Betalning Mottagen Window

Current page:
- `src/app/onboarding/payment-success/page.tsx`
- Shows `Betalning mottagen`, explains email/password setup, and has a `Till inloggning` button.

Question:
- The customer may not have an activated account/password at this moment, so the login button can be confusing.

Implemented:
- Primary action is now `Servicevillkor`.
- Login is now secondary text: `Jag har redan skapat lösenord`.

### Customer Profile Page Styling

Current page:
- `src/app/account/page.tsx`
- Uses functional cards and portal sections, but needs stronger visual theme polish.

Recommended future change:
- Style the customer portal with the InfoSync visual language:
  - richer hero panel,
  - helper image/graphic area,
  - softer shadows,
  - clearer section cards,
  - better empty states,
  - consistent Special Elite customer-facing headings,
  - responsive polish for mobile/tablet.
