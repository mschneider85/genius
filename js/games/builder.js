import { h, rnd, pick } from '../util.js';
import { fieldInput } from '../ui.js';

const W = 8;
const H = 8;
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

function perimeter(set) {
  let p = 0;
  for (const i of set) {
    const x = i % W;
    const y = Math.floor(i / W);
    for (const [dx, dy] of DIRS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H || !set.has(ny * W + nx)) p++;
    }
  }
  return p;
}

function connected(set) {
  if (!set.size) return false;
  const start = set.values().next().value;
  const seen = new Set([start]);
  const stack = [start];
  while (stack.length) {
    const i = stack.pop();
    const x = i % W;
    const y = Math.floor(i / W);
    for (const [dx, dy] of DIRS) {
      const nx = x + dx;
      const ny = y + dy;
      const j = ny * W + nx;
      if (nx >= 0 && ny >= 0 && nx < W && ny < H && set.has(j) && !seen.has(j)) { seen.add(j); stack.push(j); }
    }
  }
  return seen.size === set.size;
}

function isRect(set) {
  const xs = [...set].map((i) => i % W);
  const ys = [...set].map((i) => Math.floor(i / W));
  return (Math.max(...xs) - Math.min(...xs) + 1) * (Math.max(...ys) - Math.min(...ys) + 1) === set.size;
}

/** True if the shape encloses empty cells (their edges would count as "inner fence"). */
function hasHole(set) {
  const seen = new Set();
  const stack = [];
  for (let i = 0; i < W * H; i++) {
    const x = i % W;
    const y = Math.floor(i / W);
    if ((x === 0 || y === 0 || x === W - 1 || y === H - 1) && !set.has(i)) { seen.add(i); stack.push(i); }
  }
  while (stack.length) {
    const i = stack.pop();
    const x = i % W;
    const y = Math.floor(i / W);
    for (const [dx, dy] of DIRS) {
      const nx = x + dx;
      const ny = y + dy;
      const j = ny * W + nx;
      if (nx >= 0 && ny >= 0 && nx < W && ny < H && !set.has(j) && !seen.has(j)) { seen.add(j); stack.push(j); }
    }
  }
  return seen.size + set.size < W * H;
}

function randomShape(A, snake = false) {
  for (;;) {
    const s = growShape(A, snake);
    if (!hasHole(s)) return s;
  }
}

function growShape(A, snake) {
  const s = new Set([Math.floor(H / 2) * W + Math.floor(W / 2)]);
  let last = [...s][0];
  let guard = 0;
  while (s.size < A && guard++ < 5000) {
    const c = snake ? last : pick([...s]);
    const [dx, dy] = pick(DIRS);
    const nx = (c % W) + dx;
    const ny = Math.floor(c / W) + dy;
    if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
    const j = ny * W + nx;
    if (s.has(j)) continue;
    if (snake && DIRS.filter(([ex, ey]) => s.has((ny + ey) * W + nx + ex) && nx + ex >= 0 && nx + ex < W).length > 1) continue;
    s.add(j);
    last = j;
  }
  return s;
}

function pickMode(L) {
  if (L <= 3) return 'area';
  if (L <= 8) return pick(['rect', 'rect', 'measureArea']);
  if (L <= 15) return pick(['free', 'measurePerim', 'rect']);
  return pick(['free', 'free', 'measurePerim']);
}

