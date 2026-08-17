# Gym Management System

## Stack
- **Backend**: Spring Boot 3 (Java 17), Spring Security + JWT, Spring Data JPA, PostgreSQL, Flyway
- **Frontend**: Vite + React + TypeScript + Tailwind CSS, TanStack Query, Zustand, React Router

---

## 1. Prerequisites

Install these once:
- **Java 17** — `java -version` should show 17+
- **Maven** — `mvn -version` (or use the `mvnw` wrapper if you generate one via `mvn -N wrapper:wrapper` — this scaffold assumes a system Maven install)
- **Node.js 18+** and npm — `node -v`
- A free **PostgreSQL** database — sign up at [supabase.com](https://supabase.com) or [neon.tech](https://neon.tech) and create a new project/database. Copy the connection details (host, port, database name, username, password). If you're on Supabase, use the **Session mode connection pooler** string (`aws-0-<region>.pooler.supabase.com`), not the direct `db.<project-ref>.supabase.co` host — the direct host is IPv6-only and will time out on most networks.

---

## 2. Backend setup (Spring Boot)

```bash
cd backend
cp .env.example .env   # then edit .env with your real DB credentials and a JWT secret
```

Spring Boot doesn't read `.env` files natively — the simplest approach for local dev is to
export the variables in your shell before running, or use an IDE run configuration with
environment variables set. Example (macOS/Linux):

```bash
export DB_URL="jdbc:postgresql://<your-host>:5432/<your-db>"
export DB_USERNAME="postgres"
export DB_PASSWORD="your-password"
export JWT_SECRET="a-long-random-string-at-least-32-characters-please"
export OWNER_EMAIL="owner@mygym.com"
export OWNER_PASSWORD="ChangeMe123!"

mvn spring-boot:run
```

On Windows (PowerShell):
```powershell
$env:DB_URL="jdbc:postgresql://<your-host>:5432/<your-db>"
$env:DB_USERNAME="postgres"
$env:DB_PASSWORD="your-password"
$env:JWT_SECRET="a-long-random-string-at-least-32-characters-please"
mvn spring-boot:run
```

On first run:
- **Flyway** creates the schema by running the migration scripts in `src/main/resources/db/migration/` in order. Hibernate's `ddl-auto` is set to `validate` — it checks the schema matches the entities and fails fast at startup if it doesn't, rather than silently altering anything. See [§4 Database Migrations](#4-database-migrations-flyway) below before making any entity change.
- The `DataSeeder` creates your **one master OWNER account** using `OWNER_EMAIL` / `OWNER_PASSWORD`. This is the only way an Owner account is ever created — there's deliberately no public signup for it.

The API should now be running at `http://localhost:8080`.

**Quick check**: `curl http://localhost:8080/api/public/branches` should return `[]` (empty array — you haven't created a branch yet). If you get a connection error, double check your DB credentials.

---

## 3. Frontend setup (React)

```bash
cd frontend
npm install
cp .env.example .env   # defaults to http://localhost:8080, fine for local dev
npm run dev
```

Open `http://localhost:5173`. You should see the landing page.

---

## 4. Database Migrations (Flyway)

Every schema change now goes through a **migration file**, not through editing an entity
and letting Hibernate figure it out. `ddl-auto: validate` means Hibernate will refuse to
start the app if the schema doesn't match your `@Entity` classes — that's intentional, it
turns silent drift (like a stale `CHECK` constraint quietly rejecting valid data months
later) into a loud failure at startup, before any real user hits it.

**When you add or change an entity field**, add a new file to
`backend/src/main/resources/db/migration/`, named `V{next_number}__short_description.sql`
(e.g. `V3__add_products_table.sql`). Flyway runs any un-applied migration, in version
order, every time the app starts — you don't run anything manually.

A few rules of thumb:
- **Never edit an already-applied migration file.** If `V2` already ran against your dev
  database (or worse, production), editing it does nothing there — Flyway tracks which
  versions have run in a `flyway_schema_history` table and won't re-run one it's already
  applied. Write a new `V3` instead, even to fix a mistake in `V2`.
- **Adding a new enum value** (e.g. another `PaymentMode`) needs a migration that drops and
  re-adds the relevant `CHECK` constraint with the new full list of values — see
  `V2__fix_enum_check_constraints.sql` for the pattern (it looks up the constraint name
  dynamically rather than hardcoding it, so it's safe to copy for the next one).
- **Adding a new table** for a new entity is a plain `CREATE TABLE` migration, matching
  the entity's fields (Hibernate's default naming turns `camelCase` fields into
  `snake_case` columns — `createdAt` → `created_at`, etc.).
- If you ever need to wipe and rebuild a local dev database from scratch, Flyway will just
  run every migration from `V1` in order — no baselining needed for a genuinely empty
  database, that only kicks in for a non-empty one with no Flyway history yet (which was
  the one-time situation this project's dev database was in when Flyway was introduced).