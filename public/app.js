const app = document.querySelector("#app");

const navItems = [
  ["dashboard", "Dashboard"],
  ["queue", "Queue"],
  ["newTicket", "New Ticket"],
  ["customers", "Customers"],
  ["macros", "Macros"],
  ["articles", "Articles"],
  ["settings", "Settings"],
  ["exports", "Exports"]
];

const statusOptions = ["open", "pending", "waiting_on_customer", "resolved", "closed"];
const priorityOptions = ["low", "normal", "high", "urgent"];
const articleStatuses = ["draft", "published", "archived"];

let state = null;
let activeView = "dashboard";
let selectedTicketId = null;
let notice = "";
let errors = "";
let editing = { customer: null, macro: null, article: null, tag: null, user: null, inbox: null };
let filters = { q: "", status: "active", priority: "all", assignee: "all", sort: "sla" };

loadState();

document.addEventListener("click", async (event) => {
  const nav = event.target.closest("[data-view]");
  if (nav) {
    activeView = nav.dataset.view;
    clearMessages();
    render();
    return;
  }
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const { action, id, type } = button.dataset;
  try {
    if (action === "select-ticket") {
      selectedTicketId = id;
      activeView = "queue";
      render();
    }
    if (action === "resolve-ticket") await request(`/api/tickets/${id}/resolve`, { method: "POST" }, "Ticket resolved.");
    if (action === "reopen-ticket") await request(`/api/tickets/${id}/reopen`, { method: "POST" }, "Ticket reopened.");
    if (action === "archive-ticket") await request(`/api/tickets/${id}`, { method: "DELETE" }, "Ticket archived.");
    if (action === "edit-entity") {
      editing[type] = id;
      render();
    }
    if (action === "cancel-edit") {
      editing[type] = null;
      render();
    }
    if (action === "archive-entity") {
      await request(`/api/${type}s/${id}`, { method: "DELETE" }, `${title(type)} archived.`);
      editing[type] = null;
    }
    if (action === "apply-macro") {
      const macroId = document.querySelector("[name='macroId']")?.value;
      await request(`/api/tickets/${id}/apply-macro`, { method: "POST", body: { macroId } }, "Macro applied.");
    }
    if (action === "merge-ticket") {
      const targetTicketId = document.querySelector("[name='mergeTarget']")?.value;
      await request(`/api/tickets/${id}/merge`, { method: "POST", body: { targetTicketId } }, "Ticket merged.");
    }
    if (action === "clear-filters") {
      filters = { q: "", status: "active", priority: "all", assignee: "all", sort: "sla" };
      render();
    }
  } catch (error) {
    showError(error);
  }
});

document.addEventListener("input", (event) => {
  const input = event.target.closest("[data-filter]");
  if (!input) return;
  filters[input.dataset.filter] = input.value;
  render();
});

document.addEventListener("submit", async (event) => {
  const form = event.target.closest("form[data-form]");
  if (!form) return;
  event.preventDefault();
  try {
    const data = formValues(form);
    if (form.dataset.form === "ticket") {
      await request("/api/tickets", { method: "POST", body: { ...data, tagIds: checkedValues(form, "tagIds") } }, "Ticket created.");
      selectedTicketId = state.tickets.at(-1)?.id || selectedTicketId;
      activeView = "queue";
    }
    if (form.dataset.form === "ticket-edit") {
      await request(`/api/tickets/${form.dataset.id}`, { method: "PUT", body: { ...data, tagIds: checkedValues(form, "tagIds") } }, "Ticket saved.");
    }
    if (form.dataset.form === "message") {
      await request(`/api/tickets/${form.dataset.id}/messages`, { method: "POST", body: data }, data.visibility === "internal" ? "Internal note added." : "Reply sent.");
      form.reset();
    }
    if (form.dataset.form === "customer") {
      await saveEntity("customers", "customer", form, data);
    }
    if (form.dataset.form === "macro") {
      await saveEntity("macros", "macro", form, { ...data, tagIdsToAdd: checkedValues(form, "tagIdsToAdd") });
    }
    if (form.dataset.form === "article") {
      await saveEntity("articles", "article", form, data);
    }
    if (form.dataset.form === "tag") {
      await saveEntity("tags", "tag", form, data);
    }
    if (form.dataset.form === "user") {
      await saveEntity("users", "user", form, data);
    }
    if (form.dataset.form === "inbox") {
      await saveEntity("inboxes", "inbox", form, data);
    }
    if (form.dataset.form === "workspace") {
      await request("/api/workspace", { method: "PUT", body: data }, "Workspace saved.");
    }
  } catch (error) {
    showError(error);
  }
});

