const path = require('node:path');
const fs = require('node:fs');
const db = require('../db');

const teams = JSON.parse(fs.readFileSync(path.join(__dirname, 'teams.json'), 'utf8'));
const activities = JSON.parse(fs.readFileSync(path.join(__dirname, 'activities.json'), 'utf8'));

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

for (const t of teams) {
  insertTeam.run(t.code, t.name, t.colour, t.balance ?? 0);
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

console.log(`Seeded ${teams.length} teams and ${activities.length} activities.`);
