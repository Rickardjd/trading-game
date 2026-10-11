# Digital Trading Game

Digitised banking, leaderboard, and anti-cheat system for the Scout Trading Game. See
`trading-game-digital-brief.md` for the original brief this was built from.

## Quick start (development)

```bash
npm install
npm run seed     # loads teams (with starting funds), activities, shop items and chits into SQLite
npm start        # http://localhost:3000
```

Then open:
- `http://localhost:3000/banking` — banking station (scan team, then an activity to
  award, a shop item to sell, or a tool to hire out; scan a tool on its own to check it
  back in)
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
  the editable team/activity/shop catalogue — re-run `npm run seed` after changing it.
  `items.json` holds in-game prices: `buy` items are sold outright; `hire` items have a
  flat `price` for `hire_minutes`, a `late_fee_per_minute`, and a `quantity` of
  physical units (each gets its own code, e.g. `H-SCISSORS-1`).
- `public/` — the three browser-based front ends (banking, leaderboard, leader),
  plain HTML/CSS/JS, no build step.
- `tools/card-generator/` — `npm run cards` generates a printable HTML sheet of QR
  codes for team, activity and shop cards, plus small labels for each hire tool.
  `npm run labels` makes the shop, tool and chit labels for a DYMO LabelWriter 450
  instead (99014 labels, one per page, printed on the top half to fold over string).
- `docs/` — Raspberry Pi deployment guide, scanner equipment guide, and the day-of run
  book.
  `chits.json` sets how many single-use grade chits of each level to print (codes like
  `CHIT-E-007`); assessors hand them out and the bank scans one to set the award level.

## Data model

Six tables' worth of business logic in one paragraph: `teams` hold a running
`balance`; `activities` is the catalogue (one row per activity, with poor/standard/
excellent/not-met values); `completions` records one row per team+activity with a
database-level uniqueness constraint — this is what makes "no repeat activities"
unbypassable, even by a bug in the UI; `items` is the shop/hire price list; `hires`
records each tool check-out and check-in, with a partial unique index so a tool can
only be out to one team at a time; `transactions` is the full ledger (completions,
manual adjustments, purchases, hire fees, late fees, and undos), never edited or
deleted, so there's always an audit trail of exactly what happened and when. The
leaderboard ranks teams by current balance, so spending counts against them.
