import { h, rnd, pick, shuffle } from '../util.js';
import { fieldInput } from '../ui.js';

const ICON = { x: '📦', t: '🔺', c: '🔵' };
const NAME = { x: 'die Kiste', t: 'das Dreieck', c: 'die Kugel' };

const many = (k, n) => Array.from({ length: n }, () => ({ k }));

/** Split a weight into 1–3 random parts (from level 3 on) so kids must add first. */
function weights(v, L) {
  if (v <= 0) return [];
  const parts = v > 4 && L >= 3 ? rnd(1, Math.min(3, Math.floor(v / 2))) : 1;
  const out = [];
  let rest = v;
  for (let i = parts - 1; i > 0; i--) {
    const p = rnd(1, rest - i);
    out.push(p);
    rest -= p;
  }
  out.push(rest);
  return shuffle(out).map((w) => ({ w }));
}

function make(L) {
  const type = L <= 4 ? 1 : L <= 9 ? pick([1, 2, 2]) : L <= 15 ? pick([2, 3, 3]) : L <= 22 ? pick([3, 4, 4]) : pick([4, 5, 5]);
  if (type === 1) {
    const x = rnd(1, 4 + L * 2);
    const a = rnd(1, 4 + L * 2);
    return { scales: [{ l: [{ k: 'x' }, ...weights(a, L)], r: weights(x + a, L) }], ask: 'x', ans: x,
      hint: 'Nimm auf beiden Seiten gleich viel weg – dann bleibt die Waage im Gleichgewicht. Was bleibt neben der Kiste übrig?' };
  }
  if (type === 2) {
    const n = rnd(2, L < 8 ? 3 : 4);
    const x = rnd(2, 3 + L);
    const a = rnd(0, 5 + L * 2);
    return { scales: [{ l: [...many('x', n), ...weights(a, L)], r: weights(n * x + a, L) }], ask: 'x', ans: x,
      hint: `Nimm zuerst die Gewichte neben den Kisten auf beiden Seiten weg. Dann wiegen ${n} Kisten zusammen den Rest – teile durch ${n}.` };
  }
  if (type === 3) {
    const m = rnd(1, 2);
    const n = m + rnd(1, 3);
    const x = rnd(2, 5 + Math.floor(L / 2));
    const a = rnd(0, 12);
    const b = (n - m) * x + a;
    return { scales: [{ l: [...many('x', n), ...weights(a, L)], r: [...many('x', m), ...weights(b, L)] }], ask: 'x', ans: x,
      hint: `Auf beiden Seiten liegen Kisten. Nimm links und rechts je ${m} Kiste${m > 1 ? 'n' : ''} weg – die Waage bleibt im Gleichgewicht. Dann weiter wie gewohnt.` };
  }
  if (type === 4) {
    const t = rnd(2, 6 + Math.floor(L / 3));
    const c = rnd(2, 3);
    const d = rnd(1, 3);
    const cv = rnd(2, 9 + Math.floor(L / 3));
    return {
      scales: [{ l: many('t', c), r: weights(c * t, L) }, { l: [{ k: 't' }, ...many('c', d)], r: weights(t + d * cv, L) }],
      ask: 'c', ans: cv,
      hint: 'Finde zuerst mit der oberen Waage heraus, wie schwer ein Dreieck ist. Setze es dann in die untere Waage ein.',
    };
  }
  // type 5: zwei Unbekannte, zwei Waagen
  if (Math.random() < 0.5) {
    const t = rnd(3, 8 + Math.floor(L / 3));
    const c = rnd(2, 8 + Math.floor(L / 3));
    return {
      scales: [{ l: [{ k: 't' }, { k: 'c' }], r: weights(t + c, L) }, { l: [{ k: 't' }, { k: 't' }, { k: 'c' }], r: weights(2 * t + c, L) }],
      ask: pick(['t', 'c']), ans: null, t, c,
      hint: 'Vergleiche die beiden Waagen: Unten liegt genau ein Dreieck mehr. Der Unterschied der Gewichte verrät dir das Dreieck!',
    };
  }
  const c = rnd(2, 6 + Math.floor(L / 4));
  return {
    scales: [{ l: [{ k: 't' }], r: [{ k: 'c' }, { k: 'c' }] }, { l: [{ k: 't' }, { k: 'c' }], r: weights(3 * c, L) }],
    ask: pick(['t', 'c']), ans: null, t: 2 * c, c,
    hint: 'Ein Dreieck wiegt so viel wie zwei Kugeln. Tausche in der unteren Waage das Dreieck gegen zwei Kugeln – wie viele Kugeln liegen dann dort?',
  };
}

const item = (it) => (it.w != null ? h('span', { class: 'wt' }, it.w) : h('span', { class: 'obj' }, ICON[it.k]));
const pan = (items) => h('div', { class: 'pan' }, h('div', { class: 'items' }, items.map(item)), h('div', { class: 'plate' }));
const scaleEl = (s) => h('div', { class: 'scale' }, pan(s.l), h('div', { class: 'fulcrum' }, '⚖️'), pan(s.r));

export default {
  id: 'scale',
  name: 'Waagen-Mond',
  topic: 'Gleichungen mit Unbekannten',
  emoji: '⚖️',
  hue: 280,
  unlock: 3,
  rounds: 5,
  intro: 'Alle Waagen sind im Gleichgewicht. Finde heraus, wie schwer die geheimen Dinge sind.',
  hint: 'Eine Waage im Gleichgewicht bleibt im Gleichgewicht, wenn du auf beiden Seiten das Gleiche wegnimmst.',

  create(stage, L, api) {
    const p = make(L);
    const answer = p.ans ?? p[p.ask];
    const field = h('button', { type: 'button', class: 'ansfield' });
    stage.append(
      h('p', { class: 'task' }, `Alle Waagen sind im Gleichgewicht. Wie schwer ist ${NAME[p.ask]}?`),
      h('div', { class: 'play' },
        h('div', { class: 'scales' }, p.scales.map(scaleEl)),
        h('div', { class: 'column' },
          h('div', { class: 'answer' }, h('span', { class: 'obj' }, ICON[p.ask]), ' = ', field),
          fieldInput(api, [{ el: field, answer }], { onDone: () => api.solved({ msg: `${ICON[p.ask]} wiegt ${answer}!` }) }))));
    return { hint: p.hint };
  },
};
