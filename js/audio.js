let ctx = null;
let enabled = true;

export function setSound(on) { enabled = on; }

/** Shared AudioContext (sound effects + music). Browsers only let it run after a user gesture. */
export function ac() {
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// Unlock audio on user interaction. iOS Safari only accepts touchend/click as activation and
// needs a sound started inside the gesture; keep listening until the context really runs.
const UNLOCK_EVENTS = ['touchend', 'click', 'pointerdown', 'keydown'];
function unlock() {
  const c = ac();
  if (!c) return;
  const src = c.createBufferSource();
  src.buffer = c.createBuffer(1, 1, 22050);
  src.connect(c.destination);
  src.start(0);
  if (c.state === 'running') for (const ev of UNLOCK_EVENTS) removeEventListener(ev, unlock, true);
}
for (const ev of UNLOCK_EVENTS) addEventListener(ev, unlock, true);

function tone(freq, dur = 0.12, type = 'sine', vol = 0.12, at = 0, slideTo = null) {
  if (!enabled) return;
  const c = ac();
  if (!c) return;
  const t = c.currentTime + at;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + dur + 0.03);
}

const seq = (notes, step, type, vol, dur) => notes.forEach((f, i) => tone(f, dur, type, vol, i * step));

export const sfx = {
  click: () => tone(660, 0.05, 'triangle', 0.05),
  tick: () => tone(880, 0.09, 'triangle', 0.08),
  right: () => seq([523, 659, 784, 1047], 0.07, 'triangle', 0.1, 0.14),
  wrong: () => tone(220, 0.28, 'sawtooth', 0.05, 0, 110),
  laser: () => tone(1400, 0.18, 'square', 0.035, 0, 180),
  hit: () => tone(140, 0.4, 'sawtooth', 0.08, 0, 40),
  win: () => seq([523, 659, 784, 659, 784, 1047], 0.12, 'triangle', 0.11, 0.2),
  lose: () => seq([392, 330, 262], 0.18, 'triangle', 0.1, 0.25),
  hatch: () => seq([784, 988, 1175, 1568], 0.09, 'sine', 0.12, 0.18),
  coin: () => { tone(988, 0.08, 'square', 0.04); tone(1319, 0.16, 'square', 0.04, 0.08); },
};
