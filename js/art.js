// Prozedurale Grafik: Planeten, Schiffe, Kometen, Kristalle, Truhen, Nebel und Landschafts-Bauwerke.
// Teure Pixel-Texturen werden einmal erzeugt, im Speicher gehalten und in der Cache Storage abgelegt,
// damit spätere Starts sie nur noch laden (wichtig für ältere iPads).
import { seeded } from './util.js';

const ART_CACHE = 'genius-art-v1';
const mem = new Map(); // key → canvas | HTMLImageElement

export function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

/* ------------------------------------------------------------------ */
/* Rauschen                                                            */
/* ------------------------------------------------------------------ */

function makeNoise(seed) {
  const r = seeded(seed);
  const perm = new Uint8Array(512);
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const val = new Float32Array(256).map(() => r());
  const fade = (t) => t * t * (3 - 2 * t);
  const noise = (x, y) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = fade(x - xi);
    const yf = fade(y - yi);
    const X = xi & 255;
    const Y = yi & 255;
    const a = val[perm[perm[X] + Y]];
    const b = val[perm[perm[X + 1] + Y]];
    const c = val[perm[perm[X] + Y + 1]];
    const d = val[perm[perm[X + 1] + Y + 1]];
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
  };
  return (x, y, oct = 5) => {
    let s = 0;
    let amp = 0.5;
    let f = 1;
    for (let i = 0; i < oct; i++) { s += amp * noise(x * f, y * f); f *= 2.03; amp *= 0.5; }
    return s / (1 - 0.5 ** oct);
  };
}

const mix = (a, b, t) => a + (b - a) * t;
const mix3 = (c1, c2, t) => [mix(c1[0], c2[0], t), mix(c1[1], c2[1], t), mix(c1[2], c2[2], t)];
const clamp01 = (x) => Math.max(0, Math.min(1, x));

/* ------------------------------------------------------------------ */
/* Planeten                                                            */
/* ------------------------------------------------------------------ */

export const PLANET_TYPES = {
  pyramid: 'desert', sequence: 'ice', asteroid: 'rock', scale: 'moon', binary: 'tech',
  magic: 'jungle', fraction: 'ocean', builder: 'mesa', duel: 'lava', fortress: 'lava',
};
const ATMO = { desert: '255,190,120', ice: '170,220,255', rock: '200,170,140', moon: '200,210,230', tech: '90,255,170', jungle: '200,120,255', ocean: '120,190,255', mesa: '255,140,90', lava: '255,80,60' };
const RINGED = { ice: true, rock: true };

function surface(type, n, n2, u, v, craters) {
  let c;
  switch (type) {
    case 'desert': c = mix3([226, 186, 122], [150, 96, 52], clamp01(n * 1.3 - 0.15)); { const s = Math.sin(v * 46 + n * 9) * 9; c = [c[0] + s, c[1] + s, c[2] + s * 0.6]; } break;
    case 'ice': c = mix3([238, 246, 255], [130, 185, 230], clamp01((n - 0.35) * 2)); if (Math.abs(n2 - 0.5) < 0.018) c = [80, 130, 185]; break;
    case 'rock': c = mix3([132, 116, 104], [64, 56, 52], clamp01(n * 1.4 - 0.2)); break;
    case 'moon': c = mix3([196, 198, 206], [104, 106, 118], clamp01(n * 1.4 - 0.2)); break;
    case 'tech': {
      c = mix3([70, 78, 96], [36, 40, 52], n);
      const gu = (u * 26) % 1;
      const gv = (v * 18) % 1;
      if (gu < 0.06 || gv < 0.06) c = [104, 116, 140];
      break;
    }
    case 'jungle': c = mix3([46, 128, 84], [96, 44, 132], clamp01(n * 1.6 - 0.3)); if (n2 > 0.72) c = mix3(c, [210, 140, 255], (n2 - 0.72) * 3); break;
    case 'ocean': c = n < 0.52 ? mix3([40, 96, 176], [18, 46, 110], clamp01((0.52 - n) * 4)) : mix3([200, 168, 104], [70, 132, 64], clamp01((n - 0.52) * 4)); break;
    case 'mesa': c = mix3([212, 112, 62], [120, 46, 30], clamp01(n * 1.3 - 0.1)); { const s = Math.sin(v * 34 + n * 7) * 14; c = [c[0] + s, c[1] + s * 0.6, c[2] + s * 0.4]; } break;
    case 'lava': c = mix3([58, 34, 32], [22, 14, 16], n); break;
    default: c = [128, 128, 128];
  }
  if (craters) {
    for (const k of craters) {
      const d = Math.hypot(u - k.u, (v - k.v) * 1.8) / k.r;
      if (d < 0.85) c = [c[0] * 0.78, c[1] * 0.78, c[2] * 0.78];
      else if (d < 1) c = [c[0] * 1.15, c[1] * 1.15, c[2] * 1.15];
    }
  }
  return c;
}

/**
 * Paint a lit planet. opts: { type, seed, stage (0 damaged | 1 | 2 shining), locked, radius px }
 * Returns a square canvas (3.2 × radius) with the planet centred, incl. atmosphere and rings.
 */
