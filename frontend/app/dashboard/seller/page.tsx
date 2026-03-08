'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { ordersApi, paymentsApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatPrice } from '@/lib/utils';

type Sale = { id: string; amount: number; status: string; auctionTitle: string; sellerAmount: number };
type AuctionRow = { id: string; title: string; status: string; currentBid: number; endTime: string };

export default function SellerDashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [auctions, setAuctions] = useState<{ auctions: AuctionRow[] } | null>(null);
  const [sales, setSales] = useState<{ sales: Sale[] } | null>(null);

  useEffect(() => {
    if (!authLoading && (!user || (user.role !== 'SELLER' && user.role !== 'ADMIN'))) {
      router.push('/dashboard');
      return;
    }
    if (!user) return;
    ordersApi.myAuctions().then(setAuctions).catch(() => setAuctions({ auctions: [] }));
    paymentsApi.sales().then(setSales).catch(() => setSales({ sales: [] }));
  }, [user, authLoading, router]);

  if (authLoading || !user) return <div className="container py-8">Loading...</div>;

  const salesList = sales?.sales ?? [];
  const totalRevenue = salesList
    .filter((s) => s.status === 'RELEASED')
    .reduce((sum, s) => sum + (s.sellerAmount ?? s.amount), 0);
  const releasedCount = salesList.filter((s) => s.status === 'RELEASED').length;

  return (
    <div className="container py-8">
      <div className="rounded-2xl border border-border/60 bg-card/50 shadow-gm-soft p-6 sm:p-8 mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">Seller Dashboard</h1>
        <p className="text-muted-foreground mb-6">Manage your listings and track sales.</p>
        <Link href="/dashboard/seller/create">
          <Button className="rounded-xl shadow-gm-soft">Create new listing</Button>
        </Link>
      </div>

      <div className="grid md:grid-cols-3 gap-4 mb-8">
        <Card className="rounded-xl border-border/80 shadow-gm-soft overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total released revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-primary">{formatPrice(totalRevenue)}</p>
            <p className="text-xs text-muted-foreground mt-1">{releasedCount} orders completed</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl border-border/80 shadow-gm-soft overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active listings</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">
              {(auctions?.auctions ?? []).filter((a) => a.status === 'LIVE' || a.status === 'UPCOMING').length}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Live + upcoming</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl border-border/80 shadow-gm-soft overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total sales</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">{salesList.length}</p>
            <p className="text-xs text-muted-foreground mt-1">All time</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="rounded-xl border-border/80 shadow-gm-soft">
          <CardHeader>
            <CardTitle className="text-lg">My Auctions</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {(auctions?.auctions ?? []).map((a) => (
                <li key={a.id} className="flex justify-between items-center text-sm py-2 border-b border-border/50 last:border-0">
                  <Link href={`/auctions/${a.id}`} className="hover:text-primary truncate flex-1 mr-2 transition-colors">
                    {a.title}
                  </Link>
                  <span className="text-muted-foreground shrink-0">{a.status}</span>
                  <span className="font-medium ml-2 shrink-0">{formatPrice(a.currentBid)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-border/80 shadow-gm-soft">
          <CardHeader>
            <CardTitle className="text-lg">Sales</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {salesList.map((s) => (
                <li key={s.id} className="flex justify-between text-sm py-2 border-b border-border/50 last:border-0">
                  <span className="truncate flex-1 mr-2">{s.auctionTitle}</span>
                  <span className="shrink-0">
                    {formatPrice(s.amount)} — <span className={s.status === 'REFUNDED' ? 'text-destructive' : 'text-muted-foreground'}>{s.status}</span>
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
