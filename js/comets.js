// Knobel-Kometen: freiwillige Logikrätsel, die in keinem Planeten vorkommen.
import { h, svg, rnd, pick, shuffle, isPrime } from './util.js';
import { keypad, fieldInput } from './ui.js';
import { sfx } from './audio.js';
import { toast, shake } from './fx.js';
import { withIcon } from './icons.js';

/**
 * Every puzzle returns:
 *  { title, intro, el, keys?(k), hints: [{ text, act?() }], solve() }
 * and calls done() exactly once when solved.
 */
export function makeComet(L, done) {
  const type = pick(['detective', 'kenken', 'matches']);
  if (type === 'detective') return detective(L, done);
  if (type === 'kenken') return kenken(L, done);
  return matches(L, done);
}

const softApi = (onKeys) => ({
  keypad: (fn) => { onKeys(fn); return keypad(fn); },
  wrong: (msg) => { sfx.wrong(); if (msg) toast(msg, 'bad', 2600); },
});

/* ------------------------------------------------------------------ */
/* Zahlen-Detektiv                                                     */
/* ------------------------------------------------------------------ */

const digitsOf = (n) => String(n).split('').map(Number);
const qsum = (n) => digitsOf(n).reduce((a, b) => a + b, 0);
const range = (lo, hi) => Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);

function detectiveClues(t, L, lo, hi) {
  const out = [];
  const add = (text, test) => { if (test(t)) out.push({ text, test }); };
  const ds = digitsOf(t);
  add(t % 2 === 0 ? 'Ich bin gerade.' : 'Ich bin ungerade.', (n) => n % 2 === t % 2);
  if (t - lo > 5) { const b = Math.floor(rnd(lo, t - 1) / 5) * 5; add(`Ich bin größer als ${b}.`, (n) => n > b); }
  if (hi - t > 5) { const b = Math.ceil(rnd(t + 1, hi) / 5) * 5; add(`Ich bin kleiner als ${b}.`, (n) => n < b); }
  const S = qsum(t);
  add(`Meine Quersumme ist ${S}.`, (n) => qsum(n) === S);
  if (L < 6) add(`Meine Einerziffer ist ${t % 10}.`, (n) => n % 10 === t % 10);
  if (ds.length === 2) {
    const [z, e] = ds;
    if (z > e) add('Meine Zehnerziffer ist größer als meine Einerziffer.', (n) => Math.floor(n / 10) > n % 10);
    else if (z < e) add('Meine Zehnerziffer ist kleiner als meine Einerziffer.', (n) => Math.floor(n / 10) < n % 10);
    else add('Meine beiden Ziffern sind gleich.', (n) => Math.floor(n / 10) === n % 10);
  }
  const ks = L < 8 ? [3, 4, 5, 10] : [3, 4, 5, 6, 7, 9, 11];
  for (const k of ks) {
    if (t % k === 0) add(`Ich bin durch ${k} teilbar.`, (n) => n % k === 0);
    else if (L >= 8 && Math.random() < 0.4) add(`Ich bin nicht durch ${k} teilbar.`, (n) => n % k !== 0);
  }
  if (L >= 8) {
    add(isPrime(t) ? 'Ich bin eine Primzahl.' : 'Ich bin keine Primzahl.', (n) => isPrime(n) === isPrime(t));
    if (Number.isInteger(Math.sqrt(t))) add('Ich bin eine Quadratzahl.', (n) => Number.isInteger(Math.sqrt(n)));
  }
  if (L >= 12) {
    const P = ds.reduce((a, b) => a * b, 1);
    add(`Multiplizierst du meine Ziffern, kommt ${P} heraus.`, (n) => digitsOf(n).reduce((a, b) => a * b, 1) === P);
    const rev = Number([...String(t)].reverse().join(''));
    if (rev !== t) {
      const bigger = rev > t;
      add(`Liest du meine Ziffern rückwärts, werde ich ${bigger ? 'größer' : 'kleiner'}.`,
        (n) => { const r = Number([...String(n)].reverse().join('')); return bigger ? r > n : r < n; });
    }
  }
  if (ds.length === 3) {
    const distinct = new Set(ds).size === 3;
    add(distinct ? 'Alle meine Ziffern sind verschieden.' : 'Mindestens zwei meiner Ziffern sind gleich.',
      (n) => (new Set(digitsOf(n)).size === 3) === distinct);
    if (ds[0] === 2 * ds[2]) add('Meine Hunderterziffer ist doppelt so groß wie meine Einerziffer.', (n) => digitsOf(n)[0] === 2 * digitsOf(n)[2]);
  }
  return out;
}

