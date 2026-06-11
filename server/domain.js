export const ticketStatuses = ["open", "pending", "waiting_on_customer", "resolved", "closed"];
export const priorities = ["low", "normal", "high", "urgent"];
export const roles = ["admin", "agent", "viewer"];
export const articleStatuses = ["draft", "published", "archived"];
export const messageVisibilities = ["public", "internal"];

export function nowIso() {
  return new Date().toISOString();
}

export function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function clean(value) {
  return String(value ?? "").trim();
}

export function asArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

export function activeOnly(rows) {
  return rows.filter((row) => !row.archivedAt && row.active !== false && row.status !== "archived");
}

export function validateWorkspace(input) {
  const value = {
    name: clean(input.name),
    supportEmail: clean(input.supportEmail).toLowerCase(),
    timezone: clean(input.timezone),
    defaultSlaHours: Number(input.defaultSlaHours)
  };
  const errors = [];
  if (value.name.length < 2) errors.push("Workspace name must be at least 2 characters.");
  if (!isEmail(value.supportEmail)) errors.push("Support email must be valid.");
  if (value.timezone.length < 3) errors.push("Timezone is required.");
  if (!Number.isFinite(value.defaultSlaHours) || value.defaultSlaHours < 1 || value.defaultSlaHours > 720) errors.push("Default SLA must be between 1 and 720 hours.");
  return result(errors, value);
}

