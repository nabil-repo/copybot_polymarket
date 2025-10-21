import { EventEmitter } from 'events';
import PolymarketClient, { Trade } from './polymarket-client';

export interface MonitorConfig {
  wallets: string[];
  pollInterval: number; // milliseconds
  apiKey?: string;
}

export interface NewTradeEvent {
  wallet: string;
  trade: Trade;
}

/**
 * Monitors target wallets for new trades on Polymarket
 */
export class WalletMonitor extends EventEmitter {
  private client: PolymarketClient;
  private config: MonitorConfig;
  private isRunning = false;
  private lastTradeIds: Map<string, Set<string>> = new Map();
  private intervalId?: NodeJS.Timeout;

  constructor(config: MonitorConfig) {
    super();
    this.config = config;
    this.client = new PolymarketClient(config.apiKey);

    // Initialize last trade tracking for each wallet
    config.wallets.forEach(wallet => {
      this.lastTradeIds.set(wallet.toLowerCase(), new Set());
    });
  }

  /**
   * Start monitoring wallets
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('Monitor already running');
      return;
    }

    this.isRunning = true;
    console.log(`Starting wallet monitor for ${this.config.wallets.length} wallets`);
    
    // Do initial check
    await this.checkAllWallets();

    // Set up polling interval
    this.intervalId = setInterval(
      () => this.checkAllWallets(),
      this.config.pollInterval
    );

    this.emit('started');
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    this.isRunning = false;
    console.log('Wallet monitor stopped');
    this.emit('stopped');
  }

  /**
   * Check all wallets for new trades
   */
  private async checkAllWallets(): Promise<void> {
    for (const wallet of this.config.wallets) {
      try {
        await this.checkWallet(wallet);
      } catch (error) {
        console.error(`Error checking wallet ${wallet}:`, error);
        this.emit('error', { wallet, error });
      }
    }
  }

  /**
   * Check a single wallet for new trades
   */
  private async checkWallet(wallet: string): Promise<void> {
    const walletLower = wallet.toLowerCase();
    const trades = await this.client.getWalletTrades(walletLower, 10);
    const seenTradeIds = this.lastTradeIds.get(walletLower)!;

    // Find new trades
    const newTrades = trades.filter(trade => !seenTradeIds.has(trade.id));

    // Emit events for new trades
    for (const trade of newTrades) {
      seenTradeIds.add(trade.id);
      this.emit('newTrade', { wallet: walletLower, trade });
      console.log(`New trade detected for ${walletLower}:`, {
        market: trade.marketId,
        outcome: trade.outcome,
        size: trade.size,
        price: trade.price
      });
    }

    // Keep only last 1000 trade IDs to prevent memory growth
    if (seenTradeIds.size > 1000) {
      const idsArray = Array.from(seenTradeIds);
      seenTradeIds.clear();
      idsArray.slice(-1000).forEach(id => seenTradeIds.add(id));
    }
  }

  /**
   * Add a wallet to monitor
   */
  addWallet(wallet: string): void {
    const walletLower = wallet.toLowerCase();
    if (!this.config.wallets.includes(walletLower)) {
      this.config.wallets.push(walletLower);
      this.lastTradeIds.set(walletLower, new Set());
      console.log(`Added wallet to monitor: ${walletLower}`);
    }
  }

  /**
   * Remove a wallet from monitoring
   */
  removeWallet(wallet: string): void {
    const walletLower = wallet.toLowerCase();
    const index = this.config.wallets.indexOf(walletLower);
    if (index > -1) {
      this.config.wallets.splice(index, 1);
      this.lastTradeIds.delete(walletLower);
      console.log(`Removed wallet from monitor: ${walletLower}`);
    }
  }
}

export default WalletMonitor;