export function detectivePuzzle(L) {
  const lo = L < 16 ? 10 : 100;
  const hi = L < 16 ? 99 : 999;
  const all = range(lo, hi);
  for (;;) {
    const t = rnd(lo, hi);
    let cand = all;
    const used = [];
    for (const c of shuffle(detectiveClues(t, L, lo, hi))) {
      const next = cand.filter(c.test);
      if (next.length < cand.length) { used.push(c); cand = next; }
      if (cand.length === 1) break;
    }
    if (cand.length !== 1) continue;
    for (let i = used.length - 1; i >= 0; i--) {
      const rest = used.filter((_, j) => j !== i);
      if (all.filter((n) => rest.every((c) => c.test(n))).length === 1) used.splice(i, 1);
    }
    if (used.length >= 2 && used.length <= 6) return { t, clues: used, all };
  }
}

function detective(L, done) {
  const { t, clues, all } = detectivePuzzle(L);
  let keyFn = null;
  const field = h('button', { type: 'button', class: 'ansfield' });
  const pad = fieldInput(softApi((fn) => { keyFn = fn; }), [{
    el: field,
    answer: t,
    wrongMsg: (v) => {
      if (!all.includes(v)) return `Gesucht ist eine ${digitWord(L)}stellige Zahl.`;
      const i = clues.findIndex((c) => !c.test(v));
      return i < 0 ? `${v} passt zu allen Hinweisen – aber es gibt noch eine andere Zahl. Prüfe genauer!` : `${v} passt nicht zu Hinweis ${i + 1}.`;
    },
  }], { maxLen: 3, onDone: () => { if (!givenUp) done(); } });
  let givenUp = false;
  const after = (k) => all.filter((n) => clues.slice(0, k).every((c) => c.test(n)));
  const listOrCount = (arr) => (arr.length <= 14 ? arr.join(', ') : `noch ${arr.length} Zahlen`);
  return {
    title: 'Zahlen-Detektiv',
    intro: `Eine geheimnisvolle ${digitWord(L)}stellige Zahl versteckt sich im Kometenschweif. Lies alle Hinweise – nur genau eine Zahl passt zu allen!`,
    el: h('div', { class: 'play' },
      h('div', { class: 'column' },
        h('ol', { class: 'clues' }, clues.map((c) => h('li', {}, c.text))),
        h('div', { class: 'answer' }, 'Ich bin ', field)),
      pad),
    keys: (k) => keyFn?.(k),
    hints: [
      { text: 'Fang mit dem Hinweis an, der am meisten ausschließt – zum Beispiel die Quersumme. Schreib dir die passenden Zahlen auf und streiche dann mit den anderen Hinweisen.' },
      { text: `Zu den ersten zwei Hinweisen passen: ${listOrCount(after(2))}.` },
      { text: `Mit allen Hinweisen außer dem letzten bleiben übrig: ${listOrCount(after(clues.length - 1))}.` },
    ],
    solve: () => { givenUp = true; field.textContent = t; field.classList.add('good'); },
  };
}
const digitWord = (L) => (L < 16 ? 'zwei' : 'drei');

/* ------------------------------------------------------------------ */
/* Rechen-Käfige (KenKen)                                              */
/* ------------------------------------------------------------------ */