export function paintPlanet({ type, seed, stage = 1, locked = false, radius = 110 }) {
  const R = Math.round(radius);
  const size = Math.round(R * 3.2);
  const out = canvas(size, size);
  const ctx = out.getContext('2d');
  const cx = size / 2;
  const fbm = makeNoise(seed);
  const fbm2 = makeNoise(seed + 'b');
  const rnd = seeded(seed + 'c');
  const craters = type === 'rock' || type === 'moon'
    ? Array.from({ length: 14 }, () => ({ u: rnd(), v: rnd(), r: 0.02 + rnd() * 0.06 }))
    : null;

  // disc into its own canvas (putImageData ignores compositing)
  const disc = canvas(R * 2, R * 2);
  const dctx = disc.getContext('2d');
  const img = dctx.createImageData(R * 2, R * 2);
  const L = [-0.55, -0.5, 0.67];
  const ln = Math.hypot(...L);
  const lx = L[0] / ln;
  const ly = L[1] / ln;
  const lz = L[2] / ln;
  const d = img.data;
  for (let y = 0; y < R * 2; y++) {
    for (let x = 0; x < R * 2; x++) {
      const nx = (x - R + 0.5) / R;
      const ny = (y - R + 0.5) / R;
      const rr = nx * nx + ny * ny;
      if (rr > 1) continue;
      const nz = Math.sqrt(1 - rr);
      const u = Math.atan2(nx, nz) / (Math.PI * 2) + 0.5;
      const v = Math.asin(ny) / Math.PI + 0.5;
      const n = fbm(u * 6, v * 4);
      const n2 = fbm2(u * 9, v * 6, 3);
      let c = surface(type, n, n2, u, v, craters);
      const diff = Math.max(0, nx * lx + ny * ly + nz * lz);
      let shade = 0.1 + diff * 1.05;
      if (type === 'ocean' && n < 0.52) shade += Math.pow(diff, 24) * 0.9;
      if (type === 'ice') shade += Math.pow(diff, 30) * 0.5;
      c = [c[0] * shade, c[1] * shade, c[2] * shade];
      // emissive: city lights on the night side, glowing lava cracks
      if (type === 'tech' && diff < 0.25 && fbm2(u * 40, v * 30, 2) > 0.62) c = mix3(c, [140, 255, 190], 0.85);
      if (type === 'lava' && Math.abs(n2 - 0.5) < 0.045) c = mix3(c, [255, 120, 30], 0.9);
      if (stage === 0 && !locked) {
        const storm = clamp01((fbm2(u * 5 + 3, v * 4 + 1, 4) - 0.5) * 3);
        const g = (c[0] + c[1] + c[2]) / 3;
        c = mix3(mix3(c, [g, g, g], 0.5), [120 * shade, 60 * shade, 190 * shade], storm * 0.75);
      }
      if (locked) { const g = (c[0] + c[1] + c[2]) / 3; c = mix3(c, [g * 0.7, g * 0.7, g * 0.75], 0.85); }
      // soft limb darkening
      const limb = 0.75 + 0.25 * nz;
      const i = (y * R * 2 + x) * 4;
      d[i] = c[0] * limb;
      d[i + 1] = c[1] * limb;
      d[i + 2] = c[2] * limb;
      d[i + 3] = rr > 0.985 ? 255 * (1 - (rr - 0.985) / 0.015) : 255;
    }
  }
  dctx.putImageData(img, 0, 0);

  const atmo = ATMO[type] || '200,200,255';
  const ring = (front) => {
    if (!RINGED[type]) return;
    ctx.save();
    ctx.translate(cx, cx);
    ctx.rotate(-0.32);
    ctx.scale(1, 0.3);
    ctx.beginPath();
    ctx.rect(-size, front ? 0 : -size, size * 2, size);
    ctx.clip();
    for (let k = 0; k < 7; k++) {
      ctx.strokeStyle = `rgba(${type === 'ice' ? '210,230,255' : '200,180,150'},${0.18 + (k % 3) * 0.1})`;
      ctx.lineWidth = R * 0.05;
      ctx.beginPath();
      ctx.arc(0, 0, R * (1.3 + k * 0.06), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  };
  ring(false);
  // atmosphere glow behind the disc
  const glow = ctx.createRadialGradient(cx, cx, R * 0.9, cx, cx, R * 1.32);
  glow.addColorStop(0, `rgba(${atmo},${locked ? 0.15 : 0.55})`);
  glow.addColorStop(1, `rgba(${atmo},0)`);
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(disc, cx - R, cx - R);
  // lit rim
  ctx.globalCompositeOperation = 'lighter';
  const rim = ctx.createRadialGradient(cx + R * 0.25, cx + R * 0.25, R * 0.75, cx, cx, R * 1.02);
  rim.addColorStop(0, 'rgba(0,0,0,0)');
  rim.addColorStop(1, `rgba(${atmo},${locked ? 0.08 : 0.35})`);
  ctx.fillStyle = rim;
  ctx.beginPath();
  ctx.arc(cx, cx, R, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  ring(true);
  return out;
}

/* ------------------------------------------------------------------ */
/* Kleine Sprites                                                      */
/* ------------------------------------------------------------------ */

const SHIP_STYLE = {
  '🚀': { shape: 'rocket', hull: ['#f4f6fb', '#9aa3b8'], accent: '#e63946' },
  '🛸': { shape: 'saucer', hull: ['#dfe6f0', '#6f7c92'], accent: '#4cc9f0' },
  '🛰️': { shape: 'fighter', hull: ['#e6e6e6', '#7d7d86'], accent: '#ffd166' },
  '🐉': { shape: 'fighter', hull: ['#e2533f', '#7a1d12'], accent: '#ffd23f' },
  '🦄': { shape: 'fighter', hull: ['#fff0fb', '#c79bd6'], accent: '#ff7ad9' },
  '🐳': { shape: 'rocket', hull: ['#6aa6e0', '#1f4f86'], accent: '#bfe8ff' },
  '🦖': { shape: 'fighter', hull: ['#58b05c', '#1f5c23'], accent: '#d4ff6b' },
  '🌠': { shape: 'saucer', hull: ['#ffe39a', '#c58b12'], accent: '#ffffff' },
  '☄️': { shape: 'fighter', hull: ['#c9fbff', '#4a9fb5'], accent: '#7a5cff' },
};

/** Spaceship pointing to +x, 160×120. */
export function paintShip(id) {
  const key = 'ship:' + id;
  if (mem.has(key)) return mem.get(key);
  const st = SHIP_STYLE[id] || SHIP_STYLE['🚀'];
  const c = canvas(160, 120);
  const x = c.getContext('2d');
  x.translate(80, 60);
  const hull = x.createLinearGradient(0, -40, 0, 40);
  hull.addColorStop(0, st.hull[0]);
  hull.addColorStop(1, st.hull[1]);
  const glass = x.createRadialGradient(-4, -8, 2, 0, -4, 18);
  glass.addColorStop(0, '#e9fbff');
  glass.addColorStop(0.4, '#5fc7ff');
  glass.addColorStop(1, '#0d3a6a');
  x.lineWidth = 2;
  x.strokeStyle = 'rgba(0,0,0,0.35)';
  if (st.shape === 'rocket') {
    x.fillStyle = st.accent;
    for (const s of [-1, 1]) { x.beginPath(); x.moveTo(-30, s * 12); x.lineTo(-56, s * 34); x.lineTo(-44, s * 8); x.closePath(); x.fill(); x.stroke(); }
    x.fillStyle = hull;
    x.beginPath(); x.ellipse(0, 0, 60, 18, 0, 0, Math.PI * 2); x.fill(); x.stroke();
    x.fillStyle = st.accent;
    x.beginPath(); x.moveTo(44, -11); x.quadraticCurveTo(70, 0, 44, 11); x.closePath(); x.fill();
    x.fillStyle = glass;
    x.beginPath(); x.ellipse(18, -2, 12, 8, 0, 0, Math.PI * 2); x.fill(); x.stroke();
  } else if (st.shape === 'saucer') {
    x.fillStyle = glass;
    x.beginPath(); x.ellipse(0, -10, 24, 20, 0, Math.PI, 0); x.fill(); x.stroke();
    x.fillStyle = hull;
    x.beginPath(); x.ellipse(0, 2, 62, 16, 0, 0, Math.PI * 2); x.fill(); x.stroke();
    x.fillStyle = st.accent;
    for (let i = -3; i <= 3; i++) { x.beginPath(); x.arc(i * 15, 6, 3.5, 0, Math.PI * 2); x.fill(); }
  } else {
    x.fillStyle = hull;
    x.beginPath(); x.moveTo(66, 0); x.lineTo(-10, -16); x.lineTo(-40, -44); x.lineTo(-52, -40); x.lineTo(-36, -12); x.lineTo(-50, 0);
    x.lineTo(-36, 12); x.lineTo(-52, 40); x.lineTo(-40, 44); x.lineTo(-10, 16); x.closePath(); x.fill(); x.stroke();
    x.fillStyle = st.accent;
    x.beginPath(); x.moveTo(-40, -44); x.lineTo(-52, -40); x.lineTo(-30, -30); x.closePath(); x.fill();
    x.beginPath(); x.moveTo(-40, 44); x.lineTo(-52, 40); x.lineTo(-30, 30); x.closePath(); x.fill();
    x.fillStyle = glass;
    x.beginPath(); x.ellipse(20, 0, 16, 7, 0, 0, Math.PI * 2); x.fill(); x.stroke();
  }
  // engine nozzle
  x.fillStyle = '#3a3f4c';
  x.fillRect(st.shape === 'saucer' ? -66 : -66, -7, 10, 14);
  mem.set(key, c);
  return c;
}

export function paintComet() {
  if (mem.has('comet')) return mem.get('comet');
  const c = canvas(96, 96);
  const x = c.getContext('2d');
  const fbm = makeNoise('comet');
  const img = x.createImageData(96, 96);
  for (let y = 0; y < 96; y++) {
    for (let i = 0; i < 96; i++) {
      const nx = (i - 48) / 34;
      const ny = (y - 48) / 30;
      const n = fbm(i / 14, y / 14, 4);
      const rr = nx * nx + ny * ny;
      if (rr > 0.75 + n * 0.5) continue;
      const shade = 0.55 + 0.6 * clamp01(1 - (nx + 0.6) * (nx + 0.6) - (ny + 0.6) * (ny + 0.6));
      const k = (y * 96 + i) * 4;
      img.data[k] = (170 + n * 60) * shade;
      img.data[k + 1] = (205 + n * 40) * shade;
      img.data[k + 2] = (230 + n * 25) * shade;
      img.data[k + 3] = 255;
    }
  }
  x.putImageData(img, 0, 0);
  mem.set('comet', c);
  return c;
}

export function paintShard() {
  if (mem.has('shard')) return mem.get('shard');
  const c = canvas(64, 64);
  const x = c.getContext('2d');
  x.translate(32, 32);
  const facets = [[0, -28, 14, -6, 0, 0, '#e8fdff'], [14, -6, 0, 28, 0, 0, '#5fd3f0'], [0, 28, -14, -6, 0, 0, '#2a8fbf'], [-14, -6, 0, -28, 0, 0, '#a8efff']];
  for (const [a, b, cc, dd, e, f, col] of facets) {
    x.fillStyle = col;
    x.beginPath(); x.moveTo(a, b); x.lineTo(cc, dd); x.lineTo(e, f); x.closePath(); x.fill();
  }
  x.strokeStyle = 'rgba(255,255,255,0.8)';
  x.lineWidth = 1.5;
  x.beginPath(); x.moveTo(0, -28); x.lineTo(14, -6); x.lineTo(0, 28); x.lineTo(-14, -6); x.closePath(); x.stroke();
  mem.set('shard', c);
  return c;
}

export function paintChest() {
  if (mem.has('chest')) return mem.get('chest');
  const c = canvas(96, 84);
  const x = c.getContext('2d');
  const wood = x.createLinearGradient(0, 20, 0, 80);
  wood.addColorStop(0, '#9b5a2b');
  wood.addColorStop(1, '#4e2810');
  x.fillStyle = wood;
  x.beginPath();
  if (x.roundRect) x.roundRect(10, 34, 76, 44, 6); else x.rect(10, 34, 76, 44);
  x.fill();
  const lid = x.createLinearGradient(0, 8, 0, 36);
  lid.addColorStop(0, '#b56c35');
  lid.addColorStop(1, '#6a3716');
  x.fillStyle = lid;
  x.beginPath(); x.moveTo(10, 36); x.quadraticCurveTo(48, 0, 86, 36); x.closePath(); x.fill();
  x.fillStyle = '#ffd166';
  for (const bx of [22, 70]) { x.fillRect(bx - 4, 18, 8, 60); }
  x.fillRect(10, 34, 76, 6);
  x.fillStyle = '#fff3c4';
  x.fillRect(42, 40, 12, 14);
  x.fillStyle = '#5a3a00';
  x.fillRect(46, 45, 4, 6);
  mem.set('chest', c);
  return c;
}

export function paintBeacon() {
  if (mem.has('beacon')) return mem.get('beacon');
  const c = canvas(64, 64);
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 4, 32, 32, 30);
  g.addColorStop(0, '#fff7c2');
  g.addColorStop(0.6, '#ffb703');
  g.addColorStop(1, 'rgba(255,183,3,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  x.fillStyle = '#3a2400';
  x.font = '900 34px system-ui, sans-serif';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillText('!', 32, 34);
  mem.set('beacon', c);
  return c;
}

/** Space station (Werft), 2r×2r footprint inside a 3.2r canvas like planets. */
export function paintStation(R) {
  const size = Math.round(R * 3.2);
  const c = canvas(size, size);
  const x = c.getContext('2d');
  x.translate(size / 2, size / 2);
  // solar panels
  for (const s of [-1, 1]) {
    x.fillStyle = '#1d3f7a';
    x.fillRect(s > 0 ? R * 0.75 : -R * 1.45, -R * 0.32, R * 0.7, R * 0.64);
    x.strokeStyle = '#7fb2ff';
    x.lineWidth = 2;
    for (let k = 1; k < 4; k++) {
      const xx = (s > 0 ? R * 0.75 : -R * 1.45) + (k * R * 0.7) / 4;
      x.beginPath(); x.moveTo(xx, -R * 0.32); x.lineTo(xx, R * 0.32); x.stroke();
    }
    x.fillStyle = '#8c95ab';
    x.fillRect(s > 0 ? R * 0.45 : -R * 0.75, -R * 0.06, R * 0.3, R * 0.12);
  }
  // ring
  x.strokeStyle = '#c3cadb';
  x.lineWidth = R * 0.12;
  x.beginPath(); x.ellipse(0, 0, R * 0.62, R * 0.62, 0, 0, Math.PI * 2); x.stroke();
  x.strokeStyle = 'rgba(255,255,255,0.4)';
  x.lineWidth = R * 0.03;
  x.stroke();
  // hub
  const hub = x.createRadialGradient(-R * 0.15, -R * 0.15, 2, 0, 0, R * 0.36);
  hub.addColorStop(0, '#ffffff');
  hub.addColorStop(1, '#5b6390');
  x.fillStyle = hub;
  x.beginPath(); x.arc(0, 0, R * 0.34, 0, Math.PI * 2); x.fill();
  x.fillStyle = '#7ad7ff';
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    x.beginPath(); x.arc(Math.cos(a) * R * 0.62, Math.sin(a) * R * 0.62, R * 0.035, 0, Math.PI * 2); x.fill();
  }
  return c;
}

/** Colourful cloudy nebula sprite. */
export function paintNebula(seed, hueA, hueB) {
  const S = 256;
  const c = canvas(S, S);
  const x = c.getContext('2d');
  const fbm = makeNoise('neb' + seed);
  const img = x.createImageData(S, S);
  const ca = hslRgb(hueA, 0.7, 0.55);
  const cb = hslRgb(hueB, 0.7, 0.5);
  for (let y = 0; y < S; y++) {
    for (let i = 0; i < S; i++) {
      const dx = (i - S / 2) / (S / 2);
      const dy = (y - S / 2) / (S / 2);
      const fall = clamp01(1 - Math.sqrt(dx * dx + dy * dy));
      const n = fbm(i / 48, y / 48, 5);
      const a = clamp01((n - 0.38) * 2.2) * fall * fall;
      if (a <= 0) continue;
      const col = mix3(ca, cb, clamp01(fbm(i / 90 + 7, y / 90, 3)));
      const k = (y * S + i) * 4;
      img.data[k] = col[0];
      img.data[k + 1] = col[1];
      img.data[k + 2] = col[2];
      img.data[k + 3] = a * 255;
    }
  }
  x.putImageData(img, 0, 0);
  return c;
}

function hslRgb(h, s, l) {
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}

/* ------------------------------------------------------------------ */
/* Persistenter Cache für teure Texturen                               */
/* ------------------------------------------------------------------ */

/**
 * Returns a cached image for `key` or paints it with `paint()` (and stores it for the next start).
 * Resolves to a canvas or loaded image element.
 */
export async function cachedArt(key, paint) {
  if (mem.has(key)) return mem.get(key);
  const url = new URL(`./__art/${encodeURIComponent(key)}.png`, location.href).href;
  try {
    const cache = await caches.open(ART_CACHE);
    const hit = await cache.match(url);
    if (hit) {
      const img = await blobToImage(await hit.blob());
      mem.set(key, img);
      return img;
    }
    const c = paint();
    mem.set(key, c);
    c.toBlob((blob) => { if (blob) cache.put(url, new Response(blob, { headers: { 'Content-Type': 'image/png' } })); }, 'image/png');
    return c;
  } catch {
    const c = paint(); // no Cache Storage (e.g. private mode): paint only
    mem.set(key, c);
    return c;
  }
}

function blobToImage(blob) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = reject;
    img.src = url;
  });
}

