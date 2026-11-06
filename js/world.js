// Freie Weltraum-Welt: Raumschiff steuern, Planeten anfliegen, landen, Kometen fangen.
// Gezeichnet wird mit WebGL (js/gl.js); alle Grafiken werden einmal als Texturen vorgezeichnet.
import { h } from './util.js';
import { createRenderer } from './gl.js';
import { lowPower, reportSlow } from './perf.js';

export const WORLD_W = 3200;
export const WORLD_H = 2400;
import { paintPlanet, paintShip, paintComet, paintShard, paintChest, paintBeacon, paintStation, paintNebula, cachedArt, idleQueue, PLANET_TYPES } from './art.js';
const ACC = 950;
const MAX_SPEED = 430;
const LAND_TIME = 0.75;
const TAKEOFF_TIME = 0.9;
const TEX_SCALE = 2; // planet/label textures are drawn at 2× world size for crisp zoom

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const mod = (a, n) => ((a % n) + n) % n;
const rand = (a, b) => a + Math.random() * (b - a);

function hsl(hue, s, l) {
  s /= 100;
  l /= 100;
  const k = (n) => (n + hue / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [f(0), f(8), f(4)];
}

function makeCanvas(w, hgt, draw) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(hgt));
  draw(c.getContext('2d'), c.width, c.height);
  return c;
}

/* ---------- Shared renderer (Safari allows only few WebGL contexts) ---------- */