function latin(n) {
  const rows = shuffle(range(0, n - 1));
  const cols = shuffle(range(0, n - 1));
  const sym = shuffle(range(1, n));
  return rows.map((r) => cols.map((c) => sym[(r + c) % n]));
}

function cageValue(op, vals) {
  if (op === '') return vals[0];
  if (op === '+') return vals.reduce((a, b) => a + b, 0);
  if (op === '×') return vals.reduce((a, b) => a * b, 1);
  if (op === '−') return Math.abs(vals[0] - vals[1]);
  const [a, b] = [Math.max(...vals), Math.min(...vals)];
  return a % b === 0 ? a / b : NaN;
}

function makeCages(n, sol, ops, singleP) {
  const owner = Array(n * n).fill(-1);
  const cages = [];
  for (const start of shuffle(range(0, n * n - 1))) {
    if (owner[start] >= 0) continue;
    const size = Math.random() < singleP ? 1 : rnd(2, 3);
    const cells = [start];
    owner[start] = cages.length;
    while (cells.length < size) {
      const nb = [];
      for (const c of cells) {
        const r = Math.floor(c / n);
        const col = c % n;
        for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const rr = r + dr;
          const cc = col + dc;
          if (rr >= 0 && cc >= 0 && rr < n && cc < n && owner[rr * n + cc] < 0) nb.push(rr * n + cc);
        }
      }
      if (!nb.length) break;
      const pickCell = pick(nb);
      owner[pickCell] = cages.length;
      cells.push(pickCell);
    }
    const vals = cells.map((c) => sol[Math.floor(c / n)][c % n]);
    let op = '';
    if (cells.length === 2) {
      const choices = ops.filter((o) => o !== '÷' || Math.max(...vals) % Math.min(...vals) === 0);
      op = pick(choices);
    } else if (cells.length === 3) op = pick(ops.filter((o) => o === '+' || o === '×'));
    cages.push({ cells, op, target: cageValue(op, vals) });
  }
  return { cages, owner };
}

/** Number of solutions (stops counting at 2). */
export function kenkenSolutions(n, cages, owner) {
  const grid = Array(n * n).fill(0);
  let count = 0;
  const ok = (idx) => {
    const cage = cages[owner[idx]];
    const vals = cage.cells.map((c) => grid[c]).filter(Boolean);
    if (vals.length === cage.cells.length) return cageValue(cage.op, vals) === cage.target;
    const left = cage.cells.length - vals.length;
    if (cage.op === '+') return vals.reduce((a, b) => a + b, 0) + left <= cage.target;
    if (cage.op === '×') return cage.target % vals.reduce((a, b) => a * b, 1) === 0;
    return true;
  };
  const rec = (idx) => {
    if (count > 1) return;
    if (idx === n * n) { count++; return; }
    const r = Math.floor(idx / n);
    const c = idx % n;
    for (let v = 1; v <= n; v++) {
      let clash = false;
      for (let k = 0; k < n && !clash; k++) clash = grid[r * n + k] === v || grid[k * n + c] === v;
      if (clash) continue;
      grid[idx] = v;
      if (ok(idx)) rec(idx + 1);
      grid[idx] = 0;
    }
  };
  rec(0);
  return count;
}

export function kenkenPuzzle(L) {
  const n = L < 10 ? 3 : L < 30 ? 4 : 5;
  const ops = L < 10 ? ['+'] : L < 20 ? ['+', '−'] : ['+', '−', '×', '÷'];
  for (let attempt = 0; ; attempt++) {
    const sol = latin(n);
    const { cages, owner } = makeCages(n, sol, ops, Math.min(0.6, 0.1 + attempt * 0.01));
    if (kenkenSolutions(n, cages, owner) === 1) return { n, sol, cages, owner };
  }
}

