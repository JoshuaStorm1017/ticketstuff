# TicketStuff - Spec

## Paid Product Being Replaced
TicketStuff is a free, self-hostable Zendesk / Help Scout / Intercom Inbox alternative for small teams that need real customer support operations without per-agent pricing.

## User Pain And Pricing / Lock-In Problem
Zendesk and Intercom become expensive as soon as a team adds agents, automations, or reporting. Help desks also trap years of customer conversations, canned replies, tags, SLA history, and knowledge-base articles in proprietary exports. TicketStuff should let a team run unlimited inboxes, agents, tickets, tags, views, and canned replies on infrastructure they control.

## Anti-Lock-In Headline
Unlimited support queues, portable customer history, and open JSON/CSV exports from day one.

## Exact User Workflows
- Create a local workspace and default admin session without any SaaS credential.
- Connect or manually create support inboxes for email-style channels.
- Create tickets from inbound messages or agent forms.
- Triage tickets by priority, status, assignment, tags, customer, and SLA due time.
- Reply internally with notes or externally with customer-visible messages.
- Use canned replies and macros to update status, assignment, priority, and tags.
- Merge duplicate tickets and link related tickets.
- Build and edit help-center articles.
- Search across customers, tickets, messages, notes, and articles.
- View dashboards for backlog, first response time, resolution time, reopen rate, SLA breaches, and agent load.
- Export all tickets, customers, conversations, tags, and articles in open formats.

## Data Model
- `Workspace`: name, support email, timezone, default SLA policy.
- `LocalUser`: name, email, role, avatar color, active flag.
- `Customer`: name, email, company, notes, createdAt, updatedAt.
- `Inbox`: name, address, channel type, active flag.
- `Ticket`: subject, status, priority, assigneeId, customerId, inboxId, slaDueAt, firstResponseAt, resolvedAt, archivedAt.
- `Message`: ticketId, authorType, authorId/customerId, visibility, body, attachments, createdAt.
- `Tag`: label, color, archivedAt.
- `TicketTag`: ticketId, tagId.
- `Macro`: name, reply body, status change, priority change, tags to add/remove.
- `Article`: title, slug, body, status, collection, updatedAt.
- `Activity`: actorId, entityType, entityId, action, metadata, createdAt.

## Must-Have Screens
- Inbox queue with saved views, search, filters, sort, bulk assignment, and SLA badges.
- Ticket detail with conversation timeline, internal notes, reply composer, customer profile, tags, and activity.
- New ticket form with validation and duplicate customer detection.
- Customers directory with detail view and ticket history.
- Canned replies/macros management.
- Help-center article editor and article list.
- Analytics dashboard with real computed metrics.
- Settings for workspace, users, inboxes, tags, SLA policy, import/export.

## Local / Self-Hosted Behavior
- Runs locally with no external API keys.
- Uses local persistence; SQLite is preferred, but a file-backed store is acceptable only if it is transactional enough for local use.
- Optional SMTP can be added later; core ticketing must work without email credentials.
- All data exportable to JSON and CSV.

## Acceptance Criteria
- Full CRUD for tickets, customers, tags, macros, and articles.
- Real ticket workflow: create, assign, reply, note, tag, prioritize, resolve, reopen, archive, export.
- Search, filters, sorting, empty states, error states, validation, seeded realistic data, and audit history.
- Dashboard metrics are computed from persisted ticket and message data, not hard-coded.
- No artificial agent, ticket, inbox, or export limits.
- README, MIT license, validation scripts, and local setup instructions included.

## Validation Commands
- `npm install`
- `npm run dev`
- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`

## GitHub Publishing Expectations
- Repository name: `ticketstuff`
- Owner: `JoshuaStorm1017`
- Visibility: public
- Local git author: `JoshuaStorm1017 <JoshuaStorm1017@gmail.com>`
- Publish only after identity check, validation, and clean no-secret scan.

