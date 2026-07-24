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

## 🟢 UGREEN NAS / UGOS Pro Deployment

UGREEN models with Docker support can run iCost as a Compose project. The SSH workflow is recommended because this repository builds a local image instead of relying on a possibly stale registry image.

1. Install **Docker** from the UGOS Pro App Center and enable SSH under **Control Panel → Terminal**.
2. Connect over SSH and prepare local, persistent folders (adjust `/volume1` if your storage volume uses a different path):

   ```bash
   sudo mkdir -p /volume1/docker/icost/database /volume1/docker/icost/imports
   cd /volume1/docker/icost
   git clone https://github.com/gisyaliny/iCost.git app
   cd app
   cp .env.nas.example .env
   ```

3. Generate a session secret with `openssl rand -base64 48`, then edit `.env`:

   ```env
   NEXTAUTH_SECRET="paste-the-generated-value-here"
   NEXTAUTH_URL="http://your-ugreen-tailscale-name:3000"
   ICOST_PORT="3000"
   ICOST_DATABASE_DIR="/volume1/docker/icost/database"
   ICOST_IMPORT_DIR="/volume1/docker/icost/imports"
   TZ="America/New_York"
   ```

4. The app container runs as UID `1001`. Give it access to the database folder; the imports folder only needs to be readable:

   ```bash
   sudo chown -R 1001:1001 /volume1/docker/icost/database
   sudo chmod -R u+rwX,go-rwx /volume1/docker/icost/database
   sudo chmod -R a+rX /volume1/docker/icost/imports
   ```

5. Build, start, and verify:

   ```bash
   docker compose up -d --build
   docker compose ps
   docker compose logs --tail=100 icost
   ```

Open `NEXTAUTH_URL`, register your account, then put bank statements in the host imports folder when needed. Startup automatically backs up SQLite before applying migrations; backups persist under the database volume.

To upgrade later:

```bash
cd /volume1/docker/icost/app
docker compose stop icost
git pull --ff-only
docker compose up -d --build
docker compose ps
```

Keep iCost and the NAS management interface private behind Tailscale; router port forwarding is not required.

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
