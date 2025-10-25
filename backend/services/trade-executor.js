import { ethers } from "ethers";
import { LitWalletService } from "./lit-wallet.js";

// Ensure .env variables are loaded
import "dotenv/config";

/**
 * Trade execution service with Lit Protocol wallet integration
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

    this.litWallet = new LitWalletService();
  }

  async initialize() {
    await this.litWallet.initialize();
  }

  /**
   * Execute copy trade
   * @param {Object} originalTrade - Trade data from monitored wallet
   * @param {string} walletAddress - User's wallet address (from DB)
   */
  async executeCopyTrade(originalTrade, walletAddress) {
    try {
      if (!walletAddress) {
        throw new Error("walletAddress is required for trade execution");
      }

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

      // Check balance (USDC on ETH)
      const balance = await this.checkUSDCBalance(walletAddress);
      const requiredAmount = copySize * originalTrade.price;

      if (balance < requiredAmount) {
        throw new Error(`Insufficient balance: ${balance} < ${requiredAmount}`);
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
      });

      return {
        success: true,
        txHash: result.txHash,
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
      };
    } catch (error) {
      console.log("❌ Trade execution failed:", error);
      return {
        success: false,
        error: error.message,
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
   * Submit order to Polymarket CTF Exchange
   * TODO: Integrate with actual Polymarket smart contracts
   */
  async submitOrder(orderParams) {
    // Basic placeholder implementation with optional Lit signing
    console.log("📝 Submitting order:", orderParams);

    // If the caller provided an encryptedKey + auth context, attempt Lit-based signing
    if (
      process.env.USE_LIT === "true" &&
      orderParams.encryptedKey &&
      orderParams.accessControlConditions &&
      orderParams.authSig
    ) {
      try {
        // Build a minimal tx payload (caller should adapt to real contract ABI)
        const tx = {
          to: process.env.VAULT_CONTRACT_ADDRESS || undefined,
          value: "0x0",
          data: "0x",
        };

        const signed = await this.litWallet.signTransaction(
          orderParams.encryptedKey,
          tx,
          orderParams.accessControlConditions,
          orderParams.authSig
        );

        // return signed tx hash placeholder (in real flow you'd broadcast signed to provider)
        return { txHash: signed.slice(0, 66), orderId: `order_${Date.now()}` };
      } catch (e) {
        console.log("❌ Lit signing failed:", e);
        // fall through to fake response
      }
    }

    // Fallback fake response (for dev/testing)
    await new Promise((resolve) => setTimeout(resolve, 1000));

    return {
      txHash: `0x${Math.random().toString(16).slice(2, 66)}`,
      orderId: `order_${Date.now()}`,
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
