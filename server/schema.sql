CREATE TABLE IF NOT EXISTS teams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  colour TEXT NOT NULL,
  balance INTEGER NOT NULL DEFAULT 0
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

CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  team_id INTEGER NOT NULL REFERENCES teams(id),
  type TEXT NOT NULL CHECK (type IN ('completion', 'adjustment', 'undo')),
  amount INTEGER NOT NULL,
  timestamp TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  station_id TEXT,
  note TEXT,
  related_completion_id INTEGER REFERENCES completions(id),
  related_transaction_id INTEGER REFERENCES transactions(id)
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
