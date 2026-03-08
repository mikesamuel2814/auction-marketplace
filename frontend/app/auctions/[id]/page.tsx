import { notFound } from 'next/navigation';
import { AuctionDetailClient } from './AuctionDetailClient';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

async function getAuction(id: string) {
  const res = await fetch(`${API_URL}/api/auctions/${id}`, { next: { revalidate: 5 } });
  if (!res.ok) return null;
  return res.json();
}

export default async function AuctionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auction = await getAuction(id);
  if (!auction) notFound();
  return <AuctionDetailClient initialAuction={auction} />;
}
