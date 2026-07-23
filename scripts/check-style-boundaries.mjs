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

const retiredPublicInfoFile = ["standalone", "public.css"].join("-");
const retiredBrandPattern = new RegExp(["info", "sync"].join(""), "i");

if (exists(`src/app/${retiredPublicInfoFile}`)) {
  problems.push("Use src/app/public-info.css instead of the retired public info stylesheet name.");
}

const sourceFiles = walk("src").filter((file) => /\.(css|tsx?|jsx?)$/.test(file));
const appStylesheets = sourceFiles.filter((file) => file.startsWith("src/app/") && file.endsWith(".css")).sort();
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

for (const file of walk("public").filter((item) => !/\.pdf$/i.test(item))) {
  const text = read(file);
  if (retiredBrandPattern.test(text)) {
    problems.push(`${file} still contains the retired company name.`);
  }
}

const globals = read("src/app/globals.css");
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

const publicInfo = read("src/app/public-info.css");
if (publicInfo.includes("!important")) {
  problems.push("src/app/public-info.css should stay scoped and must not use !important.");
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

const adminCss = read("src/app/admin/admin.css");
const importantRatchets = [
  {
    file: "src/app/admin/admin.css",
    css: adminCss,
    max: 276,
  },
  {
    file: "src/app/landing.css",
    css: read("src/app/landing.css"),
    max: 408,
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

requireCssBlock(landingCss, ".landing-nav-primary a", [
  {
    includes: "position: relative;",
    message: "must own positioning for the underline indicator.",
  },
  {
    includes: "border-radius: 0;",
    message: "must remain text-link shaped instead of pill shaped.",
  },
]);

requireCssBlock(landingCss, ".landing-nav-primary a:focus-visible", [
  {
    includes: "outline: 0;",
    message: "must replace the global rectangle focus ring with the nav underline.",
  },
  {
    rejects: "background:",
    message: "must not use a background that makes primary nav links look like buttons.",
  },
  {
    rejects: "box-shadow:",
    message: "must not use a box shadow that makes primary nav links look like buttons.",
  },
  {
    rejects: "border:",
    message: "must not use a border that makes primary nav links look like buttons.",
  },
]);

requireCssBlock(landingCss, ".landing-nav-primary a.is-active", [
  {
    includes: "background: transparent",
    message: "must keep active links transparent.",
  },
  {
    includes: "box-shadow: none",
    message: "must keep active links shadow-free.",
  },
  {
    rejects: "border-radius: 999px",
    message: "must not make active primary nav links pill shaped.",
  },
  {
    rejects: "padding:",
    message: "must not make active primary nav links button sized.",
  },
]);

requireCssBlock(landingCss, ".landing-nav-primary a.is-active::after", [
  {
    includes: "height: 2px;",
    message: "must use a thin underline active indicator.",
  },
  {
    includes: "content: \"\";",
    message: "must render the active underline pseudo-element.",
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
