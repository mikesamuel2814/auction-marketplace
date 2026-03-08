'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { auctionsApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function CreateListingPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startingBid, setStartingBid] = useState('');
  const [reservePrice, setReservePrice] = useState('');
  const [minIncrement, setMinIncrement] = useState('100');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [imageUrls, setImageUrls] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const start = startTime ? new Date(startTime).toISOString() : new Date().toISOString();
      const end = endTime ? new Date(endTime).toISOString() : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      await auctionsApi.create({
        title,
        description,
        startingBid: Number(startingBid),
        reservePrice: reservePrice ? Number(reservePrice) : undefined,
        minIncrement: Number(minIncrement) || 100,
        startTime: start,
        endTime: end,
        imageUrls: imageUrls ? imageUrls.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
      });
      router.push('/dashboard/seller');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create listing');
    } finally {
      setLoading(false);
    }
  };

  if (!user || (user.role !== 'SELLER' && user.role !== 'ADMIN')) {
    router.push('/dashboard');
    return null;
  }

  return (
    <div className="container max-w-xl py-8">
      <Card>
        <CardHeader>
          <CardTitle>Create auction listing</CardTitle>
          <CardDescription>Fill in the details for your item</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div>
              <Label htmlFor="title">Title</Label>
              <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required className="mt-1" />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                rows={4}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="startingBid">Starting bid (BDT)</Label>
                <Input
                  id="startingBid"
                  type="number"
                  min={1}
                  value={startingBid}
                  onChange={(e) => setStartingBid(e.target.value)}
                  required
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="reservePrice">Reserve price (BDT, optional)</Label>
                <Input
                  id="reservePrice"
                  type="number"
                  min={0}
                  value={reservePrice}
                  onChange={(e) => setReservePrice(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="minIncrement">Min bid increment (BDT)</Label>
                <Input
                  id="minIncrement"
                  type="number"
                  min={1}
                  value={minIncrement}
                  onChange={(e) => setMinIncrement(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="startTime">Start time</Label>
                <Input
                  id="startTime"
                  type="datetime-local"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="endTime">End time</Label>
                <Input
                  id="endTime"
                  type="datetime-local"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  required
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="imageUrls">Image URLs (comma-separated, optional)</Label>
              <Input
                id="imageUrls"
                value={imageUrls}
                onChange={(e) => setImageUrls(e.target.value)}
                placeholder="https://..."
                className="mt-1"
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'Creating...' : 'Create listing'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
