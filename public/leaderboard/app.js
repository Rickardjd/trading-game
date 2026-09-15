(() => {
  const barsEl = document.getElementById('bars');
  const flashEl = document.getElementById('flash');
  const rowEls = new Map(); // team.id -> { row, fill, value }
  let previousLeaderId = null;

  const ROW_HEIGHT_VH = 11;

  function ensureRow(team) {
    if (rowEls.has(team.id)) return rowEls.get(team.id);

    const row = document.createElement('div');
    row.className = 'bar-row';

    const label = document.createElement('div');
    label.className = 'bar-label';
    label.textContent = team.name;

    const track = document.createElement('div');
    track.className = 'bar-track';

    const fill = document.createElement('div');
    fill.className = 'bar-fill';
    fill.style.background = team.colour;

    const value = document.createElement('span');
    value.className = 'bar-value';
    track.appendChild(fill);

    row.appendChild(label);
    row.appendChild(track);
    row.appendChild(value);
    barsEl.appendChild(row);

    const entry = { row, fill, value };
    rowEls.set(team.id, entry);
    return entry;
  }

  function render(teams) {
    const sorted = [...teams].sort((a, b) => b.balance - a.balance);
    const maxBalance = Math.max(1, ...sorted.map((t) => t.balance));

    sorted.forEach((team, index) => {
      const entry = ensureRow(team);
      entry.row.style.top = `${index * ROW_HEIGHT_VH}vh`;
      const pct = Math.max(1.5, Math.round((Math.max(0, team.balance) / maxBalance) * 100));
      entry.fill.style.width = `${pct}%`;
      entry.value.textContent = `£${team.balance}`;
    });

    const leader = sorted[0];
    if (leader && leader.balance > 0 && leader.id !== previousLeaderId) {
      if (previousLeaderId !== null) {
        showFlash(`${leader.name} takes the lead!`);
      }
      previousLeaderId = leader.id;
    }
  }

  function showFlash(text) {
    flashEl.textContent = text;
    flashEl.hidden = false;
    flashEl.style.animation = 'none';
    // Force reflow so the animation restarts.
    void flashEl.offsetWidth;
    flashEl.style.animation = '';
    setTimeout(() => { flashEl.hidden = true; }, 1800);
  }

  const socket = io();
  socket.on('balance_update', render);
})();
