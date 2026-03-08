'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { paymentsApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function ConfirmDeliveryPage() {
  const params = useParams();
  const orderId = params.id as string;
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading, router]);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await paymentsApi.confirmDelivery(orderId);
      setDone(true);
      setTimeout(() => router.push('/dashboard/orders'), 2000);
    } catch (e) {
      setLoading(false);
    }
  };

  if (authLoading || !user) return <div className="container py-8">Loading...</div>;

  return (
    <div className="container max-w-md py-8">
      <Card>
        <CardHeader>
          <CardTitle>Confirm delivery</CardTitle>
        </CardHeader>
        <CardContent>
          {done ? (
            <p className="text-green-600">Delivery confirmed. Payment has been released to the seller.</p>
          ) : (
            <>
              <p className="text-muted-foreground mb-4">
                Confirm that you have received the item. This will release the payment to the seller.
              </p>
              <Button onClick={handleConfirm} disabled={loading} className="w-full">
                {loading ? 'Confirming...' : 'I received the item'}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
