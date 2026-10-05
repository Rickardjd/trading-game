const path = require('node:path');
const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'trading-game.sqlite');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA foreign_keys = ON;');

const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

// Older databases have a transactions table whose CHECK constraint is missing newer
// types (shop/hire, then starting funds). SQLite can't alter a CHECK, so rebuild the
// table from the current schema definition, keeping every existing row and column.
const txSql = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'transactions'").get().sql;
if (!txSql.includes("'opening'")) {
  const body = schema.match(/CREATE TABLE IF NOT EXISTS transactions \(([\s\S]*?)\n\);/)[1];
  const oldColumns = db.prepare('PRAGMA table_info(transactions)').all().map((c) => c.name).join(', ');
  db.exec('PRAGMA foreign_keys = OFF;');
  db.exec('BEGIN;');
  db.exec(`CREATE TABLE transactions_new (${body}\n);`);
  db.exec(`INSERT INTO transactions_new (${oldColumns}) SELECT ${oldColumns} FROM transactions;`);
  db.exec('DROP TABLE transactions;');
  db.exec('ALTER TABLE transactions_new RENAME TO transactions;');
  db.exec('CREATE INDEX IF NOT EXISTS idx_transactions_timestamp ON transactions(timestamp);');
  db.exec('COMMIT;');
  db.exec('PRAGMA foreign_keys = ON;');
}

module.exports = db;
