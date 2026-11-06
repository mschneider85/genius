import { h, rnd, pick, weighted } from '../util.js';
import { shake } from '../fx.js';

const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const sup = (n) => String(n).split('').map((d) => SUP[d]).join('');

/** Mental-math task { q, a } for level L (also used for treasure-chest locks). */
export function question(L) {
  const R = [];
  let from = 1; // start level of the current tier; tiers far below L appear less often
  const add = (w, f) => R.push([L - from >= 10 ? w * 0.25 : w, f]);
  if (L <= 6) {
    add(3, () => { const a = rnd(1, 8 + L * 2); const b = rnd(1, 8 + L * 2); return [`${a} + ${b}`, a + b]; });
    add(2, () => { const a = rnd(5, 10 + L * 3); const b = rnd(1, a); return [`${a} − ${b}`, a - b]; });
  }
  if (L >= 4 && L <= 12) {
    add(2, () => { const a = pick([2, 5, 10]); const b = rnd(1, 10); return [`${b} · ${a}`, a * b]; });
    add(2, () => { const a = rnd(10, 60); const b = rnd(10, 39); return Math.random() < 0.5 ? [`${a} + ${b}`, a + b] : [`${a + b} − ${b}`, a]; });
  }
  from = 7;
  if (L >= 7) {
    add(3, () => { const a = rnd(2, 10); const b = rnd(2, 10); return [`${a} · ${b}`, a * b]; });
    add(2, () => { const b = rnd(2, 10); const q = rnd(2, 10); return [`${b * q} : ${b}`, q]; });
  }
  from = 12;
  if (L >= 12) {
    add(2, () => { const a = rnd(100, 900); const b = rnd(11, 99); return Math.random() < 0.5 ? [`${a} + ${b}`, a + b] : [`${a} − ${b}`, a - b]; });
    add(2, () => { const a = rnd(11, 19); const b = rnd(2, 9); return [`${a} · ${b}`, a * b]; });
    add(2, () => { const a = rnd(1, 20); const b = rnd(2, 9); const c = rnd(2, 9); return [`${a} + ${b} · ${c}`, a + b * c]; });
    add(1, () => { const n = rnd(11, 15); return [`${n}${sup(2)}`, n * n]; });
  }
  from = 17;
  if (L >= 17) {
    add(2, () => { const a = rnd(2, 15); const b = rnd(2, 15); const c = rnd(2, 6); return [`(${a} + ${b}) · ${c}`, (a + b) * c]; });
    add(2, () => { const a = rnd(12, 25); const b = pick([10, 11, 12, 15, 20]); return [`${a} · ${b}`, a * b]; });
    add(1, () => { const n = rnd(26, 250); return [`Hälfte von ${2 * n}`, n]; });
    add(1, () => { const a = rnd(3, 9); const b = rnd(3, 9); const c = rnd(1, a * b); return [`${a} · ${b} − ${c}`, a * b - c]; });
  }
  if (L >= 23) {
    add(2, () => { const a = rnd(2, 9); const b = rnd(2, 9); const c = rnd(2, 9); const d = rnd(2, 9); return [`${a} · ${b} + ${c} · ${d}`, a * b + c * d]; });
    add(1, () => { const n = rnd(3, 10); return [`2${sup(n)}`, 2 ** n]; });
    add(1, () => { const k = rnd(3, 25); return [`3/4 von ${4 * k}`, 3 * k]; });
    add(1, () => { const n = rnd(5, 20); return [`1 + 2 + … + ${n}`, (n * (n + 1)) / 2]; });
  }
  const [q, a] = weighted(R)();
  return { q, a };
}

