import 'dotenv/config';
import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import http from 'http';
import bodyParser from 'body-parser';
import { config } from './config';
import { generalLimiter, authLimiter, bidLimiter } from './middleware/rateLimit';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import auctionRoutes from './routes/auctions';
import bidRoutes from './routes/bids';
import paymentRoutes, { stripeWebhookHandler } from './routes/payments';
import reviewRoutes from './routes/reviews';
import notificationRoutes from './routes/notifications';
import watchlistRoutes from './routes/watchlist';
import adminRoutes from './routes/admin';
import categoryRoutes from './routes/categories';
import orderRoutes from './routes/orders';
import disputeRoutes from './routes/disputes';
import buyerRoutes from './routes/buyer';
import { initSocket } from './socket';
import { processEndedAuctions, startUpcomingAuctions } from './services/auctionClose';
import { errorHandler } from './middleware/errorHandler';
import './config/passport';

const app = express();
const httpServer = http.createServer(app);

initSocket(httpServer);

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: config.frontendUrl, credentials: true }));

// Stripe webhook must receive raw body
app.post(
  '/api/payments/webhook',
  bodyParser.raw({ type: 'application/json' }),
  stripeWebhookHandler
);
app.use(express.json());
app.use(generalLimiter);

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/auctions', auctionRoutes);
app.use('/api/bids', bidLimiter, bidRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/watchlist', watchlistRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/disputes', disputeRoutes);
app.use('/api/buyer', buyerRoutes);

app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.use(errorHandler);

// Process ended auctions and start upcoming ones every minute
setInterval(() => {
  processEndedAuctions().catch((err) => console.error('processEndedAuctions:', err));
  startUpcomingAuctions().catch((err) => console.error('startUpcomingAuctions:', err));
}, 60 * 1000);

httpServer.listen(config.port, () => {
  console.log(`Server running on port ${config.port}`);
});
