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