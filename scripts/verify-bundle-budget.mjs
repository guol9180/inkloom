import { readFile, readdir } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { resolve } from "node:path";

const assetsDirectory = resolve("apps", "web", "dist", "assets");
const budgets = [
  { pattern: /^index-.*\.js$/, label: "entry", maxGzipBytes: 100 * 1024 },
  {
    pattern: /^product-workspace-page-.*\.js$/,
    label: "workspace",
    maxGzipBytes: 140 * 1024
  },
  {
    pattern: /^product-markdown-editor-.*\.js$/,
    label: "editor shell",
    maxGzipBytes: 90 * 1024
  },
  {
    pattern: /^rich-markdown-editor-.*\.js$/,
    label: "rich editor",
    maxGzipBytes: 280 * 1024
  },
  {
    pattern: /^auth-page-.*\.js$/,
    label: "auth",
    maxGzipBytes: 60 * 1024
  }
];

const files = await readdir(assetsDirectory);
const failures = [];
for (const budget of budgets) {
  const file = files.find((candidate) => budget.pattern.test(candidate));
  if (!file) {
    failures.push(`${budget.label}: asset not found`);
    continue;
  }
  const bytes = await readFile(resolve(assetsDirectory, file));
  const gzipBytes = gzipSync(bytes).byteLength;
  const size = `${(gzipBytes / 1024).toFixed(1)} KB gzip`;
  console.log(`${budget.label.padEnd(14)} ${size.padStart(12)}  ${file}`);
  if (gzipBytes > budget.maxGzipBytes) {
    failures.push(
      `${budget.label}: ${size} exceeds ${(budget.maxGzipBytes / 1024).toFixed(0)} KB`
    );
  }
}

if (failures.length > 0) {
  throw new Error(`Bundle budget failed:\n${failures.join("\n")}`);
}