/** Run a list of async jobs one by one with a breather in between (keeps old iPads responsive). */
export async function idleQueue(jobs) {
  for (const job of jobs) {
    await new Promise((r) => (window.requestIdleCallback ? requestIdleCallback(r, { timeout: 120 }) : setTimeout(r, 16)));
    await job();
  }
}

/* ------------------------------------------------------------------ */
/* Bauwerke & Pflanzen für die Planetenlandschaften                    */
/* ------------------------------------------------------------------ */

// Drawing space 120×160, ground at y=160, light from the upper left. Returned as a PNG data URL.
const PROP_W = 120;
const PROP_H = 160;
const PS = 2; // resolution scale

const hgrad = (x, x0, x1, a, b) => { const g = x.createLinearGradient(x0, 0, x1, 0); g.addColorStop(0, a); g.addColorStop(1, b); return g; };
const vgrad = (x, y0, y1, a, b) => { const g = x.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, a); g.addColorStop(1, b); return g; };
const poly = (x, pts, fill) => { x.fillStyle = fill; x.beginPath(); x.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) x.lineTo(pts[i], pts[i + 1]); x.closePath(); x.fill(); };
const ell = (x, cx, cy, rx, ry, fill) => { x.fillStyle = fill; x.beginPath(); x.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); x.fill(); };
const rect = (x, a, b, w, hh, fill) => { x.fillStyle = fill; x.fillRect(a, b, w, hh); };
const rr = (x, a, b, w, hh, r) => { x.beginPath(); if (x.roundRect) x.roundRect(a, b, w, hh, r); else x.rect(a, b, w, hh); x.fill(); };
const glowDot = (x, cx, cy, r, col) => { const g = x.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(cx - r, cy - r, r * 2, r * 2); };
const windows = (x, x0, y0, cols, rows, w, hh, gap, lit) => {
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) rect(x, x0 + c * (w + gap), y0 + r * (hh + gap), w, hh, (r * 7 + c * 3) % 4 ? lit : 'rgba(20,30,50,0.9)');
};

