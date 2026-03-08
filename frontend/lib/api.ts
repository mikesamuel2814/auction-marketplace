const API = process.env.NEXT_PUBLIC_API_URL || '';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('accessToken');
}

export async function api<T>(
  path: string,
  options: RequestInit & { params?: Record<string, string | number | boolean | undefined> } = {}
): Promise<T> {
  const { params, ...rest } = options;
  let url = `${API}${path}`;
  if (params && Object.keys(params).length) {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) search.set(k, String(v));
    });
    const q = search.toString();
    if (q) url += '?' + q;
  }
  const token = getToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(rest.headers as Record<string, string>),
  };
  if (token) (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;

  const res = await fetch(url, { ...rest, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || err.message || res.statusText);
  }
  return res.json();
}

export const authApi = {
  login: (email: string, password: string) =>
    api<{ user: unknown; accessToken: string; refreshToken: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  register: (data: { email: string; password: string; name: string; role: 'BUYER' | 'SELLER' }) =>
    api<{ user: unknown; accessToken: string; refreshToken: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  refresh: (refreshToken: string) =>
    api<{ accessToken: string; user: unknown }>('/api/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    }),
  me: () => api<{ userId: string; email: string; role: string }>('/api/auth/me'),
};

export const auctionsApi = {
  list: (params?: { status?: string; categoryId?: string; search?: string; page?: number; limit?: number }) =>
    api<{ auctions: Auction[]; total: number; page: number; limit: number }>('/api/auctions', { params: params as Record<string, string> }),
  get: (id: string) => api<AuctionDetail>(`/api/auctions/${id}`),
  create: (data: CreateAuctionInput) =>
    api<Auction>('/api/auctions', { method: 'POST', body: JSON.stringify(data) }),
  uploadUrl: (contentType: string) =>
    api<{ uploadUrl: string; key: string }>('/api/auctions/upload-url', {
      method: 'POST',
      body: JSON.stringify({ contentType }),
    }),
};

export const bidsApi = {
  list: (auctionId: string) =>
    api<{ id: string; amount: number; bidderName: string; createdAt: string }[]>(`/api/bids/auction/${auctionId}`),
  place: (auctionId: string, amount: number, options?: { isAutoBid?: boolean; maxAutoBid?: number }) =>
    api<{ bid: { id: string; amount: number }; currentBid: number }>('/api/bids', {
      method: 'POST',
      body: JSON.stringify({ auctionId, amount, ...options }),
    }),
  myBids: () => api<{ bids: MyBid[] }>('/api/bids/my-bids'),
  setAutoBid: (auctionId: string, maxAmount: number) =>
    api<{ message: string }>('/api/bids/auto-bid', {
      method: 'POST',
      body: JSON.stringify({ auctionId, maxAmount }),
    }),
};

export const paymentsApi = {
  createIntent: (orderId: string) =>
    api<{ clientSecret: string; publishableKey: string }>('/api/payments/create-intent', {
      method: 'POST',
      body: JSON.stringify({ orderId }),
    }),
  confirmDelivery: (orderId: string) =>
    api<{ message: string }>(`/api/payments/${orderId}/confirm-delivery`, { method: 'POST' }),
  orders: () => api<{ orders: Order[] }>('/api/payments/orders'),
  sales: () => api<{ sales: { id: string; amount: number; status: string; auctionTitle: string; paidAt: string | null }[] }>('/api/payments/sales'),
  ship: (orderId: string) =>
    api<{ message: string }>(`/api/payments/${orderId}/ship`, { method: 'POST' }),
};

export const watchlistApi = {
  list: () => api<{ items: WatchlistItem[] }>('/api/watchlist'),
  add: (auctionId: string) =>
    api<{ message: string }>('/api/watchlist', {
      method: 'POST',
      body: JSON.stringify({ auctionId }),
    }),
  remove: (auctionId: string) =>
    api<{ message: string }>(`/api/watchlist/${auctionId}`, { method: 'DELETE' }),
};

export const notificationsApi = {
  list: (params?: { page?: number; unread?: boolean }) =>
    api<{ notifications: Notification[]; total: number }>('/api/notifications', {
      params: params as Record<string, string>,
    }),
  markRead: (id: string) =>
    api<{ message: string }>(`/api/notifications/${id}/read`, { method: 'PATCH' }),
  markAllRead: () =>
    api<{ message: string }>('/api/notifications/read-all', { method: 'POST' }),
};

export const usersApi = {
  profile: () => api<UserProfile>('/api/users/profile'),
};

export const ordersApi = {
  myAuctions: () => api<{ auctions: Auction[] }>('/api/orders/my-auctions'),
};

export const categoriesApi = {
  list: () => api<{ categories: { id: string; name: string; slug: string }[] }>('/api/categories'),
};

export interface Auction {
  id: string;
  title: string;
  description: string;
  startingBid: number;
  currentBid: number;
  reservePrice?: number | null;
  minIncrement: number;
  startTime: string;
  endTime: string;
  status: string;
  approved?: boolean;
  featured?: boolean;
  images?: { url: string }[];
  image?: string;
  seller?: { user: { name: string } };
  category?: { name: string; slug: string };
}

export interface AuctionDetail extends Auction {
  bids: { id: string; amount: number; bidderName: string; createdAt: string }[];
}

export interface CreateAuctionInput {
  title: string;
  description: string;
  categoryId?: string;
  startingBid: number;
  reservePrice?: number;
  minIncrement?: number;
  startTime: string;
  endTime: string;
  imageUrls?: string[];
  antiSnipingMinutes?: number;
}

export interface MyBid {
  id: string;
  amount: number;
  createdAt: string;
  auction: { id: string; title: string; status: string; endTime: string; currentBid: number; image?: string };
}

export interface Order {
  id: string;
  amount: number;
  platformFee: number;
  sellerAmount: number;
  status: string;
  paidAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  auction: { id: string; title: string; images?: { url: string }[] };
  seller?: { user: { name: string } };
}

export interface WatchlistItem {
  id: string;
  auction: Auction & { image?: string };
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  read: boolean;
  link: string | null;
  createdAt: string;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatar: string | null;
  role: string;
  emailVerified: boolean;
  sellerProfile?: { verified: boolean; kycVerified: boolean };
}
