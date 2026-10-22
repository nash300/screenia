# Screenia current project checkpoint

Last provider/product checkpoint: 2026-09-04 (Europe/Stockholm)
Session automation verified: 2026-10-22 (Europe/Stockholm)

This file is the first handoff to read in a new Screenia chat. It intentionally
contains no passwords, API keys, webhook secrets, or customer data. The active
Screenia development source is the remote `codex/local-service-setup` branch.
Treat `main` and all provider/deployment observations as separate release
state that must be re-verified before use.

## Repository and deployment

- Local checkout: `C:\Users\nadee\Desktop\screenia`
- Working branch: `codex/local-service-setup`
- GitHub repository: `nash300/screenia`
- Production URL: `https://screenia.se`
- Vercel project: `nadeesha7314-1449s-projects/screenia`
- The working branch and `main` were synchronized before this checkpoint.
- The session-continuity automation is committed on
  `codex/local-service-setup`; new work should start from that branch or run
  the bootstrap after switching to it.
- Latest verified Vercel production deployment before this checkpoint:
  `screenia-ejeptjlzq-nadeesha7314-1449s-projects.vercel.app` (`READY`).

Start every new session with the automated bootstrap and read
`docs/codex-session-contract.md`, then run the release gate when a release
check is needed:

```powershell
npm.cmd run session:prepare
npm.cmd run release:check
```

The bootstrap command is safe for normal session handoff: it refuses to
overwrite uncommitted work, updates clean temporary worktrees to the latest
`origin/codex/local-service-setup` revision, and restores the ignored local
`.env.local` file from the canonical checkout when needed.

If the nested `npm audit` process stalls, run `npm.cmd audit
--audit-level=high --json` separately, then run the other release checks. Do not
treat a network/advisory-service delay as a project failure.

## Current product rules

- Administrative/startup charge: **499 kr including moms**.
- Selected new clients can receive the administrative charge free.
- Existing-customer add-ons do not inherit the new-client waiver.
- Issued offers retain their recorded terms during their validity period.
- Customer-facing prices include Swedish moms.
- Current plans: Standard FHD 249 kr/month, Premium 349 kr/month, and Premium
  Plus 399 kr/month. Hardware and shipping remain separate offer/order items.

The automated billing scenarios verify one-time setup charging, multi-screen
thresholds, the selected-client waiver, existing-customer add-ons, and mixed
packages. Do not change only UI copy: update pricing logic, Stripe, persisted
offers, documents, and billing tests together.

## Current technical and provider state

- Next.js 16 application with Supabase, Stripe, Resend, Vercel, Zoho Mail, and
  GitHub. Read the installed Next.js agent documentation before code changes.
- Supabase project reference: `wcmhvldpelfhurlsuwwy`.
- Public self-sign-up is disabled. Customer accounts use the controlled
  invitation/onboarding flow.
- Sensitive customer, device, and playlist tables are protected by RLS and
  locked down from anonymous Data API reads.
- Production-wide rate limiting is backed by a Supabase RPC.
- Stripe and Resend webhook signatures are verified before processing.
- Production email sends from `service@screenia.se` through Resend. Zoho keeps
  the main `screenia.se` mailbox routing.
- Resend receiving must remain disabled on the main `screenia.se` domain. The
  configured isolated Resend receiving domain supplies case-specific reply
  addresses and feeds replies into Admin Messages.
- Vercel Production secrets are stored as Sensitive environment variables.
  Never copy their values into this file, source control, or client code.
- GitHub Dependabot, CodeQL, secret scanning, push protection, and main-branch
  force-push/deletion protection are enabled.

Security details and applied migrations are recorded in
`docs/security-audit-2026-09-03.md`.

## Verification at this checkpoint

- 42 test files and 320 tests passed.
- Security invariant check passed.
- `npm audit`: 0 vulnerabilities at every severity.
- Lint, text quality, style boundaries, admin-framework checks, TypeScript, and
  the production build passed.
- Billing invariant scenarios passed, including the 499 kr charge and free
  selected-new-client case.
- The last GitHub Release checks and CodeQL runs on the preceding source commit
  completed successfully.
- The real Resend inbound-reply flow was verified through Admin Messages, and
  its disposable inquiry, reply, notification, audit, and delivery-event rows
  were removed afterward.

## Open GitHub maintenance

Dependabot currently has 12 open PRs (`#3` through `#14`). They were created
from an older `main`; several checks are stale or failing and at least one
proposed Next.js version is older than the version now resolved locally. Do not
merge them as a batch. Rebase and review one dependency update at a time, read
the relevant Next.js upgrade notes, run the full release gate, and verify a
Vercel preview before merging.

## Remind the user next time

1. Sign in to Stripe and verify account 2FA, team access, least-privilege API
   access, and whether production is intentionally still in test mode.
2. Revisit Supabase leaked-password protection, CAPTCHA, MFA, backup/PITR, and
   whether a paid plan is appropriate.
3. Decide whether the public GitHub repository should remain public.
4. Review DMARC aggregate reports and, if delivery is healthy, raise
   enforcement from `pct=25` toward `pct=100`.
5. Plan rotation of legacy short display codes without disconnecting installed
   displays.
6. Consider malware/content scanning for uploaded customer files and a
   nonce-based CSP.

## Important operational guardrails

- Use `npm.cmd` and `npx.cmd` in PowerShell.
- Include `Origin: https://screenia.se` in production contact-form QA.
- Use uniquely labelled provider QA, prove the complete path, then remove only
  the exact QA records. Do not broadly delete payment, VAT, refund, or audit
  evidence.
- Do not enable Resend receiving on the apex domain; that would conflict with
  Zoho MX records.
- Do not rotate installed display codes without a maintenance plan.
- A deployment is complete only after Vercel reports `READY` and the live site
  has been smoke-tested.
