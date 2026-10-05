const path = require('node:path');
const fs = require('node:fs');
const db = require('../db');
const expandItems = require('./expand-items');
const expandChits = require('./expand-chits');

const teams = JSON.parse(fs.readFileSync(path.join(__dirname, 'teams.json'), 'utf8'));
const activities = JSON.parse(fs.readFileSync(path.join(__dirname, 'activities.json'), 'utf8'));
const items = expandItems(JSON.parse(fs.readFileSync(path.join(__dirname, 'items.json'), 'utf8')));
const chits = expandChits(JSON.parse(fs.readFileSync(path.join(__dirname, 'chits.json'), 'utf8')));

const insertTeam = db.prepare(`
  INSERT INTO teams (code, name, colour, balance) VALUES (?, ?, ?, ?)
  ON CONFLICT(code) DO UPDATE SET name = excluded.name, colour = excluded.colour
`);

const insertActivity = db.prepare(`
  INSERT INTO activities (code, name, category, materials_required, tools_required, description_of_outcome, poor_value, standard_value, excellent_value, not_met_value)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(code) DO UPDATE SET
    name = excluded.name,
    category = excluded.category,
    materials_required = excluded.materials_required,
    tools_required = excluded.tools_required,
    description_of_outcome = excluded.description_of_outcome,
    poor_value = excluded.poor_value,
    standard_value = excluded.standard_value,
    excellent_value = excluded.excellent_value,
    not_met_value = excluded.not_met_value
`);

const insertItem = db.prepare(`
  INSERT INTO items (code, name, type, price, hire_minutes, late_fee_per_minute)
  VALUES (?, ?, ?, ?, ?, ?)
  ON CONFLICT(code) DO UPDATE SET
    name = excluded.name,
    type = excluded.type,
    price = excluded.price,
    hire_minutes = excluded.hire_minutes,
    late_fee_per_minute = excluded.late_fee_per_minute
`);

// Starting funds are paid in as an 'opening' ledger entry, once per team: re-seeding
// never pays them twice, and undo can't reverse them.
const hasOpening = db.prepare("SELECT 1 FROM transactions WHERE team_id = ? AND type = 'opening'");
const insertOpening = db.prepare(`
  INSERT INTO transactions (team_id, type, amount, station_id, note) VALUES (?, 'opening', ?, 'seed', 'Starting funds')
`);
const addToBalance = db.prepare('UPDATE teams SET balance = balance + ? WHERE id = ?');

for (const t of teams) {
  insertTeam.run(t.code, t.name, t.colour, 0);
  const team = db.prepare('SELECT * FROM teams WHERE code = ?').get(t.code);
  const funds = Math.trunc(t.starting_funds ?? 0);
  if (funds > 0 && !hasOpening.get(team.id)) {
    insertOpening.run(team.id, funds);
    addToBalance.run(funds, team.id);
  }
}

for (const a of activities) {
  insertActivity.run(
    a.code,
    a.name,
    a.category ?? null,
    a.materials_required ?? null,
    a.tools_required ?? null,
    a.description_of_outcome,
    a.poor_value,
    a.standard_value,
    a.excellent_value,
    a.not_met_value ?? 0
  );
}

for (const i of items) {
  insertItem.run(
    i.code,
    i.name,
    i.type,
    i.price,
    i.type === 'hire' ? i.hire_minutes : null,
    i.type === 'hire' ? i.late_fee_per_minute : null
  );
}

// Re-seeding never un-redeems a chit that's already been cashed in.
const insertChit = db.prepare('INSERT OR IGNORE INTO chits (code, award_level) VALUES (?, ?)');
for (const c of chits) {
  insertChit.run(c.code, c.award_level);
}

console.log(`Seeded ${teams.length} teams, ${activities.length} activities, ${items.length} shop/hire items and ${chits.length} grade chits.`);