const PROPS = {
  pyramid: (x) => {
    poly(x, [8, 158, 62, 34, 74, 158], hgrad(x, 8, 74, '#f3d39a', '#c99a55'));
    poly(x, [74, 158, 62, 34, 114, 150], hgrad(x, 62, 114, '#a8763d', '#6d4a24'));
    x.strokeStyle = 'rgba(80,50,20,0.35)'; x.lineWidth = 1;
    for (let y = 60; y < 158; y += 14) { x.beginPath(); x.moveTo(62 - (y - 34) * 0.44, y); x.lineTo(62 + (y - 34) * 0.1, y); x.stroke(); }
  },
  obelisk: (x) => { poly(x, [48, 158, 52, 40, 60, 26, 60, 158], hgrad(x, 48, 60, '#e9d3a8', '#c4a26c')); poly(x, [60, 158, 60, 26, 68, 40, 72, 158], '#8e6d3f'); },
  palm: (x) => {
    x.strokeStyle = hgrad(x, 50, 70, '#a57a4d', '#5e3f22'); x.lineWidth = 9; x.lineCap = 'round';
    x.beginPath(); x.moveTo(58, 158); x.quadraticCurveTo(52, 100, 66, 50); x.stroke();
    for (const [dx, dy] of [[-44, 10], [-30, -18], [0, -26], [30, -16], [42, 14]]) {
      x.fillStyle = dy < 0 ? '#3f9b4a' : '#2d7336';
      x.beginPath(); x.moveTo(66, 50); x.quadraticCurveTo(66 + dx * 0.5, 50 + dy - 14, 66 + dx, 50 + dy + 8); x.quadraticCurveTo(66 + dx * 0.5, 50 + dy, 66, 54); x.fill();
    }
  },
  temple: (x) => {
    rect(x, 10, 146, 100, 12, '#b9a07a'); rect(x, 16, 138, 88, 8, '#d8c39c');
    for (let i = 0; i < 4; i++) rect(x, 22 + i * 22, 74, 12, 64, hgrad(x, 22 + i * 22, 34 + i * 22, '#f2e3c4', '#b49a6c'));
    rect(x, 14, 66, 92, 10, '#d8c39c'); poly(x, [12, 66, 60, 36, 108, 66], hgrad(x, 12, 108, '#f2e3c4', '#a78c5f'));
  },
  rock: (x) => { poly(x, [14, 158, 22, 118, 48, 96, 82, 104, 104, 128, 110, 158], hgrad(x, 14, 110, '#9a8c80', '#4f4640')); poly(x, [48, 96, 82, 104, 70, 120, 44, 116], 'rgba(255,255,255,0.15)'); },
  tower: (x) => {
    for (let i = 0; i < 5; i++) { const w = 60 - i * 9; rect(x, 60 - w / 2, 158 - (i + 1) * 24, w, 24, hgrad(x, 60 - w / 2, 60 + w / 2, '#e9e1f7', '#8d7fb0')); windows(x, 60 - w / 2 + 6, 164 - (i + 1) * 24, Math.max(1, Math.floor(w / 12)), 1, 6, 8, 6, '#ffe08a'); }
    poly(x, [52, 38, 60, 6, 68, 38], '#c9b6ff');
  },
  cactus: (x) => {
    const g = hgrad(x, 46, 74, '#6fcf6f', '#2e7a35');
    x.fillStyle = g; rr(x, 48, 50, 24, 108, 12);
    rr(x, 24, 84, 14, 40, 7); rr(x, 82, 70, 14, 44, 7);
    rect(x, 30, 112, 22, 12, g); rect(x, 68, 100, 22, 12, g);
  },
  castle: (x) => {
    const w = hgrad(x, 10, 110, '#d9d6e4', '#7d7894');
    rect(x, 20, 96, 80, 62, w); rect(x, 8, 66, 26, 92, w); rect(x, 86, 66, 26, 92, w);
    for (const bx of [8, 86]) for (let k = 0; k < 3; k++) rect(x, bx + k * 9, 58, 6, 8, w);
    poly(x, [6, 66, 21, 36, 36, 66], '#b23a48'); poly(x, [84, 66, 99, 36, 114, 66], '#8f2c3a');
    x.fillStyle = '#3b2f2f'; x.beginPath(); x.arc(60, 140, 12, Math.PI, 0); x.fill(); rect(x, 48, 140, 24, 18, '#3b2f2f');
  },
  crystal: (x) => {
    for (const [cx, hh, w, a] of [[44, 90, 18, -0.2], [64, 130, 22, 0.05], [84, 80, 16, 0.25]]) {
      x.save(); x.translate(cx, 158); x.rotate(a);
      poly(x, [-w / 2, 0, -w / 2, -hh + 16, 0, -hh, 0, 0], hgrad(x, -w / 2, 0, '#e6fdff', '#79d8f2'));
      poly(x, [0, 0, 0, -hh, w / 2, -hh + 16, w / 2, 0], hgrad(x, 0, w / 2, '#3fb2d9', '#1a6f99'));
      x.restore();
    }
  },
  icespire: (x) => { poly(x, [30, 158, 52, 70, 60, 18, 70, 64, 92, 158], hgrad(x, 30, 92, '#ffffff', '#8fc3e8')); poly(x, [60, 18, 70, 64, 92, 158, 64, 158], 'rgba(40,90,150,0.35)'); },
  dish: (x) => {
    rect(x, 56, 96, 8, 62, hgrad(x, 56, 64, '#c7ccd8', '#6a7186')); poly(x, [40, 158, 60, 120, 80, 158], '#8a90a3');
    x.save(); x.translate(60, 84); x.rotate(-0.5);
    x.fillStyle = vgrad(x, -30, 30, '#f4f6fb', '#9aa3b8'); x.beginPath(); x.ellipse(0, 0, 36, 14, 0, 0, Math.PI); x.fill();
    x.strokeStyle = '#6a7186'; x.lineWidth = 2; x.beginPath(); x.moveTo(0, 6); x.lineTo(0, -24); x.stroke(); glowDot(x, 0, -24, 6, 'rgba(255,80,80,1)');
    x.restore();
  },
  coral: (x) => {
    x.lineCap = 'round';
    for (const [col, w, pts] of [['#ff7f9e', 9, [60, 158, 56, 110, 40, 80, 34, 52]], ['#ff9fb6', 8, [56, 110, 76, 84, 82, 46]], ['#e85a83', 7, [60, 130, 86, 116, 98, 92]], ['#ff7f9e', 6, [40, 80, 22, 70]]]) {
      x.strokeStyle = col; x.lineWidth = w; x.beginPath(); x.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) x.lineTo(pts[i], pts[i + 1]); x.stroke();
    }
  },
  shell: (x) => {
    for (let i = 7; i > 0; i--) ell(x, 60 + i * 2, 120 - i * 3, 8 + i * 6, 6 + i * 5, i % 2 ? '#f7d9c2' : '#e4b394');
    ell(x, 60, 150, 44, 8, 'rgba(0,0,0,0.25)');
  },
  drill: (x) => {
    x.strokeStyle = '#ffb703'; x.lineWidth = 3;
    for (const s of [-1, 1]) { x.beginPath(); x.moveTo(60 + s * 26, 158); x.lineTo(60 + s * 6, 30); x.stroke(); }
    for (let y = 150; y > 40; y -= 18) { const w = 26 - ((158 - y) / 128) * 20; x.beginPath(); x.moveTo(60 - w, y); x.lineTo(60 + w, y - 18); x.stroke(); }
    rect(x, 40, 22, 40, 14, '#d0d4de'); poly(x, [54, 158, 60, 128, 66, 158], '#6a7186');
  },
  crane: (x) => {
    x.strokeStyle = '#f2b705'; x.lineWidth = 3;
    x.strokeRect(46, 30, 12, 128); for (let y = 30; y < 158; y += 12) { x.beginPath(); x.moveTo(46, y); x.lineTo(58, y + 12); x.stroke(); }
    x.strokeRect(10, 24, 108, 8); rect(x, 10, 32, 14, 12, '#5f6577');
    x.strokeStyle = '#333'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(100, 32); x.lineTo(100, 90); x.stroke(); rect(x, 92, 90, 16, 12, '#8a6a3a');
  },
  scale: (x) => {
    rect(x, 56, 50, 8, 108, hgrad(x, 56, 64, '#f6e7b8', '#a5853e')); rect(x, 36, 150, 48, 8, '#a5853e');
    rect(x, 14, 46, 92, 5, '#d8b75a');
    for (const cx of [20, 100]) { x.strokeStyle = '#a5853e'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(cx, 50); x.lineTo(cx - 12, 84); x.moveTo(cx, 50); x.lineTo(cx + 12, 84); x.stroke(); x.fillStyle = '#d8b75a'; x.beginPath(); x.ellipse(cx, 86, 16, 5, 0, 0, Math.PI); x.fill(); }
  },
  hut: (x) => { x.fillStyle = hgrad(x, 18, 102, '#e9e4f4', '#8c86a8'); x.beginPath(); x.arc(60, 158, 44, Math.PI, 0); x.fill(); rect(x, 50, 130, 20, 28, '#3e3a55'); glowDot(x, 82, 136, 8, 'rgba(255,220,140,0.9)'); },
  crate: (x) => { rect(x, 26, 104, 68, 54, hgrad(x, 26, 94, '#c48a52', '#7a4e26')); x.strokeStyle = '#5a3818'; x.lineWidth = 4; x.strokeRect(28, 106, 64, 50); x.beginPath(); x.moveTo(28, 106); x.lineTo(92, 156); x.stroke(); },
  lamp: (x) => { rect(x, 57, 50, 6, 108, '#454b5e'); rect(x, 48, 36, 24, 18, '#2c3142'); glowDot(x, 60, 46, 26, 'rgba(255,214,120,0.85)'); rect(x, 52, 40, 16, 10, '#ffe7a3'); },
  robotTower: (x) => {
    rect(x, 36, 40, 48, 118, hgrad(x, 36, 84, '#9aa6c4', '#3b4460')); windows(x, 42, 50, 3, 7, 9, 8, 5, '#7dff9a');
    rect(x, 58, 12, 4, 28, '#9aa6c4'); glowDot(x, 60, 12, 8, 'rgba(255,80,80,1)');
  },
  building: (x) => { rect(x, 24, 64, 72, 94, hgrad(x, 24, 96, '#7c8aa8', '#2c3650')); windows(x, 30, 72, 5, 7, 8, 7, 5, '#ffe08a'); },
  antenna: (x) => {
    x.strokeStyle = '#b8c0d4'; x.lineWidth = 3;
    x.beginPath(); x.moveTo(40, 158); x.lineTo(60, 20); x.lineTo(80, 158); x.stroke();
    for (let y = 140; y > 30; y -= 20) { const w = ((y - 20) / 138) * 20; x.beginPath(); x.moveTo(60 - w, y); x.lineTo(60 + w, y); x.stroke(); }
    glowDot(x, 60, 20, 10, 'rgba(255,60,60,1)');
  },
  tree: (x) => { rect(x, 54, 104, 12, 54, hgrad(x, 54, 66, '#8b5a33', '#4a2c14')); ell(x, 60, 80, 40, 36, '#2f8f4a'); ell(x, 48, 70, 24, 20, '#4fb465'); ell(x, 74, 92, 22, 16, '#23733a'); },
  pine: (x) => { rect(x, 56, 136, 8, 22, '#5a3818'); for (let i = 0; i < 4; i++) poly(x, [20 + i * 6, 140 - i * 26, 60, 92 - i * 26, 100 - i * 6, 140 - i * 26], i % 2 ? '#2c7a4b' : '#1f5e3a'); },
  mushroom: (x) => {
    rect(x, 50, 96, 20, 62, hgrad(x, 50, 70, '#fff3e6', '#c9b29a'));
    x.fillStyle = hgrad(x, 10, 110, '#ff6b8a', '#9b1d4a'); x.beginPath(); x.ellipse(60, 96, 50, 34, 0, Math.PI, 0); x.fill();
    for (const [cx, cy, r] of [[40, 80, 7], [64, 70, 9], [86, 84, 6]]) ell(x, cx, cy, r, r * 0.8, '#fff3f6');
    glowDot(x, 60, 90, 50, 'rgba(255,120,200,0.25)');
  },
  orb: (x) => { rect(x, 46, 120, 28, 38, hgrad(x, 46, 74, '#d6c4ff', '#5e4a9e')); glowDot(x, 60, 98, 40, 'rgba(190,140,255,0.6)'); const g = x.createRadialGradient(52, 90, 2, 60, 98, 22); g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, '#b48cff'); g.addColorStop(1, '#4a2a8a'); x.fillStyle = g; x.beginPath(); x.arc(60, 98, 22, 0, Math.PI * 2); x.fill(); },
  dome: (x) => {
    rect(x, 14, 146, 92, 12, '#7d8496');
    const g = x.createRadialGradient(46, 100, 4, 60, 146, 48); g.addColorStop(0, 'rgba(230,250,255,0.95)'); g.addColorStop(1, 'rgba(110,170,220,0.6)');
    x.fillStyle = g; x.beginPath(); x.arc(60, 146, 44, Math.PI, 0); x.fill(); glowDot(x, 60, 130, 20, 'rgba(255,220,140,0.8)');
  },
  cake: (x) => {
    for (const [y, w, c] of [[124, 88, '#f7c6d9'], [96, 66, '#fbe3ea'], [72, 44, '#f7c6d9']]) { rect(x, 60 - w / 2, y, w, y === 124 ? 34 : 28, c); rect(x, 60 - w / 2, y, w, 6, '#ffffff'); }
    rect(x, 58, 52, 4, 20, '#ffd166'); glowDot(x, 60, 50, 8, 'rgba(255,170,60,1)');
  },
  pad: (x) => { ell(x, 60, 150, 54, 10, '#5d6478'); ell(x, 60, 146, 50, 8, '#8b93a8'); for (const cx of [20, 60, 100]) glowDot(x, cx, 146, 6, 'rgba(120,255,160,1)'); },
  rocket: (x) => {
    x.fillStyle = '#c0392b'; poly(x, [36, 158, 46, 120, 46, 158], '#c0392b'); poly(x, [84, 158, 74, 120, 74, 158], '#962d22');
    x.fillStyle = hgrad(x, 44, 76, '#ffffff', '#9aa3b8'); x.beginPath(); x.ellipse(60, 100, 16, 58, 0, 0, Math.PI * 2); x.fill();
    poly(x, [48, 52, 60, 34, 72, 52], '#c0392b'); ell(x, 60, 84, 7, 7, '#5fc7ff');
  },
  house: (x) => { rect(x, 26, 104, 68, 54, hgrad(x, 26, 94, '#f0e6d6', '#a89c86')); poly(x, [18, 106, 60, 70, 102, 106], '#b5523b'); rect(x, 52, 128, 16, 30, '#5a3818'); rect(x, 34, 116, 12, 12, '#ffe08a'); rect(x, 74, 116, 12, 12, '#ffe08a'); },
  spire: (x) => { poly(x, [40, 158, 56, 60, 60, 8, 66, 66, 80, 158], hgrad(x, 40, 80, '#4a1f2e', '#12060b')); glowDot(x, 60, 26, 14, 'rgba(255,40,90,0.9)'); },
  pylon: (x) => {
    rect(x, 52, 60, 16, 98, hgrad(x, 52, 68, '#6b6f80', '#262833')); for (let y = 66; y < 150; y += 16) rect(x, 46, y, 28, 4, '#3a3d4c');
    glowDot(x, 60, 52, 22, 'rgba(255,90,90,0.9)'); x.strokeStyle = 'rgba(255,180,200,0.9)'; x.lineWidth = 2; x.beginPath(); x.moveTo(60, 52); x.lineTo(44, 34); x.lineTo(54, 26); x.lineTo(38, 8); x.stroke();
  },
};

