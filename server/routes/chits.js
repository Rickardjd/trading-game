const express = require('express');
const db = require('../db');

const router = express.Router();

// Look up a grade chit, including whether (and on what) it has already been cashed in.
router.get('/:code', (req, res) => {
  const chit = db.prepare(`
    SELECT chits.*, teams.name AS team_name, activities.code AS activity_code
    FROM chits
    LEFT JOIN completions ON completions.id = chits.completion_id
    LEFT JOIN teams ON teams.id = completions.team_id
    LEFT JOIN activities ON activities.id = completions.activity_id
    WHERE chits.code = ?
  `).get(req.params.code);
  if (!chit) return res.status(404).json({ error: 'Chit not found' });
  res.json(chit);
});

module.exports = router;
