import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { handleApi } from "../server/routes.js";
import { readDb, seedData, writeDb } from "../server/store.js";

test("API creates tickets, records replies, applies macros, and exports CSV", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "ticketstuff-test-"));
  process.env.TICKETSTUFF_DATA = path.join(dir, "ticketstuff.json");
  await writeDb(seedData());
  try {
    const createdCustomer = await callApi("POST", "/api/customers", {
      name: "Riley West",
      email: "riley@westforge.test",
      company: "WestForge",
      notes: "New account."
    });
    assert.equal(createdCustomer.status, 201);
    const customer = createdCustomer.body.customers.find((item) => item.email === "riley@westforge.test");

    const ticketResponse = await callApi("POST", "/api/tickets", {
      subject: "Priority export request",
      priority: "urgent",
      customerId: customer.id,
      inboxId: "inb_support",
      assigneeId: "usr_alex",
      tagIds: ["tag_enterprise"],
      initialMessage: "Please export every transcript for legal review."
    });
    assert.equal(ticketResponse.status, 201);
    const ticket = ticketResponse.body.tickets.find((item) => item.subject === "Priority export request");
    assert.ok(ticket.id);

    const reply = await callApi("POST", `/api/tickets/${ticket.id}/messages`, {
      authorType: "agent",
      visibility: "public",
      body: "The export is running and I will attach the archive here.",
      attachments: "transcripts.json"
    });
    assert.equal(reply.status, 201);

    const macro = await callApi("POST", `/api/tickets/${ticket.id}/apply-macro`, { macroId: "mac_waiting" });
    assert.equal(macro.status, 200);
    const saved = await readDb();
    const updated = saved.tickets.find((item) => item.id === ticket.id);
    assert.equal(updated.status, "waiting_on_customer");
    assert.ok(saved.messages.some((message) => message.ticketId === ticket.id && message.body.includes("screenshot")));

    const csv = await callApi("GET", "/api/export/csv?entity=tickets");
    assert.equal(csv.status, 200);
    assert.match(csv.bodyText, /Priority export request/);
  } finally {
    delete process.env.TICKETSTUFF_DATA;
    await rm(dir, { recursive: true, force: true });
  }
});

async function callApi(method, target, body) {
  const req = Readable.from(body ? [Buffer.from(JSON.stringify(body))] : []);
  req.method = method;
  req.headers = { host: "localhost" };
  const chunks = [];
  const res = {
    statusCode: 0,
    headers: {},
    writeHead(status, headers) {
      this.statusCode = status;
      this.headers = headers || {};
    },
    end(chunk) {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
    }
  };
  await handleApi(req, res, new URL(target, "http://localhost"));
  const bodyText = Buffer.concat(chunks).toString("utf8");
  const isJson = String(res.headers["content-type"] || "").includes("application/json");
  return {
    status: res.statusCode,
    headers: res.headers,
    bodyText,
    body: isJson ? JSON.parse(bodyText) : null
  };
}
