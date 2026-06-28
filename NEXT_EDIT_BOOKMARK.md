# InfoSync Next Edit Bookmark

Date: 2026-06-28
Branch: `codex/local-service-setup`
Current clean commit: `9301687 Record responsive QA and simplify customer deletion`
Server: `http://localhost:3000`

## Current Status Bookmark

- QA state is recorded in `QA_ADMIN_TEST_PLAN.md`.
- The latest pushed work fixed tablet navigation overflow and simplified the admin customer deletion warning modal.
- TypeScript passed with `npx tsc --noEmit`.
- ESLint passed with warnings only.
- Current remaining QA items:
  - Native Windows file-picker MP4 upload with a real customer video.
  - Visual confirmation of latest real Gmail email rendering.
  - Logged-in admin responsive pass after signing into `/admin-login`.
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

Recommended future implementation:
- Run the `Start layout work` admin button in a logged-in admin session against a test customer and verify audit/timestamps.
- Add admin/customer cancellation logic:
  - Before `layout_started_at`: allow cancellation and guide/admin-trigger Stripe refund for setup fee if already paid.
  - After `layout_started_at`: allow subscription cancellation, but show setup/layout fee as non-refundable.
- Add audit events for every status change with timestamps.

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
