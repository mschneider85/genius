// Planetenlandschaften hinter den Rätseln + Begegnungs-Leiste mit Bewohner und Widersacher.
// Alles DOM/SVG mit CSS-Animationen auf transform/opacity – schnell auch auf älteren iPads.
import { h, pick, seeded } from './util.js';
import { sfx } from './audio.js';
import { propImage, terrainLayer, paintPlanet, cachedArt, canvas } from './art.js';
import { lowPower } from './perf.js';

/* ------------------------------------------------------------------ */
/* Landschaften                                                        */
/* ------------------------------------------------------------------ */

// terrain: Silhouetten-Typ · props: gezeichnete Bauwerke (Galaxie 1 / 2, siehe art.js) · fx: Partikel · sky: Sonne/Mond
const SCENES = {
  pyramid: { terrain: 'dunes', props: ['pyramid', 'palm', 'temple', 'obelisk', 'pyramid', 'rock'], props2: ['tower', 'cactus', 'castle', 'tower', 'cactus', 'rock'], fx: 'sand', sky: 'sun' },
  sequence: { terrain: 'ice', props: ['crystal', 'icespire', 'dish', 'crystal', 'icespire', 'crystal'], props2: ['coral', 'shell', 'coral', 'icespire', 'shell', 'coral'], fx: 'snow', sky: 'ringed', aurora: true },
  asteroid: { terrain: 'rocks', props: ['drill', 'rock', 'crane', 'crystal', 'rock', 'rock'], props2: ['cactus', 'rock', 'crystal', 'cactus', 'rock', 'crystal'], fx: 'dust', sky: 'moons' },
  scale: { terrain: 'craters', props: ['scale', 'hut', 'crate', 'lamp', 'hut', 'crate'], props2: ['dish', 'lamp', 'scale', 'crate', 'lamp', 'dish'], fx: 'stars', sky: 'earth' },
  binary: { terrain: 'city', props: ['dish', 'robotTower', 'building', 'antenna', 'building', 'dish'], props2: ['antenna', 'building', 'dish', 'robotTower', 'lamp', 'building'], fx: 'bits', sky: 'sun' },
  magic: { terrain: 'forest', props: ['tree', 'mushroom', 'orb', 'pine', 'mushroom', 'tree'], props2: ['pine', 'orb', 'tree', 'mushroom', 'pine', 'orb'], fx: 'fireflies', sky: 'moon', aurora: true },
  fraction: { terrain: 'domes', props: ['dome', 'house', 'cake', 'dome', 'house', 'lamp'], props2: ['cake', 'dome', 'cake', 'house', 'dome', 'cake'], fx: 'steam', sky: 'sun' },
  builder: { terrain: 'mesas', props: ['crane', 'pad', 'rocket', 'building', 'crane', 'house'], props2: ['crystal', 'crane', 'building', 'crystal', 'pad', 'rocket'], fx: 'sparks', sky: 'moons' },
  duel: { terrain: 'spikes', props: ['pylon', 'spire', 'pylon', 'spire', 'pylon'], fx: 'embers', sky: 'eye', dark: true },
  fortress: { terrain: 'spikes', props: ['castle', 'spire', 'pylon', 'spire', 'castle'], props2: ['spire', 'pylon', 'spire', 'pylon', 'spire'], fx: 'embers', sky: 'eye', dark: true, hue: 345 },
};

const FX_CHARS = { sand: '•', snow: '❄', dust: '•', stars: '✦', bits: ['0', '1'], fireflies: '●', steam: '◦', sparks: '✦', embers: '•' };
// painted celestial bodies in the sky (art.js planet types); sun and the villain's eye stay CSS glows
const SKY_PLANETS = { ringed: 'ice', moons: 'rock', earth: 'ocean', moon: 'moon' };

/** Cached canvases can only live in one place in the DOM: copy if it is still shown elsewhere. */
function ownCanvas(c) {
  if (!c.isConnected) return c;
  const copy = canvas(c.width, c.height);
  copy.getContext('2d').drawImage(c, 0, 0);
  return copy;
}

let layer = null; // { key, el, props, fog }

