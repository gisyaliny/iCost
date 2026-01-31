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

## 🚀 Installation on CasaOS

iCost is optimized for CasaOS. Follow these steps to get it running in minutes:

### Method 1: App Store (Coming Soon)
- Search for **iCost** in the CasaOS App Store and click Install.

### Method 2: Manual Installation (Docker Compose)
1. Open your CasaOS Dashboard.
2. Click **App Store** > **Custom Install** > **Import**.
3. Paste the following configuration:

```yaml
version: '3'
services:
  icost:
    image: gisyaliny/icost:latest
    container_name: icost-app
    restart: unless-stopped
    ports:
      - "3001:3000"
    environment:
      - DATABASE_URL=file:/app/database/db.sqlite
      - NEXTAUTH_SECRET=YOUR_SECURE_RANDOM_SECRET
      - NEXTAUTH_URL=http://YOUR_SERVER_IP:3001
    volumes:
      - /DATA/AppData/icost/database:/app/database
```

4. Click **Install**.
5. Once the container is running, access it at `http://your-server-ip:3001`.

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

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

---

*Made with ❤️ for family financial freedom.*
