# Day-of run book

## Before the event

1. Team names can either be set in `server/seed/teams.json` ahead of time, or left as
   placeholders (Red Team, Blue Team, ...) and renamed on the day from the banking
   station itself — see "Setting team names on the day" below. Colours are only set in
   the JSON file, so change those there if you want non-default colours.
2. Check `server/seed/activities.json` matches what you're actually running on the day
   (edit values/descriptions if anything changed since planning).
3. Run `npm run seed` on the server to load that data.
4. Run `npm run cards` to (re)generate `tools/card-generator/output/cards.html`, then
   open it in a browser, print, cut out, and laminate:
   - One team card per team (put it in the team's folder/envelope).
   - One activity card per activity (place it at that activity's station).
5. Delete `data/trading-game.sqlite` if you want a completely fresh start (balances
   back to zero, no completions) — the next server start recreates it empty, then
   `npm run seed` repopulates teams/activities.

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
5. Optionally, open `http://<server-ip>:3000/leader` on a leader's own laptop/tablet
   for the live activity feed, manual adjustments, and undo.

## Setting team names on the day

If you didn't set real team names in `teams.json` beforehand, do it now, before
trading starts:

1. On any banking station, scan a team's card (or type its code) to bring up that
   team's panel.
2. Click "Rename team", type the real name, and confirm.
3. The new name appears on the leaderboard and leader dashboard immediately.

Names are capped at 24 characters so they stay readable on the leaderboard — longer
names shrink to fit automatically, but very long ones will still be trimmed with "…".
Renaming works at any point in the game, not just at the start, so it also doubles as
a quick way to fix a typo later.

## Starting the game timer

The leaderboard shows a big countdown once it's been started:

1. On any banking station, enter the number of minutes in the "Minutes" box next to
   the timer readout, and click "Set & start". This is the only place the timer is
   set — the leaderboard and leader dashboard only display and (for pause) control it.
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
