// Shared countdown-timer math used by the banking, leaderboard, and leader pages.
// Each page keeps a local copy of the last 'timer_update' payload and ticks its own
// display locally, rather than the server pushing every second.
function computeRemainingSeconds(state) {
  if (!state) return 0;
  if (state.status === 'running') {
    return Math.max(0, Math.round((new Date(state.ends_at).getTime() - Date.now()) / 1000));
  }
  return state.remaining_seconds;
}

function formatTimer(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(sec).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
