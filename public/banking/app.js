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
  const teamHires = document.getElementById('teamHires');
  const purchasePanel = document.getElementById('purchasePanel');
  const purchaseName = document.getElementById('purchaseName');
  const purchasePrice = document.getElementById('purchasePrice');
  const purchaseQty = document.getElementById('purchaseQty');
  const purchaseConfirmBtn = document.getElementById('purchaseConfirmBtn');
  const hirePanel = document.getElementById('hirePanel');
  const hireName = document.getElementById('hireName');
  const hireTerms = document.getElementById('hireTerms');
  const hireConfirmBtn = document.getElementById('hireConfirmBtn');
  const returnPanel = document.getElementById('returnPanel');
  const returnName = document.getElementById('returnName');
  const returnDetail = document.getElementById('returnDetail');
  const returnStatus = document.getElementById('returnStatus');
  const returnConfirmBtn = document.getElementById('returnConfirmBtn');
  const screenFlash = document.getElementById('screenFlash');

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
  let currentItem = null; // the buy/hire item on screen, if any
  let currentReturn = null; // the open hire on screen for check-in, if any
  let openHires = [];

  function showMessage(text, type) {
    messageEl.textContent = text;
    messageEl.className = `message ${type}`;
    messageEl.hidden = false;
  }
  function clearMessage() {
    messageEl.hidden = true;
  }

  // Flash the whole screen red — a team has tried to spend more than it has.
  function flashScreen() {
    screenFlash.hidden = false;
    screenFlash.style.animation = 'none';
    // Force reflow so the animation restarts.
    void screenFlash.offsetWidth;
    screenFlash.style.animation = '';
  }
  screenFlash.addEventListener('animationend', () => { screenFlash.hidden = true; });

  function hideItemPanels() {
    currentItem = null;
    currentReturn = null;
    purchasePanel.hidden = true;
    hirePanel.hidden = true;
    returnPanel.hidden = true;
  }

  function resetToTeamScan() {
    mode = 'team';
    currentTeam = null;
    currentActivity = null;
    hideItemPanels();
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
    hideItemPanels();
    activityPanel.hidden = true;
    rejectPanel.hidden = true;
    scanInput.placeholder = 'Scan activity card, shop item or tool…';
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
    renderTeamHires();
  }

  // Tools this team currently has out, so the operator can remind them what's due.
  function renderTeamHires() {
    const mine = currentTeam ? openHires.filter((h) => h.team_id === currentTeam.id) : [];
    teamHires.hidden = mine.length === 0;
    teamHires.replaceChildren(
      ...mine.map((h) => {
        const tag = document.createElement('span');
        tag.className = `hire-tag${hireMinutesLate(h) > 0 ? ' overdue' : ''}`;
        tag.textContent = `${h.item_name}: ${describeHireStatus(h)}`;
        return tag;
      })
    );
  }

  function renderReturnStatus() {
    if (!currentReturn) return;
    const late = hireMinutesLate(currentReturn);
    returnStatus.classList.toggle('overdue', late > 0);
    returnStatus.textContent =
      late > 0
        ? `${late} min late — late fee £${late * currentReturn.late_fee_per_minute}`
        : `On time (${formatTimer(hireSecondsLeft(currentReturn))} left) — no late fee`;
  }

  setInterval(() => {
    renderTeamHires();
    renderReturnStatus();
  }, 1000);

  function showItemPanel(panel) {
    activityPanel.hidden = true;
    rejectPanel.hidden = true;
    purchasePanel.hidden = panel !== purchasePanel;
    hirePanel.hidden = panel !== hirePanel;
    returnPanel.hidden = panel !== returnPanel;
  }

  function updatePurchaseTotal() {
    const qty = Math.max(1, Math.trunc(Number(purchaseQty.value)) || 1);
    purchaseConfirmBtn.textContent = `Charge £${currentItem.price * qty}`;
  }

  function renderPurchase(item) {
    currentItem = item;
    purchaseName.textContent = item.name;
    purchasePrice.textContent = `£${item.price} each`;
    purchaseQty.value = 1;
    updatePurchaseTotal();
    showItemPanel(purchasePanel);
  }

  function renderHire(item) {
    currentItem = item;
    hireName.textContent = item.name;
    hireTerms.textContent = `£${item.price} for ${item.hire_minutes} minutes. Late return costs £${item.late_fee_per_minute} for every started minute over.`;
    hireConfirmBtn.textContent = `Check out to ${currentTeam.name} — £${item.price}`;
    showItemPanel(hirePanel);
  }

  function renderReturn(item, hire) {
    currentItem = item;
    currentReturn = hire;
    returnName.textContent = item.name;
    const due = new Date(hire.due_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    returnDetail.textContent = `Hired by ${hire.team_name} · due back ${due}`;
    renderReturnStatus();
    showItemPanel(returnPanel);
  }

  // After a buy/hire/return, carry on with the current team if there is one.
  function finishItemAction() {
    if (currentTeam) resetToActivityScan();
    else resetToTeamScan();
  }

  // Returns true if the code was a shop item or hire tool (and has been handled).
  async function handleItemScan(code) {
    const res = await fetch(`/api/items/${encodeURIComponent(code)}`);
    if (!res.ok) return false;
    const { item, hire } = await res.json();

    if (hire) {
      renderReturn(item, hire);
    } else if (currentTeam && currentTeam.balance < item.price) {
      hideItemPanels();
      flashScreen();
      showMessage(
        `Not enough money — ${item.name} costs £${item.price}${item.type === 'hire' ? ' to hire' : ''}, ${currentTeam.name} has £${currentTeam.balance}.`,
        'error'
      );
    } else if (!currentTeam) {
      hideItemPanels();
      showMessage(
        item.type === 'hire'
          ? `${item.name} is not out on hire. Scan a team card first to hire it out.`
          : `Scan a team card first to buy ${item.name}.`,
        'error'
      );
    } else if (item.type === 'buy') {
      renderPurchase(item);
    } else {
      renderHire(item);
    }
    return true;
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
    scanInput.placeholder = 'Scan grade chit…';
    activityPanel.hidden = false;
    rejectPanel.hidden = true;
  }

  // Returns the grade chit for this code, or null if it isn't one.
  async function lookupChit(code) {
    const res = await fetch(`/api/chits/${encodeURIComponent(code)}`);
    return res.ok ? res.json() : null;
  }

  const LEVEL_LABEL = { poor: 'Poor', standard: 'Standard', excellent: 'Excellent' };

  function handleChitScan(chit) {
    if (!currentTeam) {
      showMessage(`That's a grade chit (${LEVEL_LABEL[chit.award_level]}). Scan the team card first, then the activity card, then the chit.`, 'error');
      return;
    }
    if (!currentActivity || activityPanel.hidden) {
      showMessage(`That's a grade chit (${LEVEL_LABEL[chit.award_level]}). Scan the activity card first, then the chit.`, 'error');
      return;
    }
    if (chit.completion_id) {
      showMessage(
        `Chit ${chit.code} has already been cashed in (${chit.team_name}, ${chit.activity_code}). Keep it and tell a leader.`,
        'error'
      );
      return;
    }
    submitAward(chit.award_level, chit.code);
  }

  // Returns true if the code was a team card (and has been handled). Scanning a team
  // card while another team is on screen finishes with that team and moves on to the
  // new one, so the banker doesn't have to click "Done with this team" in between.
  async function handleTeamCardScan(code) {
    const res = await fetch(`/api/teams/${encodeURIComponent(code)}`);
    if (!res.ok) return false;
    const team = await res.json();
    if (!team.active) {
      showMessage(`${team.name} isn't playing this game. A leader can add them from the leader dashboard.`, 'error');
      return true;
    }

    const previous = currentTeam;
    // Anything still waiting for a click (an award, a charge, a check-out) is dropped,
    // not confirmed — say so, in case the banker thinks it went through.
    const pending = !activityPanel.hidden
      ? `${currentActivity.code} ${currentActivity.name}`
      : !purchasePanel.hidden || !hirePanel.hidden
      ? currentItem.name
      : null;

    renderTeam(team);
    resetToActivityScan();
    if (previous && previous.id !== team.id) {
      if (pending) {
        showMessage(`Now serving ${team.name}. ${pending} for ${previous.name} was NOT recorded — it hadn't been confirmed.`, 'error');
      } else {
        showMessage(`Now serving ${team.name}.`, 'info');
      }
    }
    return true;
  }

  async function handleTeamScan(code) {
    clearMessage();
    try {
      const chit = await lookupChit(code);
      if (chit) return handleChitScan(chit);

      if (await handleTeamCardScan(code)) return;
      if (!(await handleItemScan(code))) {
        showMessage(`No team or tool found for code "${code}"`, 'error');
      }
    } catch (err) {
      showMessage('Could not reach server.', 'error');
    }
  }

  async function handleActivityScan(code) {
    clearMessage();
    try {
      const chit = await lookupChit(code);
      if (chit) return handleChitScan(chit);

      const res = await fetch(`/api/activities/${encodeURIComponent(code)}`);
      if (!res.ok) {
        if (await handleTeamCardScan(code)) return;
        if (!(await handleItemScan(code))) {
          showMessage(`No activity, shop item, tool or team found for code "${code}"`, 'error');
        }
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

  async function submitAward(level, chitCode) {
    clearMessage();
    try {
      const res = await fetch('/api/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          team_code: currentTeam.code,
          activity_code: currentActivity.code,
          award_level: chitCode ? undefined : level,
          chit_code: chitCode,
          examiner_notes: examinerNotes.value || undefined,
          station_id: stationId,
        }),
      });
      const data = await res.json();

      if (res.status === 409 && data.chit) {
        showMessage(`${data.error}. Keep it and tell a leader.`, 'error');
        return;
      }
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
          : `Awarded £${value} (${LEVEL_LABEL[level]}${chitCode ? `, chit ${chitCode}` : ''}) to ${currentTeam.name}. New balance: £${currentTeam.balance}.`,
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

  async function postItemAction(url, body) {
    clearMessage();
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, station_id: stationId }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 402) flashScreen();
        showMessage(data.error || 'Could not complete that.', 'error');
        return null;
      }
      return data;
    } catch (err) {
      showMessage('Could not reach server.', 'error');
      return null;
    }
  }

  document.querySelectorAll('.qty-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      purchaseQty.value = Math.max(1, (Math.trunc(Number(purchaseQty.value)) || 1) + Number(btn.dataset.step));
      updatePurchaseTotal();
    });
  });
  purchaseQty.addEventListener('input', updatePurchaseTotal);

  purchaseConfirmBtn.addEventListener('click', async () => {
    const data = await postItemAction('/api/items/purchase', {
      team_code: currentTeam.code,
      item_code: currentItem.code,
      quantity: Math.trunc(Number(purchaseQty.value)) || 1,
    });
    if (!data) return;
    renderTeam(data.team);
    showMessage(`Sold ${data.quantity} × ${data.item.name} for £${data.cost}. New balance: £${data.team.balance}.`, 'success');
    finishItemAction();
  });

  hireConfirmBtn.addEventListener('click', async () => {
    const data = await postItemAction('/api/items/hire', {
      team_code: currentTeam.code,
      item_code: currentItem.code,
    });
    if (!data) return;
    renderTeam(data.team);
    const due = new Date(data.hire.due_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    showMessage(`${data.item.name} hired to ${data.team.name} — due back by ${due}. New balance: £${data.team.balance}.`, 'success');
    finishItemAction();
  });

  returnConfirmBtn.addEventListener('click', async () => {
    const data = await postItemAction('/api/items/return', { item_code: currentItem.code });
    if (!data) return;
    if (currentTeam && currentTeam.id === data.team.id) renderTeam(data.team);
    showMessage(
      data.late_fee > 0
        ? `${data.item.name} returned ${data.minutes_late} min late — ${data.team.name} charged £${data.late_fee}. New balance: £${data.team.balance}.`
        : `${data.item.name} returned on time by ${data.team.name}.`,
      data.late_fee > 0 ? 'error' : 'success'
    );
    finishItemAction();
  });

  document.querySelectorAll('.shop-cancel').forEach((btn) => btn.addEventListener('click', finishItemAction));

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
  socket.on('hires_update', (hires) => {
    openHires = hires;
    renderTeamHires();
  });
  socket.on('balance_update', (teams) => {
    const updated = currentTeam && teams.find((t) => t.id === currentTeam.id);
    if (updated) renderTeam(updated);
  });
  socket.on('timer_update', (state) => {
    timerState = state;
    renderGameTimer();
  });

  resetToTeamScan();
})();
