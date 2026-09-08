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
- **Flyway** creates the schema by running the migration scripts in `src/main/resources/db/migration/` in order. Hibernate's `ddl-auto` is set to `validate` — it checks the schema matches the entities and fails fast at startup if it doesn't, rather than silently altering anything. See [§5 Database Migrations](#5-database-migrations-flyway) below before making any entity change.
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

## 4. HTTPS for local mobile testing (mkcert)

Camera access (`getUserMedia`, used by the QR attendance scanner) only works in a
**secure context** — `https://` or `localhost`. Plain `http://<your-laptop-LAN-IP>:5173`
on a phone will silently fail to open the camera (or only trigger the flash/indicator
with no video). [mkcert](https://github.com/FiloSottile/mkcert) generates a locally-
trusted certificate so you can serve the frontend over HTTPS on both your laptop and
your phone, with no browser security warnings once the phone trusts the cert.

You only need this if you're testing a feature that needs camera/microphone access
(currently: the QR scanner in the Attendance tab) from a phone on your LAN. Everything
else works fine over plain HTTP.

### 4.1 Install mkcert

**macOS:**
```bash
brew install mkcert
brew install nss   # only needed if you also test in Firefox
```

**Windows (PowerShell, via Chocolatey):**
```powershell
choco install mkcert
```

**Linux:**
```bash
sudo apt install libnss3-tools
curl -JLO "https://dl.filippo.io/mkcert/latest?for=linux/amd64"
chmod +x mkcert-v*-linux-amd64
sudo mv mkcert-v*-linux-amd64 /usr/local/bin/mkcert
```

### 4.2 Install the local CA and generate a certificate

Run once, from `frontend/`:

```bash
cd frontend
mkcert -install
```

This installs a root CA into your OS/browser trust store on the laptop — no warnings
there afterward. Now generate a cert covering `localhost` and your laptop's LAN IP
(find it via `ipconfig` on Windows or `ifconfig` / `ip a` on macOS/Linux — e.g.
`192.168.1.50`):

```bash
mkdir -p .cert
mkcert -key-file .cert/key.pem -cert-file .cert/cert.pem localhost 127.0.0.1 <your-lan-ip>
```

`frontend/.gitignore` already excludes `.cert/`, so the private key never gets
committed.

> If your LAN IP changes later (different WiFi, DHCP renewal), regenerate the cert with
> the new IP and repeat this command — the old cert won't cover the new address.

### 4.3 Run with HTTPS

`vite.config.ts` automatically serves over HTTPS once `.cert/cert.pem` and
`.cert/key.pem` exist — no flags needed:

```bash
npm run dev
```

Backend: allow the HTTPS origin(s) via `CORS_ORIGIN` (comma-separated), including your
LAN IP so your phone's requests are accepted too:

```bash
export CORS_ORIGIN="https://localhost:5173,https://<your-lan-ip>:5173"
mvn spring-boot:run
```

Frontend: point `VITE_API_URL` (in `frontend/.env`) at the backend's LAN address so
your phone can reach it — this stays plain HTTP, only the frontend origin needs HTTPS
for camera access:

```
VITE_API_URL=http://<your-lan-ip>:8080
```

### 4.4 Trust the certificate on your phone

The laptop already trusts mkcert's CA (step 4.2 did that). Your phone needs the same
root CA installed once:

1. On your laptop, run `mkcert -CAROOT` to find the folder containing `rootCA.pem`.
2. Get that file onto your phone — AirDrop, email it to yourself, or briefly serve the
   folder with `python3 -m http.server` and download it from the phone's browser.
3. **iOS**: Settings → General → VPN & Device Management → install the downloaded
   profile, then Settings → General → About → Certificate Trust Settings → enable full
   trust for the mkcert root.
4. **Android**: Settings → Security → Encryption & credentials → Install a certificate
   → CA certificate → select the file (exact path varies by Android version/OEM).

### 4.5 Test it

- Laptop: `https://localhost:5173`
- Phone (same WiFi as the laptop): `https://<your-lan-ip>:5173`

Both should show a padlock with no warnings, and the QR scanner's camera permission
prompt should work on both.

---

## 5. Database Migrations (Flyway)

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