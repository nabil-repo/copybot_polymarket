import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { marketRouter } from './routes/markets.js';
import { leaderboardRouter } from './routes/leaderboard.js';
import { authRouter } from './routes/auth.js';
import { userRouter } from './routes/user.js';
import { initDb, query } from './services/db.js';
import { tradeRouter } from './routes/trades.js';
import { webhookRouter } from './routes/webhooks.js';
import { PolymarketWebSocketClient } from './services/polymarket-ws.js';
import { PythPriceService } from './services/pyth-price.js';
import { WalletMonitorService } from './services/wallet-monitor.js';
import { TradeExecutionService } from './services/trade-executor.js';

dotenv.config();
initDb();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true
});

console.log('🔌 Socket.io server configured with CORS origin:', process.env.FRONTEND_URL || 'http://localhost:3000');

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// Routes
app.use('/api/markets', marketRouter);
app.use('/api/trades', tradeRouter);
app.use('/api/webhooks', webhookRouter);
app.use('/api/leaderboard', leaderboardRouter);
app.use('/api/auth', authRouter);
app.use('/api/user', userRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Initialize services
const polymarketWs = new PolymarketWebSocketClient();
const pythPrice = new PythPriceService();
const walletMonitor = new WalletMonitorService();
const tradeExecutor = new TradeExecutionService();

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('✅ Client connected:', socket.id);
  console.log('🔗 Transport:', socket.conn.transport.name);
  console.log('👤 Client address:', socket.handshake.address);

  // Subscribe to market updates
  socket.on('subscribe:markets', (marketIds) => {
    console.log('📊 Subscribing to markets:', marketIds);
    socket.join(marketIds.map(id => `market:${id}`));
  });

  // Subscribe to wallet updates
  socket.on('subscribe:wallet', (walletAddress) => {
    console.log('👛 Subscribing to wallet:', walletAddress);
    socket.join(`wallet:${walletAddress}`);
  });

  // Subscribe to user-specific updates (supports numeric id or wallet address id)
  socket.on('subscribe:user', (userId) => {
    try {
      if (!userId) return;
      console.log('👤 Subscribing to user:', userId);
      socket.join(`user:${userId}`);
    } catch (e) {
      console.error('Failed to subscribe to user room', e);
    }
  });

  socket.on('disconnect', () => {
    console.log('❌ Client disconnected:', socket.id);
  });
});

// Socket.io error handling
io.engine.on('connection_error', (err) => {
  console.error('🔴 Socket.io connection error:', err);
});

// Polymarket WebSocket event handlers
polymarketWs.on('trade', (trade) => {
  io.to(`market:${trade.marketId}`).emit('market:trade', trade);
});

polymarketWs.on('orderbook', (update) => {
  io.to(`market:${update.marketId}`).emit('market:orderbook', update);
});

// Wallet monitor event handlers
walletMonitor.on('newTrade', async (event) => {
  console.log('🔔 New trade detected:', event);
  io.to(`wallet:${event.wallet}`).emit('wallet:trade', event);
  
  // Find all users monitoring this wallet and execute copy trades for each
  try {
    const users = await query(
      'SELECT DISTINCT u.id, u.email, u.execution_wallet FROM users u JOIN user_wallets uw ON u.id = uw.user_id WHERE uw.wallet = ?',
      [event.wallet]
    );
    
    if (!users || users.length === 0) {
      console.log(`⚠️  No users monitoring wallet ${event.wallet}`);
      return;
    }
    
    console.log(`👥 Executing copy trades for ${users.length} user(s)`);
    // Also emit detection to each user room. If a user is a wallet-auth user, they may subscribe using their wallet address as id
    for (const user of users) {
      io.to(`user:${user.id}`).emit('wallet:trade', event);
      // If user email starts with wallet:addr, also emit to that room id
      if (user.email?.startsWith('wallet:')) {
        const walletId = user.email.replace('wallet:', '').toLowerCase();
        io.to(`user:${walletId}`).emit('wallet:trade', event);
      }
      console.log(`➡️ Emitted trade detection to user ${user.email} (ID: ${user.id})`);
    }
    
    // Execute copy trade for each user
      for (const user of users) {
        const userWalletAddress = user.execution_wallet || process.env.WALLET_ADDRESS;
        if (!userWalletAddress) {
          console.log(`❌ No execution wallet configured for user ${user.email}`);
          continue;
        }
        // Only execute if user's bot_status is 'running'
        const statusRow = await query(
          'SELECT status FROM bot_status WHERE user_id = ?',
          [user.id]
        );
        if (statusRow && statusRow[0]?.status === 'running') {
          const result = await tradeExecutor.executeCopyTrade(event.trade, userWalletAddress);
          // Emit executed trade only to this user (by numeric id and wallet-id if exists)
          io.to(`user:${user.id}`).emit('trade:executed', { ...result, userId: user.id, userEmail: user.email });
          if (user.email?.startsWith('wallet:')) {
            const walletId = user.email.replace('wallet:', '').toLowerCase();
            io.to(`user:${walletId}`).emit('trade:executed', { ...result, userId: walletId, userEmail: user.email });
          }

        } else {
          console.log(`⏸️ Bot is not running for user ${user.email}, skipping trade execution.`);
        }
      }
    
  } catch (error) {
    console.log('❌ Trade execution failed:', error);
    io.emit('trade:error', { error: error.message });
  }
});

// Price feed updates
pythPrice.on('priceUpdate', (priceData) => {
  io.emit('price:update', priceData);
});

// Start services
async function startServices() {
  try {
    console.log('🚀 Starting backend services...');
    
    await polymarketWs.connect();
    console.log('✅ Polymarket WebSocket connected');
    
    await pythPrice.initialize();
    console.log('✅ Pyth Network price feeds initialized');
    
    await walletMonitor.start();
    
    console.log('✅ Wallet monitor started');
    
    console.log('🎯 All services running');
  } catch (error) {
    console.log('❌ Failed to start services:', error);
    process.exit(1);
  }
}

// Start server
const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => {
  console.log(`🚀 Backend server running on port ${PORT}`);
  startServices();
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n📴 Shutting down gracefully...');
  await polymarketWs.disconnect();
  await walletMonitor.stop();
  process.exit(0);
});

export { io };
