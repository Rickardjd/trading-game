const express = require('express');
const db = require('../db');

const MIN_DURATION_SECONDS = 60; // 1 minute
const MAX_DURATION_SECONDS = 4 * 60 * 60; // 4 hours

function getState() {
  return db.prepare('SELECT * FROM game_timer WHERE id = 1').get();
}

module.exports = function createTimerRouter(io) {
  const router = express.Router();

  router.get('/', (req, res) => {
    res.json(getState());
  });

  // Sets the duration and (re)starts the countdown from full, regardless of
  // current state — this is the banking station's single "set and start" action.
  router.post('/start', (req, res) => {
    const durationSeconds = Math.trunc(Number(req.body?.duration_seconds));
    if (!Number.isFinite(durationSeconds) || durationSeconds < MIN_DURATION_SECONDS || durationSeconds > MAX_DURATION_SECONDS) {
      return res.status(400).json({
        error: `duration_seconds must be between ${MIN_DURATION_SECONDS} and ${MAX_DURATION_SECONDS}`,
      });
    }

    const endsAt = new Date(Date.now() + durationSeconds * 1000).toISOString();
    db.prepare(`
      UPDATE game_timer SET duration_seconds = ?, status = 'running', ends_at = ?, remaining_seconds = ?
      WHERE id = 1
    `).run(durationSeconds, endsAt, durationSeconds);

    const state = getState();
    io.emit('timer_update', state);
    res.json(state);
  });

  router.post('/pause', (req, res) => {
    const state = getState();
    if (state.status !== 'running') {
      return res.status(400).json({ error: 'Timer is not running' });
    }

    const remaining = Math.max(0, Math.round((new Date(state.ends_at).getTime() - Date.now()) / 1000));
    db.prepare(`
      UPDATE game_timer SET status = 'paused', ends_at = NULL, remaining_seconds = ?
      WHERE id = 1
    `).run(remaining);

    const updated = getState();
    io.emit('timer_update', updated);
    res.json(updated);
  });

  router.post('/resume', (req, res) => {
    const state = getState();
    if (state.status !== 'paused') {
      return res.status(400).json({ error: 'Timer is not paused' });
    }

    const endsAt = new Date(Date.now() + state.remaining_seconds * 1000).toISOString();
    db.prepare(`
      UPDATE game_timer SET status = 'running', ends_at = ?
      WHERE id = 1
    `).run(endsAt);

    const updated = getState();
    io.emit('timer_update', updated);
    res.json(updated);
  });

  router.post('/reset', (req, res) => {
    db.prepare(`
      UPDATE game_timer SET status = 'idle', duration_seconds = 0, ends_at = NULL, remaining_seconds = 0
      WHERE id = 1
    `).run();

    const updated = getState();
    io.emit('timer_update', updated);
    res.json(updated);
  });

  return router;
};
