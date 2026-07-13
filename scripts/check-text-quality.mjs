import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const roots = [
  "src",
  "docs",
  "README.md",
  "QA_ADMIN_TEST_PLAN.md",
  "QA_TEST_LOG.md",
  "LOCAL_DEV_REMINDER.md",
];

const ignoredDirectories = new Set([".git", ".next", "node_modules"]);
const checkedExtensions = new Set([
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
]);

const suspiciousPatterns = [
  {
    label: "replacement character",
    pattern: /\uFFFD/u,
  },
  {
    label: "likely mojibake marker",
    pattern: /[\u00C2\u00C3][\u0080-\u00BF\u00A0-\u00BF]?/u,
  },
  {
    label: "double-encoded mojibake marker",
    pattern: /\u00C3\u0192|\u00C2[\u00A0-\u00BF]/u,
  },
];

function extensionOf(path) {
  const match = path.match(/\.[^.]+$/u);
  return match ? match[0] : "";
}

function collectFiles(path, files = []) {
  const stats = statSync(path);

  if (stats.isDirectory()) {
    if (ignoredDirectories.has(path.split(/[\\/]/u).pop())) return files;

    for (const entry of readdirSync(path)) {
      collectFiles(join(path, entry), files);
    }

    return files;
  }

  if (stats.isFile() && checkedExtensions.has(extensionOf(path))) {
    files.push(path);
  }

  return files;
}

const findings = [];

for (const root of roots) {
  for (const file of collectFiles(root)) {
    const text = readFileSync(file, "utf8");
    const lines = text.split(/\r?\n/u);

    lines.forEach((line, index) => {
      for (const { label, pattern } of suspiciousPatterns) {
        if (pattern.test(line)) {
          findings.push({
            file: relative(process.cwd(), file),
            line: index + 1,
            label,
            preview: line.trim().slice(0, 180),
          });
        }
      }
    });
  }
}

if (findings.length > 0) {
  console.error("Text quality check found suspicious encoding markers:");
  for (const finding of findings) {
    console.error(
      `- ${finding.file}:${finding.line} ${finding.label}: ${finding.preview}`,
    );
  }
  process.exit(1);
}

console.log("Text quality check passed.");
