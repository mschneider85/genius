import { pick } from './util.js';

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function starfield() {
  const c = document.getElementById('stars');
  const x = c.getContext('2d');
  let w, hgt, d, stars = [];
  function resize() {
    d = devicePixelRatio || 1;
    w = c.width = innerWidth * d;
    hgt = c.height = innerHeight * d;
    const n = Math.round((innerWidth * innerHeight) / 5500);
    stars = Array.from({ length: n }, () => ({
      x: Math.random() * w, y: Math.random() * hgt,
      r: (Math.random() * 1.3 + 0.3) * d, p: Math.random() * 6.28, s: 0.4 + Math.random() * 1.4,
    }));
  }
  function draw(t) {
    x.clearRect(0, 0, w, hgt);
    x.fillStyle = '#fff';
    for (const s of stars) {
      x.globalAlpha = 0.3 + 0.7 * Math.abs(Math.sin(s.p + t * 0.0005 * s.s));
      x.beginPath();
      x.arc(s.x, s.y, s.r, 0, 6.283);
      x.fill();
      s.y += 0.04 * s.s * d;
      if (s.y > hgt) s.y = 0;
    }
  }
  // The 2D starfield is only visible on plain screens: skip work while the WebGL world or a planet
  // landscape covers it, and draw at ~15 fps in power-saving mode.
  let lastDraw = 0;
  function frame(t) {
    const b = document.body;
    const covered = b.dataset.scene === 'world' || b.classList.contains('has-scenery');
    const interval = b.classList.contains('low-power') ? 66 : 0;
    if (!document.hidden && !covered && t - lastDraw >= interval) { draw(t); lastDraw = t; }
    requestAnimationFrame(frame);
  }
  resize();
  addEventListener('resize', resize);
  if (reducedMotion()) draw(0);
  else requestAnimationFrame(frame);
}

const fx = document.getElementById('fx');
const fc = fx.getContext('2d');
let parts = [];
let running = false;
const COLORS = ['#ffd166', '#06d6a0', '#4cc9f0', '#f72585', '#b388ff', '#ff9f1c'];

function sizeFx() {
  fx.width = innerWidth * (devicePixelRatio || 1);
  fx.height = innerHeight * (devicePixelRatio || 1);
}
sizeFx();
addEventListener('resize', sizeFx);

export function confetti(n = 60, ox = 0.5, oy = 0.45) {
  if (reducedMotion()) return;
  const d = devicePixelRatio || 1;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = (3 + Math.random() * 9) * d;
    parts.push({
      x: ox * fx.width, y: oy * fx.height,
      vx: Math.cos(a) * v, vy: Math.sin(a) * v - 6 * d,
      r: (3 + Math.random() * 4) * d, c: pick(COLORS),
      rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, life: 1,
    });
  }
  if (!running) { running = true; requestAnimationFrame(loop); }
}

function loop() {
  const d = devicePixelRatio || 1;
  fc.clearRect(0, 0, fx.width, fx.height);
  for (const p of parts) {
    p.x += p.vx; p.y += p.vy; p.vy += 0.35 * d; p.vx *= 0.985; p.rot += p.vr; p.life -= 0.011;
    fc.save();
    fc.globalAlpha = Math.max(0, p.life);
    fc.translate(p.x, p.y);
    fc.rotate(p.rot);
    fc.fillStyle = p.c;
    fc.fillRect(-p.r, -p.r / 2, p.r * 2, p.r);
    fc.restore();
  }
  parts = parts.filter((p) => p.life > 0 && p.y < fx.height + 60);
  if (parts.length) requestAnimationFrame(loop);
  else { running = false; fc.clearRect(0, 0, fx.width, fx.height); }
}

let toastTimer;
export function toast(msg, kind = '', ms = 1900) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'show ' + kind;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = ''; }, ms);
}

export function shake(el) {
  el.classList.remove('shake');
  void el.offsetWidth;
  el.classList.add('shake');
}
