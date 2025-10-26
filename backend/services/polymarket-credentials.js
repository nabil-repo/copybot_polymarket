import crypto from "crypto";
import { run, get } from "./db.js";

// Encryption settings
const ALGORITHM = "aes-256-gcm";
const ENCRYPTION_KEY_HEX = process.env.ENCRYPTION_KEY || "";

if (!ENCRYPTION_KEY_HEX || ENCRYPTION_KEY_HEX.length !== 64) {
  // Fail fast to avoid encrypting with a random key that can't be decrypted later
  console.error(
    "Missing or invalid ENCRYPTION_KEY. Please set a 32-byte (64 hex chars) ENCRYPTION_KEY in your .env before starting the backend."
  );
  throw new Error("ENCRYPTION_KEY is required and must be 64 hex characters");
}

const ENCRYPTION_KEY = Buffer.from(ENCRYPTION_KEY_HEX, "hex");

/**
 * Encrypt text using AES-256-GCM
 */
function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);

  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  return {
    encrypted: encrypted,
    iv: iv.toString("hex"),
    authTag: authTag.toString("hex"),
  };
}

/**
 * Decrypt text using AES-256-GCM
 */
function decrypt(encryptedData, ivHex, authTagHex) {
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);

  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedData, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

/**
 * Store encrypted Polymarket API credentials for a user
 * @param {number} userId
 * @param {string} apiKey - Polymarket API key
 * @param {string} apiSecret - Polymarket API secret
 */
export async function storePolymarketCredentials(userId, apiKey, apiSecret) {
  try {
    // Encrypt API key and secret
    const encryptedKey = encrypt(apiKey);
    const encryptedSecret = encrypt(apiSecret);

    // Store in database (use same IV for simplicity, different data)
    await run(
      `INSERT OR REPLACE INTO polymarket_credentials 
       (user_id, encrypted_api_key, encrypted_api_secret, encryption_iv, updated_at) 
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [
        userId,
        JSON.stringify({
          encrypted: encryptedKey.encrypted,
          authTag: encryptedKey.authTag,
        }),
        JSON.stringify({
          encrypted: encryptedSecret.encrypted,
          authTag: encryptedSecret.authTag,
        }),
        encryptedKey.iv,
      ]
    );

    console.log(
      `✅ Stored encrypted Polymarket credentials for user ${userId}`
    );
    return true;
  } catch (error) {
    console.error(
      `❌ Failed to store credentials for user ${userId}:`,
      error.message
    );
    return false;
  }
}

/**
 * Retrieve and decrypt Polymarket API credentials for a user
 * @param {number} userId
 * @returns {Promise<{apiKey: string, apiSecret: string} | null>}
 */
export async function getPolymarketCredentials(userId) {
  try {
    const row = await get(
      "SELECT encrypted_api_key, encrypted_api_secret, encryption_iv FROM polymarket_credentials WHERE user_id = ?",
      [userId]
    );

    if (!row) {
      return null;
    }

    // Parse encrypted data
    const encryptedKey = JSON.parse(row.encrypted_api_key);
    const encryptedSecret = JSON.parse(row.encrypted_api_secret);
    const iv = row.encryption_iv;

    // Decrypt
    const apiKey = decrypt(encryptedKey.encrypted, iv, encryptedKey.authTag);
    const apiSecret = decrypt(
      encryptedSecret.encrypted,
      iv,
      encryptedSecret.authTag
    );

    return { apiKey, apiSecret };
  } catch (error) {
    console.error(
      `❌ Failed to retrieve credentials for user ${userId}:`,
      error.message
    );
    return null;
  }
}

/**
 * Check if user has stored Polymarket credentials
 * @param {number} userId
 * @returns {Promise<boolean>}
 */
export async function hasPolymarketCredentials(userId) {
  try {
    const row = await get(
      "SELECT id FROM polymarket_credentials WHERE user_id = ?",
      [userId]
    );
    return !!row;
  } catch (error) {
    return false;
  }
}

/**
 * Delete Polymarket credentials for a user
 * @param {number} userId
 */
export async function deletePolymarketCredentials(userId) {
  try {
    await run("DELETE FROM polymarket_credentials WHERE user_id = ?", [userId]);
    console.log(`✅ Deleted Polymarket credentials for user ${userId}`);
    return true;
  } catch (error) {
    console.error(
      `❌ Failed to delete credentials for user ${userId}:`,
      error.message
    );
    return false;
  }
}
