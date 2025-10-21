import { Router } from 'express';
import { run, all, get } from '../services/db.js';
import { authMiddleware } from './auth.js';

export const userRouter = Router();

// Get user profile including execution wallet
userRouter.get('/profile', authMiddleware, async (req, res) => {
  const dbId = req.user.dbUserId;
  if (!dbId) return res.status(404).json({ error: 'user_not_found' });
  const user = await get('SELECT id, email, execution_wallet FROM users WHERE id = ?', [dbId]);
  if (!user) return res.status(404).json({ error: 'user_not_found' });
  // Expose wallet address as id for wallet users
  const publicId = req.user.wallet ? req.user.wallet : user.id;
  res.json({ id: publicId, email: user.email, execution_wallet: user.execution_wallet });
});

// Update execution wallet for the authenticated user
userRouter.put('/execution-wallet', authMiddleware, async (req, res) => {
  const { wallet } = req.body || {};
  if (!wallet) return res.status(400).json({ error: 'missing_wallet' });
  
  // Basic validation for Ethereum address
  if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
    return res.status(400).json({ error: 'invalid_wallet_address' });
  }
  
  try {
    await run('UPDATE users SET execution_wallet = ? WHERE id = ?', [wallet.toLowerCase(), req.user.dbUserId]);
    res.json({ ok: true, execution_wallet: wallet.toLowerCase() });
  } catch (err) {
    console.error('update execution wallet error', err);
    res.status(500).json({ error: 'update_wallet_failed' });
  }
});

// Get wallets for the authenticated user
userRouter.get('/wallets', authMiddleware, async (req, res) => {
  const rows = await all('SELECT wallet FROM user_wallets WHERE user_id = ? ORDER BY created_at DESC', [req.user.dbUserId]);
  res.json(rows.map(r => r.wallet));
});

// Add a wallet for the authenticated user
userRouter.post('/wallets', authMiddleware, async (req, res) => {
  const { wallet } = req.body || {};
  if (!wallet) return res.status(400).json({ error: 'missing_wallet' });
  try {
    await run('INSERT OR IGNORE INTO user_wallets (user_id, wallet) VALUES (?, ?)', [req.user.dbUserId, wallet.toLowerCase()]);
    res.json({ ok: true });
  } catch (err) {
    console.error('add wallet error', err);
    res.status(500).json({ error: 'add_wallet_failed' });
  }
});


// Get bot status for the authenticated user
userRouter.get('/bot-status', authMiddleware, async (req, res) => {
  try {
    const statusRow = await get('SELECT status, started_at, stopped_at FROM bot_status WHERE user_id = ?', [req.user.dbUserId]);
    if (!statusRow) {
      return res.json({ status: 'stopped', started_at: null, stopped_at: null });
    }
    res.json({
      status: statusRow.status,
      started_at: statusRow.started_at,
      stopped_at: statusRow.stopped_at
    });
  } catch (err) {
    console.error('bot status error', err);
    res.status(500).json({ error: 'bot_status_failed' });
  }
});

// Start the bot for the authenticated user
userRouter.post('/bot-start', authMiddleware, async (req, res) => {
  try {
    // Set status to running, update started_at
    await run(`INSERT INTO bot_status (user_id, status, started_at, stopped_at) VALUES (?, 'running', CURRENT_TIMESTAMP, NULL)
      ON CONFLICT(user_id) DO UPDATE SET status='running', started_at=CURRENT_TIMESTAMP, stopped_at=NULL`, [req.user.dbUserId]);
    res.json({ ok: true, status: 'running' });
  } catch (err) {
    console.error('bot start error', err);
    res.status(500).json({ error: 'bot_start_failed' });
  }
});

// Stop the bot for the authenticated user
userRouter.post('/bot-stop', authMiddleware, async (req, res) => {
  try {
    // Set status to stopped, update stopped_at
    await run(`INSERT INTO bot_status (user_id, status, started_at, stopped_at) VALUES (?, 'stopped', NULL, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id) DO UPDATE SET status='stopped', stopped_at=CURRENT_TIMESTAMP`, [req.user.dbUserId]);
    res.json({ ok: true, status: 'stopped' });
  } catch (err) {
    console.error('bot stop error', err);
    res.status(500).json({ error: 'bot_stop_failed' });
  }
});
