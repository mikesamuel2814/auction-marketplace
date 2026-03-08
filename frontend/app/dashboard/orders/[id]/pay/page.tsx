'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { paymentsApi } from '@/lib/api';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || 'pk_test_placeholder');

function CheckoutForm({ orderId, clientSecret }: { orderId: string; clientSecret: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setLoading(true);
    setError('');
    try {
      const { error: err } = await stripe.confirmPayment({
        elements,
        confirmParams: { return_url: `${window.location.origin}/dashboard/orders` },
      });
      if (err) setError(err.message || 'Payment failed');
      else router.push('/dashboard/orders');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement />
      {error && <p className="text-sm text-destructive mt-2">{error}</p>}
      <Button type="submit" disabled={!stripe || loading} className="mt-4 w-full">
        {loading ? 'Processing...' : 'Pay now'}
      </Button>
    </form>
  );
}

export default function PayOrderPage() {
  const params = useParams();
  const orderId = params.id as string;
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
    if (!user) return;
    paymentsApi
      .createIntent(orderId)
      .then((data) => setClientSecret(data.clientSecret))
      .catch((e) => setErr(e instanceof Error ? e.message : 'Failed to load payment'));
  }, [user, authLoading, orderId, router]);

  if (authLoading || !user) return <div className="container py-8">Loading...</div>;
  if (err) return <div className="container py-8 text-destructive">{err}</div>;
  if (!clientSecret) return <div className="container py-8">Preparing payment...</div>;

  return (
    <div className="container max-w-md py-8">
      <Card>
        <CardHeader>
          <CardTitle>Complete payment</CardTitle>
        </CardHeader>
        <CardContent>
          <Elements stripe={stripePromise} options={{ clientSecret }}>
            <CheckoutForm orderId={orderId} clientSecret={clientSecret} />
          </Elements>
        </CardContent>
      </Card>
    </div>
  );
}
