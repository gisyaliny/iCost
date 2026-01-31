#!/bin/sh

echo "🚀 Starting iCost Bootstrap Process..."

# 1. Initialize Database Tables if they don't exist
echo "🗄️ Running Prisma DB Push..."
npx prisma db push --accept-data-loss # Since we use SQLite, this is safe for schema initialization

# 2. Start the actual server
echo "⚡ Starting Next.js Production Server..."
node server.js
