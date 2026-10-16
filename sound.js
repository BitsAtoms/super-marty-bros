/* Synthesized 8-bit-style sound effects (Web Audio API) — no external audio
 * files, so there is nothing to license: everything here is generated live. */

const SFX = (() => {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  const ctx = Ctx ? new Ctx() : null;

  document.addEventListener('click', () => { if (ctx && ctx.state === 'suspended') ctx.resume(); }, { once: true });
  document.addEventListener('keydown', () => { if (ctx && ctx.state === 'suspended') ctx.resume(); }, { once: true });

  function tone(freq, duration, type = 'square', gainVal = 0.1, delay = 0) {
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(gainVal, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  function sweep(freqFrom, freqTo, duration, type = 'square', gainVal = 0.12, delay = 0) {
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqFrom, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqTo), t0 + duration);
    gain.gain.setValueAtTime(gainVal, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  return {
    jump() {
      sweep(300, 700, 0.18, 'square', 0.12);
    },
    stomp() {
      sweep(220, 90, 0.12, 'square', 0.14);
    },
    coin() {
      tone(988, 0.09, 'square', 0.1);
      tone(1319, 0.28, 'square', 0.1, 0.09);
    },
    pipeEnter() {
      // Deep, unmistakable NES-style descending pipe cue.
      sweep(420, 82, 0.55, 'square', 0.22);
      tone(92, 0.22, 'triangle', 0.16, 0.2);
      tone(58, 0.18, 'square', 0.12, 0.36);
    },
    pipeExit() {
      // Bright ascending answer when the character pops back out.
      sweep(92, 760, 0.55, 'square', 0.22);
      tone(520, 0.16, 'triangle', 0.16, 0.22);
      tone(980, 0.2, 'square', 0.12, 0.38);
    },
    bump() {
      tone(120, 0.08, 'square', 0.12);
    },
    breakBlock() {
      [180, 140, 100].forEach((f, i) => tone(f, 0.08, 'square', 0.1, i * 0.03));
    },
    powerup() {
      [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.12, 'square', 0.1, i * 0.1));
    },
    // the DeLorean hitting 88 mph and vanishing in a flash of light
    timeJump() {
      // Layer a deep engine rumble under the rising time-machine whine so
      // the take-off reads as a powerful launch instead of a small blip.
      sweep(48, 34, 1.75, 'sawtooth', 0.24);
      tone(62, 1.15, 'triangle', 0.18, 0.04);
      sweep(80, 60, 0.75, 'sawtooth', 0.2);
      sweep(140, 2600, 1.3, 'sawtooth', 0.2, 0.03);
      sweep(300, 2200, 1.05, 'sine', 0.16, 0.08);
      tone(2400, 0.5, 'sine', 0.13, 0.98);
    },
    fanfare() {
      [660, 660, 660, 510, 660, 770].forEach((f, i) => tone(f, 0.14, 'square', 0.1, i * 0.14));
      tone(880, 0.5, 'square', 0.1, 0.95);
    },
    flagpole() {
      [392, 523, 659, 784].forEach((f, i) => tone(f, 0.1, 'square', 0.11, i * 0.08));
      tone(1047, 0.22, 'square', 0.1, 0.34);
    },
    // Marty/Doc throwing a fireball underwater
    fireball() {
      sweep(950, 320, 0.14, 'sawtooth', 0.1);
    },
    // the DeLorean's gull-wing doors clunking shut before takeoff
    doorClose() {
      tone(150, 0.05, 'square', 0.14);
      tone(90, 0.1, 'square', 0.16, 0.05);
    },
  };
})();
