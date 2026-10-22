import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const textExtensions = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".jsx",
  ".md",
  ".mjs",
  ".sql",
  ".ts",
  ".tsx",
  ".txt",
]);

const secretPatterns = [
  { label: "Stripe secret key", pattern: /sk_(?:live|test)_[A-Za-z0-9]{20,}/gu },
  { label: "webhook signing secret", pattern: /whsec_[A-Za-z0-9]{20,}/gu },
  { label: "Supabase secret key", pattern: /sb_secret_[A-Za-z0-9._-]{20,}/gu },
  {
    label: "Resend API key",
    pattern: /(?<![A-Za-z0-9_])re_[A-Za-z0-9_-]{30,}/gu,
  },
  { label: "JWT-like credential", pattern: /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/gu },
  { label: "GitHub token", pattern: /gh[oprsu]_[A-Za-z0-9]{20,}/gu },
];

function repositoryFiles() {
  const output = execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    { encoding: "utf8" },
  );

  return Array.from(new Set(output.split("\0").filter(Boolean))).filter((file) => {
    if (!existsSync(file)) return false;
    const dot = file.lastIndexOf(".");
    return dot >= 0 && textExtensions.has(file.slice(dot).toLowerCase());
  });
}

const issues = [];

for (const file of repositoryFiles()) {
  const source = readFileSync(file, "utf8");
  for (const { label, pattern } of secretPatterns) {
    pattern.lastIndex = 0;
    if (pattern.test(source)) issues.push(`${file}: possible ${label}`);
  }

  if (
    /^(?:"use client"|'use client')/u.test(source.trimStart()) &&
    /SUPABASE_SERVICE_ROLE_KEY|STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET|RESEND_API_KEY|RESEND_RECEIVING_API_KEY|RESEND_WEBHOOK_SECRET|CRON_SECRET/u.test(source)
  ) {
    issues.push(`${file}: server credential referenced by a client module`);
  }

  if (
    file.startsWith("supabase/migrations/") &&
    /pg_catalog\.(?:greatest|least)\s*\(/iu.test(source)
  ) {
    issues.push(
      `${file}: PostgreSQL GREATEST/LEAST expressions must not be schema-qualified`,
    );
  }

  if (
    file.startsWith("supabase/migrations/20260903") &&
    /\bcurrent_time\s+timestamptz\b/iu.test(source)
  ) {
    issues.push(
      `${file}: CURRENT_TIME must not be reused as a PL/pgSQL variable name`,
    );
  }
}

if (issues.length > 0) {
  console.error("Security invariant check failed:");
  issues.forEach((issue) => console.error(`- ${issue}`));
  process.exit(1);
}

console.log("Security invariant check passed: no tracked secret-shaped values or client-side server credentials found.");
