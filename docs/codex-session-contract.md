# Screenia Codex session contract

This is the durable handoff for Screenia work. It is intentionally free of
passwords, API keys, webhook secrets, and customer data.

## Start every session

Run the automated bootstrap before inspecting or editing files:

```powershell
npm.cmd run session:prepare
```

Then read these files in order:

1. `docs/current-project-checkpoint.md`
2. `docs/codex-session-contract.md`
3. `LOCAL_DEV_REMINDER.md`

Use `C:\Users\nadee\Desktop\screenia` as the canonical checkout and
`codex/local-service-setup` as the active working branch. A temporary Codex
worktree must be clean before the bootstrap changes its revision. Never reset,
discard, or overwrite uncommitted work automatically.

## Working style

- Use Windows PowerShell commands with `npm.cmd` and `npx.cmd`.
- Prefer the existing local checkout, ignored `.env.local`, CLI sessions, and
  browser sessions before asking the user to authenticate again.
- If authentication is genuinely blocked, name the exact provider and page
  that needs sign-in. Never ask the user to paste passwords, API keys, or
  webhook secrets into chat.
- Never put secrets in Git, memory, checkpoint files, client code, generated
  output, or comments.
- Preserve ambiguous payment, refund, VAT, audit, and customer records. Inspect
  provenance and retention impact before any cleanup.
- Keep generated concepts in `output/imagegen/`; only deliberate production
  assets copied under `public/` should enter Git.

## Screenia product and billing rules

- Customer-facing prices are final Swedish prices including moms.
- The administrative/startup charge is 499 kr including moms.
- A selected new client may receive that charge free; existing-customer
  add-ons must not inherit the waiver.
- Issued offers retain their recorded terms during their validity period.
- Current monthly plans are Standard FHD 249 kr, Premium 349 kr, and Premium
  Plus 399 kr. Hardware and shipping remain separate offer/order items.
- A price change is a cross-system change: inspect and update application
  pricing, Supabase rows/migrations, Stripe replacement Prices, persisted quote
  snapshots, documents/PDFs, customer-facing copy, and billing tests together.
- Passing an invariant test does not prove that live Supabase rows, Stripe IDs,
  PDFs, emails, or customer copy are synchronized. Verify each relevant surface.

## Provider boundaries

- Supabase project reference: `wcmhvldpelfhurlsuwwy`.
- Stripe and Resend webhook signatures must remain verified.
- Local payment work uses Stripe test mode unless the user explicitly requests
  a reviewed live-payment operation.
- Keep live-payment gates disabled until the launch-readiness evidence is
  complete; do not infer readiness from a passing local test.
- Production email sends through Resend from `service@screenia.se`; Zoho keeps
  the main `screenia.se` mailbox routing.
- Never enable Resend receiving on the apex `screenia.se` domain. Use the
  isolated receiving domain and preserve the Zoho MX setup.
- Treat Vercel production secrets as sensitive environment variables. Do not
  copy their values into local instructions or logs.

At security or deployment sessions, surface the pending review items from the
checkpoint: Stripe 2FA/team/least-privilege access; Supabase password-leak
protection, CAPTCHA, MFA, backup/PITR and plan fit; GitHub visibility; DMARC
enforcement; legacy display-code rotation; uploaded-file scanning; and a
nonce-based CSP.

## Verification and release

- For a normal code change, run focused tests and checks proportional to risk.
- Before a reviewed release, run `npm.cmd run release:check`.
- If nested `npm audit` networking stalls, run
  `npm.cmd audit --audit-level=high --json` separately and continue the other
  checks. Do not use `npm audit fix --force` as routine setup.
- A deployment is complete only after Vercel reports `READY` and the live site
  has smoke tests for `/`, `/sa-fungerar-det`, and `/kontakt`, including the
  expected security headers and changed assets.
- Do not claim provider synchronization from historical checkpoints; recheck
  live state before reporting it as current.

## Handoff at the end of a session

Before stopping, leave the work reproducible:

1. Run `git status --short --branch`.
2. Commit and push reviewed work to `codex/local-service-setup` when it is a
   meaningful checkpoint.
3. Keep `.env.local`, `.vercel`, `node_modules`, and `output/imagegen/` local.
4. Update the checkpoint only with verified, non-secret facts. Label provider
   observations with the date they were verified.
5. Report unfinished work, blockers, and the exact next verification step.

User instructions in the current conversation override this contract.