export function validateUser(input) {
  const value = {
    name: clean(input.name),
    email: clean(input.email).toLowerCase(),
    role: roles.includes(input.role) ? input.role : "agent",
    avatarColor: clean(input.avatarColor) || "#0f766e",
    active: input.active !== false
  };
  const errors = [];
  if (value.name.length < 2) errors.push("User name must be at least 2 characters.");
  if (!isEmail(value.email)) errors.push("User email must be valid.");
  if (!/^#[0-9a-f]{6}$/i.test(value.avatarColor)) errors.push("Avatar color must be a hex color.");
  return result(errors, value);
}

export function validateCustomer(input) {
  const value = {
    name: clean(input.name),
    email: clean(input.email).toLowerCase(),
    company: clean(input.company),
    notes: clean(input.notes)
  };
  const errors = [];
  if (value.name.length < 2) errors.push("Customer name must be at least 2 characters.");
  if (!isEmail(value.email)) errors.push("Customer email must be valid.");
  if (value.company.length < 2) errors.push("Company is required.");
  return result(errors, value);
}

export function validateInbox(input) {
  const value = {
    name: clean(input.name),
    address: clean(input.address).toLowerCase(),
    channelType: ["email", "manual", "chat"].includes(input.channelType) ? input.channelType : "email",
    active: input.active !== false
  };
  const errors = [];
  if (value.name.length < 2) errors.push("Inbox name must be at least 2 characters.");
  if (!isEmail(value.address)) errors.push("Inbox address must be valid.");
  return result(errors, value);
}

export function validateTag(input) {
  const value = {
    label: clean(input.label).toLowerCase().replace(/\s+/g, "-"),
    color: clean(input.color) || "#2563eb"
  };
  const errors = [];
  if (!/^[a-z0-9-]{2,32}$/.test(value.label)) errors.push("Tag label must use lowercase letters, numbers, and dashes.");
  if (!/^#[0-9a-f]{6}$/i.test(value.color)) errors.push("Tag color must be a hex color.");
  return result(errors, value);
}

export function validateTicket(input, db) {
  const value = {
    subject: clean(input.subject),
    status: ticketStatuses.includes(input.status) ? input.status : "open",
    priority: priorities.includes(input.priority) ? input.priority : "normal",
    assigneeId: clean(input.assigneeId),
    customerId: clean(input.customerId),
    inboxId: clean(input.inboxId),
    tagIds: asArray(input.tagIds),
    slaDueAt: clean(input.slaDueAt),
    firstResponseAt: clean(input.firstResponseAt || ""),
    resolvedAt: clean(input.resolvedAt || ""),
    reopenedCount: Number(input.reopenedCount ?? 0),
    mergedIntoId: clean(input.mergedIntoId || "") || null
  };
  const errors = [];
  if (value.subject.length < 4) errors.push("Ticket subject must be at least 4 characters.");
  if (!db.customers.some((item) => item.id === value.customerId && !item.archivedAt)) errors.push("Ticket must reference an active customer.");
  if (!db.inboxes.some((item) => item.id === value.inboxId && item.active !== false)) errors.push("Ticket must reference an active inbox.");
  if (value.assigneeId && !db.users.some((item) => item.id === value.assigneeId && item.active !== false)) errors.push("Assignee must be an active user.");
  if (!isIsoLike(value.slaDueAt)) errors.push("SLA due date is required.");
  const allowedTags = new Set(activeOnly(db.tags).map((tag) => tag.id));
  value.tagIds = value.tagIds.filter((id) => allowedTags.has(id));
  if (value.status === "resolved" || value.status === "closed") {
    value.resolvedAt = value.resolvedAt || nowIso();
  } else {
    value.resolvedAt = "";
  }
  if (value.firstResponseAt && !isIsoLike(value.firstResponseAt)) value.firstResponseAt = "";
  return result(errors, value);
}

export function validateMessage(input, db, ticket) {
  const visibility = messageVisibilities.includes(input.visibility) ? input.visibility : "public";
  const authorType = input.authorType === "customer" ? "customer" : "agent";
  const value = {
    ticketId: ticket.id,
    authorType,
    authorId: clean(input.authorId) || (authorType === "customer" ? ticket.customerId : db.session.userId),
    visibility,
    body: clean(input.body),
    attachments: parseAttachments(input.attachments)
  };
  const errors = [];
  if (value.body.length < 2) errors.push("Message body must be at least 2 characters.");
  if (authorType === "customer" && !db.customers.some((item) => item.id === value.authorId)) errors.push("Customer author was not found.");
  if (authorType === "agent" && !db.users.some((item) => item.id === value.authorId)) errors.push("Agent author was not found.");
  return result(errors, value);
}

export function validateMacro(input, db) {
  const allowedTags = new Set(activeOnly(db.tags).map((tag) => tag.id));
  const value = {
    name: clean(input.name),
    replyBody: clean(input.replyBody),
    statusChange: ticketStatuses.includes(input.statusChange) ? input.statusChange : "",
    priorityChange: priorities.includes(input.priorityChange) ? input.priorityChange : "",
    tagIdsToAdd: asArray(input.tagIdsToAdd).filter((id) => allowedTags.has(id)),
    active: input.active !== false
  };
  const errors = [];
  if (value.name.length < 3) errors.push("Macro name must be at least 3 characters.");
  if (value.replyBody.length < 8) errors.push("Macro reply body must be at least 8 characters.");
  return result(errors, value);
}

export function validateArticle(input) {
  const title = clean(input.title);
  const value = {
    title,
    slug: slugify(clean(input.slug) || title),
    body: clean(input.body),
    status: articleStatuses.includes(input.status) ? input.status : "draft",
    collection: clean(input.collection)
  };
  const errors = [];
  if (value.title.length < 3) errors.push("Article title must be at least 3 characters.");
  if (!/^[a-z0-9-]{3,80}$/.test(value.slug)) errors.push("Article slug must use lowercase letters, numbers, and dashes.");
  if (value.body.length < 20) errors.push("Article body must be at least 20 characters.");
  if (value.collection.length < 2) errors.push("Collection is required.");
  return result(errors, value);
}

export function addActivity(db, action, entityType, entityId, metadata = {}) {
  db.activities.unshift({
    id: uid("act"),
    actorId: db.session.userId,
    entityType,
    entityId,
    action,
    metadata,
    createdAt: nowIso()
  });
  db.activities = db.activities.slice(0, 250);
}

export function computeMetrics(db) {
  const tickets = db.tickets.filter((ticket) => !ticket.archivedAt && !ticket.mergedIntoId);
  const openTickets = tickets.filter((ticket) => !["resolved", "closed"].includes(ticket.status));
  const resolvedTickets = tickets.filter((ticket) => ticket.resolvedAt);
  const now = Date.now();
  const breached = openTickets.filter((ticket) => new Date(ticket.slaDueAt).getTime() < now);
  const firstResponseHours = average(tickets.filter((ticket) => ticket.firstResponseAt).map((ticket) => hoursBetween(ticket.createdAt, ticket.firstResponseAt)));
  const resolutionHours = average(resolvedTickets.map((ticket) => hoursBetween(ticket.createdAt, ticket.resolvedAt)));
  const reopened = tickets.filter((ticket) => Number(ticket.reopenedCount) > 0).length;
  const byStatus = countBy(tickets, "status");
  const byPriority = countBy(tickets, "priority");
  const byInbox = Object.fromEntries(db.inboxes.map((inbox) => [inbox.name, tickets.filter((ticket) => ticket.inboxId === inbox.id).length]));
  const agentLoad = db.users.map((user) => ({
    id: user.id,
    name: user.name,
    open: openTickets.filter((ticket) => ticket.assigneeId === user.id).length,
    overdue: breached.filter((ticket) => ticket.assigneeId === user.id).length
  }));
  return {
    totalTickets: tickets.length,
    openTickets: openTickets.length,
    slaBreaches: breached.length,
    firstResponseHours,
    resolutionHours,
    reopenRate: tickets.length ? Math.round((reopened / tickets.length) * 100) : 0,
    byStatus,
    byPriority,
    byInbox,
    agentLoad
  };
}

export function toCsv(rows) {
  if (!rows.length) return "";
  const columns = Array.from(rows.reduce((set, row) => {
    for (const key of Object.keys(flatten(row))) set.add(key);
    return set;
  }, new Set()));
  const lines = [columns.join(",")];
  for (const row of rows) {
    const flat = flatten(row);
    lines.push(columns.map((column) => csvCell(flat[column])).join(","));
  }
  return `${lines.join("\n")}\n`;
}

export function shapeState(db) {
  return {
    ...db,
    metrics: computeMetrics(db),
    activities: [...db.activities].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 120)
  };
}

export function publicTicketSummary(db, ticket) {
  const customer = db.customers.find((item) => item.id === ticket.customerId);
  const assignee = db.users.find((item) => item.id === ticket.assigneeId);
  const inbox = db.inboxes.find((item) => item.id === ticket.inboxId);
  return {
    ...ticket,
    customerName: customer?.name || "Unknown customer",
    customerEmail: customer?.email || "",
    assigneeName: assignee?.name || "Unassigned",
    inboxName: inbox?.name || "Unknown inbox",
    messages: db.messages.filter((message) => message.ticketId === ticket.id)
  };
}

function result(errors, value) {
  return errors.length ? { ok: false, errors } : { ok: true, value };
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isIsoLike(value) {
  return Boolean(value) && !Number.isNaN(new Date(value).getTime());
}

function parseAttachments(value) {
  if (Array.isArray(value)) return value.map(clean).filter(Boolean);
  return clean(value).split(",").map(clean).filter(Boolean);
}

function slugify(value) {
  return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

function countBy(rows, key) {
  return rows.reduce((acc, row) => {
    acc[row[key] || "unknown"] = (acc[row[key] || "unknown"] || 0) + 1;
    return acc;
  }, {});
}

function average(values) {
  const usable = values.filter((value) => Number.isFinite(value));
  if (!usable.length) return 0;
  return Math.round((usable.reduce((sum, value) => sum + value, 0) / usable.length) * 10) / 10;
}

function hoursBetween(start, end) {
  return (new Date(end).getTime() - new Date(start).getTime()) / 36e5;
}

function flatten(row) {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key, Array.isArray(value) || typeof value === "object" && value !== null ? JSON.stringify(value) : value]));
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
