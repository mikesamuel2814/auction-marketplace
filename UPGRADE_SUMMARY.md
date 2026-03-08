# Production upgrade summary

This document summarizes the upgrades made to bring the auction platform to production grade.

## 1. Backend

### Error handling & API
- **Global error handler** (`middleware/errorHandler.ts`): Catches all errors, returns consistent `{ success: false, error, code?, details? }`. Zod validation errors return structured `details`.
- **express-async-errors**: Ensures async route errors are passed to the error handler.
- **API response helpers** (`lib/apiResponse.ts`): `sendSuccess` / `sendError` for optional use.

### Database (Prisma)
- **User**: `suspended` (boolean) for admin suspend.
- **Auction**: `viewCount`, `draft` (draft listings).
- **NotificationType**: `ITEM_SHIPPED`, `ITEM_DELIVERED`.
- **SavedSearch**, **PriceAlert**, **RecentlyViewed** models for buyer features (APIs can be added as needed).

### Bidding & auto-bid
- **Row locking**: Place-bid transaction uses `SELECT ... FOR UPDATE` on the auction row to prevent race conditions.
- Auto-bid logic unchanged (one counter-bid per new bid to avoid chains).

### Auctions
- **List filters**: `minPrice`, `maxPrice`, `sort` (`endingSoon` | `newest` | `highestBid`). Only approved, non-draft auctions shown.
- **GET /:id**: Increments `viewCount` and returns it.
- **POST /:id/duplicate**: Seller can duplicate an auction as a draft.

### Payments & escrow
- **Ship**: Creates in-app notification (ITEM_SHIPPED) and sends “Item shipped” email to buyer.
- **Confirm delivery**: Sends “Delivery confirmed” email to buyer.
- **Disputes**: `POST /api/disputes` (create), `GET /api/disputes/my` (my disputes). Admin: `GET /api/admin/disputes`, `POST /api/admin/disputes/:id/resolve`.

### Admin
- **POST /api/admin/users/:userId/suspend** | **unsuspend**.
- **DELETE /api/admin/auctions/:id**: Sets auction status to CANCELLED.

### Auth
- **Suspended check**: Authenticate middleware returns 403 if user is suspended.

### Socket.IO
- **viewerCount**: On join/leave auction room, server broadcasts `viewerCount` { auctionId, count } to that room.
- **disconnect**: Emits updated viewer count for any rooms the socket left.

---

## 2. Frontend

### UX
- **ToastProvider** (`contexts/ToastContext.tsx`): Success/error/info toasts; used on auction detail for bid success/error.
- **Skeleton** (`components/ui/skeleton.tsx`) and **AuctionCardSkeleton** for loading states.
- **NotificationBell** in header with unread count; links to `/dashboard/notifications`.
- **Dashboard notifications page** (`/dashboard/notifications`): List, mark read, mark all read, link to related resource.

### Auction detail
- **Live viewer count**: Subscribes to `viewerCount` and shows “X watching” when live.
- **Bid animation**: Brief ring + pulse on current-bid card when a new bid is received.
- **Live bid history**: Newest bid highlighted; real-time updates from socket.
- **Toasts**: Success on place bid / set auto-bid; error with message.

### Header
- Notification bell for logged-in users.
- Responsive: name hidden on small screens (`hidden sm:inline`).

---

## 3. Deployment & schema

- After pull, run **Prisma migrate** (or `db push`) so new columns and tables exist:
  - `User.suspended`, `Auction.viewCount`, `Auction.draft`, `NotificationType` values, `SavedSearch`, `PriceAlert`, `RecentlyViewed`.
- Optional: seed or backfill for existing rows if you add non-nullable fields later.

---

## 4. Not implemented in this pass (for later)

- Redis caching, Elasticsearch, CDN.
- Refund API (Stripe refund + order status).
- Seller analytics dashboard, bulk upload, scheduling UI.
- Saved search / price alert / recently viewed APIs and UI.
- CSRF token middleware (e.g. for state-changing ops).
- Image zoom, gallery slider, compression (can use Next/Image and external service).

All features listed in sections 1–2 are implemented and wired; run backend and frontend tests and manual flows (auth, list, bid, pay, ship, confirm, notifications, admin suspend/cancel) to verify in your environment.
