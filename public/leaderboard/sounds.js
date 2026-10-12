// Leaderboard sound effects, synthesised with the Web Audio API so there are no audio
// files to ship and it all works offline. Browsers block sound until the page has been
// clicked or a key pressed, so nothing plays until unlock() has been called from one.
const sounds = (() => {
  let ctx = null;
  let master = null;
  let muted = localStorage.getItem('leaderboardMuted') === '1';

  function unlock() {
    if (!ctx) {
      ctx = new AudioContext();
      master = ctx.createGain();
      master.gain.value = 0.9;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
  }

  const canPlay = () => ctx !== null && !muted;

  // One trumpet-ish note: two slightly detuned sawtooths through a low-pass filter that
  // opens up on the attack, which is what gives brass its "blat".
  function brass(freq, start, duration, level = 0.22) {
    const t = ctx.currentTime + start;
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(level, t + 0.03);
    amp.gain.setValueAtTime(level * 0.85, t + duration - 0.06);
    amp.gain.linearRampToValueAtTime(0, t + duration);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 1;
    filter.frequency.setValueAtTime(freq * 1.5, t);
    filter.frequency.linearRampToValueAtTime(freq * 5, t + 0.07);

    for (const detune of [-6, 6]) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = freq;
      osc.detune.value = detune;
      osc.connect(filter);
      osc.start(t);
      osc.stop(t + duration + 0.05);
    }
    filter.connect(amp);
    amp.connect(master);
  }

  // A short bell-like blip that rings out.
  function chime(freq, start, duration, level = 0.12) {
    const t = ctx.currentTime + start;
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(level, t);
    amp.gain.exponentialRampToValueAtTime(0.001, t + duration);
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    osc.connect(amp);
    amp.connect(master);
    osc.start(t);
    osc.stop(t + duration);
  }

  const G4 = 392.0, C5 = 523.25, E5 = 659.25, G5 = 783.99, C6 = 1046.5;
  const C4 = 261.63, E4 = 329.63;

  return {
    unlock,
    isUnlocked: () => ctx !== null,
    isMuted: () => muted,
    setMuted(value) {
      muted = value;
      localStorage.setItem('leaderboardMuted', value ? '1' : '0');
    },

    // Trumpet announcement: a team has moved into first place.
    fanfare() {
      if (!canPlay()) return;
      brass(G4, 0.0, 0.15);
      brass(C5, 0.17, 0.15);
      brass(E5, 0.34, 0.15);
      brass(G5, 0.51, 0.42);
      brass(E5, 0.97, 0.15);
      // Final held chord.
      brass(C5, 1.14, 1.1, 0.12);
      brass(E5, 1.14, 1.1, 0.12);
      brass(G5, 1.14, 1.1, 0.2);
      brass(C6, 1.14, 1.1, 0.1);
    },

    // Coin "ka-ching": a team has just earned money.
    coin() {
      if (!canPlay()) return;
      chime(987.77, 0, 0.09);
      chime(1318.5, 0.08, 0.45);
    },

    // Descending horn call: time's up.
    timeUp() {
      if (!canPlay()) return;
      brass(C5, 0.0, 0.32, 0.25);
      brass(G4, 0.36, 0.32, 0.25);
      brass(E4, 0.72, 0.32, 0.25);
      brass(C4, 1.08, 1.6, 0.3);
    },
  };
})();
