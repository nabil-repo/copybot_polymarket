import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'data.db');

let db = null;

async function getDb() {
  if (db) return db;
  
  const SQL = await initSqlJs();
  
  // Load existing DB if it exists
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }
  
  return db;
}

function saveDb() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  }
}

// Initialize tables
export async function initDb() {
  const database = await getDb();
  
  database.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    execution_wallet TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  database.run(`CREATE TABLE IF NOT EXISTS user_wallets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    wallet TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, wallet),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);
  
      // Bot status table for tracking bot start/stop per user
      database.run(`CREATE TABLE IF NOT EXISTS bot_status (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        status TEXT NOT NULL, -- running, stopped
        started_at DATETIME,
        stopped_at DATETIME,
        UNIQUE(user_id)
      )`);
  database.run(`CREATE TABLE IF NOT EXISTS processed_trades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wallet TEXT NOT NULL,
    transaction_hash TEXT NOT NULL,
    processed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(wallet, transaction_hash)
  )`);

  // Wallet-based auth nonce storage
  database.run(`CREATE TABLE IF NOT EXISTS wallet_auth (
    address TEXT PRIMARY KEY,
    nonce TEXT NOT NULL,
    user_id INTEGER,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
  )`);

  // Lit Protocol encrypted wallets
  database.run(`CREATE TABLE IF NOT EXISTS encrypted_wallets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    wallet_address TEXT NOT NULL,
    cipher_hex TEXT NOT NULL,
    iv_hex TEXT NOT NULL,
    encrypted_symmetric_key TEXT NOT NULL,
    access_control_conditions TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);

  // Polymarket API credentials (encrypted)
  database.run(`CREATE TABLE IF NOT EXISTS polymarket_credentials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    encrypted_api_key TEXT NOT NULL,
    encrypted_api_secret TEXT NOT NULL,
    encryption_iv TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);
  
  // Migration: Add execution_wallet column if it doesn't exist
  try {
    const tableInfo = database.exec("PRAGMA table_info(users)");
    const columns = tableInfo[0]?.values || [];
    const hasExecutionWallet = columns.some(col => col[1] === 'execution_wallet');
    
    if (!hasExecutionWallet) {
      console.log('📦 Migrating database: Adding execution_wallet column to users table');
      database.run(`ALTER TABLE users ADD COLUMN execution_wallet TEXT`);
    }
  } catch (error) {
    console.log('⚠️  Database migration error:', error.message);
  }
  
  saveDb();
}

export async function query(sql, params = []) {
  const database = await getDb();
  try {
    const stmt = database.prepare(sql);
    if (params.length > 0) stmt.bind(params);
    
    const results = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      results.push(row);
    }
    stmt.free();
    
    return results;
  } finally {
    saveDb();
  }
}

export async function run(sql, params = []) {
  const database = await getDb();
  try {
    database.run(sql, params);
    const lastId = database.exec("SELECT last_insert_rowid() as id")[0]?.values[0]?.[0];
    return { lastInsertRowid: lastId || 0, changes: 1 };
  } finally {
    saveDb();
  }
}

export async function get(sql, params = []) {
  const results = await query(sql, params);
  return results[0] || null;
}

export async function all(sql, params = []) {
  return await query(sql, params);
}
