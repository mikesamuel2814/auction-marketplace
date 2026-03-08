'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { joinAuction, leaveAuction, onNewBid, offNewBid, onAuctionEnded, offAuctionEnded, onViewerCount, offViewerCount } from '@/lib/socket';
import { bidsApi, watchlistApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatPrice, timeLeft, formatDate } from '@/lib/utils';

interface AuctionDetailClientProps {
  initialAuction: {
    id: string;
    title: string;
    description: string;
    startingBid: number;
    currentBid: number;
    reservePrice?: number | null;
    minIncrement: number;
    startTime: string;
    endTime: string;
    status: string;
    seller?: { user: { name: string } };
    images?: { url: string }[];
    bids: { id: string; amount: number; bidderName: string; createdAt: string }[];
    viewCount?: number;
  };
}

export function AuctionDetailClient({ initialAuction }: AuctionDetailClientProps) {
  const { user, token } = useAuth();
  const toast = useToast();
  const [auction, setAuction] = useState(initialAuction);
  const [bidAmount, setBidAmount] = useState('');
  const [autoBidMax, setAutoBidMax] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(timeLeft(initialAuction.endTime));
  const [viewerCount, setViewerCount] = useState(0);
  const [lastBidFlash, setLastBidFlash] = useState(false);

  useEffect(() => {
    joinAuction(initialAuction.id, token);
    const handleBid = (data: { bid: { amount: number; bidderName?: string }; currentBid: number }) => {
      setAuction((prev) => ({
        ...prev,
        currentBid: data.currentBid,
        bids: [
          {
            id: `live-${Date.now()}`,
            amount: data.currentBid,
            bidderName: data.bid.bidderName ?? 'Someone',
            createdAt: new Date().toISOString(),
          },
          ...prev.bids,
        ],
      }));
      setLastBidFlash(true);
      setTimeout(() => setLastBidFlash(false), 600);
    };
    const handleEnded = () => {
      setAuction((prev) => ({ ...prev, status: 'ENDED' }));
      toast.addToast('This auction has ended.', 'info');
    };
    const handleViewerCount = (data: { auctionId: string; count: number }) => {
      if (data.auctionId === initialAuction.id) setViewerCount(data.count);
    };
    onNewBid(handleBid);
    onAuctionEnded(handleEnded);
    onViewerCount(handleViewerCount);
    const t = setInterval(() => setCountdown(timeLeft(initialAuction.endTime)), 1000);
    return () => {
      offNewBid();
      offAuctionEnded();
      offViewerCount();
      leaveAuction(initialAuction.id);
      clearInterval(t);
    };
  }, [initialAuction.id, initialAuction.endTime, token, toast]);

  const minBid = auction.currentBid + auction.minIncrement;
  const isLive = auction.status === 'LIVE';
  const canBid = user && isLive && new Date(auction.endTime) > new Date();

  const handlePlaceBid = async () => {
    const amount = Number(bidAmount);
    if (amount < minBid) {
      setError(`Minimum bid is ${formatPrice(minBid)}`);
      toast.addToast(`Minimum bid is ${formatPrice(minBid)}`, 'error');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await bidsApi.place(auction.id, amount);
      setAuction((prev) => ({ ...prev, currentBid: amount }));
      setBidAmount('');
      toast.addToast('Bid placed successfully!', 'success');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Bid failed';
      setError(msg);
      toast.addToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAutoBid = async () => {
    const max = Number(autoBidMax);
    if (max < minBid) {
      setError(`Max must be at least ${formatPrice(minBid)}`);
      toast.addToast(`Max must be at least ${formatPrice(minBid)}`, 'error');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await bidsApi.setAutoBid(auction.id, max);
      setAutoBidMax('');
      toast.addToast('Auto-bid updated.', 'success');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Auto-bid failed';
      setError(msg);
      toast.addToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container py-8">
      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          <div className="aspect-video bg-muted rounded-lg overflow-hidden">
            {auction.images?.[0]?.url ? (
              <img src={auction.images[0].url} alt={auction.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground">No image</div>
            )}
          </div>
          <Card>
            <CardHeader>
              <CardTitle>{auction.title}</CardTitle>
              <p className="text-sm text-muted-foreground">Seller: {auction.seller?.user?.name}</p>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap">{auction.description}</p>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className={lastBidFlash ? 'ring-2 ring-primary animate-pulse' : ''}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm text-muted-foreground">Current bid</p>
                  <p className="text-2xl font-bold text-primary transition-all">{formatPrice(auction.currentBid)}</p>
                </div>
                <div className="flex items-center gap-2">
                  {isLive && viewerCount > 0 && (
                    <span className="text-xs text-muted-foreground" title="Viewers">
                      {viewerCount} watching
                    </span>
                  )}
                  {isLive && (
                    <span className="bg-red-500 text-white text-xs px-2 py-1 rounded animate-pulse">Live</span>
                  )}
                </div>
              </div>
              <p className="text-sm">Min increment: {formatPrice(auction.minIncrement)}</p>
              <p className="text-sm font-medium">Time left: {countdown}</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {error && <p className="text-sm text-destructive">{error}</p>}
              {canBid && (
                <>
                  <div>
                    <label className="text-sm">Your bid (min {formatPrice(minBid)})</label>
                    <div className="flex gap-2 mt-1">
                      <Input
                        type="number"
                        min={minBid}
                        step={auction.minIncrement}
                        value={bidAmount}
                        onChange={(e) => setBidAmount(e.target.value)}
                        placeholder={String(minBid)}
                      />
                      <Button onClick={handlePlaceBid} disabled={loading}>Place bid</Button>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm">Auto-bid max (optional)</label>
                    <div className="flex gap-2 mt-1">
                      <Input
                        type="number"
                        min={minBid}
                        value={autoBidMax}
                        onChange={(e) => setAutoBidMax(e.target.value)}
                        placeholder="e.g. 150000"
                      />
                      <Button variant="outline" onClick={handleAutoBid} disabled={loading}>Set auto-bid</Button>
                    </div>
                  </div>
                </>
              )}
              {!user && isLive && (
                <p className="text-sm text-muted-foreground">Log in to place a bid.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Live bid history</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {auction.bids.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No bids yet.</p>
                ) : (
                  auction.bids.map((b, i) => (
                    <div
                      key={b.id}
                      className={`flex justify-between text-sm py-1 px-2 rounded ${i === 0 ? 'bg-primary/10 font-medium' : ''}`}
                    >
                      <span>{b.bidderName}</span>
                      <span className="font-medium">{formatPrice(b.amount)}</span>
                      <span className="text-muted-foreground text-xs">{formatDate(b.createdAt)}</span>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