function buildScene(key, gal, hue) {
  const S = SCENES[key] || SCENES.pyramid;
  const hh = S.hue ?? hue;
  const r = seeded(key + gal);
  const dark = !!S.dark;
  const el = h('div', { class: 'scenery' + (dark ? ' dark' : ''), style: { '--sh': hh } });

  const skyTop = dark ? `hsl(${hh} 60% 6%)` : 'hsl(245 55% 9%)';
  const skyMid = dark ? `hsl(${hh} 70% 18%)` : `hsl(${hh} 35% 22%)`;
  const skyLow = dark ? `hsl(${hh} 80% 32%)` : `hsl(${hh} 70% 50%)`;
  el.append(h('div', { class: 'sc-sky', style: { background: `radial-gradient(ellipse 70% 40% at 30% 72%, hsla(${hh}, 90%, ${dark ? 45 : 72}%, 0.45), transparent 70%), linear-gradient(180deg, ${skyTop} 0%, ${skyMid} 45%, ${skyLow} 78%)` } }));
  el.append(h('div', { class: 'sc-stars' }));

  // Sky: a painted planet/moon hanging in the sky, or the sun with slow light rays
  const skyPlanet = SKY_PLANETS[S.sky];
  const cel = h('div', { class: `sc-cel sc-${S.sky}` + (skyPlanet ? ' painted' : '') });
  if (skyPlanet) {
    cachedArt(`sky:${skyPlanet}`, () => paintPlanet({ type: skyPlanet, seed: 'sky' + skyPlanet, radius: 150 })).then((src) => {
      const c = canvas(src.width, src.height);
      c.getContext('2d').drawImage(src, 0, 0);
      cel.append(c);
      cel.classList.add('ready');
    });
  }
  if (S.sky === 'sun') el.append(h('div', { class: 'sc-rays' }));
  el.append(cel);
  if (S.aurora) el.append(h('div', { class: 'sc-aurora' }, h('i'), h('i')));

  // four painted depth layers (far mountains … foreground); far ones drift slowly for depth
  const seed = key + gal;
  ['far', 'mid', 'near'].forEach((cls, i) => {
    const c = terrainLayer({ type: S.terrain, hue: hh, dark, layer: i, seed });
    el.append(h('div', { class: `sc-layer ${cls}` }, ownCanvas(c)));
  });

  const list = (gal > 0 && S.props2) || S.props;
  const props = list.map((kind, i) => {
    const left = 6 + (i * 88) / (list.length - 1) + (r() - 0.5) * 6;
    const size = 0.75 + r() * 0.55;
    return h('img', { class: 'sc-prop broken', src: propImage(kind), alt: '', draggable: 'false', style: { left: left + '%', '--s': size, '--d': (r() * 3).toFixed(2) + 's' } });
  });
  el.append(h('div', { class: 'sc-props' }, props));
  el.append(h('div', { class: 'sc-layer front' }, ownCanvas(terrainLayer({ type: S.terrain, hue: hh, dark, layer: 3, seed }))));

  const fxChar = FX_CHARS[S.fx];
  el.append(h('div', { class: `sc-fx fx-${S.fx}` }, Array.from({ length: lowPower() ? 6 : 16 }, () => h('i', {
    style: { left: (r() * 100).toFixed(1) + '%', top: (r() * 90).toFixed(1) + '%', '--t': (6 + r() * 8).toFixed(1) + 's', '--d': (-r() * 10).toFixed(1) + 's', '--z': (0.6 + r() * 0.9).toFixed(2) },
  }, Array.isArray(fxChar) ? pick(fxChar) : fxChar))));

  const fog = h('div', { class: 'sc-fog' }, Array.from({ length: 3 }, (_, i) => h('i', { style: { left: (i * 34 - 12 + r() * 10) + '%', '--d': (-i * 4.3) + 's' } })));
  el.append(fog);
  el.append(h('div', { class: 'sc-flash' }));
  const peek = h('div', { class: 'sc-peek' });
  el.append(peek);
  return { key: key + gal, el, props, fog, peek, repaired: 0 };
}

/**
 * Show the landscape for a planet. opts: { gal, hue, base (0..1 already repaired), villain: emoji|null }
 * Same key → keeps the existing layer (only updates state).
 */
