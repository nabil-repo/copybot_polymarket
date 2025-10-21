import axios, { AxiosInstance } from 'axios';

export interface Market {
  id: string;
  question: string;
  outcomes: string[];
  volume: number;
  liquidity: number;
  endDate: string;
}

export interface Position {
  marketId: string;
  outcome: string;
  size: number;
  averagePrice: number;
  currentPrice: number;
  pnl: number;
}

export interface Trade {
  id: string;
  marketId: string;
  maker: string;
  taker: string;
  outcome: string;
  size: number;
  price: number;
  timestamp: number;
}

export class PolymarketClient {
  private api: AxiosInstance;
  private baseURL = 'https://api.polymarket.com';

  constructor(apiKey?: string) {
    this.api = axios.create({
      baseURL: this.baseURL,
      headers: apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {},
    });
  }

  /**
   * Get active markets
   */
  async getMarkets(limit = 20): Promise<Market[]> {
    const response = await this.api.get('/markets', {
      params: { limit, active: true }
    });
    return response.data;
  }

  /**
   * Get market by ID
   */
  async getMarket(marketId: string): Promise<Market> {
    const response = await this.api.get(`/markets/${marketId}`);
    return response.data;
  }

  /**
   * Get trades for a specific wallet
   */
  async getWalletTrades(walletAddress: string, limit = 50): Promise<Trade[]> {
    const response = await this.api.get('/trades', {
      params: { 
        wallet: walletAddress.toLowerCase(),
        limit 
      }
    });
    return response.data;
  }

  /**
   * Get positions for a wallet
   */
  async getWalletPositions(walletAddress: string): Promise<Position[]> {
    const response = await this.api.get('/positions', {
      params: { wallet: walletAddress.toLowerCase() }
    });
    return response.data;
  }

  /**
   * Get recent trades for a market
   */
  async getMarketTrades(marketId: string, limit = 100): Promise<Trade[]> {
    const response = await this.api.get(`/markets/${marketId}/trades`, {
      params: { limit }
    });
    return response.data;
  }

  /**
   * Get orderbook for a market outcome
   */
  async getOrderbook(marketId: string, outcome: string) {
    const response = await this.api.get(`/markets/${marketId}/orderbook`, {
      params: { outcome }
    });
    return response.data;
  }
}

export default PolymarketClient;
