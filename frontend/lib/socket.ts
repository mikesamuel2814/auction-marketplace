import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || process.env.NEXT_PUBLIC_API_URL || '';

let socket: Socket | null = null;

export function getSocket(token?: string | null): Socket | null {
  if (typeof window === 'undefined') return null;
  if (socket?.connected) return socket;
  socket = io(SOCKET_URL, {
    path: '/socket.io',
    auth: { token: token ?? undefined },
    transports: ['websocket', 'polling'],
  });
  return socket;
}

export function joinAuction(auctionId: string, token?: string | null) {
  const s = getSocket(token);
  s?.emit('joinAuction', auctionId);
}

export function leaveAuction(auctionId: string) {
  socket?.emit('leaveAuction', auctionId);
}

export function onNewBid(cb: (data: { bid: { id: string; amount: number; bidderName?: string; createdAt?: string }; currentBid: number }) => void) {
  socket?.on('newBid', cb);
}

export function onAuctionEnded(cb: (data: { winnerId: string; orderId: string; amount: number }) => void) {
  socket?.on('auctionEnded', cb);
}

export function onViewerCount(cb: (data: { auctionId: string; count: number }) => void) {
  socket?.on('viewerCount', cb);
}

export function offNewBid() {
  socket?.off('newBid');
}

export function offAuctionEnded() {
  socket?.off('auctionEnded');
}

export function offViewerCount() {
  socket?.off('viewerCount');
}
