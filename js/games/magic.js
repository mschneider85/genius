import { h, rnd, shuffle } from '../util.js';
import { fieldInput } from '../ui.js';

const LOSHU = [2, 7, 6, 9, 5, 1, 4, 3, 8];
const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
const rot = (g) => [g[6], g[3], g[0], g[7], g[4], g[1], g[8], g[5], g[2]];
const flip = (g) => [g[2], g[1], g[0], g[5], g[4], g[3], g[8], g[7], g[6]];

/** Order in which hidden cells can be deduced line by line, or null. */
function solveOrder(hidden, sumKnown) {
  const known = new Set([...Array(9).keys()].filter((i) => !hidden.has(i)));
  let S = sumKnown;
  const order = [];
  let changed = true;
  while (changed) {
    changed = false;
    if (!S && LINES.some((l) => l.every((i) => known.has(i)))) { S = true; changed = true; }
    if (S) {
      for (const l of LINES) {
        const unk = l.filter((i) => !known.has(i));
        if (unk.length === 1) { known.add(unk[0]); order.push(unk[0]); changed = true; }
      }
    }
  }
  return known.size === 9 ? order : null;
}

export default {
  id: 'magic',
  name: 'Magica',
  topic: 'Magische Quadrate',
  emoji: '🔮',
  hue: 310,
  unlock: 9,
  rounds: 5,
  intro: 'In jeder Zeile, Spalte und Diagonale ergeben die Zahlen dieselbe Zaubersumme. Ergänze die fehlenden!',
  hint: 'Suche eine Reihe (waagrecht, senkrecht oder schräg), in der nur eine Zahl fehlt: Zaubersumme minus die zwei bekannten Zahlen. Kennst du die Zaubersumme nicht? Addiere eine volle Reihe!',

  create(stage, L, api) {
    let g = [...LOSHU];
    for (let i = rnd(0, 3); i > 0; i--) g = rot(g);
    if (Math.random() < 0.5) g = flip(g);
    const [k, c] = L <= 5 ? [1, 0] : L <= 10 ? [1, rnd(1, 10)] : L <= 16 ? [rnd(1, 3), rnd(0, 20)] : [rnd(2, 6), rnd(5, 50)];
    g = g.map((v) => v * k + c);
    const S = 15 * k + 3 * c;
    const showSum = L < 12;
    const target = L <= 1 ? 2 : L <= 3 ? 3 : L <= 8 ? 4 : L <= 15 ? 5 : 6;

    const hidden = new Set();
    for (const i of shuffle([...Array(9).keys()])) {
      if (hidden.size >= target) break;
      hidden.add(i);
      if (!solveOrder(hidden, showSum)) hidden.delete(i);
    }
    const order = solveOrder(hidden, showSum);

    const fields = [];
    const grid = h('div', { class: 'magic' }, g.map((v, i) => {
      if (!hidden.has(i)) return h('div', { class: 'mcell given' }, v);
      const el = h('button', { type: 'button', class: 'mcell' });
      fields.push({ el, answer: v, pos: order.indexOf(i) });
      return el;
    }));
    fields.sort((a, b) => a.pos - b.pos);

    stage.append(
      h('p', { class: 'task' }, showSum ? `Zaubersumme: ${S} in jeder Reihe, Spalte und Diagonale.` : 'Zaubersumme: ? – finde sie heraus!'),
      h('div', { class: 'play' }, grid, fieldInput(api, fields, { onDone: () => api.solved({ msg: `Zaubersumme ${S} – perfekt!` }) })));
  },
};
