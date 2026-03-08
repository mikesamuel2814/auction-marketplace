'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { ordersApi, paymentsApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatPrice } from '@/lib/utils';

export default function SellerDashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [auctions, setAuctions] = useState<{ auctions: { id: string; title: string; status: string; currentBid: number; endTime: string }[] } | null>(null);
  const [sales, setSales] = useState<{ sales: { id: string; amount: number; status: string; auctionTitle: string }[] } | null>(null);

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

  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold mb-6">Seller Dashboard</h1>
      <Link href="/dashboard/seller/create" className="inline-block mb-6">
        <Button>Create new listing</Button>
      </Link>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>My Auctions</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {(auctions?.auctions || []).map((a) => (
                <li key={a.id} className="flex justify-between items-center text-sm">
                  <Link href={`/auctions/${a.id}`} className="hover:underline truncate flex-1 mr-2">
                    {a.title}
                  </Link>
                  <span className="text-muted-foreground">{a.status}</span>
                  <span className="font-medium ml-2">{formatPrice(a.currentBid)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sales</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {(sales?.sales || []).map((s) => (
                <li key={s.id} className="flex justify-between text-sm">
                  <span className="truncate flex-1">{s.auctionTitle}</span>
                  <span>{formatPrice(s.amount)} - {s.status}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
