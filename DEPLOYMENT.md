# Deployment Guide – BidHub Auction Marketplace

This guide covers running the app with **Docker** and deploying to **AWS**, **DigitalOcean**, or a **generic VPS**.

---

## 1. Docker (local or any host)

### Using docker-compose

1. Create a `.env` in the project root (see below).
2. Build and run:

```bash
docker-compose up -d --build
```

3. Run migrations (one-off):

```bash
docker-compose exec backend npx prisma migrate deploy
# or first time: docker-compose exec backend npx prisma db push
```

4. URLs:
   - Frontend: http://localhost:3000  
   - Backend API: http://localhost:5000  
   - PostgreSQL: localhost:5432 (user `auction`, password `auction_secret`, DB `auction_db`)

### Environment for Docker

In project root (or where `docker-compose.yml` lives), create `.env`:

```env
# Database (used by backend)
DATABASE_URL=postgresql://auction:auction_secret@db:5432/auction_db

# Auth
JWT_SECRET=your-long-random-secret-at-least-32-chars

# URLs (replace with your domain in production)
FRONTEND_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:5000
NEXT_PUBLIC_SOCKET_URL=http://localhost:5000

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...

# Optional: Google OAuth, AWS S3 (see backend .env.example)
```

---

## 2. AWS

### Option A: EC2 + RDS + S3

1. **RDS (PostgreSQL)**  
   - Create a PostgreSQL 16 instance (private subnet).  
   - Note endpoint, port, master user/password.  
   - Set `DATABASE_URL` to:  
     `postgresql://USER:PASSWORD@RDS_ENDPOINT:5432/auction_db`

2. **S3**  
   - Create a bucket for product images.  
   - IAM user with `s3:PutObject`, `s3:GetObject` on that bucket.  
   - Set `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `AWS_S3_BUCKET` in backend env.

3. **EC2 (backend + frontend or separate)**  
   - Amazon Linux 2 or Ubuntu.  
   - Install Docker and Docker Compose (or run Node directly).  
   - Clone repo, set `.env` (and `frontend/.env.local` if needed).  
   - If using Docker:  
     ```bash
     docker-compose up -d
     docker-compose exec backend npx prisma migrate deploy
     ```  
   - If running without Docker:  
     - Backend: `cd backend && npm ci && npx prisma migrate deploy && npm run start` (e.g. with `pm2`).  
     - Frontend: `cd frontend && npm ci && npm run build && npm run start` (or use a separate EC2/Amplify for frontend).

4. **Security group**  
   - Allow 22 (SSH), 80, 443 (and 3000/5000 if not behind a load balancer).  
   - Restrict 5432 to backend only (or RDS to EC2 only).

5. **HTTPS**  
   - Put a load balancer (ALB) or Nginx in front; terminate SSL (e.g. ACM certificate).  
   - Set `FRONTEND_URL` and `BACKEND_URL` to `https://...`.

6. **Stripe webhook**  
   - In Stripe Dashboard, set endpoint to `https://your-api-domain/api/payments/webhook`.  
   - Use the signing secret as `STRIPE_WEBHOOK_SECRET`.

---

### Option B: ECS/Fargate

- Build backend and frontend images (e.g. with the project `Dockerfile` targets).  
- Push to ECR.  
- Run backend and frontend as separate ECS services; RDS and S3 as above.  
- Use ALB for HTTPS and path-based routing (e.g. `/api` → backend, `/` → frontend) or separate hostnames.

---

## 3. DigitalOcean

1. **Managed PostgreSQL**  
   - Create a cluster; get connection string.  
   - Set `DATABASE_URL` in backend env.

2. **Droplet (VPS)**  
   - Create Droplet (Ubuntu 22.04).  
   - Install Docker + Docker Compose (or Node 20).  
   - Clone repo, configure `.env` and (if needed) `frontend/.env.local`.  
   - Run:  
     ```bash
     docker-compose up -d --build
     docker-compose exec backend npx prisma migrate deploy
     ```

3. **Spaces (S3-compatible)**  
   - Create a Space for images.  
   - Use Spaces endpoint and key/secret as `AWS_*`-style vars (or adapt backend S3 client to DigitalOcean Spaces).

4. **HTTPS**  
   - Use DigitalOcean Load Balancer with SSL, or Nginx on the Droplet with Let’s Encrypt.

---

## 4. Generic VPS (Ubuntu)

1. **PostgreSQL**  
   ```bash
   sudo apt update && sudo apt install -y postgresql postgresql-contrib
   sudo -u postgres createuser -P auction
   sudo -u postgres createdb -O auction auction_db
   ```  
   Set `DATABASE_URL` accordingly (e.g. `postgresql://auction:PASSWORD@localhost:5432/auction_db`).

2. **Node 20**  
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt install -y nodejs
   ```

3. **App**  
   ```bash
   cd /opt && git clone <your-repo> bidhub && cd bidhub
   cp .env.example .env   # edit .env
   npm install
   cd backend && npm ci && npx prisma migrate deploy && npm run build
   cd ../frontend && npm ci && npm run build
   ```

4. **Process manager (PM2)**  
   ```bash
   sudo npm install -g pm2
   cd /opt/bidhub/backend && pm2 start dist/index.js --name backend
   cd /opt/bidhub/frontend && pm2 start npm --name frontend -- start
   pm2 save && pm2 startup
   ```

5. **Nginx (reverse proxy + SSL)**  
   - Proxy `https://yourdomain` → frontend (e.g. `http://127.0.0.1:3000`).  
   - Proxy `https://yourdomain/api` and `https://yourdomain/socket.io` → backend (e.g. `http://127.0.0.1:5000`).  
   - Use Certbot for Let’s Encrypt.

6. **Env on VPS**  
   - `FRONTEND_URL` / `BACKEND_URL`: `https://yourdomain` and `https://yourdomain` (or separate API subdomain).  
   - `NEXT_PUBLIC_*`: same base URL so the browser can call API and Socket.IO.

---

## 5. Environment checklist

- **Backend**  
  `DATABASE_URL`, `JWT_SECRET`, `FRONTEND_URL`, `BACKEND_URL`, `STRIPE_*`, `PLATFORM_FEE_PERCENT`.  
  Optional: `GOOGLE_*`, `AWS_*` (or S3-compatible), SMTP for email.

- **Frontend**  
  `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SOCKET_URL`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (if using Google login).

- **Stripe**  
  - Use live keys in production.  
  - Webhook endpoint: `https://your-api-domain/api/payments/webhook`; body must be raw (already handled in backend).

---

## 6. Post-deploy

- Create at least one **Admin** user (e.g. via Prisma Studio or SQL `UPDATE "User" SET role = 'ADMIN'`).  
- Verify **Stripe webhook** with a test payment.  
- Test **Google OAuth** with production client ID/secret and correct redirect URI.  
- Optionally run backend health: `GET /health` → `{"status":"ok",...}`.
