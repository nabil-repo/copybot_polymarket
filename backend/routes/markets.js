import { Router } from 'express';
import axios from 'axios';

export const marketRouter = Router();

/**
 * GET /api/markets - Get active markets
 */
marketRouter.get('/', async (req, res) => {
  try {
    const { limit = 20, active = true } = req.query;
    
    const response = await axios.get('https://api.polymarket.com/markets', {
      params: { limit, active },
      headers: {
        'Authorization': `Bearer ${process.env.POLYMARKET_API_KEY}`
      }
    });

    res.json(response.data);
  } catch (error) {
    console.error('Error fetching markets:', error);
    res.status(500).json({ error: 'Failed to fetch markets' });
  }
});

/**
 * GET /api/markets/:id - Get specific market
 */
marketRouter.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const response = await axios.get(`https://api.polymarket.com/markets/${id}`, {
      headers: {
        'Authorization': `Bearer ${process.env.POLYMARKET_API_KEY}`
      }
    });

    res.json(response.data);
  } catch (error) {
    console.error('Error fetching market:', error);
    res.status(500).json({ error: 'Failed to fetch market' });
  }
});

/**
 * GET /api/markets/:id/orderbook - Get market orderbook
 */
marketRouter.get('/:id/orderbook', async (req, res) => {
  try {
    const { id } = req.params;
    const { outcome } = req.query;
    
    const response = await axios.get(`https://api.polymarket.com/markets/${id}/orderbook`, {
      params: { outcome },
      headers: {
        'Authorization': `Bearer ${process.env.POLYMARKET_API_KEY}`
      }
    });

    res.json(response.data);
  } catch (error) {
    console.error('Error fetching orderbook:', error);
    res.status(500).json({ error: 'Failed to fetch orderbook' });
  }
});