/** Painted landscape prop as data URL (cached for the session). Unknown kinds fall back to a rock. */
export function propImage(kind) {
  const key = 'prop:' + kind;
  if (mem.has(key)) return mem.get(key);
  const c = canvas(PROP_W * PS, PROP_H * PS);
  const x = c.getContext('2d');
  x.scale(PS, PS);
  ell(x, 60, 158, 50, 5, 'rgba(0,0,0,0.35)'); // baked ground shadow (cheaper than a CSS filter)
  (PROPS[kind] || PROPS.rock)(x);
  const url = c.toDataURL('image/png');
  mem.set(key, url);
  return url;
}

/* ------------------------------------------------------------------ */
/* Landschafts-Ebenen (Gebirge, Dünen, Städte …)                       */
/* ------------------------------------------------------------------ */

const TERRAIN_PAL = {
  dunes: { base: [190, 124, 72], light: [255, 214, 150] },
  ice: { base: [112, 152, 206], light: [236, 246, 255] },
  rocks: { base: [106, 86, 80], light: [206, 172, 142] },
  craters: { base: [118, 120, 140], light: [220, 222, 236] },
  forest: { base: [30, 78, 70], light: [126, 206, 146] },
  city: { base: [44, 54, 88], light: [140, 176, 255] },
  domes: { base: [168, 112, 90], light: [255, 200, 156] },
  mesas: { base: [168, 74, 44], light: [255, 160, 100] },
  spikes: { base: [46, 14, 28], light: [255, 72, 112] },
};
// 0 fern … 3 Vordergrund: Höhe der Kammlinie, Amplitude, Dunst (Himmelsfarbe), Abdunkelung
const LAYERS = [
  { top: 0.12, amp: 0.6, haze: 0.5, dark: 0 },
  { top: 0.28, amp: 0.46, haze: 0.26, dark: 0.16 },
  { top: 0.4, amp: 0.34, haze: 0.12, dark: 0.36 },
  { top: 0.46, amp: 0.24, haze: 0, dark: 0.62 },
];
const TW = 1200;
const TH = 360;

