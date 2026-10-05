// Turns chits.json ({ level: count }) into one row per printed chit, e.g.
// { code: 'CHIT-E-001', award_level: 'excellent' }.
const LETTER = { excellent: 'E', standard: 'S', poor: 'P' };

module.exports = function expandChits(counts) {
  const chits = [];
  for (const [level, count] of Object.entries(counts)) {
    if (!LETTER[level]) throw new Error(`Unknown chit level "${level}" in chits.json`);
    for (let n = 1; n <= count; n++) {
      chits.push({ code: `CHIT-${LETTER[level]}-${String(n).padStart(3, '0')}`, award_level: level });
    }
  }
  return chits;
};
