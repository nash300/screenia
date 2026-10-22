import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const exists = (file) => fs.existsSync(path.join(root, file));

const navigation = read("src/lib/admin/navigation.ts");
const layout = read("src/app/admin/layout.tsx");
const emailEvidence = read("src/app/admin/email-events/page.tsx");
const contactInquiries = read("src/app/admin/contact-inquiries/page.tsx");
const adminApiRoot = path.join(root, "src/app/api/admin");
const adminApiRoutes = fs
  .readdirSync(adminApiRoot, { recursive: true })
  .filter((file) => String(file).endsWith("route.ts"))
  .map((file) => path.join(adminApiRoot, String(file)));

const problems = [];

if (navigation.includes('href: "/admin/launch-readiness"')) {
  problems.push("Launch readiness must not appear in admin navigation.");
}
if (navigation.includes('href: "/admin/email-events"')) {
  problems.push("Email evidence must not appear in daily admin navigation.");
}
if (navigation.includes('href: "/admin/troubleshooting"')) {
  problems.push("The retired Troubleshooting wrapper must not appear in admin navigation.");
}
if (navigation.includes('href: "/admin/training"')) {
  problems.push("The removed Training feature must not appear in admin navigation.");
}
if (layout.includes("AdminContextGuide") || layout.includes("admin-page-with-guide")) {
  problems.push("The global page guide must remain removed.");
}
if (!contactInquiries.includes('href="/admin/email-events"')) {
  problems.push("Messages must link to email delivery evidence.");
}
if (!emailEvidence.includes("Email evidence")) {
  problems.push("The email evidence diagnostic page is missing.");
}

for (const route of adminApiRoutes) {
  const source = fs.readFileSync(route, "utf8");
  const relativeRoute = path.relative(root, route);

  if (
    source.includes('from "@supabase/ssr"') ||
    source.includes('from "@supabase/supabase-js"') ||
    source.includes('from "next/headers"')
  ) {
    problems.push(
      `Admin API route bypasses the shared authentication boundary: ${relativeRoute}`,
    );
  }
  if (!source.includes('from "@/lib/server/admin-api"')) {
    problems.push(`Admin API route is missing the shared admin client: ${relativeRoute}`);
  }
}

for (const removedFile of [
  "src/app/admin/launch-readiness/page.tsx",
  "src/app/admin/training/page.tsx",
  "src/components/AdminContextGuide.tsx",
  "src/lib/admin/help-catalog.ts",
  "src/lib/admin/operation-scenarios.ts",
  "src/app/admin/troubleshooting/page.tsx",
]) {
  if (exists(removedFile)) problems.push(`Obsolete admin file still exists: ${removedFile}`);
}

if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}

console.log("Admin surface check passed: shared API authentication, simplified navigation, removed Training feature, hidden email diagnostics, and no page guide.");
