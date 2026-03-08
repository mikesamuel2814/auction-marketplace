import Link from 'next/link';
import { auctionsApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { formatPrice, timeLeft } from '@/lib/utils';

export const revalidate = 30;

export default async function HomePage() {
  let data: { auctions: { id: string; title: string; currentBid: number; endTime: string; images?: { url: string }[]; featured?: boolean }[] } = { auctions: [] };
  try {
    data = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/auctions?status=LIVE&limit=8`,
      { next: { revalidate: 30 } }
    ).then((r) => r.json());
  } catch {
    // fallback for no API
  }
  const auctions = data.auctions || [];

  return (
    <div className="container py-8">
      <section className="mb-12 text-center">
        <h1 className="text-4xl font-bold tracking-tight mb-4">
          Trusted Online Auction Marketplace
        </h1>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto mb-6">
          List items, place bids, and win. Escrow-protected payments and 0.5% platform fee.
        </p>
        <div className="flex gap-4 justify-center">
          <Link href="/auctions">
            <Button size="lg">Browse Auctions</Button>
          </Link>
          <Link href="/register">
            <Button variant="outline" size="lg">Get Started</Button>
          </Link>
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mb-4">Live Auctions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {auctions.map((a) => (
            <Link key={a.id} href={`/auctions/${a.id}`}>
              <Card className="overflow-hidden hover:shadow-md transition-shadow h-full">
                <div className="aspect-video bg-muted relative">
                  {a.images?.[0]?.url ? (
                    <img
                      src={a.images[0].url}
                      alt={a.title}
                      className="object-cover w-full h-full"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                      No image
                    </div>
                  )}
                  {a.featured && (
                    <span className="absolute top-2 left-2 bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded">
                      Featured
                    </span>
                  )}
                </div>
                <CardHeader className="p-4">
                  <h3 className="font-medium line-clamp-2">{a.title}</h3>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <p className="text-lg font-semibold text-primary">{formatPrice(a.currentBid)}</p>
                  <p className="text-xs text-muted-foreground">{timeLeft(a.endTime)} left</p>
                </CardContent>
                <CardFooter className="p-4 pt-0">
                  <Button size="sm" className="w-full">View & Bid</Button>
                </CardFooter>
              </Card>
            </Link>
          ))}
        </div>
        {auctions.length === 0 && (
          <p className="text-muted-foreground text-center py-8">No live auctions yet. Check back soon.</p>
        )}
      </section>
    </div>
  );
}