async function loadState() {
  try {
    state = await fetchJson("/api/state");
    selectedTicketId ||= activeTickets()[0]?.id || state.tickets[0]?.id || null;
    render();
  } catch (error) {
    app.innerHTML = `<main class="main"><div class="error">${h(error.message)}</div></main>`;
  }
}

function render() {
  if (!state) return;
  app.innerHTML = `
    ${sidebar()}
    <main class="main">
      ${topbar()}
      ${notice ? `<div class="notice">${h(notice)}</div>` : ""}
      ${errors ? `<div class="error">${h(errors)}</div>` : ""}
      ${view()}
    </main>
  `;
}

function sidebar() {
  return `
    <aside class="sidebar">
      <div class="brand">
        <div class="brand-mark">TS</div>
        <div>
          <h1>TicketStuff</h1>
          <p>${h(state.workspace.name)}</p>
        </div>
      </div>
      <nav class="nav">
        ${navItems.map(([id, label]) => `<button class="${activeView === id ? "active" : ""}" data-view="${id}">${label}</button>`).join("")}
      </nav>
      <div class="sidebar-card">
        <strong>Local support desk</strong>
        <span>Unlimited agents, inboxes, tickets, macros, articles, and exports on infrastructure you control.</span>
      </div>
    </aside>
  `;
}

function topbar() {
  const copy = {
    dashboard: ["Operations dashboard", "Backlog, SLA risk, response speed, reopen rate, and agent load are computed from local ticket history."],
    queue: ["Support queue", "Triage, assign, prioritize, reply, add internal notes, merge duplicates, and resolve tickets."],
    newTicket: ["Create ticket", "Capture inbound requests manually with customer detection, tags, SLA due dates, and the first customer message."],
    customers: ["Customers", "Manage customer profiles, notes, companies, and linked ticket history."],
    macros: ["Macros", "Build reusable replies that can update ticket status, priority, and tags."],
    articles: ["Help center", "Write and maintain portable support articles beside ticket workflows."],
    settings: ["Workspace settings", "Configure local users, inboxes, tags, SLA defaults, and workspace identity."],
    exports: ["Open exports", "Download JSON and CSV copies of the operational record without per-seat or data-retention limits."]
  }[activeView];
  return `
    <header class="topbar">
      <div>
        <h2>${copy[0]}</h2>
        <p>${copy[1]}</p>
      </div>
      <div class="actions">
        <button class="ghost" data-view="newTicket">New ticket</button>
        <a class="button" href="/api/export/json">Export JSON</a>
      </div>
    </header>
  `;
}

function view() {
  return {
    dashboard: dashboardView,
    queue: queueView,
    newTicket: newTicketView,
    customers: customersView,
    macros: macrosView,
    articles: articlesView,
    settings: settingsView,
    exports: exportsView
  }[activeView]();
}

function dashboardView() {
  const m = state.metrics;
  return `
    <section class="grid">
      <div class="metrics">
        ${metric("Open tickets", m.openTickets)}
        ${metric("SLA breaches", m.slaBreaches)}
        ${metric("First response", `${m.firstResponseHours}h`)}
        ${metric("Resolution time", `${m.resolutionHours}h`)}
        ${metric("Reopen rate", `${m.reopenRate}%`)}
      </div>
      <div class="split">
        <div class="panel">
          <div class="panel-header"><div><h3>Backlog by status</h3><p>Every bar is derived from active local tickets.</p></div></div>
          ${barChart(m.byStatus)}
        </div>
        <div class="panel">
          <div class="panel-header"><div><h3>Agent load</h3><p>Open work and overdue tickets by local user.</p></div></div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Agent</th><th>Open</th><th>Overdue</th></tr></thead>
              <tbody>${m.agentLoad.map((row) => `<tr><td>${h(row.name)}</td><td>${row.open}</td><td>${row.overdue}</td></tr>`).join("")}</tbody>
            </table>
          </div>
        </div>
      </div>
      <div class="split">
        <div class="panel">
          <div class="panel-header"><div><h3>Priority mix</h3><p>Current pressure across the queue.</p></div></div>
          ${barChart(m.byPriority)}
        </div>
        <div class="panel">
          <div class="panel-header"><div><h3>Recent activity</h3><p>Audit trail for ticket and admin changes.</p></div></div>
          ${activityList()}
        </div>
      </div>
    </section>
  `;
}

