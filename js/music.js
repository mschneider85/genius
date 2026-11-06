// Generative Hintergrundmusik – komplett mit WebAudio erzeugt, keine Audiodateien nötig.
import { ac } from './audio.js';

const mtof = (m) => 440 * 2 ** ((m - 69) / 12);

const TRACKS = {
  // Weltall: ruhig, schwebend, mit Echo
  space: {
    bpm: 66, bars: 2, vol: 0.9, delay: 0.75,
    chords: [
      { root: 45, notes: [57, 60, 64, 67, 71] }, // Am9
      { root: 41, notes: [57, 60, 64, 65, 69] }, // Fmaj7
      { root: 48, notes: [55, 59, 64, 67, 72] }, // Cmaj7
      { root: 43, notes: [55, 59, 62, 64, 67] }, // G6
    ],
    pad: { vol: 0.02, cutoff: 900 },
    arp: { div: 2, prob: 0.42, oct: 12, wave: 'triangle', vol: 0.045, len: 3 },
    bass: { every: 8, wave: 'sine', vol: 0.09 },
  },
  // Planetenoberfläche: freundlich, beschwingt
  planet: {
    bpm: 100, bars: 1, vol: 0.8, delay: 0.5,
    chords: [
      { root: 48, notes: [60, 64, 67, 72] }, // C
      { root: 45, notes: [57, 60, 64, 69] }, // Am
      { root: 41, notes: [57, 60, 65, 69] }, // F
      { root: 43, notes: [55, 59, 62, 67] }, // G
    ],
    pad: { vol: 0.01, cutoff: 1400 },
    arp: { div: 1, prob: 0.8, oct: 12, wave: 'triangle', vol: 0.035, len: 1.4, pattern: 'updown' },
    bass: { every: 4, wave: 'sine', vol: 0.08 },
    hat: { every: 4, offset: 2, vol: 0.018 },
  },
  // Bosskampf: treibend
  boss: {
    bpm: 132, bars: 1, vol: 0.75, delay: 0.25,
    chords: [
      { root: 38, notes: [62, 65, 69, 74] }, // Dm
      { root: 34, notes: [62, 65, 70, 74] }, // Bb
      { root: 36, notes: [64, 67, 72, 76] }, // C
      { root: 33, notes: [61, 64, 69, 73] }, // A
    ],
    arp: { div: 2, prob: 0.85, oct: 0, wave: 'square', vol: 0.02, len: 1, pattern: 'updown' },
    bass: { every: 2, wave: 'sawtooth', vol: 0.045, cutoff: 600 },
    hat: { every: 2, offset: 1, vol: 0.022 },
    kick: { every: 4, vol: 0.3 },
  },
};

let enabled = true;
let wanted = null;
let cur = null;
let noise = null;

export function setMusic(on) {
  enabled = on;
  if (!on) stop();
  else if (wanted) start(wanted);
}

/** Switch to a track ('space' | 'planet' | 'boss'); crossfades, no-op if already playing. */
export function music(name) {
  wanted = name;
  if (!enabled || cur?.name === name) return;
  start(name);
}

function start(name) {
  const c = ac();
  if (!c) return;
  stop();
  const t = TRACKS[name];
  const out = c.createGain();
  out.gain.setValueAtTime(0.0001, c.currentTime);
  out.gain.exponentialRampToValueAtTime(t.vol, c.currentTime + 2.5);
  out.connect(c.destination);
  const stepDur = 60 / t.bpm / 4;
  const delay = c.createDelay(2);
  delay.delayTime.value = stepDur * 4 * t.delay;
  const fb = c.createGain();
  fb.gain.value = 0.32;
  const wet = c.createGain();
  wet.gain.value = 0.35;
  delay.connect(fb).connect(delay);
  delay.connect(wet).connect(out);
  const track = { name, t, out, delay, step: 0, next: c.currentTime + 0.15, stepDur };
  track.timer = setInterval(() => schedule(track), 40);
  cur = track;
}

function stop() {
  if (!cur) return;
  const c = ac();
  clearInterval(cur.timer);
  const g = cur.out.gain;
  g.cancelScheduledValues(c.currentTime);
  g.setValueAtTime(Math.max(0.0001, g.value), c.currentTime);
  g.exponentialRampToValueAtTime(0.0001, c.currentTime + 1.2);
  const out = cur.out;
  setTimeout(() => out.disconnect(), 1500);
  cur = null;
}

