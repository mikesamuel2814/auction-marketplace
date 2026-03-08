# BidHub – Online Auction Marketplace

A production-ready **trusted third-party online auction marketplace** where sellers list products, buyers place bids, and the platform manages escrow payments with a **0.5% service fee**.

## Features

- **User roles**: Buyer, Seller, Admin
- **Auction lifecycle**: Upcoming → Live → Ended → Completed (with optional reserve price)
- **Real-time bidding** via Socket.IO (live bid updates, countdown)
- **Auto-bid**: Set a max amount; system outbids for you up to that limit
- **Escrow payments**: Stripe; funds held until buyer confirms delivery
- **Revenue**: 0.5% platform fee + featured listings, premium seller, promotions
- **Security**: JWT + Google OAuth, rate limiting, anti–fake-bid measures

## Tech Stack

| Layer        | Stack                          |
|-------------|----------------------------------|
| Frontend    | Next.js 14, React, Tailwind CSS, ShadCN-style UI, Socket.IO client |
| Backend     | Node.js, Express, TypeScript     |
| Database    | PostgreSQL, Prisma ORM           |
| Auth        | JWT, Google OAuth                 |
| Payments    | Stripe (Payment Intents, webhooks) |
| Realtime    | Socket.IO                        |
| Storage     | AWS S3 (product images)           |

## Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL 16+
- (Optional) Stripe account, Google OAuth credentials, AWS S3 bucket

### 1. Clone and install

```bash
cd secret-gateway
npm install
cd backend && npm install && cd ..
cd frontend && npm install && cd ..
```

### 2. Environment

Copy `.env.example` and set variables:

**Backend** (`backend/.env`):

```env
DATABASE_URL="postgresql://user:password@localhost:5432/auction_db"
JWT_SECRET="your-super-secret-jwt-key-min-32-chars"
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL="http://localhost:5000/api/auth/google/callback"
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=us-east-1
AWS_S3_BUCKET=auction-marketplace-images
FRONTEND_URL="http://localhost:3000"
BACKEND_URL="http://localhost:5000"
PLATFORM_FEE_PERCENT=0.5
```

**Frontend** (`frontend/.env.local`):

```env
NEXT_PUBLIC_API_URL="http://localhost:5000"
NEXT_PUBLIC_SOCKET_URL="http://localhost:5000"
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
NEXT_PUBLIC_GOOGLE_CLIENT_ID=
```

### 3. Database

```bash
cd backend
npx prisma generate
npx prisma db push
# Or: npx prisma migrate dev
cd ..
```

### 4. Run

**Development (backend + frontend):**

```bash
npm run dev
```

- Backend: http://localhost:5000  
- Frontend: http://localhost:3000  

**Or run separately:**

```bash
npm run dev:backend   # Express + Socket.IO on :5000
npm run dev:frontend  # Next.js on :3000
```

### 5. Create first admin (optional)

Seed an admin user via Prisma Studio or SQL:

```sql
-- Example: set a user's role to ADMIN (replace USER_ID)
UPDATE "User" SET role = 'ADMIN' WHERE id = 'USER_ID';
```

## Project Structure

```
secret-gateway/
├── backend/           # Express API
│   ├── prisma/
│   │   └── schema.prisma
│   └── src/
│       ├── config/
│       ├── lib/
│       ├── middleware/
│       ├── routes/    # auth, users, auctions, bids, payments, etc.
│       ├── services/  # stripe, s3, email, auctionClose
│       ├── socket/
│       └── index.ts
├── frontend/          # Next.js App Router
│   ├── app/           # pages & layout
│   ├── components/
│   ├── contexts/
│   └── lib/           # api, utils, socket
├── docker-compose.yml
├── Dockerfile
├── .env.example
└── README.md
```

## API Overview

| Area        | Endpoints |
|------------|-----------|
| Auth       | `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/refresh`, `GET /api/auth/google`, `GET /api/auth/google/callback`, `POST /api/auth/forgot-password`, `POST /api/auth/reset-password`, `POST /api/auth/verify-email`, `GET /api/auth/me` |
| Users      | `GET/PATCH /api/users/profile`, `GET /api/users` (admin), `POST /api/users/:id/verify-seller` (admin) |
| Auctions   | `GET /api/auctions`, `GET /api/auctions/:id`, `POST /api/auctions` (seller), `PATCH /api/auctions/:id`, `POST /api/auctions/:id/approve` (admin), `POST /api/auctions/upload-url` |
| Bids       | `GET /api/bids/auction/:auctionId`, `POST /api/bids`, `GET /api/bids/my-bids`, `POST /api/bids/auto-bid` |
| Payments   | `POST /api/payments/create-intent`, `POST /api/payments/confirm`, `POST /api/payments/webhook` (Stripe), `POST /api/payments/:orderId/ship`, `POST /api/payments/:orderId/confirm-delivery`, `GET /api/payments/orders`, `GET /api/payments/sales` |
| Orders     | `POST /api/orders/close-auction` (admin), `GET /api/orders/my-auctions` |
| Reviews    | `POST /api/reviews`, `GET /api/reviews/auction/:id`, `GET /api/reviews/user/:id` |
| Notifications | `GET /api/notifications`, `PATCH /api/notifications/:id/read`, `POST /api/notifications/read-all` |
| Watchlist  | `GET /api/watchlist`, `POST /api/watchlist`, `DELETE /api/watchlist/:auctionId` |
| Categories | `GET /api/categories`, `GET /api/categories/:slug`, `POST /api/categories` (admin) |
| Admin      | `GET /api/admin/dashboard`, `GET /api/admin/auctions`, `GET /api/admin/disputes`, `POST /api/admin/disputes/:id/resolve` |

## Realtime (Socket.IO)

- **Events from server**: `newBid`, `auctionEnded`
- **Client**: `joinAuction(auctionId)`, `leaveAuction(auctionId)`; send token in `auth.token` for authenticated sockets

## One-command deploy (VPS)

On a server (e.g. `/var/www/auction-marketplace`):

```bash
cd /var/www/auction-marketplace && git pull && ./deploy.sh
```

Uses **backend port 5020** and **frontend port 3020** by default (configurable via `BACKEND_PORT` / `FRONTEND_PORT`). See **[SERVER_DEPLOY.md](./SERVER_DEPLOY.md)** for first-time setup, PostgreSQL, and cloudflared tunnel.

## Deployment

See **[DEPLOYMENT.md](./DEPLOYMENT.md)** for:

- Docker and docker-compose
- AWS (EC2, RDS, S3)
- DigitalOcean / VPS
- Environment variables and production checklist

## Revenue Model

- **0.5% platform fee** on successful sales (e.g. 120,000 BDT → 600 BDT fee, 119,400 to seller).
- Optional: featured listings, premium seller subscription, homepage promotion, sponsored products, bid entry deposit (implement via DB and admin UI).

## License

MIT.
