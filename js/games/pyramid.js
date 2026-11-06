import { h, rnd, shuffle } from '../util.js';
import { fieldInput } from '../ui.js';

const key = (r, i) => r + ',' + i;

/** Returns the order in which hidden cells can be deduced step by step, or null if not solvable that way. */
function solveOrder(rows, hidden) {
  const known = new Set();
  for (let r = 0; r < rows; r++) for (let i = 0; i < rows - r; i++) if (!hidden.has(key(r, i))) known.add(key(r, i));
  const order = [];
  let changed = true;
  while (changed) {
    changed = false;
    for (let r = 1; r < rows; r++) {
      for (let i = 0; i < rows - r; i++) {
        const unk = [key(r, i), key(r - 1, i), key(r - 1, i + 1)].filter((k) => !known.has(k));
        if (unk.length === 1) { known.add(unk[0]); order.push(unk[0]); changed = true; }
      }
    }
  }
  return known.size === (rows * (rows + 1)) / 2 ? order : null;
}

export default {
  id: 'pyramid',
  name: 'Pyramidia',
  topic: 'Zahlenpyramiden',
  emoji: '🔺',
  hue: 20,
  unlock: 0,
  rounds: 5,
  intro: 'Die Tempel von Pyramidia sind eingestürzt! Ihre Steine folgen einem uralten Gesetz: Jeder Stein ist die Summe der beiden Steine direkt darunter. Setze die fehlenden Steine ein – manchmal musst du rückwärts denken!',
  hint: 'Stein oben = linker Stein unten + rechter Stein unten. Fehlt unten ein Stein? Dann rechne: oberer Stein − Nachbarstein. Fang dort an, wo du schon zwei von drei Steinen kennst.',

  create(stage, L, api) {
    const rows = L <= 3 ? 3 : L <= 9 ? 4 : L <= 18 ? (Math.random() < 0.5 ? 4 : 5) : 5;
    const maxB = Math.min(3 + L * 2, 80);
    const g = [Array.from({ length: rows }, () => rnd(1, maxB))];
    for (let r = 1; r < rows; r++) {
      g[r] = [];
      for (let i = 0; i < rows - r; i++) g[r][i] = g[r - 1][i] + g[r - 1][i + 1];
    }
    const all = [];
    for (let r = 0; r < rows; r++) for (let i = 0; i < rows - r; i++) all.push(key(r, i));

    let hidden = new Set();
    if (L <= 3) {
      all.filter((k) => !k.startsWith('0,')).forEach((k) => hidden.add(k));
    } else {
      const target = Math.min(all.length - rows, Math.round(all.length * (0.4 + L * 0.012)));
      const bottom = key(0, rnd(0, rows - 1));
      const order = [bottom, ...shuffle(all.filter((k) => k !== bottom))];
      for (const k of order) {
        if (hidden.size >= target) break;
        hidden.add(k);
        if (!solveOrder(rows, hidden)) hidden.delete(k);
      }
    }
    const order = solveOrder(rows, hidden);

    const fields = [];
    const pyr = h('div', { class: 'pyramid' });
    for (let r = rows - 1; r >= 0; r--) {
      const row = h('div', { class: 'prow' });
      for (let i = 0; i < rows - r; i++) {
        const k = key(r, i);
        if (hidden.has(k)) {
          const el = h('button', { type: 'button', class: 'brick' });
          fields.push({ el, answer: g[r][i], pos: order.indexOf(k) });
          row.append(el);
        } else row.append(h('div', { class: 'brick given' }, g[r][i]));
      }
      pyr.append(row);
    }
    fields.sort((a, b) => a.pos - b.pos);

    stage.append(
      h('p', { class: 'task' }, 'Jeder Stein = Summe der zwei Steine darunter. Tippe einen leeren Stein an.'),
      h('div', { class: 'play' }, pyr, fieldInput(api, fields, { onDone: () => api.solved() })));
  },
};
