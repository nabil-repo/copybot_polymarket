import { ethers } from "ethers";
import { LitWalletService } from "./lit-wallet.js";
import { get } from "./db.js";
import { getStoredAuthSig } from "./auto-wallet-creator.js";
import { getPolymarketCredentials, storePolymarketCredentials } from "./polymarket-credentials.js";
import { derivePolymarketApiKey } from "./polymarket-clob.js";
import fetch from 'node-fetch';

// Ensure .env variables are loaded
import "dotenv/config";

/**
 * Trade execution service with Polymarket API integration
 */
export class TradeExecutionService {
  constructor() {
    // Support generic EVM RPCs; fall back to ETH if not provided
    const rpcUrl = process.env.EVM_RPC_URL || "http://127.0.0.1:8545";
    this.provider = new ethers.JsonRpcProvider(rpcUrl);

    this.copyRatio = parseFloat(process.env.COPY_RATIO || "0.1");
    this.maxPositionSize = parseFloat(process.env.MAX_POSITION_SIZE || "100");
    this.minPositionSize = parseFloat(process.env.MIN_POSITION_SIZE || "1");
    this.slippageTolerance = parseFloat(
      process.env.SLIPPAGE_TOLERANCE || "0.01"
    );
    // By default, we skip on-chain USDC checks to avoid MockUSDC/contract deps
    this.skipOnchainBalanceCheck = (process.env.SKIP_ONCHAIN_BALANCE_CHECK || 'true') === 'true';

    this.litWallet = new LitWalletService();
    this.polymarketApiBaseUrl = 'https://clob.polymarket.com';
  }

  async initialize() {
    await this.litWallet.initialize();
  }

  /**
   * Execute copy trade
   * @param {Object} originalTrade - Trade data from monitored wallet
   * @param {string} walletAddress - User's wallet address (from DB)
   * @param {number} userId - User ID to fetch encrypted wallet (optional)
   */
  async executeCopyTrade(originalTrade, walletAddress, userId = null) {
    try {
      // walletAddress is optional when skipping on-chain checks

      // Calculate copy size
      let copySize = originalTrade.size * this.copyRatio;
      copySize = Math.max(this.minPositionSize, copySize);
      copySize = Math.min(this.maxPositionSize, copySize);

      // Extract market identifier (conditionId or marketId)
      const marketId = originalTrade.conditionId || originalTrade.marketId;
      const marketTitle =
        originalTrade.title || originalTrade.slug || "Unknown Market";

      console.log(`💰 Executing copy trade for ${walletAddress}:`, {
        market: marketTitle,
        conditionId: marketId,
        outcome: originalTrade.outcome,
        originalSize: originalTrade.size,
        copySize,
        price: originalTrade.price,
      });

      // Optional: Check balance on-chain (disabled by default)
      if (!this.skipOnchainBalanceCheck && walletAddress) {
        const balance = await this.checkUSDCBalance(walletAddress);
        const requiredAmount = copySize * originalTrade.price;
        if (balance < requiredAmount) {
          throw new Error(`Insufficient balance: ${balance} < ${requiredAmount}`);
        }
      } else {
       // console.log('⚖️ Skipping on-chain USDC balance check (SKIP_ONCHAIN_BALANCE_CHECK=true)');
      }

      // Calculate price with slippage
      const priceWithSlippage =
        originalTrade.price * (1 + this.slippageTolerance);

      // Submit order to Polymarket
      const result = await this.submitOrder({
        conditionId: marketId,
        asset: originalTrade.asset,
        outcome: originalTrade.outcome,
        side: originalTrade.side || "BUY", // Default to BUY for copy trades
        size: copySize,
        price: priceWithSlippage,
        userId, // Pass userId to fetch encrypted wallet
        walletAddress, // Pass for potential funder hint during auto-derive
      });

      // Check if API credentials are missing
      // if (result.needsApiCredentials) {
      //   throw new Error(result.error || "Polymarket API credentials not configured");
      // }

      // Check if API call failed
      if (result.apiError) {
        throw new Error(result.error || "Polymarket API request failed");
      }

      return {
        success: true,
        txHash: result.txHash,
        orderId: result.orderId,
        // Flatten data for frontend
        market: marketTitle,
        title: marketTitle,
        conditionId: marketId,
        outcome: originalTrade.outcome,
        side: originalTrade.side || "BUY",
        size: copySize,
        price: priceWithSlippage,
        originalSize: originalTrade.size,
        originalPrice: originalTrade.price,
        wallet: walletAddress,
        timestamp: Date.now() / 1000,
        usedPolymarketAPI: result.usedPolymarketAPI,
      };
    } catch (error) {
      console.log("❌ Trade execution failed:", error);
      
      // Check if this is a "needs API credentials" error
      const needsApiCredentials = error.message?.includes("API credentials not configured");
      
      return {
        success: false,
        error: error.message,
        needsApiCredentials, // Flag for frontend to prompt user
        // Include basic info even on failure
        market: originalTrade.title || originalTrade.slug || "Unknown",
        outcome: originalTrade.outcome,
        side: originalTrade.side || "BUY",
        size: 0,
        price: originalTrade.price,
        timestamp: Date.now() / 1000,
      };
    }
  }

