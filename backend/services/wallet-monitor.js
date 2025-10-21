import { EventEmitter } from "events";
import axios from "axios";
import { all, run, get } from "./db.js";

// Track the time when the copybot starts
export const copybotStartTime = new Date();

/**
 * Wallet monitoring service - polls Polymarket API for target wallet trades
 */
export class WalletMonitorService extends EventEmitter {
  constructor() {
    super();
    this.targetWallets = [];
    this.pollInterval = parseInt(process.env.POLL_INTERVAL || "5000");
    this.isRunning = false;
    this.intervalId = null;
  }

  async loadTargetWalletsFromDb() {
    try {
      const rows = await all("SELECT DISTINCT wallet FROM user_wallets");
      const fromDb = rows.map((r) => String(r.wallet).toLowerCase());
      this.targetWallets = fromDb;
    } catch (e) {
      // Keep previous list if query fails
      console.log("⚠️  Failed to load target wallets from DB:", e?.message || e);
    }
  }

  async start() {
    if (this.isRunning) return;

    this.isRunning = true;
    await this.loadTargetWalletsFromDb();
    console.log(`👀 Monitoring ${this.targetWallets.length} wallets`);

    // Initial check
    await this.checkAllWallets();

    // Set up polling
    this.intervalId = setInterval(
      () => this.checkAllWallets(),
      this.pollInterval
    );
  }

  async stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log("🛑 Wallet monitor stopped");
  }

  async checkAllWallets() {
    // Reload wallets from DB (multi-user): union distinct wallets
    await this.loadTargetWalletsFromDb();

    for (const wallet of this.targetWallets) {
      try {
        await this.checkWallet(wallet);
      } catch (error) {
        console.log(`Error checking wallet ${wallet}:`, error);
        this.emit("error", { wallet, error });
      }
    }
  }

  async checkWallet(wallet) {
    try {
      const walletLower = wallet.toLowerCase();
      let trades = [];

      try {
        // Fetch recent trades from Polymarket Data API (better format than CLOB)
        const response = await axios.get(
          "https://data-api.polymarket.com/trades",
          {
            params: {
              user: walletLower,
              limit: 20, // Increased to catch more trades
            },
          }
        );
        trades = response.data;
      } catch (error) {
        if (error.response && error.response.status === 404) {
          // No trades found for wallet, not a fatal error
          return;
        } else {
          throw error;
        }
      }

      // Only process trades after copybotStartTime
      const newTrades = [];
      for (const trade of trades) {
        const txHash = trade.transactionHash || trade.id;
        if (!txHash) continue;

        // Polymarket API returns trade.timestamp as seconds (or ms)
        const tradeTime = trade.timestamp
          ? new Date(trade.timestamp * (trade.timestamp > 1e12 ? 1 : 1000))
          : null;
        if (tradeTime && tradeTime < copybotStartTime) continue;

        // Check if already processed in database
        const existing = await get(
          "SELECT id FROM processed_trades WHERE wallet = ? AND transaction_hash = ?",
          [walletLower, txHash]
        );

        if (!existing) {
          newTrades.push(trade);
          // Mark as processed
          await run(
            "INSERT OR IGNORE INTO processed_trades (wallet, transaction_hash) VALUES (?, ?)",
            [walletLower, txHash]
          );
        }
      }

      // Emit events for new trades only
        for (const trade of newTrades) {
          // Only emit if at least one user has bot_status 'running'
          const users = await all(
            "SELECT u.id, u.email FROM users u JOIN user_wallets uw ON u.id = uw.user_id WHERE uw.wallet = ?",
            [walletLower]
          );
          let hasActive = false;
          for (const user of users) {
            const statusRow = await get(
              "SELECT status FROM bot_status WHERE user_id = ?",
              [user.id]
            );
            if (statusRow && statusRow.status === 'running') {
              hasActive = true;
              break;
            }
          }
          if (hasActive) {
            this.emit("newTrade", { wallet: walletLower, trade });
            console.log(`🔔 New trade from ${walletLower}:`, {
              market: trade.title || trade.slug,
              outcome: trade.outcome,
              size: trade.size,
              price: trade.price,
            });
          }
        }

      // Clean up old processed trades (keep last 30 days)
      if (Math.random() < 0.01) {
        // 1% chance to run cleanup
        await run(
          "DELETE FROM processed_trades WHERE processed_at < datetime('now', '-30 days')"
        );
      }
    } catch (error) {
      console.log(`Error checking wallet ${wallet}:`, error.message);
      this.emit("error", { wallet, error });
    }
  }
}
