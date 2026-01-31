#!/bin/sh

echo "🚀 Starting iCost Bootstrap Process..."

# 1. Initialize Database Tables if they don't exist
# Now that /home/nextjs is writable, npx will work correctly
echo "🗄️ Running Prisma DB Push..."
npx prisma db push --accept-data-loss

# 2. Start the actual server
echo "⚡ Starting Next.js Production Server..."
node server.js
