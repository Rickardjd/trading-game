const path = require('node:path');
const fs = require('node:fs');
const express = require('express');
const db = require('../db');
const { openHires } = require('./items');

const BACKUP_DIR = path.join(__dirname, '..', '..', 'data', 'backups');
const TEAMS_SEED_PATH = path.join(__dirname, '..', 'seed', 'teams.json');

module.exports = function createGameRouter(io) {
  const router = express.Router();

  // Wipes the game back to its starting state — from the leader dashboard. Balances
  // return to each team's starting funds; completions, hires, the ledger and the timer
  // are cleared and every grade chit becomes usable again. Team names and which teams
  // are playing are kept. The database is copied to data/backups first, so a reset
  // done by mistake can still be recovered by hand.
  router.post('/reset', (req, res) => {
    try {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(BACKUP_DIR, `before-reset-${stamp}.sqlite`);
      db.prepare('VACUUM INTO ?').run(backupPath);

      const seedTeams = JSON.parse(fs.readFileSync(TEAMS_SEED_PATH, 'utf8'));
      const startingFunds = new Map(seedTeams.map((t) => [t.code, Math.trunc(t.starting_funds ?? 0)]));

      db.exec('BEGIN;');
      try {
        db.exec(`
          DELETE FROM transactions;
          UPDATE chits SET completion_id = NULL, redeemed_at = NULL;
          DELETE FROM hires;
          DELETE FROM completions;
          UPDATE teams SET balance = 0;
          UPDATE game_timer SET status = 'idle', duration_seconds = 0, ends_at = NULL, remaining_seconds = 0
          WHERE id = 1;
        `);

        const insertOpening = db.prepare(`
          INSERT INTO transactions (team_id, type, amount, station_id, note) VALUES (?, 'opening', ?, 'reset', 'Starting funds')
        `);
        const setBalance = db.prepare('UPDATE teams SET balance = ? WHERE id = ?');
        for (const team of db.prepare('SELECT * FROM teams').all()) {
          const funds = startingFunds.get(team.code) ?? 0;
          if (funds > 0) {
            insertOpening.run(team.id, funds);
            setBalance.run(funds, team.id);
          }
        }
        db.exec('COMMIT;');
      } catch (err) {
        db.exec('ROLLBACK;');
        throw err;
      }

      const teams = db.prepare('SELECT * FROM teams ORDER BY balance DESC, name ASC').all();
      io.emit('balance_update', teams);
      io.emit('hires_update', openHires());
      io.emit('timer_update', db.prepare('SELECT * FROM game_timer WHERE id = 1').get());
      io.emit('game_reset');

      res.json({ teams, backup: path.basename(backupPath) });
    } catch (err) {
      console.error('Game reset failed:', err);
      res.status(500).json({ error: `Could not reset the game: ${err.message}` });
    }
  });

  return router;
};
