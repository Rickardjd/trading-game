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

  let teams = [];

  function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function renderStandings(list) {
    teams = list;
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
  }

  setInterval(renderGameTimer, 250);

  timerPauseBtn.addEventListener('click', () => fetch('/api/timer/pause', { method: 'POST' }));
  timerResumeBtn.addEventListener('click', () => fetch('/api/timer/resume', { method: 'POST' }));

  const socket = io();
  socket.on('balance_update', renderStandings);
  socket.on('feed_event', handleFeedEvent);
  socket.on('timer_update', (state) => {
    timerState = state;
    renderGameTimer();
  });

  loadInitialFeed();
})();
