import {
  addActivity,
  clean,
  nowIso,
  publicTicketSummary,
  shapeState,
  toCsv,
  uid,
  validateArticle,
  validateCustomer,
  validateInbox,
  validateMacro,
  validateMessage,
  validateTag,
  validateTicket,
  validateUser,
  validateWorkspace
} from "./domain.js";
import { readDb, writeDb } from "./store.js";

export async function handleApi(req, res, url) {
  try {
    if (req.method === "GET" && url.pathname === "/api/state") {
      return json(res, 200, shapeState(await readDb()));
    }

    if (req.method === "GET" && url.pathname === "/api/export/json") {
      const db = await readDb();
      return download(res, "ticketstuff-export.json", "application/json", `${JSON.stringify(db, null, 2)}\n`);
    }

    if (req.method === "GET" && url.pathname === "/api/export/csv") {
      const db = await readDb();
      const entity = url.searchParams.get("entity") || "tickets";
      const allowed = new Set(["users", "customers", "inboxes", "tickets", "messages", "tags", "macros", "articles", "activities"]);
      if (!allowed.has(entity)) return json(res, 400, { errors: ["CSV export entity is not supported."] });
      return download(res, `ticketstuff-${entity}.csv`, "text/csv", toCsv(db[entity] ?? []));
    }

    if (req.method === "PUT" && url.pathname === "/api/workspace") {
      return mutate(res, async (db) => {
        const validation = validateWorkspace(await readJson(req));
        if (!validation.ok) return bad(validation.errors);
        Object.assign(db.workspace, validation.value, { updatedAt: nowIso() });
        addActivity(db, "updated workspace", "workspace", db.workspace.id, { name: db.workspace.name });
        return ok(shapeState(db));
      });
    }

    if (req.method === "POST" && url.pathname === "/api/customers") {
      return mutate(res, async (db) => {
        const validation = validateCustomer(await readJson(req));
        if (!validation.ok) return bad(validation.errors);
        if (db.customers.some((customer) => customer.email === validation.value.email && !customer.archivedAt)) return bad(["A customer with that email already exists."]);
        const customer = { id: uid("cus"), ...validation.value, archivedAt: null, createdAt: nowIso(), updatedAt: nowIso() };
        db.customers.push(customer);
        addActivity(db, "created customer", "customer", customer.id, { email: customer.email });
        return created(shapeState(db));
      });
    }

    const customerMatch = url.pathname.match(/^\/api\/customers\/([^/]+)$/);
    if (customerMatch && req.method === "PUT") {
      return mutate(res, async (db) => {
        const customer = find(db.customers, customerMatch[1], "Customer");
        if (customer.error) return customer.error;
        const validation = validateCustomer({ ...customer.row, ...(await readJson(req)) });
        if (!validation.ok) return bad(validation.errors);
        if (db.customers.some((item) => item.id !== customer.row.id && item.email === validation.value.email && !item.archivedAt)) return bad(["A customer with that email already exists."]);
        Object.assign(customer.row, validation.value, { updatedAt: nowIso() });
        addActivity(db, "updated customer", "customer", customer.row.id, { email: customer.row.email });
        return ok(shapeState(db));
      });
    }
    if (customerMatch && req.method === "DELETE") {
      return archive(res, "customers", customerMatch[1], "customer", "Customer");
    }

    if (req.method === "POST" && url.pathname === "/api/tickets") {
      return mutate(res, async (db) => {
        const body = await readJson(req);
        const validation = validateTicket({ ...body, status: body.status || "open", slaDueAt: body.slaDueAt || defaultSla(db) }, db);
        if (!validation.ok) return bad(validation.errors);
        const ticket = {
          id: uid("tkt"),
          number: db.counters.ticketNumber++,
          ...validation.value,
          firstResponseAt: "",
          resolvedAt: "",
          archivedAt: null,
          reopenedCount: 0,
          mergedIntoId: null,
          createdAt: nowIso(),
          updatedAt: nowIso()
        };
        db.tickets.push(ticket);
        const message = clean(body.initialMessage);
        if (message) {
          db.messages.push({ id: uid("msg"), ticketId: ticket.id, authorType: "customer", authorId: ticket.customerId, visibility: "public", body: message, attachments: [], createdAt: nowIso() });
        }
        addActivity(db, "created ticket", "ticket", ticket.id, { subject: ticket.subject });
        return created(shapeState(db));
      });
    }

    const ticketMatch = url.pathname.match(/^\/api\/tickets\/([^/]+)$/);
    if (ticketMatch && req.method === "GET") {
      const db = await readDb();
      const ticket = db.tickets.find((item) => item.id === ticketMatch[1]);
      if (!ticket) return json(res, 404, { errors: ["Ticket was not found."] });
      return json(res, 200, publicTicketSummary(db, ticket));
    }
    if (ticketMatch && req.method === "PUT") {
      return mutate(res, async (db) => {
        const found = find(db.tickets, ticketMatch[1], "Ticket");
        if (found.error) return found.error;
        const validation = validateTicket({ ...found.row, ...(await readJson(req)) }, db);
        if (!validation.ok) return bad(validation.errors);
        Object.assign(found.row, validation.value, { updatedAt: nowIso() });
        addActivity(db, "updated ticket", "ticket", found.row.id, { status: found.row.status, priority: found.row.priority });
        return ok(shapeState(db));
      });
    }
    if (ticketMatch && req.method === "DELETE") {
      return archive(res, "tickets", ticketMatch[1], "ticket", "Ticket");
    }

    const messageMatch = url.pathname.match(/^\/api\/tickets\/([^/]+)\/messages$/);
    if (messageMatch && req.method === "POST") {
      return mutate(res, async (db) => {
        const ticket = db.tickets.find((item) => item.id === messageMatch[1] && !item.archivedAt);
        if (!ticket) return notFound("Ticket");
        const validation = validateMessage(await readJson(req), db, ticket);
        if (!validation.ok) return bad(validation.errors);
        const message = { id: uid("msg"), ...validation.value, createdAt: nowIso() };
        db.messages.push(message);
        if (message.authorType === "agent" && message.visibility === "public" && !ticket.firstResponseAt) ticket.firstResponseAt = message.createdAt;
        ticket.updatedAt = nowIso();
        addActivity(db, message.visibility === "internal" ? "added internal note" : "sent external reply", "ticket", ticket.id, { visibility: message.visibility });
        return created(shapeState(db));
      });
    }

    const resolveMatch = url.pathname.match(/^\/api\/tickets\/([^/]+)\/resolve$/);
    if (resolveMatch && req.method === "POST") {
      return transitionTicket(res, resolveMatch[1], "resolved", "resolved ticket");
    }

    const reopenMatch = url.pathname.match(/^\/api\/tickets\/([^/]+)\/reopen$/);
    if (reopenMatch && req.method === "POST") {
      return mutate(res, async (db) => {
        const ticket = db.tickets.find((item) => item.id === reopenMatch[1] && !item.archivedAt);
        if (!ticket) return notFound("Ticket");
        ticket.status = "open";
        ticket.resolvedAt = "";
        ticket.reopenedCount = Number(ticket.reopenedCount || 0) + 1;
        ticket.updatedAt = nowIso();
        addActivity(db, "reopened ticket", "ticket", ticket.id, { subject: ticket.subject });
        return ok(shapeState(db));
      });
    }

    const mergeMatch = url.pathname.match(/^\/api\/tickets\/([^/]+)\/merge$/);
    if (mergeMatch && req.method === "POST") {
      return mutate(res, async (db) => {
        const source = db.tickets.find((item) => item.id === mergeMatch[1] && !item.archivedAt);
        const targetId = clean((await readJson(req)).targetTicketId);
        const target = db.tickets.find((item) => item.id === targetId && !item.archivedAt);
        if (!source || !target || source.id === target.id) return bad(["Choose two active, different tickets to merge."]);
        source.mergedIntoId = target.id;
        source.status = "closed";
        source.resolvedAt = nowIso();
        source.updatedAt = nowIso();
        db.messages.push({ id: uid("msg"), ticketId: target.id, authorType: "agent", authorId: db.session.userId, visibility: "internal", body: `Merged ticket #${source.number}: ${source.subject}`, attachments: [], createdAt: nowIso() });
        addActivity(db, "merged ticket", "ticket", source.id, { targetTicketId: target.id });
        return ok(shapeState(db));
      });
    }

    const macroApplyMatch = url.pathname.match(/^\/api\/tickets\/([^/]+)\/apply-macro$/);
    if (macroApplyMatch && req.method === "POST") {
      return mutate(res, async (db) => {
        const ticket = db.tickets.find((item) => item.id === macroApplyMatch[1] && !item.archivedAt);
        const body = await readJson(req);
        const macro = db.macros.find((item) => item.id === clean(body.macroId) && item.active !== false);
        if (!ticket || !macro) return bad(["Ticket or macro was not found."]);
        if (macro.statusChange) ticket.status = macro.statusChange;
        if (macro.priorityChange) ticket.priority = macro.priorityChange;
        ticket.tagIds = Array.from(new Set([...ticket.tagIds, ...macro.tagIdsToAdd]));
        ticket.updatedAt = nowIso();
        db.messages.push({ id: uid("msg"), ticketId: ticket.id, authorType: "agent", authorId: db.session.userId, visibility: "public", body: macro.replyBody, attachments: [], createdAt: nowIso() });
        if (!ticket.firstResponseAt) ticket.firstResponseAt = nowIso();
        addActivity(db, "applied macro", "ticket", ticket.id, { macro: macro.name });
        return ok(shapeState(db));
      });
    }

    if (req.method === "POST" && url.pathname === "/api/tags") return createTag(res, await readJson(req));
    const tagMatch = url.pathname.match(/^\/api\/tags\/([^/]+)$/);
    if (tagMatch && req.method === "PUT") return updateTag(res, tagMatch[1], await readJson(req));
    if (tagMatch && req.method === "DELETE") return archive(res, "tags", tagMatch[1], "tag", "Tag");

    if (req.method === "POST" && url.pathname === "/api/macros") return createOrUpdateMacro(res, null, await readJson(req));
    const macroMatch = url.pathname.match(/^\/api\/macros\/([^/]+)$/);
    if (macroMatch && req.method === "PUT") return createOrUpdateMacro(res, macroMatch[1], await readJson(req));
    if (macroMatch && req.method === "DELETE") return archive(res, "macros", macroMatch[1], "macro", "Macro", { active: false });

    if (req.method === "POST" && url.pathname === "/api/articles") return createOrUpdateArticle(res, null, await readJson(req));
    const articleMatch = url.pathname.match(/^\/api\/articles\/([^/]+)$/);
    if (articleMatch && req.method === "PUT") return createOrUpdateArticle(res, articleMatch[1], await readJson(req));
    if (articleMatch && req.method === "DELETE") return archive(res, "articles", articleMatch[1], "article", "Article");

    if (req.method === "POST" && url.pathname === "/api/users") return createOrUpdateUser(res, null, await readJson(req));
    const userMatch = url.pathname.match(/^\/api\/users\/([^/]+)$/);
    if (userMatch && req.method === "PUT") return createOrUpdateUser(res, userMatch[1], await readJson(req));
    if (userMatch && req.method === "DELETE") return archive(res, "users", userMatch[1], "user", "User", { active: false });

    if (req.method === "POST" && url.pathname === "/api/inboxes") return createOrUpdateInbox(res, null, await readJson(req));
    const inboxMatch = url.pathname.match(/^\/api\/inboxes\/([^/]+)$/);
    if (inboxMatch && req.method === "PUT") return createOrUpdateInbox(res, inboxMatch[1], await readJson(req));
    if (inboxMatch && req.method === "DELETE") return archive(res, "inboxes", inboxMatch[1], "inbox", "Inbox", { active: false });

    return json(res, 404, { errors: ["Route was not found."] });
  } catch (error) {
    console.error(error);
    return json(res, 500, { errors: ["Unexpected server error."] });
  }
}