function hsl2rgb(h, s, l) {
  s /= 100;
  l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))) * 255;
  return [f(0), f(8), f(4)];
}
const rgba = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const smoothstep = (a, b, t) => { const v = clamp01((t - a) / (b - a)); return v * v * (3 - 2 * v); };

let grainTile = null;
/** Seamless 128 px rock/sand grain used as an overlay pattern (mid-grey = neutral). */
function grain() {
  if (grainTile) return grainTile;
  const S = 128;
  const c = canvas(S, S);
  const x = c.getContext('2d');
  const img = x.createImageData(S, S);
  const n = makeNoise('grain');
  const r = seeded('grain-speckle');
  const f = (i, j) => n(i / 9, j / 9, 3);
  for (let j = 0; j < S; j++) {
    for (let i = 0; i < S; i++) {
      const a = i / S;
      const b = j / S;
      // blend four shifted samples → tiles without seams
      const v = f(i, j) * (1 - a) * (1 - b) + f(i - S, j) * a * (1 - b) + f(i, j - S) * (1 - a) * b + f(i - S, j - S) * a * b;
      const g = clamp01(0.5 + (v - 0.5) * 1.4 + (r() - 0.5) * 0.3) * 255;
      const o = (j * S + i) * 4;
      img.data[o] = img.data[o + 1] = img.data[o + 2] = g;
      img.data[o + 3] = 255;
    }
  }
  x.putImageData(img, 0, 0);
  grainTile = c;
  return c;
}

