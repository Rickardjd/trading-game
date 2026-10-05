const path = require('node:path');
const fs = require('node:fs');
const QRCode = require('qrcode');

const teams = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'server', 'seed', 'teams.json'), 'utf8'));
const activities = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'server', 'seed', 'activities.json'), 'utf8'));
const expandItems = require('../../server/seed/expand-items');
const items = expandItems(JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'server', 'seed', 'items.json'), 'utf8')));
const shopItems = items.filter((i) => i.type === 'buy');
const hireItems = items.filter((i) => i.type === 'hire');
const expandChits = require('../../server/seed/expand-chits');
const chits = expandChits(JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'server', 'seed', 'chits.json'), 'utf8')));

// Same colours as the banking station's award buttons.
const CHIT_STYLE = {
  excellent: { label: 'EXCELLENT', colour: '#2fa84f' },
  standard: { label: 'STANDARD', colour: '#3c8ce0' },
  poor: { label: 'POOR', colour: '#e07a2d' },
};

async function qr(code) {
  return QRCode.toDataURL(code, { margin: 1, width: 260 });
}

function cardHtml(qrDataUrl, code, title, colour) {
  return `
    <div class="card" style="${colour ? `border-color:${colour}` : ''}">
      <img src="${qrDataUrl}" alt="QR for ${code}" />
      <div class="card-code">${code}</div>
      <div class="card-title">${title}</div>
      ${colour ? `<div class="card-swatch" style="background:${colour}"></div>` : ''}
    </div>`;
}

async function main() {
  const teamCards = [];
  for (const t of teams) {
    teamCards.push(cardHtml(await qr(t.code), t.code, t.name, t.colour));
  }

  const activityCards = [];
  for (const a of activities) {
    activityCards.push(cardHtml(await qr(a.code), a.code, a.name, null));
  }

  const shopCards = [];
  for (const i of shopItems) {
    shopCards.push(cardHtml(await qr(i.code), i.code, `${i.name} — £${i.price}`, null));
  }

  const hireCards = [];
  for (const i of hireItems) {
    hireCards.push(cardHtml(await qr(i.code), i.code, i.name, null).replace('class="card"', 'class="card tool-label"'));
  }

  const chitCards = [];
  for (const c of chits) {
    const { label, colour } = CHIT_STYLE[c.award_level];
    chitCards.push(`
    <div class="card chit" style="background:${colour}">
      <div class="chit-level">${label}</div>
      <img src="${await qr(c.code)}" alt="QR for ${c.code}" />
      <div class="card-code">${c.code}</div>
      <div class="chit-note">Take straight to the bank</div>
    </div>`);
  }

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Trading Game — Printable Cards</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: system-ui, sans-serif; margin: 0; padding: 20px; }
  h1 { font-size: 1.4rem; margin: 0 0 6px; }
  p.hint { color: #555; margin: 0 0 20px; }
  .sheet { display: flex; flex-wrap: wrap; gap: 14px; margin-bottom: 40px; }
  .card {
    width: 220px;
    border: 3px solid #333;
    border-radius: 12px;
    padding: 14px;
    text-align: center;
    page-break-inside: avoid;
  }
  .card img { width: 100%; height: auto; }
  .card-code { font-weight: 800; font-size: 1.1rem; margin-top: 8px; }
  .card-title { font-size: 0.95rem; color: #444; }
  .card-swatch { width: 100%; height: 10px; border-radius: 4px; margin-top: 8px; }
  .card.tool-label { width: 130px; padding: 8px; border-width: 2px; }
  .card.tool-label .card-code { font-size: 0.8rem; }
  .card.tool-label .card-title { font-size: 0.8rem; }
  .card.chit {
    width: 150px;
    padding: 8px;
    border: none;
    color: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .card.chit img { background: #fff; padding: 4px; border-radius: 6px; }
  .chit-level { font-weight: 900; font-size: 1.05rem; letter-spacing: 0.04em; margin-bottom: 6px; }
  .card.chit .card-code { font-size: 0.8rem; margin-top: 4px; }
  .chit-note { font-size: 0.7rem; }
  @media print {
    p.hint, .no-print { display: none; }
    .card:not(.chit) { border-color: #000 !important; }
  }
</style>
</head>
<body>
  <p class="no-print hint">Print this page (or export to PDF), cut out, and laminate. Team cards have a colour bar; activity cards do not.</p>

  <h1>Team cards (${teams.length})</h1>
  <div class="sheet">${teamCards.join('\n')}</div>

  <h1>Activity cards (${activities.length})</h1>
  <div class="sheet">${activityCards.join('\n')}</div>

  <h1>Shop cards (${shopItems.length})</h1>
  <p class="hint">One per item, kept at the shop stall — scan it after the team card to sell.</p>
  <div class="sheet">${shopCards.join('\n')}</div>

  <h1>Tool labels (${hireItems.length})</h1>
  <p class="hint">Stick one on each physical tool — scan it after the team card to hire it out, or on its own to check it back in.</p>
  <div class="sheet">${hireCards.join('\n')}</div>

  <h1>Grade chits (${chits.length})</h1>
  <p class="hint">Split by colour between the assessors. Each one can only be cashed in once — the bank keeps it after scanning. Print with "Background graphics" turned on so the colours come out.</p>
  <div class="sheet">${chitCards.join('\n')}</div>
</body>
</html>`;

  const outDir = path.join(__dirname, 'output');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'cards.html');
  fs.writeFileSync(outPath, html);
  console.log(`Wrote ${teams.length} team, ${activities.length} activity, ${shopItems.length} shop and ${hireItems.length} tool cards and ${chits.length} grade chits to ${outPath}`);
}

main();
