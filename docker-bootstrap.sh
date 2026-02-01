#!/bin/sh

echo "🚀 Starting iCost Bootstrap Process..."

# 1. Environment Debugging
echo "🔍 System Environment:"
echo "User: $(whoami) (UID: $(id -u))"
echo "OpenSSL Version: $(openssl version)"

# 2. Check/Fix Database Permissions
DB_DIR="/app/database"
echo "🗄️ Checking Database Directory: $DB_DIR"
if [ ! -d "$DB_DIR" ]; then
    echo "Creating $DB_DIR..."
    mkdir -p "$DB_DIR"
fi

# 3. Locate Prisma CLI
# Since we are in a slim environment, .bin symlinks might strictly not exist.
# We look for the package directly.
PRISMA_CLI="./node_modules/prisma/build/index.js"

if [ ! -f "$PRISMA_CLI" ]; then
    echo "⚠️ Prisma CLI not found at $PRISMA_CLI"
    echo "Listing node_modules/prisma..."
    ls -R node_modules/prisma || echo "node_modules/prisma not found"
    
    # Fallback to npx (might try to download if cached version missing)
    echo "Trying npx..."
    npx prisma db push --accept-data-loss
else
    echo "Found Prisma CLI at $PRISMA_CLI"
    echo "🏗️ Running Prisma DB Push..."
    node "$PRISMA_CLI" db push --accept-data-loss
fi

if [ $? -eq 0 ]; then
    echo "✅ Database schema sync successful."
else
    echo "❌ Database schema sync FAILED."
fi

# 4. Start the actual server
echo "⚡ Starting Next.js Production Server..."
node server.js
