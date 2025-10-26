import { Router } from 'express';
import { run, all, get } from '../services/db.js';
import { authMiddleware } from './auth.js';
import { LitWalletService } from '../services/lit-wallet.js';
import {
  storePolymarketCredentials,
  getPolymarketCredentials,
  hasPolymarketCredentials,
  deletePolymarketCredentials
} from '../services/polymarket-credentials.js';
import { derivePolymarketApiKey } from '../services/polymarket-clob.js';

export const userRouter = Router();

const litWallet = new LitWalletService();

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

// Remove a wallet for the authenticated user
userRouter.delete('/wallets/:wallet', authMiddleware, async (req, res) => {
  try {
    const raw = req.params.wallet || '';
    // Normalize to lowercase to match storage
    const wallet = decodeURIComponent(raw).toLowerCase();
    if (!/^0x[a-f0-9]{40}$/.test(wallet)) {
      return res.status(400).json({ error: 'invalid_wallet_address' });
    }
    const result = await run('DELETE FROM user_wallets WHERE user_id = ? AND wallet = ?', [req.user.dbUserId, wallet]);
    res.json({ ok: true });
  } catch (err) {
    console.error('remove wallet error', err);
    res.status(500).json({ error: 'remove_wallet_failed' });
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

// ============= LIT PROTOCOL WALLET ENDPOINTS =============

// Create an encrypted wallet using Lit Protocol
userRouter.post('/lit-wallet/create', authMiddleware, async (req, res) => {
  try {
    const { authSig, accessControlConditions } = req.body || {};
    
    if (!authSig || !accessControlConditions) {
      return res.status(400).json({ 
        error: 'missing_params',
        message: 'authSig and accessControlConditions are required' 
      });
    }

    // Initialize Lit client if not already connected
    await litWallet.initialize();

    // Create encrypted wallet
    const encryptedWallet = await litWallet.createEncryptedWallet(
      accessControlConditions,
      authSig
    );

    // Store encrypted wallet in database
    await run(
      `INSERT OR REPLACE INTO encrypted_wallets 
       (user_id, wallet_address, cipher_hex, iv_hex, encrypted_symmetric_key, access_control_conditions) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        req.user.dbUserId,
        encryptedWallet.address.toLowerCase(),
        encryptedWallet.encryptedKey.cipherHex,
        encryptedWallet.encryptedKey.ivHex,
        encryptedWallet.encryptedKey.encryptedSymmetricKey,
        JSON.stringify(accessControlConditions)
      ]
    );

    // Also update execution_wallet to this new address
    await run(
      'UPDATE users SET execution_wallet = ? WHERE id = ?',
      [encryptedWallet.address.toLowerCase(), req.user.dbUserId]
    );

    console.log('✅ Created Lit-encrypted wallet for user', req.user.dbUserId);

    res.json({
      ok: true,
      address: encryptedWallet.address,
      message: 'Encrypted wallet created and stored successfully'
    });
  } catch (err) {
    console.error('❌ Lit wallet creation error:', err);
    res.status(500).json({ 
      error: 'wallet_creation_failed',
      message: err.message 
    });
  }
});

// ============= POLYMARKET API CREDENTIALS ENDPOINTS =============

// Store Polymarket API credentials (encrypted)
userRouter.post('/polymarket/credentials', authMiddleware, async (req, res) => {
  try {
    const { apiKey, apiSecret } = req.body || {};
    
    if (!apiKey || !apiSecret) {
      return res.status(400).json({ 
        error: 'missing_credentials',
        message: 'Both apiKey and apiSecret are required' 
      });
    }

    // Validate API key format (basic check)
    if (typeof apiKey !== 'string' || apiKey.length < 10) {
      return res.status(400).json({ 
        error: 'invalid_api_key',
        message: 'API key appears invalid' 
      });
    }

    // Store encrypted credentials
    const success = await storePolymarketCredentials(
      req.user.dbUserId,
      apiKey,
      apiSecret
    );

    if (!success) {
      return res.status(500).json({ 
        error: 'storage_failed',
        message: 'Failed to store credentials' 
      });
    }

    res.json({
      ok: true,
      message: 'Polymarket API credentials stored securely'
    });
  } catch (err) {
    console.error('❌ Store Polymarket credentials error:', err);
    res.status(500).json({ 
      error: 'credentials_storage_failed',
      message: err.message 
    });
  }
});

// Check if user has Polymarket credentials
userRouter.get('/polymarket/credentials', authMiddleware, async (req, res) => {
  try {
    const hasCredentials = await hasPolymarketCredentials(req.user.dbUserId);
    
    res.json({
      configured: hasCredentials,
      message: hasCredentials 
        ? 'Polymarket API credentials are configured' 
        : 'No Polymarket API credentials found'
    });
  } catch (err) {
    console.error('❌ Check Polymarket credentials error:', err);
    res.status(500).json({ 
      error: 'credentials_check_failed',
      message: err.message 
    });
  }
});

// Delete Polymarket credentials
userRouter.delete('/polymarket/credentials', authMiddleware, async (req, res) => {
  try {
    const success = await deletePolymarketCredentials(req.user.dbUserId);
    
    if (!success) {
      return res.status(500).json({ 
        error: 'deletion_failed',
        message: 'Failed to delete credentials' 
      });
    }

    res.json({
      ok: true,
      message: 'Polymarket API credentials deleted'
    });
  } catch (err) {
    console.error('❌ Delete Polymarket credentials error:', err);
    res.status(500).json({ 
      error: 'credentials_deletion_failed',
      message: err.message 
    });
  }
});

// Derive Polymarket API credentials using a signer private key and store them
userRouter.post('/polymarket/derive', authMiddleware, async (req, res) => {
  try {
    const { privateKey, funder, signatureType } = req.body || {};

    // Prefer explicit privateKey; fallback to env PRIVATE_KEY for dev
    const signerPk = privateKey || process.env.PRIVATE_KEY;

    if (!signerPk) {
      return res.status(400).json({
        error: 'missing_private_key',
        message: 'Provide privateKey in body or set PRIVATE_KEY in .env on the server.',
      });
    }

    // Funder defaults to the user's execution wallet if not provided
    let effectiveFunder = funder;
    if (!effectiveFunder) {
      const row = await get('SELECT execution_wallet FROM users WHERE id = ?', [req.user.dbUserId]);
      effectiveFunder = row?.execution_wallet || '';
    }

    const { apiKey, apiSecret } = await derivePolymarketApiKey({
      privateKey: signerPk,
      funder: effectiveFunder,
      signatureType,
    });

    const stored = await storePolymarketCredentials(req.user.dbUserId, apiKey, apiSecret);
    if (!stored) {
      return res.status(500).json({ error: 'storage_failed', message: 'Failed to store derived credentials' });
    }

    res.json({ ok: true, message: 'Derived and stored Polymarket API credentials' });
  } catch (err) {
    console.error('❌ Derive Polymarket credentials error:', err);
    res.status(500).json({ error: 'derive_failed', message: err.message });
  }
});

// Get encrypted wallet info (not the private key!)
userRouter.get('/lit-wallet', authMiddleware, async (req, res) => {
  try {
    const wallet = await get(
      'SELECT wallet_address, created_at FROM encrypted_wallets WHERE user_id = ?',
      [req.user.dbUserId]
    );

    if (!wallet) {
      return res.json({ 
        exists: false,
        message: 'No encrypted wallet found. Create one first.' 
      });
    }

    res.json({
      exists: true,
      address: wallet.wallet_address,
      created_at: wallet.created_at
    });
  } catch (err) {
    console.error('❌ Get Lit wallet error:', err);
    res.status(500).json({ 
      error: 'get_wallet_failed',
      message: err.message 
    });
  }
});
