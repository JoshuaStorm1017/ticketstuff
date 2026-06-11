import test from "node:test";
import assert from "node:assert/strict";
import { computeMetrics, toCsv, validateCustomer, validateTicket } from "../server/domain.js";
import { seedData } from "../server/store.js";

test("computes helpdesk metrics from persisted ticket history", () => {
  const db = seedData();
  const metrics = computeMetrics(db);
  assert.equal(metrics.totalTickets, 4);
  assert.equal(metrics.openTickets, 3);
  assert.equal(metrics.slaBreaches, 1);
  assert.equal(metrics.byStatus.open, 1);
  assert.equal(metrics.byPriority.urgent, 1);
  assert.ok(metrics.firstResponseHours > 0);
  assert.ok(metrics.resolutionHours > 0);
});

test("validates customer identity and duplicate-ready shape", () => {
  const invalid = validateCustomer({ name: "A", email: "bad", company: "" });
  assert.equal(invalid.ok, false);
  assert.equal(invalid.errors.length, 3);
  const valid = validateCustomer({ name: "Priya Shah", email: "PRIYA@example.com", company: "HarborOps", notes: "Prefers email." });
  assert.equal(valid.ok, true);
  assert.equal(valid.value.email, "priya@example.com");
});

test("validates ticket references and normalizes tags", () => {
  const db = seedData();
  const ticket = validateTicket({
    subject: "Cannot export filtered queue",
    priority: "high",
    status: "open",
    assigneeId: "usr_alex",
    customerId: "cus_river",
    inboxId: "inb_support",
    tagIds: ["tag_bug", "missing_tag"],
    slaDueAt: new Date(Date.now() + 3600000).toISOString()
  }, db);
  assert.equal(ticket.ok, true);
  assert.deepEqual(ticket.value.tagIds, ["tag_bug"]);
});

test("CSV exporter quotes nested fields and commas", () => {
  const csv = toCsv([{ id: "one", title: "Hello, support", tags: ["a", "b"] }]);
  assert.match(csv, /"Hello, support"/);
  assert.match(csv, /"\[""a"",""b""\]"/);
});