export function showScenery(key, { gal = 0, hue = 220, base = 0, villain = null } = {}) {
  document.body.classList.add('has-scenery');
  if (!layer || layer.key !== key + gal) {
    const old = layer;
    layer = buildScene(key, gal, hue);
    document.body.insertBefore(layer.el, document.getElementById('app'));
    if (old) {
      old.el.classList.add('leaving');
      setTimeout(() => old.el.remove(), 700);
    }
  }
  layer.base = base;
  setRepair(0, false);
  setChaos(1 - base * 0.6);
  layer.peek.textContent = villain || '';
  layer.peek.classList.toggle('on', !!villain);
}

export function hideScenery() {
  document.body.classList.remove('has-scenery');
  if (!layer) return;
  const old = layer;
  layer = null;
  old.el.classList.add('leaving');
  setTimeout(() => old.el.remove(), 700);
}

/** progress 0..1 of the current mission; repairs props on top of the planet's base state. */
export function setRepair(progress, animate = true) {
  if (!layer) return;
  const total = layer.props.length;
  const n = Math.round(total * Math.min(1, layer.base + (1 - layer.base) * progress));
  layer.props.forEach((p, i) => {
    const fixed = i < n;
    if (fixed && p.classList.contains('broken') && animate) {
      p.classList.remove('broken');
      p.classList.add('fixing');
      setTimeout(() => p.classList.remove('fixing'), 900);
    } else p.classList.toggle('broken', !fixed);
  });
}

/** chaos 0..1 → fog density and lightning. */
export function setChaos(chaos) {
  if (!layer) return;
  layer.el.style.setProperty('--chaos', Math.max(0, Math.min(1, chaos)).toFixed(2));
  layer.el.classList.toggle('stormy', chaos > 0.45);
}

export function celebrateScenery() {
  if (!layer) return;
  setRepair(1);
  setChaos(0);
  layer.peek.classList.remove('on');
  layer.el.classList.add('party');
}

/* ------------------------------------------------------------------ */
/* Begegnungs-Leiste                                                   */
/* ------------------------------------------------------------------ */

const LINES = {
  wirrwarr: {
    start: ['Hehe, diese Aufgaben hab ich extra verknotet!', 'Na, Kadett? Das schaffst du nie!', 'Alles durcheinandergewürfelt – viel Spaß!'],
    wrong: ['Hahaha! Falsch!', 'Ups – mehr Chaos für mich!', 'Hihi, knapp daneben!', 'Mein Chaos wird stärker!'],
    hit: ['Autsch!', 'Nein! Nicht so schnell!', 'Grrr … wie hast du das gemacht?', 'Mein schönes Chaos!'],
    flee: ['Das war nur Glück! Ich komme wieder!', 'Rückzug! RÜCKZUG!'],
    win: ['Hahaha! Gewonnen! Das Chaos bleibt!', 'Siehst du? Gegen mich kommst du nicht an!'],
  },
  nulla: {
    start: ['Alles hier wird zu Null …', 'Rechne nur. Am Ende bleibt nichts.', 'Psst. Zahlen sind so laut.'],
    wrong: ['Siehst du? Nichts.', 'Null Punkte, hihi.', 'Das Nichts wächst …'],
    hit: ['Nein … Zahlen!', 'Zu viel … zu viel!', 'Hör auf zu zählen!'],
    flee: ['Ich verschwinde … ins Nichts!', 'Das … war nicht null.'],
    win: ['Alles … null. Wie schön still.', 'Dein Licht ist aus. Versuch es ruhig nochmal.'],
  },
  wirbel: {
    start: ['Wusch! Ich bin ein übrig gebliebener Chaos-Wirbel.', 'Wirbel-wirbel! Fang mich doch!'],
    wrong: ['Wirbel-wirbel!', 'Huiii, Chaos!'],
    hit: ['Pfff … ich löse mich auf!', 'Huch!'],
    flee: ['Wuuusch – weg bin ich!'],
    win: ['Wirbel-Sieg! Huiii!'],
  },
};
const OUCH = ['Autsch!', 'Hoppla!', 'Nochmal rechnen …', 'Uff!'];
const HIT = ['Treffer!', 'Zack!', 'Volltreffer!', 'Nimm das!', 'Richtig!'];

/**
 * Duel bar above the puzzle: you (left) vs. the villain (right), each with a life bar.
 * A wrong answer costs you one life point; every solved puzzle damages the villain.
 * villain: { e, n, key: 'wirrwarr'|'nulla'|'wirbel' }, player: { e, n }, rounds, playerMax
 */