function queueView() {
  const tickets = filteredTickets();
  const selected = state.tickets.find((ticket) => ticket.id === selectedTicketId) || tickets[0] || state.tickets[0];
  return `
    <section class="queue-layout">
      <div class="panel">
        <div class="filters">
          <div class="field"><label>Search</label><input data-filter="q" value="${h(filters.q)}"></div>
          <div class="field"><label>Status</label><select data-filter="status">${optionList(["active", "all", ...statusOptions], filters.status)}</select></div>
          <div class="field"><label>Priority</label><select data-filter="priority">${optionList(["all", ...priorityOptions], filters.priority)}</select></div>
          <div class="field"><label>Assignee</label><select data-filter="assignee">${optionList(["all", ...state.users.map((user) => user.id)], filters.assignee, userName)}</select></div>
          <div class="field"><label>Sort</label><select data-filter="sort">${optionList(["sla", "updated", "priority", "customer"], filters.sort)}</select></div>
        </div>
        <div class="panel-header">
          <div><h3>${tickets.length} tickets</h3><p>Saved views can be recreated with these filters and exported as open files.</p></div>
          <button class="ghost" data-action="clear-filters">Clear filters</button>
        </div>
        ${tickets.length ? ticketTable(tickets, selected?.id) : `<div class="empty">No tickets match the current filters.</div>`}
      </div>
      <aside class="detail-stack">
        ${selected ? ticketDetail(selected) : `<div class="panel empty">Create a ticket to begin triage.</div>`}
      </aside>
    </section>
  `;
}