  /**
   * Check USDC balance on ETH
   * @param {string} walletAddress - User's wallet address
   */
  async checkUSDCBalance(walletAddress) {
    if (!walletAddress) {
      throw new Error("walletAddress is required for balance check");
    }

    const usdcAddress =
      process.env.USDC_CONTRACT_ADDRESS ||
      "0x5FbDB2315678afecb367f032d93F642f64180aa3";

    if (!usdcAddress) {
      throw new Error(`USDC_CONTRACT_ADDRESS missing in .env`);
    }

    // Ensure addresses are properly formatted to avoid ENS resolution attempts
    const checksummedUsdcAddress = ethers.getAddress(usdcAddress);
    const checksummedWalletAddress = ethers.getAddress(walletAddress);

    const usdcAbi = [
      "function balanceOf(address owner) view returns (uint256)",
      "function decimals() view returns (uint8)",
    ];

    const usdcContract = new ethers.Contract(
      checksummedUsdcAddress,
      usdcAbi,
      this.provider
    );
    const balance = await usdcContract.balanceOf(checksummedWalletAddress);
    const decimals = await usdcContract.decimals();

    return Number(ethers.formatUnits(balance, decimals));
  }

  /**
   * Submit order to Polymarket via API
   * Uses user's stored encrypted API credentials
   */
  async submitOrder(orderParams) {
    console.log("📝 Submitting order:", orderParams);

    const userId = orderParams.userId;

    // Try to use Polymarket API if user has credentials
    if (userId) {
      try {
        console.log("🔑 Attempting Polymarket API order for user", userId);

        // Get user's encrypted Polymarket credentials
        const credentials = await getPolymarketCredentials(userId);

        if (!credentials) {
          // Try to auto-derive using server-side PRIVATE_KEY if available
          const autoPk = process.env.PRIVATE_KEY;
          if (autoPk) {
            try {
              console.log("🧩 Auto-deriving Polymarket API credentials using server PRIVATE_KEY...");
              // Use execution wallet as funder if available (best effort)
              const funder = orderParams.walletAddress || '';
              const { apiKey, apiSecret } = await derivePolymarketApiKey({ privateKey: autoPk, funder });
              const saved = await storePolymarketCredentials(userId, apiKey, apiSecret);
              if (saved) {
               // console.log("✅ Auto-derived and stored Polymarket API credentials for user", userId);
              }
            } catch (autoErr) {
              //console.warn("⚠️ Auto-derive failed:", autoErr?.message || autoErr);
            }

            // Re-check after attempted derive
            const after = await getPolymarketCredentials(userId);
            if (!after) {
              const errorMsg = "⚠️ No Polymarket CLOB API credentials configured. Please add your API key and secret in Settings.";
           //   console.log(errorMsg);
              return {
                success: false,
                error: errorMsg,
                needsApiCredentials: true,
                promptUser: true,
                txHash: null,
                orderId: null
              };
            }
            // Proceed with newly stored credentials
            credentials = after;
          } else {
            const errorMsg = "⚠️ No Polymarket CLOB API credentials configured. Please add your API key and secret in Settings.";
           // console.log(errorMsg);
            return {
              success: false,
              error: errorMsg,
              needsApiCredentials: true,
              promptUser: true,
              txHash: null,
              orderId: null
            };
          }
        }

        if (credentials) {
          console.log("✅ Retrieved Polymarket API credentials for user", userId);

          // Build order payload for Polymarket API
          const orderPayload = {
            market: orderParams.conditionId,
            asset_id: orderParams.asset,
            side: orderParams.side.toLowerCase(), // 'buy' or 'sell'
            size: orderParams.size.toString(),
            price: orderParams.price.toString(),
            outcome: orderParams.outcome
          };

          // Submit order to Polymarket
          const response = await fetch(`${this.polymarketApiBaseUrl}/orders`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${credentials.apiKey}`,
              'X-API-Secret': credentials.apiSecret
            },
            body: JSON.stringify(orderPayload)
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error("❌ Polymarket API error:", response.status, errorText);
            throw new Error(`Polymarket API error: ${response.status}`);
          }

          const result = await response.json();
          console.log("✅ Order submitted to Polymarket:", result);

          return {
            txHash: result.transaction_hash || result.order_id || `pm_${Date.now()}`,
            orderId: result.order_id || `order_${Date.now()}`,
            usedPolymarketAPI: true,
            orderDetails: result
          };
  }
      } catch (e) {
        console.error("❌ Polymarket API submission failed:", e.message);
        
        // Return error with API failure details
        return {
          success: false,
          error: `Polymarket API error: ${e.message}`,
          apiError: true,
          txHash: null,
          orderId: null
        };
      }
    }

    // If no userId provided, cannot execute trade
    const errorMsg = "❌ Cannot execute trade: User ID required for API authentication";
    console.log(errorMsg);
    
    return {
      success: false,
      error: errorMsg,
      needsUserId: true,
      txHash: null,
      orderId: null
    };
  }

  updateConfig(updates) {
    if (updates.copyRatio) this.copyRatio = updates.copyRatio;
    if (updates.maxPositionSize) this.maxPositionSize = updates.maxPositionSize;
    if (updates.minPositionSize) this.minPositionSize = updates.minPositionSize;
    if (updates.slippageTolerance)
      this.slippageTolerance = updates.slippageTolerance;

    console.log("⚙️  Trade executor config updated");
  }
}
