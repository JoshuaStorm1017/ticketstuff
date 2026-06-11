# TicketStuff

TicketStuff is a free, self-hostable helpdesk for teams that want Zendesk, Help Scout, or Intercom Inbox style workflows without per-agent pricing or conversation lock-in.

It runs as a local Node HTTP app with atomic JSON persistence. No paid SaaS credentials are required for the core support workflow.

## Features

- Ticket queue with search, status/priority/assignee filters, SLA sorting, and detail preview.
- Ticket lifecycle: create, assign, prioritize, tag, reply, add internal notes, resolve, reopen, merge duplicates, and archive.
- Customer directory with profile notes and ticket history.
- Canned reply macros that can update status, priority, and tags.
- Help-center article management with draft and published states.
- Workspace settings for local users, inboxes, tags, default SLA, and support identity.
- Dashboard analytics for backlog, SLA breaches, response time, resolution time, reopen rate, priority mix, and agent load.
- Audit activity log for workflow and configuration changes.
- Full JSON export plus CSV exports for users, customers, inboxes, tickets, messages, tags, macros, articles, and activity.
- Responsive admin console with durable seeded data for local evaluation.

## Stack

- Node 24+ built-in HTTP server
- Static HTML/CSS/JavaScript admin console
- File-backed JSON persistence at `data/ticketstuff.json`
- Atomic write strategy using temporary files and rename
- Node test runner for domain and API coverage

## Getting Started

```bash
npm install
npm run dev
```

The app listens on `http://127.0.0.1:4120` by default. Override with `HOST` or `PORT` if needed:

```bash
HOST=127.0.0.1 PORT=5120 npm run dev
```

To store data somewhere else:

```bash
TICKETSTUFF_DATA=/path/to/ticketstuff.json npm run dev
```

## Scripts

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run secret-scan
```

## Architecture

- `server/store.js` owns seed data, the data path, reads, and atomic writes.
- `server/domain.js` owns validation, metrics, export helpers, and state shaping.
- `server/routes.js` owns HTTP API routing and mutation boundaries.
- `server/index.js` serves the API and static console.
- `public/app.js` renders the product console and calls the API.
- `tests/` covers metric logic, validation, exports, and key API workflows.

## Deployment Notes

TicketStuff can run anywhere Node 24+ can run with a writable data directory. For a small team, run it behind a reverse proxy and back up `data/ticketstuff.json`. For multi-operator use, the domain and route boundaries are ready for replacing the file store with SQLite while keeping the API and UI shape stable.

## License

MIT
