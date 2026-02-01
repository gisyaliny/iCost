#!/bin/sh

echo "🚀 Starting iCost Bootstrap Process..."

# 1. Environment Debugging
echo "🔍 System Environment:"
echo "User: $(whoami) (UID: $(id -u))"
echo "OpenSSL Version: $(openssl version)"
ls -l /usr/lib/x86_64-linux-gnu/libssl.so* || echo "libssl not found in standard path"

# 2. Check/Fix Database Permissions
DB_DIR="/app/database"
echo "🗄️ Checking Database Directory: $DB_DIR"
if [ ! -d "$DB_DIR" ]; then
    echo "Creating $DB_DIR..."
    mkdir -p "$DB_DIR"
fi

# Ensure the directory is writable
# Note: Since the container runs as 'nextjs', it must own this folder
if [ ! -w "$DB_DIR" ]; then
    echo "⚠️ WARNING: $DB_DIR is NOT writable by current user."
fi

# 3. Initialize Database Tables
# We use the local binary to avoid npx trying to download/install things to /home/nextjs
echo "🏗️ Running Prisma DB Push..."
./node_modules/.bin/prisma db push --accept-data-loss

if [ $? -eq 0 ]; then
    echo "✅ Database schema sync successful."
else
    echo "❌ Database schema sync FAILED."
fi

# 4. Start the actual server
echo "⚡ Starting Next.js Production Server..."
node server.js
