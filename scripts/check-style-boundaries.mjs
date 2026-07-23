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

const retiredPublicInfoFile = ["standalone", "public.css"].join("-");
const retiredBrandPattern = new RegExp(["info", "sync"].join(""), "i");

if (exists(`src/app/${retiredPublicInfoFile}`)) {
  problems.push("Use src/app/public-info.css instead of the retired public info stylesheet name.");
}

const sourceFiles = walk("src").filter((file) => /\.(css|tsx?|jsx?)$/.test(file));
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

for (const file of walk("public").filter((item) => !/\.pdf$/i.test(item))) {
  const text = read(file);
  if (retiredBrandPattern.test(text)) {
    problems.push(`${file} still contains the retired company name.`);
  }
}

const globals = read("src/app/globals.css");
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

const publicInfo = read("src/app/public-info.css");
if (publicInfo.includes("!important")) {
  problems.push("src/app/public-info.css should stay scoped and must not use !important.");
}

const adminCss = read("src/app/admin/admin.css");
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

const allowedPublicInfoNavLines = [
  ".how-page .landing-nav-primary a.is-active",
  ".about-page .landing-nav-primary a.is-active",
  ".how-page .landing-nav-primary a.is-active::after",
  ".about-page .landing-nav-primary a.is-active::after",
];

const landingCss = read("src/app/landing.css");
const temporaryLandingClassPattern = /\.landing-[a-z0-9-]*(?:-(?:old|new|placeholder))(?:\b|-)/;

landingCss
  .split(/\r?\n/)
  .forEach((line, index) => {
    if (
      /\.(how-|about-|public-info-page)/.test(line) &&
      !allowedPublicInfoNavLines.some((allowed) => line.includes(allowed))
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