function kenken(L, done) {
  const { n, sol, cages, owner } = kenkenPuzzle(L);
  const vals = Array(n * n).fill(0);
  const given = new Set();
  let sel = 0;
  let finished = false;
  const solAt = (i) => sol[Math.floor(i / n)][i % n];
  const thick = '3px solid #22170a';
  const thin = '1px solid rgba(0,0,0,0.18)';
  const cells = range(0, n * n - 1).map((i) => {
    const r = Math.floor(i / n);
    const c = i % n;
    const cage = cages[owner[i]];
    const leader = Math.min(...cage.cells) === i;
    const diff = (rr, cc) => rr < 0 || cc < 0 || rr >= n || cc >= n || owner[rr * n + cc] !== owner[i];
    const val = h('span', { class: 'kk-val' });
    const el = h('button', {
      type: 'button', class: 'kk-cell',
      style: { borderTop: diff(r - 1, c) ? thick : thin, borderBottom: diff(r + 1, c) ? thick : thin, borderLeft: diff(r, c - 1) ? thick : thin, borderRight: diff(r, c + 1) ? thick : thin },
      onClick: () => { sel = i; sfx.click(); draw(); },
    }, leader ? h('span', { class: 'kk-label' }, `${cage.target}${cage.op}`) : null, val);
    el.val = val;
    return el;
  });
  const draw = () => cells.forEach((el, i) => {
    el.val.textContent = vals[i] || '';
    el.classList.toggle('sel', i === sel && !finished);
    el.classList.toggle('given', given.has(i));
  });
  const check = () => {
    if (finished) return;
    if (vals.some((v) => !v)) { toast('Es fehlen noch Zahlen.', 'bad'); sfx.wrong(); return; }
    const wrong = vals.filter((v, i) => v !== solAt(i)).length;
    if (wrong) { sfx.wrong(); shake(grid); toast(`${wrong} ${wrong === 1 ? 'Feld stimmt' : 'Felder stimmen'} noch nicht.`, 'bad'); return; }
    finished = true;
    draw();
    done();
  };
  const keys = (k) => {
    if (finished) return;
    if (k === 'ok') return check();
    if (given.has(sel)) return;
    if (k === 'back') vals[sel] = 0;
    else if (Number(k) >= 1 && Number(k) <= n) { vals[sel] = Number(k); sel = Math.min(n * n - 1, sel + 1); }
    draw();
  };
  const grid = h('div', { class: 'kk', style: { '--n': n } }, cells);
  draw();
  const opsText = { '+': 'Plus', '−': 'Minus (Abstand)', '×': 'Mal', '÷': 'Geteilt' };
  const usedOps = [...new Set(cages.map((c) => c.op).filter(Boolean))].map((o) => `${o} = ${opsText[o]}`).join(', ');
  return {
    title: 'Rechen-Käfige',
    intro: `Trage in jede Zeile und jede Spalte die Zahlen 1 bis ${n} genau einmal ein. Die Zahlen in einem dick umrandeten Käfig ergeben das Ergebnis oben links (${usedOps}).`,
    el: h('div', { class: 'play' }, grid, keypad(keys)),
    keys,
    hints: [
      { text: `Fang mit Käfigen aus nur einem Feld an – dort steht die Zahl schon! Dann: In jeder Zeile und Spalte kommt jede Zahl von 1 bis ${n} genau einmal vor.` },
      { text: 'Suche Käfige mit wenigen Möglichkeiten: „3+“ in zwei Feldern geht nur mit 1 und 2. Und wenn in einer Zeile nur noch ein Feld frei ist, fehlt genau eine Zahl.' },
      {
        text: 'Ich verrate dir zwei Felder – sie sind jetzt grün.',
        act: () => {
          for (const i of shuffle(range(0, n * n - 1)).filter((i) => vals[i] !== solAt(i)).slice(0, 2)) { vals[i] = solAt(i); given.add(i); }
          draw();
        },
      },
    ],
    solve: () => { finished = true; range(0, n * n - 1).forEach((i) => { vals[i] = solAt(i); }); draw(); },
  };
}

