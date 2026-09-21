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

### HTTPS also covers the backend

The frontend's mkcert cert (`frontend/.cert/`) is reused for the backend too, so both
run on HTTPS together locally and mobile browsers don't hit "Mixed Content" errors
calling the API. Set `SSL_ENABLED=true` and point `VITE_API_URL` at `https://` when you
need this (e.g. testing QR camera scan on a phone); leave `SSL_ENABLED=false` for normal
HTTP-only local dev.

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

---

## 6. Image storage (profile photos & signatures)

Images are stored in an **S3-compatible object store**, not in Postgres. The database holds
only an object *key* (e.g. `avatars/3f2c….jpg`); the API turns it into a URL using
`STORAGE_PUBLIC_BASE_URL`. Because no URL is ever stored, changing provider or domain needs
**no database migration**.

The same code talks to MinIO, Cloudflare R2, AWS S3, Supabase Storage and Backblaze B2 - only
environment variables differ.

### 6.1 Environment variables (backend)

| Variable                                                 | Meaning                                                                                                                                                   |
|----------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------|
| `STORAGE_PROVIDER`                                       | `s3` (default). Other values need a new `StorageService` implementation ([§6.5 Adding a non-S3 provider](#65-adding-a-non-s3-provider-eg-cloudinary-gcs)) |
| `STORAGE_S3_ENDPOINT`                                    | S3 API endpoint the **backend** talks to. Blank for real AWS S3                                                                                           |
| `STORAGE_S3_REGION`                                      | Region (`auto` for R2)                                                                                                                                    |
| `STORAGE_S3_BUCKET`                                      | Bucket name                                                                                                                                               |
| `STORAGE_S3_ACCESS_KEY` / `STORAGE_S3_SECRET_KEY`        | Credentials with read/write on the bucket                                                                                                                 |
| `STORAGE_S3_PATH_STYLE`                                  | `true` for MinIO/Supabase, `false` for AWS S3/R2                                                                                                          |
| `STORAGE_PUBLIC_BASE_URL`                                | Base URL **browsers** use to load images. Absolute URL, or `/media` in local dev                                                                          |
| `STORAGE_MIGRATE_LEGACY`                                 | `true` for one startup to convert old base64 photos, then back to `false`                                                                                 |
| `STORAGE_CLEANUP_ENABLED`                                | `true` (default). Daily job deleting stored images no user references                                                                                     |
| `STORAGE_CLEANUP_CRON` / `STORAGE_CLEANUP_MIN_AGE_HOURS` | Schedule (default 3:30 AM) / minimum object age before it's eligible (default 24)                                                                         |
| `STORAGE_CLEANUP_MAX_DELETE`                             | Safety brake: abort if more than this many orphans are found (default 200)                                                                                |
| `STORAGE_CLEANUP_DRY_RUN`                                | `true` = log only, delete nothing                                                                                                                         |

The endpoint (backend → storage) and the public base URL (browser → storage) are deliberately
separate settings - they are usually different addresses.

### 6.2 Local development with MinIO

MinIO's Docker Hub images were removed and its community edition is archived, so use the
`quay.io/minio/*` images (already set in `docker-compose.yml`). Dev use only - never expose it.

```bash
docker compose up -d          # starts MinIO, creates the public bucket `gym-media`
```

Console: http://localhost:9001 (`minioadmin` / `minioadmin`). Backend variables:

```bash
export STORAGE_S3_ENDPOINT=http://localhost:9000
export STORAGE_S3_REGION=us-east-1
export STORAGE_S3_BUCKET=gym-media
export STORAGE_S3_ACCESS_KEY=minioadmin
export STORAGE_S3_SECRET_KEY=minioadmin
export STORAGE_S3_PATH_STYLE=true
export STORAGE_PUBLIC_BASE_URL=/media
```

`vite.config.ts` proxies `/media/*` to MinIO, so images load over the same HTTPS origin as
the app - no mixed-content errors on your phone ([§4](#4-https-for-local-mobile-testing-mkcert)) and no extra certificates. Because the
base URL is relative, it works from `localhost` and your LAN IP without changes.

**Alternative - MinIO over HTTPS directly:** mount the mkcert files as `/certs/public.crt` and
`/certs/private.key`, start MinIO with `--certs-dir /certs`, set
`STORAGE_S3_ENDPOINT=https://localhost:9000` and
`STORAGE_PUBLIC_BASE_URL=https://<lan-ip>:9000/gym-media`, and make the JVM trust the mkcert
root CA (run `mkcert -install` with `JAVA_HOME` set, or import `rootCA.pem` into the JDK's
`cacerts` with `keytool`). 

```bash
keytool -importcert -trustcacerts -alias mkcert-local -file "$(mkcert -CAROOT)/rootCA.pem" -keystore "$JAVA_HOME/lib/security/cacerts" -storepass changeit -noprompt
```
Do not replace the whole truststore via `-Djavax.net.ssl.trustStore`, that breaks Gmail SMTP and Turnstile.

### 6.3 Production providers

The bucket must allow **public read** (objects have unguessable UUID names) and, because the
invoice PDF fetches the signature image from the browser, a **CORS rule allowing `GET`** from
your frontend origin(s).

**Cloudflare R2** (recommended: generous free tier, no egress fees; may ask for a card)
1. R2 → *Create bucket*.
2. Bucket → *Settings* → *Public access*: attach a **custom domain** (e.g.
   `media.yourdomain.com`). The `r2.dev` subdomain is rate-limited and meant for testing only.
3. R2 → *Manage API tokens* → create a token with *Object Read & Write* scoped to the bucket;
   copy the Access Key ID and Secret.
4. Bucket → *Settings* → *CORS policy*:
```json
   [{
     "AllowedOrigins": ["https://your-app.netlify.app", "https://localhost:5173"],
     "AllowedMethods": ["GET"],
     "AllowedHeaders": ["*"],
     "MaxAgeSeconds": 3600
   }]
```
5. Set on the backend host (e.g. Render):
```
   STORAGE_S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
   STORAGE_S3_REGION=auto
   STORAGE_S3_BUCKET=<bucket>
   STORAGE_S3_ACCESS_KEY=<key>
   STORAGE_S3_SECRET_KEY=<secret>
   STORAGE_S3_PATH_STYLE=false
   STORAGE_PUBLIC_BASE_URL=https://media.yourdomain.com
```

**Supabase Storage** (1 GB free): Storage → create a **public** bucket → *S3 Connection* →
enable it and create S3 access keys. Use the endpoint and region shown there, `PATH_STYLE=true`,
and `STORAGE_PUBLIC_BASE_URL=https://<project-ref>.supabase.co/storage/v1/object/public/<bucket>`.

**AWS S3**: create a bucket, turn off "Block public access" for it, add a bucket policy
allowing `s3:GetObject` on `arn:aws:s3:::<bucket>/*` to `*`, add a CORS rule, and create an IAM
user limited to that bucket. Leave `STORAGE_S3_ENDPOINT` blank, set the bucket's region,
`PATH_STYLE=false`, and `STORAGE_PUBLIC_BASE_URL` to the bucket URL (or a CloudFront domain).

### 6.4 Switching provider later (checklist)

Existing objects are addressed by key, so switching means copying the objects and changing env
vars. Nothing in the database changes.

1. **Create** the new bucket (public read + CORS, see [§6.3](#63-production-providers)) and credentials.
2. **Copy** existing objects with the same keys, e.g. with [rclone](https://rclone.org):
```bash
   # ~/.config/rclone/rclone.conf defines two remotes, `old` and `new` (type = s3, with
   # provider/endpoint/keys for each)
   rclone sync old:gym-media new:gym-media --progress
```
3. **Deploy** the new `STORAGE_*` variables and restart the backend.
4. **Verify**: open a profile with a photo, upload a new one, then view an invoice PDF that has
   a signature.
5. **Keep the old bucket** for a few days as a rollback (rollback = restore the old env vars),
   then delete it.

Uploads made during the switch land in whichever bucket was active. Do step 2 again right
before the cut-over, or briefly put the app in maintenance.

### 6.5 Adding a non-S3 provider (e.g. Cloudinary, GCS)

Implement `com.gymapp.storage.StorageService` (`put`, `delete`, `publicUrl`, `keyFromUrl`) as a
new `@Component` annotated with
`@ConditionalOnProperty(name = "app.storage.provider", havingValue = "<name>")`, then set
`STORAGE_PROVIDER=<name>`. Services and controllers only depend on the interface. Providers
that generate their own IDs (Cloudinary) should use our key as their public ID so the stored
keys stay valid.

### 6.6 Migrating old base64 images

Back up the database, set `STORAGE_MIGRATE_LEGACY=true`, start the backend once, watch the log
for `Legacy image migration done`, then set it back to `false`. Un-migrated rows keep
displaying in the meantime.

### 6.7 Troubleshooting

| Symptom                                                   | Cause / fix                                                                                                                   |
|-----------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------|
| `pull access denied for minio/minio`                      | Image removed from Docker Hub - use `quay.io/minio/minio`                                                                     |
| Upload returns 500 / `PKIX path building failed`          | JVM doesn't trust the HTTPS certificate of the endpoint (MinIO-over-HTTPS only; see [§6.2](#62-local-development-with-minio)) |
| Upload works but image shows broken                       | `STORAGE_PUBLIC_BASE_URL` wrong, or bucket isn't public-read                                                                  |
| Images blocked on phone                                   | `http://` image on an `https://` page - use the Vite `/media` proxy or HTTPS                                                  |
| Invoice PDF has no signature                              | Bucket CORS doesn't allow `GET` from the frontend origin                                                                      |
| `403 SignatureDoesNotMatch` / `InvalidArgument` on upload | Wrong `PATH_STYLE`, region, or credentials for this provider                                                                  |

### 6.8 Orphaned image cleanup

An image is uploaded the moment it's picked, before the form is saved, so abandoning the form
leaves an unreferenced object in the bucket. `OrphanImageCleanupJob` deletes these daily: it
compares the objects under `avatars/` and `signatures/` with `users.photo`/`users.signature`
and removes unreferenced ones older than `STORAGE_CLEANUP_MIN_AGE_HOURS`.

- Run it with `STORAGE_CLEANUP_DRY_RUN=true` once in a new environment and check the log first.
- **Never share one bucket between two environments' databases** (e.g. dev DB + prod bucket) -
  each would treat the other's images as orphans. Use one bucket per environment.
- The bucket credentials need list permission (`s3:ListBucket` on AWS).
- A form left open longer than the age threshold and saved afterwards would reference a
  deleted image - keep the threshold well above how long an edit dialog stays open.