import Link from 'next/link';
import { Suspense } from 'react';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
        <Link key={a.id} href={`/auctions/${a.id}`}>
          <Card className="overflow-hidden hover:shadow-md transition-shadow h-full">
            <div className="aspect-video bg-muted relative">
              {a.images?.[0]?.url ? (
                <img src={a.images[0].url} alt={a.title} className="object-cover w-full h-full" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground">No image</div>
              )}
              {a.featured && (
                <span className="absolute top-2 left-2 bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded">
                  Featured
                </span>
              )}
              {a.status === 'LIVE' && (
                <span className="absolute top-2 right-2 bg-red-500 text-white text-xs px-2 py-0.5 rounded animate-pulse">
                  Live
                </span>
              )}
            </div>
            <CardHeader className="p-4">
              <h3 className="font-medium line-clamp-2">{a.title}</h3>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <p className="text-lg font-semibold text-primary">{formatPrice(a.currentBid)}</p>
              <p className="text-xs text-muted-foreground">{timeLeft(a.endTime)}</p>
            </CardContent>
            <CardFooter className="p-4 pt-0">
              <Button size="sm" className="w-full">View & Bid</Button>
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
  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold mb-6">Browse Auctions</h1>
      <div className="flex gap-2 mb-6">
        <a
          href="/auctions?status=LIVE"
          className={`px-4 py-2 rounded ${!params.status || params.status === 'LIVE' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}
        >
          Live
        </a>
        <a
          href="/auctions?status=UPCOMING"
          className={`px-4 py-2 rounded ${params.status === 'UPCOMING' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}
        >
          Upcoming
        </a>
        <a
          href="/auctions?status=ENDED"
          className={`px-4 py-2 rounded ${params.status === 'ENDED' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}
        >
          Ended
        </a>
      </div>
      <Suspense fallback={<p>Loading...</p>}>
        <AuctionsList searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