/* ------------------------------------------------------------------ */
/* Streichholzrätsel                                                   */
/* ------------------------------------------------------------------ */

const DIGITS = ['abcdef', 'bc', 'abdeg', 'abcdg', 'bcfg', 'acdfg', 'acdefg', 'abc', 'abcdefg', 'abcdfg'];
const SEGS = 'abcdefg';
const PATTERN = Object.fromEntries(DIGITS.map((p, d) => [p, d]));
const SEG_LINES = {
  a: [10, 5, 40, 5], b: [45, 10, 45, 40], c: [45, 50, 45, 80], d: [10, 85, 40, 85],
  e: [5, 50, 5, 80], f: [5, 10, 5, 40], g: [10, 45, 40, 45],
};

const digitSlot = (d) => ({ kind: 'd', on: new Set(DIGITS[d]) });
const numSlots = (x) => String(x).split('').map((ch) => digitSlot(Number(ch)));
const clone = (st) => st.map((s) => (s.kind === 'd' ? { kind: 'd', on: new Set(s.on) } : { ...s }));
const patternOf = (s) => SEGS.split('').filter((x) => s.on.has(x)).join('');

/** Movable positions: [slotIndex, segment] (operator: 'v' = vertical stick of +). */
function positions(st) {
  const out = [];
  st.forEach((s, i) => {
    if (s.kind === 'd') for (const x of SEGS) out.push([i, x]);
    if (s.kind === 'op') out.push([i, 'v']);
  });
  return out;
}
const isOn = (st, [i, x]) => (st[i].kind === 'op' ? st[i].v : st[i].on.has(x));
function setPos(st, [i, x], on) {
  if (st[i].kind === 'op') st[i].v = on;
  else if (on) st[i].on.add(x);
  else st[i].on.delete(x);
}

/** Parse to numbers; null if a digit shape is invalid or a number has a leading zero. */
function evaluate(st) {
  const parts = [[]];
  let op = null;
  for (const s of st) {
    if (s.kind === 'd') {
      const d = PATTERN[patternOf(s)];
      if (d === undefined) return null;
      parts[parts.length - 1].push(d);
    } else {
      if (s.kind === 'op') op = s.v ? '+' : '−';
      parts.push([]);
    }
  }
  if (parts.some((p) => p.length > 1 && p[0] === 0)) return null;
  const [a, b, c] = parts.map((p) => Number(p.join('')));
  return { a, b, c, op, ok: (op === '+' ? a + b : a - b) === c };
}

function moves(st) {
  const pos = positions(st);
  const out = [];
  for (const from of pos) {
    if (!isOn(st, from)) continue;
    for (const to of pos) {
      if (isOn(st, to)) continue;
      const next = clone(st);
      setPos(next, from, false);
      setPos(next, to, true);
      out.push({ from, to, st: next });
    }
  }
  return out;
}

export function matchesPuzzle(L) {
  for (;;) {
    let a;
    let b;
    let plus = Math.random() < 0.5;
    if (L < 12) { a = rnd(0, 9); b = rnd(0, 9); if (plus && a + b > 9) continue; }
    else if (L < 20) { a = rnd(0, 9); b = rnd(0, 9); }
    else { a = rnd(10, 39); b = rnd(1, 9); }
    if (!plus && a < b) [a, b] = [b, a];
    const c = plus ? a + b : a - b;
    const solved = [...numSlots(a), { kind: 'op', v: plus }, ...numSlots(b), { kind: 'eq' }, ...numSlots(c)];
    const starts = moves(solved).filter((m) => { const e = evaluate(m.st); return e && !e.ok; });
    if (!starts.length) continue;
    const start = pick(starts).st;
    const solutions = moves(start).filter((m) => evaluate(m.st)?.ok);
    if (solutions.length) return { start, solutions };
  }
}

