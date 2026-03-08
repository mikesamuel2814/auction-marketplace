'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { bidsApi, paymentsApi, notificationsApi, buyerApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatPrice } from '@/lib/utils';

type RecentAuction = { id: string; title: string; currentBid: number; endTime: string; status: string; image?: string };

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [bids, setBids] = useState<{ bids: { id: string; amount: number; createdAt: string; auction: { id: string; title: string; status: string; endTime: string } }[] } | null>(null);
  const [orders, setOrders] = useState<{ orders: { id: string; amount: number; status: string; auction: { title: string } }[] } | null>(null);
  const [notifications, setNotifications] = useState<{ notifications: { id: string; title: string; read: boolean; createdAt: string }[] } | null>(null);
  const [recentlyViewed, setRecentlyViewed] = useState<{ items: { id: string; viewedAt: string; auction: RecentAuction }[] } | null>(null);
  const [savedSearches, setSavedSearches] = useState<{ items: { id: string; query: string; filters?: { status?: string; search?: string } }[] } | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
    if (!user) return;
    bidsApi.myBids().then(setBids).catch(() => setBids({ bids: [] }));
    paymentsApi.orders().then(setOrders).catch(() => setOrders({ orders: [] }));
    notificationsApi.list({ page: 1 }).then(setNotifications).catch(() => setNotifications({ notifications: [] }));
    buyerApi.recentlyViewed.list(8).then(setRecentlyViewed).catch(() => setRecentlyViewed({ items: [] }));
    buyerApi.savedSearches.list().then(setSavedSearches).catch(() => setSavedSearches({ items: [] }));
  }, [user, authLoading, router]);

  if (authLoading || !user) return <div className="container py-8">Loading...</div>;

  const recentItems = recentlyViewed?.items ?? [];

  return (
    <div className="container py-8">
      <div className="rounded-2xl border border-border/60 bg-card/50 shadow-gm-soft p-6 sm:p-8 mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">Dashboard</h1>
        <p className="text-muted-foreground">Welcome, {user.name}. Role: {user.role}</p>
      </div>

      {recentItems.length > 0 && (
        <Card className="rounded-xl border-border/80 shadow-gm-soft mb-8">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Recently viewed</CardTitle>
            <Link href="/auctions">
              <Button variant="ghost" size="sm" className="rounded-xl">Browse all</Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {recentItems.map((r) => (
                <Link key={r.id} href={`/auctions/${r.auction.id}`} className="group block">
                  <div className="rounded-lg border border-border/60 bg-muted/30 overflow-hidden aspect-video mb-1">
                    {r.auction.image ? (
                      <img src={r.auction.image} alt="" className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">No image</div>
                    )}
                  </div>
                  <p className="text-sm font-medium truncate">{r.auction.title}</p>
                  <p className="text-xs text-primary">{formatPrice(r.auction.currentBid)}</p>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {(savedSearches?.items?.length ?? 0) > 0 && (
        <Card className="rounded-xl border-border/80 shadow-gm-soft mb-8">
          <CardHeader>
            <CardTitle className="text-lg">Saved searches</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-wrap gap-2">
              {savedSearches!.items.map((s) => {
                const status = (s.filters as { status?: string } | undefined)?.status ?? 'LIVE';
                const search = (s.filters as { search?: string } | undefined)?.search ?? '';
                const href = search ? `/auctions?status=${status}&search=${encodeURIComponent(search)}` : `/auctions?status=${status}`;
                return (
                  <li key={s.id}>
                    <Link href={href}>
                      <Button variant="secondary" size="sm" className="rounded-xl">{s.query} ({status})</Button>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="rounded-xl border-border/80 shadow-gm-soft">
          <CardHeader>
            <CardTitle className="text-lg">My Bids</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {(bids?.bids || []).slice(0, 5).map((b) => (
                <li key={b.id} className="flex justify-between text-sm py-1">
                  <Link href={`/auctions/${b.auction.id}`} className="hover:text-primary truncate max-w-[180px] transition-colors">
                    {b.auction.title}
                  </Link>
                  <span className="font-medium">{formatPrice(b.amount)}</span>
                </li>
              ))}
            </ul>
            <Link href="/dashboard/bids" className="text-sm text-primary mt-2 inline-block hover:underline">View all</Link>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-border/80 shadow-gm-soft">
          <CardHeader>
            <CardTitle className="text-lg">Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {(orders?.orders || []).slice(0, 5).map((o) => (
                <li key={o.id} className="flex justify-between text-sm py-1">
                  <span className="truncate max-w-[180px]">{o.auction.title}</span>
                  <span>{formatPrice(o.amount)} — {o.status}</span>
                </li>
              ))}
            </ul>
            <Link href="/dashboard/orders" className="text-sm text-primary mt-2 inline-block hover:underline">View all</Link>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-border/80 shadow-gm-soft">
          <CardHeader>
            <CardTitle className="text-lg">Notifications</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {(notifications?.notifications || []).slice(0, 5).map((n) => (
                <li key={n.id} className={`text-sm py-1 ${!n.read ? 'font-medium' : 'text-muted-foreground'}`}>
                  {n.title}
                </li>
              ))}
            </ul>
            <Link href="/dashboard/notifications" className="text-sm text-primary mt-2 inline-block hover:underline">View all</Link>
          </CardContent>
        </Card>
      </div>

      {(user.role === 'SELLER' || user.role === 'ADMIN') && (
        <div className="mt-8 flex flex-wrap gap-3">
          {user.role === 'SELLER' && (
            <Link href="/dashboard/seller">
              <Button variant="outline" className="rounded-xl">Seller dashboard</Button>
            </Link>
          )}
          {user.role === 'ADMIN' && (
            <Link href="/dashboard/admin">
              <Button variant="outline" className="rounded-xl">Admin dashboard</Button>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
