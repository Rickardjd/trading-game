// Shared hire-clock math used by the banking and leader pages. Mirrors the server's
// rule: every started minute past the due time counts as a full minute late. The
// server recalculates on check-in, so this is only for display.
function hireMinutesLate(hire) {
  const overdueMs = Date.now() - new Date(hire.due_at).getTime();
  return overdueMs > 0 ? Math.ceil(overdueMs / 60000) : 0;
}

function hireSecondsLeft(hire) {
  return Math.max(0, Math.round((new Date(hire.due_at).getTime() - Date.now()) / 1000));
}

// e.g. "3:12 left" or "2 min late · £40"
function describeHireStatus(hire) {
  const late = hireMinutesLate(hire);
  if (late > 0) return `${late} min late · £${late * hire.late_fee_per_minute}`;
  return `${formatTimer(hireSecondsLeft(hire))} left`;
}
