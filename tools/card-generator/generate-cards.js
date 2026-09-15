const path = require('node:path');
const fs = require('node:fs');
const QRCode = require('qrcode');

const teams = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'server', 'seed', 'teams.json'), 'utf8'));
const activities = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'server', 'seed', 'activities.json'), 'utf8'));

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
  @media print {
    p.hint, .no-print { display: none; }
    .card { border-color: #000 !important; }
  }
</style>
</head>
<body>
  <p class="no-print hint">Print this page (or export to PDF), cut out, and laminate. Team cards have a colour bar; activity cards do not.</p>

  <h1>Team cards (${teams.length})</h1>
  <div class="sheet">${teamCards.join('\n')}</div>

  <h1>Activity cards (${activities.length})</h1>
  <div class="sheet">${activityCards.join('\n')}</div>
</body>
</html>`;

  const outDir = path.join(__dirname, 'output');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'cards.html');
  fs.writeFileSync(outPath, html);
  console.log(`Wrote ${teams.length} team cards and ${activities.length} activity cards to ${outPath}`);
}

main();