function ridgeHeight(type, px, n) {
  switch (type) {
    case 'dunes': { const a = n(px / 320, 1, 3); return 0.2 + 0.5 * a + 0.25 * Math.abs(Math.sin(px / 150 + a * 5)) ** 1.6; }
    case 'ice': return 0.97 * (1 - Math.abs(2 * n(px / 230, 2, 5) - 1)) ** 2.2;
    case 'spikes': return 0.06 + 0.92 * (1 - Math.abs(2 * n(px / 95, 2, 5) - 1)) ** 3;
    case 'rocks': return 0.15 + 0.85 * (1 - Math.abs(2 * n(px / 160, 2, 5) - 1)) ** 1.6;
    case 'craters': return 0.2 + 0.45 * n(px / 400, 3, 4);
    case 'forest': return 0.3 + 0.5 * n(px / 350, 3, 3);
    case 'city': return 0.12 + 0.3 * n(px / 500, 3, 2);
    case 'domes': return 0.22 + 0.42 * n(px / 380, 3, 3);
    case 'mesas': return 0.1 + 0.45 * smoothstep(0.46, 0.52, n(px / 210, 5, 3)) + 0.35 * smoothstep(0.55, 0.6, n(px / 260, 6, 3)) + 0.06 * n(px / 40, 9, 2);
    default: return 0.4;
  }
}

/**
 * Painted landscape layer (canvas TW×TH, transparent sky). layer 0 = far … 3 = foreground.
 * Light comes from the upper left; far layers fade into the sky colour (atmospheric depth).
 */
