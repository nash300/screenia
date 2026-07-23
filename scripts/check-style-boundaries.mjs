import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const problems = [];

function exists(file) {
  return fs.existsSync(path.join(root, file));
}

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const relative = path.join(dir, entry.name).replaceAll("\\", "/");
    if (entry.isDirectory()) {
      if ([".git", ".next", "node_modules"].includes(entry.name)) continue;
      walk(relative, files);
    } else {
      files.push(relative);
    }
  }
  return files;
}

function countOccurrences(text, pattern) {
  return (text.match(pattern) || []).length;
}

function stripAtRuleBlocks(cssText) {
  let output = "";
  for (let index = 0; index < cssText.length; index += 1) {
    if (cssText[index] !== "@") {
      output += cssText[index];
      continue;
    }

    const nextBrace = cssText.indexOf("{", index);
    const nextSemicolon = cssText.indexOf(";", index);
    if (nextSemicolon !== -1 && (nextBrace === -1 || nextSemicolon < nextBrace)) {
      index = nextSemicolon;
      continue;
    }
    if (nextBrace === -1) {
      output += cssText[index];
      continue;
    }

    let depth = 0;
    for (let blockIndex = nextBrace; blockIndex < cssText.length; blockIndex += 1) {
      if (cssText[blockIndex] === "{") depth += 1;
      if (cssText[blockIndex] === "}") depth -= 1;
      if (depth === 0) {
        index = blockIndex;
        break;
      }
    }
  }
  return output;
}

function findDuplicateBaseSelectors(cssText) {
  const baseCss = stripAtRuleBlocks(cssText);
  const selectors = [...baseCss.matchAll(/(^|\n)\s*([^{}@][^{}]*)\s*\{/g)].map((match) =>
    match[2].trim(),
  );
  const counts = new Map();
  for (const selector of selectors) {
    counts.set(selector, (counts.get(selector) || 0) + 1);
  }
  return [...counts.entries()].filter(([, count]) => count > 1);
}

function findDuplicateCustomProperties(cssText, prefix) {
  const counts = new Map();
  for (const match of cssText.matchAll(/(--[a-z0-9-]+)\s*:/gi)) {
    const token = match[1];
    if (!token.startsWith(prefix)) continue;
    counts.set(token, (counts.get(token) || 0) + 1);
  }
  return [...counts.entries()].filter(([, count]) => count > 1);
}

const retiredPublicInfoFile = ["standalone", "public.css"].join("-");
const retiredBrandPattern = new RegExp(["info", "sync"].join(""), "i");

if (exists(`src/app/${retiredPublicInfoFile}`)) {
  problems.push("Use src/app/public-info.css instead of the retired public info stylesheet name.");
}

const sourceFiles = walk("src").filter((file) => /\.(css|tsx?|jsx?)$/.test(file));
const appStylesheets = sourceFiles.filter((file) => file.startsWith("src/app/") && file.endsWith(".css")).sort();
const publicFiles = walk("public");
const serviceLogoFiles = publicFiles.filter((file) => file.startsWith("public/landing/service-logos/"));
for (const file of serviceLogoFiles) {
  const fileName = path.basename(file);
  if (fileName === ".gitkeep") continue;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*\.png$/.test(fileName)) {
    problems.push(`${file} should use lowercase kebab-case PNG naming for predictable dynamic logo loading.`);
  }
}

const expectedAppStylesheets = [
  "src/app/admin/admin.css",
  "src/app/globals.css",
  "src/app/landing.css",
  "src/app/public-info.css",
];
if (appStylesheets.join("\n") !== expectedAppStylesheets.join("\n")) {
  problems.push(
    `Unexpected app stylesheet set. Keep CSS ownership in ${expectedAppStylesheets.join(", ")}. Found: ${appStylesheets.join(", ")}`,
  );
}

const retiredAdminThemePattern = new RegExp(["win", "95"].join(""), "i");
for (const file of sourceFiles) {
  const text = read(file);
  if (text.includes("bootstrap/dist/css") || text.includes("bootstrap/dist/js")) {
    problems.push(`${file} imports Bootstrap globally. Use scoped Screenia styles instead.`);
  }
  if (text.includes(retiredPublicInfoFile)) {
    problems.push(`${file} still imports or references the retired public info stylesheet name.`);
  }
  if (retiredBrandPattern.test(text)) {
    problems.push(`${file} still contains the retired company name.`);
  }
  if (retiredAdminThemePattern.test(text)) {
    problems.push(`${file} still contains a retired admin theme token name.`);
  }
  if (text.includes("placeholder.supabase.co") || text.includes('SERVICE_ROLE_KEY || "placeholder"')) {
    problems.push(`${file} contains placeholder Supabase credentials. Use explicit env checks and avoid fake service keys.`);
  }
  if (text.includes(["admin", "cyan"].join("-"))) {
    problems.push(`${file} still contains retired admin focus color token naming. Use admin-focus instead.`);
  }
  if (
    /\.(tsx?|jsx?)$/.test(file) &&
    file !== "src/components/LandingScrollReveal.tsx" &&
    (text.includes("landing-reveal-target") ||
      text.includes("new IntersectionObserver") ||
      text.includes("document.querySelectorAll<HTMLElement>(selectors.join"))
  ) {
    problems.push(`${file} duplicates landing scroll reveal behavior. Use LandingScrollReveal instead.`);
  }
}

const globals = read("src/app/globals.css");
const adminCss = read("src/app/admin/admin.css");
const landingCss = read("src/app/landing.css");
const publicInfoCss = read("src/app/public-info.css");
const adminSidebarNavSource = read("src/components/AdminSidebarNav.tsx");
const landingNavSource = read("src/components/LandingNav.tsx");
const landingScrollRevealSource = read("src/components/LandingScrollReveal.tsx");
const landingPageSource = read("src/app/page.tsx");
const accountPageSource = read("src/app/account/page.tsx");
const onboardingPageSource = read("src/app/onboarding/[token]/page.tsx");
const adminDashboardPageSource = read("src/app/admin/page.tsx");
const ordersPageSource = read("src/app/admin/orders/page.tsx");
const emailEventsPageSource = read("src/app/admin/email-events/page.tsx");
const contactInquiriesPageSource = read("src/app/admin/contact-inquiries/page.tsx");
const compliancePageSource = read("src/app/admin/compliance/page.tsx");
const dataSubjectRequestsPageSource = read("src/app/admin/data-subject-requests/page.tsx");
const accessReviewsPageSource = read("src/app/admin/access-reviews/page.tsx");
const dataRetentionPageSource = read("src/app/admin/data-retention/page.tsx");
const privacyIncidentsPageSource = read("src/app/admin/privacy-incidents/page.tsx");
const processorReviewsPageSource = read("src/app/admin/processor-reviews/page.tsx");
const backupDrillsPageSource = read("src/app/admin/backup-drills/page.tsx");
const taxPaymentsPageSource = read("src/app/admin/tax-payments/page.tsx");
const legalChangeNoticesPageSource = read("src/app/admin/legal-change-notices/page.tsx");
const legalDocumentsPageSource = read("src/app/admin/legal-documents/page.tsx");
const inventoryPageSource = read("src/app/admin/inventory/page.tsx");
const devicesPageSource = read("src/app/admin/devices/page.tsx");
const newDevicePageSource = read("src/app/admin/devices/new/page.tsx");
const customersPageSource = read("src/app/admin/customers/page.tsx");
const customerDetailPageSource = read("src/app/admin/customers/[customerId]/page.tsx");
const deviceDetailPageSource = read("src/app/admin/devices/[deviceId]/page.tsx");
const landingContentPageSource = read("src/app/admin/landing-content/page.tsx");
const authPageSources = new Map([
  ["src/app/login/page.tsx", read("src/app/login/page.tsx")],
  ["src/app/admin-login/page.tsx", read("src/app/admin-login/page.tsx")],
  ["src/app/account/activate/page.tsx", read("src/app/account/activate/page.tsx")],
  ["src/app/account/reset-password/page.tsx", read("src/app/account/reset-password/page.tsx")],
]);

