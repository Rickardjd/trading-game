(() => {
  const barsEl = document.getElementById('bars');
  const flashEl = document.getElementById('flash');
  const rowEls = new Map(); // team.id -> { row, fill, value }
  let previousLeaderId = null;
  const previousBalances = new Map(); // team.id -> balance at the last render
  let standings = []; // teams playing, best first

  const ROW_HEIGHT_VH = 11;

  function ensureRow(team) {
    if (rowEls.has(team.id)) return rowEls.get(team.id);

    const row = document.createElement('div');
    row.className = 'bar-row';

    const label = document.createElement('div');
    label.className = 'bar-label';

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

    const entry = { row, label, fill, value };
    rowEls.set(team.id, entry);
    return entry;
  }

  function applyLabel(label, name) {
    label.textContent = name;
    label.classList.remove('len-med', 'len-long');
    if (name.length > 16) label.classList.add('len-long');
    else if (name.length > 10) label.classList.add('len-med');
  }

  function render(teams) {
    // Only teams playing this game get a bar.
    const sorted = teams.filter((t) => t.active).sort((a, b) => b.balance - a.balance);
    const maxBalance = Math.max(1, ...sorted.map((t) => t.balance));

    for (const [id, entry] of rowEls) {
      if (!sorted.some((t) => t.id === id)) {
        entry.row.remove();
        rowEls.delete(id);
      }
    }

    sorted.forEach((team, index) => {
      const entry = ensureRow(team);
      entry.row.style.top = `${index * ROW_HEIGHT_VH}vh`;
      applyLabel(entry.label, team.name);
      const pct = Math.max(1.5, Math.round((Math.max(0, team.balance) / maxBalance) * 100));
      entry.fill.style.width = `${pct}%`;
      entry.value.textContent = `£${team.balance}`;
    });

    standings = sorted;
    renderPodium();

    const someoneEarned =sorted.some((t) => previousBalances.has(t.id) && t.balance > previousBalances.get(t.id));
    previousBalances.clear();
    sorted.forEach((t) => previousBalances.set(t.id, t.balance));

    const leader = sorted[0];
    let newLeader = false;
    if (leader && leader.balance > 0 && leader.id !== previousLeaderId) {
      if (previousLeaderId !== null) {
        newLeader = true;
        showFlash(`${leader.name} takes the lead!`);
      }
      previousLeaderId = leader.id;
    }

    if (newLeader) sounds.fanfare();
    else if (someoneEarned) sounds.coin();
  }

  // --- Final results podium, shown once the game is over ---
  const podiumEl = document.getElementById('podium');
  const podiumRest = document.getElementById('podiumRest');
  const ORDINALS = ['1st', '2nd', '3rd', '4th', '5th', '6th'];
  const PODIUM_DELAY_MS = 3500; // lets the time's-up horn finish first
  const WINNER_REVEAL_MS = 2400; // when first place rises — matches the CSS animation delay
  let podiumTimers = [];

  // Kept up to date while it's showing, since late fees and last-minute completions
  // can still change the result after time's up.
  function renderPodium() {
    podiumEl.querySelectorAll('.podium-place').forEach((el) => {
      const team = standings[Number(el.dataset.place) - 1];
      el.hidden = !team;
      if (!team) return;
      applyLabel(el.querySelector('.podium-name'), team.name);
      el.querySelector('.podium-score').textContent = `£${team.balance}`;
      el.querySelector('.podium-block').style.background = team.colour;
    });
    podiumRest.replaceChildren(
      ...standings.slice(3).map((team, i) => {
        const item = document.createElement('span');
        item.textContent = `${ORDINALS[i + 3] || `${i + 4}th`} ${team.name} £${team.balance}`;
        return item;
      })
    );
  }

  function showPodium(withSound) {
    if (!podiumEl.hidden) return;
    renderPodium();
    podiumEl.hidden = false;
    if (withSound) podiumTimers.push(setTimeout(() => sounds.fanfare(), WINNER_REVEAL_MS));
  }

  function hidePodium() {
    podiumTimers.forEach(clearTimeout);
    podiumTimers = [];
    podiumEl.hidden = true;
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

  const timerBar = document.getElementById('timerBar');
  const timerValue = document.getElementById('timerValue');
  let timerState = null;
  let wasFinished = null; // null until the timer has been seen, so loading the page mid-"time's up" stays quiet

  function renderTimer() {
    if (!timerState) return;
    if (timerState.status === 'idle' && timerState.duration_seconds === 0) {
      timerBar.hidden = true;
      wasFinished = false;
      hidePodium();
      return;
    }
    timerBar.hidden = false;
    const remaining = computeRemainingSeconds(timerState);
    timerValue.textContent = formatTimer(remaining);
    const finished = timerState.status === 'running' && remaining <= 0;
    timerBar.classList.toggle('paused', timerState.status === 'paused');
    timerBar.classList.toggle('finished', finished);
    if (finished && wasFinished === false) {
      sounds.timeUp();
      podiumTimers.push(setTimeout(() => showPodium(true), PODIUM_DELAY_MS));
    } else if (finished && wasFinished === null) {
      showPodium(false);
    } else if (!finished) {
      hidePodium();
    }
    wasFinished = finished;
  }

  // Sound needs one click or key press on this page before the browser allows it.
  const soundBtn = document.getElementById('soundBtn');

  function renderSoundBtn() {
    const on = sounds.isUnlocked() && !sounds.isMuted();
    soundBtn.classList.toggle('on', on);
    soundBtn.textContent = on
      ? 'Sound on'
      : sounds.isMuted()
      ? 'Sound off — click here to turn on'
      : 'Sound off — click anywhere to turn on';
  }

  function unlockSound() {
    if (sounds.isUnlocked()) return;
    sounds.unlock();
    renderSoundBtn();
    sounds.coin();
  }

  // Once sound is unlocked, the button is a mute toggle.
  soundBtn.addEventListener('click', () => {
    if (!sounds.isUnlocked() && !sounds.isMuted()) return; // the document handler unlocks
    sounds.setMuted(!sounds.isMuted());
    sounds.unlock();
    renderSoundBtn();
    sounds.coin();
  });
  document.addEventListener('click', unlockSound);
  document.addEventListener('keydown', unlockSound);
  renderSoundBtn();

  setInterval(renderTimer, 250);

  const socket = io();
  socket.on('balance_update', render);
  socket.on('timer_update', (state) => {
    timerState = state;
    renderTimer();
  });
})();
