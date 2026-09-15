# Running the server on a Raspberry Pi

The Pi's job is to run the Node.js server (which serves the banking/leaderboard/leader
pages and stores the SQLite database) and, ideally, to provide its own Wi-Fi network so
the game works with no venue internet at all.

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

## 2. Copy the project and install dependencies

```bash
git clone <your repo, or copy the folder over via USB/SCP>
cd trading-game
npm install
npm run seed
```

Re-run `npm run seed` any time you edit `server/seed/teams.json` or
`server/seed/activities.json` (e.g. to put in real team names before the event) — it's
safe to re-run, existing rows are updated in place by code, not duplicated.

## 3. Run the server on boot (systemd)

Create `/etc/systemd/system/trading-game.service`:

```ini
[Unit]
Description=Trading Game server
After=network.target

[Service]
Type=simple
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
