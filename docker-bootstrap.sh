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
    echo "❌ Prisma CLI not found at $PRISMA_CLI"
    exit 1
fi

# 4. Back up the database and detect installations created before migrations.
node ./scripts/database-bootstrap.mjs
PREPARE_STATUS=$?

if [ "$PREPARE_STATUS" -eq 10 ]; then
    echo "📌 Baselining existing database..."
    node "$PRISMA_CLI" migrate resolve --applied 20260716150000_existing_baseline || exit 1
elif [ "$PREPARE_STATUS" -ne 0 ]; then
    echo "❌ Database backup/preparation failed. Startup aborted."
    exit "$PREPARE_STATUS"
fi

# 5. Apply versioned migrations. Never continue after a failed migration.
echo "🏗️ Applying database migrations..."
node "$PRISMA_CLI" migrate deploy || {
    echo "❌ Database migration failed. Startup aborted; the pre-migration backup was kept."
    exit 1
}
echo "✅ Database migrations applied successfully."

# 6. Start the actual server
echo "⚡ Starting Next.js Production Server..."
node server.js
