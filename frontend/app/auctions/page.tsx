import Link from 'next/link';
import { Suspense } from 'react';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SaveSearchButton } from '@/components/SaveSearchButton';
import { formatPrice, timeLeft } from '@/lib/utils';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

async function AuctionsList({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; search?: string; page?: string }>;
}) {
  const params = await searchParams;
  const status = params.status || 'LIVE';
  const search = params.search || '';
  const page = params.page || '1';
  const url = new URL('/api/auctions', API_URL);
  url.searchParams.set('status', status);
  url.searchParams.set('page', page);
  url.searchParams.set('limit', '12');
  if (search) url.searchParams.set('search', search);

  const data = await fetch(url.toString(), { next: { revalidate: 10 } }).then((r) => r.json());
  const auctions = data.auctions || [];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {auctions.map((a: { id: string; title: string; currentBid: number; endTime: string; status: string; images?: { url: string }[]; featured?: boolean }) => (
        <Link key={a.id} href={`/auctions/${a.id}`} className="group block h-full">
          <Card className="overflow-hidden h-full transition-all duration-200 group-hover:shadow-gm-medium border-border/80">
            <div className="aspect-video bg-muted/80 relative overflow-hidden">
              {a.images?.[0]?.url ? (
                <img src={a.images[0].url} alt={a.title} className="object-cover w-full h-full group-hover:scale-[1.02] transition-transform duration-200" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">No image</div>
              )}
              {a.featured && (
                <span className="absolute top-2 left-2 bg-primary text-primary-foreground text-xs font-medium px-2 py-1 rounded-lg shadow-gm-soft">
                  Featured
                </span>
              )}
              {a.status === 'LIVE' && (
                <span className="absolute top-2 right-2 bg-red-500 text-white text-xs font-medium px-2 py-1 rounded-lg animate-pulse shadow-gm-soft">
                  Live
                </span>
              )}
            </div>
            <CardHeader className="p-4">
              <h3 className="font-medium line-clamp-2 text-card-foreground">{a.title}</h3>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <p className="text-lg font-semibold text-primary">{formatPrice(a.currentBid)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{timeLeft(a.endTime)}</p>
            </CardContent>
            <CardFooter className="p-4 pt-0">
              <Button size="sm" className="w-full rounded-xl">View & Bid</Button>
            </CardFooter>
          </Card>
        </Link>
      ))}
    </div>
  );
}

export default async function AuctionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; search?: string; page?: string }>;
}) {
  const params = await searchParams;
  const statusParam = params.status || 'LIVE';
  return (
    <div className="container py-8">
      <div className="rounded-2xl border border-border/60 bg-card/50 shadow-gm-soft p-6 sm:p-8 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Browse Auctions</h1>
          <SaveSearchButton query={params.search ?? ''} status={statusParam} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/auctions?status=LIVE">
            <Button variant={statusParam === 'LIVE' ? 'default' : 'secondary'} size="sm" className="rounded-xl">
              Live
            </Button>
          </Link>
          <Link href="/auctions?status=UPCOMING">
            <Button variant={statusParam === 'UPCOMING' ? 'default' : 'secondary'} size="sm" className="rounded-xl">
              Upcoming
            </Button>
          </Link>
          <Link href="/auctions?status=ENDED">
            <Button variant={statusParam === 'ENDED' ? 'default' : 'secondary'} size="sm" className="rounded-xl">
              Ended
            </Button>
          </Link>
        </div>
      </div>
      <Suspense fallback={<p className="text-muted-foreground py-8">Loading...</p>}>
        <AuctionsList searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
