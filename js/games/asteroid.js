import { h, pick, isPrime } from '../util.js';

export default {
  id: 'asteroid',
  name: 'Asteroiden-Gürtel',
  topic: 'Teilen & Primzahlen',
  emoji: '🪨',
  hue: 30,
  unlock: 0,
  rounds: 5,
  intro: 'Teile die Asteroiden mit deinem Laser, bis nur noch Primzahl-Kristalle übrig sind.',
  hint: 'Teilbarkeitsregeln: Gerade Zahl → ÷2 geht. Quersumme durch 3 teilbar → ÷3 geht. Endet auf 0 oder 5 → ÷5 geht. Primzahlen (2, 3, 5, 7, 11, 13 …) kann man nicht weiter zerlegen.',

  create(stage, L, api) {
    const pool = L < 4 ? [2, 3, 5] : L < 10 ? [2, 3, 5, 7] : L < 18 ? [2, 3, 5, 7, 11] : [2, 3, 5, 7, 11, 13];
    const k = Math.min(6, 2 + Math.floor(L / 6));
    const cap = 30 + L * 45;
    let fs = [];
    for (let t = 0; t < 300; t++) {
      fs = Array.from({ length: k }, () => pick(pool));
      if (fs.reduce((a, b) => a * b, 1) <= cap) break;
    }
    fs.sort((a, b) => a - b);
    while (fs.reduce((a, b) => a * b, 1) > cap && fs.length > 2) fs.pop();
    const n = fs.reduce((a, b) => a * b, 1);

    let rocks = [n];
    const gems = [];
    let sel = 0;

    const field = h('div', { class: 'astro-field' });
    const gemRow = h('div', { class: 'gem-row' });
    const tools = h('div', { class: 'tools' }, pool.map((p) => h('button', { type: 'button', class: 'tool', onClick: () => fire(p) }, '÷' + p)));

    function render() {
      field.replaceChildren(...rocks.map((v, i) => h('button', {
        type: 'button',
        class: 'rock' + (i === sel ? ' sel' : ''),
        style: { '--s': Math.round(64 + Math.log2(v) * 9) + 'px' },
        onClick: () => { sel = i; api.sfx.click(); render(); },
      }, v)));
      gemRow.replaceChildren(h('span', { class: 'muted' }, 'Kristalle: '), ...gems.map((p) => h('span', { class: 'gem' }, p)));
    }

    function fire(p) {
      const v = rocks[sel];
      if (v === undefined) return;
      if (v % p !== 0) {
        api.wrong(`${v} lässt sich nicht durch ${p} teilen.`);
        return;
      }
      api.sfx.laser();
      const q = v / p;
      rocks.splice(sel, 1);
      gems.push(p);
      if (isPrime(q)) gems.push(q); else rocks.push(q);
      gems.sort((a, b) => a - b);
      rocks.sort((a, b) => b - a);
      sel = 0;
      render();
      if (!rocks.length) {
        tools.querySelectorAll('button').forEach((b) => { b.disabled = true; });
        api.solved({ msg: `${n} = ${gems.join(' · ')}` });
      }
    }

    api.setKeys((key) => { const p = Number(key); if (pool.includes(p)) fire(p); });
    render();
    stage.append(
      h('p', { class: 'task' }, `Zerlege den Asteroiden ${n} in Primzahl-Kristalle! Wähle einen Laser.`),
      h('div', { class: 'play column' }, field, tools, gemRow));
  },
};
