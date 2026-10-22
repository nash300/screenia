<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Screenia session bootstrap

At the start of every Screenia task, run this once before inspecting or editing
project files:

```powershell
npm.cmd run session:prepare
```

This command fetches the shared `codex/local-service-setup` branch, updates a
clean temporary worktree to the latest remote revision, fast-forwards the
canonical checkout when it is clean, restores the ignored local development
environment from the canonical checkout, and installs dependencies when they
are missing. It refuses to change a checkout that contains uncommitted work.

Then read `docs/current-project-checkpoint.md` and `LOCAL_DEV_REMINDER.md`.
Never request or store provider secrets in chat or source control.
