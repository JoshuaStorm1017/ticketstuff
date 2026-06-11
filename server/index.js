import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { handleApi } from "./routes.js";
import { readDb } from "./store.js";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = path.join(rootDir, "public");
const port = Number(process.env.PORT || 4120);
const host = process.env.HOST || "127.0.0.1";

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

await readDb();

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  if (url.pathname.startsWith("/api/")) {
    return handleApi(req, res, url);
  }
  return serveStatic(url.pathname, res);
});

server.listen(port, host, () => {
  console.log(`TicketStuff running at http://${host}:${port}`);
});

async function serveStatic(pathname, res) {
  const safePath = pathname === "/" ? "/index.html" : pathname;
  const normalized = path.normalize(safePath).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(publicDir, normalized);
  if (!filePath.startsWith(publicDir)) {
    res.writeHead(403, { "content-type": "text/plain; charset=utf-8" });
    res.end("Forbidden");
    return;
  }
  try {
    const body = await readFile(filePath);
    const ext = path.extname(filePath);
    res.writeHead(200, {
      "content-type": mime[ext] || "application/octet-stream",
      "cache-control": ext === ".html" ? "no-store" : "public, max-age=300"
    });
    res.end(body);
  } catch (error) {
    if (error.code !== "ENOENT") {
      res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
      res.end("Server error");
      return;
    }
    const index = await readFile(path.join(publicDir, "index.html"));
    res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
    res.end(index);
  }
}
