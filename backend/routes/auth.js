import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { run, get } from '../services/db.js';
import crypto from 'crypto';
import { verifyMessage, getAddress } from 'ethers';

export const authRouter = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

authRouter.post('/register', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'missing_fields' });
  const hash = bcrypt.hashSync(password, 10);
  try {
    const info = await run('INSERT INTO users (email, password_hash) VALUES (?, ?)', [email, hash]);
    const user = { id: info.lastInsertRowid, email };
    const token = jwt.sign({ sub: user.id, email }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ user, token });
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) return res.status(409).json({ error: 'email_exists' });
    console.error('register error', err);
    res.status(500).json({ error: 'register_failed' });
  }
});

authRouter.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'missing_fields' });
  const row = await get('SELECT * FROM users WHERE email = ?', [email]);
  if (!row) return res.status(401).json({ error: 'invalid_credentials' });
  const ok = bcrypt.compareSync(password, row.password_hash);
  if (!ok) return res.status(401).json({ error: 'invalid_credentials' });
  const token = jwt.sign({ sub: row.id, email: row.email }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ user: { id: row.id, email: row.email }, token });
});

// Wallet auth: get nonce for address
authRouter.get('/wallet/nonce', async (req, res) => {
  try {
    const addr = String(req.query.address || '').toLowerCase();
    if (!/^0x[a-fA-F0-9]{40}$/.test(addr)) return res.status(400).json({ error: 'invalid_address' });
    const nonce = crypto.randomBytes(16).toString('hex');
    await run(
      `INSERT INTO wallet_auth (address, nonce, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(address) DO UPDATE SET nonce=excluded.nonce, updated_at=CURRENT_TIMESTAMP`,
      [addr, nonce]
    );
    res.json({ nonce });
  } catch (err) {
    console.error('wallet nonce error', err);
    res.status(500).json({ error: 'nonce_failed' });
  }
});

// Alternate nonce routes for flexibility (avoid 404s due to query parsing)
authRouter.get('/wallet/nonce/:address', async (req, res) => {
  try {
    const addr = String(req.params.address || '').toLowerCase();
    if (!/^0x[a-fA-F0-9]{40}$/.test(addr)) return res.status(400).json({ error: 'invalid_address' });
    const nonce = crypto.randomBytes(16).toString('hex');
    await run(
      `INSERT INTO wallet_auth (address, nonce, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(address) DO UPDATE SET nonce=excluded.nonce, updated_at=CURRENT_TIMESTAMP`,
      [addr, nonce]
    );
    res.json({ nonce });
  } catch (err) {
    console.error('wallet nonce (param) error', err);
    res.status(500).json({ error: 'nonce_failed' });
  }
});

authRouter.post('/wallet/nonce', async (req, res) => {
  try {
    const addr = String(req.body?.address || '').toLowerCase();
    if (!/^0x[a-fA-F0-9]{40}$/.test(addr)) return res.status(400).json({ error: 'invalid_address' });
    const nonce = crypto.randomBytes(16).toString('hex');
    await run(
      `INSERT INTO wallet_auth (address, nonce, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(address) DO UPDATE SET nonce=excluded.nonce, updated_at=CURRENT_TIMESTAMP`,
      [addr, nonce]
    );
    res.json({ nonce });
  } catch (err) {
    console.error('wallet nonce (post) error', err);
    res.status(500).json({ error: 'nonce_failed' });
  }
});

// Wallet auth: verify signature and return JWT
authRouter.post('/wallet/verify', async (req, res) => {
  try {
    const { address, signature } = req.body || {};
    const addr = String(address || '').toLowerCase();
    if (!/^0x[a-fA-F0-9]{40}$/.test(addr) || !signature) return res.status(400).json({ error: 'invalid_payload' });
    const row = await get('SELECT nonce, user_id FROM wallet_auth WHERE address = ?', [addr]);
    if (!row) return res.status(400).json({ error: 'nonce_missing' });
  // Build message with checksum-cased address to match frontend wagmi address formatting
  const checksumAddr = getAddress(addr);
  const message = `Sign in to Polymarket Copy Bot\nAddress: ${checksumAddr}\nNonce: ${row.nonce}`;
    let recovered;
    try {
      recovered = getAddress(verifyMessage(message, signature));
    } catch (e) {
      return res.status(400).json({ error: 'invalid_signature' });
    }
    if (recovered.toLowerCase() !== addr) return res.status(400).json({ error: 'address_mismatch' });

    // Link to existing user by email-less account or create a new minimal user
    let userId = row.user_id;
    if (!userId) {
      // Create a shadow user if not linked
      const info = await run('INSERT INTO users (email, password_hash) VALUES (?, ?)', [
        `wallet:${addr}`,
        'WALLET_AUTH',
      ]);
      userId = info.lastInsertRowid;
      await run('UPDATE wallet_auth SET user_id = ? WHERE address = ?', [userId, addr]);
    } 

    // Sign JWT with the wallet address as the public subject id; include internal dbUserId for server-side queries
    const token = jwt.sign({ sub: addr, wallet: addr, dbUserId: userId }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ user: { id: addr, email: `wallet:${addr}` }, token });
  } catch (err) {
    console.error('wallet verify error', err);
    res.status(500).json({ error: 'verify_failed' });
  }
});

export async function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'unauthorized' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    // Wallet-authenticated user: sub is the wallet address, dbUserId is the numeric user id
    if (payload.wallet && /^0x[a-fA-F0-9]{40}$/.test(String(payload.sub || ''))) {
      req.user = { id: String(payload.sub).toLowerCase(), wallet: String(payload.wallet).toLowerCase(), dbUserId: Number(payload.dbUserId) || null };
      return next();
    }
    // Password-auth user: sub is numeric user id
    req.user = { id: Number(payload.sub), email: payload.email, dbUserId: Number(payload.sub) };
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'invalid_token' });
  }
}
