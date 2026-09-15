# Scanner equipment

## What you actually need

**A wired USB "2D imager" barcode scanner, per banking station.** That's the whole
requirement — nothing else needs installing.

The important word is **2D**. The cards this project generates are QR codes, and cheap
"laser" barcode scanners (the classic red-line kind) can only read 1D barcodes — they
physically cannot decode a QR code. You specifically need a **2D imager** (sometimes
called a "CMOS imager" or "2D area scanner") — this is a small camera behind the lens
rather than a laser, and it's standard on any scanner advertised as reading QR codes,
Data Matrix, or PDF417 alongside normal barcodes. Almost all budget 2D scanners sold
today handle QR fine; just check "QR code" is listed among the supported symbologies
before buying.

## How it connects — nothing to configure

Every scanner worth buying for this operates as a **USB keyboard-wedge (HID) device**:
plug it into a USB port and it appears to the laptop as a second keyboard. There's no
driver to install and no software to run. When you point it at a code and pull the
trigger, it "types" the code's text into whatever field currently has focus, followed
by an Enter keystroke — which is exactly what the banking station's scan box is built
to receive (see `public/banking/app.js`). This is true on Windows, macOS, and Linux
identically, since it's just keyboard input as far as the OS is concerned.

Almost all scanners ship from the factory already configured to send an Enter/CR after
each scan. If yours doesn't (rare), the included quick-start sheet has a small
"configuration barcode" you scan once to turn that on — a one-time, per-scanner setup
step, not something this app needs to know about.

## What to buy

- **Type**: wired USB 2D imager, handheld (a "gun" style with a trigger, not a
  fixed-mount kiosk scanner).
- **Budget option**: generic 2D imagers from brands like NETUM, Eyoyo, Tera, or
  Inateck are commonly available for roughly **£15–£30** each on Amazon UK and are
  entirely adequate for a one-off event — this matches the estimate already in
  `trading-game-activity-catalogue.xlsx`'s cost sheet.
- **If you want a sturdier/warrantied unit**: UK B2B suppliers (e.g. ERS Online,
  HUB Auto ID) sell similar 2D imagers from around £49+, aimed at retail/industrial
  use — not necessary for this, but an option if you want something more durable for
  repeated future use.
- **Quantity**: one scanner per banking station. The brief's rule of thumb is roughly
  one station per 3–4 teams to keep queues short, so for 6 teams, 2 stations (2
  scanners) is a reasonable starting point — you can run the whole game on a single
  station and scanner if you'd rather keep it simple.
- A desk stand/cradle for hands-free scanning is a nice-to-have, not required — the
  operator can just point and click the trigger.

## Getting good results from the printed cards

- Print QR codes at a reasonable physical size — the card generator's default (roughly
  4–5cm square once printed on the card) is comfortably scannable; don't shrink cards
  down to save paper.
- **Use matte laminate, not gloss**, if you can choose — glossy lamination under bright
  hall lighting or direct sun can cause glare that budget imagers struggle with. Matte
  pouches avoid this.
- Keep the QR code flat and uncreased — a sharp fold across the code can break enough
  of the pattern that it won't scan.
- Test every scanner against a real printed, laminated card **before the event**, in
  lighting similar to where you'll actually run it — a hall's fluorescent lights or an
  outdoor field are both fine for 2D imagers, but it's worth confirming with your
  actual units and cards rather than assuming.

## Fallback if a scanner fails or isn't available

The banking station's scan box is a plain text input — nothing about it requires a
physical scanner. If a scanner dies mid-event, or you want to trial the system without
buying one yet, the operator can simply **type the code printed under the QR square**
(e.g. `TEAM01`, `M04`) and press Enter, with identical results. This is also how the
whole system was developed and tested (see the README's "Quick start" section) — a
scanner is a convenience for speed and to avoid typos, not a hard dependency.
