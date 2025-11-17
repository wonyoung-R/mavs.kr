#!/bin/bash
set -euo pipefail

# Only run in Claude Code remote environment (web)
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

echo "🚀 Starting mavs.kr project initialization..."

# Change to project directory
cd "$CLAUDE_PROJECT_DIR" || exit 1

# Install Node.js dependencies
echo "📦 Installing Node.js dependencies..."
# Skip Puppeteer browser download in remote environment
export PUPPETEER_SKIP_DOWNLOAD=true
if [ -f "package-lock.json" ]; then
  npm install --prefer-offline --no-audit --no-fund
else
  npm install --no-audit --no-fund
fi

# Install jest-environment-jsdom for testing (if not already installed)
if [ -f "jest.config.ts" ] && grep -q "testEnvironment.*jsdom" jest.config.ts; then
  if ! npm list jest-environment-jsdom &>/dev/null; then
    echo "📦 Installing jest-environment-jsdom for testing..."
    npm install --save-dev --no-audit --no-fund jest-environment-jsdom
  fi
fi

# Generate Prisma client
echo "🔧 Generating Prisma client..."
if [ -f "prisma/schema.prisma" ]; then
  npm run db:generate || echo "⚠️  Prisma client generation failed (this is OK if no database is available)"
fi

# Setup Python environment (optional but useful)
echo "🐍 Setting up Python environment..."
if [ -f "requirements.txt" ] && command -v python3 &> /dev/null; then
  if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv venv || echo "⚠️  Python venv creation failed (skipping)"
  fi

  if [ -d "venv" ]; then
    # Activate venv and install dependencies
    source venv/bin/activate
    pip install --quiet --upgrade pip
    pip install --quiet -r requirements.txt || echo "⚠️  Python dependencies installation failed (skipping)"

    # Add Python venv to environment
    if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
      echo "export PATH=\"\$CLAUDE_PROJECT_DIR/venv/bin:\$PATH\"" >> "$CLAUDE_ENV_FILE"
      echo "export VIRTUAL_ENV=\"\$CLAUDE_PROJECT_DIR/venv\"" >> "$CLAUDE_ENV_FILE"
    fi
  fi
fi

# Set up environment variables
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  echo "🔑 Setting up environment variables..."
  # Add any project-specific environment variables here
  echo "export NODE_ENV=\"development\"" >> "$CLAUDE_ENV_FILE"
fi

echo "✅ mavs.kr initialization complete!"