async function createTag(res, body) {
  return mutate(res, async (db) => {
    const validation = validateTag(body);
    if (!validation.ok) return bad(validation.errors);
    if (db.tags.some((tag) => tag.label === validation.value.label && !tag.archivedAt)) return bad(["A tag with that label already exists."]);
    const tag = { id: uid("tag"), ...validation.value, archivedAt: null, createdAt: nowIso(), updatedAt: nowIso() };
    db.tags.push(tag);
    addActivity(db, "created tag", "tag", tag.id, { label: tag.label });
    return created(shapeState(db));
  });
}

async function updateTag(res, id, body) {
  return mutate(res, async (db) => {
    const found = find(db.tags, id, "Tag");
    if (found.error) return found.error;
    const validation = validateTag({ ...found.row, ...body });
    if (!validation.ok) return bad(validation.errors);
    Object.assign(found.row, validation.value, { updatedAt: nowIso() });
    addActivity(db, "updated tag", "tag", found.row.id, { label: found.row.label });
    return ok(shapeState(db));
  });
}

async function createOrUpdateMacro(res, id, body) {
  return mutate(res, async (db) => {
    const existing = id ? find(db.macros, id, "Macro") : null;
    if (existing?.error) return existing.error;
    const validation = validateMacro({ ...(existing?.row || {}), ...body }, db);
    if (!validation.ok) return bad(validation.errors);
    if (existing) {
      Object.assign(existing.row, validation.value, { updatedAt: nowIso() });
      addActivity(db, "updated macro", "macro", existing.row.id, { name: existing.row.name });
      return ok(shapeState(db));
    }
    const macro = { id: uid("mac"), ...validation.value, createdAt: nowIso(), updatedAt: nowIso() };
    db.macros.push(macro);
    addActivity(db, "created macro", "macro", macro.id, { name: macro.name });
    return created(shapeState(db));
  });
}

