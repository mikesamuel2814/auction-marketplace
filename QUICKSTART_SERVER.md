# Quick start on VPS (after clone)

Run these on the server in order. Replace `YOUR_DB_PASSWORD` and any placeholder URLs/keys.

---

## 1. Fix ownership (so you can run deploy without sudo)

```bash
sudo chown -R $USER:$USER /var/www/auction-marketplace
cd /var/www/auction-marketplace
```

---

## 2. Create backend env file

```bash
cp .env.production.example backend/.env
nano backend/.env
```

Set at least:

- `DATABASE_URL=postgresql://auction:YOUR_DB_PASSWORD@localhost:5432/auction_db`
- `JWT_SECRET=` (long random string, e.g. 32+ chars)
- `FRONTEND_URL=https://auction.bfcpos.com`
- `BACKEND_URL=https://api.auction.bfcpos.com`
- `NEXT_PUBLIC_API_URL=https://api.auction.bfcpos.com`
- `NEXT_PUBLIC_SOCKET_URL=https://api.auction.bfcpos.com`
- Stripe keys if you use payments

Save and exit (Ctrl+O, Enter, Ctrl+X).

---

## 3. PostgreSQL database

```bash
sudo -u postgres psql -c "CREATE USER auction WITH PASSWORD 'YOUR_DB_PASSWORD';"
sudo -u postgres psql -c "CREATE DATABASE auction_db OWNER auction;"
```

Use the same password in `backend/.env` for `DATABASE_URL`.

---

## 4. Node.js 20 and PM2 (if not installed)

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
```

---

## 5. First-time DB schema and deploy

```bash
cd /var/www/auction-marketplace
chmod +x deploy.sh
./deploy.sh
```

If the deploy fails at Prisma (e.g. “no migrations”), run once:

```bash
cd /var/www/auction-marketplace/backend
npx prisma db push
npm run db:seed
cd ..
./deploy.sh
```

---

## 6. Cloudflared tunnel

Edit config:

```bash
sudo nano /etc/cloudflared/config.yml
```

Add (with same indentation as other entries):

```yaml
  - hostname: auction.bfcpos.com
    service: http://localhost:3020
  - hostname: www.auction.bfcpos.com
    service: http://localhost:3020
  - hostname: api.auction.bfcpos.com
    service: http://localhost:5020
```

Reload:

```bash
sudo systemctl reload cloudflared
```

---

## 7. Check app and PM2

- Frontend: https://auction.bfcpos.com (after DNS/Cloudflare)
- Backend API: https://api.auction.bfcpos.com/health

```bash
pm2 list
pm2 logs
```

---

## Later: update and redeploy

```bash
cd /var/www/auction-marketplace && git pull && ./deploy.sh
```
