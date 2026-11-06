import { h, rnd, pick, weighted } from '../util.js';
import { fieldInput } from '../ui.js';

const N = 6;
const arr = (f) => Array.from({ length: N }, (_, n) => f(n));
const PRIMES = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71];

function recur(first, next) {
  const s = [...first];
  while (s.length < N) s.push(next(s));
  return s;
}

// Each generator: min level, optional max level, and a factory returning { seq, rule }.
const GENS = [
  { min: 1, max: 14, f: (L) => { const d = rnd(1, Math.min(2 + L, 10)); const s = rnd(0, 8 + L * 2); return { seq: arr((n) => s + n * d), rule: `immer +${d}` }; } },
  { min: 2, max: 16, f: (L) => { const d = rnd(1, Math.min(1 + L, 10)); const s = d * 6 + rnd(0, 15 + L * 3); return { seq: arr((n) => s - n * d), rule: `immer −${d}` }; } },
  { min: 4, f: (L) => { const d = rnd(11, 20 + L * 3); const s = rnd(1, 99); return { seq: arr((n) => s + n * d), rule: `immer +${d}` }; } },
  { min: 4, f: () => { const a = rnd(3, 9); const b = rnd(1, a - 1); const s = rnd(1, 20); return { seq: recur([s], (q) => q[q.length - 1] + (q.length % 2 ? a : -b)), rule: `abwechselnd +${a} und −${b}` }; } },
  { min: 5, f: () => { const s = rnd(1, 5); return { seq: arr((n) => s * 2 ** n), rule: 'immer ×2 (verdoppeln)' }; } },
  { min: 7, f: () => { const s = rnd(1, 10); const k = rnd(1, 3); return { seq: recur([s], (q) => q[q.length - 1] + k + q.length - 1), rule: `die Sprünge wachsen: +${k}, +${k + 1}, +${k + 2} …` }; } },
  { min: 7, f: (L) => { const m = rnd(1, 3 + Math.floor(L / 3)); return { seq: arr((n) => (m + n) ** 2), rule: 'Quadratzahlen: n · n' }; } },
  { min: 8, f: () => { const s = rnd(1, 3); return { seq: arr((n) => s * 3 ** n), rule: 'immer ×3' }; } },
  { min: 8, f: () => { const m = rnd(1, 5); return { seq: arr((n) => m * 2 ** (N - 1 - n)), rule: 'immer ÷2 (halbieren)' }; } },
  { min: 11, f: () => { const a = rnd(1, 5); const b = rnd(a, a + 5); return { seq: recur([a, b], (q) => q[q.length - 1] + q[q.length - 2]), rule: 'jede Zahl ist die Summe der zwei Zahlen davor (wie bei Fibonacci)' }; } },
  { min: 11, f: () => { const s = rnd(1, 4); return { seq: recur([s], (q) => q[q.length - 1] * 2 + 1), rule: 'immer ×2 und dann +1' }; } },
  { min: 12, f: () => { const a = rnd(1, 10); const d1 = rnd(2, 6); const b = rnd(40, 70); const d2 = rnd(2, 7); return { seq: arr((n) => (n % 2 ? b - ((n - 1) / 2) * d2 : a + (n / 2) * d1)), rule: `zwei Folgen ineinander: eine macht +${d1}, die andere −${d2}` }; } },
  { min: 15, f: () => { const m = rnd(1, 3); return { seq: arr((n) => (m + n) ** 3), rule: 'Kubikzahlen: n · n · n' }; } },
  { min: 15, f: () => { const i = rnd(0, 8); return { seq: PRIMES.slice(i, i + N), rule: 'Primzahlen – nur durch 1 und sich selbst teilbar' }; } },
  { min: 16, f: () => { const s = rnd(1, 20); const d = rnd(1, 5); const dd = rnd(2, 4); return { seq: recur([s], (q) => q[q.length - 1] + d + dd * (q.length - 1)), rule: `die Abstände wachsen jedes Mal um ${dd}` }; } },
  { min: 18, f: () => { const s = rnd(2, 5); const m = pick([2, 3]); return { seq: recur([s], (q) => q[q.length - 1] * m - 1), rule: `immer ×${m} und dann −1` }; } },
  { min: 20, f: () => { const a = rnd(0, 2); const b = rnd(1, 2); const c = rnd(1, 3); return { seq: recur([a, b, c], (q) => q[q.length - 1] + q[q.length - 2] + q[q.length - 3]), rule: 'Summe der drei Zahlen davor' }; } },
  { min: 22, f: () => { const s = rnd(1, 3); return { seq: recur([s], (q) => q[q.length - 1] * (q.length + 1)), rule: 'mal 2, mal 3, mal 4, mal 5 …' }; } },
  { min: 22, f: () => { const m = rnd(2, 6); return { seq: arr((n) => (m + n) ** 2 - 1), rule: 'Quadratzahlen minus 1' }; } },
  { min: 24, f: () => { const s = rnd(1, 5); const c = rnd(1, 4); return { seq: recur([s], (q) => (q.length % 2 ? q[q.length - 1] * 2 : q[q.length - 1] + c)), rule: `abwechselnd ×2 und +${c}` }; } },
];

function generate(L) {
  const eligible = GENS.filter((g) => L >= g.min && (!g.max || L <= g.max));
  for (;;) {
    const g = weighted(eligible.map((x) => [x.min >= L - 8 ? 3 : 1, x]));
    const res = g.f(L);
    if (res.seq.every((v) => Number.isInteger(v) && v >= 0 && v < 100000)) return res;
  }
}

export default {
  id: 'sequence',
  name: 'Code-Komet',
  topic: 'Zahlenfolgen & Muster',
  emoji: '☄️',
  hue: 195,
  unlock: 0,
  rounds: 5,
  intro: 'Hinter jedem Zahlencode steckt eine Regel. Finde sie und ergänze die fehlende Zahl.',
  hint: 'Schau dir die Abstände zwischen den Zahlen an: Wird immer gleich viel dazugezählt? Wird verdoppelt? Wachsen die Abstände? Manchmal hilft es, zwei Zahlen davor zusammenzuzählen.',

  create(stage, L, api) {
    const { seq, rule } = generate(L);
    const miss = L >= 9 && Math.random() < 0.3 ? rnd(1, N - 2) : N - 1;
    const field = h('button', { type: 'button', class: 'tile' });
    const tiles = seq.map((v, i) => (i === miss ? field : h('div', { class: 'tile' }, v)));
    stage.append(
      h('p', { class: 'task' }, miss === N - 1 ? 'Welche Zahl kommt als Nächstes?' : 'Welche Zahl fehlt im Code?'),
      h('div', { class: 'play' },
        h('div', { class: 'seq' }, tiles),
        fieldInput(api, [{ el: field, answer: seq[miss] }], { onDone: () => api.solved({ msg: `Regel: ${rule}` }) })));
  },
};
