# Screenia Next Edit Bookmark

Date: 2026-07-13
Branch: `codex/local-service-setup`
Local app: `http://localhost:3000`
Supabase project: `wcmhvldpelfhurlsuwwy`

## Current Checkpoint

- `/admin/launch-readiness` is intentionally kept as a permanent admin operations page.
- Critical `20260712...` Supabase migrations were applied in the Supabase SQL Editor on the production project. Supabase reported: `Success. No rows returned`.
- Launch readiness improved after migrations from 23 blocked checks to 13 blocked checks.
- Latest critical validation passed:
  - `npm.cmd run lint`
  - `git diff --check` for touched readiness files
  - `npm.cmd run build`
- Current readiness summary after migration:
  - Passed: 38
  - Needs review: 11
  - Blocked: 13
  - Status: `Not ready`

## Remaining Critical Readiness Blockers

These are the next practical items. Do not go deeper than needed.

- Configure `RESEND_WEBHOOK_SECRET` so bounce/complaint/failure webhooks can be verified.
- Fix 1 post-onboarding/payment customer with missing or invalid Swedish organisation number.
- Add required admin reasons to these compliance workflows:
  - Legal change notices
  - Processor compliance reviews
  - Admin access reviews
  - Backup restore drills
  - Data retention reviews
- Resolve 1 active/paid customer with no active display device.
- Fix inventory existing-device link rollback visibility.
- Ensure high/critical privacy incidents create urgent admin notifications.
- Confirm paid invoices restore customers suspended by failed payments.
- Resolve storage readiness checks:
  - Private display videos bucket
  - Private sensitive customer storage

## Recently Completed

- Subscription operations, display entitlement gating, Stripe webhook ledger, data subject request register, privacy incident register, access review, backup drill, retention, processor, Resend event, legal notice, and preview decision database objects were added through the migration batch.
- Tax payment readiness false positives were fixed so the checker recognizes the actual `Cache-Control: no-store` implementation and split `.delete().eq(...)` rollback chain.
- Several admin/customer operations were hardened with required audit, rollback, and urgent admin notification paths.

## Resume Plan

1. Open `/admin/launch-readiness` and refresh.
2. Pick only one high-value blocked item.
3. Fix it in the smallest safe way.
4. Run only critical validation: `npm.cmd run lint`, `npm.cmd run build`, and one browser readiness refresh.
5. Stop if the next item would require external setup or business/legal decisions.
