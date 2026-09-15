# Digital Trading Game — Technical Brief

## 1. Background

The Trading Game is a Scout activity where teams (representing "countries") manufacture and trade goods to earn money, deliberately starting with unequal resources. This brief covers digitising three parts of it:

1. **Banking** — barcode-scan based, replacing the paper ledger
2. **Leaderboard** — live, bright, colourful display
3. **Activity tracking** — stop teams repeating the same activity for repeat rewards, and generally prevent cheating

## 2. Core architecture decision

**Use one central server with multiple thin clients, not several independent computers.**

If each banking station kept its own local record, two stations could both let the same team "complete" an activity at the same moment, or a team could visit two stations to double-dip before either machine knew about the other. The only reliable way to enforce "one team, one activity, once" is a **single source of truth** that every station checks against in real time.

```
                    ┌─────────────────────────┐
                    │   Central Server         │
                    │   (laptop or Raspberry   │
                    │   Pi on local network)   │
                    │                          │
                    │  - SQLite database       │
                    │  - REST API              │
                    │  - WebSocket push        │
                    └───────────┬──────────────┘
                                │  Wi-Fi (local network,
                                │  no internet needed)
        ┌───────────┬───────────┼───────────┬───────────┐
        │           │           │           │           │
  ┌─────▼────┐┌─────▼────┐┌─────▼────┐┌─────▼─────────────┐
  │ Banking  ││ Banking  ││ Banking  ││ Leaderboard        │
  │ Station 1││ Station 2││ Station N││ Display (TV/       │
  │ + scanner││ + scanner││ + scanner││ projector)         │
  └──────────┘└──────────┘└──────────┘└────────────────────┘
```

- **Banking stations** are just a browser page on any laptop/tablet, with a USB (or Bluetooth) barcode scanner plugged in. Every action goes to the central server via the API — no local decision-making, no state to get out of sync.
- **Leaderboard display** is another browser page (on a laptop feeding a TV/projector) that listens on a WebSocket and updates instantly whenever any station records a transaction.
- Everything can run on a **local Wi-Fi network with no internet connection** — useful for halls or fields with poor signal. A phone hotspot, a cheap travel router, or a Raspberry Pi running its own access point all work.

**How many stations do you need?** As many as you like for queue management — it's a UI/throughput decision, not an architectural one, since they all just talk to the same server. As a rule of thumb, one station per 3–4 teams keeps queues short during busy trading periods. Given your Raspberry Pi experience already (solar tracker, people-counting projects), the server itself is a natural fit for a Pi — cheap, low-power, and can double as the Wi-Fi access point.

## 3. Barcode cards

- Each team gets one printed card with a unique barcode or QR code (e.g. encoding `TEAM01`).
- Standard USB barcode scanners act like a keyboard: scanning "types" the code into whatever text field has focus, followed by Enter. No special drivers needed — the banking station page just needs a text input listening for scans.
- Optionally, print a **second barcode per activity** (e.g. on a card at each activity table) so the operator scans team card + activity card in sequence, rather than picking the activity from a list — faster and less error-prone.

## 4. Data model (suggested)

| Table | Fields | Purpose |
|---|---|---|
| `teams` | id, name, colour, balance | One row per team |
| `activities` | id, **code**, name, description, materials_required, base_value | Master catalogue of activities — see Section 4a |
| `completions` | id, team_id, activity_id, **awarded_value**, examiner_notes, timestamp, station_id | One row per completed activity, with the actual amount awarded on the day. **Unique constraint on (team_id, activity_id)** — this is what stops repeats |
| `transactions` | id, team_id, type, amount, timestamp, station_id, note | Ledger of every balance change, for audit and undo |

Enforcing the "no repeats" rule as a database constraint (not just a UI check) means it can't be bypassed even by a fast-fingered operator or a bug in one station's page.

## 4a. Activity catalogue

Since scoring will vary by quality of work, `activities` becomes a proper catalogue rather than a simple lookup list:

- **Code** — short unique reference (e.g. `A01`, `B03`) that doubles as the printed barcode/QR on the activity table card.
- **Name** — short label shown on the banking screen.
- **Description of outcome** — the criteria an examiner checks against to judge whether (and how well) the activity was completed. Shown to the operator at the point of scanning, so they don't need to remember every activity's standard.
- **Materials required** — reference list for whoever preps the activity stations before the day; not needed by the banking station itself, but worth keeping in the same catalogue so it's a single source of truth when planning.
- **Base value** — the "par" amount for a job that meets the criteria straightforwardly.