export function createEncounter({ villain, player, rounds, playerMax }) {
  const lines = LINES[villain.key] || LINES.wirrwarr;
  const pFace = h('span', { class: 'enc-face' }, player.e);
  const pBubble = h('div', { class: 'enc-bubble left' });
  const pBar = h('i');
  const pNum = h('b');
  const vFace = h('span', { class: 'enc-face villain' }, villain.e);
  const vBubble = h('div', { class: 'enc-bubble right' });
  const vBar = h('i');
  const lifeBar = (fill, num, cls) => h('div', { class: `enc-life ${cls}` }, h('div', { class: 'enc-bar' }, fill), num);
  const el = h('div', { class: 'encounter' },
    h('div', { class: 'enc-side' }, pFace, h('div', { class: 'enc-col' }, pBubble, h('small', { class: 'enc-who' }, player.n), lifeBar(pBar, pNum, 'mine'))),
    h('div', { class: 'enc-vs' }, 'VS'),
    h('div', { class: 'enc-side right' }, h('div', { class: 'enc-col' }, vBubble, h('small', { class: 'enc-who' }, villain.n), lifeBar(vBar, null, 'foe')), vFace));

  let php = playerMax;
  let solved = 0;
  const timers = new Map();
  const say = (bubble, text, ms = 2600) => {
    bubble.textContent = text;
    bubble.classList.add('show');
    clearTimeout(timers.get(bubble));
    timers.set(bubble, setTimeout(() => bubble.classList.remove('show'), ms));
  };
  const anim = (node, cls) => {
    node.classList.remove(cls);
    void node.offsetWidth;
    node.classList.add(cls);
  };
  const draw = () => {
    pBar.style.width = (php / playerMax) * 100 + '%';
    pBar.parentNode.classList.toggle('low', php / playerMax <= 0.4);
    pNum.textContent = `${php}/${playerMax}`;
    vBar.style.width = Math.max(0, 1 - solved / rounds) * 100 + '%';
  };
  /** Flying projectile from one face to the other, then cb(). */
  const shoot = (from, to, char, cb) => {
    const a = from.getBoundingClientRect();
    const b = to.getBoundingClientRect();
    const bolt = h('span', { class: 'enc-beam' }, char);
    document.body.append(bolt);
    const run = bolt.animate?.([
      { transform: `translate(${a.left + a.width / 2}px, ${a.top + a.height / 2}px) scale(0.6)` },
      { transform: `translate(${b.left + b.width / 2}px, ${b.top + b.height / 2}px) scale(1.5)` },
    ], { duration: 420, easing: 'ease-in' });
    const done = () => { bolt.remove(); cb(); };
    if (run) run.onfinish = done; else done();
  };
  draw();
  setTimeout(() => say(vBubble, pick(lines.start), 3200), 500);

  return {
    el,
    /** Remaining villain life 0..1 (drives the chaos fog). */
    get villainLife() { return Math.max(0, 1 - solved / rounds); },
    get playerLife() { return php; },
    /** Wrong answer: the villain strikes. Returns remaining player life. */
    wrong() {
      php = Math.max(0, php - 1);
      anim(vFace, 'laugh');
      say(vBubble, pick(lines.wrong));
      shoot(vFace, pFace, '🌀', () => {
        draw();
        anim(pFace, 'hit');
        sfx.hit();
        say(pBubble, pick(OUCH), 1800);
      });
      return php;
    },
    /** Solved puzzle: your laser hits the villain. */
    solved() {
      solved++;
      shoot(pFace, vFace, '✨', () => {
        draw();
        anim(vFace, 'hit');
        sfx.laser();
        say(vBubble, pick(lines.hit), 2000);
        say(pBubble, pick(HIT), 1600);
        anim(pFace, 'cheer');
      });
    },
    taunt(text) { say(vBubble, text, 2600); },
    /** You won: the villain flees. */
    finish() {
      say(vBubble, pick(lines.flee), 3000);
      setTimeout(() => vFace.classList.add('flee'), 300);
      anim(pFace, 'cheer');
    },
    /** You ran out of life. */
    defeat() {
      say(vBubble, pick(lines.win), 3000);
      anim(vFace, 'laugh');
      pFace.classList.add('down');
    },
    hide(on) { el.classList.toggle('gone', on); },
  };
}
