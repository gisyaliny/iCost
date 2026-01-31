#!/bin/bash

# iCost Local Deployment Setup Script
# Works on Linux and macOS

echo "🚀 Starting iCost Local Setup..."

# 1. Check for Node.js
if ! command -v node &> /dev/null
then
    echo "❌ Node.js is not installed. Please install Node.js 20 or higher."
    exit
fi

# 2. Install Dependencies
echo "📦 Installing npm dependencies..."
npm install

# 3. Handle LightningCSS Binary (Fixed for Linux environments)
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    echo "🔧 Detected Linux, ensuring correct lightningcss binary..."
    npm install --save-optional lightningcss-linux-x64-gnu
fi

# 4. Setup Environment File
if [ ! -f .env ]; then
    echo "📝 Creating default .env file..."
    cat > .env << EOL
DATABASE_URL="file:./prisma/dev.db"
NEXTAUTH_SECRET="$(openssl rand -base64 32 2>/dev/null || echo 'change_me_to_a_secure_random_string')"
NEXTAUTH_URL="http://localhost:3000"
EOL
fi

# 5. Initialize Database
echo "🗄️ Initializing SQLite database..."
npx prisma generate
npx prisma db push

# 6. Final Steps
echo ""
echo "✅ Setup Complete!"
echo "----------------------------------------"
echo "To start the development server, run:"
echo "npm run dev"
echo ""
echo "To build for production, run:"
echo "npm run build && npm start"
echo "----------------------------------------"