function schedule(tr) {
  const c = ac();
  if (c.state !== 'running') { tr.next = c.currentTime + 0.15; return; }
  if (tr.next < c.currentTime) tr.next = c.currentTime + 0.05; // tab was in background
  while (tr.next < c.currentTime + 0.2) {
    playStep(tr, tr.step, tr.next);
    tr.step++;
    tr.next += tr.stepDur;
  }
}

function playStep(tr, s, time) {
  const t = tr.t;
  const per = t.bars * 16;
  const chord = t.chords[Math.floor(s / per) % t.chords.length];
  const pos = s % per;
  if (t.pad && pos === 0) pad(tr, chord.notes.slice(0, 4), time, per * tr.stepDur);
  if (t.bass && s % t.bass.every === 0) {
    voice(tr, chord.root, time, tr.stepDur * t.bass.every * 0.9, t.bass.wave, t.bass.vol, false, t.bass.cutoff);
  }
  if (t.arp && s % t.arp.div === 0 && Math.random() < t.arp.prob) {
    const n = chord.notes;
    const k = s / t.arp.div;
    const idx = t.arp.pattern === 'updown' ? [0, 1, 2, 3, 2, 1][k % 6] % n.length : Math.floor(Math.random() * n.length);
    voice(tr, n[idx] + t.arp.oct, time, tr.stepDur * t.arp.div * t.arp.len, t.arp.wave, t.arp.vol, true);
  }
  if (t.hat && s % t.hat.every === t.hat.offset % t.hat.every) hat(tr, time, t.hat.vol);
  if (t.kick && s % t.kick.every === 0) kick(tr, time, t.kick.vol);
}

function voice(tr, midi, time, dur, wave, vol, echo, cutoff) {
  const c = ac();
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = wave;
  o.frequency.setValueAtTime(mtof(midi), time);
  g.gain.setValueAtTime(0.0001, time);
  g.gain.exponentialRampToValueAtTime(vol, time + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
  let node = o;
  if (cutoff) {
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = cutoff;
    node = o.connect(f);
  }
  node.connect(g).connect(tr.out);
  if (echo) g.connect(tr.delay);
  o.start(time);
  o.stop(time + dur + 0.05);
}

function pad(tr, notes, time, dur) {
  const c = ac();
  const p = tr.t.pad;
  const f = c.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = p.cutoff;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, time);
  g.gain.exponentialRampToValueAtTime(1, time + Math.min(1.2, dur * 0.4));
  g.gain.setValueAtTime(1, time + dur * 0.75);
  g.gain.exponentialRampToValueAtTime(0.0001, time + dur + 0.6);
  f.connect(g).connect(tr.out);
  for (const m of notes) {
    for (const detune of [-7, 7]) {
      const o = c.createOscillator();
      const v = c.createGain();
      o.type = 'sawtooth';
      o.frequency.value = mtof(m);
      o.detune.value = detune;
      v.gain.value = p.vol;
      o.connect(v).connect(f);
      o.start(time);
      o.stop(time + dur + 0.7);
    }
  }
}

function hat(tr, time, vol) {
  const c = ac();
  if (!noise) {
    noise = c.createBuffer(1, c.sampleRate * 0.1, c.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const src = c.createBufferSource();
  src.buffer = noise;
  const f = c.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = 7000;
  const g = c.createGain();
  g.gain.setValueAtTime(vol, time);
  g.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);
  src.connect(f).connect(g).connect(tr.out);
  src.start(time);
  src.stop(time + 0.06);
}

function kick(tr, time, vol) {
  const c = ac();
  const o = c.createOscillator();
  const g = c.createGain();
  o.frequency.setValueAtTime(130, time);
  o.frequency.exponentialRampToValueAtTime(40, time + 0.15);
  g.gain.setValueAtTime(vol, time);
  g.gain.exponentialRampToValueAtTime(0.0001, time + 0.25);
  o.connect(g).connect(tr.out);
  o.start(time);
  o.stop(time + 0.3);
}
