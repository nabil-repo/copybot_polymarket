import io, { Socket } from 'socket.io-client';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

let socket: Socket | undefined;

export const initializeSocket = (): Socket => {
  if (!socket) {
    console.log('[SOCKET-CLIENT] Creating new socket connection to:', BACKEND_URL);
    socket = io(BACKEND_URL, {
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      transports: ['websocket', 'polling'],
      withCredentials: true
    });

    socket.on('connect', () => {
      console.log('✅ Connected to backend WebSocket');
    });

    socket.on('disconnect', () => {
      console.log('❌ Disconnected from backend WebSocket');
    });

    socket.on('connect_error', (error: Error) => {
      console.error('❌ Connection error:', error);
    });
  } else if (!socket.connected) {
    console.log('[SOCKET-CLIENT] Socket exists but disconnected, reconnecting...');
    socket.connect();
  } else {
    console.log('[SOCKET-CLIENT] Socket already connected');
  }

  return socket;
};

export const getSocket = (): Socket => {
  if (!socket) {
    return initializeSocket();
  }
  return socket;
};

export const subscribeToMarkets = (marketIds: string[]) => {
  const socket = getSocket();
  socket.emit('subscribe:markets', marketIds);
};

export const subscribeToWallet = (walletAddress: string) => {
  const socket = getSocket();
  socket.emit('subscribe:wallet', walletAddress);
};

export const subscribeToUser = (userId: number | string) => {
  const socket = getSocket();
  socket.emit('subscribe:user', userId);
};

export const onMarketTrade = (callback: (data: any) => void) => {
  const socket = getSocket();
  // Remove any existing listeners to prevent duplicates
  socket.off('market:trade');
  socket.on('market:trade', callback);
};

export const onMarketOrderbook = (callback: (data: any) => void) => {
  const socket = getSocket();
  // Remove any existing listeners to prevent duplicates
  socket.off('market:orderbook');
  socket.on('market:orderbook', callback);
};

export const onWalletTrade = (callback: (data: any) => void) => {
  const socket = getSocket();
  // Remove any existing listeners to prevent duplicates
  socket.off('wallet:trade');
  socket.on('wallet:trade', callback);
};

export const onTradeExecuted = (callback: (data: any) => void) => {
  const socket = getSocket();
  // Remove any existing listeners to prevent duplicates
  socket.off('trade:executed');
  socket.on('trade:executed', callback);
};

export const onTradeWarning = (callback: (data: any) => void) => {
  const socket = getSocket();
  // Remove any existing listeners to prevent duplicates
  socket.off('trade:warning');
  socket.on('trade:warning', callback);
};

export const onPriceUpdate = (callback: (data: any) => void) => {
  const socket = getSocket();
  // Remove any existing listeners to prevent duplicates
  socket.off('price:update');
  socket.on('price:update', callback);
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = undefined;
  }
};
