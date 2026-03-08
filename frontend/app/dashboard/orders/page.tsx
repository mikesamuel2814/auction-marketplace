'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { paymentsApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatPrice } from '@/lib/utils';

export default function OrdersPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<{ orders: { id: string; amount: number; status: string; auction: { id: string; title: string }; paidAt: string | null; shippedAt: string | null; deliveredAt: string | null }[] } | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
    if (!user) return;
    paymentsApi.orders().then(setOrders).catch(() => setOrders({ orders: [] }));
  }, [user, authLoading, router]);

  if (authLoading || !user) return <div className="container py-8">Loading...</div>;

  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold mb-6">My Orders</h1>
      <div className="space-y-4">
        {(orders?.orders || []).map((o) => (
          <Card key={o.id}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">{o.auction.title}</CardTitle>
              <span className="text-sm text-muted-foreground">{o.status}</span>
            </CardHeader>
            <CardContent>
              <p className="font-medium text-primary">{formatPrice(o.amount)}</p>
              {o.status === 'PENDING' && (
                <Link href={`/dashboard/orders/${o.id}/pay`}>
                  <Button size="sm" className="mt-2">Pay now</Button>
                </Link>
              )}
              {o.status === 'IN_ESCROW' && o.shippedAt && (
                <Link href={`/dashboard/orders/${o.id}/confirm`}>
                  <Button size="sm" className="mt-2">Confirm delivery</Button>
                </Link>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
      {(orders?.orders || []).length === 0 && (
        <p className="text-muted-foreground">No orders yet.</p>
      )}
    </div>
  );
}