At the banking station, when an activity is scanned:
1. The catalogue entry's description of outcome is displayed, so the examiner/leader can judge the work against it.
2. The leader picks an award level rather than a fixed number — e.g. **Poor / Standard / Excellent**, mapped to multipliers or fixed amounts either side of the base value (you can decide the exact scale — e.g. Standard = base value, Excellent = base value + a bonus, Poor = base value − a penalty, or even zero for not meeting the criteria at all).
3. The actual `awarded_value` is stored against that completion, so the ledger reflects what was actually given, not just the catalogue's base figure — and the audit trail shows both the standard rate and what was awarded on the day.

This also gives you a natural place to add free-text `examiner_notes` if a leader wants to record why they judged the work a particular way.

## 5. Banking station workflow

1. Team arrives with goods/card.
2. Operator scans the team card → station shows team name, colour, current balance.
3. Operator scans (or selects) the activity being recorded → catalogue's description of outcome is displayed for the examiner to judge against.
4. Server checks: has this team already completed this activity?
   - **No** → operator picks an award level (Poor / Standard / Excellent, or similar), the corresponding value is applied to the team's balance, and the completion + awarded amount are pushed to all stations and the leaderboard.
   - **Yes** → station shows a clear rejection ("Already completed — no reward"), nothing is recorded.
5. Optional: a manual "adjustment" function for the leader to correct mistakes, logged as its own transaction type so the audit trail stays honest.

## 6. Anti-cheating measures

- Server-side enforcement of the uniqueness rule (not client-side), as above.
- Every completion/transaction is timestamped and tagged with which station recorded it — gives you an audit trail if something looks off after the fact.
- Cards can be laminated and numbered; a lost/duplicated card is easy to spot if two scans of the "same" team happen at once.
- Consider a simple leader-only screen showing a live activity feed (who scanned what, when, where) so anything unusual is visible during play, not just after.

## 7. Leaderboard display

- Full-screen browser page on a TV or projector, connected via WebSocket for instant updates (no manual refresh).
- Bright, high-contrast, large text — needs to be readable from across a hall.
- Suggested visual treatment: horizontal bar-race style, one bar per team in their assigned colour, animated re-ordering as balances change, maybe a brief confetti/flash effect when a team takes the lead.
- Keep it simple to build first (colour bars + numbers), then layer in animation once the core banking flow works.

## 8. Suggested tech stack (for Claude Code)

- **Backend**: Node.js + Express, SQLite for storage (plenty for team/activity counts in this game), Socket.io for real-time push to stations and leaderboard.
- **Frontend**: plain HTML/CSS/JS for both the banking station and leaderboard pages — no build tooling needed, easy to run directly in a browser on any laptop/tablet.
- **Barcode input**: no special library needed — scanners emulate keyboard input, so a focused `<input>` field with an Enter-key handler is sufficient. QR/barcode generation for the printed cards can use any free online generator or a small library at print time.

## 9. Confirmed setup

- **Scale**: 24 Scouts in teams of 4 → **6 teams**. Small enough that SQLite and a single Pi/laptop server will handle this without any performance concerns — no need to over-engineer.
- **Leaderboard**: shows live running balance and standings at all times, updating instantly as banking transactions come in.
- **Undo function**: banking stations get an "undo last transaction" control, restricted to leaders (station access itself is the control — Scouts won't be operating the banking laptops). Each undo is logged as its own entry in the `transactions` table (not a deletion) so the audit trail always shows what happened and what was reversed.
- **Hardware**:
  - **Server**: a Raspberry Pi is a good fit here — it can sit out of the way for the whole session, and doesn't need to be a device anyone is otherwise using. Either Pi can run the Node.js server + SQLite database.
  - **Banking stations**: laptops (mix of Linux and Windows is fine — everything here runs in a browser, so the OS doesn't matter) with a USB barcode scanner attached to each.
  - **Leaderboard**: fed to the projector as the main tracking screen, since screens are your scarcest resource. Run the leaderboard page full-screen from whichever laptop drives the projector.
  - **Network**: since you have laptops and Pis rather than a guaranteed venue Wi-Fi, plan for the Pi to run its own local Wi-Fi access point (or use a travel router) so the whole game works offline, independent of hall connectivity.
