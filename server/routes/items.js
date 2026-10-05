const express = require('express');
const db = require('../db');

const MAX_PURCHASE_QUANTITY = 50;

function broadcastState(io) {
  const teams = db.prepare('SELECT * FROM teams ORDER BY balance DESC, name ASC').all();
  io.emit('balance_update', teams);
}

function openHires() {
  return db.prepare(`
    SELECT h.*, items.code AS item_code, items.name AS item_name, items.late_fee_per_minute,
      teams.code AS team_code, teams.name AS team_name, teams.colour AS team_colour
    FROM hires h
    JOIN items ON items.id = h.item_id
    JOIN teams ON teams.id = h.team_id
    WHERE h.checked_in_at IS NULL
    ORDER BY h.due_at ASC
  `).all();
}

function broadcastHires(io) {
  io.emit('hires_update', openHires());
}

// Every started minute past the due time counts as a full minute late.
function minutesLate(dueAt, now) {
  const overdueMs = now - new Date(dueAt).getTime();
  return overdueMs > 0 ? Math.ceil(overdueMs / 60000) : 0;
}

function findOpenHire(itemId) {
  return db.prepare('SELECT * FROM hires WHERE item_id = ? AND checked_in_at IS NULL').get(itemId);
}

module.exports = function createItemsRouter(io) {
  const router = express.Router();

  router.get('/', (req, res) => {
    const items = db.prepare('SELECT * FROM items ORDER BY type ASC, code ASC').all();
    res.json(items);
  });

  router.get('/hires', (req, res) => {
    res.json(openHires());
  });

  // Look up a scanned item, including who has it if it's a hire tool that's out.
  router.get('/:code', (req, res) => {
    const item = db.prepare('SELECT * FROM items WHERE code = ?').get(req.params.code);
    if (!item) return res.status(404).json({ error: 'Item not found' });

    let hire = null;
    if (item.type === 'hire') {
      hire = openHires().find((h) => h.item_id === item.id) || null;
    }
    res.json({ item, hire });
  });

  router.post('/purchase', (req, res) => {
    const { team_code, item_code, quantity, station_id } = req.body;
    if (!team_code || !item_code) {
      return res.status(400).json({ error: 'team_code and item_code are required' });
    }
    const qty = Math.trunc(Number(quantity ?? 1));
    if (!(qty >= 1 && qty <= MAX_PURCHASE_QUANTITY)) {
      return res.status(400).json({ error: `quantity must be between 1 and ${MAX_PURCHASE_QUANTITY}` });
    }

    const team = db.prepare('SELECT * FROM teams WHERE code = ?').get(team_code);
    if (!team) return res.status(404).json({ error: 'Team not found' });
    const item = db.prepare('SELECT * FROM items WHERE code = ?').get(item_code);
    if (!item) return res.status(404).json({ error: 'Item not found' });
    if (item.type !== 'buy') {
      return res.status(400).json({ error: `${item.name} is hired, not bought` });
    }

    const cost = item.price * qty;
    if (team.balance < cost) {
      return res.status(402).json({ error: `Not enough money — costs £${cost}, ${team.name} has £${team.balance}` });
    }

    const note = `Bought ${qty} × ${item.name}`;
    db.prepare(`
      INSERT INTO transactions (team_id, type, amount, station_id, note, related_item_id)
      VALUES (?, 'purchase', ?, ?, ?, ?)
    `).run(team.id, -cost, station_id || null, note, item.id);
    db.prepare('UPDATE teams SET balance = balance - ? WHERE id = ?').run(cost, team.id);

    const updatedTeam = db.prepare('SELECT * FROM teams WHERE id = ?').get(team.id);
    broadcastState(io);
    io.emit('feed_event', {
      type: 'purchase',
      team: updatedTeam,
      item,
      quantity: qty,
      amount: -cost,
      timestamp: new Date().toISOString(),
    });

    res.status(201).json({ team: updatedTeam, item, quantity: qty, cost });
  });

  // Check a hire tool out to a team: charges the flat hire fee and starts its clock.
  router.post('/hire', (req, res) => {
    const { team_code, item_code, station_id } = req.body;
    if (!team_code || !item_code) {
      return res.status(400).json({ error: 'team_code and item_code are required' });
    }

    const team = db.prepare('SELECT * FROM teams WHERE code = ?').get(team_code);
    if (!team) return res.status(404).json({ error: 'Team not found' });
    const item = db.prepare('SELECT * FROM items WHERE code = ?').get(item_code);
    if (!item) return res.status(404).json({ error: 'Item not found' });
    if (item.type !== 'hire') {
      return res.status(400).json({ error: `${item.name} is bought, not hired` });
    }
    if (findOpenHire(item.id)) {
      return res.status(409).json({ error: `${item.name} is already out on hire — check it in first` });
    }
    if (team.balance < item.price) {
      return res.status(402).json({ error: `Not enough money — hire costs £${item.price}, ${team.name} has £${team.balance}` });
    }

    const now = new Date();
    const dueAt = new Date(now.getTime() + item.hire_minutes * 60000);

    let hire;
    try {
      const result = db.prepare(`
        INSERT INTO hires (item_id, team_id, hire_fee, checked_out_at, due_at, out_station_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(item.id, team.id, item.price, now.toISOString(), dueAt.toISOString(), station_id || null);
      hire = db.prepare('SELECT * FROM hires WHERE id = ?').get(result.lastInsertRowid);
    } catch (err) {
      if (String(err.message).includes('UNIQUE')) {
        return res.status(409).json({ error: `${item.name} is already out on hire — check it in first` });
      }
      throw err;
    }

    db.prepare(`
      INSERT INTO transactions (team_id, type, amount, station_id, note, related_item_id, related_hire_id)
      VALUES (?, 'hire', ?, ?, ?, ?, ?)
    `).run(team.id, -item.price, station_id || null, `Hired ${item.name} (${item.hire_minutes} min)`, item.id, hire.id);
    db.prepare('UPDATE teams SET balance = balance - ? WHERE id = ?').run(item.price, team.id);

    const updatedTeam = db.prepare('SELECT * FROM teams WHERE id = ?').get(team.id);
    broadcastState(io);
    broadcastHires(io);
    io.emit('feed_event', {
      type: 'hire',
      team: updatedTeam,
      item,
      hire,
      amount: -item.price,
      timestamp: hire.checked_out_at,
    });

    res.status(201).json({ team: updatedTeam, item, hire });
  });

  // Check a hire tool back in. Any late fee is charged to the team that hired it,
  // whoever is actually handing it back.
  router.post('/return', (req, res) => {
    const { item_code, station_id } = req.body;
    if (!item_code) return res.status(400).json({ error: 'item_code is required' });

    const item = db.prepare('SELECT * FROM items WHERE code = ?').get(item_code);
    if (!item) return res.status(404).json({ error: 'Item not found' });
    const hire = findOpenHire(item.id);
    if (!hire) return res.status(409).json({ error: `${item.name} is not out on hire` });

    const now = new Date();
    const late = minutesLate(hire.due_at, now.getTime());
    const lateFee = late * item.late_fee_per_minute;

    db.prepare(`
      UPDATE hires SET checked_in_at = ?, minutes_late = ?, late_fee = ?, in_station_id = ? WHERE id = ?
    `).run(now.toISOString(), late, lateFee, station_id || null, hire.id);

    if (lateFee > 0) {
      db.prepare(`
        INSERT INTO transactions (team_id, type, amount, station_id, note, related_item_id, related_hire_id)
        VALUES (?, 'late_fee', ?, ?, ?, ?, ?)
      `).run(hire.team_id, -lateFee, station_id || null, `Late return: ${item.name} (${late} min late)`, item.id, hire.id);
      // Late fees are charged even if they push the balance below zero.
      db.prepare('UPDATE teams SET balance = balance - ? WHERE id = ?').run(lateFee, hire.team_id);
      broadcastState(io);
    }

    const updatedTeam = db.prepare('SELECT * FROM teams WHERE id = ?').get(hire.team_id);
    const updatedHire = db.prepare('SELECT * FROM hires WHERE id = ?').get(hire.id);
    broadcastHires(io);
    io.emit('feed_event', {
      type: 'return',
      team: updatedTeam,
      item,
      hire: updatedHire,
      amount: -lateFee,
      timestamp: updatedHire.checked_in_at,
    });

    res.json({ team: updatedTeam, item, hire: updatedHire, minutes_late: late, late_fee: lateFee });
  });

  return router;
};

module.exports.openHires = openHires;
