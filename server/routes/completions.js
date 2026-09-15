const express = require('express');
const db = require('../db');

const VALUE_COLUMN = {
  poor: 'poor_value',
  standard: 'standard_value',
  excellent: 'excellent_value',
};

function broadcastState(io) {
  const teams = db.prepare('SELECT * FROM teams ORDER BY balance DESC, name ASC').all();
  io.emit('balance_update', teams);
}

module.exports = function createCompletionsRouter(io) {
  const router = express.Router();

  // Check whether a team has already completed an activity, before an award is chosen.
  router.get('/check', (req, res) => {
    const { team_code, activity_code } = req.query;
    if (!team_code || !activity_code) {
      return res.status(400).json({ error: 'team_code and activity_code are required' });
    }
    const team = db.prepare('SELECT * FROM teams WHERE code = ?').get(team_code);
    if (!team) return res.status(404).json({ error: 'Team not found' });
    const activity = db.prepare('SELECT * FROM activities WHERE code = ?').get(activity_code);
    if (!activity) return res.status(404).json({ error: 'Activity not found' });

    const completion = db
      .prepare('SELECT * FROM completions WHERE team_id = ? AND activity_id = ?')
      .get(team.id, activity.id);

    res.json({ team, activity, completed: !!completion, completion: completion || null });
  });

  router.post('/', (req, res) => {
    const { team_code, activity_code, award_level, examiner_notes, station_id } = req.body;

    if (!team_code || !activity_code || !award_level) {
      return res.status(400).json({ error: 'team_code, activity_code and award_level are required' });
    }

    const team = db.prepare('SELECT * FROM teams WHERE code = ?').get(team_code);
    if (!team) return res.status(404).json({ error: 'Team not found' });

    const activity = db.prepare('SELECT * FROM activities WHERE code = ?').get(activity_code);
    if (!activity) return res.status(404).json({ error: 'Activity not found' });

    const existing = db
      .prepare('SELECT * FROM completions WHERE team_id = ? AND activity_id = ?')
      .get(team.id, activity.id);
    if (existing) {
      return res.status(409).json({ error: 'Already completed — no reward', completion: existing });
    }

    if (award_level === 'not_met') {
      // Not recorded as a completion, so the team may attempt the activity again.
      return res.json({ recorded: false, awarded_value: 0, team, activity });
    }

    const column = VALUE_COLUMN[award_level];
    if (!column) {
      return res.status(400).json({ error: 'award_level must be one of poor, standard, excellent, not_met' });
    }
    const awardedValue = activity[column];

    let completion;
    try {
      const insertCompletion = db.prepare(`
        INSERT INTO completions (team_id, activity_id, award_level, awarded_value, examiner_notes, station_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      const result = insertCompletion.run(
        team.id,
        activity.id,
        award_level,
        awardedValue,
        examiner_notes || null,
        station_id || null
      );
      completion = db.prepare('SELECT * FROM completions WHERE id = ?').get(result.lastInsertRowid);

      db.prepare(`
        INSERT INTO transactions (team_id, type, amount, station_id, note, related_completion_id)
        VALUES (?, 'completion', ?, ?, ?, ?)
      `).run(team.id, awardedValue, station_id || null, `${activity.code} ${activity.name} (${award_level})`, completion.id);

      db.prepare('UPDATE teams SET balance = balance + ? WHERE id = ?').run(awardedValue, team.id);
    } catch (err) {
      if (String(err.message).includes('UNIQUE')) {
        return res.status(409).json({ error: 'Already completed — no reward' });
      }
      throw err;
    }

    const updatedTeam = db.prepare('SELECT * FROM teams WHERE id = ?').get(team.id);

    broadcastState(io);
    io.emit('feed_event', {
      type: 'completion',
      team: updatedTeam,
      activity,
      completion,
      timestamp: completion.timestamp,
    });

    res.status(201).json({ recorded: true, completion, team: updatedTeam, activity });
  });

  return router;
};
