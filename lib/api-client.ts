import axios from 'axios';

let authToken: string | null = null;
export function setAuthToken(token: string | null) {
  authToken = token;
  if (typeof window !== 'undefined' && token) {
    localStorage.setItem('auth_token', token);
  }
  if (typeof window !== 'undefined' && !token) {
    localStorage.removeItem('auth_token');
  }
}
export function loadAuthTokenFromStorage() {
  if (typeof window !== 'undefined') {
    const t = localStorage.getItem('auth_token');
    if (t) authToken = t;
  }
}

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  if (!authToken && typeof window !== 'undefined') {
    const t = localStorage.getItem('auth_token');
    if (t) authToken = t;
  }
  if (authToken) {
    config.headers = config.headers || {};
    (config.headers as any)['Authorization'] = `Bearer ${authToken}`;
  }
  return config;
});

// Markets
export const getMarkets = async (limit = 20) => {
  const response = await api.get('/api/markets', { params: { limit } });
  return response.data;
};

export const getMarket = async (marketId: string) => {
  const response = await api.get(`/api/markets/${marketId}`);
  return response.data;
};

export const getMarketOrderbook = async (marketId: string, outcome: string) => {
  const response = await api.get(`/api/markets/${marketId}/orderbook`, {
    params: { outcome },
  });
  return response.data;
};

// Trades
export const getRecentTrades = async () => {
  const response = await api.get('/api/trades?limit=10');
  return response.data;
};
export const getTrades = async (wallet?: string, limit = 50) => {
  const response = await api.get('/api/trades', {
    params: { wallet, limit },
  });
  return response.data;
};

export const getTradeHistory = async () => {
  const response = await api.get('/api/trades/history');
  return response.data;
};

export const executeTrade = async (tradeParams: {
  marketId: string;
  outcome: string;
  size: number;
  price: number;
}) => {
  const response = await api.post('/api/trades/execute', tradeParams);
  return response.data;
};

export const getPositions = async (wallet: string) => {
  const response = await api.get('/api/trades/positions', {
    params: { wallet },
  });
  return response.data;
};

// Leaderboard
export const getLeaderboard = async () => {
  const response = await api.get('/api/leaderboard');
  return response.data;
};

// Auth
export const register = async (email: string, password: string) => {
  const response = await api.post('/api/auth/register', { email, password });
  return response.data as { user: { id: number; email: string }; token: string };
};
export const login = async (email: string, password: string) => {
  const response = await api.post('/api/auth/login', { email, password });
  return response.data as { user: { id: number; email: string }; token: string };
};

// Wallet auth
export const getWalletNonce = async (address: string) => {
  const response = await api.get('/api/auth/wallet/nonce', { params: { address } });
  return response.data as { nonce: string };
};
export const verifyWalletSignature = async (address: string, signature: string) => {
  const response = await api.post('/api/auth/wallet/verify', { address, signature });
  return response.data as { user: { id: number; email: string }; token: string };
};

// User profile
export const getUserProfile = async () => {
  const response = await api.get('/api/user/profile');
  return response.data as { id: number; email: string; execution_wallet: string | null };
};

export const updateExecutionWallet = async (wallet: string) => {
  const response = await api.put('/api/user/execution-wallet', { wallet });
  return response.data as { ok: boolean; execution_wallet: string };
};

// Bot status
export const getBotStatus = async () => {
  const response = await api.get('/api/user/bot-status');
  return response.data as {
    status: string;
    started_at: string | null;
    stopped_at: string | null;
  };
};

// Start bot
export const startBot = async () => {
  const response = await api.post('/api/user/bot-start');
  return response.data as { ok: boolean; status: string };
};

// Stop bot
export const stopBot = async () => {
  const response = await api.post('/api/user/bot-stop');
  return response.data as { ok: boolean; status: string };
};

// User wallets
export const getUserWallets = async () => {
  const response = await api.get('/api/user/wallets');
  return response.data as string[];
};
export const addUserWallet = async (wallet: string) => {
  const response = await api.post('/api/user/wallets', { wallet });
  return response.data;
};
export const removeUserWallet = async (wallet: string) => {
  const response = await api.delete(`/api/user/wallets/${wallet}`);
  return response.data;
};

// Polymarket API Credentials
export const storePolymarketCredentials = async (apiKey: string, apiSecret: string) => {
  const response = await api.post('/api/user/polymarket/credentials', { apiKey, apiSecret });
  return response.data as { ok: boolean };
};

export const checkPolymarketCredentials = async () => {
  const response = await api.get('/api/user/polymarket/credentials');
  return response.data as { configured: boolean };
};

export const deletePolymarketCredentials = async () => {
  const response = await api.delete('/api/user/polymarket/credentials');
  return response.data as { ok: boolean };
};

// Derive Polymarket API credentials from a private key (not stored)
export const derivePolymarketCredentials = async (privateKey: string, signatureType: number = 1) => {
  const response = await api.post('/api/user/polymarket/derive', { privateKey, signatureType });
  return response.data as { ok: boolean };
};

// Health check
export const checkHealth = async () => {
  const response = await api.get('/health');
  return response.data;
};

export default api;
