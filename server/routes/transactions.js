const express = require('express');
const db = require('../db');
const { openHires } = require('./items');

function broadcastState(io) {
  const teams = db.prepare('SELECT * FROM teams ORDER BY balance DESC, name ASC').all();
  io.emit('balance_update', teams);
}

module.exports = function createTransactionsRouter(io) {
  const router = express.Router();

  router.get('/feed', (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const rows = db.prepare(`
      SELECT t.*, teams.name AS team_name, teams.colour AS team_colour
      FROM transactions t
      JOIN teams ON teams.id = t.team_id
      ORDER BY t.id DESC
      LIMIT ?
    `).all(limit);
    res.json(rows);
  });

  router.post('/adjustment', (req, res) => {
    const { team_code, amount, note, station_id } = req.body;
    if (!team_code || amount === undefined) {
      return res.status(400).json({ error: 'team_code and amount are required' });
    }
    const team = db.prepare('SELECT * FROM teams WHERE code = ?').get(team_code);
    if (!team) return res.status(404).json({ error: 'Team not found' });

    const amountInt = Math.trunc(Number(amount));
    if (Number.isNaN(amountInt)) return res.status(400).json({ error: 'amount must be a number' });

    db.prepare(`
      INSERT INTO transactions (team_id, type, amount, station_id, note)
      VALUES (?, 'adjustment', ?, ?, ?)
    `).run(team.id, amountInt, station_id || null, note || null);

    db.prepare('UPDATE teams SET balance = balance + ? WHERE id = ?').run(amountInt, team.id);

    const updatedTeam = db.prepare('SELECT * FROM teams WHERE id = ?').get(team.id);
    broadcastState(io);
    io.emit('feed_event', {
      type: 'adjustment',
      team: updatedTeam,
      amount: amountInt,
      note: note || null,
      timestamp: new Date().toISOString(),
    });

    res.status(201).json({ team: updatedTeam });
  });

  // Undo the most recent completion/adjustment/purchase/hire/late fee that has not
  // already been undone.
  router.post('/undo', (req, res) => {
    const { station_id } = req.body || {};

    const target = db.prepare(`
      SELECT * FROM transactions
      WHERE type IN ('completion', 'adjustment', 'purchase', 'hire', 'late_fee')
        AND id NOT IN (
          SELECT related_transaction_id FROM transactions
          WHERE type = 'undo' AND related_transaction_id IS NOT NULL
        )
      ORDER BY id DESC
      LIMIT 1
    `).get();

    if (!target) {
      return res.status(404).json({ error: 'Nothing to undo' });
    }

    const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(target.team_id);

    db.prepare(`
      INSERT INTO transactions (team_id, type, amount, station_id, note, related_transaction_id)
      VALUES (?, 'undo', ?, ?, ?, ?)
    `).run(target.team_id, -target.amount, station_id || null, `Undo: ${target.note || target.type}`, target.id);

    db.prepare('UPDATE teams SET balance = balance - ? WHERE id = ?').run(target.amount, target.team_id);

    // If undoing a completion, remove the completion record so the activity can be reattempted.
    // Clear references to it first so deleting it doesn't violate the foreign key.
    if (target.type === 'completion' && target.related_completion_id) {
      db.prepare('UPDATE transactions SET related_completion_id = NULL WHERE related_completion_id = ?')
        .run(target.related_completion_id);
      // Any chit cashed in for it becomes valid again, so the award can be redone.
      db.prepare('UPDATE chits SET completion_id = NULL, redeemed_at = NULL WHERE completion_id = ?')
        .run(target.related_completion_id);
      db.prepare('DELETE FROM completions WHERE id = ?').run(target.related_completion_id);
    }

    // Undoing a hire means it never happened: the tool goes back on the shelf.
    if (target.type === 'hire' && target.related_hire_id) {
      db.prepare('UPDATE transactions SET related_hire_id = NULL WHERE related_hire_id = ?')
        .run(target.related_hire_id);
      db.prepare('DELETE FROM hires WHERE id = ?').run(target.related_hire_id);
    }

    // Undoing a late fee waives it; the tool stays checked in.
    if (target.type === 'late_fee' && target.related_hire_id) {
      db.prepare('UPDATE hires SET late_fee = 0 WHERE id = ?').run(target.related_hire_id);
    }

    const updatedTeam = db.prepare('SELECT * FROM teams WHERE id = ?').get(target.team_id);
    broadcastState(io);
    if (target.type === 'hire') io.emit('hires_update', openHires());
    io.emit('feed_event', {
      type: 'undo',
      team: updatedTeam,
      reversed: target,
      timestamp: new Date().toISOString(),
    });

    res.json({ team: updatedTeam, reversed: target });
  });

  return router;
};
