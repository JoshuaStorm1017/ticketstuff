import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(rootDir, "dist");

await rm(distDir, { recursive: true, force: true });
await mkdir(distDir, { recursive: true });
await cp(path.join(rootDir, "public"), path.join(distDir, "public"), { recursive: true });

const pkg = JSON.parse(await readFile(path.join(rootDir, "package.json"), "utf8"));
await writeFile(
  path.join(distDir, "build-manifest.json"),
  `${JSON.stringify({
    name: pkg.name,
    version: pkg.version,
    builtAt: new Date().toISOString(),
    runtime: "node-http-static-spa"
  }, null, 2)}\n`,
  "utf8"
);

console.log(`Build verified at ${distDir}`);

