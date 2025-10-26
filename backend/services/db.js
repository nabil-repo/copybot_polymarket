import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import initSqlJs from 'sql.js';

dotenv.config();

// SQLite (sql.js) only
const DB_PATH = process.env.DB_PATH || path.resolve(process.cwd(), 'data.db');
let sqliteDbPromise = null; // lazy-initialized sql.js database

async function getSqliteDb() {
  if (sqliteDbPromise) return sqliteDbPromise;
  sqliteDbPromise = (async () => {
    const SQL = await initSqlJs();
    if (fs.existsSync(DB_PATH)) {
      const fileBuffer = fs.readFileSync(DB_PATH);
      return new SQL.Database(new Uint8Array(fileBuffer));
    }
    return new SQL.Database();
  })();
  return sqliteDbPromise;
}

function saveSqliteDb(db) {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}


// Initialize tables (PostgreSQL-compatible)
export async function initDb() {
  // SQLite schema only
  const db = await getSqliteDb();
  try {
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      execution_wallet TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS user_wallets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      wallet TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, wallet)
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS bot_status (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      status TEXT NOT NULL,
      started_at DATETIME,
      stopped_at DATETIME,
      UNIQUE(user_id)
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS processed_trades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      wallet TEXT NOT NULL,
      transaction_hash TEXT NOT NULL,
      processed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(wallet, transaction_hash)
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS wallet_auth (
      address TEXT PRIMARY KEY,
      nonce TEXT NOT NULL,
      user_id INTEGER,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS encrypted_wallets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      wallet_address TEXT NOT NULL,
      cipher_hex TEXT NOT NULL,
      iv_hex TEXT NOT NULL,
      encrypted_symmetric_key TEXT NOT NULL,
      access_control_conditions TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id)
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS polymarket_credentials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      encrypted_api_key TEXT NOT NULL,
      encrypted_api_secret TEXT NOT NULL,
      encryption_iv TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id)
    )`);
    console.log('✅ Database tables initialized (SQLite)');
  } finally {
    saveSqliteDb(db);
  }
}


// Query database (SELECT statements)
export async function query(queryStr, params = []) {
  const db = await getSqliteDb();
  const stmt = db.prepare(queryStr);
  if (params.length) stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

// Run INSERT/UPDATE/DELETE statements
export async function run(queryStr, params = []) {
  const db = await getSqliteDb();
  const stmt = db.prepare(queryStr);
  if (params.length) stmt.bind(params);
  stmt.step();
  const lastId = db.exec("SELECT last_insert_rowid() as id")[0]?.values?.[0]?.[0] || 0;
  stmt.free();
  saveSqliteDb(db);
  return { lastInsertRowid: lastId, changes: 1 };
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

