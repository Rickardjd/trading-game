const express = require('express');
const db = require('../db');

const MAX_NAME_LENGTH = 24;

module.exports = function createTeamsRouter(io) {
  const router = express.Router();

  router.get('/', (req, res) => {
    const teams = db.prepare('SELECT * FROM teams ORDER BY balance DESC, name ASC').all();
    res.json(teams);
  });

  router.get('/:code', (req, res) => {
    const team = db.prepare('SELECT * FROM teams WHERE code = ?').get(req.params.code);
    if (!team) return res.status(404).json({ error: 'Team not found' });
    res.json(team);
  });

  // Set a team's display name — used at the start of the game to replace the
  // placeholder seed names, from the banking station.
  router.patch('/:code/name', (req, res) => {
    const { name } = req.body || {};
    const trimmed = typeof name === 'string' ? name.trim() : '';

    if (!trimmed) {
      return res.status(400).json({ error: 'name is required' });
    }
    if (trimmed.length > MAX_NAME_LENGTH) {
      return res.status(400).json({ error: `name must be ${MAX_NAME_LENGTH} characters or fewer (for the leaderboard's sake)` });
    }

    const team = db.prepare('SELECT * FROM teams WHERE code = ?').get(req.params.code);
    if (!team) return res.status(404).json({ error: 'Team not found' });

    db.prepare('UPDATE teams SET name = ? WHERE id = ?').run(trimmed, team.id);
    const updatedTeam = db.prepare('SELECT * FROM teams WHERE id = ?').get(team.id);

    const teams = db.prepare('SELECT * FROM teams ORDER BY balance DESC, name ASC').all();
    io.emit('balance_update', teams);

    res.json(updatedTeam);
  });

  return router;
};