async function createOrUpdateArticle(res, id, body) {
  return mutate(res, async (db) => {
    const existing = id ? find(db.articles, id, "Article") : null;
    if (existing?.error) return existing.error;
    const validation = validateArticle({ ...(existing?.row || {}), ...body });
    if (!validation.ok) return bad(validation.errors);
    if (db.articles.some((item) => item.id !== id && item.slug === validation.value.slug && !item.archivedAt)) return bad(["An article with that slug already exists."]);
    if (existing) {
      Object.assign(existing.row, validation.value, { updatedAt: nowIso() });
      addActivity(db, "updated article", "article", existing.row.id, { title: existing.row.title });
      return ok(shapeState(db));
    }
    const article = { id: uid("art"), ...validation.value, archivedAt: null, createdAt: nowIso(), updatedAt: nowIso() };
    db.articles.push(article);
    addActivity(db, "created article", "article", article.id, { title: article.title });
    return created(shapeState(db));
  });
}

async function createOrUpdateUser(res, id, body) {
  return mutate(res, async (db) => {
    const existing = id ? find(db.users, id, "User") : null;
    if (existing?.error) return existing.error;
    const validation = validateUser({ ...(existing?.row || {}), ...body });
    if (!validation.ok) return bad(validation.errors);
    if (db.users.some((item) => item.id !== id && item.email === validation.value.email && item.active !== false)) return bad(["A user with that email already exists."]);
    if (existing) {
      Object.assign(existing.row, validation.value, { updatedAt: nowIso() });
      addActivity(db, "updated user", "user", existing.row.id, { email: existing.row.email });
      return ok(shapeState(db));
    }
    const user = { id: uid("usr"), ...validation.value, createdAt: nowIso(), updatedAt: nowIso() };
    db.users.push(user);
    addActivity(db, "created user", "user", user.id, { email: user.email });
    return created(shapeState(db));
  });
}

