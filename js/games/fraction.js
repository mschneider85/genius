import { h, svg, rnd, pick } from '../util.js';
import { fieldInput, frac } from '../ui.js';

function pie(n, filled, onTap) {
  const s = svg('svg', { viewBox: '-1.08 -1.08 2.16 2.16', class: 'pie' + (onTap ? ' interactive' : '') });
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * 2 * Math.PI - Math.PI / 2;
    const a1 = ((i + 1) / n) * 2 * Math.PI - Math.PI / 2;
    const d = `M0 0 L${Math.cos(a0).toFixed(4)} ${Math.sin(a0).toFixed(4)} A1 1 0 0 1 ${Math.cos(a1).toFixed(4)} ${Math.sin(a1).toFixed(4)} Z`;
    const p = svg('path', { d, class: 'slice' + (filled.has(i) ? ' on' : '') });
    if (onTap) p.addEventListener('click', () => onTap(i, p));
    s.append(p);
  }
  return s;
}

function pickMode(L) {
  if (L <= 4) return 'fill';
  if (L <= 9) return pick(['fill', 'fill', 'compare']);
  if (L <= 15) return pick(['fill', 'compare', 'of']);
  return pick(['compare', 'of', 'add', 'fill']);
}

export default {
  id: 'fraction',
  name: 'Bruchstation',
  topic: 'Brüche',
  emoji: '🍕',
  hue: 45,
  unlock: 12,
  rounds: 5,
  intro: 'Lade genau den richtigen Bruchteil des Energiekerns – nicht zu viel, nicht zu wenig.',
  hint: 'Der Bruch 3/4 bedeutet: Teile das Ganze in 4 gleiche Teile und nimm 3 davon. Ist der Kern in mehr Stücke geteilt, z. B. 8, dann sind 3/4 = 6/8.',

  create(stage, L, api) {
    const mode = pickMode(L);

    if (mode === 'fill') {
      const b = pick(L <= 4 ? [2, 3, 4] : L <= 9 ? [2, 3, 4, 5, 6] : [2, 3, 4, 5, 6, 8]);
      let m = L <= 2 ? 1 : L <= 9 ? rnd(1, 3) : rnd(2, 4);
      while (b * m > (L <= 9 ? 12 : 16)) m--;
      const n = b * m;
      const a = rnd(1, b - 1);
      const filled = new Set();
      const live = h('div', { class: 'live' });
      const holder = h('div', { class: 'pie-holder' });
      const draw = () => {
        holder.replaceChildren(pie(n, filled, (i) => { filled.has(i) ? filled.delete(i) : filled.add(i); api.sfx.click(); draw(); }));
        live.textContent = L < 8 ? `Geladen: ${filled.size} von ${n} Stücken` : '';
      };
      const check = () => {
        if (filled.size * b === a * n) api.solved({ msg: m > 1 ? `Genau! ${a}/${b} = ${a * m}/${n}` : undefined });
        else api.wrong(L < 8 ? `Du hast ${filled.size}/${n} geladen. Das ist nicht ${a}/${b}.` : 'Das ist noch nicht die richtige Menge.');
      };
      api.setKeys((k) => { if (k === 'ok') check(); });
      draw();
      stage.append(
        h('p', { class: 'task' }, 'Lade genau ', frac(a, b), ' des Energiekerns! Tippe Stücke an.'),
        h('div', { class: 'play column' }, holder, live, h('button', { type: 'button', class: 'btn primary big', onClick: check }, '⚡ Laden')));
      return;
    }

    if (mode === 'compare') {
      let a, b, c, d;
      const maxD = L > 15 ? 12 : 10;
      if (L <= 9) {
        if (Math.random() < 0.5) { b = d = rnd(3, 8); a = rnd(1, b - 1); do c = rnd(1, b - 1); while (c === a); }
        else { a = c = rnd(1, 3); b = rnd(a + 1, 9); do d = rnd(a + 1, 9); while (d === b); }
      } else if (Math.random() < 0.2) {
        b = rnd(2, 5); a = rnd(1, b - 1); const k = rnd(2, 3); c = a * k; d = b * k;
      } else {
        do { b = rnd(2, maxD); d = rnd(2, maxD); a = rnd(1, b - 1); c = rnd(1, d - 1); } while (a * d === c * b);
      }
      if (Math.random() < 0.5) [a, b, c, d] = [c, d, a, b];
      const cmp = Math.sign(a * d - c * b); // 1: links größer
      const showPies = L < 14;
      let done = false;
      const choose = (v) => {
        if (done) return;
        if (v === cmp) {
          done = true;
          api.solved({ msg: cmp === 0 ? `${a}/${b} und ${c}/${d} sind gleich groß!` : `${cmp > 0 ? `${a}/${b}` : `${c}/${d}`} ist größer!` });
        } else api.wrong(showPies ? 'Schau dir die Energiekerne genau an.' : 'Tipp: Mach die Nenner gleich groß!');
      };
      const side = (x, y, v) => h('button', { type: 'button', class: 'cmp-btn', onClick: () => choose(v) },
        showPies ? pie(y, new Set([...Array(x).keys()])) : null, frac(x, y));
      stage.append(
        h('p', { class: 'task' }, 'Welcher Energiekern ist voller? Tippe ihn an – oder „gleich“.'),
        h('div', { class: 'play compare' },
          side(a, b, 1),
          h('button', { type: 'button', class: 'cmp-btn eq', onClick: () => choose(0) }, '='),
          side(c, d, -1)));
      return;
    }

    const field = h('button', { type: 'button', class: 'ansfield' });
    let task, answer, msg;
    if (mode === 'of') {
      const b = rnd(2, L < 15 ? 5 : 10);
      const a = rnd(1, b - 1);
      const whole = b * rnd(2, L < 15 ? 6 : 12);
      answer = (whole / b) * a;
      task = h('div', { class: 'answer' }, frac(a, b), ` von ${whole} 💎 = `, field);
      msg = `${whole} : ${b} = ${whole / b}, mal ${a} = ${answer}`;
    } else {
      const b = rnd(2, 6);
      const k = rnd(2, 3);
      const d = b * k;
      const a = rnd(1, b - 1);
      const c = rnd(1, d - 1);
      answer = a * k + c;
      task = h('div', { class: 'answer' }, frac(a, b), ' + ', frac(c, d), ' = ', h('span', { class: 'frac' }, field, h('span', {}, d)));
      msg = `${a}/${b} = ${a * k}/${d}, also ${a * k}/${d} + ${c}/${d} = ${answer}/${d}`;
    }
    stage.append(
      h('p', { class: 'task' }, mode === 'of' ? 'Wie viele Kristalle sind das?' : 'Addiere die Energie. Wie viele Stücke sind es zusammen?'),
      h('div', { class: 'play' }, task, fieldInput(api, [{ el: field, answer }], { onDone: () => api.solved({ msg }) })));
  },
};
