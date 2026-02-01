#!/bin/sh

echo "🚀 Starting iCost Bootstrap Process..."

# Check permissions for database directory
DB_DIR="/app/database"
if [ ! -w "$DB_DIR" ]; then
    echo "⚠️ Warning: $DB_DIR is not writable by user $(whoami) (UID $(id -u))"
    echo "Please run: sudo chown -R 1001:1001 /DATA/AppData/icost/database on your host."
fi

# 1. Initialize Database Tables if they don't exist
echo "🗄️ Running Prisma DB Push..."
npx prisma db push --accept-data-loss

# 2. Start the actual server
echo "⚡ Starting Next.js Production Server..."
node server.js