async function createOrUpdateInbox(res, id, body) {
  return mutate(res, async (db) => {
    const existing = id ? find(db.inboxes, id, "Inbox") : null;
    if (existing?.error) return existing.error;
    const validation = validateInbox({ ...(existing?.row || {}), ...body });
    if (!validation.ok) return bad(validation.errors);
    if (db.inboxes.some((item) => item.id !== id && item.address === validation.value.address && item.active !== false)) return bad(["An inbox with that address already exists."]);
    if (existing) {
      Object.assign(existing.row, validation.value, { updatedAt: nowIso() });
      addActivity(db, "updated inbox", "inbox", existing.row.id, { address: existing.row.address });
      return ok(shapeState(db));
    }
    const inbox = { id: uid("inb"), ...validation.value, createdAt: nowIso(), updatedAt: nowIso() };
    db.inboxes.push(inbox);
    addActivity(db, "created inbox", "inbox", inbox.id, { address: inbox.address });
    return created(shapeState(db));
  });
}

async function transitionTicket(res, id, status, action) {
  return mutate(res, async (db) => {
    const ticket = db.tickets.find((item) => item.id === id && !item.archivedAt);
    if (!ticket) return notFound("Ticket");
    ticket.status = status;
    ticket.resolvedAt = status === "resolved" ? nowIso() : "";
    ticket.updatedAt = nowIso();
    addActivity(db, action, "ticket", ticket.id, { subject: ticket.subject });
    return ok(shapeState(db));
  });
}

async function archive(res, collection, id, entityType, label, extra = {}) {
  return mutate(res, async (db) => {
    const found = find(db[collection], id, label);
    if (found.error) return found.error;
    Object.assign(found.row, extra, { archivedAt: nowIso(), updatedAt: nowIso() });
    addActivity(db, `archived ${entityType}`, entityType, found.row.id, {});
    return ok(shapeState(db));
  });
}

async function mutate(res, mutator) {
  const db = await readDb();
  const result = await mutator(db);
  if (result.status >= 200 && result.status < 300) await writeDb(db);
  return json(res, result.status, result.body);
}

function find(rows, id, label) {
  const row = rows.find((item) => item.id === id);
  return row ? { row } : { error: notFound(label) };
}

function ok(body) {
  return { status: 200, body };
}

function created(body) {
  return { status: 201, body };
}

function bad(errors) {
  return { status: 400, body: { errors } };
}

function notFound(label) {
  return { status: 404, body: { errors: [`${label} was not found.`] } };
}

function defaultSla(db) {
  return new Date(Date.now() + Number(db.workspace.defaultSlaHours || 24) * 60 * 60 * 1000).toISOString();
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function json(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(`${JSON.stringify(body)}\n`);
}

function download(res, filename, type, body) {
  res.writeHead(200, {
    "content-type": `${type}; charset=utf-8`,
    "content-disposition": `attachment; filename="${filename}"`
  });
  res.end(body);
}
