# Wallet API

NestJS + Prisma service that backs the wallet admin dashboard. It exposes auth, wallet, and analytics features over a PostgreSQL database shared with the rest of the monorepo.

## Requirements

- Node.js 20+
- PostgreSQL (local via Docker Compose or any external instance)
- `.env.local` / `.env.production` with:
  - `DATABASE_URL` (Prisma connection string)
  - `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_HOST`, `POSTGRES_PORT`
  - `JWT_SECRET` (signing secret) and `JWT_EXPIRES_IN` (token TTL, e.g. `1h`)

## Commands

Run these from the repository root so the shared env files load automatically:

| Command | Purpose |
| --- | --- |
| `pnpm --filter api start:dev` | Start Nest in watch mode with `.env.local`. |
| `pnpm --filter api build` | Generate Prisma Client then compile Nest to `dist`. |
| `pnpm --filter api migrate:dev -- --name <label>` | Create/apply a Prisma migration locally. |
| `pnpm --filter api migrate:deploy` | Apply migrations in production/CI. |
| `pnpm --filter api prisma:generate` | Regenerate Prisma Client from `schema.prisma`. |
| `pnpm --filter api test` | Run Jest unit tests. |

## Prisma schema

`apps/api/prisma/schema.prisma` defines the following models:

- **User** – Reviewer identity with `email`, optional `name`, and timestamps.  
- **Wallet** – Belongs to a user, defaults to currency `IDR`, stores a decimal `balance`, and keeps incoming/outgoing transaction relations.  
- **Transaction** – Uses the `TransactionType` enum (`DEPOSIT`, `TRANSFER`) to track movements plus optional `fromWallet` / `toWallet` links for analytics queries. Indexes cover common filters (user/date, amount).

After editing the schema, run `pnpm --filter api migrate:dev -- --name <label>` locally (with `.env.local`) and commit both the migration folder under `apps/api/prisma/migrations` and the updated generated client.

## API access & CORS

`apps/api/src/main.ts` enables CORS automatically based on the `CORS_ORIGINS` env var (comma-separated). Update `.env.local` and `.env.production` with the allowed origins (e.g., `http://localhost:5173` for Vite dev, `https://wc.example.com` for production). The admin web uses `VITE_API_BASE_URL` env vars to target the correct host and relies on this CORS configuration to succeed.

## Auth & wallets

- `POST /auth/register` hashes the password with Argon2, creates a default IDR wallet, and returns the JWT plus wallet metadata.
- `POST /auth/login` validates the credentials and issues a JWT signed by `JWT_SECRET`.
- `GET /wallets/me` is guarded by `JwtAuthGuard` and returns the wallets connected to the authenticated user.
- `POST /wallets/:id/deposit` validates ownership + positive amounts, updates balances inside a Prisma transaction, and returns the updated wallet plus the new transaction row.
- `GET /wallets/:id/transactions?limit=` returns the recent transactions for a wallet that belongs to the current user. Limit defaults to 20 and caps at 100.

The Jest suite includes e2e-style specs (`src/auth/auth.controller.spec.ts`) that override Prisma with an in-memory adapter, so no local Postgres setup is needed to validate auth flows.

## Development flow

1. Copy `.env.local` and update the Postgres credentials if needed.  
2. `pnpm install` at the repo root.  
3. `pnpm dev:api` (from the root `package.json`) launches the Nest server with Prisma hot reload.  
4. Use the provided scripts above to keep migrations and generated types aligned before opening pull requests or tagging releases.
