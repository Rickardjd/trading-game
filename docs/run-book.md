# Day-of run book

## Before the event

1. Team names can either be set in `server/seed/teams.json` ahead of time, or left as
   placeholders (Red Team, Blue Team, ...) and renamed on the day from the leader
   dashboard — see "Setting team names on the day" below. Colours are only set in
   the JSON file, so change those there if you want non-default colours.
   - `starting_funds` is the money each team has in the bank at the start (default
     £200), so teams can buy and hire straight away. Give teams different amounts if
     you want unequal starting wealth. It's paid in once, when `npm run seed` first
     creates the team, and shows in the leader feed as "starting funds". Re-seeding
     won't pay it again; to change it after seeding, delete the database (step 6) and
     re-seed, or use a manual adjustment.
   - Starting **supplies** (paper, cord, etc.) aren't tracked by the system — decide
     what goes in each team's bag and pack them by hand.
2. Check `server/seed/activities.json` matches what you're actually running on the day
   (edit values/descriptions if anything changed since planning).
3. Check `server/seed/items.json` — the in-game shop prices, hire fees, hire lengths,
   late fees, and how many of each tool you actually have (`quantity`).
4. Run `npm run seed` on the server to load that data.
5. Run `npm run cards` to (re)generate `tools/card-generator/output/cards.html`, then
   open it in a browser, print, cut out, and laminate:
   - One team card per team (put it in the team's folder/envelope).
   - One activity card per activity (place it at that activity's station).
   - The shop cards, kept at the shop stall.
   - The tool labels — stick each one on its matching tool (Scissors #1, #2, ...).
   - The grade chits (green Excellent, blue Standard, orange Poor) — print with
     "Background graphics" on so the colours show. How many of each is set in
     `server/seed/chits.json`; re-run `npm run seed` and `npm run cards` after changing it.
   - **Using a DYMO LabelWriter 450 instead?** Run `npm run labels`. It writes
     `dymo-shop-and-tools.html` and `dymo-chits.html` to the same output folder: one
     label per page, sized for **99014 (54 × 101 mm)**, printed on the top half so you
     can fold the label over a piece of string (small marks show the fold). Open the file
     in Chrome or Edge → Print → printer **DYMO LabelWriter 450**, paper size **99014
     Shipping**, margins **None**, scale **100%**, headers/footers off. The DYMO is
     black-only, so chits show the grade as stars + a word (Excellent is white-on-black)
     — stick them onto matching coloured card if you want the colours too.
6. Delete `data/trading-game.sqlite` if you want a completely fresh start (balances
   back to zero, no completions) — the next server start recreates it empty, then
   `npm run seed` repopulates teams/activities. To just replay with the same setup,
   use "Reset game" on the leader dashboard instead (see below).

## Setting up on the day

1. Power on the Pi (or laptop) running the server; confirm it's running
   (`sudo systemctl status trading-game` on a Pi, or `npm start` on a laptop).
2. Connect banking laptops and the leaderboard laptop to the same network as the
   server (the Pi's own Wi-Fi AP, a travel router, or venue Wi-Fi — whatever you're
   using).
3. On each banking laptop, open `http://<server-ip>:3000/banking`, plug in the USB
   barcode scanner, and click into the scan box once so it has focus.
   - You'll be prompted to name the station (e.g. "Station A") — this is stored in
     that browser only and tags every transaction from that laptop for the audit
     trail.
4. On the projector laptop, open `http://<server-ip>:3000/leaderboard` full-screen
   (F11 in most browsers).
   - The leaderboard has sound effects: a trumpet fanfare when a team moves into first
     place, a coin "ching" when a team earns money, and a horn call at time's up.
     Browsers won't play sound until the page has been clicked, so **click once
     anywhere on the leaderboard** after opening it — the red "Sound off" button in the
     bottom-right corner fades to "Sound on". Click that button to mute/unmute. Plug
     the laptop into speakers and check its volume.
5. Optionally, open `http://<server-ip>:3000/leader` on a leader's own laptop/tablet
   for the live activity feed, manual adjustments, undo, and the game setup controls
   (which teams are playing, stop game, reset game).

## Choosing which teams are playing

If fewer than six teams turn up, untick the spare ones under "Game setup → Teams
playing" on the leader dashboard. A team that isn't playing disappears from the
leaderboard and the standings, and its card is refused at the banking stations. Tick
it again to bring it back — its balance and history are untouched. The setting is kept
through a game reset.

## Stopping and resetting the game

Both are on the leader dashboard only:

- **Stop game** (next to the timer, once it's been started) ends the game early: the
  clock drops to zero and every screen shows "Time's up". Like the clock running out
  naturally, it doesn't lock the banking stations.
- **Reset game** (under "Game setup") starts over for a new game: every team goes back
  to its `starting_funds` from `server/seed/teams.json`, and all completions,
  purchases, hires, cashed-in chits and the timer are cleared. Team names and which
  teams are playing are kept. You have to type RESET to confirm. The server saves a
  copy of the database to `data/backups/` first, in case it was done by mistake.

## Setting team names on the day

If you didn't set real team names in `teams.json` beforehand, do it now, before
trading starts:

1. On the leader dashboard, find the team under "Game setup → Teams playing".
2. Click "Rename" next to it, type the real name, and confirm.
3. The new name appears on the leaderboard and banking stations immediately.

Renaming is only on the leader dashboard — banking stations can't change team names.

Names are capped at 24 characters so they stay readable on the leaderboard — longer
names shrink to fit automatically, but very long ones will still be trimmed with "…".
Renaming works at any point in the game, not just at the start, so it also doubles as
a quick way to fix a typo later.

## Starting the game timer

The leaderboard shows a big countdown once it's been started:

1. On any banking station or the leader dashboard, enter the number of minutes in the
   "Minutes" box next to the timer readout, and click "Set & start". Doing it again
   restarts the countdown from full.
2. The countdown appears immediately on the leaderboard, the banking station, and the
   leader dashboard, all kept in sync from the server.
3. If leaders need to pause for any reason, click "Pause" (on any banking station) or
   "Pause game" (on the leader dashboard) — the countdown freezes at its current value
   everywhere, and "Resume" picks up exactly where it left off.
4. "Reset" (banking station only) clears the timer back to not-started, e.g. to correct
   a wrong duration before trading actually begins.
5. When time runs out, the leaderboard flashes red with "TIME'S UP" — no auto-lockout
   of banking stations happens, so leaders still decide when to actually stop taking
   completions.

## Shop and tool hire

Any banking station can act as the shop or hire stall:

- **Selling:** scan the team card, then the item's shop card. Set the quantity and
  click "Charge". Teams can't spend more than their balance — if they try to buy or
  hire something they can't afford, the banking screen flashes red and nothing is
  charged.
- **Next team:** when you've finished with a team, just scan the next team's card —
  there's no need to click "Done with this team" first. Anything still on screen
  that hadn't been confirmed (an award, a charge, a check-out) is dropped, and the
  station says so.
- **Hiring out:** scan the team card, then the tool's label. The screen shows the flat
  hire fee, how long they have it, and the late fee per minute; click "Check out".
  A tool that's already out can't be hired to anyone else until it's checked in.
- **Checking in:** scan the tool's label on its own (no team card needed). The screen
  shows who hired it and whether it's late; click "Check in". Any late fee — the
  per-minute rate for every started minute over — is charged to the team that hired
  it, even if another team hands it back, and even if it takes them below £0.
- The leader dashboard's "Tools on hire" table shows every tool that's out, with a
  live countdown, overdue tools in red with their fee so far, and a "Check in" button
  for tools handed straight to a leader.
- Hire clocks keep running while the game timer is paused, and when time's up — check
  in anything still out at the end so late fees are applied before reading the final
  leaderboard.
- "Undo last transaction" covers these too: undoing a sale refunds it, undoing a hire
  refunds the fee and puts the tool back as available, and undoing a late fee waives
  it (the tool stays checked in). An on-time check-in has no charge, so there's nothing
  to undo — if a tool was checked in by mistake, just hire it out again.

## Grade chits (assessing activities)

Assessors judge the product at their activity base, then hand the team **one grade
chit** in the matching colour — Excellent, Standard or Poor. A "Not met" gets no chit;
just tell the team they can try again. The team takes the chit straight to the bank.

At the bank: scan the team card, then the activity card, then the chit. The award is
made at the chit's level automatically, and **the banker keeps the chit** (drop it in a
box). Each chit can only ever be cashed in once — scanning a used one is refused and
shows who cashed it in, which is worth raising with a leader.

- If the banker scanned the wrong activity, "Undo last transaction" also makes the chit
  valid again, so just redo it with the right activity card.
- The Poor / Standard / Excellent / Not met buttons still work, for a lost chit or a
  leader's call — but by default, no chit means no money.
- The leader feed notes which chit paid for each award (e.g. "chit CHIT-E-007").

### What happens to the finished product

A passed product is **sold to the market**: the assessor keeps it when handing over the
chit. This stops a team passing a finished item to another team to show again, and
means teams have to buy fresh materials for every activity. Tell teams this up front
(it's on the how-to-play sheet) so nobody argues they "own" their rope.

- **Paper shapes** — the assessor keeps them.
- **Knots and lashings** — the assessor keeps the cord. Leaders can quietly return it
  to the shop's stock to sell again.
- **Big builds** (shelter, bridge, spaghetti tower) — take a photo if you want a
  record, then dismantle it; the materials go back to the shop, not the team.
- **Skills with no product** (Morse, semaphore, compass bearing, first aid) — nothing
  to collect; any bought item used goes back to the shop.
- **Not met** — the team keeps their materials and can try again.
- **Hired tools are never collected** — they always go back to the bank to be checked in.

## During the game

- Duplicate attempts at an activity are rejected automatically and clearly — this is
  enforced by the server, not the banking station, so it can't be bypassed by using a
  different station.
- If an operator makes a mistake (wrong award level, wrong activity), use "Undo last
  transaction" **immediately** — it only reverses the single most recent transaction
  across the whole system, so acting fast matters if multiple stations are active.
- The leader dashboard's live feed shows every completion, adjustment, and undo as it
  happens, from every station — useful for spotting anything that looks like cheating
  in real time rather than after the fact.

## If something breaks mid-event

- Server crashed: systemd restarts it automatically (see `raspberry-pi-setup.md`); on
  a laptop, just re-run `npm start`. No data is lost — everything is in the SQLite
  file.
- A banking laptop loses Wi-Fi: reconnect it: the page will start working again on the
  next scan (no local state to resync, since every action is a fresh request to the
  server).
- Need to correct a balance after the fact (not just "undo the last thing"): use the
  leader dashboard's manual adjustment form, with a clear note of why.