let shared = null;
function getShared() {
  if (shared) return shared;
  const canvas = h('canvas', { class: 'world-canvas', 'aria-label': 'Weltraum – steuere dein Raumschiff' });
  const R = createRenderer(canvas);
  if (!R) return null;
  const tex = (w, hgt, draw) => R.texture(makeCanvas(w, hgt, draw));
  const T = {
    white: tex(4, 4, (x, w, hh) => { x.fillStyle = '#fff'; x.fillRect(0, 0, w, hh); }),
    dot: tex(32, 32, (x) => {
      const g = x.createRadialGradient(16, 16, 0, 16, 16, 16);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.45, 'rgba(255,255,255,0.8)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g;
      x.fillRect(0, 0, 32, 32);
    }),
    glow: tex(256, 256, (x) => {
      const g = x.createRadialGradient(128, 128, 0, 128, 128, 128);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.35, 'rgba(255,255,255,0.35)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g;
      x.fillRect(0, 0, 256, 256);
    }),
    ring: tex(256, 256, (x) => { x.strokeStyle = '#fff'; x.lineWidth = 6; x.beginPath(); x.arc(128, 128, 122, 0, Math.PI * 2); x.stroke(); }),
    dashRing: tex(256, 256, (x) => { x.strokeStyle = '#fff'; x.lineWidth = 6; x.setLineDash([22, 16]); x.beginPath(); x.arc(128, 128, 122, 0, Math.PI * 2); x.stroke(); }),
    arc: tex(256, 256, (x) => { x.strokeStyle = '#fff'; x.lineWidth = 7; x.lineCap = 'round'; x.beginPath(); x.arc(128, 128, 120, 0, 1.1); x.stroke(); }),
    gateArc: tex(256, 256, (x) => { x.strokeStyle = '#fff'; x.lineWidth = 12; x.lineCap = 'round'; x.beginPath(); x.arc(128, 128, 115, 0, Math.PI * 1.6); x.stroke(); }),
    arrow: tex(128, 128, (x) => {
      x.fillStyle = 'rgba(255,255,255,0.28)';
      x.beginPath(); x.arc(64, 64, 34, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#fff';
      x.beginPath(); x.moveTo(122, 64); x.lineTo(98, 46); x.lineTo(98, 82); x.closePath(); x.fill();
    }),
  };
  // GL textures for shared art canvases/images (kept for the whole session)
  const artTex = new Map();
  const texOf = (src) => {
    let t = artTex.get(src);
    if (!t) { t = R.texture(src); artTex.set(src, t); }
    return t;
  };
  shared = { canvas, R, T, texOf };
  return shared;
}

/* ---------- Per-object textures ---------- */

/** Quick shaded sphere shown until the detailed planet texture is ready. */
function placeholderTexture(R, o) {
  const S = TEX_SCALE;
  const size = o.r * 3.2 * S;
  return R.texture(makeCanvas(size, size, (x, w) => {
    const c = w / 2;
    const r = o.r * S;
    const sat = o.locked ? 8 : o.stage === 0 ? 22 : 60;
    const g = x.createRadialGradient(c - r * 0.35, c - r * 0.4, r * 0.1, c, c, r);
    g.addColorStop(0, o.dark ? '#ff8fa3' : `hsl(${o.hue}, ${sat}%, 70%)`);
    g.addColorStop(0.6, o.dark ? '#8a1f3c' : `hsl(${o.hue}, ${sat}%, 38%)`);
    g.addColorStop(1, o.dark ? '#1d0610' : `hsl(${o.hue}, ${sat}%, 10%)`);
    x.fillStyle = g;
    x.beginPath(); x.arc(c, c, r, 0, Math.PI * 2); x.fill();
  }));
}

function labelTexture(R, o) {
  const S = TEX_SCALE;
  const w = 340 * S;
  const hh = (o.bar != null ? 66 : 54) * S;
  return R.texture(makeCanvas(w, hh, (x) => {
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.shadowColor = 'rgba(0,0,0,0.85)';
    x.shadowBlur = 6 * S;
    x.font = `800 ${21 * S}px system-ui, -apple-system, sans-serif`;
    x.fillStyle = o.locked ? 'rgba(255,255,255,0.55)' : '#fff';
    x.fillText(o.name, w / 2, 13 * S);
    if (o.sub) {
      x.font = `700 ${15 * S}px system-ui, -apple-system, sans-serif`;
      x.fillStyle = 'rgba(220,225,255,0.85)';
      x.fillText(o.sub, w / 2, 35 * S);
    }
    x.shadowBlur = 0;
    if (o.bar != null) {
      const bw = 90 * S;
      x.fillStyle = 'rgba(0,0,0,0.5)';
      x.fillRect(w / 2 - bw / 2, 52 * S, bw, 7 * S);
      x.fillStyle = o.stage === 2 ? '#ffd166' : '#3ddc97';
      x.fillRect(w / 2 - bw / 2, 52 * S, bw * o.bar, 7 * S);
    }
  }));
}

/**
 * cfg: {
 *   objects: [{ id, kind, x, y, r, hue, emoji, name, sub?, locked?, lockText?, verb?, stage?, mail?, bar?, dark? }],
 *   ship, start: {x, y}, takeoff: bool, target: id|null, comet: bool, tutorial: bool,
 *   pickups: [{ id, kind: 'shard'|'chest', x, y }], speed (multiplier), magnet (pickup radius multiplier),
 *   scanner (0: nothing, 1: chests on minimap, 2: + arrow to nearest chest),
 *   onLand(obj), onNear(obj), onComet(), onPickup(p), sfx: { land(), comet() }
 * }
 */
export function createWorld(root, cfg) {
  const ctxShared = getShared();
  if (!ctxShared) {
    root.append(h('div', { class: 'world-hint' }, 'Dein Gerät kann das Weltall nicht anzeigen (WebGL fehlt). Bitte iPadOS/Browser aktualisieren.'));
    return { destroy() {}, shipPos: () => cfg.start };
  }
  const { canvas, R, T, texOf } = ctxShared;
  let destroyed = false;
  const minimap = h('canvas', { class: 'minimap', 'aria-hidden': 'true' });
  const prompt = h('button', { type: 'button', class: 'land-prompt' });
  const hint = cfg.tutorial
    ? h('div', { class: 'world-hint' }, '👆 Gedrückt halten = fliegen', h('br'), '🪐 Planet antippen = Autopilot', h('span', { class: 'kbd' }, h('br'), '⌨️ Pfeiltasten / WASD · Enter = landen'))
    : null;
  root.append(canvas, minimap, prompt, hint);
  // iPad Safari: pinch gestures would zoom the whole page instead of steering.
  root.addEventListener('gesturestart', (e) => e.preventDefault());
  if (hint) setTimeout(() => hint.classList.add('gone'), 9000);
  const mctx = minimap.getContext('2d');

  // Adaptive resolution: start sharp, step down if frames get slow.
  let quality = Math.min(lowPower() ? 1.25 : 2, devicePixelRatio || 1);
  let W = 0;
  let H = 0;
  let zoomBase = 1;
  const resize = () => {
    W = root.clientWidth;
    H = root.clientHeight;
    canvas.width = Math.round(W * quality);
    canvas.height = Math.round(H * quality);
    R.resize(canvas.width, canvas.height);
    zoomBase = clamp(Math.min(W, H) / 1050, 0.42, 0.9);
    const mw = Math.min(170, W * 0.32);
    minimap.style.width = mw + 'px';
    minimap.style.height = (mw * WORLD_H) / WORLD_W + 'px';
    minimap.width = Math.round(mw * 2);
    minimap.height = Math.round(((mw * WORLD_H) / WORLD_W) * 2);
  };
  resize();
  addEventListener('resize', resize);

  const objects = cfg.objects.map((o) => ({
    ...o,
    tex: o.kind === 'gate' ? null : o.kind === 'station' ? R.texture(paintStation(o.r * TEX_SCALE)) : placeholderTexture(R, o),
    label: labelTexture(R, o),
    halo: o.dark ? hsl(345, 100, 60) : o.stage === 2 || o.kind === 'gate' ? hsl(o.hue, 100, 65) : null,
  }));
  const ownTextures = objects.flatMap((o) => [o.tex, o.label]).filter(Boolean);
  const art = {
    ship: texOf(paintShip(cfg.ship)),
    comet: texOf(paintComet()),
    shard: texOf(paintShard()),
    chest: texOf(paintChest()),
    beacon: texOf(paintBeacon()),
  };
  const nebulaTex = [];
  // Detailed planet + nebula textures: painted (or loaded from the art cache) one by one in idle time.
  const gal = cfg.galaxy || 0;
  idleQueue([
    ...objects.filter((o) => o.kind === 'planet' && PLANET_TYPES[o.id]).map((o) => async () => {
      const stage = o.stage ?? 1;
      const key = `planet:${o.id}:${gal}:${stage}:${o.locked ? 1 : 0}`;
      const img = await cachedArt(key, () => paintPlanet({ type: PLANET_TYPES[o.id], seed: `${o.id}-${gal}`, stage, locked: !!o.locked, radius: Math.round(o.r * TEX_SCALE) }));
      if (!destroyed) o.tex = texOf(img);
    }),
    ...[0, 1, 2].map((i) => async () => {
      const img = await cachedArt(`nebula:${gal}:${i}`, () => paintNebula(`${gal}-${i}`, [265, 200, 320][i], [320, 250, 210][i]));
      if (!destroyed) nebulaTex[i] = texOf(img);
    }),
  ]);

  const ship = { x: cfg.start.x, y: cfg.start.y, vx: 0, vy: 0, angle: -Math.PI / 2 };
  if (cfg.takeoff) { ship.vy = 160; ship.angle = Math.PI / 2; }
  const cam = { x: ship.x, y: ship.y };
  const target = cfg.target ?? null;
  let autopilot = null;
  let near = null;
  let landing = null;
  let takeoffT = cfg.takeoff ? TAKEOFF_TIME : 0;
  let particles = [];
  const keys = new Set();
  const pointer = { down: false, x: 0, y: 0, t0: 0, x0: 0, y0: 0 };

  const starLayers = [0.15, 0.35, 0.6].map((p, i) => ({
    p, stars: Array.from({ length: 90 - i * 20 }, () => ({ u: Math.random(), v: Math.random(), r: rand(1.2, 2.4 + i * 1.2), tw: rand(0, 6) })),
  }));
  const nebulae = Array.from({ length: 7 }, (_, i) => ({ x: rand(0, WORLD_W), y: rand(0, WORLD_H), r: rand(450, 850), c: hsl(rand(200, 330), 80, 55), v: i % 3, rot: rand(0, 6) }));
  const rocks = Array.from({ length: 28 }, () => ({ x: rand(0, WORLD_W), y: rand(0, WORLD_H), r: rand(6, 18), vx: rand(-12, 12), vy: rand(-12, 12), rot: rand(0, 6), vr: rand(-0.5, 0.5) }));

  let comet = null;
  let pickups = (cfg.pickups || []).map((p) => ({ ...p, ph: rand(0, 6) }));
  const speed = cfg.speed || 1;
  const magnet = cfg.magnet || 1;
  const scanner = cfg.scanner || 0;
  const spawnComet = () => {
    const fromLeft = Math.random() < 0.5;
    const y0 = rand(200, WORLD_H - 200);
    const y1 = rand(200, WORLD_H - 200);
    const x0 = fromLeft ? -100 : WORLD_W + 100;
    const x1 = fromLeft ? WORLD_W + 100 : -100;
    const len = Math.hypot(x1 - x0, y1 - y0);
    comet = { x: x0, y: y0, vx: ((x1 - x0) / len) * 140, vy: ((y1 - y0) / len) * 140, trail: [] };
    const k = clamp((ship.x - x0) / (x1 - x0) - 0.25, 0, 0.6); // start near the ship so it shows up soon
    comet.x += (x1 - x0) * k;
    comet.y += (y1 - y0) * k;
  };
  if (cfg.comet) spawnComet();

  /* ---------- Input ---------- */
  const KEYMAP = { ArrowLeft: 'l', a: 'l', A: 'l', ArrowRight: 'r', d: 'r', D: 'r', ArrowUp: 'u', w: 'u', W: 'u', ArrowDown: 'd', s: 'd', S: 'd' };
  const blocked = () => !!document.querySelector('.cutscene, .overlay');
  const onKeyDown = (e) => {
    if (blocked() || e.target.matches?.('input, textarea')) return;
    const k = KEYMAP[e.key];
    if (k) { keys.add(k); autopilot = null; e.preventDefault(); }
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); land(); }
  };
  const onKeyUp = (e) => { const k = KEYMAP[e.key]; if (k) keys.delete(k); };
  addEventListener('keydown', onKeyDown);
  addEventListener('keyup', onKeyUp);

  const toWorld = (sx, sy, zoom) => ({ x: cam.x + (sx - W / 2) / zoom, y: cam.y + (sy - H / 2) / zoom });
  const localXY = (e) => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const onDown = (e) => {
    const [x, y] = localXY(e);
    Object.assign(pointer, { down: true, x, y, x0: x, y0: y, t0: performance.now() });
    canvas.setPointerCapture?.(e.pointerId);
    autopilot = null;
  };
  const onMove = (e) => { if (pointer.down) [pointer.x, pointer.y] = localXY(e); };
  const onUp = () => {
    if (!pointer.down) return;
    pointer.down = false;
    const quick = performance.now() - pointer.t0 < 280 && Math.hypot(pointer.x - pointer.x0, pointer.y - pointer.y0) < 14;
    if (!quick) return;
    const w = toWorld(pointer.x, pointer.y, zoom());
    const hit = objects.find((o) => Math.hypot(o.x - w.x, o.y - w.y) < o.r + 30);
    if (!hit) return;
    if (hit === near) land();
    else autopilot = hit;
  };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  prompt.addEventListener('click', () => land());

  function land() {
    if (!near || near.locked || landing || takeoffT > 0.3) return;
    landing = { t: 0, obj: near };
    autopilot = null;
    prompt.classList.remove('show');
    cfg.sfx?.land?.();
  }

  function updatePrompt() {
    if (!near || landing) { prompt.classList.remove('show'); return; }
    prompt.classList.add('show');
    prompt.disabled = !!near.locked;
    prompt.textContent = near.locked ? near.lockText : `${near.verb || '🛬 Landen'}: ${near.name}`;
  }

  /* ---------- Update ---------- */
  function zoom() {
    let z = zoomBase;
    if (landing) { const k = landing.t / LAND_TIME; z *= 1 + k * k * 3; }
    if (takeoffT > 0) z *= 1 + (takeoffT / TAKEOFF_TIME) ** 2 * 2.2;
    return z;
  }

  function update(dt) {
    let ax = 0;
    let ay = 0;
    if (!landing && !blocked()) {
      if (keys.has('l')) ax -= 1;
      if (keys.has('r')) ax += 1;
      if (keys.has('u')) ay -= 1;
      if (keys.has('d')) ay += 1;
      if (pointer.down && performance.now() - pointer.t0 > 120) {
        const w = toWorld(pointer.x, pointer.y, zoom());
        const dx = w.x - ship.x;
        const dy = w.y - ship.y;
        const d = Math.hypot(dx, dy);
        if (d > 30) { ax = dx / d; ay = dy / d; }
      }
      if (autopilot && !ax && !ay) {
        const dx = autopilot.x - ship.x;
        const dy = autopilot.y - ship.y;
        const d = Math.hypot(dx, dy);
        if (d < autopilot.r + 75) autopilot = null;
        else { ax = dx / d; ay = dy / d; }
      }
      const n = Math.hypot(ax, ay);
      if (n > 1) { ax /= n; ay /= n; }
    }
    const thrust = ax !== 0 || ay !== 0;
    ship.vx += ax * ACC * speed * dt;
    ship.vy += ay * ACC * speed * dt;
    const damp = Math.exp(-(thrust ? 1.1 : 2.2) * dt);
    ship.vx *= damp;
    ship.vy *= damp;
    const sp = Math.hypot(ship.vx, ship.vy);
    const vmax = MAX_SPEED * speed;
    if (sp > vmax) { ship.vx *= vmax / sp; ship.vy *= vmax / sp; }
    ship.x += ship.vx * dt;
    ship.y += ship.vy * dt;
    if (ship.x < 60 || ship.x > WORLD_W - 60) { ship.x = clamp(ship.x, 60, WORLD_W - 60); ship.vx *= -0.4; }
    if (ship.y < 60 || ship.y > WORLD_H - 60) { ship.y = clamp(ship.y, 60, WORLD_H - 60); ship.vy *= -0.4; }
    if (sp > 15) {
      const ta = Math.atan2(ship.vy, ship.vx);
      const da = mod(ta - ship.angle + Math.PI, Math.PI * 2) - Math.PI;
      ship.angle += da * Math.min(1, dt * 8);
    }
    if (thrust && Math.random() < 0.9) {
      const back = ship.angle + Math.PI;
      particles.push({
        x: ship.x + Math.cos(back) * 24, y: ship.y + Math.sin(back) * 24,
        vx: Math.cos(back + rand(-0.4, 0.4)) * rand(80, 160) + ship.vx * 0.3, vy: Math.sin(back + rand(-0.4, 0.4)) * rand(80, 160) + ship.vy * 0.3,
        life: 1, c: hsl(rand(20, 50), 100, 60), size: rand(3, 7),
      });
    }
    for (const p of particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt * 2.2; }
    particles = particles.filter((p) => p.life > 0);

    for (const r of rocks) {
      r.x = mod(r.x + r.vx * dt, WORLD_W);
      r.y = mod(r.y + r.vy * dt, WORLD_H);
      r.rot += r.vr * dt;
    }

    if (!landing && !blocked()) {
      // re-armed pickups (e.g. a chest closed early) only trigger again after the ship flew away
      for (const p of pickups) if (p.disarmed && Math.hypot(p.x - ship.x, p.y - ship.y) > 180) p.disarmed = false;
      const hit = pickups.find((p) => !p.disarmed && Math.hypot(p.x - ship.x, p.y - ship.y) < (p.kind === 'shard' ? 48 * magnet : 70));
      if (hit) {
        pickups = pickups.filter((p) => p !== hit);
        cfg.onPickup?.(hit);
      }
    }

    if (comet) {
      comet.x += comet.vx * dt;
      comet.y += comet.vy * dt;
      comet.trail.push({ x: comet.x, y: comet.y, life: 1 });
      for (const t of comet.trail) t.life -= dt * 1.4;
      comet.trail = comet.trail.filter((t) => t.life > 0);
      if (comet.x < -200 || comet.x > WORLD_W + 200) spawnComet();
      else if (!landing && !blocked() && Math.hypot(comet.x - ship.x, comet.y - ship.y) < 75) {
        comet = null;
        cfg.sfx?.comet?.();
        cfg.onComet?.();
      }
    }

    if (!landing) {
      const n = objects.find((o) => Math.hypot(o.x - ship.x, o.y - ship.y) < o.r + 90) || null;
      if (n !== near) {
        near = n;
        updatePrompt();
        if (n) cfg.onNear?.(n);
      }
    }

    const follow = landing ? landing.obj : ship;
    const k = 1 - Math.exp(-(landing ? 6 : 4) * dt);
    cam.x += (follow.x - cam.x) * k;
    cam.y += (follow.y - cam.y) * k;

    if (takeoffT > 0) takeoffT = Math.max(0, takeoffT - dt);
    if (landing) {
      landing.t += dt;
      if (landing.t >= LAND_TIME && !landing.done) { landing.done = true; cfg.onLand(landing.obj); }
    }
  }

  /* ---------- Draw (WebGL) ---------- */
  function draw(t) {
    const z = zoom();
    const q = quality;
    // world → device pixels
    const sx = (wx) => ((wx - cam.x) * z + W / 2) * q;
    const sy = (wy) => ((wy - cam.y) * z + H / 2) * q;
    const s = z * q;
    const spr = R.sprite;

    R.begin();

    for (const L of starLayers) {
      for (const st of L.stars) {
        const x = mod(st.u * W * 1.5 - cam.x * L.p * z, W) * q;
        const y = mod(st.v * H * 1.5 - cam.y * L.p * z, H) * q;
        const a = 0.35 + 0.65 * Math.abs(Math.sin(st.tw + t * 0.7));
        spr(T.dot, x, y, st.r * 2 * q, st.r * 2 * q, 0, 1, 1, 1, a);
      }
    }
    for (const n of nebulae) {
      const nt = nebulaTex[n.v];
      if (nt) spr(nt, sx(n.x), sy(n.y), n.r * 2.4 * s, n.r * 2.4 * s, n.rot, 1, 1, 1, 0.55);
      else spr(T.glow, sx(n.x), sy(n.y), n.r * 2 * s, n.r * 2 * s, 0, n.c[0], n.c[1], n.c[2], 0.22);
    }

    // world border
    const bx0 = sx(0); const by0 = sy(0); const bx1 = sx(WORLD_W); const by1 = sy(WORLD_H);
    const lw = 3 * q;
    spr(T.white, (bx0 + bx1) / 2, by0, bx1 - bx0, lw, 0, 0.48, 0.84, 1, 0.18);
    spr(T.white, (bx0 + bx1) / 2, by1, bx1 - bx0, lw, 0, 0.48, 0.84, 1, 0.18);
    spr(T.white, bx0, (by0 + by1) / 2, lw, by1 - by0, 0, 0.48, 0.84, 1, 0.18);
    spr(T.white, bx1, (by0 + by1) / 2, lw, by1 - by0, 0, 0.48, 0.84, 1, 0.18);

    for (const r of rocks) spr(art.comet, sx(r.x), sy(r.y), r.r * 2.4 * s, r.r * 2 * s, r.rot, 0.62, 0.52, 0.45, 1);

    for (const o of objects) {
      const x = sx(o.x);
      const y = sy(o.y);
      const R2 = o.r * 2 * s;
      if (x < -R2 * 3 || y < -R2 * 3 || x > W * q + R2 * 3 || y > H * q + R2 * 3) continue; // off-screen
      if (o.halo) {
        const pulse = 1 + Math.sin(t * 2) * 0.06;
        spr(T.glow, x, y, R2 * 2.4 * pulse, R2 * 2.4 * pulse, 0, o.halo[0], o.halo[1], o.halo[2], 0.55, true);
      }
      if (o.kind === 'gate') {
        for (let i = 0; i < 4; i++) {
          const c = hsl(o.hue + i * 25, 100, 70);
          const d = (o.r - i * 12) * 2 * s;
          spr(T.gateArc, x, y, d, d * 0.9, t * (0.6 + i * 0.3), c[0], c[1], c[2], 0.75 - i * 0.12);
        }
        spr(T.glow, x, y, o.r * 1.2 * s, o.r * 1.2 * s, 0, 0.8, 0.6, 1, 0.8, true);
      } else {
        const size = o.r * 3.2 * s;
        spr(o.tex, x, y, size, size);
      }
      if (o.stage === 0 && !o.locked) {
        for (let i = 0; i < 3; i++) {
          const d = (o.r + 10 + i * 5) * 2 * s;
          spr(T.arc, x, y, d, d, t * 1.2 + (i * Math.PI * 2) / 3, 0.7, 0.53, 1, 0.75);
        }
      }
      if (o.stage === 2) {
        for (let i = 0; i < 6; i++) {
          const a = t * 0.6 + (i * Math.PI * 2) / 6;
          const tw = 10 + Math.sin(t * 5 + i) * 4;
          spr(T.dot, x + Math.cos(a) * (o.r + 24) * s, y + Math.sin(a) * (o.r + 24) * s, tw * s, tw * s, 0, 1, 0.9, 0.5, 1, true);
        }
      }
      if (o.locked) {
        const d = (o.r + 20) * 2 * s;
        spr(T.dashRing, x, y, d, d, t * 0.3, 0.48, 0.84, 1, 0.35 + Math.sin(t * 3) * 0.15);
      }
      if (o.mail) {
        spr(T.glow, x, y - (o.r + 34) * s, 90 * s, 90 * s, 0, 1, 0.75, 0.2, 0.5 + Math.sin(t * 4) * 0.2, true);
        spr(art.beacon, x, y - (o.r + 34 - Math.sin(t * 4) * 6) * s, 46 * s, 46 * s);
      }
      const lw2 = o.label.w / TEX_SCALE;
      const lh = o.label.h / TEX_SCALE;
      spr(o.label, x, y + (o.r + 14 + lh / 2) * s, lw2 * s, lh * s);
    }

    for (const p of pickups) {
      const x = sx(p.x);
      const y = sy(p.y);
      if (x < -100 || y < -100 || x > W * q + 100 || y > H * q + 100) continue;
      const pulse = 1 + Math.sin(t * 3 + p.ph) * 0.15;
      if (p.kind === 'shard') {
        spr(T.glow, x, y, 70 * s * pulse, 70 * s * pulse, 0, 1, 0.85, 0.4, 0.55, true);
        spr(art.shard, x, y, 30 * s, 30 * s, t * 0.8 + p.ph);
      } else {
        spr(T.glow, x, y, 150 * s * pulse, 150 * s * pulse, 0, 1, 0.75, 0.3, 0.6, true);
        spr(art.chest, x, y + Math.sin(t * 2 + p.ph) * 6 * s, 64 * s, 56 * s);
      }
    }

    if (comet) {
      for (const p of comet.trail) {
        const c = hsl(185 + (1 - p.life) * 80, 100, 75);
        const d = (6 + p.life * 28) * s;
        spr(T.dot, sx(p.x), sy(p.y), d, d, 0, c[0], c[1], c[2], p.life * 0.6, true);
      }
      spr(T.glow, sx(comet.x), sy(comet.y), 140 * s, 140 * s, 0, 0.6, 1, 1, 0.5, true);
      spr(art.comet, sx(comet.x), sy(comet.y), 52 * s, 52 * s, t * 0.5);
    }

    for (const p of particles) {
      const d = (p.size * p.life + 1) * 2.4 * s;
      spr(T.dot, sx(p.x), sy(p.y), d, d, 0, p.c[0], p.c[1], p.c[2], p.life, true);
    }

    // ship
    const shipX = sx(ship.x);
    const shipY = sy(ship.y) + Math.sin(t * 3) * 2 * s;
    spr(T.glow, shipX, shipY, 90 * s, 90 * s, 0, 0.48, 0.84, 1, 0.35, true);
    spr(art.ship, shipX, shipY, 76 * s, 57 * s, ship.angle);

    if (!landing) {
      const tgt = objects.find((o) => o.id === target);
      if (tgt && tgt !== near) drawPointer(tgt, [1, 0.82, 0.4], tgt.tex || T.glow, z, t);
      if (comet) drawPointer({ x: comet.x, y: comet.y, r: 20 }, [0.48, 0.94, 1], art.comet, z, t);
      if (scanner >= 2) {
        const chests = pickups.filter((p) => p.kind === 'chest');
        const nearest = chests.sort((a, b) => Math.hypot(a.x - ship.x, a.y - ship.y) - Math.hypot(b.x - ship.x, b.y - ship.y))[0];
        if (nearest) drawPointer({ x: nearest.x, y: nearest.y, r: 30 }, [1, 0.6, 0.25], art.chest, z, t);
      }
    }

    const fade = landing
      ? clamp((landing.t / LAND_TIME - 0.5) * 2, 0, 1)
      : takeoffT > 0 ? clamp((takeoffT / TAKEOFF_TIME) * 1.4 - 0.4, 0, 1) : 0;
    if (fade > 0) spr(T.white, (W * q) / 2, (H * q) / 2, W * q, H * q, 0, 1, 1, 1, fade);
    R.end();
  }

  function drawPointer(o, c, icon, z, t) {
    const q = quality;
    const px = (o.x - cam.x) * z + W / 2;
    const py = (o.y - cam.y) * z + H / 2;
    const m = 60;
    const top = 190; // below topbar + Pi panel
    if (px > m && px < W - m && py > top && py < H - m) {
      const d = ((o.r + 34) * z + Math.sin(t * 4) * 4) * 2 * q;
      R.sprite(shared.T.ring, px * q, py * q, d, d, 0, c[0], c[1], c[2], 0.5 + Math.sin(t * 4) * 0.3);
      return;
    }
    const a = Math.atan2(py - H / 2, px - W / 2);
    const ex = clamp(px, m, W - 95) * q; // keep clear of the right-hand HUD buttons
    const ey = clamp(py, top, H - m) * q;
    R.sprite(shared.T.arrow, ex, ey, 76 * q, 76 * q, a, c[0], c[1], c[2], 1);
    R.sprite(icon, ex, ey, 30 * q, 30 * q);
  }

  function drawMinimap() {
    const mw = minimap.width;
    const mh = minimap.height;
    mctx.clearRect(0, 0, mw, mh);
    mctx.fillStyle = 'rgba(5,8,25,0.6)';
    mctx.fillRect(0, 0, mw, mh);
    const kx = mw / WORLD_W;
    const ky = mh / WORLD_H;
    for (const o of objects) {
      mctx.fillStyle = o.dark ? '#ff4f7a' : o.locked ? 'rgba(255,255,255,0.3)' : o.kind === 'gate' ? '#b388ff' : `hsl(${o.hue}, 80%, 65%)`;
      mctx.beginPath();
      mctx.arc(o.x * kx, o.y * ky, o.id === target ? 9 : 6, 0, Math.PI * 2);
      mctx.fill();
    }
    if (comet) { mctx.fillStyle = '#9ff'; mctx.fillRect(comet.x * kx - 4, comet.y * ky - 4, 8, 8); }
    if (scanner >= 1) {
      mctx.fillStyle = '#ffb347';
      for (const p of pickups) if (p.kind === 'chest') mctx.fillRect(p.x * kx - 6, p.y * ky - 6, 12, 12);
    }
    mctx.fillStyle = '#fff';
    mctx.beginPath();
    mctx.arc(ship.x * kx, ship.y * ky, 6, 0, Math.PI * 2);
    mctx.fill();
    const z = zoom();
    mctx.strokeStyle = 'rgba(255,255,255,0.5)';
    mctx.lineWidth = 2;
    mctx.strokeRect((cam.x - W / 2 / z) * kx, (cam.y - H / 2 / z) * ky, (W / z) * kx, (H / z) * ky);
  }

  let raf = 0;
  let last = performance.now();
  let frame = 0;
  let slow = 0;
  const loop = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!document.hidden && !R.lost) {
      update(dt);
      draw(now / 1000);
      if (frame++ % 6 === 0) drawMinimap();
      // Adaptive quality: ~2 s below 40 fps → fewer pixels.
      slow = dt > 1 / 40 ? slow + 1 : Math.max(0, slow - 1);
      if (slow > 120 && quality > 1) {
        quality = Math.max(1, quality - 0.5);
        slow = 0;
        resize();
        if (quality === 1) reportSlow(); // remember: this device needs the power-saving mode
      }
    }
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);

  return {
    destroy() {
      cancelAnimationFrame(raf);
      removeEventListener('resize', resize);
      removeEventListener('keydown', onKeyDown);
      removeEventListener('keyup', onKeyUp);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      destroyed = true;
      for (const tx of ownTextures) R.deleteTexture(tx);
      canvas.remove();
    },
    shipPos: () => ({ x: ship.x, y: ship.y }),
    /** Put a pickup back (e.g. chest dialog closed without opening it). */
    restorePickup(p) { pickups.push({ ...p, disarmed: true }); },
  };
}
