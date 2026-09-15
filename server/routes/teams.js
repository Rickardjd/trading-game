const express = require('express');
const db = require('../db');

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

module.exports = router;
