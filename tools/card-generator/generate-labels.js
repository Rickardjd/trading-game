// Labels for a DYMO LabelWriter 450 on 99014 shipping labels (54 × 101 mm), one label per
// page. Everything is printed on the top half so the label can be folded over a piece of
// string (sticky sides together) to make a tag. The printer is black-only, so chits show
// their grade as a word plus stars rather than relying on colour.
const path = require('node:path');
const fs = require('node:fs');
const QRCode = require('qrcode');

const seed = (file) => JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'server', 'seed', file), 'utf8'));
const expandItems = require('../../server/seed/expand-items');
const expandChits = require('../../server/seed/expand-chits');

const items = expandItems(seed('items.json'));
const shopItems = items.filter((i) => i.type === 'buy');
const hireItems = items.filter((i) => i.type === 'hire');
const chits = expandChits(seed('chits.json'));

const CHIT_STYLE = {
  excellent: { label: 'EXCELLENT', stars: '★★★' },
  standard: { label: 'STANDARD', stars: '★★' },
  poor: { label: 'POOR', stars: '★' },
};

const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// SVG keeps the QR code sharp at the printer's 300 dpi.
const qr = (code) => QRCode.toString(code, { type: 'svg', margin: 0, errorCorrectionLevel: 'M' });

async function label({ code, top, title, sub, invert }) {
  return `
  <section class="label">
    <div class="face${invert ? ' invert' : ''}">
      ${top ? `<div class="top">${top}</div>` : ''}
      <div class="qr">${await qr(code)}</div>
      <div class="code">${escapeHtml(code)}</div>
      ${title ? `<div class="title">${escapeHtml(title)}</div>` : ''}
      ${sub ? `<div class="sub">${escapeHtml(sub)}</div>` : ''}
    </div>
    <div class="fold"></div>
  </section>`;
}

function page(title, labels) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
  @page { size: 54mm 101mm; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; color: #000; }
  .label { width: 54mm; height: 101mm; position: relative; overflow: hidden; page-break-after: always; break-after: page; }
  .label:last-child { page-break-after: auto; break-after: auto; }
  /* Printed half: top 50.5 mm. 3 mm side margin keeps clear of the label edges. */
  .face { position: absolute; top: 2mm; left: 3mm; right: 3mm; height: 47.5mm;
          display: flex; flex-direction: column; align-items: center; justify-content: flex-start; text-align: center; }
  .face > * { flex-shrink: 0; }
  .top { font-weight: 900; font-size: 11pt; letter-spacing: 0.04em; line-height: 1.1; margin-bottom: 1.2mm; }
  .face.invert .top { background: #000; color: #fff; width: 100%; padding: 0.6mm 0; border-radius: 1mm; }
  .qr { width: 27mm; height: 27mm; }
  .qr svg { width: 100%; height: 100%; display: block; }
  .code { font-weight: 800; font-size: 9.5pt; margin-top: 1.2mm; }
  .title { font-size: 8.5pt; line-height: 1.25; margin-top: 0.6mm; max-height: 2.5em; overflow: hidden; }
  .sub { font-size: 7pt; line-height: 1.15; margin-top: 0.5mm; }
  /* Fold marks at the halfway point, on both edges only, so they don't print across the tag. */
  .fold::before, .fold::after { content: ''; position: absolute; top: 50.5mm; width: 3mm; border-top: 0.3mm solid #000; }
  .fold::before { left: 0; }
  .fold::after { right: 0; }
  @media screen {
    body { background: #ddd; padding: 10px; display: flex; flex-wrap: wrap; gap: 10px; }
    .label { background: #fff; box-shadow: 0 1px 4px rgba(0,0,0,.3); }
  }
</style>
</head>
<body>${labels.join('\n')}
</body>
</html>`;
}

async function main() {
  const shopLabels = [];
  for (const i of shopItems) {
    shopLabels.push(await label({ code: i.code, top: 'SHOP', title: i.name, sub: `£${i.price}` }));
  }
  for (const i of hireItems) {
    shopLabels.push(await label({
      code: i.code,
      top: 'HIRE',
      title: i.name,
      sub: `£${i.price} for ${i.hire_minutes} min · late £${i.late_fee_per_minute}/min`,
    }));
  }

  const chitLabels = [];
  for (const c of chits) {
    const { label: word, stars } = CHIT_STYLE[c.award_level];
    chitLabels.push(await label({
      code: c.code,
      top: `${stars} ${word}`,
      sub: 'Take straight to the bank',
      invert: c.award_level === 'excellent',
    }));
  }

  const outDir = path.join(__dirname, 'output');
  fs.mkdirSync(outDir, { recursive: true });
  const files = [
    ['dymo-shop-and-tools.html', 'DYMO labels – shop and tools', shopLabels],
    ['dymo-chits.html', 'DYMO labels – grade chits', chitLabels],
  ];
  for (const [name, title, labels] of files) {
    fs.writeFileSync(path.join(outDir, name), page(title, labels));
    console.log(`Wrote ${labels.length} labels to ${path.join(outDir, name)}`);
  }
}

main();