function matches(L, done) {
  const { start, solutions } = matchesPuzzle(L);
  let st = clone(start);
  let picked = null;
  let busy = false;
  let hintSlot = -1;
  let hintMove = null;
  const row = h('div', { class: 'matches' });
  const same = (p, q) => p && q && p[0] === q[0] && p[1] === q[1];

  const seg = (i, x, coords, fixed = false) => {
    const pos = [i, x];
    const on = fixed || isOn(st, pos);
    const [x1, y1, x2, y2] = coords;
    const cls = on
      ? `stick${fixed ? ' fixed' : ''}${same(pos, picked) ? ' lifted' : ''}${same(pos, hintMove?.from) ? ' hint-stick' : ''}`
      : `ghost${same(pos, hintMove?.to) ? ' hint-ghost' : ''}`;
    const g = svg('g', { class: 'seg' },
      svg('line', { x1, y1, x2, y2, class: 'hit' }),
      svg('line', { x1, y1, x2, y2, class: cls }),
      on && !same(pos, picked) ? svg('circle', { cx: x2, cy: y2, r: 4.5, class: 'head' }) : null);
    if (!fixed) g.addEventListener('click', () => tap(pos, on));
    return g;
  };

  function draw() {
    row.replaceChildren(...st.map((s, i) => {
      if (s.kind === 'd') {
        return svg('svg', { viewBox: '-6 -6 62 102', class: 'm-slot' + (i === hintSlot ? ' hint-slot' : '') },
          SEGS.split('').map((x) => seg(i, x, SEG_LINES[x])));
      }
      if (s.kind === 'op') {
        return svg('svg', { viewBox: '-4 -6 48 102', class: 'm-slot op' + (i === hintSlot ? ' hint-slot' : '') },
          seg(i, 'h', [5, 45, 35, 45], true), seg(i, 'v', [20, 30, 20, 60]));
      }
      return svg('svg', { viewBox: '-4 -6 48 102', class: 'm-slot op' }, seg(i, 'e1', [5, 38, 35, 38], true), seg(i, 'e2', [5, 54, 35, 54], true));
    }));
  }

  function tap(pos, on) {
    if (busy) return;
    if (on) {
      picked = same(pos, picked) ? null : pos;
      sfx.click();
      draw();
      return;
    }
    if (!picked) { toast('Tippe zuerst ein Streichholz an, um es aufzuheben.'); return; }
    setPos(st, picked, false);
    setPos(st, pos, true);
    picked = null;
    sfx.tick();
    draw();
    if (evaluate(st)?.ok) { busy = true; done(); return; }
    busy = true;
    sfx.wrong();
    toast('Hmm, das stimmt noch nicht. Ich lege es zurück.', 'bad');
    setTimeout(() => { st = clone(start); busy = false; draw(); }, 1100);
  }

  draw();
  const first = solutions[0];
  return {
    title: 'Streichholzrätsel',
    intro: 'Diese Rechnung stimmt nicht! Lege genau EIN Streichholz um, damit sie stimmt. Tippe ein Streichholz an, um es aufzuheben, dann tippe auf einen freien Platz.',
    el: h('div', { class: 'column' }, row, h('button', { type: 'button', class: 'btn ghost small', onClick: () => { st = clone(start); picked = null; draw(); } }, ...withIcon('rotate-ccw', 'Zurücksetzen'))),
    hints: [
      { text: 'Ziffern verwandeln sich mit einem Streichholz: 9 ↔ 8, 6 ↔ 8, 0 ↔ 8, 5 ↔ 6, 5 ↔ 9, 3 ↔ 9, 1 ↔ 7. Und aus + wird −, wenn du den senkrechten Stab wegnimmst!' },
      { text: 'Das Streichholz, das du umlegen musst, liegt in der gelb markierten Figur.', act: () => { hintSlot = first.from[0]; draw(); } },
      { text: 'Das blaue Streichholz muss auf den blau gestrichelten Platz.', act: () => { hintSlot = -1; hintMove = first; draw(); } },
    ],
    solve: () => { busy = true; st = clone(first.st); picked = null; hintMove = null; draw(); },
  };
}
