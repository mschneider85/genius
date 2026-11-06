import { h, rnd, pick } from './util.js';
import { state, save, level } from './state.js';
import { sfx } from './audio.js';
import { toast, confetti } from './fx.js';
import { keypad, setKeyHandler, fieldInput } from './ui.js';
import { GALAXIES, CHARS, planetInfo, markDecoded } from './story.js';

/** A small task whose result is v (1–26), themed after the planet's math topic. */
export function letterTask(v, id, L) {
  switch (id) {
    case 'pyramid': {
      if (L >= 8 && v >= 3) {
        const a = rnd(1, v - 2);
        const b = rnd(1, v - a - 1);
        return `${a} + ${b} + ${v - a - b}`;
      }
      const a = v > 1 ? rnd(1, v - 1) : 0;
      return `${a} + ${v - a}`;
    }
    case 'sequence': {
      if (v < 4) { const d = rnd(1, 4); return `${v + 3 * d}, ${v + 2 * d}, ${v + d}, ?`; }
      const d = rnd(1, Math.min(6, Math.floor((v - 1) / 3)));
      return `${v - 3 * d}, ${v - 2 * d}, ${v - d}, ?`;
    }
    case 'asteroid': {
      const a = rnd(2, 5);
      const b = Math.floor(v / a);
      const c = v - a * b;
      if (!b) return `${v} · 1`;
      return c ? `${a} · ${b} + ${c}` : `${a} · ${b}`;
    }
    case 'scale': {
      const a = rnd(2, 10 + L);
      return `📦 + ${a} = ${v + a}`;
    }
    case 'binary':
      return v.toString(2).padStart(5, '0');
    case 'magic': {
      const a = rnd(2, 6);
      const b = Math.ceil((v + 1) / a) + rnd(0, 2);
      return `${a} · ${b} − ${a * b - v}`;
    }
    case 'fraction': {
      if (L >= 12 && v % 2 === 0) return `2/3 von ${(v / 2) * 3}`;
      const d = pick([2, 3, 4]);
      return `1/${d} von ${v * d}`;
    }
    case 'builder': {
      const a = Math.floor(Math.sqrt(v));
      const c = v - a * a;
      const sq = L >= 10 ? `${a}²` : `${a} · ${a}`;
      return c ? `${sq} + ${c}` : sq;
    }
    default: {
      const a = v > 1 ? rnd(1, v - 1) : 0;
      return `${a} + ${v - a}`;
    }
  }
}

const ABC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** Decoder screen content. onFinish() is called after the message is fully decoded. */
export function decoderView(game, onFinish) {
  const p = planetInfo(game);
  const villain = CHARS[GALAXIES[state.galaxy].villain];
  const L = level(game.id) + state.galaxy * 4;
  const msg = p.msg;
  const slots = [...msg].map((ch) => (ch === ' ' ? h('span', { class: 'gap' }) : h('span', { class: 'slot', 'data-c': ch }, '?')));
  const msgEl = h('div', { class: 'cipher-msg' }, slots);
  const reveal = (ch) => slots.forEach((s) => { if (s.dataset.c === ch) { s.textContent = ch; s.classList.add('open'); } });

  const fields = [];
  const tasks = [...new Set(msg.replace(/ /g, ''))].map((ch) => {
    const v = ch.charCodeAt(0) - 64;
    const el = h('button', { type: 'button', class: 'ansfield' });
    fields.push({ el, answer: v, onSolved: () => { reveal(ch); sfx.tick(); } });
    return h('div', { class: 'cipher-task' }, h('span', { class: 'expr' }, letterTask(v, game.id, L)), h('span', { class: 'arrow' }, '➜'), el);
  });

  let keyFn = null;
  const api = {
    keypad: (fn) => { keyFn = fn; return keypad(fn); },
    wrong: () => { sfx.wrong(); toast('Fast! Rechne nochmal nach.', 'bad'); },
  };
  const pad = fieldInput(api, fields, {
    maxLen: 3,
    onDone: () => {
      markDecoded(game.id);
      state.crystals += 20;
      save();
      setKeyHandler(null);
      sfx.win();
      confetti(120);
      toast('Botschaft geknackt! +20 💎', 'good', 2200);
      setTimeout(() => onFinish(el.isConnected), 1600); // false if the child already left
    },
  });

  const el = h('section', { class: 'panel decoder' },
    h('div', { class: 'dec-head' }, h('span', { class: 'dec-villain' }, villain.e), h('div', {},
      h('h1', {}, '📩 Geheimbotschaft'),
      h('p', { class: 'muted' }, `Abgefangen auf ${p.name}. Absender: ${villain.n}`))),
    msgEl,
    h('p', {}, 'Jede Aufgabe ergibt eine Zahl – und jede Zahl ist ein Buchstabe. Tippe eine Aufgabe an und rechne!'),
    h('div', { class: 'abc' }, [...ABC].map((c, i) => h('span', {}, h('b', {}, c), i + 1))),
    h('div', { class: 'play' }, h('div', { class: 'cipher-tasks' }, tasks), pad));
  el.keyHandler = keyFn; // caller registers it once the view is mounted
  return el;
}
