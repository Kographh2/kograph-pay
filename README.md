# QRIS Engine — Payment Gateway

> Production payment gateway for Indonesia. A per-account QRIS API on top of Saweria.
> Every user gets their own credentials and their own transaction scope.

Built with **Next.js 14 (App Router)**, **Supabase (PostgreSQL) via `@supabase/supabase-js`**,
**TypeScript**, and [`saweria-createqr`](https://www.npmjs.com/package/saweria-createqr). No n8n, no Prisma.

---

## What this is

Sign up. Get a user id, an API key, and a public key. Start calling:

```
POST /api/v1/payments
```

to create QRIS payments. Show the QR to your customer using the public key.
Saweria posts the webhook. The transaction goes `pending → paid`. You get a
Telegram alert. Nothing about the underlying Saweria account is exposed to
the merchant.

---

## Stack

* Next.js 14, App Router
* Supabase (PostgreSQL) accessed via `@supabase/supabase-js`
* `saweria-createqr` (Saweria)
* bcryptjs password hashing
* jsonwebtoken HttpOnly sessions
* Zod input validation
* Black/white minimal UI (no demo mode)

---

## Install

```bash
git clone <repo>
cd qris-saweria
npm install
cp .env.example .env
```

## Configure `.env`

```env
APP_URL=http://localhost:3000

# Supabase (Project Settings -> API)
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...   # server-only, bypasses RLS — KEEP PRIVATE
SUPABASE_ANON_KEY=eyJhbGc...           # optional, only if you wire browser queries

# The owner-side Saweria account that backs the gateway
SAWERIA_USERNAME=your_username
SAWERIA_EMAIL=your_email
SAWERIA_PASSWORD=your_password

SESSION_SECRET=$(openssl rand -hex 32)

# Optional
TELEGRAM_BOT_TOKEN=...
TELEGRAM_ADMIN_CHAT_ID=...
INITIAL_ADMIN_EMAIL=admin@example.com
INITIAL_ADMIN_PASSWORD=verylongpassword

PAYMENT_PROVIDER=saweria
PAYMENT_EXPIRATION_MINUTES=15
```

## Set up the database

In the Supabase SQL editor, paste the contents of `supabase/schema.sql` and run.
Or from your machine, with the direct (port 5432) connection string:

```bash
SUPABASE_DB_URL="postgres://postgres.PROJECTREF:PASSWORD@db.YOUR_PROJECT_REF.supabase.co:5432/postgres" npm run db:setup
```

## Run

```bash
npm run dev
```

On startup, if `INITIAL_ADMIN_EMAIL`/`INITIAL_ADMIN_PASSWORD` are set and no
admin exists, the first admin is created automatically.

## Roles

| Role  | What they can do                                                    |
| ----- | ------------------------------------------------------------------- |
| USER  | Manage their own API key, see their own transactions, call the API. |
| ADMIN | See all users, all transactions, all webhook events. Configure.      |

`/admin` is invisible and inaccessible to USER accounts.

## Per-account credentials

Every account gets a triplet, all visible on `/dashboard`:

| Field        | Where it goes                                  |
| ------------ | ---------------------------------------------- |
| `ID-USERS`   | `X-User-Id` header on every API call           |
| `APIKEY`     | `Authorization: Bearer …` on every API call. Server-side only. |
| `PUBLIC-KEY` | `X-Public-Key` header / `?pk=` for the `/pay/:id` page and the QR endpoint. Safe to embed in browser HTML. |

The dashboard page never displays `APIKEY` after it is generated — rotate
to get a new one.

## API at a glance

| Method | Path                                       | Auth     | Purpose                |
| ------ | ------------------------------------------ | -------- | ---------------------- |
| POST   | `/api/v1/payments`                         | api+user | Create payment + QR    |
| GET    | `/api/v1/payments/:transactionId`          | api+user | Status                 |
| GET    | `/api/v1/payments/:transactionId/qr`       | public   | PNG QR                 |
| GET    | `/api/v1/payments/reference/:referenceId`  | api+user | Lookup by your id      |
| GET    | `/api/v1/public/payments/:transactionId`   | public   | Status (browser-safe)  |
| POST   | `/api/v1/webhooks/saweria`                 | none     | Saweria webhook        |
| GET    | `/api/v1/health`                           | none     | Health probe           |
| GET    | `/api/v1/me`                               | session  | Current user           |
| POST   | `/api/v1/me/api-key`                       | session  | Mint/rotate API key    |
| DELETE | `/api/v1/me/api-key`                       | session  | Revoke API key         |
| GET    | `/api/v1/admin/users`                      | session  | List users (admin)     |
| GET    | `/api/v1/admin/transactions`               | session  | All transactions       |
| GET    | `/api/v1/admin/webhooks`                   | session  | Webhook events         |

Full spec: `/openapi.yaml`.

## Webhooks

Saweria's donation event is matched by `payload.id` →
`providerTransactionId`. Amount is validated. Duplicates deduped by
`(provider, eventId)`. The webhook also fires Telegram if configured.

## Local development without Saweria

Set `PAYMENT_PROVIDER=mock` in `.env`. A `MockProvider` issues mock
transactions and accepts matching webhook payloads end-to-end.

## Scripts

```bash
npm run dev          # next dev
npm run build        # next build
npm start            # next start
npm run lint         # next lint
npm run typecheck    # tsc --noEmit
npm run test         # node test runner
npm run db:setup     # apply supabase/schema.sql via direct connection
```