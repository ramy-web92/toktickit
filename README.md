# TokTickIT

TokTickIT is an IT service desk application built across four sprints: React (Vite + Bootstrap, "Zen Green" theme) frontend, Express (TypeScript) backend, and PostgreSQL via Prisma. Lab 4 completes the workflow with Actions Taken, the final Ticket status rules, role dashboards and final regression.

## Tech Stack

- Frontend: React + TypeScript + Vite + Bootstrap
- Backend: Node.js + Express + TypeScript
- Database: PostgreSQL + Prisma
- Testing: Vitest (frontend + backend), Supertest (API), React Testing Library (UI), Playwright + axe-core (end-to-end, responsive, accessibility)

## Prerequisites

- Node.js
- PostgreSQL (running locally, database named `toktickit`)

## Setup

### 1. Backend

```bash
cd server
npm install
copy .env.example .env      # then set your DATABASE_URL (Windows; use cp on macOS/Linux)
npx prisma migrate dev      # applies all migrations, including lab4_actions_taken
npx prisma db seed          # idempotent: safe to run as often as you want
npm run dev
```

Backend runs on `http://localhost:3000` (`/api/health`, and `/api/health/ready` also checks the database).

### 2. Frontend

```bash
cd client
npm install
npm run dev
```

Frontend runs on `http://localhost:5173`.

### 3. End-to-end tests (from the repository root)

```bash
npm install
npx playwright install chromium   # first time only
```

## Database: migrate, seed, reset, rollback

| Command (in `server/`) | What it does |
|---|---|
| `npx prisma migrate dev` | Applies pending migrations (Lab 4: `20261024090000_lab4_actions_taken`, with backfill of `resolvedAt` / `closedAt`) |
| `npx prisma db seed` | Idempotent seed: all statuses and IT Priorities, assigned/unassigned Tickets, 0/1/many Actions Taken |
| `npm run db:reset` | **Drops all data**, re-applies every migration and re-seeds — use it before a demo or before taking screenshots (automated tests create extra Tickets) |
| `npx prisma db execute --file prisma/rollback/lab4_down.sql --schema prisma/schema.prisma` | Rolls back the Lab 4 migration only (Lab 1–3 data is kept); then restore the Lab 3 `schema.prisma` |

## Running Tests

```bash
cd server
npm test                  # unit + API + migration/seed + Lab 1–4 regression (needs the seeded database)

cd client
npm test                  # UI component tests (API mocked)

# from the repository root, with the database seeded
npm run test:e2e          # Lab 3 + Lab 4 end-to-end, responsive and accessibility tests
npm run test:e2e:lab4     # Lab 4 only
```

Playwright starts (or reuses) the API and the client automatically. `e2e/lab-04/responsive.spec.ts` saves desktop, tablet and mobile screenshots to `artifacts/lab-04/screenshots/`.

## Lab 2 Features (Requester Ticketing MVP)

-  Development Requester selector (fake login)
-  Create Ticket (form with validation)
-  My Tickets (list with search/filter/sort/pagination)
-  Ticket Detail (read-only + attachments management)
-  Attachment upload, download, soft removal

## Lab 2 Documentation

All specification and documentation files are located in `docs/lab-02/`:
- specification.md – BR, FR, AC, data model
- api-spec.md – REST API endpoints
- ui-spec.md – UI specifications and screenshots
- tests.md– Test plan with traceability
- ai-use.md – AI usage log
- reviewer.md – Peer review log

## Lab 3 Features (Users, Roles, IT Staff Ticketing, and Admin Screens)

* Session-based authentication (login, logout, current-user, mandatory first-login password change)
* Role-based authorization (Requester, IT Staff, Administrator)
* Requester regression: Public Comments and "Problem Appears Resolved" on Ticket Detail
* IT Staff Ticket Queue (search/filter/sort/pagination) and Ticket Detail (ownership, IT Priority, status transitions, Public Comments, Internal Notes)
* Minimalist Administrator User Management (create/edit users, role assignment, activation, password reset, safety rules)

## Lab 3 Documentation
All specification and documentation files are located in `docs/lab-03/`:

* specification.md – FR, BR, AC, data model, API contract
* api-spec.md – REST API endpoints for authentication, IT Staff, and Administrator features
* ui-spec.md – UI specifications for all Lab 3 screens
* tests.md – Test plan with traceability (66 automated backend tests)
* ai-use.md – AI usage log
* reviewer.md – Peer review log for PRs #21–#40

## Lab 4 Features (Actions Taken, Dashboards and Final Regression)

* Actions Taken on each Ticket: date/time, description, result, assignee, performed by (automatic), follow-up and attachment notes; Planned → In Progress → Completed / Cancelled; append-only (no deletion, completed actions read-only)
* Final Ticket workflow: Lab 3 transition matrix enforced by the backend, resolution gate (at least one completed action and no open action), append-only status history, cancel reason, `resolvedAt` / `closedAt`
* Requester "Problem appears resolved" stays advisory: only IT Staff resolve
* Optimistic concurrency (`version` → `409 STALE_UPDATE`) and duplicate-submit protection (`Idempotency-Key`)
* Requester and IT Staff dashboards (Administrator adds user counts), computed by the backend, every card drills down to the matching filtered list
* Role-based navigation with Dashboard as landing page
* Hardening: keyboard-accessible lists, readable status/priority labels, no horizontal page scrolling, safe error messages; fixes for queue sorting, IT Staff reassignment list and ticket numbering

## Lab 4 Documentation

All specification and documentation files are located in `docs/lab-04/`: specification.md, api-spec.md, ui-spec.md, tests.md, reviewer.md and ai-use.md.

## Seeded Test Accounts (local development only)

Password for all seeded users: `Password123!`

| Role | Email | Notes |
|---|---|---|
| Requester | jennifer.anderson@example.com | Tickets in several statuses |
| Requester | michael.brown@example.com, sarah.johnson@example.com, david.lee@example.com | Other requesters (ownership tests) |
| Requester | nina.wong@example.com | No tickets (empty dashboard) |
| Requester | paul.martin@example.com | Must change password at first login |
| Requester | robert.smith@example.com | Inactive (login refused) |
| IT Staff | kevin.patel@example.com, emily.davis@example.com, lisa.martinez@example.com | Owners and assignees of Actions Taken |
| IT Staff | amanda.clark@example.com | Inactive (never offered as assignee) |
| Administrator | john.smith@example.com | Dashboard with user counts, user management |
