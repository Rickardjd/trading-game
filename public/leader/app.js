(() => {
  const standingsBody = document.querySelector('#standingsTable tbody');
  const feedEl = document.getElementById('feed');
  const adjForm = document.getElementById('adjustmentForm');
  const adjTeam = document.getElementById('adjTeam');
  const adjAmount = document.getElementById('adjAmount');
  const adjNote = document.getElementById('adjNote');
  const undoBtn = document.getElementById('undoBtn');
  const timerPanel = document.querySelector('.timer-panel');
  const gameTimerValue = document.getElementById('gameTimerValue');
  const gameTimerStatus = document.getElementById('gameTimerStatus');
  const timerPauseBtn = document.getElementById('timerPauseBtn');
  const timerResumeBtn = document.getElementById('timerResumeBtn');
  const timerStopBtn = document.getElementById('timerStopBtn');
  const timerMinutes = document.getElementById('timerMinutes');
  const timerStartBtn = document.getElementById('timerStartBtn');
  const teamsPlaying = document.getElementById('teamsPlaying');
  const resetGameBtn = document.getElementById('resetGameBtn');

  const hiresBody = document.querySelector('#hiresTable tbody');
  const hiresTable = document.getElementById('hiresTable');
  const hiresEmpty = document.getElementById('hiresEmpty');

  let teams = [];
  let openHires = [];

  function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function renderTeamsPlaying() {
    teamsPlaying.innerHTML = [...teams]
      .sort((a, b) => a.code.localeCompare(b.code))
      .map(
        (t) => `<label class="team-toggle${t.active ? '' : ' out'}">
          <input type="checkbox" data-code="${t.code}" ${t.active ? 'checked' : ''} />
          <span class="swatch" style="background:${t.colour}"></span>${escapeHtml(t.name)}
          <button type="button" class="rename-btn" data-code="${t.code}" title="Rename team">Rename</button>
        </label>`
      )
      .join('');
  }

  teamsPlaying.addEventListener('click', async (e) => {
    const btn = e.target.closest('.rename-btn');
    if (!btn) return;
    // The button sits inside the tick-box label; don't let the click toggle the team.
    e.preventDefault();
    const team = teams.find((t) => t.code === btn.dataset.code);
    const newName = window.prompt('Team name:', team.name);
    if (newName === null) return;
    const trimmed = newName.trim();
    if (!trimmed || trimmed === team.name) return;

    const res = await fetch(`/api/teams/${encodeURIComponent(team.code)}/name`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: trimmed }),
    });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error || 'Could not rename team.');
    }
  });

  teamsPlaying.addEventListener('change', async (e) => {
    const box = e.target.closest('input[data-code]');
    if (!box) return;
    const res = await fetch(`/api/teams/${encodeURIComponent(box.dataset.code)}/active`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: box.checked }),
    });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error || 'Could not change that team.');
      renderTeamsPlaying();
    }
  });

  // Standings and adjustments only cover the teams playing this game.
  function renderStandings(all) {
    teams = all;
    renderTeamsPlaying();
    const list = all.filter((t) => t.active);
    const sorted = [...list].sort((a, b) => b.balance - a.balance);
    standingsBody.innerHTML = sorted
      .map(
        (t) => `<tr>
          <td><span class="swatch" style="background:${t.colour}"></span>${escapeHtml(t.name)}</td>
          <td>£${t.balance}</td>
        </tr>`
      )
      .join('');

    const currentValue = adjTeam.value;
    adjTeam.innerHTML = list
      .map((t) => `<option value="${t.code}">${escapeHtml(t.name)}</option>`)
      .join('');
    if (currentValue) adjTeam.value = currentValue;
  }

  // Overdue tools first, then whatever is due back soonest.
  function renderHires() {
    hiresTable.hidden = openHires.length === 0;
    hiresEmpty.hidden = openHires.length > 0;
    const sorted = [...openHires].sort((a, b) => new Date(a.due_at) - new Date(b.due_at));
    hiresBody.innerHTML = sorted
      .map((h) => {
        const due = new Date(h.due_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const overdue = hireMinutesLate(h) > 0;
        return `<tr class="${overdue ? 'overdue' : ''}" data-hire-id="${h.id}">
          <td>${escapeHtml(h.item_name)}</td>
          <td><span class="swatch" style="background:${h.team_colour}"></span>${escapeHtml(h.team_name)}</td>
          <td>${due}</td>
          <td class="hire-status">${escapeHtml(describeHireStatus(h))}</td>
          <td><button class="ghost-btn checkin-btn" data-item="${escapeHtml(h.item_code)}">Check in</button></td>
        </tr>`;
      })
      .join('');
  }

  // Tick just the status cells, so the Check in buttons aren't replaced mid-click.
  function tickHires() {
    for (const h of openHires) {
      const row = hiresBody.querySelector(`tr[data-hire-id="${h.id}"]`);
      if (!row) continue;
      row.classList.toggle('overdue', hireMinutesLate(h) > 0);
      row.querySelector('.hire-status').textContent = describeHireStatus(h);
    }
  }

  setInterval(tickHires, 1000);

  hiresBody.addEventListener('click', async (e) => {
    const btn = e.target.closest('.checkin-btn');
    if (!btn) return;
    btn.disabled = true;
    const res = await fetch('/api/items/return', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item_code: btn.dataset.item, station_id: 'leader-dashboard' }),
    });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error || 'Could not check in.');
      btn.disabled = false;
    }
  });

  function addFeedItem(text, cls, timestamp) {
    const item = document.createElement('div');
    item.className = `feed-item ${cls || ''}`.trim();
    const time = new Date(timestamp || Date.now()).toLocaleTimeString();
    item.innerHTML = `<span>${text}</span><time>${time}</time>`;
    feedEl.insertBefore(item, feedEl.firstChild);
    while (feedEl.children.length > 100) {
      feedEl.removeChild(feedEl.lastChild);
    }
  }

  function handleFeedEvent(evt) {
    if (evt.type === 'completion') {
      const c = evt.completion;
      addFeedItem(
        `<span class="swatch" style="background:${evt.team.colour}"></span> <strong>${escapeHtml(evt.team.name)}</strong> completed ${escapeHtml(evt.activity.code)} ${escapeHtml(evt.activity.name)} — ${escapeHtml(c.award_level)} (£${c.awarded_value})`,
        'completion',
        evt.timestamp
      );
    } else if (evt.type === 'adjustment') {
      addFeedItem(
        `<span class="swatch" style="background:${evt.team.colour}"></span> <strong>${escapeHtml(evt.team.name)}</strong> manual adjustment: ${evt.amount >= 0 ? '+' : ''}${evt.amount} ${evt.note ? `(${escapeHtml(evt.note)})` : ''}`,
        'adjustment',
        evt.timestamp
      );
    } else if (evt.type === 'purchase') {
      addFeedItem(
        `<span class="swatch" style="background:${evt.team.colour}"></span> <strong>${escapeHtml(evt.team.name)}</strong> bought ${evt.quantity} × ${escapeHtml(evt.item.name)} (£${-evt.amount})`,
        'purchase',
        evt.timestamp
      );
    } else if (evt.type === 'hire') {
      addFeedItem(
        `<span class="swatch" style="background:${evt.team.colour}"></span> <strong>${escapeHtml(evt.team.name)}</strong> hired ${escapeHtml(evt.item.name)} for ${evt.item.hire_minutes} min (£${-evt.amount})`,
        'hire',
        evt.timestamp
      );
    } else if (evt.type === 'return') {
      addFeedItem(
        `<span class="swatch" style="background:${evt.team.colour}"></span> <strong>${escapeHtml(evt.team.name)}</strong> returned ${escapeHtml(evt.item.name)} ${
          evt.hire.late_fee > 0 ? `${evt.hire.minutes_late} min late — late fee £${evt.hire.late_fee}` : 'on time'
        }`,
        evt.hire.late_fee > 0 ? 'late_fee' : 'return',
        evt.timestamp
      );
    } else if (evt.type === 'undo') {
      addFeedItem(
        `<span class="swatch" style="background:${evt.team.colour}"></span> <strong>${escapeHtml(evt.team.name)}</strong> — undo: ${escapeHtml(evt.reversed.note || evt.reversed.type)}`,
        'undo',
        evt.timestamp
      );
    }
  }

  async function loadInitialFeed() {
    const res = await fetch('/api/transactions/feed?limit=50');
    const rows = await res.json();
    rows.reverse().forEach((row) => {
      const label =
        row.type === 'completion'
          ? `completion: ${escapeHtml(row.note || '')}`
          : row.type === 'undo'
          ? `undo: ${escapeHtml(row.note || '')}`
          : row.type === 'opening'
          ? `starting funds: +£${row.amount}`
          : ['purchase', 'hire', 'late_fee'].includes(row.type)
          ? `${escapeHtml(row.note || row.type)} (£${-row.amount})`
          : `adjustment: ${row.amount >= 0 ? '+' : ''}${row.amount} ${row.note ? `(${escapeHtml(row.note)})` : ''}`;
      addFeedItem(
        `<span class="swatch" style="background:${row.team_colour}"></span> <strong>${escapeHtml(row.team_name)}</strong> ${label}`,
        row.type,
        row.timestamp
      );
    });
  }

  adjForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = {
      team_code: adjTeam.value,
      amount: Number(adjAmount.value),
      note: adjNote.value || undefined,
      station_id: 'leader-dashboard',
    };
    const res = await fetch('/api/transactions/adjustment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      adjAmount.value = '';
      adjNote.value = '';
    } else {
      const data = await res.json();
      alert(data.error || 'Could not apply adjustment.');
    }
  });

  undoBtn.addEventListener('click', async () => {
    if (!window.confirm('Undo the most recent transaction across all stations?')) return;
    const res = await fetch('/api/transactions/undo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ station_id: 'leader-dashboard' }),
    });
    const data = await res.json();
    if (!res.ok) alert(data.error || 'Nothing to undo.');
  });

  // --- Game timer ---
  let timerState = null;

  function renderGameTimer() {
    if (!timerState) return;
    const remaining = computeRemainingSeconds(timerState);
    gameTimerValue.textContent = formatTimer(remaining);
    const finished = timerState.status === 'running' && remaining <= 0;
    timerPanel.classList.toggle('paused', timerState.status === 'paused');
    timerPanel.classList.toggle('finished', finished);
    gameTimerStatus.textContent =
      timerState.status === 'paused' ? 'Paused' : finished ? "Time's up" : timerState.status === 'running' ? 'Running' : 'Not started';
    timerPauseBtn.hidden = timerState.status !== 'running';
    timerResumeBtn.hidden = timerState.status !== 'paused';
    timerStopBtn.hidden = timerState.status === 'idle' || finished;
  }

  setInterval(renderGameTimer, 250);

  timerStartBtn.addEventListener('click', async () => {
    const minutes = Number(timerMinutes.value);
    if (!minutes || minutes <= 0) {
      alert('Enter how many minutes the game should run for.');
      return;
    }
    // Starting always restarts the countdown from full, so check before wiping a live one.
    if (timerState && timerState.status !== 'idle' && !window.confirm(`Restart the countdown at ${minutes} minutes?`)) return;
    const res = await fetch('/api/timer/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ duration_seconds: Math.round(minutes * 60) }),
    });
    if (res.ok) {
      timerMinutes.value = '';
    } else {
      const data = await res.json();
      alert(data.error || 'Could not start the timer.');
    }
  });

  timerPauseBtn.addEventListener('click', () => fetch('/api/timer/pause', { method: 'POST' }));
  timerResumeBtn.addEventListener('click', () => fetch('/api/timer/resume', { method: 'POST' }));
  timerStopBtn.addEventListener('click', () => {
    if (!window.confirm("Stop the game now? The clock goes to zero and shows \"Time's up\" for everyone.")) return;
    fetch('/api/timer/stop', { method: 'POST' });
  });

  resetGameBtn.addEventListener('click', async () => {
    const typed = window.prompt(
      'Reset the whole game? Every team goes back to its starting funds, and all completions, purchases, hires, chits and the timer are cleared.\n\nType RESET to confirm.'
    );
    if (typed === null) return;
    if (typed.trim().toUpperCase() !== 'RESET') {
      alert('Not reset — you need to type RESET to confirm.');
      return;
    }
    const res = await fetch('/api/game/reset', { method: 'POST' });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error || 'Could not reset the game.');
    }
  });

  const socket = io();
  socket.on('balance_update', renderStandings);
  socket.on('feed_event', handleFeedEvent);
  socket.on('hires_update', (hires) => {
    openHires = hires;
    renderHires();
  });
  socket.on('timer_update', (state) => {
    timerState = state;
    renderGameTimer();
  });
  socket.on('game_reset', () => {
    feedEl.innerHTML = '';
    loadInitialFeed();
  });

  loadInitialFeed();
})();
