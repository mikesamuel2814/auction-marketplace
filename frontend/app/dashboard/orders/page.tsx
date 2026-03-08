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
  const [refundingId, setRefundingId] = useState<string | null>(null);

  const loadOrders = () => {
    if (!user) return;
    paymentsApi.orders().then(setOrders).catch(() => setOrders({ orders: [] }));
  };

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
    if (!user) return;
    loadOrders();
  }, [user, authLoading, router]);

  const handleRefund = async (orderId: string) => {
    setRefundingId(orderId);
    try {
      await paymentsApi.refund(orderId);
      loadOrders();
    } catch {
      setRefundingId(null);
    } finally {
      setRefundingId(null);
    }
  };

  if (authLoading || !user) return <div className="container py-8">Loading...</div>;

  const ordersList = orders?.orders ?? [];

  return (
    <div className="container py-8">
      <div className="rounded-2xl border border-border/60 bg-card/50 shadow-gm-soft p-6 sm:p-8 mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">My Orders</h1>
      </div>
      <div className="space-y-4">
        {ordersList.map((o) => (
          <Card key={o.id} className="rounded-xl border-border/80 shadow-gm-soft">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">{o.auction.title}</CardTitle>
              <span className={`text-sm font-medium ${o.status === 'REFUNDED' ? 'text-destructive' : 'text-muted-foreground'}`}>
                {o.status}
              </span>
            </CardHeader>
            <CardContent>
              <p className="font-medium text-primary">{formatPrice(o.amount)}</p>
              {o.status === 'PENDING' && (
                <Link href={`/dashboard/orders/${o.id}/pay`}>
                  <Button size="sm" className="mt-2 rounded-xl">Pay now</Button>
                </Link>
              )}
              {o.status === 'IN_ESCROW' && o.shippedAt && (
                <Link href={`/dashboard/orders/${o.id}/confirm`}>
                  <Button size="sm" className="mt-2 rounded-xl">Confirm delivery</Button>
                </Link>
              )}
              {user.role === 'ADMIN' && (o.status === 'IN_ESCROW' || o.status === 'RELEASED') && (
                <Button
                  variant="destructive"
                  size="sm"
                  className="mt-2 rounded-xl"
                  onClick={() => handleRefund(o.id)}
                  disabled={refundingId === o.id}
                >
                  {refundingId === o.id ? 'Refunding...' : 'Refund order'}
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
      {ordersList.length === 0 && (
        <p className="text-muted-foreground">No orders yet.</p>
      )}
    </div>
  );
}