export function terrainLayer({ type, hue, dark = false, layer, seed }) {
  const key = `ter:${type}:${hue}:${+dark}:${layer}:${seed}`;
  if (mem.has(key)) return mem.get(key);
  const pal = TERRAIN_PAL[type] || TERRAIN_PAL.rocks;
  const Ly = LAYERS[layer];
  const c = canvas(TW, TH);
  const x = c.getContext('2d');
  const n = makeNoise(`${seed}:${layer}`);
  const r = seeded(`${seed}:r${layer}`);
  const sky = dark ? hsl2rgb(hue, 70, 20) : hsl2rgb(hue, 55, 55);
  const shade = (col) => mix3(mix3(col, sky, Ly.haze), [6, 6, 16], dark ? Math.min(0.8, Ly.dark + 0.3) : Ly.dark);
  const base = shade(pal.base);
  const light = shade(pal.light);
  const top = TH * Ly.top;
  const amp = TH * Ly.amp * (layer === 3 ? 0.6 : 1);
  const STEP = 3;
  const ys = [];
  for (let px = 0; px <= TW + STEP; px += STEP) ys.push(top + amp * (1 - clamp01(ridgeHeight(type, px + layer * 977, n))));
  const ridge = () => { x.beginPath(); x.moveTo(0, TH); ys.forEach((y, i) => x.lineTo(i * STEP, y)); x.lineTo(TW, TH); x.closePath(); };
  const yAt = (px) => ys[Math.max(0, Math.min(ys.length - 1, Math.round(px / STEP)))];

  // body: vertical gradient
  ridge();
  const body = x.createLinearGradient(0, top, 0, TH);
  body.addColorStop(0, rgba(mix3(base, light, 0.35)));
  body.addColorStop(1, rgba(mix3(base, [0, 0, 0], 0.45)));
  x.fillStyle = body;
  x.fill();

  x.save();
  ridge();
  x.clip();
  // slope lighting: rising slopes (facing the light) brighter, falling ones in shadow
  const depth = Math.max(40, amp * 0.9);
  for (let i = 0; i < ys.length - 1; i++) {
    const s = (ys[Math.min(ys.length - 1, i + 4)] - ys[Math.max(0, i - 4)]) / (8 * STEP); // smoothed slope
    const lit = clamp01(-s * 1.4);
    const shadow = clamp01(s * 1.4);
    if (lit < 0.05 && shadow < 0.05) continue;
    const g = x.createLinearGradient(0, ys[i], 0, ys[i] + depth);
    const col = lit > shadow ? rgba(light, lit * 0.5) : rgba([0, 0, 10], shadow * 0.4);
    g.addColorStop(0, col);
    g.addColorStop(1, lit > shadow ? rgba(light, 0) : 'rgba(0,0,10,0)');
    x.fillStyle = g;
    x.fillRect(i * STEP, ys[i], STEP + 0.5, depth);
  }
  // type details
  if (type === 'mesas' || type === 'rocks') { // rock strata
    for (let k = 0; k < 14; k++) {
      const y0 = top + amp * (k / 12) + 6;
      x.beginPath();
      for (let px = 0; px <= TW; px += 12) x.lineTo(px, y0 + (n(px / 90, k + 20, 2) - 0.5) * 14);
      x.strokeStyle = k % 2 ? rgba([0, 0, 0], 0.13) : rgba(light, 0.12);
      x.lineWidth = 2 + (k % 3);
      x.stroke();
    }
  }
  if (type === 'dunes') { // wind ripples follow the ridge
    x.strokeStyle = rgba(light, 0.16);
    x.lineWidth = 1.5;
    for (const d of [10, 22, 38, 58, 84, 116]) {
      x.beginPath();
      for (let px = 0; px <= TW; px += 6) x.lineTo(px, yAt(px) + d + Math.sin(px / 26 + d) * 2.5);
      x.stroke();
    }
  }
  if ((type === 'ice' || type === 'rocks' || type === 'spikes') && layer < 3) { // snow caps on high peaks
    const line = top + amp * (type === 'ice' ? 0.42 : 0.32);
    x.beginPath();
    x.moveTo(0, ys[0]);
    ys.forEach((y, i) => x.lineTo(i * STEP, y));
    for (let i = ys.length - 1; i >= 0; i--) {
      const capH = Math.max(0, line - ys[i]) * (0.35 + 0.5 * n(i / 9, 40, 2));
      x.lineTo(i * STEP, ys[i] + capH);
    }
    x.closePath();
    x.fillStyle = type === 'spikes' ? rgba([255, 120, 150], 0.35) : rgba(mix3([255, 255, 255], sky, Ly.haze * 0.5), 0.85);
    x.fill();
  }
  if (type === 'craters' && layer > 0) {
    for (let k = 0; k < 7 - layer; k++) {
      const cx = r() * TW;
      const rx = (20 + r() * 50) * (0.7 + layer * 0.3);
      const cy = yAt(cx) + (TH - yAt(cx)) * (0.2 + r() * 0.4);
      x.beginPath(); x.ellipse(cx, cy, rx, rx * 0.26, 0, 0, Math.PI * 2);
      x.fillStyle = rgba([0, 0, 10], 0.35); x.fill();
      x.beginPath(); x.ellipse(cx, cy + 2, rx, rx * 0.26, 0, 0.1, Math.PI - 0.1);
      x.strokeStyle = rgba(light, 0.45); x.lineWidth = 2; x.stroke();
    }
  }
  if (type === 'spikes' && layer >= 2) { // glowing lava cracks
    x.shadowColor = '#ff3d3d';
    x.shadowBlur = 10;
    x.strokeStyle = 'rgba(255,110,60,0.85)';
    x.lineWidth = 2;
    for (let k = 0; k < 9; k++) {
      let px = r() * TW;
      let py = yAt(px) + 20 + r() * 60;
      x.beginPath(); x.moveTo(px, py);
      for (let s = 0; s < 8; s++) { px += (r() - 0.3) * 40; py += r() * 22; x.lineTo(px, py); }
      x.stroke();
    }
    x.shadowBlur = 0;
  }
  if (type === 'ice' && layer >= 1) { // crevasses
    x.strokeStyle = rgba([40, 90, 170], 0.35);
    x.lineWidth = 1.5;
    for (let k = 0; k < 14; k++) {
      const px = r() * TW;
      const py = yAt(px) + 10 + r() * 50;
      x.beginPath(); x.moveTo(px, py); x.lineTo(px + (r() - 0.5) * 30, py + 20 + r() * 50); x.stroke();
    }
  }
  // surface grain
  x.globalCompositeOperation = 'overlay';
  x.globalAlpha = 0.32;
  x.fillStyle = x.createPattern(grain(), 'repeat');
  x.fillRect(0, 0, TW, TH);
  x.globalAlpha = 1;
  x.globalCompositeOperation = 'source-over';
  // valley mist (far) / ground darkness (near)
  const mist = x.createLinearGradient(0, top + amp * 0.3, 0, TH);
  mist.addColorStop(0, rgba(sky, 0));
  mist.addColorStop(1, layer < 2 ? rgba(mix3(sky, [255, 255, 255], 0.15), 0.55 * (1 - layer * 0.4)) : rgba([0, 0, 8], 0.4));
  x.fillStyle = mist;
  x.fillRect(0, 0, TW, TH);
  x.restore();

  // rim light along the ridge
  x.beginPath();
  ys.forEach((y, i) => x.lineTo(i * STEP, y + 1));
  if (type === 'spikes') { x.shadowColor = '#ff2d6a'; x.shadowBlur = 12; }
  x.strokeStyle = rgba(type === 'spikes' ? [255, 80, 120] : light, type === 'spikes' ? 0.8 : 0.55);
  x.lineWidth = 2;
  x.stroke();
  x.shadowBlur = 0;

  // things standing on the ridge
  const tone = mix3(base, [0, 0, 0], 0.15);
  if (type === 'forest' && layer >= 1) {
    for (let px = r() * 10; px < TW; px += 7 + r() * 12) {
      const y = yAt(px) + 3;
      const hT = (14 + r() * 24) * (0.7 + layer * 0.35);
      if (r() < 0.55) { // pine
        x.beginPath(); x.moveTo(px, y - hT); x.lineTo(px + hT * 0.32, y); x.lineTo(px - hT * 0.32, y); x.closePath();
      } else { // round crown
        x.beginPath(); x.arc(px, y - hT * 0.55, hT * 0.38, 0, Math.PI * 2);
      }
      x.fillStyle = rgba(mix3(tone, light, r() * 0.25));
      x.fill();
    }
  }
  if (type === 'city' && layer <= 1) {
    for (let px = r() * 20; px < TW; px += 18 + r() * 40) {
      const w = 16 + r() * 34;
      const hB = (30 + r() * (layer ? 70 : 110)) * (layer ? 1 : 0.9);
      const y = yAt(px + w / 2) + 4;
      x.fillStyle = rgba(mix3(tone, light, 0.1));
      x.fillRect(px, y - hB, w, hB);
      x.fillStyle = rgba(light, 0.35);
      x.fillRect(px, y - hB, 2, hB);
      for (let wy = y - hB + 6; wy < y - 6; wy += 8) {
        for (let wx = px + 4; wx < px + w - 4; wx += 7) {
          if (r() < 0.35) { x.fillStyle = r() < 0.7 ? 'rgba(255,214,120,0.85)' : 'rgba(120,230,255,0.85)'; x.fillRect(wx, wy, 3, 4); }
        }
      }
      if (r() < 0.3) { x.fillStyle = '#ff4d6d'; x.fillRect(px + w / 2 - 1, y - hB - 8, 2, 8); }
    }
  }
  if (type === 'domes' && layer === 1) {
    for (let k = 0; k < 6; k++) {
      const px = 80 + r() * (TW - 160);
      const rad = 24 + r() * 46;
      const y = yAt(px) + 6;
      const g = x.createRadialGradient(px - rad * 0.4, y - rad * 0.6, 2, px, y, rad);
      g.addColorStop(0, 'rgba(255,255,255,0.7)');
      g.addColorStop(0.5, rgba(mix3(light, [150, 220, 255], 0.5), 0.35));
      g.addColorStop(1, rgba([90, 160, 220], 0.5));
      x.beginPath(); x.arc(px, y, rad, Math.PI, 0); x.closePath();
      x.fillStyle = g; x.fill();
      x.strokeStyle = 'rgba(220,240,255,0.6)'; x.lineWidth = 1.5; x.stroke();
    }
  }
  mem.set(key, c);
  return c;
}