export default {
  id: 'duel',
  name: 'Chaos-Kern',
  topic: 'Boss: Blitz-Kopfrechnen',
  emoji: '👾',
  hue: 350,
  unlock: 20,
  rounds: 1,
  intro: 'Jede richtige Antwort trifft den Chaos-Kern, schnelle doppelt. Ist seine Ladeleiste voll, schlägt er zurück!',
  hint: 'Rechentricks: · 5 ist die Hälfte von · 10. · 9 ist · 10 minus einmal die Zahl. Punkt vor Strich: Erst mal und geteilt, dann plus und minus. Klammern zuerst!',

  create(stage, L, api) {
    const boss = api.boss || { e: '👾', n: 'Chaos-Kern', hp: 10 };
    const mods = api.mods || {};
    const HP = boss.hp;
    const MAX_HEARTS = 3 + (mods.shield || 0);
    let hp = HP;
    let hearts = MAX_HEARTS;
    let combo = 0;
    let val = '';
    let q;
    let qStart = 0;
    let last = 0;
    let raf = 0;
    let dead = false;
    const T = Math.max(9, 18 - L * 0.2) * 1000 * (1 + 0.15 * (mods.time || 0));
    const FAST = T * (1 / 3) * (1 + 0.3 * (mods.laser || 0));

    const bossEl = h('div', { class: 'boss' }, boss.e);
    const hpFill = h('div', { class: 'hpfill' });
    const heartsEl = h('div', { class: 'hearts' });
    const qEl = h('div', { class: 'dq' });
    const ansEl = h('div', { class: 'ansfield field active' }, '?');
    const tFill = h('div', { class: 'dtfill' });

    const drawHearts = () => { heartsEl.textContent = '❤️'.repeat(hearts) + '🖤'.repeat(MAX_HEARTS - hearts); };
    const newQ = () => { q = question(L); qStart = performance.now(); val = ''; qEl.textContent = `${q.q} =`; ansEl.textContent = '?'; };

    function hitBoss() {
      const fast = performance.now() - qStart < FAST;
      combo++;
      const dmg = (fast ? 2 : 1) + (combo >= 5 ? 1 : 0);
      hp = Math.max(0, hp - dmg);
      api.sfx.laser();
      shake(bossEl);
      bossEl.classList.add('hit');
      setTimeout(() => bossEl.classList.remove('hit'), 300);
      hpFill.style.width = (hp / HP) * 100 + '%';
      if (hp <= 0) {
        dead = true;
        bossEl.textContent = '💥';
        const lost = MAX_HEARTS - hearts;
        api.solved({ stars: lost === 0 ? 3 : lost === 1 ? 2 : 1, msg: `${boss.n} ist besiegt!` });
        return;
      }
      if (combo >= 5) api.toast(`Combo ${combo}! Extra-Schaden!`, 'good', 1200);
      else if (fast) api.toast('Blitzschnell! Doppelter Schaden!', 'good', 1200);
      newQ();
    }

    function onKey(k) {
      if (dead) return;
      if (k === 'back') val = val.slice(0, -1);
      else if (k === 'ok') {
        if (!val) return;
        if (Number(val) === q.a) { hitBoss(); return; }
        api.wrong('Daneben!');
        combo = 0;
        shake(ansEl);
        val = '';
      } else if (val.length < 6) val += k;
      ansEl.textContent = val || '?';
    }

    function loop(now) {
      if (dead) return;
      // pause the boss clock in the background tab and while a dialog/hint/cutscene is open
      if (last && (now - last > 250 || document.querySelector('.overlay, .cutscene'))) qStart += now - last;
      last = now;
      const p = (now - qStart) / T;
      tFill.style.width = Math.min(100, p * 100) + '%';
      tFill.classList.toggle('danger', p > 0.75);
      if (p >= 1) {
        hearts--;
        combo = 0;
        drawHearts();
        api.sfx.hit();
        shake(stage);
        api.toast(`Autsch! Lösung: ${q.q} = ${q.a}`, 'bad', 2400);
        if (hearts <= 0) { dead = true; api.failed(); return; }
        newQ();
      }
      raf = requestAnimationFrame(loop);
    }

    drawHearts();
    newQ();
    stage.append(h('div', { class: 'duel' },
      h('div', { class: 'arena' },
        h('div', { class: 'fighter' }, bossEl, h('div', { class: 'hpbar' }, hpFill), h('small', {}, boss.n)),
        h('div', { class: 'fighter' }, h('div', { class: 'me' }, api.ship), heartsEl)),
      h('div', { class: 'dtimer' }, tFill),
      h('div', { class: 'play' }, h('div', { class: 'answer big' }, qEl, ansEl), api.keypad(onKey))));
    raf = requestAnimationFrame(loop);
    return { destroy: () => { dead = true; cancelAnimationFrame(raf); } };
  },
};