export default {
  id: 'builder',
  name: 'Geometra',
  topic: 'Fläche & Umfang',
  emoji: '🏗️',
  hue: 120,
  unlock: 15,
  rounds: 5,
  intro: 'Baue Landeplätze: Fläche = Anzahl der Kästchen, Umfang = Kästchenseiten am Rand.',
  hint: 'Fläche: Kästchen zählen. Umfang: Kästchenseiten am Rand zählen. Lange, dünne Formen haben mehr Umfang als quadratische.',

  create(stage, L, api) {
    const mode = pickMode(L);

    if (mode === 'measureArea' || mode === 'measurePerim') {
      const shape = randomShape(rnd(5, Math.min(18, 6 + Math.floor(L / 2))));
      const askPerim = mode === 'measurePerim';
      const answer = askPerim ? perimeter(shape) : shape.size;
      const grid = h('div', { class: 'bgrid' }, Array.from({ length: W * H }, (_, i) => h('div', { class: 'bcell' + (shape.has(i) ? ' on' : '') })));
      const field = h('button', { type: 'button', class: 'ansfield' });
      stage.append(
        h('p', { class: 'task' }, askPerim ? 'Wie lang ist der Zaun (Umfang) um diesen Landeplatz? Zähle die Kästchenseiten am Rand.' : 'Wie groß ist die Fläche dieses Landeplatzes (Kästchen)?'),
        h('div', { class: 'play' }, h('div', { class: 'column' }, grid, h('div', { class: 'answer' }, askPerim ? 'Umfang = ' : 'Fläche = ', field)),
          fieldInput(api, [{ el: field, answer }], { onDone: () => api.solved() })));
      return;
    }

    let A, P = null, rect = false, text;
    if (mode === 'area') {
      A = rnd(3, 5 + L);
      text = `Baue einen Landeplatz aus genau ${A} Kästchen. Alle müssen zusammenhängen.`;
    } else if (mode === 'rect') {
      const w = rnd(1, 5);
      const hh = rnd(2, 5);
      A = w * hh;
      P = 2 * (w + hh);
      rect = true;
      text = `Baue ein Rechteck mit Fläche ${A} und Umfang ${P}.`;
    } else {
      A = rnd(5, Math.min(20, 8 + Math.floor(L / 2)));
      const snake = L >= 16 && Math.random() < 0.3;
      const shape = randomShape(A, snake);
      A = shape.size;
      P = perimeter(shape);
      text = `Baue einen zusammenhängenden Landeplatz mit Fläche ${A} und Umfang ${P}.`;
    }
    const showArea = L < 16;
    const showPerim = L < 9;

    const set = new Set();
    const cells = Array.from({ length: W * H }, (_, i) => h('div', { class: 'bcell', 'data-i': i }));
    const grid = h('div', { class: 'bgrid paint' }, cells);
    const live = h('div', { class: 'live' });
    const update = () => {
      const parts = [];
      if (showArea) parts.push(`Fläche: ${set.size}`);
      if (showPerim) parts.push(`Umfang: ${perimeter(set)}`);
      live.textContent = parts.join('  ·  ');
    };
    let paint = null;
    const apply = (i) => {
      if (paint === set.has(i)) return;
      if (paint) set.add(i); else set.delete(i);
      cells[i].classList.toggle('on', paint);
      api.sfx.click();
      update();
    };
    grid.addEventListener('pointerdown', (e) => {
      const c = e.target.closest('.bcell');
      if (!c) return;
      e.preventDefault();
      grid.setPointerCapture(e.pointerId);
      const i = Number(c.dataset.i);
      paint = !set.has(i);
      apply(i);
    });
    grid.addEventListener('pointermove', (e) => {
      if (paint === null) return;
      const c = document.elementFromPoint(e.clientX, e.clientY)?.closest?.('.bcell');
      if (c && grid.contains(c)) apply(Number(c.dataset.i));
    });
    const end = () => { paint = null; };
    grid.addEventListener('pointerup', end);
    grid.addEventListener('pointercancel', end);

    const check = () => {
      if (!set.size) return;
      const a = set.size;
      const p = perimeter(set);
      const exact = L < 12;
      if (!connected(set)) api.wrong('Alle Kästchen müssen Seite an Seite zusammenhängen.');
      else if (a !== A) api.wrong(exact ? `Die Fläche ist ${a} – gebraucht wird ${A}.` : 'Die Fläche stimmt noch nicht.');
      else if (P !== null && p !== P) api.wrong(exact ? `Fläche stimmt! Aber der Umfang ist ${p} statt ${P}.` : 'Fläche stimmt – der Umfang noch nicht.');
      else if (rect && !isRect(set)) api.wrong('Das ist noch kein Rechteck.');
      else api.solved({ msg: P !== null ? `Fläche ${A}, Umfang ${P} – perfekt gebaut!` : undefined });
    };
    api.setKeys((k) => { if (k === 'ok') check(); });
    update();
    stage.append(
      h('p', { class: 'task' }, text),
      h('div', { class: 'play column' }, grid, live,
        h('div', { class: 'row' },
          h('button', { type: 'button', class: 'btn ghost', onClick: () => { set.clear(); cells.forEach((c) => c.classList.remove('on')); update(); } }, '🧹 Leeren'),
          h('button', { type: 'button', class: 'btn primary big', onClick: check }, '🏗️ Bauen'))));
  },
};
