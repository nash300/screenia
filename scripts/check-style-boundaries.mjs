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

if (exists("src/app/standalone-public.css")) {
  problems.push("Use src/app/public-info.css instead of the old standalone-public.css name.");
}

const sourceFiles = walk("src").filter((file) => /\.(css|tsx?|jsx?)$/.test(file));
for (const file of sourceFiles) {
  const text = read(file);
  if (text.includes("standalone-public.css")) {
    problems.push(`${file} still imports or references standalone-public.css.`);
  }
  if (/infosync/i.test(text)) {
    problems.push(`${file} still contains the old InfoSync name.`);
  }
}

for (const file of walk("public").filter((item) => !/\.pdf$/i.test(item))) {
  const text = read(file);
  if (/infosync/i.test(text)) {
    problems.push(`${file} still contains the old InfoSync name.`);
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
