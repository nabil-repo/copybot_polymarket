import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';

dotenv.config();

// Use Neon serverless Postgres instead of SQLite
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.warn('⚠️  DATABASE_URL not set. Database operations will fail.');
}

const sql = DATABASE_URL ? neon(DATABASE_URL) : null;


// Initialize tables (PostgreSQL-compatible)
export async function initDb() {
  if (!sql) {
    console.error('❌ Cannot initialize database: DATABASE_URL not configured');
    return;
  }

  try {
    // Users table with SERIAL for auto-increment
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        execution_wallet TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // User wallets
    await sql`
      CREATE TABLE IF NOT EXISTS user_wallets (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        wallet TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, wallet)
      )
    `;
    
    // Bot status per user
    await sql`
      CREATE TABLE IF NOT EXISTS bot_status (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL UNIQUE,
        status TEXT NOT NULL,
        started_at TIMESTAMP,
        stopped_at TIMESTAMP
      )
    `;

    // Processed trades
    await sql`
      CREATE TABLE IF NOT EXISTS processed_trades (
        id SERIAL PRIMARY KEY,
        wallet TEXT NOT NULL,
        transaction_hash TEXT NOT NULL,
        processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(wallet, transaction_hash)
      )
    `;

    // Wallet-based auth
    await sql`
      CREATE TABLE IF NOT EXISTS wallet_auth (
        address TEXT PRIMARY KEY,
        nonce TEXT NOT NULL,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Lit Protocol encrypted wallets
    await sql`
      CREATE TABLE IF NOT EXISTS encrypted_wallets (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        wallet_address TEXT NOT NULL,
        cipher_hex TEXT NOT NULL,
        iv_hex TEXT NOT NULL,
        encrypted_symmetric_key TEXT NOT NULL,
        access_control_conditions TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Polymarket API credentials (encrypted)
    await sql`
      CREATE TABLE IF NOT EXISTS polymarket_credentials (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        encrypted_api_key TEXT NOT NULL,
        encrypted_api_secret TEXT NOT NULL,
        encryption_iv TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    console.log('✅ Database tables initialized');
  } catch (error) {
    console.error('❌ Database initialization error:', error.message);
    throw error;
  }
}


// Query database (SELECT statements)
export async function query(queryStr, params = []) {
  if (!sql) {
    throw new Error('Database not configured');
  }

  try {
    // Convert parameterized query to Neon format
    // Replace ? placeholders with $1, $2, etc.
    let neonQuery = queryStr;
    let paramIndex = 1;
    while (neonQuery.includes('?')) {
      neonQuery = neonQuery.replace('?', `$${paramIndex}`);
      paramIndex++;
    }

    // Execute query with parameters
    const result = await sql(neonQuery, params);
    return result;
  } catch (error) {
    console.error('❌ Query error:', error.message);
    throw error;
  }
}

// Run INSERT/UPDATE/DELETE statements
export async function run(queryStr, params = []) {
  if (!sql) {
    throw new Error('Database not configured');
  }

  try {
    // Convert parameterized query to Neon format
    let neonQuery = queryStr;
    let paramIndex = 1;
    while (neonQuery.includes('?')) {
      neonQuery = neonQuery.replace('?', `$${paramIndex}`);
      paramIndex++;
    }

    // For INSERT statements, add RETURNING id to get last inserted ID
    if (neonQuery.toUpperCase().trim().startsWith('INSERT')) {
      // Check if RETURNING clause already exists
      if (!neonQuery.toUpperCase().includes('RETURNING')) {
        neonQuery = neonQuery.trim().replace(/;?\s*$/, '') + ' RETURNING id';
      }
      const result = await sql(neonQuery, params);
      // Return object with lastInsertRowid for compatibility
      return { 
        lastInsertRowid: result[0]?.id || 0,
        changes: result.length 
      };
    }

    // For UPDATE/DELETE, execute and return changes count
    const result = await sql(neonQuery, params);
    return { 
      changes: result.count || 0,
      lastInsertRowid: 0
    };
  } catch (error) {
    console.error('❌ Run error:', error.message);
    throw error;
  }
}

// Get single row
export async function get(queryStr, params = []) {
  const results = await query(queryStr, params);
  return results[0] || null;
}

// Get all rows
export async function all(queryStr, params = []) {
  return await query(queryStr, params);
}

