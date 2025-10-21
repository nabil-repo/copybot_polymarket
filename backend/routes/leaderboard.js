import { Router } from 'express';
import axios from 'axios';

export const leaderboardRouter = Router();

// Leaderboard derived from TARGET_WALLETS env by recent trade activity
leaderboardRouter.get('/', async (req, res) => {
  try {
    // Fetch leaderboard from Polymarket API v1
    const resp = await axios.get('https://data-api.polymarket.com/v1/leaderboard');
    const data = Array.isArray(resp.data) ? resp.data : (resp.data && resp.data.leaderboard ? resp.data.leaderboard : []);

    // Map to leaderboard format
    const leaderboard = data.slice(0, 20).map(trader => ({
      rank: trader.rank,
      wallet: trader.proxyWallet,
      username: trader.userName,
      volume: trader.vol ?? 0,
      pnl: trader.pnl ?? 0,
      profileImage: trader.profileImage ?? '',
    }));

    res.json(leaderboard);
  } catch (err) {
    console.error('Leaderboard error:', err);
    res.status(500).json({ error: 'failed_to_fetch_leaderboard' });
  }
});
