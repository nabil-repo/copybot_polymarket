import { EventEmitter } from 'events';
import { EvmPriceServiceConnection } from '@pythnetwork/pyth-evm-js';

/**
 * Pyth Network price feed service
 */
export class PythPriceService extends EventEmitter {
  constructor() {
    super();
    this.connection = null;
    this.priceIds = new Map();
  }

  async initialize() {
    // Pyth Network Hermes endpoint
    this.connection = new EvmPriceServiceConnection(
      'https://hermes.pyth.network',
      {
        priceFeedRequestConfig: {
          binary: true,
        }
      }
    );

    console.log('✅ Pyth Network connection initialized');
  }

  /**
   * Subscribe to price feeds
   * @param {string[]} priceIds - Array of Pyth price feed IDs
   */
  async subscribeToPrices(priceIds) {
    try {
      // Subscribe to price updates via WebSocket
      this.connection.subscribePriceFeedUpdates(priceIds, (priceFeed) => {
        const price = priceFeed.getPriceNoOlderThan(60);
        
        if (price) {
          const priceData = {
            id: priceFeed.id,
            price: price.price,
            conf: price.conf,
            expo: price.expo,
            publishTime: price.publishTime,
            timestamp: new Date().toISOString()
          };

          this.emit('priceUpdate', priceData);
        }
      });

      console.log(`📈 Subscribed to ${priceIds.length} price feeds`);
    } catch (error) {
      console.log('Error subscribing to price feeds:', error);
      throw error;
    }
  }

  /**
   * Get latest price for a feed
   */
  async getLatestPrice(priceId) {
    try {
      const priceFeeds = await this.connection.getLatestPriceFeeds([priceId]);
      
      if (priceFeeds && priceFeeds.length > 0) {
        const priceFeed = priceFeeds[0];
        const price = priceFeed.getPriceUnchecked();
        
        return {
          id: priceId,
          price: price.price,
          conf: price.conf,
          expo: price.expo,
          publishTime: price.publishTime
        };
      }
      
      return null;
    } catch (error) {
      console.log('Error getting latest price:', error);
      throw error;
    }
  }

  /**
   * Get price feed update data for on-chain submission
   */
  async getPriceFeedUpdateData(priceIds) {
    try {
      const updateData = await this.connection.getPriceFeedsUpdateData(priceIds);
      return updateData;
    } catch (error) {
      console.log('Error getting price feed update data:', error);
      throw error;
    }
  }
}
