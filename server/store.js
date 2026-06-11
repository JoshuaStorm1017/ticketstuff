import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultDataPath = path.join(rootDir, "data", "ticketstuff.json");

export function dataPath() {
  return process.env.TICKETSTUFF_DATA || defaultDataPath;
}

export async function readDb() {
  const filePath = dataPath();
  await ensureDb(filePath);
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw);
}

export async function writeDb(db) {
  const filePath = dataPath();
  await mkdir(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.tmp`;
  await writeFile(tmpPath, `${JSON.stringify(db, null, 2)}\n`, "utf8");
  await rename(tmpPath, filePath);
}

async function ensureDb(filePath) {
  try {
    await readFile(filePath, "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, `${JSON.stringify(seedData(), null, 2)}\n`, "utf8");
  }
}

export function seedData() {
  const base = new Date("2026-06-11T09:00:00.000Z");
  const iso = (hours) => new Date(base.getTime() + hours * 60 * 60 * 1000).toISOString();

  const users = [
    { id: "usr_alex", name: "Alex Baker", email: "alex@example.com", role: "admin", avatarColor: "#0f766e", active: true, createdAt: iso(-900), updatedAt: iso(-10) },
    { id: "usr_mira", name: "Mira Patel", email: "mira@example.com", role: "agent", avatarColor: "#2563eb", active: true, createdAt: iso(-880), updatedAt: iso(-12) },
    { id: "usr_lee", name: "Lee Chen", email: "lee@example.com", role: "agent", avatarColor: "#b45309", active: true, createdAt: iso(-820), updatedAt: iso(-20) }
  ];

  const customers = [
    { id: "cus_river", name: "Nora Reyes", email: "nora@riverworks.test", company: "RiverWorks", notes: "Enterprise buyer, prefers concise summaries.", archivedAt: null, createdAt: iso(-700), updatedAt: iso(-6) },
    { id: "cus_northstar", name: "Sam Holder", email: "sam@northstar.test", company: "Northstar Labs", notes: "Uses SAML and bulk import heavily.", archivedAt: null, createdAt: iso(-620), updatedAt: iso(-30) },
    { id: "cus_luma", name: "Imani Cole", email: "imani@lumaline.test", company: "LumaLine", notes: "Seasonal support spikes after product launches.", archivedAt: null, createdAt: iso(-560), updatedAt: iso(-5) },
    { id: "cus_arcade", name: "Gabe Morris", email: "gabe@arcade.test", company: "ArcadeOps", notes: "Needs finance exports every month.", archivedAt: null, createdAt: iso(-500), updatedAt: iso(-80) }
  ];

  const inboxes = [
    { id: "inb_support", name: "Customer Support", address: "support@example.com", channelType: "email", active: true, createdAt: iso(-900), updatedAt: iso(-30) },
    { id: "inb_billing", name: "Billing", address: "billing@example.com", channelType: "email", active: true, createdAt: iso(-850), updatedAt: iso(-40) },
    { id: "inb_success", name: "Success Desk", address: "success@example.com", channelType: "manual", active: true, createdAt: iso(-820), updatedAt: iso(-40) }
  ];

  const tags = [
    { id: "tag_billing", label: "billing", color: "#0f766e", archivedAt: null, createdAt: iso(-820), updatedAt: iso(-40) },
    { id: "tag_enterprise", label: "enterprise", color: "#2563eb", archivedAt: null, createdAt: iso(-820), updatedAt: iso(-40) },
    { id: "tag_import", label: "import", color: "#7c3aed", archivedAt: null, createdAt: iso(-820), updatedAt: iso(-40) },
    { id: "tag_bug", label: "bug", color: "#dc2626", archivedAt: null, createdAt: iso(-820), updatedAt: iso(-40) },
    { id: "tag_handoff", label: "handoff", color: "#b45309", archivedAt: null, createdAt: iso(-820), updatedAt: iso(-40) }
  ];

  const tickets = [
    {
      id: "tkt_import_retry",
      number: 1042,
      subject: "Bulk CSV import stalls after validation",
      status: "open",
      priority: "urgent",
      assigneeId: "usr_mira",
      customerId: "cus_northstar",
      inboxId: "inb_support",
      tagIds: ["tag_enterprise", "tag_import", "tag_bug"],
      slaDueAt: iso(2),
      firstResponseAt: iso(-7),
      resolvedAt: null,
      archivedAt: null,
      reopenedCount: 1,
      mergedIntoId: null,
      createdAt: iso(-10),
      updatedAt: iso(-1)
    },
    {
      id: "tkt_invoice_tax",
      number: 1041,
      subject: "Need corrected invoice tax ID",
      status: "pending",
      priority: "normal",
      assigneeId: "usr_lee",
      customerId: "cus_arcade",
      inboxId: "inb_billing",
      tagIds: ["tag_billing"],
      slaDueAt: iso(12),
      firstResponseAt: iso(-30),
      resolvedAt: null,
      archivedAt: null,
      reopenedCount: 0,
      mergedIntoId: null,
      createdAt: iso(-35),
      updatedAt: iso(-3)
    },
    {
      id: "tkt_sso_mapping",
      number: 1040,
      subject: "SAML group mapping question",
      status: "waiting_on_customer",
      priority: "high",
      assigneeId: "usr_alex",
      customerId: "cus_river",
      inboxId: "inb_success",
      tagIds: ["tag_enterprise", "tag_handoff"],
      slaDueAt: iso(-4),
      firstResponseAt: iso(-70),
      resolvedAt: null,
      archivedAt: null,
      reopenedCount: 0,
      mergedIntoId: null,
      createdAt: iso(-74),
      updatedAt: iso(-6)
    },
    {
      id: "tkt_export_complete",
      number: 1039,
      subject: "Export customer transcript archive",
      status: "resolved",
      priority: "normal",
      assigneeId: "usr_lee",
      customerId: "cus_luma",
      inboxId: "inb_support",
      tagIds: ["tag_enterprise"],
      slaDueAt: iso(-120),
      firstResponseAt: iso(-150),
      resolvedAt: iso(-118),
      archivedAt: null,
      reopenedCount: 0,
      mergedIntoId: null,
      createdAt: iso(-160),
      updatedAt: iso(-118)
    }
  ];

  const messages = [
    { id: "msg_1", ticketId: "tkt_import_retry", authorType: "customer", authorId: "cus_northstar", visibility: "public", body: "Our bulk CSV import passes validation and then stays in processing. We retried twice and need the customer migration finished today.", attachments: ["northstar-import-errors.csv"], createdAt: iso(-10) },
    { id: "msg_2", ticketId: "tkt_import_retry", authorType: "agent", authorId: "usr_mira", visibility: "public", body: "I found the import job in a retry loop and escalated the failing row group. I will keep this ticket updated until the queue clears.", attachments: [], createdAt: iso(-7) },
    { id: "msg_3", ticketId: "tkt_import_retry", authorType: "agent", authorId: "usr_mira", visibility: "internal", body: "Potential parser edge case with quoted line breaks. Link to engineering issue in customer notes.", attachments: [], createdAt: iso(-3) },
    { id: "msg_4", ticketId: "tkt_invoice_tax", authorType: "customer", authorId: "cus_arcade", visibility: "public", body: "The April invoice is missing our VAT ID. Can you reissue it before finance closes the month?", attachments: ["invoice-APR-1041.pdf"], createdAt: iso(-35) },
    { id: "msg_5", ticketId: "tkt_invoice_tax", authorType: "agent", authorId: "usr_lee", visibility: "public", body: "I corrected the billing profile and sent the request to finance review. You will receive the revised invoice shortly.", attachments: [], createdAt: iso(-30) },
    { id: "msg_6", ticketId: "tkt_sso_mapping", authorType: "customer", authorId: "cus_river", visibility: "public", body: "We need groups from Okta to map into workspace roles. Which attribute should we send?", attachments: [], createdAt: iso(-74) },
    { id: "msg_7", ticketId: "tkt_sso_mapping", authorType: "agent", authorId: "usr_alex", visibility: "public", body: "Use the groups attribute with exact role names. I am attaching the mapping table and waiting on your Okta screenshot.", attachments: ["saml-role-mapping.csv"], createdAt: iso(-70) },
    { id: "msg_8", ticketId: "tkt_export_complete", authorType: "customer", authorId: "cus_luma", visibility: "public", body: "Please export our transcript history for the last quarter.", attachments: [], createdAt: iso(-160) },
    { id: "msg_9", ticketId: "tkt_export_complete", authorType: "agent", authorId: "usr_lee", visibility: "public", body: "The transcript archive is attached in JSON and CSV. I am marking this resolved.", attachments: ["luma-transcripts-q1.json", "luma-transcripts-q1.csv"], createdAt: iso(-150) }
  ];

  const macros = [
    { id: "mac_escalate", name: "Escalate with customer update", replyBody: "Thanks for the detail. I am escalating this with the product context attached and will update this thread with the next concrete finding.", statusChange: "open", priorityChange: "high", tagIdsToAdd: ["tag_handoff"], active: true, createdAt: iso(-500), updatedAt: iso(-40) },
    { id: "mac_waiting", name: "Waiting on customer detail", replyBody: "Could you send a screenshot, the affected record ID, and the approximate time this happened? I will keep the ticket open while we wait.", statusChange: "waiting_on_customer", priorityChange: "", tagIdsToAdd: [], active: true, createdAt: iso(-500), updatedAt: iso(-40) },
    { id: "mac_billing", name: "Billing profile corrected", replyBody: "Your billing profile has been updated and finance is regenerating the invoice. I will send the revised copy here once it is ready.", statusChange: "pending", priorityChange: "normal", tagIdsToAdd: ["tag_billing"], active: true, createdAt: iso(-450), updatedAt: iso(-20) }
  ];

  const articles = [
    { id: "art_csv_import", title: "Prepare a CSV import", slug: "prepare-csv-import", body: "Use UTF-8 CSV files, include stable external IDs, and keep multiline text quoted. Run validation before starting large imports.", status: "published", collection: "Data import", archivedAt: null, createdAt: iso(-300), updatedAt: iso(-20) },
    { id: "art_saml_roles", title: "Map SAML groups to workspace roles", slug: "map-saml-groups", body: "Send a groups attribute from your identity provider. Group names must match workspace roles or configured aliases.", status: "published", collection: "Security", archivedAt: null, createdAt: iso(-280), updatedAt: iso(-35) },
    { id: "art_export_history", title: "Export ticket history", slug: "export-ticket-history", body: "Admins can export customers, tickets, messages, tags, macros, and articles as JSON or CSV from the export screen.", status: "draft", collection: "Administration", archivedAt: null, createdAt: iso(-240), updatedAt: iso(-5) }
  ];

  return {
    workspace: {
      id: "wrk_ticketstuff",
      name: "TicketStuff Support",
      supportEmail: "support@example.com",
      timezone: "America/Detroit",
      defaultSlaHours: 24,
      createdAt: iso(-900),
      updatedAt: iso(-10)
    },
    session: { userId: "usr_alex", userName: "Alex Baker" },
    counters: { ticketNumber: 1043 },
    users,
    customers,
    inboxes,
    tickets,
    messages,
    tags,
    macros,
    articles,
    activities: [
      { id: "act_1", actorId: "usr_mira", entityType: "ticket", entityId: "tkt_import_retry", action: "reopened ticket", metadata: { subject: "Bulk CSV import stalls after validation" }, createdAt: iso(-1) },
      { id: "act_2", actorId: "usr_lee", entityType: "ticket", entityId: "tkt_invoice_tax", action: "sent external reply", metadata: { visibility: "public" }, createdAt: iso(-30) },
      { id: "act_3", actorId: "usr_alex", entityType: "article", entityId: "art_export_history", action: "updated article", metadata: { title: "Export ticket history" }, createdAt: iso(-5) }
    ]
  };
}
