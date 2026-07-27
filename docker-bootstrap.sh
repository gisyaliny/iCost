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

# UGOS may preserve the volume owner while removing its write bits after a
# shared-folder permission change or reboot. The container user still owns
# these paths, so restore owner-only access before SQLite or backups need it.
echo "🔐 Ensuring database owner permissions..."
find "$DB_DIR" -type d -exec chmod u+rwx,go-rwx {} + || {
    echo "❌ Unable to restore database directory permissions."
    exit 1
}
find "$DB_DIR" -type f -exec chmod u+rw,go-rwx {} + || {
    echo "❌ Unable to restore database file permissions."
    exit 1
}

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

# 6. Seed defaults and repair fallback-account links once, at startup.
echo "🌱 Ensuring default data..."
node ./scripts/ensure-defaults.mjs || {
    echo "❌ Default data initialization failed. Startup aborted."
    exit 1
}

# 7. Start the recurring worker independently from page requests.
echo "⏱️ Starting recurring transaction worker..."
node ./scripts/recurring-worker.mjs &
WORKER_PID=$!

# 8. Start and supervise the actual server.
echo "⚡ Starting Next.js Production Server..."
node server.js &
SERVER_PID=$!

shutdown() {
    kill "$SERVER_PID" 2>/dev/null || true
    kill "$WORKER_PID" 2>/dev/null || true
}

trap shutdown INT TERM
wait "$SERVER_PID"
STATUS=$?
kill "$WORKER_PID" 2>/dev/null || true
wait "$WORKER_PID" 2>/dev/null || true
exit "$STATUS"
