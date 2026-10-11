CREATE TABLE IF NOT EXISTS teams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  colour TEXT NOT NULL,
  balance INTEGER NOT NULL DEFAULT 0,
  -- 0 = sitting this game out: hidden from the leaderboard, can't be scanned at the bank.
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT,
  materials_required TEXT,
  tools_required TEXT,
  description_of_outcome TEXT NOT NULL,
  poor_value INTEGER NOT NULL,
  standard_value INTEGER NOT NULL,
  excellent_value INTEGER NOT NULL,
  not_met_value INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS completions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  team_id INTEGER NOT NULL REFERENCES teams(id),
  activity_id INTEGER NOT NULL REFERENCES activities(id),
  award_level TEXT NOT NULL CHECK (award_level IN ('poor', 'standard', 'excellent')),
  awarded_value INTEGER NOT NULL,
  examiner_notes TEXT,
  timestamp TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  station_id TEXT,
  UNIQUE (team_id, activity_id)
);

-- Things teams can spend money on. 'buy' items are consumables sold outright;
-- 'hire' items are individual physical tools (one row per labelled unit, e.g.
-- "Scissors #3") that are checked out for hire_minutes and charged
-- late_fee_per_minute for every started minute they come back late.
CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('buy', 'hire')),
  price INTEGER NOT NULL,
  hire_minutes INTEGER,
  late_fee_per_minute INTEGER
);

CREATE TABLE IF NOT EXISTS hires (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER NOT NULL REFERENCES items(id),
  team_id INTEGER NOT NULL REFERENCES teams(id),
  hire_fee INTEGER NOT NULL,
  checked_out_at TEXT NOT NULL,
  due_at TEXT NOT NULL,
  checked_in_at TEXT,
  minutes_late INTEGER,
  late_fee INTEGER,
  out_station_id TEXT,
  in_station_id TEXT
);

-- A physical tool can only be out to one team at a time, enforced by the database.
CREATE UNIQUE INDEX IF NOT EXISTS idx_hires_open_item ON hires(item_id) WHERE checked_in_at IS NULL;

CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  team_id INTEGER NOT NULL REFERENCES teams(id),
  type TEXT NOT NULL CHECK (type IN ('opening', 'completion', 'adjustment', 'undo', 'purchase', 'hire', 'late_fee')),
  amount INTEGER NOT NULL,
  timestamp TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  station_id TEXT,
  note TEXT,
  related_completion_id INTEGER REFERENCES completions(id),
  related_transaction_id INTEGER REFERENCES transactions(id),
  related_item_id INTEGER REFERENCES items(id),
  related_hire_id INTEGER REFERENCES hires(id)
);

CREATE INDEX IF NOT EXISTS idx_transactions_timestamp ON transactions(timestamp);
CREATE INDEX IF NOT EXISTS idx_completions_team ON completions(team_id);

-- Single-row table holding the game countdown timer's state.
CREATE TABLE IF NOT EXISTS game_timer (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'idle' CHECK (status IN ('idle', 'running', 'paused')),
  ends_at TEXT,
  remaining_seconds INTEGER NOT NULL DEFAULT 0
);

INSERT OR IGNORE INTO game_timer (id, duration_seconds, status, ends_at, remaining_seconds)
VALUES (1, 0, 'idle', NULL, 0);

-- Single-use grade chits handed out by assessors (e.g. CHIT-E-007 = Excellent). A
-- team cashes one in at the bank after scanning the activity, which sets the award
-- level; completion_id records what it was spent on, so it can't be used twice.
CREATE TABLE IF NOT EXISTS chits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  award_level TEXT NOT NULL CHECK (award_level IN ('poor', 'standard', 'excellent')),
  completion_id INTEGER UNIQUE REFERENCES completions(id),
  redeemed_at TEXT
);
