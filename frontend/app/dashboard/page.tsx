'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { bidsApi, paymentsApi, notificationsApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatPrice } from '@/lib/utils';

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [bids, setBids] = useState<{ bids: { id: string; amount: number; createdAt: string; auction: { id: string; title: string; status: string; endTime: string } }[] } | null>(null);
  const [orders, setOrders] = useState<{ orders: { id: string; amount: number; status: string; auction: { title: string } }[] } | null>(null);
  const [notifications, setNotifications] = useState<{ notifications: { id: string; title: string; read: boolean; createdAt: string }[] } | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
    if (!user) return;
    bidsApi.myBids().then(setBids).catch(() => setBids({ bids: [] }));
    paymentsApi.orders().then(setOrders).catch(() => setOrders({ orders: [] }));
    notificationsApi.list({ page: 1 }).then(setNotifications).catch(() => setNotifications({ notifications: [] }));
  }, [user, authLoading, router]);

  if (authLoading || !user) return <div className="container py-8">Loading...</div>;

  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold mb-6">Dashboard</h1>
      <p className="text-muted-foreground mb-8">Welcome, {user.name}. Role: {user.role}</p>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">My Bids</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {(bids?.bids || []).slice(0, 5).map((b) => (
                <li key={b.id} className="flex justify-between text-sm">
                  <Link href={`/auctions/${b.auction.id}`} className="hover:underline truncate max-w-[180px]">
                    {b.auction.title}
                  </Link>
                  <span>{formatPrice(b.amount)}</span>
                </li>
              ))}
            </ul>
            <Link href="/dashboard/bids" className="text-sm text-primary mt-2 inline-block">View all</Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {(orders?.orders || []).slice(0, 5).map((o) => (
                <li key={o.id} className="flex justify-between text-sm">
                  <span className="truncate max-w-[180px]">{o.auction.title}</span>
                  <span>{formatPrice(o.amount)} - {o.status}</span>
                </li>
              ))}
            </ul>
            <Link href="/dashboard/orders" className="text-sm text-primary mt-2 inline-block">View all</Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Notifications</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {(notifications?.notifications || []).slice(0, 5).map((n) => (
                <li key={n.id} className={`text-sm ${!n.read ? 'font-medium' : 'text-muted-foreground'}`}>
                  {n.title}
                </li>
              ))}
            </ul>
            <Link href="/dashboard/notifications" className="text-sm text-primary mt-2 inline-block">View all</Link>
          </CardContent>
        </Card>
      </div>

      {user.role === 'SELLER' && (
        <div className="mt-8">
          <Link href="/dashboard/seller">
            <Button>Seller dashboard – My auctions & sales</Button>
          </Link>
        </div>
      )}
      {user.role === 'ADMIN' && (
        <div className="mt-8">
          <Link href="/dashboard/admin">
            <Button>Admin dashboard</Button>
          </Link>
        </div>
      )}
    </div>
  );
}
