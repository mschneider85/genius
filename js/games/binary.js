import { h, rnd, pick } from '../util.js';
import { fieldInput } from '../ui.js';

export default {
  id: 'binary',
  name: 'Binärion',
  topic: 'Binärzahlen (Computersprache)',
  emoji: '🤖',
  hue: 160,
  unlock: 6,
  rounds: 5,
  intro: 'Die Roboter von Binärion sprechen nur mit Lichtern: Jede Lampe hat einen Wert – 1, 2, 4, 8, 16 … Brennt sie, zählt ihr Wert. Genau so rechnen auch echte Computer! Lerne die Robotersprache.',
  hint: 'Jede Lampe ist doppelt so viel wert wie die rechts daneben. Für eine Zahl: Beginne links bei der größten Lampe, die noch passt, zieh sie ab und mach mit dem Rest weiter.',

  create(stage, L, api) {
    const bits = L <= 3 ? 4 : L <= 8 ? 5 : L <= 14 ? 6 : L <= 22 ? 7 : 8;
    const max = 2 ** bits - 1;
    const vals = Array.from({ length: bits }, (_, i) => 2 ** (bits - 1 - i));
    const mode = L <= 4 ? 'build' : pick(L <= 10 ? ['build', 'read'] : L < 15 ? ['build', 'read', 'read'] : ['build', 'read', 'code']);
    const target = rnd(Math.max(3, max >> 2), max);
    const code = vals.map((v) => ((target & v) ? 1 : 0));

    const lamp = (v, i, on, onClick) => h('div', { class: 'lamp-wrap' },
      h('small', { class: 'lamp-val' }, (mode === 'build' ? L < 12 : L < 16) ? v : '?'),
      h('button', { type: 'button', class: 'lamp' + (on ? ' on' : ''), 'aria-label': `Lampe ${v}`, onClick }),
      h('span', { class: 'bit' }, on ? 1 : 0));

    if (mode === 'build') {
      const on = vals.map(() => false);
      const lamps = h('div', { class: 'lamps' });
      const sumEl = h('div', { class: 'live' });
      const draw = () => {
        lamps.replaceChildren(...vals.map((v, i) => lamp(v, i, on[i], () => { on[i] = !on[i]; api.sfx.click(); draw(); })));
        const sum = vals.reduce((s, v, i) => s + (on[i] ? v : 0), 0);
        sumEl.textContent = L < 7 ? `Lichter zeigen: ${sum}` : '';
      };
      const send = () => {
        const sum = vals.reduce((s, v, i) => s + (on[i] ? v : 0), 0);
        if (sum === target) api.solved({ msg: `${target} heißt in Robotersprache ${code.join('')}` });
        else api.wrong(L < 10 ? `Deine Lichter zeigen ${sum} – gesucht ist ${target}.` : 'Das ist noch nicht die richtige Zahl.');
      };
      api.setKeys((k) => { if (k === 'ok') send(); });
      draw();
      stage.append(
        h('p', { class: 'task' }, `🤖 „Sag mir die Zahl ${target} in Lichtsprache!“ Schalte die richtigen Lampen an.`),
        h('div', { class: 'play column' }, lamps, sumEl,
          h('button', { type: 'button', class: 'btn primary big', onClick: send }, '📡 Senden')));
      return;
    }

    const field = h('button', { type: 'button', class: 'ansfield' });
    const display = mode === 'read'
      ? h('div', { class: 'lamps' }, vals.map((v, i) => lamp(v, i, code[i])))
      : h('div', { class: 'robocode' }, '🤖 ', code.join(' '));
    stage.append(
      h('p', { class: 'task' }, mode === 'read' ? '🤖 Welche Zahl zeigen die Lichter?' : `🤖 Robotercode mit ${bits} Stellen. Welche Zahl ist das?`),
      h('div', { class: 'play' },
        h('div', { class: 'column' }, display, h('div', { class: 'answer' }, '= ', field)),
        fieldInput(api, [{ el: field, answer: target }], { onDone: () => api.solved({ msg: `${code.join('')} = ${target}` }) })));
  },
};
