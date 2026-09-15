# Digital Trading Game

Digitised banking, leaderboard, and anti-cheat system for the Scout Trading Game. See
`trading-game-digital-brief.md` for the original brief this was built from.

## Quick start (development)

```bash
npm install
npm run seed     # loads server/seed/teams.json and activities.json into SQLite
npm start        # http://localhost:3000
```

Then open:
- `http://localhost:3000/banking` — banking station (scan team, scan activity, award)
- `http://localhost:3000/leaderboard` — full-screen live leaderboard
- `http://localhost:3000/leader` — leader dashboard (live feed, undo, manual adjustment)

No physical barcode scanner is needed for development — a scanner just emulates
keyboard input, so typing a code into the scan box and pressing Enter works the same
way.

## Requires

Node.js **22.5+** (uses the built-in `node:sqlite` module — no native build tools
needed, which also makes Raspberry Pi deployment simpler; see `docs/raspberry-pi-setup.md`).

## Project layout

- `server/` — Express + Socket.io API and SQLite data layer. `server/seed/*.json` is
  the editable team/activity catalogue — re-run `npm run seed` after changing it.
- `public/` — the three browser-based front ends (banking, leaderboard, leader),
  plain HTML/CSS/JS, no build step.
- `tools/card-generator/` — `npm run cards` generates a printable HTML sheet of QR
  codes for team and activity cards.
- `docs/` — Raspberry Pi deployment guide and the day-of run book.

## Data model

Six tables' worth of business logic in one paragraph: `teams` hold a running
`balance`; `activities` is the catalogue (one row per activity, with poor/standard/
excellent/not-met values); `completions` records one row per team+activity with a
database-level uniqueness constraint — this is what makes "no repeat activities"
unbypassable, even by a bug in the UI; `transactions` is the full ledger (completions,
manual adjustments, and undos), never edited or deleted, so there's always an audit
trail of exactly what happened and when.
