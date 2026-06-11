import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const skipDirs = new Set([".git", "node_modules", "dist", "data"]);
const skipFiles = new Set(["package-lock.json"]);
const patterns = [
  { name: "private key", regex: new RegExp("BEGIN " + "[A-Z ]*PRIVATE KEY") },
  { name: "GitHub token", regex: new RegExp("gh[pousr]_" + "[A-Za-z0-9_]{20,}") },
  { name: "OpenAI key", regex: new RegExp("sk-" + "[A-Za-z0-9]{32,}") },
  { name: "AWS access key", regex: new RegExp("AKIA" + "[A-Z0-9]{16}") },
  { name: "database URL with credentials", regex: new RegExp("[a-z]+://[^\\s:@]+:[^\\s:@]+@") }
];

const findings = [];
for await (const filePath of walk(rootDir)) {
  if (skipFiles.has(path.basename(filePath))) continue;
  const text = await readFile(filePath, "utf8");
  for (const pattern of patterns) {
    if (pattern.regex.test(text)) {
      findings.push(`${path.relative(rootDir, filePath)} matched ${pattern.name}`);
    }
  }
}

if (findings.length) {
  console.error("Potential secret material found. Review locally before publishing:");
  console.error(findings.join("\n"));
  process.exit(1);
}

console.log("No secret-looking values found.");

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const filePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (skipDirs.has(entry.name)) continue;
      yield* walk(filePath);
    } else {
      yield filePath;
    }
  }
}

