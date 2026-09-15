(() => {
  const scanInput = document.getElementById('scanInput');
  const messageEl = document.getElementById('message');
  const teamPanel = document.getElementById('teamPanel');
  const teamSwatch = document.getElementById('teamSwatch');
  const teamName = document.getElementById('teamName');
  const teamBalance = document.getElementById('teamBalance');
  const doneTeamBtn = document.getElementById('doneTeamBtn');
  const renameTeamBtn = document.getElementById('renameTeamBtn');
  const activityPanel = document.getElementById('activityPanel');
  const activityCode = document.getElementById('activityCode');
  const activityName = document.getElementById('activityName');
  const activityMeta = document.getElementById('activityMeta');
  const activityCriteria = document.getElementById('activityCriteria');
  const examinerNotes = document.getElementById('examinerNotes');
  const rejectPanel = document.getElementById('rejectPanel');
  const rejectDetail = document.getElementById('rejectDetail');
  const rejectContinueBtn = document.getElementById('rejectContinueBtn');
  const undoBtn = document.getElementById('undoBtn');
  const stationLabel = document.getElementById('stationLabel');
  const renameStationBtn = document.getElementById('renameStationBtn');
  const timerPanel = document.querySelector('.timer-panel');
  const gameTimerValue = document.getElementById('gameTimerValue');
  const gameTimerStatus = document.getElementById('gameTimerStatus');
  const timerMinutes = document.getElementById('timerMinutes');
  const timerStartBtn = document.getElementById('timerStartBtn');
  const timerPauseBtn = document.getElementById('timerPauseBtn');
  const timerResumeBtn = document.getElementById('timerResumeBtn');
  const timerResetBtn = document.getElementById('timerResetBtn');

  let stationId = localStorage.getItem('stationId');
  if (!stationId) {
    stationId = promptForStationName();
  }
  stationLabel.textContent = stationId;

  function promptForStationName() {
    const name = window.prompt('Name this banking station (e.g. "Station A"):', 'Station A') || 'Station';
    localStorage.setItem('stationId', name);
    return name;
  }

  renameStationBtn.addEventListener('click', () => {
    stationId = promptForStationName();
    stationLabel.textContent = stationId;
  });

  // mode: 'team' | 'activity'
  let mode = 'team';
  let currentTeam = null;
  let currentActivity = null;

  function showMessage(text, type) {
    messageEl.textContent = text;
    messageEl.className = `message ${type}`;
    messageEl.hidden = false;
  }
  function clearMessage() {
    messageEl.hidden = true;
  }

  function resetToTeamScan() {
    mode = 'team';
    currentTeam = null;
    currentActivity = null;
    teamPanel.hidden = true;
    activityPanel.hidden = true;
    rejectPanel.hidden = true;
    scanInput.placeholder = 'Scan team card…';
    scanInput.value = '';
    focusInput();
  }

  function resetToActivityScan() {
    mode = 'activity';
    currentActivity = null;
    activityPanel.hidden = true;
    rejectPanel.hidden = true;
    scanInput.placeholder = 'Scan activity card…';
    scanInput.value = '';
    focusInput();
  }

  function focusInput() {
    scanInput.focus();
  }

  function renderTeam(team) {
    currentTeam = team;
    teamSwatch.style.background = team.colour;
    teamName.textContent = team.name;
    teamBalance.textContent = `Balance: £${team.balance}`;
    teamPanel.hidden = false;
  }

  function renderActivity(activity) {
    currentActivity = activity;
    activityCode.textContent = activity.code;
    activityName.textContent = activity.name;
    const metaParts = [];
    if (activity.category) metaParts.push(activity.category);
    if (activity.materials_required) metaParts.push(`Materials: ${activity.materials_required}`);
    if (activity.tools_required) metaParts.push(`Tools: ${activity.tools_required}`);
    activityMeta.textContent = metaParts.join(' · ');
    activityCriteria.textContent = activity.description_of_outcome;
    document.querySelector('.award-btn.poor').textContent = `Poor (£${activity.poor_value})`;
    document.querySelector('.award-btn.standard').textContent = `Standard (£${activity.standard_value})`;
    document.querySelector('.award-btn.excellent').textContent = `Excellent (£${activity.excellent_value})`;
    examinerNotes.value = '';
    activityPanel.hidden = false;
    rejectPanel.hidden = true;
  }

  async function handleTeamScan(code) {
    clearMessage();
    try {
      const res = await fetch(`/api/teams/${encodeURIComponent(code)}`);
      if (!res.ok) {
        showMessage(`No team found for code "${code}"`, 'error');
        return;
      }
      const team = await res.json();
      renderTeam(team);
      resetToActivityScan();
    } catch (err) {
      showMessage('Could not reach server.', 'error');
    }
  }

  async function handleActivityScan(code) {
    clearMessage();
    try {
      const res = await fetch(`/api/activities/${encodeURIComponent(code)}`);
      if (!res.ok) {
        showMessage(`No activity found for code "${code}"`, 'error');
        return;
      }
      const activity = await res.json();

      const checkRes = await fetch(
        `/api/completions/check?team_code=${encodeURIComponent(currentTeam.code)}&activity_code=${encodeURIComponent(activity.code)}`
      );
      const check = await checkRes.json();

      if (check.completed) {
        currentActivity = activity;
        activityPanel.hidden = true;
        rejectDetail.textContent = `${activity.code} ${activity.name} was already awarded "${check.completion.award_level}" (£${check.completion.awarded_value}).`;
        rejectPanel.hidden = false;
        return;
      }

      renderActivity(activity);
    } catch (err) {
      showMessage('Could not reach server.', 'error');
    }
  }

  async function submitAward(level) {
    clearMessage();
    try {
      const res = await fetch('/api/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          team_code: currentTeam.code,
          activity_code: currentActivity.code,
          award_level: level,
          examiner_notes: examinerNotes.value || undefined,
          station_id: stationId,
        }),
      });
      const data = await res.json();

      if (res.status === 409) {
        rejectDetail.textContent = 'Already completed — no reward.';
        activityPanel.hidden = true;
        rejectPanel.hidden = false;
        return;
      }
      if (!res.ok) {
        showMessage(data.error || 'Could not record completion.', 'error');
        return;
      }

      currentTeam = data.team;
      const value = data.awarded_value !== undefined ? data.awarded_value : data.completion.awarded_value;
      showMessage(
        level === 'not_met'
          ? `Not met — no reward. Team may reattempt ${currentActivity.code}.`
          : `Awarded £${value} to ${currentTeam.name}. New balance: £${currentTeam.balance}.`,
        level === 'not_met' ? 'info' : 'success'
      );
      renderTeam(currentTeam);
      resetToActivityScan();
    } catch (err) {
      showMessage('Could not reach server.', 'error');
    }
  }

  scanInput.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const value = scanInput.value.trim();
    scanInput.value = '';
    if (!value) return;
    if (mode === 'team') {
      handleTeamScan(value);
    } else {
      handleActivityScan(value);
    }
  });

  document.querySelectorAll('.award-btn').forEach((btn) => {
    btn.addEventListener('click', () => submitAward(btn.dataset.level));
  });

  renameTeamBtn.addEventListener('click', async () => {
    if (!currentTeam) return;
    const newName = window.prompt('Team name:', currentTeam.name);
    if (newName === null) return;
    const trimmed = newName.trim();
    if (!trimmed || trimmed === currentTeam.name) return;

    clearMessage();
    try {
      const res = await fetch(`/api/teams/${encodeURIComponent(currentTeam.code)}/name`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        showMessage(data.error || 'Could not rename team.', 'error');
        return;
      }
      renderTeam(data);
      showMessage(`Team renamed to "${data.name}".`, 'success');
    } catch (err) {
      showMessage('Could not reach server.', 'error');
    }
  });

  doneTeamBtn.addEventListener('click', resetToTeamScan);
  rejectContinueBtn.addEventListener('click', resetToActivityScan);

  undoBtn.addEventListener('click', async () => {
    if (!window.confirm('Undo the most recent transaction? This affects whichever team/activity was last recorded, from any station.')) {
      return;
    }
    try {
      const res = await fetch('/api/transactions/undo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ station_id: stationId }),
      });
      const data = await res.json();
      if (!res.ok) {
        showMessage(data.error || 'Nothing to undo.', 'error');
        return;
      }
      showMessage(`Undone: ${data.reversed.note || data.reversed.type} for ${data.team.name}.`, 'info');
      if (currentTeam && currentTeam.id === data.team.id) {
        renderTeam(data.team);
      }
    } catch (err) {
      showMessage('Could not reach server.', 'error');
    }
  });

  // Keep the scan input focused so a barcode scanner (keyboard-emulating) always has somewhere to type.
  document.addEventListener('click', (e) => {
    if (!['TEXTAREA', 'INPUT', 'BUTTON'].includes(e.target.tagName)) {
      focusInput();
    }
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
      timerState.status === 'paused' ? 'Paused' : finished ? "Time's up" : timerState.status === 'running' ? 'Running' : '';
    timerPauseBtn.hidden = timerState.status !== 'running';
    timerResumeBtn.hidden = timerState.status !== 'paused';
  }

  setInterval(renderGameTimer, 250);

  timerStartBtn.addEventListener('click', async () => {
    const minutes = Number(timerMinutes.value);
    if (!minutes || minutes <= 0) {
      showMessage('Enter how many minutes the game should run for.', 'error');
      return;
    }
    const res = await fetch('/api/timer/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ duration_seconds: Math.round(minutes * 60) }),
    });
    const data = await res.json();
    if (!res.ok) {
      showMessage(data.error || 'Could not start the timer.', 'error');
    }
  });

  timerPauseBtn.addEventListener('click', () => fetch('/api/timer/pause', { method: 'POST' }));
  timerResumeBtn.addEventListener('click', () => fetch('/api/timer/resume', { method: 'POST' }));
  timerResetBtn.addEventListener('click', async () => {
    if (!window.confirm('Reset the game timer? This clears the countdown for everyone.')) return;
    await fetch('/api/timer/reset', { method: 'POST' });
    timerMinutes.value = '';
  });

  const socket = io();
  socket.on('timer_update', (state) => {
    timerState = state;
    renderGameTimer();
  });

  resetToTeamScan();
})();
