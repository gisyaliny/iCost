# 💰 iCost - Premium Family Expense Tracker

iCost is a powerful, self-hosted family expense tracking application designed for visual clarity, ease of use, and complete privacy. Built specifically for **CasaOS** and other Docker environments, it helps you manage family finances with ease.

![image](https://images.unsplash.com/photo-1554224155-6726b3ff858f?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80)

## ✨ Features

### 🏦 Transaction Management
- **Smart Dashboard**: Real-time summary of Income, Expenses, and Net Balance.
- **Advanced Pagination**: Efficiently view historical data with "Show All" or Top 100 modes.
- **Inline Editing**: Zap through adjustments with lightning-fast inline description, amount, and category updates.
- **Bulk Actions**: Multi-select transactions for batch deletion or category reorganization.

### 🔄 Recurring Transactions
- **Schedule Future Costs**: Support for Daily, Weekly, Monthly, and Yearly recurring transactions.
- **Custom End Dates**: Set a termination date for your subscriptions or lease payments.

### 📂 Smart CSV Import
- **Dynamic Mapping**: Supports common banking CSV formats with automatic header detection.
- **Duplicate Protection**: Intelligent duplicate detection ensures your records stay clean even after multiple imports.

### 📊 Deep Analytics
- **Visual Trends**: Weekly, Monthly, and Daily charts for Income vs. Expenses.
- **Category Breakdown**: Dynamic pie charts showing where your money actually goes.
- **Filterable Insights**: Drill down into specific categories or date ranges.

### 🏠 Property & Category Management
- **Property Tracking**: Tag transactions to specific real estate or rental properties.
- **Custom Categories**: Unlimited custom categories with rich icons and colors.
- **Unified Profile**: Manage all global settings from a single, premium Profile menu in the header.

## 🛠 Technology Stack

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router & Server Actions)
- **Database**: [SQLite](https://sqlite.org/) (via [Prisma ORM](https://www.prisma.io/))
- **Auth**: [NextAuth.js](https://next-auth.js.org/)
- **UI Components**: [Shadcn UI](https://ui.shadcn.com/) / [Radix UI](https://www.radix-ui.com/)
- **Charts**: [Recharts](https://recharts.org/)
- **Deployment**: [Docker](https://www.docker.com/) / [CasaOS](https://casaos.io/)

---

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
    volumes:
      - /DATA/AppData/icost/database:/app/database
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
- *Note: iCost now automatically initializes the database schema on startup.*

### Step 5: Finalize and Access
1. Click **Install**. CasaOS will pull the image and start the container.
2. Once the icon appears on your dashboard, click it to open iCost.
3. **Access**: You can register your own account or use the default pre-configured account:
   - **Username**: `admin`
   - **Password**: `admin123`
   - *It is highly recommended to change the password or create a new user and delete the admin account after login.*

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
   npx prisma db push
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

---

## 🔐 Security & Configuration

- **`NEXTAUTH_SECRET`**: CRITICAL. Change this to a long random string.
- **Database Backup**: Simply back up the `/app/database/db.sqlite` file. In CasaOS, this is located at `/DATA/AppData/icost/database/db.sqlite`.
- **Private Instance**: This app is designed for internal network use. If exposing to the internet, please use a reverse proxy with SSL (like Nginx Proxy Manager).

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
   sudo chown -R 1001:1001 /DATA/AppData/icost/database
   ```


### Check Logs
To see the exact error, check the container logs in CasaOS:
- Click the app settings (three dots) -> **Settings** -> **Logs**.
- Look for lines starting with `Registration Error:`.


## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

---

*Made with ❤️ for family financial freedom.*
