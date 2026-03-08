import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { prisma } from '../lib/prisma';

let io: Server | null = null;

interface JwtPayload {
  userId: string;
  email: string;
  role: string;
}

export function initSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: { origin: config.frontendUrl, methods: ['GET', 'POST'] },
    path: '/socket.io',
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) return next();
    try {
      const decoded = jwt.verify(String(token), config.jwt.secret) as JwtPayload;
      (socket as Socket & { userId?: string }).userId = decoded.userId;
    } catch (_) {}
    next();
  });

  io.on('connection', (socket: Socket & { userId?: string }) => {
    const emitViewerCount = (auctionId: string) => {
      const s = getIo();
      if (!s) return;
      const room = s.sockets.adapter.rooms.get(`auction:${auctionId}`);
      const count = room ? room.size : 0;
      s.to(`auction:${auctionId}`).emit('viewerCount', { auctionId, count });
    };

    socket.on('joinAuction', (auctionId: string) => {
      socket.join(`auction:${auctionId}`);
      emitViewerCount(auctionId);
    });
    socket.on('leaveAuction', (auctionId: string) => {
      socket.leave(`auction:${auctionId}`);
      emitViewerCount(auctionId);
    });
    socket.on('disconnect', () => {
      const rooms = Array.from(socket.rooms).filter((r) => r.startsWith('auction:'));
      rooms.forEach((r) => {
        const auctionId = r.replace('auction:', '');
        socket.leave(r);
        setImmediate(() => emitViewerCount(auctionId));
      });
    });
  });

  return io;
}

export function getIo(): Server | null {
  return io;
}
