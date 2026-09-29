# TokTickIT

TokTickIT is an IT service desk application. Lab 1 delivers a full-stack vertical slice: React (Vite + Bootstrap) frontend, Express (TypeScript) backend, and PostgreSQL via Prisma.

## Tech Stack

- Frontend: React + TypeScript + Vite + Bootstrap
- Backend: Node.js + Express + TypeScript
- Database: PostgreSQL + Prisma
- Testing: Vitest (frontend) + Supertest (backend)

## Prerequisites

- Node.js
- PostgreSQL (running locally, database named `toktickit`)

## Setup

### 1. Backend

```bash
cd server
npm install
copy .env.example .env   # then set your DATABASE_URL
npm run dev
```

Backend runs on `http://localhost:3000`.

### 2. Frontend

```bash
cd client
npm install
npm run dev
```

Frontend runs on `http://localhost:5173`.

## Running Tests

```bash
cd server
npm test

cd client
npm test
```
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
* api-spec.m – REST API endpoints for authentication, IT Staff, and Administrator features
* ui-spec.md – UI specifications for all Lab 3 screens
* tests.md – Test plan with traceability (66 automated backend tests)
* ai-use.md – AI usage log
* reviewer.md – Peer review log for PRs #21–#40

## Seeded Test Accounts (local development only)

Password for all seeded users: `Password123!`

* Requester: jennifer.anderson@example.com
* IT Staff: kevin.patel@example.com
* Administrator: john.smith@example.com
