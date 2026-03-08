#!/usr/bin/env bash
# Deploy script for /var/www/auction-marketplace
# Usage: cd /var/www/auction-marketplace && git pull && ./deploy.sh

set -e
cd "$(dirname "$0")"

APP_DIR="$(pwd)"
BACKEND_PORT="${BACKEND_PORT:-5020}"
FRONTEND_PORT="${FRONTEND_PORT:-3020}"

echo "==> Deploying auction-marketplace from $APP_DIR"
echo "    Backend port: $BACKEND_PORT | Frontend port: $FRONTEND_PORT"

# Load env: backend/.env (required for DATABASE_URL, JWT_SECRET, and NEXT_PUBLIC_* for frontend build)
if [ -f "$APP_DIR/backend/.env" ]; then
  set -a
  # shellcheck source=/dev/null
  . "$APP_DIR/backend/.env"
  set +a
  echo "==> Loaded backend/.env"
else
  echo "==> WARNING: backend/.env not found. Create from .env.production.example"
fi

export PORT="$BACKEND_PORT"
export NODE_ENV=production
# Frontend build needs these at build time (set in backend/.env for production URLs)
export NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-http://localhost:$BACKEND_PORT}"
export NEXT_PUBLIC_SOCKET_URL="${NEXT_PUBLIC_SOCKET_URL:-http://localhost:$BACKEND_PORT}"

# Install dependencies
echo "==> Installing root dependencies..."
npm install --omit=dev

echo "==> Installing backend dependencies..."
cd "$APP_DIR/backend"
npm install

echo "==> Installing frontend dependencies..."
cd "$APP_DIR/frontend"
npm install

# Database & build
echo "==> Prisma generate..."
cd "$APP_DIR/backend"
npx prisma generate

echo "==> Running database schema..."
if [ -d "$APP_DIR/backend/prisma/migrations" ] && [ "$(ls -A "$APP_DIR/backend/prisma/migrations" 2>/dev/null)" ]; then
  npx prisma migrate deploy 2>/dev/null || npx prisma db push --accept-data-loss
else
  npx prisma db push --accept-data-loss
fi

echo "==> Building backend..."
cd "$APP_DIR/backend" && npx tsc && cd "$APP_DIR"

echo "==> Building frontend..."
cd "$APP_DIR/frontend"
npm run build

# PM2: restart or start
echo "==> Restarting PM2 processes..."
mkdir -p "$APP_DIR/logs"
cd "$APP_DIR"

if command -v pm2 >/dev/null 2>&1; then
  if [ -f "$APP_DIR/ecosystem.config.cjs" ]; then
    pm2 delete auction-backend auction-frontend 2>/dev/null || true
    BACKEND_PORT="$BACKEND_PORT" FRONTEND_PORT="$FRONTEND_PORT" pm2 start ecosystem.config.cjs
  else
    pm2 delete auction-backend 2>/dev/null || true
    pm2 start backend/dist/index.js --name auction-backend -i 1 --cwd "$APP_DIR/backend" --update-env
    pm2 set auction-backend env PORT "$BACKEND_PORT" 2>/dev/null || true

    pm2 delete auction-frontend 2>/dev/null || true
    pm2 start npm --name auction-frontend -i 1 --cwd "$APP_DIR/frontend" -- start --update-env
    pm2 set auction-frontend env PORT "$FRONTEND_PORT" 2>/dev/null || true
  fi
  pm2 save
  echo "==> PM2 status:"
  pm2 list
else
  echo "==> PM2 not found. Start manually:"
  echo "    Backend:  cd backend && PORT=$BACKEND_PORT node dist/index.js"
  echo "    Frontend: cd frontend && PORT=$FRONTEND_PORT npm run start"
fi

echo "==> Deploy complete. Backend: $BACKEND_PORT | Frontend: $FRONTEND_PORT"