function ticketTable(tickets, selectedId) {
  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Ticket</th><th>Customer</th><th>Status</th><th>Priority</th><th>SLA</th><th>Assignee</th><th></th></tr></thead>
        <tbody>
          ${tickets.map((ticket) => `
            <tr class="${ticket.id === selectedId ? "selected" : ""}">
              <td><div class="subject"><strong>#${ticket.number} ${h(ticket.subject)}</strong><span>${tagList(ticket.tagIds)}</span></div></td>
              <td>${h(customerName(ticket.customerId))}</td>
              <td>${chip(ticket.status)}</td>
              <td>${chip(ticket.priority)}</td>
              <td>${slaBadge(ticket)}</td>
              <td>${h(userName(ticket.assigneeId))}</td>
              <td><button class="ghost" data-action="select-ticket" data-id="${ticket.id}">Open</button></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function ticketDetail(ticket) {
  const messages = state.messages.filter((message) => message.ticketId === ticket.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const otherTickets = state.tickets.filter((item) => item.id !== ticket.id && !item.archivedAt && !item.mergedIntoId);
  return `
    <div class="ticket-hero">
      <span>#${ticket.number} ${chip(ticket.status)} ${chip(ticket.priority)}</span>
      <h3>${h(ticket.subject)}</h3>
      <p>${h(customerName(ticket.customerId))} via ${h(inboxName(ticket.inboxId))} · assigned to ${h(userName(ticket.assigneeId))} · ${h(relative(ticket.updatedAt))}</p>
    </div>
    <div class="panel">
      <div class="panel-header"><div><h3>Ticket properties</h3><p>Update assignment, status, priority, tags, and SLA.</p></div></div>
      ${ticketForm(ticket, "ticket-edit")}
      <div class="row-actions">
        <button class="ghost" data-action="reopen-ticket" data-id="${ticket.id}">Reopen</button>
        <button class="button" data-action="resolve-ticket" data-id="${ticket.id}">Resolve</button>
        <button class="danger" data-action="archive-ticket" data-id="${ticket.id}">Archive</button>
      </div>
    </div>
    <div class="panel">
      <div class="panel-header"><div><h3>Conversation</h3><p>Public replies and internal notes stay with the exportable transcript.</p></div></div>
      <div class="timeline">
        ${messages.map((message) => `
          <article class="timeline-item ${message.visibility}">
            <strong>${h(authorName(message))} · ${h(message.visibility)} · ${h(relative(message.createdAt))}</strong>
            <p>${h(message.body)}</p>
            ${message.attachments.length ? `<p class="muted">Attachments: ${message.attachments.map(h).join(", ")}</p>` : ""}
          </article>
        `).join("")}
      </div>
      <form data-form="message" data-id="${ticket.id}" class="form-grid">
        <div class="field"><label>Visibility</label><select name="visibility">${optionList(["public", "internal"], "public")}</select></div>
        <div class="field"><label>Author</label><select name="authorType">${optionList(["agent", "customer"], "agent")}</select></div>
        <div class="field span-2"><label>Message</label><textarea name="body" required></textarea></div>
        <div class="field span-2"><label>Attachments, comma separated</label><input name="attachments"></div>
        <div class="span-2 actions"><button class="button">Send message</button></div>
      </form>
    </div>
    <div class="panel">
      <div class="panel-header"><div><h3>Macros and duplicate handling</h3><p>Apply repeatable workflow changes or merge a duplicate into another ticket.</p></div></div>
      <div class="form-grid">
        <div class="field"><label>Macro</label><select name="macroId">${optionList(activeMacros().map((macro) => macro.id), activeMacros()[0]?.id, macroName)}</select></div>
        <div class="actions"><button class="button" data-action="apply-macro" data-id="${ticket.id}">Apply macro</button></div>
        <div class="field"><label>Merge into ticket</label><select name="mergeTarget">${optionList(otherTickets.map((item) => item.id), otherTickets[0]?.id, ticketLabel)}</select></div>
        <div class="actions"><button class="ghost" data-action="merge-ticket" data-id="${ticket.id}">Merge duplicate</button></div>
      </div>
    </div>
  `;
}

function newTicketView() {
  return `<section class="panel">${ticketForm(null, "ticket")}</section>`;
}

function ticketForm(ticket, formName) {
  const value = ticket || {
    subject: "",
    status: "open",
    priority: "normal",
    assigneeId: state.users[0]?.id || "",
    customerId: state.customers[0]?.id || "",
    inboxId: state.inboxes[0]?.id || "",
    slaDueAt: futureHours(state.workspace.defaultSlaHours || 24),
    tagIds: []
  };
  return `
    <form data-form="${formName}" ${ticket ? `data-id="${ticket.id}"` : ""} class="form-grid">
      <div class="field span-2"><label>Subject</label><input name="subject" required value="${h(value.subject)}"></div>
      <div class="field"><label>Customer</label><select name="customerId">${optionList(activeCustomers().map((item) => item.id), value.customerId, customerName)}</select></div>
      <div class="field"><label>Inbox</label><select name="inboxId">${optionList(activeInboxes().map((item) => item.id), value.inboxId, inboxName)}</select></div>
      <div class="field"><label>Assignee</label><select name="assigneeId">${optionList(activeUsers().map((item) => item.id), value.assigneeId, userName)}</select></div>
      <div class="field"><label>Status</label><select name="status">${optionList(statusOptions, value.status)}</select></div>
      <div class="field"><label>Priority</label><select name="priority">${optionList(priorityOptions, value.priority)}</select></div>
      <div class="field"><label>SLA due</label><input name="slaDueAt" type="datetime-local" value="${localDateInput(value.slaDueAt)}"></div>
      <div class="check-group span-2"><span>Tags</span><div class="check-list">${state.tags.filter((tag) => !tag.archivedAt).map((tag) => check("tagIds", tag.id, tag.label, value.tagIds?.includes(tag.id))).join("")}</div></div>
      ${ticket ? "" : `<div class="field span-2"><label>First customer message</label><textarea name="initialMessage" required></textarea></div>`}
      <div class="span-2 actions"><button class="button">${ticket ? "Save ticket" : "Create ticket"}</button></div>
    </form>
  `;
}

function customersView() {
  const rows = activeCustomers();
  const edit = state.customers.find((item) => item.id === editing.customer);
  return entityPanel("customer", edit, customerForm(edit), `
    <div class="table-wrap"><table>
      <thead><tr><th>Name</th><th>Email</th><th>Company</th><th>Tickets</th><th></th></tr></thead>
      <tbody>${rows.map((customer) => `<tr><td>${h(customer.name)}</td><td>${h(customer.email)}</td><td>${h(customer.company)}</td><td>${state.tickets.filter((ticket) => ticket.customerId === customer.id && !ticket.archivedAt).length}</td><td>${entityButtons("customer", customer.id)}</td></tr>`).join("")}</tbody>
    </table></div>
  `);
}

function customerForm(customer) {
  const row = customer || { name: "", email: "", company: "", notes: "" };
  return `
    <form data-form="customer" ${customer ? `data-id="${customer.id}"` : ""} class="form-grid">
      <div class="field"><label>Name</label><input name="name" required value="${h(row.name)}"></div>
      <div class="field"><label>Email</label><input name="email" required value="${h(row.email)}"></div>
      <div class="field"><label>Company</label><input name="company" required value="${h(row.company)}"></div>
      <div class="field span-2"><label>Notes</label><textarea name="notes">${h(row.notes)}</textarea></div>
      <div class="span-2 actions"><button class="button">${customer ? "Save customer" : "Create customer"}</button>${customer ? cancelButton("customer") : ""}</div>
    </form>
  `;
}

function macrosView() {
  const edit = state.macros.find((item) => item.id === editing.macro);
  return entityPanel("macro", edit, macroForm(edit), `
    <div class="cards">${activeMacros().map((macro) => `<article class="mini-card"><h4>${h(macro.name)}</h4><p>${h(macro.replyBody)}</p><p>${chip(macro.statusChange || "no status")} ${chip(macro.priorityChange || "no priority")}</p><div class="row-actions">${entityButtons("macro", macro.id)}</div></article>`).join("")}</div>
  `);
}

function macroForm(macro) {
  const row = macro || { name: "", replyBody: "", statusChange: "", priorityChange: "", tagIdsToAdd: [] };
  return `
    <form data-form="macro" ${macro ? `data-id="${macro.id}"` : ""} class="form-grid">
      <div class="field"><label>Name</label><input name="name" required value="${h(row.name)}"></div>
      <div class="field"><label>Status change</label><select name="statusChange">${optionList(["", ...statusOptions], row.statusChange)}</select></div>
      <div class="field"><label>Priority change</label><select name="priorityChange">${optionList(["", ...priorityOptions], row.priorityChange)}</select></div>
      <div class="field span-2"><label>Reply body</label><textarea name="replyBody" required>${h(row.replyBody)}</textarea></div>
      <div class="check-group span-2"><span>Tags to add</span><div class="check-list">${state.tags.filter((tag) => !tag.archivedAt).map((tag) => check("tagIdsToAdd", tag.id, tag.label, row.tagIdsToAdd?.includes(tag.id))).join("")}</div></div>
      <div class="span-2 actions"><button class="button">${macro ? "Save macro" : "Create macro"}</button>${macro ? cancelButton("macro") : ""}</div>
    </form>
  `;
}

function articlesView() {
  const edit = state.articles.find((item) => item.id === editing.article);
  return entityPanel("article", edit, articleForm(edit), `
    <div class="table-wrap"><table>
      <thead><tr><th>Title</th><th>Collection</th><th>Status</th><th>Updated</th><th></th></tr></thead>
      <tbody>${state.articles.filter((article) => !article.archivedAt).map((article) => `<tr><td>${h(article.title)}<br><span class="muted">/${h(article.slug)}</span></td><td>${h(article.collection)}</td><td>${chip(article.status)}</td><td>${h(relative(article.updatedAt))}</td><td>${entityButtons("article", article.id)}</td></tr>`).join("")}</tbody>
    </table></div>
  `);
}

function articleForm(article) {
  const row = article || { title: "", slug: "", collection: "", status: "draft", body: "" };
  return `
    <form data-form="article" ${article ? `data-id="${article.id}"` : ""} class="form-grid">
      <div class="field"><label>Title</label><input name="title" required value="${h(row.title)}"></div>
      <div class="field"><label>Slug</label><input name="slug" value="${h(row.slug)}"></div>
      <div class="field"><label>Collection</label><input name="collection" required value="${h(row.collection)}"></div>
      <div class="field"><label>Status</label><select name="status">${optionList(articleStatuses, row.status)}</select></div>
      <div class="field span-2"><label>Body</label><textarea name="body" required>${h(row.body)}</textarea></div>
      <div class="span-2 actions"><button class="button">${article ? "Save article" : "Create article"}</button>${article ? cancelButton("article") : ""}</div>
    </form>
  `;
}

function settingsView() {
  return `
    <section class="grid">
      <div class="panel">
        <div class="panel-header"><div><h3>Workspace</h3><p>Core local identity and SLA defaults.</p></div></div>
        <form data-form="workspace" class="form-grid">
          <div class="field"><label>Name</label><input name="name" value="${h(state.workspace.name)}"></div>
          <div class="field"><label>Support email</label><input name="supportEmail" value="${h(state.workspace.supportEmail)}"></div>
          <div class="field"><label>Timezone</label><input name="timezone" value="${h(state.workspace.timezone)}"></div>
          <div class="field"><label>Default SLA hours</label><input name="defaultSlaHours" type="number" min="1" value="${h(state.workspace.defaultSlaHours)}"></div>
          <div class="span-2 actions"><button class="button">Save workspace</button></div>
        </form>
      </div>
      <div class="split">
        ${settingsEntity("user", "Users", userForm, state.users.filter((user) => user.active !== false), (user) => `${h(user.name)} · ${h(user.role)} · ${h(user.email)}`)}
        ${settingsEntity("inbox", "Inboxes", inboxForm, activeInboxes(), (inbox) => `${h(inbox.name)} · ${h(inbox.address)} · ${h(inbox.channelType)}`)}
      </div>
      ${settingsEntity("tag", "Tags", tagForm, state.tags.filter((tag) => !tag.archivedAt), (tag) => `<span class="tag" style="background:${h(tag.color)}">${h(tag.label)}</span>`)}
    </section>
  `;
}

function settingsEntity(type, heading, formFactory, rows, labelFactory) {
  const edit = state[`${type}s`]?.find((item) => item.id === editing[type]) || state[type === "inbox" ? "inboxes" : `${type}s`]?.find((item) => item.id === editing[type]);
  return `
    <div class="panel">
      <div class="panel-header"><div><h3>${heading}</h3><p>Create, edit, and archive local configuration.</p></div></div>
      ${formFactory(edit)}
      <div class="grid">
        ${rows.map((row) => `<div class="mini-card"><p>${labelFactory(row)}</p><div class="row-actions">${entityButtons(type, row.id)}</div></div>`).join("")}
      </div>
    </div>
  `;
}

function userForm(user) {
  const row = user || { name: "", email: "", role: "agent", avatarColor: "#0f766e" };
  return `
    <form data-form="user" ${user ? `data-id="${user.id}"` : ""} class="form-grid">
      <div class="field"><label>Name</label><input name="name" value="${h(row.name)}"></div>
      <div class="field"><label>Email</label><input name="email" value="${h(row.email)}"></div>
      <div class="field"><label>Role</label><select name="role">${optionList(["admin", "agent", "viewer"], row.role)}</select></div>
      <div class="field"><label>Color</label><input name="avatarColor" value="${h(row.avatarColor)}"></div>
      <div class="span-2 actions"><button class="button">${user ? "Save user" : "Create user"}</button>${user ? cancelButton("user") : ""}</div>
    </form>
  `;
}

function inboxForm(inbox) {
  const row = inbox || { name: "", address: "", channelType: "email" };
  return `
    <form data-form="inbox" ${inbox ? `data-id="${inbox.id}"` : ""} class="form-grid">
      <div class="field"><label>Name</label><input name="name" value="${h(row.name)}"></div>
      <div class="field"><label>Address</label><input name="address" value="${h(row.address)}"></div>
      <div class="field"><label>Channel</label><select name="channelType">${optionList(["email", "manual", "chat"], row.channelType)}</select></div>
      <div class="actions"><button class="button">${inbox ? "Save inbox" : "Create inbox"}</button>${inbox ? cancelButton("inbox") : ""}</div>
    </form>
  `;
}

function tagForm(tag) {
  const row = tag || { label: "", color: "#2563eb" };
  return `
    <form data-form="tag" ${tag ? `data-id="${tag.id}"` : ""} class="form-grid">
      <div class="field"><label>Label</label><input name="label" value="${h(row.label)}"></div>
      <div class="field"><label>Color</label><input name="color" value="${h(row.color)}"></div>
      <div class="span-2 actions"><button class="button">${tag ? "Save tag" : "Create tag"}</button>${tag ? cancelButton("tag") : ""}</div>
    </form>
  `;
}

function exportsView() {
  const entities = ["users", "customers", "inboxes", "tickets", "messages", "tags", "macros", "articles", "activities"];
  return `
    <section class="grid">
      <div class="panel">
        <div class="panel-header"><div><h3>Portable data</h3><p>Every operational table can leave the app as JSON or CSV.</p></div></div>
        <div class="actions"><a class="button" href="/api/export/json">Download full JSON</a></div>
      </div>
      <div class="cards">
        ${entities.map((entity) => `<article class="mini-card"><h4>${h(title(entity))}</h4><p>${(state[entity] || []).length} records</p><p><a class="ghost" href="/api/export/csv?entity=${entity}">Download CSV</a></p></article>`).join("")}
      </div>
    </section>
  `;
}

function entityPanel(type, edit, form, list) {
  return `<section class="grid"><div class="panel"><div class="panel-header"><div><h3>${edit ? `Edit ${type}` : `Create ${type}`}</h3><p>Changes persist locally and are recorded in the activity log.</p></div></div>${form}</div><div class="panel">${list}</div></section>`;
}

async function saveEntity(collection, type, form, body) {
  const id = form.dataset.id;
  await request(id ? `/api/${collection}/${id}` : `/api/${collection}`, { method: id ? "PUT" : "POST", body }, id ? `${title(type)} saved.` : `${title(type)} created.`);
  editing[type] = null;
}

function filteredTickets() {
  const q = filters.q.toLowerCase();
  const rows = state.tickets.filter((ticket) => !ticket.archivedAt && !ticket.mergedIntoId).filter((ticket) => {
    const haystack = [ticket.subject, customerName(ticket.customerId), userName(ticket.assigneeId), inboxName(ticket.inboxId), ...ticket.tagIds.map(tagName)].join(" ").toLowerCase();
    if (filters.status === "active" && ["resolved", "closed"].includes(ticket.status)) return false;
    if (filters.status !== "active" && filters.status !== "all" && ticket.status !== filters.status) return false;
    if (filters.priority !== "all" && ticket.priority !== filters.priority) return false;
    if (filters.assignee !== "all" && ticket.assigneeId !== filters.assignee) return false;
    return !q || haystack.includes(q);
  });
  return rows.sort((a, b) => {
    if (filters.sort === "updated") return b.updatedAt.localeCompare(a.updatedAt);
    if (filters.sort === "priority") return priorityOptions.indexOf(b.priority) - priorityOptions.indexOf(a.priority);
    if (filters.sort === "customer") return customerName(a.customerId).localeCompare(customerName(b.customerId));
    return new Date(a.slaDueAt).getTime() - new Date(b.slaDueAt).getTime();
  });
}

function activeTickets() {
  return state.tickets.filter((ticket) => !ticket.archivedAt && !ticket.mergedIntoId && !["resolved", "closed"].includes(ticket.status));
}

function activeCustomers() {
  return state.customers.filter((item) => !item.archivedAt);
}

function activeUsers() {
  return state.users.filter((item) => item.active !== false);
}

function activeInboxes() {
  return state.inboxes.filter((item) => item.active !== false);
}

function activeMacros() {
  return state.macros.filter((item) => item.active !== false && !item.archivedAt);
}

function metric(label, value) {
  return `<div class="metric"><span>${h(label)}</span><strong>${h(value)}</strong></div>`;
}

function barChart(data) {
  const entries = Object.entries(data);
  const max = Math.max(1, ...entries.map(([, value]) => value));
  return `<div class="bars">${entries.map(([key, value]) => `<div class="bar"><span>${h(title(key))}</span><div class="track"><span style="width:${Math.round((value / max) * 100)}%"></span></div><strong>${value}</strong></div>`).join("")}</div>`;
}

function activityList() {
  return `<div class="timeline">${state.activities.slice(0, 12).map((item) => `<article class="timeline-item"><strong>${h(userName(item.actorId))} · ${h(item.action)} · ${h(relative(item.createdAt))}</strong><p>${h(item.entityType)} ${h(item.entityId)}</p></article>`).join("")}</div>`;
}

function entityButtons(type, id) {
  return `<button class="ghost" data-action="edit-entity" data-type="${type}" data-id="${id}">Edit</button><button class="danger" data-action="archive-entity" data-type="${type}" data-id="${id}">Archive</button>`;
}

function cancelButton(type) {
  return `<button class="ghost" type="button" data-action="cancel-edit" data-type="${type}">Cancel</button>`;
}

function optionList(values, selected, labeler = title) {
  if (!values.length) return `<option value="">None</option>`;
  return values.map((value) => `<option value="${h(value)}" ${value === selected ? "selected" : ""}>${h(labeler(value))}</option>`).join("");
}

function check(name, value, label, checked) {
  return `<label><input type="checkbox" name="${name}" value="${h(value)}" ${checked ? "checked" : ""}> ${h(label)}</label>`;
}

function chip(value) {
  return `<span class="chip ${h(String(value))}">${h(title(value || "none"))}</span>`;
}

function tagList(ids) {
  return ids.map((id) => {
    const tag = state.tags.find((item) => item.id === id);
    return tag ? `<span class="tag" style="background:${h(tag.color)}">${h(tag.label)}</span>` : "";
  }).join("");
}

function slaBadge(ticket) {
  const due = new Date(ticket.slaDueAt).getTime();
  const breached = due < Date.now() && !["resolved", "closed"].includes(ticket.status);
  return `<span class="chip ${breached ? "overdue" : ""}">${breached ? "Overdue" : h(relative(ticket.slaDueAt))}</span>`;
}

function formValues(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function checkedValues(form, name) {
  return [...form.querySelectorAll(`input[name='${name}']:checked`)].map((input) => input.value);
}

async function request(url, options, success) {
  await fetchJson(url, {
    method: options.method,
    headers: { "content-type": "application/json" },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  state = await fetchJson("/api/state");
  notice = success;
  errors = "";
  render();
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const payload = await response.json();
  if (!response.ok) throw new Error((payload.errors || ["Request failed."]).join(" "));
  return payload;
}

function clearMessages() {
  notice = "";
  errors = "";
}

function showError(error) {
  errors = error.message;
  notice = "";
  render();
}

function customerName(id) {
  const customer = state.customers.find((item) => item.id === id);
  return customer ? `${customer.name} (${customer.company})` : "Unknown customer";
}

function userName(id) {
  return state.users.find((item) => item.id === id)?.name || "Unassigned";
}

function inboxName(id) {
  return state.inboxes.find((item) => item.id === id)?.name || "Unknown inbox";
}

function macroName(id) {
  return state.macros.find((item) => item.id === id)?.name || "Choose macro";
}

function ticketLabel(id) {
  const ticket = state.tickets.find((item) => item.id === id);
  return ticket ? `#${ticket.number} ${ticket.subject}` : "Choose ticket";
}

function tagName(id) {
  return state.tags.find((item) => item.id === id)?.label || "";
}

function authorName(message) {
  return message.authorType === "customer" ? customerName(message.authorId) : userName(message.authorId);
}

function localDateInput(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 16);
}

function futureHours(hours) {
  return new Date(Date.now() + Number(hours) * 60 * 60 * 1000).toISOString();
}

function relative(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const diff = date.getTime() - Date.now();
  const abs = Math.abs(diff);
  const unit = abs > 86400000 ? "d" : abs > 3600000 ? "h" : "m";
  const divisor = unit === "d" ? 86400000 : unit === "h" ? 3600000 : 60000;
  const amount = Math.max(1, Math.round(abs / divisor));
  return diff < 0 ? `${amount}${unit} ago` : `in ${amount}${unit}`;
}

function title(value) {
  return String(value || "").replaceAll("_", " ").replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function h(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}
