import { Router } from 'express';
import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';

export const tradeRouter = Router();

/**
 * GET /api/trades - Get recent trades
 */
tradeRouter.get('/', async (req, res) => {
  try {
    const { wallet, limit = 50 } = req.query;
    
    const response = await axios.get('https://api.polymarket.com/trades', {
      params: { wallet: wallet?.toLowerCase(), limit },
      headers: {
        'Authorization': `Bearer ${process.env.POLYMARKET_API_KEY}`
      }
    });

    res.json(response.data);
  } catch (error) {
    console.error('Error fetching trades:', error);
    res.status(500).json({ error: 'Failed to fetch trades' });
  }
});

/**
 * GET /api/trades/history - Get trade history from logs
 */
tradeRouter.get('/history', async (req, res) => {
  try {
    const logsDir = path.join(process.cwd(), 'logs');
    const today = new Date().toISOString().split('T')[0];
    const logFile = path.join(logsDir, `trades-${today}.json`);

    try {
      const data = await fs.readFile(logFile, 'utf-8');
      const trades = JSON.parse(data);
      res.json(trades);
    } catch (error) {
      // File doesn't exist yet
      res.json([]);
    }
  } catch (error) {
    console.error('Error reading trade history:', error);
    res.status(500).json({ error: 'Failed to read trade history' });
  }
});

/**
 * POST /api/trades/execute - Manually execute a trade
 */
tradeRouter.post('/execute', async (req, res) => {
  try {
    const { marketId, outcome, size, price } = req.body;

    // Validate input
    if (!marketId || !outcome || !size || !price) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // TODO: Integrate with TradeExecutionService
    const result = {
      success: true,
      message: 'Trade submitted',
      trade: { marketId, outcome, size, price }
    };

    res.json(result);
  } catch (error) {
    console.error('Error executing trade:', error);
    res.status(500).json({ error: 'Failed to execute trade' });
  }
});

/**
 * GET /api/trades/positions - Get current positions
 */
tradeRouter.get('/positions', async (req, res) => {
  try {
    const { wallet } = req.query;
    
    if (!wallet) {
      return res.status(400).json({ error: 'Wallet address required' });
    }

    const response = await axios.get('https://api.polymarket.com/positions', {
      params: { wallet: wallet.toLowerCase() },
      headers: {
        'Authorization': `Bearer ${process.env.POLYMARKET_API_KEY}`
      }
    });

    res.json(response.data);
  } catch (error) {
    console.error('Error fetching positions:', error);
    res.status(500).json({ error: 'Failed to fetch positions' });
  }
});
