# Server deployment (VPS at /var/www/auction-marketplace)

Deploy with:

```bash
cd /var/www/auction-marketplace && git pull && ./deploy.sh
```

## Ports (cloudflared)

| Service  | Port | Suggested hostname        |
|----------|------|---------------------------|
| Backend  | 5020 | api.auction.bfcpos.com    |
| Frontend | 3020 | auction.bfcpos.com        |

## First-time setup on the server

### 1. Clone the repo

```bash
sudo mkdir -p /var/www/auction-marketplace
sudo chown "$USER:$USER" /var/www/auction-marketplace
cd /var/www/auction-marketplace
git clone <YOUR_REPO_URL> .
```

### 2. Create `backend/.env`

```bash
cp .env.production.example backend/.env
# Edit and set:
# - DATABASE_URL (PostgreSQL)
# - JWT_SECRET
# - FRONTEND_URL, BACKEND_URL
# - NEXT_PUBLIC_API_URL, NEXT_PUBLIC_SOCKET_URL (same as BACKEND_URL in production)
# - Stripe keys, Google OAuth, AWS S3 if used
nano backend/.env
```

### 3. PostgreSQL database

Create a DB and user (if not reusing an existing DB):

```bash
sudo -u postgres psql -c "CREATE USER auction WITH PASSWORD 'YOUR_DB_PASSWORD';"
sudo -u postgres psql -c "CREATE DATABASE auction_db OWNER auction;"
# Then set DATABASE_URL=postgresql://auction:YOUR_DB_PASSWORD@localhost:5432/auction_db in backend/.env
```

First-time schema (run once):

```bash
cd /var/www/auction-marketplace/backend
npx prisma db push
# Optional: seed categories + admin user
npm run db:seed
```

### 4. Install Node.js 20 and PM2

```bash
# Node 20 (example: NodeSource)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# PM2
sudo npm install -g pm2
```

### 5. Cloudflared tunnel

Add these lines to `/etc/cloudflared/config.yml` (adjust hostnames if you prefer):

```yaml
  - hostname: auction.bfcpos.com
    service: http://localhost:3020
  - hostname: www.auction.bfcpos.com
    service: http://localhost:3020
  - hostname: api.auction.bfcpos.com
    service: http://localhost:5020
```

Reload cloudflared:

```bash
sudo systemctl reload cloudflared
```

### 6. Deploy

```bash
cd /var/www/auction-marketplace && git pull && chmod +x deploy.sh && ./deploy.sh
```

## Optional: custom ports

If 5020 or 3020 are in use, set them before running deploy:

```bash
BACKEND_PORT=5022 FRONTEND_PORT=3022 ./deploy.sh
```

Then point cloudflared to the same ports.

## PM2 commands

```bash
pm2 list
pm2 logs auction-backend
pm2 logs auction-frontend
pm2 restart auction-backend auction-frontend
```

## Logs

- PM2: `~/logs/` under the app dir (backend-out.log, frontend-error.log, etc.)
- Or: `pm2 logs`