for (const retiredRevealClassName of [
  '"is-visible"',
  '"from-scroll-down"',
  '"from-scroll-up"',
]) {
  if (landingScrollRevealSource.includes(retiredRevealClassName)) {
    problems.push(
      `LandingScrollReveal must use explicit landing-reveal-* state classes instead of ${retiredRevealClassName}.`,
    );
  }
}

for (const requiredRevealClassName of [
  "landing-reveal-visible",
  "landing-reveal-from-scroll-down",
  "landing-reveal-from-scroll-up",
]) {
  if (!landingScrollRevealSource.includes(requiredRevealClassName)) {
    problems.push(`LandingScrollReveal must define ${requiredRevealClassName}.`);
  }
  if (!landingCss.includes(requiredRevealClassName)) {
    problems.push(`src/app/landing.css must style ${requiredRevealClassName}.`);
  }
}

for (const retiredRevealSelector of [
  ".landing-reveal-target.is-visible",
  ".landing-reveal-target.from-scroll-down",
  ".landing-reveal-target.from-scroll-up",
]) {
  if (landingCss.includes(retiredRevealSelector)) {
    problems.push(
      `src/app/landing.css must not keep generic reveal selector ${retiredRevealSelector}.`,
    );
  }
}

for (const file of publicFiles.filter((item) => !/\.pdf$/i.test(item))) {
  const text = read(file);
  if (retiredBrandPattern.test(text)) {
    problems.push(`${file} still contains the retired company name.`);
  }
}

const temporaryCssSectionLabelPattern = /\b(?:REFRESH|POLISH|PASS|FINAL LAYER|LAST-RESORT|HACK|TODO|FIXME)\b/i;
const cssFiles = expectedAppStylesheets;

for (const file of cssFiles) {
  const text = read(file);
  if (temporaryCssSectionLabelPattern.test(text)) {
    problems.push(`${file} contains temporary cleanup wording in a CSS section label or comment.`);
  }
}

const globalImportantLines = globals
  .split(/\r?\n/)
  .map((line, index) => ({ line, index: index + 1 }))
  .filter(({ line }) => line.includes("!important"));

for (const { index, line } of globalImportantLines) {
  problems.push(`src/app/globals.css:${index} uses !important: ${line.trim()}`);
}

const bannedGlobalSelectors = [
  ".navbar",
  ".navbar-glass",
  ".navbar-nav",
  ".brand-logo",
  ".brand-mark",
  ".brand-wordmark",
  ".btn-dark",
  ".mobile-toggle",
  ".mobile-menu",
  ".mobile-backdrop",
  ".page-transition",
];

for (const selector of bannedGlobalSelectors) {
  if (globals.includes(selector)) {
    problems.push(`src/app/globals.css still contains unused legacy selector ${selector}.`);
  }
}

if (publicInfoCss.includes("!important")) {
  problems.push("src/app/public-info.css should stay scoped and must not use !important.");
}

if (publicInfoCss.includes(":is(")) {
  problems.push("src/app/public-info.css should use explicit page selectors instead of :is(...) groups.");
}

if (landingCss.includes(".landing-page main > :is(")) {
  problems.push("src/app/landing.css should use explicit section selectors instead of broad .landing-page main > :is(...) groups.");
}

if (landingCss.includes(":is(")) {
  problems.push("src/app/landing.css should use explicit selectors instead of :is(...) groups.");
}

for (const file of ["src/app/globals.css", "src/app/public-info.css"]) {
  const duplicates = findDuplicateBaseSelectors(read(file));
  if (duplicates.length) {
    problems.push(
      `${file} contains duplicate base selectors: ${duplicates
        .map(([selector, count]) => `${selector} (${count})`)
        .join(", ")}. Merge base styles and keep responsive overrides inside media queries.`,
    );
  }
}

if (landingCss.includes("screenia-auth-")) {
  problems.push("src/app/landing.css must not define screenia-auth-* classes. Auth surface styling belongs in globals.css only.");
}

for (const className of [
  "screenia-auth-layout",
  "screenia-auth-hero",
  "screenia-auth-card-wrap",
  "screenia-auth-card-kicker",
  "screenia-auth-form-stack",
  "screenia-auth-field",
  "screenia-auth-label",
  "screenia-auth-alert",
  "screenia-auth-link-button",
]) {
  if (!globals.includes(className)) {
    problems.push(`src/app/globals.css must define the shared auth class ${className}.`);
  }
}

for (const [file, source] of authPageSources) {
  for (const retiredAuthClass of [
    "min-h-screen overflow-hidden",
    "absolute inset-0",
    "relative mx-auto grid",
    "hidden text-white lg:block",
    "inline-flex no-underline",
    "border border-white/70",
    "bg-white/[",
    "space-y-4",
    "text-xs font-black uppercase",
    "screenia-auth-input mt-2",
    "screenia-auth-button mt-",
    "disabled:hover:translate-y-0",
    "font-bold text-[#2f7df6]",
  ]) {
    if (source.includes(retiredAuthClass)) {
      problems.push(`${file} must use explicit screenia-auth-* classes instead of retired utility snippet "${retiredAuthClass}".`);
    }
  }
}

if (adminSidebarNavSource.includes('"is-active"')) {
  problems.push("AdminSidebarNav must use admin-nav-link-active instead of generic is-active state naming.");
}

if (!adminSidebarNavSource.includes("admin-nav-link-active")) {
  problems.push("AdminSidebarNav must expose the explicit admin-nav-link-active state class.");
}

