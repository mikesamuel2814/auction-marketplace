import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { formatPrice, timeLeft } from '@/lib/utils';

export const revalidate = 30;

async function getLiveAuctions() {
  try {
    const data = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/auctions?status=LIVE&limit=8`,
      { next: { revalidate: 30 } }
    ).then((r) => r.json());
    return data?.auctions ?? [];
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const auctions = await getLiveAuctions();

  return (
    <div className="min-h-full">
      {/* Hero - graymorphism elevated panel */}
      <section className="container py-12 sm:py-16">
        <div className="rounded-2xl border border-border/60 bg-card/80 shadow-gm-medium p-8 sm:p-12 text-center max-w-3xl mx-auto">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground mb-4">
            Trusted Online Auction Marketplace
          </h1>
          <p className="text-muted-foreground text-base sm:text-lg max-w-xl mx-auto mb-8">
            List items, place bids, and win. Escrow-protected payments and 0.5% platform fee.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link href="/auctions">
              <Button size="lg" className="rounded-xl min-w-[140px]">
                Browse Auctions
              </Button>
            </Link>
            <Link href="/register">
              <Button variant="outline" size="lg" className="rounded-xl min-w-[140px]">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Live Auctions - graymorphism section */}
      <section className="container pb-16">
        <div className="rounded-2xl border border-border/60 bg-card/50 shadow-gm-soft p-6 sm:p-8">
          <h2 className="text-xl font-semibold text-foreground mb-6">Live Auctions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {auctions.map((a: { id: string; title: string; currentBid: number; endTime: string; images?: { url: string }[]; featured?: boolean }) => (
              <Link key={a.id} href={`/auctions/${a.id}`} className="group block h-full">
                <Card className="overflow-hidden h-full transition-all duration-200 group-hover:shadow-gm-medium border-border/80">
                  <div className="aspect-video bg-muted/80 relative overflow-hidden">
                    {a.images?.[0]?.url ? (
                      <img
                        src={a.images[0].url}
                        alt={a.title}
                        className="object-cover w-full h-full group-hover:scale-[1.02] transition-transform duration-200"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
                        No image
                      </div>
                    )}
                    {a.featured && (
                      <span className="absolute top-2 left-2 bg-primary text-primary-foreground text-xs font-medium px-2 py-1 rounded-lg shadow-gm-soft">
                        Featured
                      </span>
                    )}
                  </div>
                  <CardHeader className="p-4 pb-0">
                    <h3 className="font-medium line-clamp-2 text-card-foreground">{a.title}</h3>
                  </CardHeader>
                  <CardContent className="p-4 pt-2">
                    <p className="text-lg font-semibold text-primary">{formatPrice(a.currentBid)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{timeLeft(a.endTime)} left</p>
                  </CardContent>
                  <CardFooter className="p-4 pt-0">
                    <Button size="sm" className="w-full rounded-xl">
                      View & Bid
                    </Button>
                  </CardFooter>
                </Card>
              </Link>
            ))}
          </div>
          {auctions.length === 0 && (
            <div className="rounded-xl border border-dashed border-border bg-muted/30 py-12 text-center">
              <p className="text-muted-foreground">No live auctions yet. Check back soon.</p>
              <Link href="/auctions" className="inline-block mt-4">
                <Button variant="outline" size="sm" className="rounded-xl">
                  Browse all
                </Button>
              </Link>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
