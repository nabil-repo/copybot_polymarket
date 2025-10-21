import WebSocket from 'ws';
import { EventEmitter } from 'events';

/**
 * Polymarket WebSocket client for real-time market data
 */
export class PolymarketWebSocketClient extends EventEmitter {
  constructor() {
    super();
    this.ws = null;
    this.reconnectInterval = 5000;
    this.subscriptions = new Set();
  }

  async connect() {
    return new Promise((resolve, reject) => {
      try {
        // Polymarket WebSocket endpoint (adjust based on actual API)
        this.ws = new WebSocket('wss://ws-subscriptions-clob.polymarket.com/ws/market');

        this.ws.on('open', () => {
          console.log('🔌 Connected to Polymarket WebSocket');
          this.resubscribe();
          resolve();
        });

        this.ws.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString());
            this.handleMessage(message);
          } catch (error) {
            console.log('Error parsing WebSocket message:', error);
          }
        });

        this.ws.on('error', (error) => {
          console.log('WebSocket error:', error);
          this.emit('error', error);
        });

        this.ws.on('close', () => {
          console.log('🔌 Disconnected from Polymarket WebSocket');
          this.scheduleReconnect();
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  handleMessage(message) {
    const { type, data } = message;

    switch (type) {
      case 'trade':
        this.emit('trade', data);
        break;
      case 'orderbook':
        this.emit('orderbook', data);
        break;
      case 'market_update':
        this.emit('marketUpdate', data);
        break;
      default:
        console.log('Unknown message type:', type);
    }
  }

  subscribeToMarket(marketId) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.subscriptions.add(marketId);
      return;
    }

    // Per Polymarket docs: https://docs.polymarket.com/developers/CLOB/websocket/wss-overview
    const subscribeMessage = {
      type: 'subscribe',
      marketId: marketId
    };
    this.ws.send(JSON.stringify(subscribeMessage));
    this.subscriptions.add(marketId);
    console.log(`📊 Subscribed to market: ${marketId}`);
  }

  unsubscribeFromMarket(marketId) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const unsubscribeMessage = {
      type: 'unsubscribe',
      marketId: marketId
    };
    this.ws.send(JSON.stringify(unsubscribeMessage));
    this.subscriptions.delete(marketId);
    console.log(`📊 Unsubscribed from market: ${marketId}`);
  }

  resubscribe() {
    for (const marketId of this.subscriptions) {
      this.subscribeToMarket(marketId);
    }
  }

  scheduleReconnect() {
    setTimeout(() => {
      console.log('🔄 Attempting to reconnect...');
      this.connect();
    }, this.reconnectInterval);
  }

  async disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
