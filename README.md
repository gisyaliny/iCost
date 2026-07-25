# 💰 iCost - Premium Family Expense Tracker

iCost is a powerful, self-hosted family expense tracking application designed for visual clarity, ease of use, and complete privacy. Built specifically for **CasaOS** and other Docker environments, it helps you manage family finances with ease.

![image](https://images.unsplash.com/photo-1554224155-6726b3ff858f?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80)

## ✨ Features

### 🏦 Transaction Management
- **Smart Dashboard**: Filter-aware income, expense, and net cash-flow summaries shared with Analysis.
- **Accounts & Transfers**: Track checking, savings, cash, cards, investments, opening balances, and transfers without treating transfers as income or expense.
- **Advanced Pagination**: Efficiently view historical data with "Show All" or Top 100 modes.
- **Inline Editing**: Zap through adjustments with lightning-fast inline description, amount, and category updates.
- **Bulk Actions**: Multi-select transactions for batch deletion or category reorganization.
- **Searchable Notes**: Add detailed notes to transactions and search across both notes and descriptions.

### 🔄 Recurring Transactions
- **Real Schedules**: Daily, weekly, monthly, and yearly schedules post transactions only when they become due instead of filling the database with future records.
- **Custom End Dates**: Set a termination date for your subscriptions or lease payments.
- **Schedule Management**: View, edit, pause, resume, and delete recurring schedules from the Recurring module.
- **Background Generation**: A lightweight container worker checks due schedules independently from page requests; generated history is loaded only when opened.

### 📂 Smart Statement Import
- **CSV, OFX & QFX**: Import common bank exports with a complete review step.
- **Dynamic Mapping**: Detects combined amount or separate debit/credit CSV columns.
- **Duplicate Protection**: Intelligent duplicate detection ensures your records stay clean even after multiple imports.
- **Review Inbox**: Imported records remain visibly pending until you approve them.
- **Auto-categorization Rules**: Match descriptions by contains, starts-with, or exact rules during import.
- **Saved Bank Profiles**: Map CSV columns once and reuse the mapping for later exports from the same bank.
- **Correction-to-Rule Workflow**: Categorize a preview row and turn that correction into a reusable rule before importing.
- **NAS Inbox**: Scan a mounted folder, preview statements, and use file hashes plus transaction IDs to prevent repeat imports.

### 📊 Deep Analytics
- **Visual Trends**: Weekly, Monthly, and Daily charts for Income vs. Expenses.
- **Category Breakdown**: Dynamic pie charts showing where your money actually goes.
- **Filterable Insights**: Drill down into specific categories or date ranges.

### 🏠 Property & Category Management
- **Property Tracking**: Tag transactions to specific real estate or rental properties.
- **Custom Categories**: Unlimited custom categories with rich icons and colors.
- **Unified Profile**: Manage all global settings from a single, premium Profile menu in the header.

### 📌 Project Tracking
- **Custom Projects**: Group related transactions into projects such as a home move, renovation, or trip.
- **Bulk Assignment**: Assign multiple existing transactions to a project at once.
- **Project Cost Summary**: Compare project expenses, income, transaction counts, and net cost for any filtered period.
- **Budgets & Dates**: Give each project an optional budget and start/end dates.

### 💾 Data Reliability
- **Versioned SQLite Migrations**: Container startup applies checked-in Prisma migrations and aborts safely if a migration fails.
- **Automatic Native Backups**: A timestamped SQLite backup is created before every container migration; the latest 14 are retained.
- **Manual JSON Export**: Download a user-scoped portable backup from the profile menu.
- **Database-backed Preferences**: Monthly budget, currency, number format, and timezone follow you across browsers.
- **Exact Money Storage**: Monetary values are persisted as integer cents rather than floating-point values.
- **Responsive Navigation**: Transactions, Projects, Recurring, and Analysis remain accessible from the mobile bottom navigation.

## 🛠 Technology Stack

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router & Server Actions)
- **Database**: [SQLite](https://sqlite.org/) (via [Prisma ORM](https://www.prisma.io/))
- **Auth**: [NextAuth.js](https://next-auth.js.org/)
- **UI Components**: [Shadcn UI](https://ui.shadcn.com/) / [Radix UI](https://www.radix-ui.com/)
- **Charts**: [Recharts](https://recharts.org/)
- **Deployment**: [Docker](https://www.docker.com/) / [CasaOS](https://casaos.io/)

---

## 🟢 UGREEN DH4300 / UGOS Pro Deployment

The following procedure is the same SSH and Docker Compose workflow used for the
working DH4300 Plus deployment. It has been verified on the NAS's native
`aarch64`/ARM64 Docker environment with iCost exposed on host port `3001`.

The examples deliberately use placeholders. Never commit the NAS password,
`NEXTAUTH_SECRET`, or the production `.env` file.

### 1. Deployment layout

The final NAS layout is:

```text
/volume1/docker/icost/
├── app/                       # Application source, Dockerfile and Compose file
├── database/
│   ├── db.sqlite              # Live persistent SQLite database
│   └── backups/               # Automatic pre-migration backups
└── imports/                   # CSV, OFX and QFX inbox
```

The corresponding container mounts are:

| NAS path | Container path | Purpose |
| :--- | :--- | :--- |
| `/volume1/docker/icost/database` | `/app/database` | SQLite and native backups |
| `/volume1/docker/icost/imports` | `/app/imports` | NAS statement inbox |

If the Docker share is mapped to `U:\` on Windows, remember that `U:\` is only
the SMB/Windows view. SSH commands must use the NAS Linux path, normally
`/volume1/docker`.

### 2. NAS prerequisites

1. Install **Docker** from the UGOS Pro App Center.
2. Enable SSH in **Control Panel → Terminal**.
3. Connect the PC and NAS to the same Tailscale network. Router port forwarding
   is not needed.
4. Confirm SSH, CPU architecture, Compose, and the storage path:

```bash
ssh -p 22 <NAS_USER>@<NAS_TAILSCALE_IP>
uname -m
sudo docker compose version
ls -ld /volume1/docker
```

Expected architecture output is `aarch64`. On UGOS, a normal account may need
`sudo` for every Docker command because it cannot access the Docker socket
directly.

Create the persistent directories:

```bash
sudo mkdir -p \
  /volume1/docker/icost/app \
  /volume1/docker/icost/database \
  /volume1/docker/icost/imports
sudo chown -R "$USER":admin /volume1/docker/icost
```

### 3. Transfer the application

#### Option A: clone from GitHub

Use this when the NAS can access GitHub and the desired changes have already
been pushed:

```bash
cd /volume1/docker/icost
git clone https://github.com/gisyaliny/iCost.git app
```

#### Option B: transfer the current local working copy

This is the method used for the verified deployment because it also includes
local changes that have not been pushed. From PowerShell in the repository
root, create a clean source archive:

```powershell
$archive = Join-Path $env:TEMP "icost-app.tgz"
tar `
  --exclude=.git `
  --exclude=.next `
  --exclude=node_modules `
  --exclude=.env `
  --exclude=prisma/dev.db `
  --exclude=prisma/dev.db-wal `
  --exclude=prisma/dev.db-shm `
  --exclude=prisma/backups `
  --exclude=database `
  --exclude=imports `
  -czf $archive .
```

Upload to the SSH user's home folder, then extract it into the Docker share:

```powershell
scp -P 22 $archive <NAS_USER>@<NAS_TAILSCALE_IP>:~/
ssh -p 22 <NAS_USER>@<NAS_TAILSCALE_IP>
```

```bash
tar -xzf ~/icost-app.tgz -C /volume1/docker/icost/app
rm -f ~/icost-app.tgz
```

UGOS may reject SCP/SFTP writes directly to an absolute `/volume1/...` path
even when the user can write there from an SSH shell. Uploading to `~/` first
and then moving or extracting the file avoids that restriction.

### 4. Migrate an existing local SQLite database

Skip this step for a completely new installation.

First stop the local development server so SQLite is not being written while it
is copied. Confirm that `prisma/dev.db-wal` and `prisma/dev.db-shm` are absent.
If they exist, shut down the process cleanly before continuing.

Create and compare checksums on Windows:

```powershell
Copy-Item .\prisma\dev.db .\icost-db.sqlite
Get-FileHash .\icost-db.sqlite -Algorithm SHA256
scp -P 22 .\icost-db.sqlite <NAS_USER>@<NAS_TAILSCALE_IP>:~/
```

Move the database into persistent storage on the NAS:

```bash
cp ~/icost-db.sqlite /volume1/docker/icost/database/db.sqlite
sha256sum /volume1/docker/icost/database/db.sqlite
rm -f ~/icost-db.sqlite
```

The Windows and NAS SHA-256 values must match. Do not start the container if
they differ.

On startup, iCost:

1. creates a timestamped native SQLite backup;
2. recognizes and baselines databases created before versioned migrations;
3. runs `prisma migrate deploy`;
4. initializes missing default data without replacing existing users or
   transactions.

### 5. Create the production environment

On the NAS:

```bash
cd /volume1/docker/icost/app
cp .env.nas.example .env
openssl rand -base64 48
```

Copy the generated value into `.env`, and configure the Tailscale address and
host paths:

```env
NEXTAUTH_SECRET="paste-a-new-random-value-here"
NEXTAUTH_URL="http://<NAS_TAILSCALE_IP>:3001"
ICOST_PORT="3001"
ICOST_DATABASE_DIR="/volume1/docker/icost/database"
ICOST_IMPORT_DIR="/volume1/docker/icost/imports"
RECURRING_POLL_INTERVAL_MS="60000"
TZ="America/New_York"
```

Protect the file:

```bash
chmod 600 /volume1/docker/icost/app/.env
```

`NEXTAUTH_URL` must match the URL normally used in the browser. A Tailscale
MagicDNS hostname can be used instead of the IP if it is enabled and stable.
Changing `NEXTAUTH_SECRET` later invalidates existing login sessions.

### 6. Set container permissions

The production image runs as the unprivileged `nextjs` user with UID/GID
`1001`. The database directory must be writable by that identity:

```bash
sudo chown -R 1001:1001 /volume1/docker/icost/database
sudo chmod -R u+rwX,go-rwx /volume1/docker/icost/database
sudo chmod -R a+rX /volume1/docker/icost/imports
```

If the NAS inbox should move or rename imported files in a future release,
assign UID 1001 write access to `imports` as well.

### 7. Validate, build, and start

Validate Compose without printing the resolved configuration, which contains
the secret:

```bash
cd /volume1/docker/icost/app
sudo docker compose config --quiet
```

Build the image natively on ARM64:

```bash
sudo docker compose build --pull
sudo docker compose up -d
```

The first build downloads the Node Bookworm ARM64 image, installs dependencies,
generates the Prisma client, and runs a production Next.js build. Several
minutes on the first run is normal. Subsequent builds reuse Docker layers.

### 8. Verify the deployment

Check container and health status:

```bash
sudo docker compose ps
sudo docker inspect icost-app \
  --format 'status={{.State.Status}} health={{.State.Health.Status}} restarts={{.RestartCount}}'
```

Expected result:

```text
status=running health=healthy restarts=0
```

Inspect startup logs:

```bash
sudo docker compose logs --tail=150 icost
```

Healthy logs include:

```text
Database migrations applied successfully.
Default data is ready.
Recurring worker checking every 60 seconds.
Ready
```

Test from the NAS:

```bash
curl -fsS -o /dev/null -w 'HTTP %{http_code}\n' \
  http://127.0.0.1:3001/login
```

Then test from a Tailscale-connected computer:

```powershell
Invoke-WebRequest `
  -UseBasicParsing `
  -Uri "http://<NAS_TAILSCALE_IP>:3001/login"
```

Open `http://<NAS_TAILSCALE_IP>:3001` in the browser. When an existing database
was copied, use its existing iCost account. A default admin is created only
when the database contains no users.

### 9. Routine updates

Before updating, ensure a recent file exists under
`/volume1/docker/icost/database/backups`. Then:

```bash
cd /volume1/docker/icost/app
sudo docker compose stop icost
git pull --ff-only                 # omit when deploying a local archive
sudo docker compose build --pull
sudo docker compose up -d --force-recreate
sudo docker compose ps
sudo docker compose logs --tail=100 icost
```

For an archive-based update, replace only the source under `app`. Never replace
the persistent `database` or `imports` directories. Keep the existing `.env`
unless a new required variable was added.

### 10. Backup and restore

Each container startup creates a pre-migration SQLite backup under:

```text
/volume1/docker/icost/database/backups/
```

The newest 14 automatic backups are retained. For an additional NAS-level
backup, stop the service or use SQLite's online backup command:

```bash
sudo sqlite3 /volume1/docker/icost/database/db.sqlite \
  ".backup '/volume1/docker/icost/database/manual-backup.db'"
```

To restore:

```bash
cd /volume1/docker/icost/app
sudo docker compose stop icost
cd /volume1/docker/icost/database
sudo cp db.sqlite db.sqlite.before-restore
sudo cp backups/icost-YYYY-MM-DDTHH-MM-SS-sssZ.db db.sqlite
sudo rm -f db.sqlite-wal db.sqlite-shm
sudo chown 1001:1001 db.sqlite
cd /volume1/docker/icost/app
sudo docker compose up -d icost
sudo docker compose ps
```

Do not delete `db.sqlite.before-restore` until the restored application and
record counts have been verified.

### 11. UGREEN-specific troubleshooting

#### Port 3001 is already in use

```bash
sudo docker ps --format 'table {{.Names}}\t{{.Ports}}'
sudo ss -lntp | grep ':3001'
```

Stop the conflicting service or change `ICOST_PORT` in `.env`, then update
`NEXTAUTH_URL` to the same port and recreate the container.

#### Container repeatedly restarts

```bash
sudo docker compose ps
sudo docker compose logs --tail=200 icost
```

Common causes:

- `EACCES` under `/app/database`: apply the UID 1001 ownership commands from
  step 6.
- Prisma schema or runtime module errors: rebuild from the current Dockerfile
  with `sudo docker compose build --no-cache`.
- invalid `NEXTAUTH_SECRET`/`NEXTAUTH_URL`: correct `.env` and recreate the
  container.
- corrupt or incomplete SQLite copy: stop the container and restore a verified
  native backup.

#### Tailscale works but the browser cannot connect

Verify the service locally with `curl http://127.0.0.1:3001/login`, then check
the NAS firewall. Compose currently publishes `3001` on all NAS interfaces, so
the app may also be reachable from the LAN unless the UGOS firewall restricts
it. No router port-forwarding rule is required or recommended.

#### Useful maintenance commands

```bash
cd /volume1/docker/icost/app
sudo docker compose ps
sudo docker compose logs -f icost
sudo docker compose restart icost
sudo docker compose stop icost
sudo docker compose up -d icost
```

## 🚀 Comprehensive Installation on CasaOS

iCost is optimized for **CasaOS** and other home server environments. Follow this detailed guide to set up your personal finance tracker.

### Prerequisites
- A running instance of **CasaOS**.
- External access configured (optional, if you want to access iCost outside your home).

### Step 1: Open Custom Install
1. log in to your **CasaOS Dashboard**.
2. Click the **App Store** icon.
3. In the top-right corner, click **Custom Install**.

### Step 2: Import Docker Compose
1. Click the **Import** button in the top-right of the Install window.
2. Copy and paste the following configuration:

```yaml
version: '3.9'
services:
  icost:
    image: gisyaliny/icost:latest
    container_name: icost-app
    restart: unless-stopped
    network_mode: bridge
    ports:
      - "3001:3000"
    environment:
      - DATABASE_URL=file:/app/database/db.sqlite
      - NEXTAUTH_SECRET=generate_a_random_string_here
      - NEXTAUTH_URL=http://YOUR_SERVER_IP:3001
      - IMPORT_INBOX_DIR=/app/imports
    volumes:
      - /DATA/AppData/icost/database:/app/database
      - /DATA/AppData/icost/imports:/app/imports
```

### Step 3: Configure Environment Variables
Before clicking Install, ensure you customize these key fields:

| Variable | Description | Recommendation |
| :--- | :--- | :--- |
| **NEXTAUTH_SECRET** | Used to encrypt your session cookies. | Replace with a long random string (e.g., `openssl rand -base64 32`). |
| **NEXTAUTH_URL** | The public URL of your app. | Use `http://<YOUR_CASAOS_IP>:3001`. |
| **Port** | The port used to access the app. | Default is `3001`. Change if it conflicts with another app. |

### Step 4: Set Persistent Storage
Ensure the volume mapping is correct:
- **Host Path**: `/DATA/AppData/icost/database`
- **Container Path**: `/app/database`
- **Statement Inbox**: map `/DATA/AppData/icost/imports` to `/app/imports`, then drop `.csv`, `.ofx`, or `.qfx` files there and use **Import Statements → Scan folder**.
- *Note: iCost initializes new databases with versioned migrations. Existing pre-migration databases are detected, backed up, baselined, and upgraded automatically.*

### Step 5: Finalize and Access
1. Click **Install**. CasaOS will pull the image and start the container.
2. Once the icon appears on your dashboard, click it to open iCost.
3. Register your own account on first launch. Production startup does not create a default password.

> 💡 **Pro Tip**: If you are using a reverse proxy (like Nginx Proxy Manager), set `NEXTAUTH_URL` to your domain (e.g., `https://icost.yourdomain.com`). iCost will automatically handle the redirection.

---

## 💻 Local Development

### Prerequisites
- Node.js 20+
- npm or yarn

### Setup
1. **Clone the Repo**:
   ```bash
   git clone https://github.com/your-username/iCost.git
   cd iCost
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Initialize Database**:
   ```bash
   npx prisma generate
   npx prisma migrate deploy
   ```

4. **Environment Variables**:
   Create a `.env` file in the root:
   ```env
   DATABASE_URL="file:./prisma/dev.db"
   NEXTAUTH_SECRET="your-random-secret"
   NEXTAUTH_URL="http://localhost:3000"
   ```

5. **Run Development Server**:
   ```bash
   npm run dev
   ```
   Visit `http://localhost:3000`

### Tests

```bash
npm test
npm run lint
npm run build
```

The test suite covers exact-cent accounting, transfers, project totals, duplicate fingerprints, backup/restore behavior, and upgrading an existing Float-based SQLite database to integer cents.

---

## 🔐 Security & Configuration

- **`NEXTAUTH_SECRET`**: CRITICAL. Change this to a long random string.
- **Automatic Backups**: Startup backups are stored in `/app/database/backups` (host path `/DATA/AppData/icost/database/backups`) and the newest 14 are retained.
- **Manual Export**: Open the profile menu and choose **Download JSON Backup** for a portable user-level export.
- **Private Instance**: This app is designed for internal network use. If exposing to the internet, please use a reverse proxy with SSL (like Nginx Proxy Manager).

### Restore a native SQLite backup

Stop the container before replacing the live database. Keep the current file until the restored instance has been verified.

```bash
docker compose stop icost
cd /DATA/AppData/icost/database
cp db.sqlite db.sqlite.before-restore
cp backups/icost-YYYY-MM-DDTHH-MM-SS-sssZ.db db.sqlite
rm -f db.sqlite-wal db.sqlite-shm
docker compose up -d icost
```

On startup, iCost applies any migrations newer than the restored backup. JSON export is intended for portability and inspection; native SQLite backups are the full disaster-recovery format.

---

## 🛠 Troubleshooting

### "Registration Failed" on new installation
If you see "Registration failed" when creating your first account, it is almost always a **filesystem permission** issue or a **cached Docker engine** issue:

1. **Clean Rebuild**: Sometimes Docker caches an old Prisma engine. Run a clean build:
   ```bash
   sudo docker compose down
   sudo docker compose build --no-cache
   sudo docker compose up -d
   ```

2. **Fix Permissions**: The Docker container runs as a non-root user (`nextjs`, UID 1001). Your host folder must be writable by this user:
   ```bash
   sudo chown -R 1001:1001 /DATA/AppData/icost/database /DATA/AppData/icost/imports
   ```


### Check Logs
To see the exact error, check the container logs in CasaOS:
- Click the app settings (three dots) -> **Settings** -> **Logs**.
- Look for lines starting with `Registration Error:`.


## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

---

*Made with ❤️ for family financial freedom.*
