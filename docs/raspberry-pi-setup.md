# Running the server on a Raspberry Pi

The Pi's job is to run the Node.js server (which serves the banking/leaderboard/leader
pages and stores the SQLite database) and, ideally, to provide its own Wi-Fi network so
the game works with no venue internet at all.

## Before you start: SD card and OS

The game itself is tiny — the project including `node_modules` is under 30 MB, and the
database stays at a few MB even after a full day's play. Almost all the space goes on
the operating system:

| | Space used |
|---|---|
| Raspberry Pi OS Lite (no desktop) | ~2–3 GB |
| Raspberry Pi OS with desktop | ~5–8 GB |
| Node.js 22 | ~200 MB |
| Trading game + database | under 50 MB |

- **Size: 32 GB recommended.** 16 GB works, especially with OS Lite, but 32 GB costs
  about the same and leaves room for updates and logs.
- **Buy a branded card** (SanDisk, Samsung, Kingston) from a reputable seller — fake or
  no-name cards are the most common cause of Pi failures.
- **Look for an "A1" or "A2" rating.** These handle the small, frequent reads and
  writes a database makes far better than cards aimed at cameras.
- **Use Raspberry Pi OS Lite.** The Pi only runs the server — everyone uses the game
  through their own browsers — so it doesn't need a desktop. Lite boots faster and has
  less to go wrong.
- **Make a spare.** Once the Pi is fully set up, clone the card to a second one with
  Raspberry Pi Imager or Win32 Disk Imager. If a card fails on the day, swap in the
  spare and you're back running in a minute. Note the spare only has the game as it
  was when you cloned it — balances recorded since then are on the failed card's
  `data/trading-game.sqlite`, so copy that file across if the card can still be read.

## 1. Install Node.js

The server uses the built-in `node:sqlite` module, which needs **Node 22.5 or newer** —
no native build tools or `npm install` compilation step required (unlike
`better-sqlite3`), which matters on a Pi where compiling native modules can be slow or
fail depending on the OS image.

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v   # confirm >= 22.5
```

## 2. Get the project from GitHub and install dependencies

The code lives in a **private** GitHub repo (`Rickardjd/trading-game`), so the Pi needs
permission to read it. A *deploy key* does that: an SSH key that can read this one repo
and nothing else (and can't push). Do this once, with the Pi on a network with internet.

```bash
sudo apt-get install -y git

# 1. Make a key for the Pi (press Enter if asked anything)
ssh-keygen -t ed25519 -C "trading-game-pi" -f ~/.ssh/id_ed25519 -N ""
cat ~/.ssh/id_ed25519.pub
```

2. Copy the line that `cat` printed (starts `ssh-ed25519`). On GitHub, go to
   **github.com/Rickardjd/trading-game → Settings → Deploy keys → Add deploy key**,
   paste it in, title it "Raspberry Pi", leave **Allow write access unticked**, and save.

```bash
# 3. Check the Pi can reach GitHub (type "yes" to trust GitHub the first time;
#    "successfully authenticated" is the good result, even though it says no shell access)
ssh -T git@github.com

# 4. Download the project and set it up
git clone git@github.com:Rickardjd/trading-game.git ~/trading-game
cd ~/trading-game
npm install
npm run seed
```

### Updating the Pi after making changes

On the PC, commit and push as normal. Then on the Pi:

```bash
cd ~/trading-game
git pull
npm install                          # only does anything if dependencies changed
npm run seed                         # only if you changed teams/activities/items/chits
sudo systemctl restart trading-game  # once the service in step 3 is set up
```

Re-seeding never resets balances, completions or the ledger — to start a game
completely fresh, see "Before the event" step 6 in `run-book.md`. Update before the
event rather than during it: restarting the server is quick, but there's no reason to
risk it mid-game.

Re-run `npm run seed` any time you edit `server/seed/teams.json` or
`server/seed/activities.json` (e.g. to put in real team names before the event) — it's
safe to re-run, existing rows are updated in place by code, not duplicated.

## 3. Run the server on boot (systemd)

Create `/etc/systemd/system/trading-game.service` (e.g. `sudo nano
/etc/systemd/system/trading-game.service`). Newer Raspberry Pi OS images don't have a
`pi` user by default — you pick the username in Raspberry Pi Imager — so replace both
`pi`s below with your username (run `whoami` if unsure). `User=` matters: without it
the server runs as root, the database file ends up owned by root, and `npm run seed`
then fails with a permissions error.

```ini
[Unit]
Description=Trading Game server
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/trading-game
ExecStart=/usr/bin/node server/index.js
Restart=on-failure
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
```

Then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now trading-game
sudo systemctl status trading-game
```

The server is now at `http://<pi-ip>:3000/banking`, `/leaderboard`, `/leader` and
restarts automatically if it crashes or the Pi reboots mid-event.

## 4. Standalone Wi-Fi access point (optional but recommended)

If you can't rely on venue Wi-Fi, have the Pi host its own network using `hostapd` +
`dnsmasq`. This is the standard "Raspberry Pi as access point" setup — follow the
official Raspberry Pi documentation for your OS version, since exact steps vary by
release:

- https://www.raspberrypi.com/documentation/computers/configuration.html#setting-up-a-routed-wireless-access-point

Key points for this project specifically:
- Give the Pi a fixed IP on its own AP (e.g. `192.168.4.1`), so banking laptops connect
  to `http://192.168.4.1:3000/banking` reliably.
- A cheap travel router in "AP mode" is a simpler alternative if you'd rather not
  configure `hostapd` — plug the Pi into it via Ethernet, and have laptops join the
  router's Wi-Fi instead.

## 5. Day-of checklist

See `run-book.md` for the full startup sequence.
