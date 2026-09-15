const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/', (req, res) => {
  const activities = db.prepare('SELECT * FROM activities ORDER BY code ASC').all();
  res.json(activities);
});

router.get('/:code', (req, res) => {
  const activity = db.prepare('SELECT * FROM activities WHERE code = ?').get(req.params.code);
  if (!activity) return res.status(404).json({ error: 'Activity not found' });
  res.json(activity);
});

module.exports = router;