if (adminCss.includes(".admin-nav-link.is-active")) {
  problems.push("src/app/admin/admin.css must style admin-nav-link-active instead of generic admin-nav-link.is-active.");
}

if (/(^|[^a-z0-9-])page-header([^a-z0-9-]|$)/i.test(adminCss)) {
  problems.push("src/app/admin/admin.css must not keep the retired generic page-header alias. Use admin-page-header.");
}

if (sourceFiles.some((file) => file.startsWith("src/app/admin/") && /(^|[^a-z0-9-])page-header([^a-z0-9-]|$)/i.test(read(file)))) {
  problems.push("Admin pages must use admin-page-header instead of the retired generic page-header class.");
}

if (/(^|\n)\.card(\s|,|\{|:|>)/.test(adminCss) || /\.card\s+h[1-6]\b/.test(adminCss)) {
  problems.push("src/app/admin/admin.css must not keep the retired generic card alias. Use admin-card.");
}

if (/(^|\n)\.eyebrow(\s|,|\{|:)/.test(adminCss)) {
  problems.push("src/app/admin/admin.css must not keep the retired generic eyebrow alias. Use admin-eyebrow.");
}

if (
  sourceFiles.some(
    (file) =>
      file.startsWith("src/app/admin/") &&
      /className=(?:"(?:[^"]*\s)?(?:card|eyebrow)(?:\s[^"]*)?"|`(?:[^`]*\s)?(?:card|eyebrow)(?:\s[^`]*)?`)/.test(read(file)),
  )
) {
  problems.push("Admin pages must use explicit admin-card/admin-eyebrow class names instead of generic card or eyebrow.");
}

if (adminCss.includes(".is-active")) {
  problems.push("src/app/admin/admin.css must not contain generic .is-active selectors. Use explicit component state class names.");
}

if (adminCss.includes(".admin-operation-card.is-selected")) {
  problems.push("src/app/admin/admin.css must style admin-operation-card-selected instead of generic admin-operation-card.is-selected.");
}

if (adminCss.includes("admin-section-tab")) {
  problems.push("src/app/admin/admin.css must not keep retired admin-section-tab styling.");
}

for (const retiredAdminHelper of [
  "admin-window-border",
  "admin-sidebar-glow",
  "admin-sidebar-progress",
  "admin-sidebar-progress-fill",
]) {
  if (adminCss.includes(retiredAdminHelper)) {
    problems.push(`src/app/admin/admin.css must not keep retired ${retiredAdminHelper} styling.`);
  }
}

if (
  /\.admin-customers-search(?:\s|,|\{|::)/.test(adminCss) ||
  adminCss.includes(".admin-customers-search .")
) {
  problems.push("src/app/admin/admin.css must not keep retired admin-customers-search wrapper styling. Use admin-customers-toolbar/search-row.");
}

if (/\b(?:admin-card p-6|admin-card-title text-xl|mt-1|mt-4|w-full|rounded-xl|border-slate-200|px-3|py-2|text-slate-|disabled:opacity-50|text-sm font-semibold)\b/.test(customersPageSource)) {
  problems.push("The admin customers page must use explicit admin-customers-* classes instead of broad utility class styling.");
}

for (const className of [
  "admin-customers-loading-panel",
  "admin-customers-panel-title",
  "admin-customers-create-field",
  "admin-customers-create-control",
  "admin-customers-create-submit",
  "admin-customer-status-active",
  "admin-customer-status-default",
]) {
  if (!customersPageSource.includes(className)) {
    problems.push(`The admin customers page must expose the explicit ${className} class.`);
  }
  if (!adminCss.includes(`.${className}`)) {
    problems.push(`src/app/admin/admin.css must define the explicit .${className} selector.`);
  }
}

if (!adminCss.includes(".admin-operation-card.admin-operation-card-selected")) {
  problems.push("src/app/admin/admin.css must define the explicit admin-operation-card-selected selector.");
}

if (!adminCss.includes(".admin-nav-link.admin-nav-link-active")) {
  problems.push("src/app/admin/admin.css must define the explicit admin-nav-link-active selector.");
}

if (landingNavSource.includes('"is-active"')) {
  problems.push("LandingNav must use landing-nav-link-active instead of generic is-active state naming.");
}

if (landingNavSource.includes("landing-links open")) {
  problems.push("LandingNav must use landing-links-open instead of a generic open state class.");
}

if (!landingNavSource.includes("landing-nav-link-active")) {
  problems.push("LandingNav must expose the explicit landing-nav-link-active state class.");
}

if (!landingNavSource.includes("landing-nav-link")) {
  problems.push("LandingNav must expose the explicit landing-nav-link base class for primary navigation items.");
}

if (!landingNavSource.includes("landing-links-open")) {
  problems.push("LandingNav must expose the explicit landing-links-open menu state class.");
}

if (landingPageSource.includes('"is-active"')) {
  problems.push("The landing page must use explicit component state class names instead of generic is-active.");
}

if (!landingPageSource.includes("landing-hero-dot-active")) {
  problems.push("The landing hero carousel must expose the explicit landing-hero-dot-active state class.");
}

if (landingCss.includes(".landing-hero-dots button.is-active")) {
  problems.push("src/app/landing.css must style landing-hero-dot-active instead of generic hero dot is-active.");
}

if (/\.landing-page\s+:is\(\s*h1\s*,\s*h2\s*,\s*h3\s*,\s*h4\s*,\s*h5\s*,\s*h6\s*\)/s.test(landingCss)) {
  problems.push(
    "src/app/landing.css must not keep the retired broad h2-h6 UI-font override. Customer-facing headings use the shared display heading rule.",
  );
}

const explicitLandingHeadingSelector = `.landing-hero-copy h1,
.landing-hero-copy-main h1,
.landing-section-heading h2,
.landing-workflow-heading h2,
.landing-service-film-copy h2,
.landing-contact h2,
.landing-modal h2`;
const explicitLandingHeadingStart = landingCss.indexOf(`${explicitLandingHeadingSelector} {`);
const explicitLandingHeadingEnd =
  explicitLandingHeadingStart === -1 ? -1 : landingCss.indexOf("}", explicitLandingHeadingStart);
const explicitLandingHeadingBody =
  explicitLandingHeadingEnd === -1
    ? ""
    : landingCss.slice(explicitLandingHeadingStart, explicitLandingHeadingEnd);

if (
  !explicitLandingHeadingBody.includes("font-family: var(--landing-font-display);") ||
  !explicitLandingHeadingBody.includes("font-weight: 400;") ||
  !explicitLandingHeadingBody.includes("letter-spacing: 0;")
) {
  problems.push("src/app/landing.css must define customer-facing display typography through explicit heading selectors.");
}

if (explicitLandingHeadingBody.includes("!important")) {
  problems.push("src/app/landing.css must not rely on important heading overrides for customer-facing display typography.");
}

if (/\.active\b/.test(landingCss)) {
  problems.push("src/app/landing.css must not contain generic .active selectors. Use explicit component state class names.");
}

if (landingCss.includes(".landing-links.open")) {
  problems.push("src/app/landing.css must style landing-links-open instead of generic .landing-links.open.");
}

if (!landingCss.includes(".landing-links.landing-links-open")) {
  problems.push("src/app/landing.css must define the explicit landing-links-open menu state selector.");
}

for (const broadNavActionSelector of [
  ".landing-nav-actions a",
  ".landing-nav-actions button",
]) {
  if (landingCss.includes(broadNavActionSelector)) {
    problems.push(`src/app/landing.css must not style ${broadNavActionSelector}; target landing-nav-cta or landing-nav-login explicitly.`);
  }
}

if (!landingCss.includes(".landing-hero-dots button.landing-hero-dot-active")) {
  problems.push("src/app/landing.css must define the explicit landing-hero-dot-active selector.");
}

if (accountPageSource.includes('"is-active"')) {
  problems.push("The account page must use explicit component state class names instead of generic is-active.");
}

if (accountPageSource.includes('"is-open"') || accountPageSource.includes('"is-locked"')) {
  problems.push("The account page must use account-policy-card-open/locked instead of generic is-open/is-locked.");
}

if (accountPageSource.includes('"is-done"')) {
  problems.push("The account page must use account-status-step-done instead of generic is-done.");
}

if (accountPageSource.includes("account-file-list is-compact")) {
  problems.push("The account page must use account-file-list-compact instead of generic is-compact.");
}

for (const className of ["account-menu-button-active", "account-card-active"]) {
  if (!accountPageSource.includes(className)) {
    problems.push(`The account page must expose the explicit ${className} state class.`);
  }
  if (!landingCss.includes(className)) {
    problems.push(`src/app/landing.css must define the explicit ${className} selector.`);
  }
}

for (const className of ["account-policy-card-open", "account-policy-card-locked"]) {
  if (!accountPageSource.includes(className)) {
    problems.push(`The account page must expose the explicit ${className} state class.`);
  }
  if (!landingCss.includes(`.account-policy-card.${className}`)) {
    problems.push(`src/app/landing.css must define the explicit .account-policy-card.${className} selector.`);
  }
}

if (!accountPageSource.includes("account-status-step-done")) {
  problems.push("The account page must expose the explicit account-status-step-done state class.");
}

if (!landingCss.includes(".account-status-step.account-status-step-done")) {
  problems.push("src/app/landing.css must define the explicit .account-status-step.account-status-step-done selector.");
}

if (landingCss.includes(".account-status-step.is-done")) {
  problems.push("src/app/landing.css must not keep generic account status selector .account-status-step.is-done.");
}

if (!accountPageSource.includes("account-file-list-compact")) {
  problems.push("The account page must expose the explicit account-file-list-compact state class.");
}

if (!landingCss.includes(".account-file-list.account-file-list-compact")) {
  problems.push("src/app/landing.css must define the explicit .account-file-list.account-file-list-compact selector.");
}

if (landingCss.includes(".account-file-list.is-compact")) {
  problems.push("src/app/landing.css must not keep generic account file-list selector .account-file-list.is-compact.");
}

for (const retiredSelector of [".account-policy-card.is-open", ".account-policy-card.is-locked"]) {
  if (landingCss.includes(retiredSelector)) {
    problems.push(`src/app/landing.css must not keep generic account policy selector ${retiredSelector}.`);
  }
}

if (onboardingPageSource.includes('"is-active"')) {
  problems.push("The onboarding page must use flow-step-active instead of generic is-active.");
}

if (!onboardingPageSource.includes("flow-step-active")) {
  problems.push("The onboarding page must expose the explicit flow-step-active state class.");
}

if (landingCss.includes(".flow-step.is-active")) {
  problems.push("src/app/landing.css must style flow-step-active instead of generic flow-step.is-active.");
}

if (!landingCss.includes(".flow-step.flow-step-active")) {
  problems.push("src/app/landing.css must define the explicit flow-step-active selector.");
}

if (landingCss.includes(".flow-result-icon.warning")) {
  problems.push("src/app/landing.css must use flow-result-icon-warning instead of generic .flow-result-icon.warning.");
}

if (read("src/app/onboarding/payment-cancelled/page.tsx").includes('"flow-result-icon warning"')) {
  problems.push("The cancelled payment page must emit flow-result-icon-warning instead of generic warning.");
}

if (landingCss.includes("account-category-tabs")) {
  problems.push("src/app/landing.css still contains retired account-category-tabs styling. The account upload UI no longer emits that tab layer.");
}

if (emailEventsPageSource.includes('"is-active"')) {
  problems.push("The admin email-events page must use admin-email-filter-active instead of generic is-active.");
}

if (/\b(?:p-6|mt-4|mt-2|text-xl|text-sm|flex flex-col|md:flex-row)\b/.test(emailEventsPageSource)) {
  problems.push("The admin email-events page must use explicit admin-email-* classes instead of broad utility class styling.");
}

for (const className of [
  "admin-email-panel",
  "admin-email-heading",
  "admin-email-heading-copy",
  "admin-email-table-wrap",
]) {
  if (!emailEventsPageSource.includes(className)) {
    problems.push(`The admin email-events page must expose the explicit ${className} class.`);
  }
}

if (/\b(?:p-6|rounded-2xl|rounded-xl|border-slate-200|bg-slate-50|text-slate-)\b/.test(contactInquiriesPageSource)) {
  problems.push("The admin contact-inquiries page must use explicit admin-contact-* classes instead of broad utility class styling.");
}

if (!contactInquiriesPageSource.includes("admin-contact-panel")) {
  problems.push("The admin contact-inquiries page must expose the explicit admin-contact-panel class.");
}

if (/\b(?:p-6|text-xl)\b/.test(compliancePageSource)) {
  problems.push("The admin compliance page must use explicit admin-compliance-* classes instead of broad utility class styling.");
}

for (const className of ["admin-compliance-panel", "admin-compliance-title"]) {
  if (!compliancePageSource.includes(className)) {
    problems.push(`The admin compliance page must expose the explicit ${className} class.`);
  }
}

for (const selector of [".admin-compliance-panel", ".admin-compliance-title"]) {
  if (!adminCss.includes(selector)) {
    problems.push(`src/app/admin/admin.css must define the explicit ${selector} selector.`);
  }
}

if (/\b(?:p-6|mt-4|text-xl|grid gap-4|lg:grid-cols-2|flex flex-wrap gap-2|flex items-center gap-2)\b/.test(ordersPageSource)) {
  problems.push("The admin orders page must use explicit admin-orders-* classes instead of broad utility class styling.");
}

if (!ordersPageSource.includes("admin-orders-loading-panel")) {
  problems.push("The admin orders page must expose the explicit admin-orders-loading-panel class.");
}

if (!adminCss.includes(".admin-orders-loading-panel")) {
  problems.push("src/app/admin/admin.css must define the explicit .admin-orders-loading-panel selector.");
}

if (/\b(?:p-6|mt-4|text-xl|grid gap-4|lg:grid-cols-2|flex flex-col|md:flex-row|md:items-start|gap-3|space-y-3|rounded-2xl|border-emerald-200|border-slate-200|border-amber-200|bg-emerald-50|bg-white\/60|bg-amber-50|text-slate-|disabled:opacity-50)\b/.test(adminDashboardPageSource)) {
  problems.push("The admin dashboard page must use explicit admin-dashboard-* classes instead of broad utility class styling.");
}

for (const className of [
  "admin-dashboard-panel-title",
  "admin-dashboard-panel-heading",
  "admin-dashboard-notification-list",
  "admin-dashboard-notification",
  "admin-dashboard-notification-link",
  "admin-dashboard-notification-action",
]) {
  if (!adminDashboardPageSource.includes(className)) {
    problems.push(`The admin dashboard page must expose the explicit ${className} class.`);
  }
  if (!adminCss.includes(`.${className}`)) {
    problems.push(`src/app/admin/admin.css must define the explicit .${className} selector.`);
  }
}

for (const [pageName, pageSource] of [
  ["data-subject-requests", dataSubjectRequestsPageSource],
  ["access-reviews", accessReviewsPageSource],
  ["data-retention", dataRetentionPageSource],
  ["privacy-incidents", privacyIncidentsPageSource],
  ["processor-reviews", processorReviewsPageSource],
  ["backup-drills", backupDrillsPageSource],
  ["tax-payments", taxPaymentsPageSource],
  ["legal-change-notices", legalChangeNoticesPageSource],
]) {
  if (/\b(?:p-6|mt-4|text-xl|grid gap-4|lg:grid-cols-2|flex items-center gap-2|flex flex-wrap gap-2)\b/.test(pageSource)) {
    problems.push(`The admin ${pageName} page must use explicit admin-record-* classes instead of broad utility class styling.`);
  }
}

for (const className of ["admin-record-panel", "admin-record-title", "admin-record-table-wrap", "admin-record-actions"]) {
  if (!dataSubjectRequestsPageSource.includes(className)) {
    problems.push(`The admin data-subject-requests page must expose the explicit ${className} class.`);
  }
}

for (const className of [
  "admin-record-panel",
  "admin-record-title",
  "admin-record-form",
  "admin-record-table-wrap",
  "admin-record-actions",
]) {
  for (const [pageName, pageSource] of [
    ["access-reviews", accessReviewsPageSource],
    ["data-retention", dataRetentionPageSource],
    ["privacy-incidents", privacyIncidentsPageSource],
    ["processor-reviews", processorReviewsPageSource],
    ["backup-drills", backupDrillsPageSource],
    ["tax-payments", taxPaymentsPageSource],
    ["legal-change-notices", legalChangeNoticesPageSource],
  ]) {
    if (!pageSource.includes(className)) {
      problems.push(`The admin ${pageName} page must expose the explicit ${className} class.`);
    }
  }
}

for (const [pageName, pageSource] of [
  ["access-reviews", accessReviewsPageSource],
  ["privacy-incidents", privacyIncidentsPageSource],
  ["processor-reviews", processorReviewsPageSource],
  ["legal-change-notices", legalChangeNoticesPageSource],
]) {
  if (!pageSource.includes("admin-record-check")) {
    problems.push(`The admin ${pageName} page must expose the explicit admin-record-check class.`);
  }
}

for (const selector of [
  ".admin-record-panel",
  ".admin-record-title",
  ".admin-record-form",
  ".admin-record-check",
  ".admin-record-table-wrap",
  ".admin-record-actions",
]) {
  if (!adminCss.includes(selector)) {
    problems.push(`src/app/admin/admin.css must define the explicit ${selector} selector.`);
  }
}

if (!emailEventsPageSource.includes("admin-email-filter-active")) {
  problems.push("The admin email-events page must expose the explicit admin-email-filter-active state class.");
}

if (adminCss.includes(".admin-email-filter-row button.is-active")) {
  problems.push("src/app/admin/admin.css must style admin-email-filter-active instead of generic email filter is-active.");
}

if (!adminCss.includes(".admin-email-filter-row button.admin-email-filter-active")) {
  problems.push("src/app/admin/admin.css must define the explicit admin-email-filter-active selector.");
}

if (legalDocumentsPageSource.includes('"is-active"')) {
  problems.push("The admin legal-documents page must use admin-document-list-item-active instead of generic is-active.");
}

if (landingContentPageSource.includes('"is-disabled"')) {
  problems.push("The admin landing-content page must use admin-landing-upload-disabled instead of generic is-disabled.");
}

if (!landingContentPageSource.includes("admin-landing-upload-disabled")) {
  problems.push("The admin landing-content page must expose the explicit admin-landing-upload-disabled state class.");
}

if (!adminCss.includes(".admin-landing-upload.admin-landing-upload-disabled")) {
  problems.push("src/app/admin/admin.css must define the explicit .admin-landing-upload.admin-landing-upload-disabled selector.");
}

if (adminCss.includes(".admin-landing-upload.is-disabled")) {
  problems.push("src/app/admin/admin.css must not keep generic admin upload selector .admin-landing-upload.is-disabled.");
}

if (!legalDocumentsPageSource.includes("admin-document-list-item-active")) {
  problems.push("The admin legal-documents page must expose the explicit admin-document-list-item-active state class.");
}

if (adminCss.includes(".admin-document-list-item.is-active")) {
  problems.push("src/app/admin/admin.css must style admin-document-list-item-active instead of generic document list is-active.");
}

if (adminCss.includes("button.admin-document-list-item.is-active")) {
  problems.push("src/app/admin/admin.css must style button.admin-document-list-item-active instead of generic document list is-active.");
}

if (!adminCss.includes(".admin-document-list-item.admin-document-list-item-active")) {
  problems.push("src/app/admin/admin.css must define the explicit admin-document-list-item-active selector.");
}

if (inventoryPageSource.includes('"is-active"')) {
  problems.push("The admin inventory page must use admin-inventory-item-active instead of generic is-active.");
}

if (inventoryPageSource.includes('"is-selected"')) {
  problems.push("The admin inventory page must use admin-operation-card-selected instead of generic is-selected.");
}

if (!inventoryPageSource.includes("admin-inventory-item-active")) {
  problems.push("The admin inventory page must expose the explicit admin-inventory-item-active state class.");
}

if (adminCss.includes(".admin-inventory-item.is-active")) {
  problems.push("src/app/admin/admin.css must style admin-inventory-item-active instead of generic inventory item is-active.");
}

if (/\b(?:admin-card p-6|admin-card-title text-xl|mt-4 grid gap-4|lg:grid-cols-2|admin-table-wrap mt-4|flex flex-wrap gap-2|flex items-center gap-2)\b/.test(inventoryPageSource)) {
  problems.push("The admin inventory page must use explicit admin-inventory-* classes instead of broad utility class styling.");
}

for (const className of ["admin-inventory-panel", "admin-inventory-title"]) {
  if (!inventoryPageSource.includes(className)) {
    problems.push(`The admin inventory page must expose the explicit ${className} class.`);
  }
  if (!adminCss.includes(`.${className}`)) {
    problems.push(`src/app/admin/admin.css must define the explicit .${className} selector.`);
  }
}

if (
  /\b(?:rounded-2xl|rounded-xl|border-slate-200|bg-white\/70|bg-slate-50|text-slate-|hover:shadow|space-y-3|p-4|p-6)\b/.test(
    devicesPageSource,
  )
) {
  problems.push("The admin devices list page must use explicit admin-devices-* classes instead of broad utility class styling.");
}

if (
  /\b(?:rounded-2xl|rounded-xl|border-slate-200|bg-slate-50|text-slate-|focus:ring|focus:border|grid gap-|md:grid-cols|p-4|p-6|mt-1|mt-4|mt-6)\b/.test(
    newDevicePageSource,
  )
) {
  problems.push("The admin create-display page must use explicit admin-device-create-* classes instead of broad utility class styling.");
}

for (const className of [
  "admin-devices-list-panel",
  "admin-devices-info-panel",
  "admin-devices-toolbar",
  "admin-devices-search-input",
  "admin-device-list-card",
  "admin-device-list-pill-active",
  "admin-device-list-pill-inactive",
]) {
  if (!devicesPageSource.includes(className)) {
    problems.push(`The admin devices list page must expose the explicit ${className} class.`);
  }
}

for (const className of [
  "admin-device-create-panel",
  "admin-device-create-info-panel",
  "admin-device-create-grid",
  "admin-device-create-field",
  "admin-device-create-label",
  "admin-device-create-control",
  "admin-device-create-submit",
]) {
  if (!newDevicePageSource.includes(className)) {
    problems.push(`The admin create-display page must expose the explicit ${className} class.`);
  }
}

if (!adminCss.includes(".admin-inventory-item.admin-inventory-item-active")) {
  problems.push("src/app/admin/admin.css must define the explicit admin-inventory-item-active selector.");
}

if (adminCss.includes("admin-contact-filters")) {
  problems.push("src/app/admin/admin.css still contains retired admin-contact-filters button styling. Visitor messages use admin-list-selects now.");
}

if (adminCss.includes(".admin-contact-filters button.is-active")) {
  problems.push("src/app/admin/admin.css must not keep retired contact filter is-active styling.");
}

for (const retiredFilterClass of [
  "admin-order-filter-row",
  "admin-inventory-filter-row",
  "admin-order-section-filters",
]) {
  if (adminCss.includes(retiredFilterClass)) {
    problems.push(`src/app/admin/admin.css still contains retired ${retiredFilterClass} button-filter styling. Use current select/list controls instead.`);
  }
}

for (const retiredLandingClass of [
  "landing-language-switch",
  "landing-flag",
  "landing-flag-sv",
  "landing-flag-en",
  "landing-hero-media",
  "landing-hero-trust",
  "landing-slide-caption",
  "landing-slide-controls",
  "landing-panel-status",
  "landing-process-visual",
  "landing-device-visual",
  "landing-device-screen",
  "landing-pricing-layout",
  "landing-checkout-visual",
  "landing-comparison",
  "landing-trust",
  "landing-service-grid",
  "landing-service-mark",
  "landing-delivery-panel",
]) {
  if (landingCss.includes(retiredLandingClass)) {
    problems.push(`src/app/landing.css still contains retired ${retiredLandingClass} styling. Remove dead landing UI layers instead of keeping override-prone CSS.`);
  }
}

if (customerDetailPageSource.includes('"is-active"')) {
  problems.push("The admin customer detail page must use explicit workflow state class names instead of generic is-active.");
}

if (customerDetailPageSource.includes('"is-selected"')) {
  problems.push("The admin customer detail page must use admin-operation-card-selected instead of generic is-selected.");
}

for (const retiredCustomerActionButtonClass of [
  "rounded-xl bg-amber-700",
  "rounded-xl bg-red-800",
  "rounded-xl border border-slate-200 bg-white",
  "text-sm font-semibold text-[rgb(8,184,238)] no-underline",
  "mt-4 flex flex-col justify-between gap-4 md:flex-row md:items-end",
  "inline-flex w-fit rounded-full px-3 py-1 text-sm font-semibold",
  "admin-compact-info-grid mt-4",
  "admin-compact-note mt-4",
  "admin-edit-panel mt-4",
  "rounded-2xl border border-red-200 bg-red-50/70 p-4",
  "mt-3 grid grid-cols-[auto_minmax(0,1fr)] items-start gap-2 text-sm font-semibold text-red-900",
  "bg-green-100 text-green-700",
  "bg-blue-100 text-blue-700",
  "bg-red-100 text-red-700",
  "bg-purple-100 text-purple-700",
  "bg-yellow-100 text-yellow-700",
]) {
  if (customerDetailPageSource.includes(retiredCustomerActionButtonClass)) {
    problems.push(
      `The admin customer detail page must use explicit admin-button-* classes instead of ${retiredCustomerActionButtonClass}.`,
    );
  }
}

for (const className of [
  "admin-customer-workflow-step-active",
  "admin-communication-workflow-step-active",
  "admin-operation-card-selected",
  "admin-customer-overview-back-link",
  "admin-customer-overview-header-main",
  "admin-customer-overview-status",
  "admin-customer-overview-panel",
  "admin-customer-overview-edit-grid",
  "admin-customer-overview-control",
  "admin-customer-overview-danger-zone",
  "admin-customer-communication-panel",
  "admin-customer-communication-header",
  "admin-customer-message-panel",
  "admin-customer-message-card",
  "admin-customer-message-control",
  "admin-customer-message-file-link",
]) {
  if (!customerDetailPageSource.includes(className)) {
    problems.push(`The admin customer detail page must expose the explicit ${className} state class.`);
  }
  if (!adminCss.includes(className)) {
    problems.push(`src/app/admin/admin.css must define the explicit ${className} selector.`);
  }
}

for (const retiredSelector of [
  ".admin-customer-workflow-step.is-active",
  ".admin-communication-workflow-step.is-active",
]) {
  if (adminCss.includes(retiredSelector)) {
    problems.push(`src/app/admin/admin.css must not keep generic workflow selector ${retiredSelector}.`);
  }
}

if (deviceDetailPageSource.includes('"is-active"')) {
  problems.push("The admin device detail page must use admin-display-workflow-step-active instead of generic is-active.");
}

if (deviceDetailPageSource.includes('"is-selected"')) {
  problems.push("The admin device detail page must use admin-operation-card-selected instead of generic is-selected.");
}

if (
  /\b(?:admin-card p-6|admin-card-title text-xl|mt-[0-9]|mb-[0-9]|rounded-|border-slate|bg-slate|bg-green|bg-red|bg-white|text-slate-|text-white|text-black|w-full|h-full|px-[0-9]|py-[0-9]|p-[0-9]|gap-[0-9]|md:flex-row|md:items|md:grid-cols|flex flex-col|grid gap|space-y-[0-9]|disabled:opacity-50|focus:ring|focus:border|aspect-video|shadow-xl|border-0|break-all|font-mono)\b/.test(
    deviceDetailPageSource,
  )
) {
  problems.push("The admin device detail page must use explicit admin-device-detail/admin-device-preview classes instead of inline utility styling.");
}

if (!deviceDetailPageSource.includes("admin-display-workflow-step-active")) {
  problems.push("The admin device detail page must expose the explicit admin-display-workflow-step-active state class.");
}

if (adminCss.includes(".admin-display-workflow-step.is-active")) {
  problems.push("src/app/admin/admin.css must not keep generic display workflow selector .admin-display-workflow-step.is-active.");
}

if (!adminCss.includes("admin-display-workflow-step-active")) {
  problems.push("src/app/admin/admin.css must define the explicit admin-display-workflow-step-active selector.");
}

for (const className of [
  "admin-device-detail-loading-panel",
  "admin-device-detail-back-link",
  "admin-device-detail-header-main",
  "admin-device-detail-status",
  "admin-device-detail-panel",
  "admin-device-detail-title",
  "admin-device-detail-control",
  "admin-device-preview-shell",
  "admin-device-playlist-item",
  "admin-device-url-card",
  "admin-device-info-row",
]) {
  if (!deviceDetailPageSource.includes(className)) {
    problems.push(`The admin device detail page must expose the explicit ${className} class.`);
  }
  if (!adminCss.includes(className)) {
    problems.push(`src/app/admin/admin.css must define the explicit ${className} selector.`);
  }
}

const duplicateAdminTokens = findDuplicateCustomProperties(adminCss, "--admin-");
if (duplicateAdminTokens.length) {
  problems.push(
    `src/app/admin/admin.css contains duplicate admin custom properties: ${duplicateAdminTokens
      .map(([token, count]) => `${token} (${count})`)
      .join(", ")}. Keep admin tokens single-source in the first .admin-layout block.`,
  );
}

const importantRatchets = [
  {
    file: "src/app/admin/admin.css",
    css: adminCss,
    max: 72,
  },
  {
    file: "src/app/landing.css",
    css: landingCss,
    max: 214,
  },
];

for (const { file, css, max } of importantRatchets) {
  const count = countOccurrences(css, /!important/g);
  if (count > max) {
    problems.push(`${file} uses ${count} !important rules; keep the count at or below ${max} while cleanup continues.`);
  }
}

const retiredAdminTokenNames = [
  {
    token: ["admin", "classic"].join("-"),
    message: "src/app/admin/admin.css contains retired admin surface token naming. Use admin-surface tokens instead.",
  },
  {
    token: ["admin", "cyan"].join("-"),
    message: "src/app/admin/admin.css contains retired admin focus color token naming. Use admin-focus instead.",
  },
];

for (const { token, message } of retiredAdminTokenNames) {
  if (adminCss.includes(token)) {
    problems.push(message);
  }
}

for (const retiredLandingGlassPattern of [
  ".landing-page :is(.landing-section, .landing-contact, .landing-footer, .flow-shell, .account-shell)",
  ".landing-page :is(.landing-section-panel, .landing-contact-panel)",
  "background-color: rgba(10, 19, 22, 0.5)",
  "rgba(217, 234, 255, 0.32)",
  "rgba(217, 234, 255, 0.24)",
  "0 18px 46px rgba(0, 10, 32, 0.18)",
]) {
  if (landingCss.includes(retiredLandingGlassPattern)) {
    problems.push(`src/app/landing.css must not keep retired duplicate glass override pattern: ${retiredLandingGlassPattern}.`);
  }
}

if (
  adminCss.includes(".admin-layout input,\n.admin-layout select,\n.admin-layout textarea {\n  border-color: var(--admin-surface-shadow)") ||
  adminCss.includes('font-family: "MS Sans Serif", Tahoma, Arial, sans-serif !important') ||
  adminCss.includes(".admin-layout input,\n.admin-layout select,\n.admin-layout textarea {\n  min-height: 40px;\n  border: 1px solid rgba(47, 125, 246, 0.18) !important")
) {
  problems.push("src/app/admin/admin.css must not keep the retired broad admin-surface form control override.");
}

if (adminCss.includes('content: "Screenia Admin"')) {
  problems.push("src/app/admin/admin.css contains the retired generated page-shell titlebar. Use the real admin layout titlebar instead.");
}

if (landingCss.includes('font-family: "Carter One"')) {
  problems.push("src/app/landing.css declares the unused Carter One font. Remove retired font-face declarations.");
}

for (const token of ["--landing-font-body", "--landing-font-ui", "--landing-font-display"]) {
  const count = countOccurrences(landingCss, new RegExp(`${token}:`, "g"));
  if (count !== 1) {
    problems.push(`src/app/landing.css should define ${token} exactly once; found ${count}.`);
  }
}

for (const token of [
  "--landing-radius",
  "--landing-radius-sm",
  "--landing-shadow-sm",
  "--landing-shadow-md",
  "--landing-shadow-lg",
]) {
  const count = countOccurrences(landingCss, new RegExp(`${token}:`, "g"));
  if (count !== 1) {
    problems.push(`src/app/landing.css should define ${token} exactly once; found ${count}.`);
  }
}

for (const token of [
  "--screenia-glass-panel",
  "--screenia-glass-card",
  "--screenia-glass-soft",
  "--screenia-glass-border",
]) {
  const count = countOccurrences(landingCss, new RegExp(`${token}:`, "g"));
  if (count !== 1) {
    problems.push(`src/app/landing.css should define ${token} exactly once; found ${count}.`);
  }
}

const retiredAdminButtonPatterns = [
  {
    pattern: ".admin-layout .bg-slate-950",
    message: "src/app/admin/admin.css contains retired Tailwind utility button overrides. Use admin-button-* classes instead.",
  },
  {
    pattern: "border: 0 !important;\n  border-radius: 12px !important;\n  background: linear-gradient(135deg, #2f7df6, #5ea0ff) !important;",
    message: "src/app/admin/admin.css contains a retired duplicate admin button layer. Keep button ownership in the compact button block.",
  },
  {
    pattern: "filter: brightness(1.03);",
    message: "src/app/admin/admin.css contains a retired duplicate admin button hover layer. Keep button ownership in the compact button block.",
  },
];

for (const { pattern, message } of retiredAdminButtonPatterns) {
  if (adminCss.includes(pattern)) {
    problems.push(message);
  }
}

const packageJson = JSON.parse(read("package.json"));
if (packageJson.dependencies?.bootstrap || packageJson.devDependencies?.bootstrap) {
  problems.push("package.json still includes Bootstrap. Avoid broad third-party CSS that can override Screenia styles.");
}

const temporaryLandingClassPattern = /\.landing-[a-z0-9-]*(?:-(?:old|new|placeholder))(?:\b|-)/;

function requireCssBlock(cssText, selector, checks) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = cssText.match(new RegExp(`${escapedSelector}\\s*\\{([\\s\\S]*?)\\}`));
  if (!match) {
    problems.push(`src/app/landing.css is missing the required selector ${selector}.`);
    return;
  }

  const body = match[1];
  for (const { includes, rejects, message } of checks) {
    if (includes && !body.includes(includes)) {
      problems.push(`src/app/landing.css ${selector} ${message}`);
    }
    if (rejects && body.includes(rejects)) {
      problems.push(`src/app/landing.css ${selector} ${message}`);
    }
  }
}

landingCss
  .split(/\r?\n/)
  .forEach((line, index) => {
    if (
      /\.(how-|about-|public-info-page)/.test(line)
    ) {
      problems.push(
        `src/app/landing.css:${index + 1} contains public-info page selector "${line.trim()}". Move it to public-info.css.`,
      );
    }
    if (temporaryLandingClassPattern.test(line)) {
      problems.push(
        `src/app/landing.css:${index + 1} contains temporary landing class naming "${line.trim()}". Use a descriptive role name instead.`,
      );
    }
  });

requireCssBlock(landingCss, ".landing-nav-primary .landing-nav-link", [
  {
    includes: "position: relative;",
    message: "must own positioning for the underline indicator.",
  },
  {
    includes: "display: inline-flex;",
    message: "must stay as a text-sized inline link instead of a block button.",
  },
  {
    includes: "min-height: auto;",
    message: "must not inherit button-like minimum height.",
  },
  {
    includes: "background: transparent;",
    message: "must not inherit button-like backgrounds.",
  },
  {
    includes: "padding: 0;",
    message: "must not inherit button-like padding.",
  },
  {
    includes: "box-shadow: none;",
    message: "must not inherit button-like shadows.",
  },
  {
    includes: "border-radius: 0;",
    message: "must remain text-link shaped instead of pill shaped.",
  },
]);

requireCssBlock(landingCss, ".landing-links .landing-nav-login", [
  {
    includes: "color: var(--landing-text);",
    message: "must own login color through scoped specificity instead of !important.",
  },
]);

requireCssBlock(landingCss, ".landing-links .landing-nav-cta", [
  {
    includes: "color: #ffffff;",
    message: "must own CTA color through scoped specificity instead of !important.",
  },
]);

if (/(^|\n)\.landing-nav-login\s*\{/.test(landingCss)) {
  problems.push("src/app/landing.css must scope landing-nav-login resets to their page or parent container.");
}

requireCssBlock(landingCss, ".landing-nav-primary .landing-nav-link:hover", [
  {
    includes: "background: transparent;",
    message: "must not use a hover background that makes primary nav links look like buttons.",
  },
  {
    includes: "box-shadow: none;",
    message: "must not use a hover shadow that makes primary nav links look like buttons.",
  },
]);

requireCssBlock(landingCss, ".landing-nav-primary .landing-nav-link:active", [
  {
    includes: "background: transparent;",
    message: "must not use an active background that makes primary nav links look like buttons.",
  },
  {
    includes: "border-radius: 0;",
    message: "must not use an active radius that makes primary nav links look like pills.",
  },
  {
    includes: "box-shadow: none;",
    message: "must not use an active shadow that makes primary nav links look like buttons.",
  },
  {
    includes: "transform: none;",
    message: "must not animate primary nav links like pressed buttons.",
  },
]);

requireCssBlock(landingCss, ".landing-nav-primary .landing-nav-link:focus-visible", [
  {
    includes: "outline: 0;",
    message: "must replace the global rectangle focus ring with the nav underline.",
  },
  {
    includes: "background: transparent;",
    message: "must not use a background that makes primary nav links look like buttons.",
  },
  {
    includes: "box-shadow: none;",
    message: "must not use a box shadow that makes primary nav links look like buttons.",
  },
  {
    rejects: "border:",
    message: "must not use a border that makes primary nav links look like buttons.",
  },
]);

requireCssBlock(landingCss, ".landing-nav-primary .landing-nav-link.landing-nav-link-active", [
  {
    includes: "background: transparent;",
    message: "must keep active links text-only without a button background.",
  },
  {
    includes: "box-shadow: none;",
    message: "must keep active links shadow-free.",
  },
  {
    includes: "border: 0;",
    message: "must keep active primary nav links border-free.",
  },
  {
    includes: "border-radius: 0;",
    message: "must keep active primary nav links text shaped.",
  },
  {
    includes: "padding: 0;",
    message: "must not make active primary nav links button sized.",
  },
  {
    includes: "text-decoration: none;",
    message: "must show the active state as text color/weight rather than an underline or button treatment.",
  },
  {
    includes: "transform: none;",
    message: "must not animate active primary nav links like pressed buttons.",
  },
]);

requireCssBlock(landingCss, ".landing-nav-primary .landing-nav-link.landing-nav-link-active::after", [
  {
    includes: "display: none;",
    message: "must disable the active nav pseudo-element.",
  },
  {
    includes: "content: none;",
    message: "must keep active public nav links text-only.",
  },
]);

if (!read("src/app/sa-fungerar-det/page.tsx").includes('import "../public-info.css";')) {
  problems.push("/sa-fungerar-det must import public-info.css for its scoped page styles.");
}

if (!read("src/app/om-oss/page.tsx").includes('import "../public-info.css";')) {
  problems.push("/om-oss must import public-info.css for its scoped page styles.");
}

if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}

console.log("Style boundary check passed: no old brand names, no legacy public CSS imports, and no global override leakage.");
