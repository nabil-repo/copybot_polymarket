import { ClobClient } from '@polymarket/clob-client';
import { Wallet as V5Wallet } from '@ethersproject/wallet';

// Ensure .env variables are loaded
import 'dotenv/config';

const DEFAULT_HOST = process.env.POLYMARKET_CLOB_HOST || 'https://clob.polymarket.com';
const DEFAULT_CHAIN_ID = Number(process.env.POLYMARKET_CHAIN_ID || 137);

/**
 * Derive or create a Polymarket API key/secret using a signer private key.
 * Returns { apiKey, apiSecret } suitable for storage.
 *
 * @param {Object} opts
 * @param {string} opts.privateKey - EOA private key (0x...)
 * @param {string} [opts.funder] - Polymarket profile address where funds are sent
 * @param {number} [opts.signatureType=1] - 0 EOA, 1 Magic/Email, 2 Metamask
 * @param {string} [opts.host]
 * @param {number} [opts.chainId]
 */
export async function derivePolymarketApiKey({
  privateKey,
  funder = '',
  signatureType = Number(process.env.POLYMARKET_SIGNATURE_TYPE || 1),
  host = DEFAULT_HOST,
  chainId = DEFAULT_CHAIN_ID,
}) {
  if (!privateKey || !privateKey.startsWith('0x')) {
    throw new Error('privateKey is required to derive Polymarket API key');
  }

  const signer = new V5Wallet(privateKey);

  // In general don't create a new API key, always derive or createOrDerive
  const creds = await new ClobClient(host, chainId, signer).createOrDeriveApiKey();

  // creds shape may vary; normalize common fields
  const apiKey = creds?.apiKey || creds?.key || creds?.api_key;
  const apiSecret = creds?.apiSecret || creds?.secret || creds?.api_secret;

  if (!apiKey || !apiSecret) {
    throw new Error('Failed to derive API credentials from Polymarket');
  }

  // Optionally return a ready client (not strictly needed for storage)
  const client = new ClobClient(host, chainId, signer, creds, signatureType, funder);

  return { apiKey, apiSecret, client };
}
