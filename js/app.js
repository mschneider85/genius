import { h, pick, shuffle, seeded, localDay } from './util.js';
import { state, save, resetState, level, setLevel, MAX_LEVEL } from './state.js';
import { sfx, setSound } from './audio.js';
import { starfield, confetti, toast, shake } from './fx.js';
import { keypad, setKeyHandler, modal } from './ui.js';
import { GAMES, GAME_LIST } from './games/index.js';
import { CREATURES } from './creatures.js';
import {
  GALAXIES, CHARS, STORY_PLANETS, STAGE_NAMES, REPAIRED, SHINING,
  planetInfo, points, stageOf, addPoints, messageWaiting, coordsFound, finaleUnlocked,
  seen, playScenes, buildScene, sceneOrder, registerGames, piSay,
} from './story.js';
import { decoderView } from './decoder.js';
import { makeComet } from './comets.js';
import { music, setMusic } from './music.js';
import { createWorld, WORLD_W, WORLD_H } from './world.js';
import { showScenery, hideScenery, setRepair, setChaos, celebrateScenery, createEncounter } from './scenery.js';
import { track, ensureQuests, questsOpen, MODULES, mod, eggsUseful, BADGES, stat as statOf } from './progress.js';
import { question as mentalTask } from './games/duel.js';
import { applyPerf } from './perf.js';
import { PLANET_TYPES, paintPlanet, cachedArt } from './art.js';
import { icon, withIcon } from './icons.js';

registerGames(GAMES);
const app = document.getElementById('app');

const RANKS = [
  [0, 'Kadett'], [10, 'Pilot'], [25, 'Navigator'], [50, 'Kommandant'],
  [90, 'Admiral'], [140, 'Sternenmeister'], [200, 'Genius'],
];
const PRAISE = ['Super!', 'Genial!', 'Stark gerechnet!', 'Volltreffer!', 'Wow!', 'Klasse!', 'Mathe-Magie!', 'Brillant!', 'Raketenstark!'];
const AVATARS = ['🧑‍🚀', '👩‍🚀', '👨‍🚀', '🦊', '🐱', '🐼', '🐸', '🤖', '🦉', '🐲', '🦄', '👽'];
const GRADES = [
  { g: 1, label: '1. Klasse', L: 1 },
  { g: 2, label: '2. Klasse', L: 4 },
  { g: 3, label: '3. Klasse', L: 8 },
  { g: 4, label: '4. Klasse', L: 12 },
  { g: 5, label: 'Mathe-Profi', L: 17 },
];
const SHIPS = [
  { id: '🚀', e: '🚀', n: 'Rakete', p: 0 },
  { id: '🛸', e: '🛸', n: 'Ufo', p: 80 },
  { id: '🛰️', e: '🛰️', n: 'Satellit', p: 150 },
  { id: '🐉', e: '🐉', n: 'Drachenschiff', p: 250 },
  { id: '🦄', e: '🦄', n: 'Einhorn-Gleiter', p: 350 },
  { id: '🐳', e: '🐳', n: 'Weltraumwal', p: 800 },
  { id: '🦖', e: '🦖', n: 'T-Rex-Kreuzer', p: 1200 },
  { id: '🌠', e: '🌠', n: 'Sternschnuppe', p: 2000 },
  { id: '☄️', e: '☄️', n: 'Kometenreiter', gold: 7 },
];
const THEMES = [
  { id: 'nebula', sw: ['#2a1b63', '#ffd166'], n: 'Lila Nebel', p: 0 },
  { id: 'ozean', sw: ['#053a5c', '#5ff2d6'], n: 'Tiefsee-All', p: 120 },
  { id: 'wald', sw: ['#0b3a2e', '#b6ff6b'], n: 'Nordlicht', p: 200 },
  { id: 'sonne', sw: ['#5a1f0b', '#ffcf3f'], n: 'Sonnensturm', p: 300 },
];

const rankIndex = (s) => RANKS.reduce((i, r, j) => (s >= r[0] ? j : i), 0);
const today = () => localDay();
const pendingScenes = []; // story scenes that could not play because the child had already moved on
const info = (g) => planetInfo(g);
const isUnlocked = (g) => state.galaxy > 0 || state.stars >= g.unlock;
const galaxy = () => GALAXIES[state.galaxy];
const villain = () => CHARS[galaxy().villain];

let current = null; // active puzzle instance (may have destroy())
let M = null; // active mission
let lastMission = null;

function screen(...kids) {
  current?.destroy?.();
  current = null;
  setKeyHandler(null);
  app.replaceChildren(...kids.flat().filter(Boolean));
  window.scrollTo(0, 0);
}

function applySettings() {
  document.body.dataset.theme = state.theme;
  setSound(state.sound);
  setMusic(state.music);
  applyPerf();
}

let musicTimer;
/**
 * Background scene ('world' | 'surface' | 'space'), planet hue, music track and optional planet landscape
 * (land: { key, base, villain } to show, 'keep' to leave the current one, omitted to hide).
 */
function setScene(kind, hue = 230, track = 'space', land) {
  document.body.dataset.scene = kind;
  document.body.style.setProperty('--ph', hue);
  clearTimeout(musicTimer);
  musicTimer = setTimeout(() => music(track), 0);
  if (land === 'keep') return;
  if (land) showScenery(land.key, { gal: state.galaxy, hue, base: land.base, villain: land.villain });
  else hideScenery();
}

/** Landscape settings for a planet: its rescue stage pre-repairs part of the scenery. */
function planetLand(g, peek) {
  const story = STORY_PLANETS.includes(g.id);
  const st = story ? stageOf(g.id) : 1;
  return { key: g.id, base: [0, 0.34, 0.67][st], villain: peek && st < 2 && !state.finales[state.galaxy] ? villain().e : null };
}

/** Opponent in the encounter bar: the galaxy villain, or a leftover chaos swirl once befriended. */
const encounterVillain = () => (state.finales[state.galaxy]
  ? { e: '🌀', n: 'Chaos-Wirbel', key: 'wirbel' }
  : { ...villain(), key: galaxy().villain });

const stat = (name, val, title, key) => h('span', { class: 'stat', title, 'data-k': key }, icon(name), h('b', {}, val));

/** Three big result stars, the first `n` lit. */
const bigStars = (n) => h('div', { class: 'bigstars' }, [1, 2, 3].map((i) => {
  const s = icon('star');
  if (i <= n) s.classList.add('on');
  return h('span', { class: i <= n ? 'on' : '', style: { animationDelay: i * 0.25 + 's' } }, s);
}));

/** Update live numbers in the visible top bar (e.g. after collecting crystals in space). */
function refreshHud() {
  for (const el of document.querySelectorAll('.stat[data-k="crystals"] b')) el.textContent = state.crystals;
}

/** Slide-in banners for completed quests, badges and bonuses. */
function announce(items) {
  if (!items?.length) return;
  let box = document.getElementById('achv');
  if (!box) { box = h('div', { id: 'achv', 'aria-live': 'polite' }); document.body.append(box); }
  items.forEach((it, i) => setTimeout(() => {
    const el = h('div', { class: 'achv' }, h('span', { class: 'achv-e' }, it.icon ? icon(it.icon) : it.e),
      h('div', {}, h('b', {}, it.title), h('span', {}, it.text), h('small', {}, it.reward)));
    box.append(el);
    sfx.coin();
    refreshHud();
    setTimeout(() => el.classList.add('out'), 3800);
    setTimeout(() => el.remove(), 4400);
  }, i * 900));
}

/** Header with player and counters. Outside the free-flight world it starts with a "back to space" button,
 *  so no screen needs scrolling down to leave it. */
function topbar(back = true) {
  return h('header', { class: 'topbar' },
    h('div', { class: 'who' },
      back ? h('button', { type: 'button', class: 'icon back-icon', title: 'Zurück ins All', 'aria-label': 'Zurück ins All', onClick: () => { sfx.click(); renderMap(); } }, icon('rocket')) : null,
      h('span', { class: 'avatar' }, state.avatar),
      h('div', {}, h('b', {}, state.name || 'Kadett'), h('small', {}, RANKS[rankIndex(state.stars)][1]))),
    h('div', { class: 'stats' },
      stat('gem', state.crystals, 'Kristalle', 'crystals'),
      stat('star', state.stars, 'Sterne'),
      state.goldStars ? stat('sparkles', state.goldStars, 'Goldsterne') : null,
      state.streak > 1 ? stat('flame', state.streak, 'Tage in Folge') : null));
}

const backBtn = (label = 'Zurück ins All') => h('button', { type: 'button', class: 'btn ghost', onClick: renderMap }, ...withIcon('rocket', label));

/* ---------- Willkommen ---------- */

function renderWelcome() {
  let avatar = state.avatar;
  let grade = GRADES[1];
  const nameIn = h('input', { type: 'text', maxlength: 16, placeholder: 'Dein Name', value: state.name, 'aria-label': 'Dein Name' });
  const avatarRow = h('div', { class: 'choice-row avatar-grid' }, AVATARS.map((a) => h('button', {
    type: 'button', class: 'choice' + (a === avatar ? ' sel' : ''),
    onClick: (e) => { avatar = a; sfx.click(); avatarRow.querySelectorAll('.choice').forEach((b) => b.classList.toggle('sel', b === e.currentTarget)); },
  }, a)));
  const gradeRow = h('div', { class: 'choice-row' }, GRADES.map((g) => h('button', {
    type: 'button', class: 'choice wide' + (g === grade ? ' sel' : ''),
    onClick: (e) => { grade = g; sfx.click(); gradeRow.querySelectorAll('.choice').forEach((b) => b.classList.toggle('sel', b === e.currentTarget)); },
  }, g.label)));

  setScene('space');
  screen(h('section', { class: 'panel welcome' },
    h('div', { class: 'logo' }, h('span', { class: 'logo-planet' }, icon('orbit')), h('h1', {}, 'Genius'), h('p', { class: 'sub' }, 'Die Sternenakademie')),
    h('p', {}, 'Der Chaos-Nebel hat die Galaxie Numeria durcheinandergewirbelt. Rette die Planeten mit Mathe-Power!'),
    h('label', { class: 'lbl' }, 'Wie heißt du, Kadett?'), nameIn,
    h('label', { class: 'lbl' }, 'Wähle deinen Avatar'), avatarRow,
    h('label', { class: 'lbl' }, 'Wo startest du?'), gradeRow,
    h('button', {
      type: 'button', class: 'btn primary big',
      onClick: () => {
        state.name = nameIn.value.trim() || 'Kadett';
        state.avatar = avatar;
        state.grade = grade.g;
        for (const g of GAME_LIST) state.levels[g.id] = grade.L;
        save();
        sfx.win();
        renderMap();
      },
    }, ...withIcon('rocket', 'Abheben!'))));
}

/* ---------- Weltall ---------- */

// Positions in Numeria (world 7200×5400): planets in the middle, the wide outer ring is free space to explore
// (asteroid fields; treasure chests only hide out there). Infinitas mirrors them horizontally.
const LAYOUT = {
  station: [3600, 2700], pyramid: [2970, 2322], sequence: [4272, 2280], asteroid: [3628, 3372], scale: [2312, 2910],
  binary: [4888, 3092], magic: [2760, 1692], fraction: [4650, 1622], builder: [2032, 3680], duel: [5224, 3834],
  fortress: [5420, 1482], gate: [1822, 1482],
};
const posOf = (id) => {
  const [x, y] = LAYOUT[id];
  return state.galaxy === 1 ? { x: WORLD_W - x, y } : { x, y };
};
let lastLanded = null; // object the ship landed on (takeoff point)
const shipPos = {}; // last ship position per galaxy

function piAdvice() {
  const G = galaxy();
  const unlocked = GAME_LIST.filter(isUnlocked);
  const waiting = unlocked.find((g) => messageWaiting(g.id));
  if (waiting) return { text: `Auf ${info(waiting).name} wartet eine Geheimbotschaft! Folge dem gelben Pfeil.`, target: waiting.id };
  if (finaleUnlocked() && !state.finales[state.galaxy]) return { text: `Alle Koordinaten gefunden! Der Schutzschild um ${G.fortress.n} ist weg – flieg hin!`, target: 'fortress' };
  if (state.finales[state.galaxy]) {
    if (state.galaxy === 0 && !seen('prolog', '', 1)) return { text: 'Numeria ist gerettet! Das Sternentor bringt dich nach Infinitas – folge dem Pfeil.', target: 'gate' };
    return { text: 'Alles gerettet! Trainiere weiter – bis Stufe 40 warten noch richtig harte Nüsse.', target: null };
  }
  const story = unlocked.filter((g) => STORY_PLANETS.includes(g.id));
  const damaged = story.filter((g) => stageOf(g.id) === 0).sort((a, b) => points(b.id) - points(a.id))[0];
  if (damaged) return { text: `${info(damaged).name}: noch ${REPAIRED - points(damaged.id)} Punkte bis zur Reparatur. Fehlerfreie Rätsel bringen 2.`, target: damaged.id };
  const locked = GAME_LIST.filter((g) => !isUnlocked(g)).sort((a, b) => a.unlock - b.unlock)[0];
  if (locked) return { text: `Sammle noch ${locked.unlock - state.stars} Sterne – dann fällt der Schutzschild von ${info(locked).name}.`, target: locked.id };
  const shine = story.filter((g) => stageOf(g.id) === 1).sort((a, b) => points(b.id) - points(a.id))[0];
  if (shine) return { text: `${info(shine).name} kann noch strahlender werden: noch ${SHINING - points(shine.id)} Rettungspunkte.`, target: shine.id };
  if (questsOpen()) {
    const q = state.quests.list.find((x) => !x.done);
    return { text: `Tagesauftrag: ${q.text} (${q.progress}/${q.target})`, target: q.game || null };
  }
  return { text: 'Weiter so! Sammle Sternensplitter, suche Schatztruhen oder rüste dein Schiff in der Werft auf.', target: null };
}

function switchGalaxy(n) {
  if (n === 1 && !state.galaxy2Ready) {
    for (const g of GAME_LIST) setLevel(g.id, level(g.id) + 2);
    state.galaxy2Ready = true;
  }
  state.galaxy = n;
  save();
  sfx.win();
  lastLanded = { ...posOf('gate'), r: 80 };
  renderMap();
}

function worldObjects() {
  const G = galaxy();
  const objs = GAME_LIST.map((g) => {
    const p = info(g);
    const locked = !isUnlocked(g);
    const story = STORY_PLANETS.includes(g.id);
    const st = story && !locked ? stageOf(g.id) : null;
    const goal = st === 0 ? REPAIRED : SHINING;
    return {
      id: g.id, kind: 'planet', game: g, ...posOf(g.id), r: g.id === 'duel' ? 62 : 72, hue: g.hue, emoji: p.emoji, name: p.name,
      sub: locked ? `ab ${g.unlock} Sterne` : `${p.topic} · Stufe ${level(g.id)}`,
      locked, lockText: `Schutzschild: ab ${g.unlock} Sterne (du hast ${state.stars})`,
      stage: st, mail: !locked && messageWaiting(g.id),
      bar: st === null ? null : st === 2 ? 1 : Math.min(1, points(g.id) / goal),
    };
  });
  objs.push({ id: 'station', kind: 'station', ...posOf('station'), r: 55, hue: 210, emoji: '🛠️', name: 'Werft', sub: 'Schiffe & Farben', verb: 'Andocken' });
  const open = finaleUnlocked();
  const n = coordsFound();
  objs.push({
    id: 'fortress', kind: 'planet', dark: true, ...posOf('fortress'), r: 85, hue: 345,
    emoji: open ? G.fortress.e : '❓', name: open ? G.fortress.n : 'Unbekanntes Signal',
    sub: state.finales[state.galaxy] ? 'besiegt' : `${n}/${STORY_PLANETS.length} Koordinaten`,
    locked: !open, lockText: `Schutzschild – finde alle Koordinaten (${n}/${STORY_PLANETS.length})`, verb: 'Angreifen',
  });
  if (state.maxGalaxy > 0) {
    const other = GALAXIES[1 - state.galaxy];
    objs.push({ id: 'gate', kind: 'gate', ...posOf('gate'), r: 80, hue: 270, emoji: state.galaxy === 0 ? '♾️' : '🌌', name: `Sternentor nach ${other.name}`, verb: 'Durchfliegen' });
  }
  return objs;
}

const hudBtn = (name, label, onClick) => h('button', { type: 'button', class: 'hud-btn', title: label, 'aria-label': label, onClick }, h('span', {}, icon(name)), h('small', {}, label));

/* ---------- Erkundung: Sternensplitter & Schatztruhen ---------- */

const SHARDS = 40;
const CHESTS = 5;
const OUTER = 2400; // chests lie at least this far from the station: rewards for exploring the edges

/** Today's pickups (same layout all day and in both galaxies, collected ones removed). */
function worldPickups(objects) {
  if (state.world.day !== today()) { state.world = { day: today(), taken: [] }; save(); }
  const r = seeded(today());
  const out = [];
  const free = (x, y) => objects.every((o) => Math.hypot(o.x - x, o.y - y) > o.r + 150) && out.every((p) => Math.hypot(p.x - x, p.y - y) > 120);
  const outer = (x, y) => Math.hypot(x - WORLD_W / 2, y - WORLD_H / 2) > OUTER;
  for (let i = 0; i < SHARDS + CHESTS; i++) {
    const kind = i < SHARDS ? 'shard' : 'chest';
    for (let t = 0; t < 60; t++) {
      const x = 120 + r() * (WORLD_W - 240);
      const y = 120 + r() * (WORLD_H - 240);
      if (free(x, y) && (kind === 'shard' || outer(x, y))) { out.push({ id: `${kind}${i}`, kind, x, y }); break; }
    }
  }
  return out.filter((p) => !state.world.taken.includes(p.id));
}

function pickUp(p, world) {
  if (p.kind === 'chest') { openChest(p, world); return; }
  state.world.taken.push(p.id);
  state.crystals += 1;
  sfx.tick();
  announce(track('shard'));
  refreshHud();
}

/** Treasure chest: three quick mental-math locks, then a reward. Closing early puts it back. */
function openChest(p, world) {
  const L = Math.max(1, Math.round(GAME_LIST.reduce((s, g) => s + level(g.id), 0) / GAME_LIST.length));
  let opened = 0;
  let val = '';
  let q = mentalTask(L);
  const qEl = h('div', { class: 'chest-q' });
  const disp = h('div', { class: 'field active big-field' }, '?');
  const locks = h('div', { class: 'chest-locks' }, [0, 1, 2].map(() => h('span')));
  const draw = () => {
    qEl.textContent = `${q.q} =`;
    disp.textContent = val || '?';
    [...locks.children].forEach((d, k) => d.replaceChildren(icon(k < opened ? 'lock-open' : 'lock')));
  };
  const finish = () => {
    state.world.taken.push(p.id);
    const roll = Math.random() < 0.34;
    const egg = roll && eggsUseful();
    const gems = 30 + Math.floor(Math.random() * 31) + (roll && !egg ? 20 : 0); // crystals instead of an egg once all hatched
    state.crystals += gems;
    if (egg) state.eggs = (state.eggs || 0) + 1;
    setKeyHandler(null);
    close();
    confetti(120);
    sfx.win();
    announce([{ icon: 'gift', title: 'Schatztruhe geöffnet!', text: egg ? 'Kristalle und ein Ei-Splitter!' : 'Funkelnde Kristalle!', reward: `+${gems} Kristalle${egg ? ' · +1 Ei' : ''}` }, ...track('chest')]);
  };
  const onKey = (k) => {
    if (k === 'back') val = val.slice(0, -1);
    else if (k === 'ok') {
      if (!val) return;
      if (Number(val) === q.a) {
        opened++;
        sfx.tick();
        if (opened >= 3) { finish(); return; }
        q = mentalTask(L);
      } else { sfx.wrong(); shake(disp); }
      val = '';
    } else if (val.length < 6) val += k;
    draw();
  };
  const close = modal([
    h('h2', {}, 'Rechen-Schloss'),
    h('p', {}, 'Knacke alle 3 Schlösser!'),
    locks, qEl, disp, keypad(onKey),
  ], { onClose: () => { setKeyHandler(null); if (!state.world.taken.includes(p.id)) world?.restorePickup(p); } });
  setKeyHandler(onKey);
  draw();
}

function landOn(o) {
  if (o.kind === 'planet' && o.game) renderPlanet(o.game);
  else if (o.id === 'station') renderShop();
  else if (o.id === 'fortress') renderFinale();
  else if (o.id === 'gate') switchGalaxy(1 - state.galaxy);
}

function renderMap() {
  M = null;
  if (state.missions > 0 && state.cometDay !== today()) {
    state.cometDay = today();
    state.cometReady = true;
    save();
  }
  const G = galaxy();
  const v = villain();
  const ri = rankIndex(state.stars);
  const next = RANKS[ri + 1];
  const playable = GAME_LIST.filter((g) => isUnlocked(g) && g.rounds > 1);
  const freshQuests = ensureQuests({
    games: GAME_LIST.filter((g) => isUnlocked(g) && STORY_PLANETS.includes(g.id)).map((g) => ({ id: g.id, name: info(g).name })),
    boss: isUnlocked(GAMES.duel),
  });
  const advice = piAdvice();
  const objects = worldObjects();
  const musicIcon = () => icon(state.music ? 'music' : 'volume-x');
  const musicBtn = hudBtn(state.music ? 'music' : 'volume-x', 'Musik', () => {
    state.music = !state.music;
    save();
    setMusic(state.music);
    if (state.music) music('space');
    musicBtn.firstChild.replaceChildren(musicIcon());
  });
  const worldEl = h('div', { class: 'world' });
  // Pi's status panel folds into a small owl button after a few seconds so it never hides planets.
  let foldTimer;
  const fold = () => { clearTimeout(foldTimer); foldTimer = setTimeout(() => piPanel.classList.add('mini'), 8000); };
  const piPanel = h('button', {
    type: 'button', class: 'hud-pi', title: 'Professor Pi',
    onClick: () => {
      sfx.click();
      if (piPanel.classList.contains('mini')) { piPanel.classList.remove('mini'); fold(); } else piSay(advice.text, 9000);
    },
  },
  h('span', { class: 'pi-face' }, CHARS.pi.e),
  h('div', {},
    h('small', {}, `${G.name} · ${state.finales[state.galaxy] ? `${v.e} ${v.n} ist dein Freund` : `${v.e} ${v.n} – ${coordsFound()}/${STORY_PLANETS.length} Koordinaten`}`,
      next ? [` · ${next[1]} in ${next[0] - state.stars} `, icon('star')] : null),
    h('span', {}, advice.text)));
  fold();
  screen(
    worldEl,
    h('div', { class: 'hud' },
      topbar(false),
      piPanel,
      h('nav', { class: 'hud-side' },
        hudBtn('orbit', 'Expedition', () => startMission(playable.map((g) => g.id), { expedition: true })),
        hudBtn('clipboard-list', `Aufträge ${3 - questsOpen()}/3`, renderQuests),
        hudBtn('book-open', 'Logbuch', renderLog),
        hudBtn('egg', `${state.creatures.length}/${CREATURES.length}`, renderCollection),
        musicBtn,
        hudBtn('users', 'Eltern', renderParents))));
  setScene('world', 230, 'space');

  const from = lastLanded;
  lastLanded = null;
  const station = objects.find((o) => o.id === 'station');
  const start = from ? { x: from.x, y: from.y + from.r + 80 } : shipPos[state.galaxy] || { x: station.x, y: station.y + 150 };
  const world = createWorld(worldEl, {
    objects, start, ship: state.ship, galaxy: state.galaxy, takeoff: !!from, target: advice.target, comet: state.cometReady, tutorial: !state.flightTutorial,
    pickups: worldPickups(objects), speed: 1 + 0.2 * mod('turbo'), magnet: 1 + 0.6 * mod('magnet'), scanner: mod('scanner'),
    onLand: (o) => { lastLanded = o; landOn(o); },
    onNear: (o) => { if (o.game && !o.locked && info(o.game).radio && !seen('radio', o.id)) playScenes([{ kind: 'radio', id: o.id }]); },
    onComet: () => setTimeout(renderComet, 400),
    onPickup: (p) => pickUp(p, world),
    sfx: { land: () => sfx.tick(), comet: () => sfx.hatch() },
  });
  current = { destroy: () => { shipPos[state.galaxy] = world.shipPos(); world.destroy(); } };
  if (!state.flightTutorial) { state.flightTutorial = true; save(); }

  if (!seen('prolog')) playScenes([{ kind: 'prolog' }], renderMap);
  else if (pendingScenes.length) playScenes(pendingScenes.splice(0), renderMap);
  else if (freshQuests) piSay('Neuer Tag, neue Tagesaufträge!', 7000);
  else if (state.cometReady && !state.cometIntro) {
    state.cometIntro = true;
    save();
    piSay('Ein Knobel-Komet fliegt durchs All! Folge dem blauen Pfeil und fang ihn – darin stecken Rätsel, die es auf keinem Planeten gibt.', 9000);
  }
}

function rescueBar(id) {
  const pts = points(id);
  const st = stageOf(id);
  const goal = st === 0 ? REPAIRED : SHINING;
  const pct = st === 2 ? 100 : Math.min(100, (pts / goal) * 100);
  return h('div', { class: 'rescue' },
    h('div', { class: 'rescue-bar' }, h('i', { style: { width: pct + '%' } })),
    h('small', {}, st === 2 ? 'strahlend' : `${STAGE_NAMES[st]} · ${pts}/${goal}`));
}

/** Painted planet thumbnail (same texture as in space, from the art cache). */
function planetThumb(id, stage) {
  const el = h('div', { class: 'brief-orb' });
  if (!PLANET_TYPES[id]) return el;
  cachedArt(`planet:${id}:${state.galaxy}:${stage}:0`, () => paintPlanet({ type: PLANET_TYPES[id], seed: `${id}-${state.galaxy}`, stage, radius: 90 })).then((src) => {
    const c = h('canvas', { width: src.width, height: src.height });
    c.getContext('2d').drawImage(src, 0, 0);
    el.append(c);
  });
  return el;
}

function renderPlanet(g) {
  const p = info(g);
  const story = STORY_PLANETS.includes(g.id);
  let L = level(g.id);
  const lv = h('b', {}, L);
  const adj = (d) => { L = Math.max(1, Math.min(MAX_LEVEL, L + d)); setLevel(g.id, L); lv.textContent = L; sfx.click(); };
  const st = story ? stageOf(g.id) : null;
  const npcText = story && p.npc ? [p.radio.find((l) => l[0] === 'npc')?.[1], p.repaired, p.shining][st] : null;
  screen(
    topbar(),
    // Compact briefing card beside the landscape: the start button is always visible without scrolling.
    h('section', { class: `panel planet-intro briefing stage-${st ?? 1}`, style: { '--h': g.hue } },
      h('div', { class: 'brief-head' },
        planetThumb(g.id, st ?? 1),
        h('div', {}, h('h1', {}, p.name), h('h3', {}, p.topic),
          story ? h('div', { class: 'stage-label' }, `Zustand: ${STAGE_NAMES[st]}`, rescueBar(g.id)) : null)),
      npcText ? h('div', { class: 'npc-line' }, h('span', { class: 'npc-e' }, p.npc.e), h('div', {}, h('b', {}, p.npc.n), h('p', {}, npcText))) : null,
      h('p', { class: 'brief-text' }, p.intro),
      h('button', { type: 'button', class: 'btn primary big wide', onClick: () => startMission([g.id]) },
        ...(g.rounds > 1 ? withIcon('play', 'Mission starten') : withIcon('swords', 'Kampf starten!'))),
      messageWaiting(g.id) ? h('button', { type: 'button', class: 'btn danger wide pulse', onClick: () => openDecoder(g) }, ...withIcon('mail', 'Geheimbotschaft entschlüsseln')) : null,
      h('div', { class: 'brief-foot' },
        backBtn('Abheben'),
        p.radio ? h('button', { type: 'button', class: 'btn ghost', onClick: () => playScenes([{ kind: 'radio', id: g.id }]) }, ...withIcon('radio', 'Funk')) : null,
        h('div', { class: 'level-adjust' },
          h('button', { type: 'button', class: 'btn small', 'aria-label': 'Stufe runter', onClick: () => adj(-1) }, icon('minus')),
          h('span', {}, 'Stufe ', lv),
          h('button', { type: 'button', class: 'btn small', 'aria-label': 'Stufe hoch', onClick: () => adj(1) }, icon('plus'))))));
  setScene('surface', g.hue, g.id === 'duel' ? 'boss' : 'planet', planetLand(g, true));
  if (p.radio && !seen('radio', g.id)) playScenes([{ kind: 'radio', id: g.id }]);
}

function openDecoder(g) {
  const view = decoderView(g, (stillHere) => {
    announce(track('decoded'));
    if (!stillHere) { pendingScenes.push({ kind: 'decoded', id: g.id }); return; }
    renderMap();
    playScenes([{ kind: 'decoded', id: g.id }], renderMap);
  });
  screen(topbar(), view, h('div', { class: 'row' }, backBtn('Abheben')));
  setScene('surface', g.hue, 'planet', planetLand(g, true));
  setKeyHandler(view.keyHandler);
}

function renderFinale() {
  const G = galaxy();
  const v = villain();
  const start = () => startMission([], { finale: true });
  setScene('surface', 345, 'boss', { key: 'fortress', base: 0, villain: villain().e });
  screen(
    topbar(),
    h('section', { class: 'panel planet-intro briefing fortress-intro' },
      h('div', { class: 'orb fortress-orb' }, h('span', {}, G.fortress.e)),
      h('h1', {}, G.fortress.n),
      h('p', {}, `${v.e} ${v.n} wartet ${G.fortress.where}. Erst 4 Planeten-Rätsel, dann der Endkampf im Blitzrechnen.`),
      state.finales[state.galaxy] ? h('p', { class: 'callout' }, 'Schon einmal besiegt – aber ein Rückkampf geht immer!') : null,
      h('div', { class: 'row' },
        backBtn(),
        seen('finaleIntro') ? h('button', { type: 'button', class: 'btn ghost', onClick: () => playScenes([{ kind: 'finaleIntro' }]) }, ...withIcon('film', 'Szene ansehen')) : null,
        h('button', { type: 'button', class: 'btn danger big', onClick: () => (seen('finaleIntro') ? start() : playScenes([{ kind: 'finaleIntro' }], start)) }, ...withIcon('swords', 'Angriff!')))));
}

/* ---------- Mission ---------- */

function startMission(ids, { expedition = false, finale = false, duelOnly = false } = {}) {
  lastMission = { ids, expedition, finale, duelOnly };
  let list;
  if (finale) list = duelOnly ? ['duel'] : [...shuffle(STORY_PLANETS).slice(0, 4), 'duel'];
  else if (expedition) list = Array.from({ length: 6 }, () => pick(ids));
  else list = Array(GAMES[ids[0]].rounds).fill(ids[0]);
  M = {
    list, idx: 0, mistakes: 0, roundMistakes: 0, roundsWithMistakes: 0, lvlSum: 0, curL: 0, expedition, finale, flawless: {}, token: 0,
    startLevels: Object.fromEntries(list.map((id) => [id, level(id)])),
    startStages: Object.fromEntries(list.map((id) => [id, stageOf(id)])),
    startPoints: Object.fromEntries(list.map((id) => [id, points(id)])),
  };
  const stage = h('div', { class: 'stage' });
  const prog = h('div', { class: 'progress' }, list.map(() => h('i')));
  const lvBadge = h('span', { class: 'badge' });
  const comboEl = h('span', { class: 'combo' });
  const title = h('span', { class: 'mtitle' });
  const easier = h('button', { type: 'button', class: 'pill', title: 'Leichter machen', onClick: () => bump(-2) }, ...withIcon('turtle', 'Leichter'));
  const harder = h('button', { type: 'button', class: 'pill turbo', title: 'Schwerer machen', onClick: () => bump(3) }, ...withIcon('zap', 'Zu leicht!'));
  M.ui = { stage, prog, lvBadge, title, comboEl, pills: [easier, harder] };
  M.combo = 0;
  M.comboBonus = 0;
  M.enc = list.some((id) => id !== 'duel')
    ? createEncounter({
      villain: encounterVillain(), player: { e: state.avatar, n: state.name || 'Kadett' },
      rounds: list.filter((id) => id !== 'duel').length, playerMax: 5 + mod('shield'),
    })
    : null;
  screen(
    h('header', { class: 'mbar' },
      h('button', { type: 'button', class: 'icon', title: 'Mission abbrechen', 'aria-label': 'Mission abbrechen', onClick: abortMission }, icon('x')),
      title,
      prog,
      h('div', { class: 'mtools' },
        comboEl,
        lvBadge,
        h('button', { type: 'button', class: 'icon', title: 'Tipp', 'aria-label': 'Tipp', onClick: showHint }, icon('lightbulb')),
        easier,
        harder)),
    M.enc?.el,
    stage);
  nextRound();
}

function finaleBoss() {
  const v = villain();
  return { e: v.e, n: v.n, hp: galaxy().bossHp };
}

function nextRound() {
  current?.destroy?.();
  current = null;
  setKeyHandler(null);
  const id = M.list[M.idx];
  const g = GAMES[id];
  const p = info(g);
  // the finale duel is capped so the last fight stays winnable
  const L = M.finale && id === 'duel' ? Math.min(level(id), 20) : level(id);
  M.curL = L;
  M.locked = false;
  const boss = M.finale && id === 'duel' ? finaleBoss() : null;
  M.ui.title.textContent = boss ? `${boss.e} ${boss.n}` : p.name;
  setScene('surface', g.hue, id === 'duel' ? 'boss' : 'planet', { key: M.finale ? 'fortress' : id, base: M.finale ? 0 : planetLand(g).base });
  setRepair(M.idx / M.list.length, false);
  if (M.enc) {
    setChaos(M.enc.villainLife);
    M.enc.hide(id === 'duel');
  }
  // no level buttons in duels: they would reset the fight
  for (const b of M.ui.pills) b.hidden = g.rounds === 1;
  M.ui.lvBadge.textContent = `Stufe ${L}`;
  [...M.ui.prog.children].forEach((d, i) => { d.className = i < M.idx ? 'done' : i === M.idx ? 'now' : ''; });
  const stage = M.ui.stage;
  stage.replaceChildren();
  stage.classList.remove('enter');
  void stage.offsetWidth;
  stage.classList.add('enter');
  current = g.create(stage, L, makeApi(g, boss || p.boss)) || null;
}

function makeApi(g, boss) {
  const token = ++M.token;
  const mission = M;
  const alive = () => M === mission && M.token === token && !M.locked;
  const api = {
    ship: state.ship,
    boss,
    mods: { shield: mod('shield'), time: mod('time'), laser: mod('laser') },
    sfx,
    toast,
    keypad: (onKey) => {
      const guarded = (k) => { if (alive()) onKey(k); };
      setKeyHandler(guarded);
      return keypad(guarded);
    },
    setKeys: (fn) => setKeyHandler((k) => { if (alive()) fn(k); }),
    wrong: (msg, opts) => {
      if (!alive()) return;
      M.mistakes++;
      M.roundMistakes++;
      sfx.wrong();
      shake(M.ui.stage);
      if (msg) toast(msg, 'bad', 2400);
      // retrying the same field still counts as a mistake but costs no extra life
      if (M.enc && g.rounds > 1 && !opts?.repeat) { // the boss duel has its own hearts
        const left = M.enc.wrong();
        if (left <= 0) {
          M.locked = true;
          M.enc.defeat();
          later(missionLost, 2000);
          return;
        }
      }
      if (M.roundMistakes === 2 && g.rounds > 1) piSay(`Psst, ein Tipp: ${current?.hint || g.hint}`, 10000);
    },
    solved: (opts = {}) => {
      if (!alive()) return;
      M.locked = true;
      roundDone(g, opts, api.fieldCount || 1);
    },
    failed: () => {
      if (!alive()) return;
      M.locked = true;
      later(() => (M.finale ? finaleResult(0) : bossResult(g, 0)), 1200);
    },
  };
  return api;
}

/** setTimeout that only fires if the same mission is still running (not aborted/replaced). */
function later(fn, ms) {
  const mission = M;
  setTimeout(() => { if (M && M === mission) fn(); }, ms);
}

function roundDone(g, opts, fieldCount = 1) {
  state.stats.maxPlayedL = Math.max(state.stats.maxPlayedL || 0, M.curL);
  sfx.right();
  confetti(45);
  toast(opts.msg || pick(PRAISE), 'good', opts.msg ? 2600 : 1400);
  M.ui.prog.children[M.idx].className = 'done';
  if (g.rounds > 1) {
    M.combo = M.roundMistakes === 0 ? M.combo + 1 : 0;
    if (M.combo >= 2) M.comboBonus += 3 * M.combo;
    M.ui.comboEl.replaceChildren(...(M.combo >= 2 ? withIcon('flame', `Combo ×${M.combo}`) : []));
    M.ui.comboEl.classList.remove('pop');
    void M.ui.comboEl.offsetWidth;
    M.ui.comboEl.classList.toggle('pop', M.combo >= 2);
    announce(track('round', { game: g.id, combo: M.combo }));
  }
  if (M.enc && g.rounds > 1) {
    M.enc.solved();
    M.enc.heal(Math.max(1, Math.ceil(fieldCount / 4)));
    setRepair((M.idx + 1) / M.list.length);
    setChaos(M.enc.villainLife);
    if (M.combo >= 3) {
      const n = M.combo;
      later(() => M.enc.taunt(pick([`Was?! ${n} hintereinander?!`, 'Hör auf, so schlau zu sein!', 'Das ist doch nicht normal!'])), 2300);
    }
    if (!M.finale && M.idx === M.list.length - 1) setTimeout(() => M?.enc?.finish(), 700);
  }
  if (g.rounds === 1) {
    later(() => (M.finale ? finaleResult(opts.stars ?? 1) : bossResult(g, opts.stars ?? 1)), 1500);
    return;
  }
  M.lvlSum += M.curL;
  if (M.roundMistakes > 0) M.roundsWithMistakes++;
  if (!M.finale) addPoints(g.id, M.roundMistakes === 0 ? 2 : 1);
  // Adaptive Schwierigkeit: drei fehlerfreie Rätsel in Folge → eine Stufe höher.
  if (M.roundMistakes === 0) {
    M.flawless[g.id] = (M.flawless[g.id] || 0) + 1;
    if (M.flawless[g.id] >= 3) {
      M.flawless[g.id] = 0;
      setLevel(g.id, level(g.id) + 1);
      later(() => piSay(`Stark! Das war dir zu leicht – ${info(g).name} ist jetzt Stufe ${level(g.id)}.`, 3500), 1200);
    }
  } else {
    M.flawless[g.id] = 0;
    if (M.roundMistakes >= 2) setLevel(g.id, level(g.id) - 1);
  }
  save();
  later(() => {
    M.roundMistakes = 0;
    M.idx++;
    if (M.idx >= M.list.length) finishMission();
    else nextRound();
  }, opts.msg ? 2000 : 1200);
}

function bump(d) {
  if (!M || M.locked) return;
  const id = M.list[M.idx];
  if (GAMES[id].rounds === 1) return;
  setLevel(id, level(id) + d);
  sfx.tick();
  toast(d > 0 ? `Schwieriger: Stufe ${level(id)}` : `Leichter: Stufe ${level(id)}`);
  nextRound();
}

function showHint() {
  if (!M) return;
  const g = GAMES[M.list[M.idx]];
  modal([h('h2', {}, 'Tipp'), h('div', { class: 'npc-line' }, h('span', { class: 'npc-e' }, CHARS.pi.e), h('div', {}, h('b', {}, CHARS.pi.n), h('p', {}, current?.hint || g.hint)))]);
}

function abortMission() {
  modal([
    h('h2', {}, 'Mission abbrechen?'),
    h('p', {}, 'Dein Fortschritt in dieser Mission geht verloren.'),
    h('div', { class: 'row' },
      h('button', { type: 'button', class: 'btn ghost', onClick: (e) => e.target.closest('.overlay').querySelector('.modal-x').click() }, 'Weiterspielen'),
      h('button', { type: 'button', class: 'btn danger', onClick: (e) => { e.target.closest('.overlay').remove(); renderMap(); } }, 'Abbrechen')),
  ]);
}

function updateStreak() {
  const t = today();
  if (state.lastDay === t) return;
  const y = localDay(-1);
  state.streak = state.lastDay === y ? state.streak + 1 : 1;
  state.lastDay = t;
}

/** stars: shown result; starCap limits what goes onto the star counter (boss fights). */
function award(stars, crystals, starCap = stars) {
  const prevStars = state.stars;
  const prevRank = rankIndex(prevStars);
  state.stars += Math.min(stars, starCap);
  state.crystals += crystals;
  state.missions++;
  updateStreak();
  if (stars > 0 && !state.cometReady && Math.random() < 0.35) state.cometReady = true;
  let hatched = null;
  let eggGems = 0;
  if (stars > 0) {
    const free = CREATURES.filter((c) => !c.comet && !state.creatures.includes(c.id));
    if (!free.length) {
      eggGems = 20; // nothing left to hatch: crystals instead of an egg
      state.crystals += eggGems;
    } else {
      state.eggs = (state.eggs || 0) + 1;
      if (state.eggs >= 2) {
        state.eggs -= 2;
        hatched = pick(free);
        state.creatures.push(hatched.id);
      }
    }
  }
  save();
  const result = {
    hatched,
    eggGems,
    rankUp: rankIndex(state.stars) > prevRank ? RANKS[rankIndex(state.stars)][1] : null,
    unlocked: state.galaxy === 0 ? GAME_LIST.filter((g) => g.unlock > prevStars && g.unlock <= state.stars) : [],
  };
  announce(track('check'));
  return result;
}

function finishMission() {
  const ids = [...new Set(M.list)];
  const stars = M.roundsWithMistakes === 0 ? 3 : M.roundsWithMistakes <= 2 ? 2 : 1;
  const avgL = M.lvlSum / M.list.length; // pay for the levels actually played
  const comboBonus = M.comboBonus;
  const crystals = Math.round(M.list.length * (8 + avgL / 2) * (1 + (stars - 1) * 0.25) * (M.expedition ? 1.5 : 1)) + comboBonus;
  const changes = ids.map((id) => [info(GAMES[id]), M.startLevels[id], level(id)]);
  const storyIds = ids.filter((id) => STORY_PLANETS.includes(id));
  const rescue = storyIds.map((id) => [info(GAMES[id]), M.startPoints[id], points(id)]);
  const scenes = [];
  for (const id of storyIds) {
    if (M.startStages[id] < 1 && stageOf(id) >= 1) scenes.push({ kind: 'repaired', id });
    if (M.startStages[id] < 2 && stageOf(id) >= 2) { scenes.push({ kind: 'shining', id }); announce(track('shine')); }
  }
  const waiting = storyIds.map((id) => GAMES[id]).find((g) => messageWaiting(g.id));
  const mistakes = M.mistakes;
  announce(track('mission', { games: ids, expedition: M.expedition, perfect: M.mistakes === 0 }));
  const extra = award(stars, crystals);
  renderResult({ win: true, stars, crystals, comboBonus, changes, rescue, scenes, waiting, mistakes, ...extra });
}

/** Player ran out of life in the encounter: mission lost, retry possible. */
function missionLost() {
  const id = M.list[M.idx];
  const L0 = level(id);
  setLevel(id, L0 - 1);
  const crystals = 3 * M.idx; // small consolation for the puzzles that were solved
  state.crystals += crystals;
  updateStreak();
  save();
  renderResult({ win: false, lost: true, stars: 0, crystals, changes: [[info(GAMES[id]), L0, level(id)]], unlocked: [] });
}

function bossResult(g, stars) {
  const L0 = level(g.id);
  setLevel(g.id, L0 + (stars === 3 ? 1 : stars > 0 ? 0 : -1));
  const crystals = stars ? Math.round((10 + M.curL * 2) * (1 + (stars - 1) * 0.25)) : 5;
  if (stars > 0) announce(track('boss'));
  const extra = award(stars, crystals, 1);
  renderResult({ win: stars > 0, stars, crystals, changes: [[info(g), L0, level(g.id)]], boss: true, ...extra });
}

function finaleResult(stars) {
  const gal = state.galaxy;
  const first = !state.finales[gal];
  if (stars > 0) {
    state.finales[gal] = true;
    if (gal === 0) state.maxGalaxy = Math.max(state.maxGalaxy, 1);
    setLevel('duel', level('duel') + 1);
  }
  // full reward only for the first victory per galaxy; replays pay less and add at most 1 star
  const crystals = stars ? (first ? 150 + 50 * stars : 40 + 10 * stars) : 10;
  if (stars > 0) announce(track('boss'));
  const extra = award(stars, crystals, first ? stars : 1);
  if (stars > 0) {
    renderCredits(stars, crystals);
    if (first) playScenes([{ kind: 'ending' }]);
    return;
  }
  setLevel('duel', level('duel') - 1);
  lastMission = { ids: [], finale: true, duelOnly: true }; // retry only the final duel
  renderResult({ win: false, stars: 0, crystals, changes: [], boss: true, finale: true, ...extra });
}

/* ---------- Ergebnis ---------- */

function renderResult(r) {
  M = null;
  if (r.win) { sfx.win(); confetti(140, 0.5, 0.3); } else sfx.lose();
  const changeLines = r.changes.map(([p, a, b]) => h('li', {},
    `${p.name}: Stufe ${a}`, b !== a ? ` → ${b}` : '', b > a + 1 ? ' · Turbo-Aufstieg!' : ''));
  const rescueLines = (r.rescue || []).map(([p, a, b]) => {
    const st = stageOf(p.id);
    return h('li', {}, `${p.name}: Rettung +${b - a} → ${st === 2 ? 'strahlend' : `${STAGE_NAMES[st]} (${b}/${st === 0 ? REPAIRED : SHINING})`}`);
  });
  const eggsLeft = Math.max(1, 2 - (state.eggs || 0));
  const eggCreaturesLeft = CREATURES.some((c) => !c.comet && !state.creatures.includes(c.id));
  const v = villain();
  setScene('surface', document.body.style.getPropertyValue('--ph') || 230, 'planet', 'keep');
  if (r.win) celebrateScenery();
  screen(
    topbar(),
    h('section', { class: 'panel result' },
      h('h1', {}, r.win ? (r.stars === 3 ? 'Perfekte Mission!' : 'Mission erfüllt!') : r.lost ? `${encounterVillain().n} hat diese Runde gewonnen …` : r.finale ? `${v.n} war diesmal stärker …` : 'Der Gegner war stärker …'),
      bigStars(r.stars),
      !r.boss && r.win ? h('p', {}, r.mistakes === 0 ? 'Kein einziger Fehler!' : `${r.mistakes} Fehlversuch${r.mistakes === 1 ? '' : 'e'}`) : null,
      r.lost ? h('p', {}, 'Deine Lebensenergie ist leer.') : null,
      r.crystals ? h('p', { class: 'earn' }, `+${r.crystals} `, icon('gem')) : null,
      r.comboBonus ? h('p', { class: 'muted' }, `davon Combo-Bonus: +${r.comboBonus} `, icon('gem')) : null,
      r.eggGems ? h('p', { class: 'muted' }, `Alle Zahlenwesen sind geschlüpft – statt eines Eis: +${r.eggGems} `, icon('gem')) : null,
      h('ul', { class: 'changes' }, changeLines, rescueLines),
      r.waiting ? h('button', { type: 'button', class: 'btn danger pulse', onClick: () => openDecoder(r.waiting) }, ...withIcon('mail', `Botschaft auf ${info(r.waiting).name} entschlüsseln`)) : null,
      r.win && !r.boss ? h('div', { class: 'callout' }, `${encounterVillain().e} ${encounterVillain().n} ist geflohen!`) : null,
      r.rankUp ? h('div', { class: 'callout' }, ...withIcon('medal', `Neuer Rang: ${r.rankUp}!`)) : null,
      r.unlocked.map((g) => h('div', { class: 'callout' }, ...withIcon('orbit', `Neuer Planet entdeckt: ${info(g).name}!`))),
      r.hatched
        ? h('div', { class: 'hatch' }, h('p', {}, 'Ein Zahlenwesen ist geschlüpft!'), creatureCard(r.hatched, true))
        : (eggCreaturesLeft && r.stars > 0 ? h('p', { class: 'muted' }, ...withIcon('egg', `Noch ${eggsLeft} Mission${eggsLeft === 1 ? '' : 'en'} bis zum nächsten Zahlenwesen`)) : null),
      h('div', { class: 'row' },
        backBtn('Abheben'),
        h('button', { type: 'button', class: 'btn primary big', onClick: () => startMission(lastMission.ids, lastMission) }, ...(r.win ? withIcon('play', 'Nächste Mission') : withIcon('rotate-ccw', lastMission.duelOnly ? 'Endkampf wiederholen' : 'Nochmal versuchen'))))));
  if (r.hatched) setTimeout(() => sfx.hatch(), 900);
  if (r.scenes?.length) {
    const panel = app.querySelector('.result');
    setTimeout(() => { if (panel?.isConnected) playScenes(r.scenes); else pendingScenes.push(...r.scenes); }, 1400);
  }
  else setTimeout(() => piSay(r.lost ? 'Das war knapp! Tipp: Lieber einmal mehr nachrechnen als schnell raten. Du schaffst das!' : !r.win ? 'Kopf hoch! Beim nächsten Mal bist du schneller.' : r.stars === 3 ? 'Perfekt! So rechnet ein echtes Genie.' : 'Gut gemacht! Fehler zeigen dir, wo dein Gehirn gerade wächst.', 5000), 1200);
}

function renderCredits(stars, crystals) {
  M = null;
  const gal = state.galaxy;
  sfx.win();
  confetti(220, 0.5, 0.3);
  const maxLevel = Math.max(...GAME_LIST.map((g) => level(g.id)));
  const friends = [CHARS.pi.e, state.avatar, CHARS.wirrwarr.e, gal > 0 ? CHARS.nulla.e : null].filter(Boolean);
  setScene('space');
  screen(
    topbar(),
    h('section', { class: 'panel result credits' },
      h('h1', {}, gal === 0 ? 'Numeria ist gerettet!' : 'GENIUS!'),
      h('div', { class: 'friends' }, friends.map((e) => h('span', {}, e))),
      bigStars(stars),
      h('p', { class: 'earn' }, `+${crystals} `, icon('gem')),
      h('ul', { class: 'changes' },
        h('li', {}, `Missionen: ${state.missions}`),
        h('li', {}, `Sterne: ${state.stars}`),
        h('li', {}, `Zahlenwesen: ${state.creatures.length}/${CREATURES.length}`),
        h('li', {}, `Höchste Stufe: ${maxLevel}`)),
      h('p', {}, gal === 0
        ? 'Doch weit draußen flackert ein neues Signal … In der Galaxie Infinitas verschwinden Zahlen im Nichts. Die Rätsel dort sind schwerer – bist du bereit?'
        : 'Zwei Galaxien gerettet! Aber die Mathematik ist unendlich – genau wie Infinitas. Alle Planeten bleiben offen, bis Stufe 40 und für jeden Rückkampf.'),
      h('div', { class: 'row' },
        backBtn(),
        gal === 0 ? h('button', { type: 'button', class: 'btn primary big', onClick: () => switchGalaxy(1) }, ...withIcon('rocket', 'Auf nach Infinitas!')) : null)));
}

/* ---------- Knobel-Kometen ---------- */

const COMET_REWARDS = [
  { gold: 2, creature: 'taxi' },
  { gold: 5, creature: 'hanoi' },
  { gold: 7, ship: '☄️' },
  { gold: 10, creature: 'bruecken' },
];
let comet = null; // current puzzle; kept while the comet waits on the map

const cometLevel = () => state.cometLevel ?? Math.round(GAME_LIST.reduce((s, g) => s + level(g.id), 0) / GAME_LIST.length);

function renderComet() {
  if (!comet) { comet = makeComet(cometLevel(), cometSolved); comet.hintIdx = 0; }
  const c = comet;
  const hintLabel = () => withIcon('lightbulb', c.hintIdx < c.hints.length ? `Tipp ${c.hintIdx + 1}/${c.hints.length}` : 'Keine Tipps mehr');
  const hintBtn = h('button', {
    type: 'button', class: 'btn',
    onClick: () => {
      const hint = c.hints[c.hintIdx];
      if (!hint) return;
      hint.act?.();
      c.hintIdx++;
      piSay(hint.text, 14000);
      hintBtn.replaceChildren(...hintLabel());
    },
  }, ...hintLabel());
  const actions = h('div', { class: 'row' },
    backBtn(),
    hintBtn,
    h('button', { type: 'button', class: 'btn ghost', onClick: () => cometGiveUp(actions) }, ...withIcon('flag', 'Auflösen')));
  setScene('space');
  screen(topbar(), h('section', { class: 'panel comet-panel' },
    h('div', { class: 'dec-head' }, h('span', { class: 'comet-icon' }, icon('sparkles')), h('div', {},
      h('h1', {}, c.title))),
    h('p', {}, c.intro),
    c.el,
    actions));
  if (c.keys) setKeyHandler(c.keys);
}

function cometSolved() {
  const c = comet;
  if (!c) return; // already given up / solved
  comet = null;
  state.goldStars = (state.goldStars || 0) + 1;
  state.crystals += 30;
  state.cometReady = false;
  state.cometLevel = Math.min(MAX_LEVEL, cometLevel() + (c.hintIdx === 0 ? 2 : c.hintIdx < c.hints.length ? 1 : 0));
  const gained = COMET_REWARDS.filter((r) => r.gold === state.goldStars);
  for (const r of gained) {
    if (r.creature && !state.creatures.includes(r.creature)) state.creatures.push(r.creature);
    if (r.ship && !state.ships.includes(r.ship)) state.ships.push(r.ship);
  }
  announce(track('comet'));
  save();
  setKeyHandler(null);
  sfx.win();
  confetti(160);
  toast('Geknackt!', 'good');
  const panel = app.querySelector('.comet-panel');
  setTimeout(() => { if (panel?.isConnected) renderCometReward(gained); }, 1400);
}

function renderCometReward(gained) {
  const next = COMET_REWARDS.find((r) => r.gold > state.goldStars);
  setScene('space');
  screen(topbar(), h('section', { class: 'panel result' },
    h('h1', {}, 'Goldstern!'),
    h('p', { class: 'earn' }, '+1 ', icon('sparkles'), ' · +30 ', icon('gem')),
    gained.map((r) => (r.creature
      ? h('div', { class: 'hatch' }, h('p', {}, 'Ein Kometen-Zahlenwesen ist zu dir geflogen!'), creatureCard(CREATURES.find((c) => c.id === r.creature), true))
      : h('div', { class: 'callout' }, 'Neues Schiff in der Werft: ☄️ Kometenreiter!'))),
    next ? h('p', { class: 'muted' }, `Nächste Kometen-Belohnung bei ${next.gold} `, icon('sparkles')) : null,
    h('div', { class: 'row' }, backBtn())));
  if (gained.some((r) => r.creature)) setTimeout(() => sfx.hatch(), 600);
}

function cometGiveUp(actions) {
  if (!comet) return;
  comet.solve();
  comet = null;
  state.cometReady = false;
  state.cometLevel = Math.max(1, cometLevel() - 1);
  save();
  setKeyHandler(null);
  piSay('So sieht die Lösung aus. Schau sie dir in Ruhe an – beim nächsten Kometen klappt es bestimmt!', 7000);
  actions.replaceChildren(backBtn());
}

/* ---------- Aufträge & Abzeichen ---------- */

function renderQuests() {
  const quests = state.quests.day === today() ? state.quests.list : [];
  setScene('space');
  screen(
    topbar(),
    h('section', { class: 'panel' },
      h('h1', {}, 'Aufträge & Abzeichen'),
      h('h3', {}, 'Heutige Aufträge'),
      h('div', { class: 'quests' }, quests.map((q) => h('div', { class: 'quest' + (q.done ? ' done' : '') },
        h('span', { class: 'q-check q-box' }, q.done ? icon('check') : null),
        h('div', { class: 'q-body' },
          h('b', {}, q.text),
          h('div', { class: 'rescue-bar' }, h('i', { style: { width: (q.progress / q.target) * 100 + '%' } })),
          h('small', {}, `${q.progress}/${q.target} · +40 `, icon('gem')))))),
      h('h3', {}, `Abzeichen ${state.badges.length}/${BADGES.length}`),
      h('div', { class: 'badges' }, BADGES.map((b) => {
        const got = state.badges.includes(b.id);
        return h('div', { class: 'badge-card' + (got ? '' : ' locked') }, h('span', { class: 'ce' }, b.e), h('b', {}, b.n), h('small', {}, b.d));
      })),
      h('h3', {}, 'Deine Statistik'),
      h('ul', { class: 'changes' },
        h('li', {}, `Rätsel gelöst: ${statOf('rounds')} · beste Combo: ${statOf('maxCombo')}`),
        h('li', {}, `Truhen: ${statOf('chests')} · Splitter: ${statOf('shards')}`),
        h('li', {}, `Bosssiege: ${statOf('bossWins')} · Kometen: ${statOf('comets')} · Botschaften: ${statOf('decoded')}`)),
      h('div', { class: 'row' }, backBtn())));
}

/* ---------- Logbuch ---------- */

function renderLog() {
  const sections = GALAXIES.slice(0, state.maxGalaxy + 1).map((G, gal) => {
    const items = sceneOrder(gal);
    return [
      h('h3', {}, G.name),
      items.length
        ? h('div', { class: 'log' }, items.map(([kind, id]) => h('button', {
          type: 'button', class: 'log-item', onClick: () => playScenes([{ kind, id, gal }]),
        }, buildScene(kind, id, gal, GAMES).title)))
        : h('p', { class: 'muted' }, 'Noch keine Einträge.'),
    ];
  });
  setScene('space');
  screen(
    topbar(),
    h('section', { class: 'panel' },
      h('h1', {}, 'Logbuch'),
      sections,
      h('div', { class: 'row' }, backBtn())));
}

/* ---------- Sammlung ---------- */

function creatureCard(c, open = false) {
  return h('div', { class: 'creature open' + (open ? ' big' : '') },
    h('span', { class: 'ce' }, c.e), h('b', {}, c.n), h('p', {}, c.fact));
}

function renderCollection() {
  setScene('space');
  screen(
    topbar(),
    h('section', { class: 'panel' },
      h('h1', {}, 'Zahlenwesen'),
      h('div', { class: 'creatures' }, CREATURES.map((c) => {
        const owned = state.creatures.includes(c.id);
        return h('button', {
          type: 'button', class: 'creature' + (owned ? '' : ' unknown'),
          onClick: () => (owned ? modal([creatureCard(c, true)]) : toast(c.comet ? 'Dieses Zahlenwesen kommt nur mit Knobel-Kometen.' : 'Dieses Zahlenwesen schläft noch in seinem Ei.')),
        }, h('span', { class: 'ce' }, owned ? c.e : icon(c.comet ? 'sparkles' : 'egg')), h('b', {}, owned ? c.n : '???'));
      })),
      h('div', { class: 'row' }, backBtn())));
}

/* ---------- Werft (Shop mit Rechen-Bezahlung) ---------- */

function renderShop() {
  const moduleItem = (m) => {
    const L = mod(m.id);
    const maxed = L >= m.prices.length;
    const price = m.prices[L];
    return h('button', {
      type: 'button', class: 'shop-item module' + (L ? ' sel' : ''),
      onClick: () => {
        if (maxed) { toast(`${m.n} ist voll ausgebaut!`); return; }
        buy({ n: `${m.n} – Stufe ${L + 1}`, p: price }, () => { state.modules[m.id] = L + 1; });
      },
    },
    h('span', { class: 'ce' }, icon(m.icon)), h('b', {}, m.n),
    h('span', { class: 'pips' }, m.prices.map((_, k) => (k < L ? '●' : '○')).join(' ')),
    h('small', { class: 'mod-d' }, m.d(maxed ? L : L + 1)),
    h('small', {}, ...(maxed ? ['voll ausgebaut'] : [`${L ? 'Upgrade' : 'Kaufen'}: ${price} `, icon('gem')])));
  };
  const shipItem = (s) => {
    const owned = state.ships.includes(s.id);
    const on = state.ship === s.id;
    return h('button', {
      type: 'button', class: 'shop-item' + (on ? ' sel' : ''),
      onClick: () => {
        if (owned) { state.ship = s.id; save(); sfx.click(); renderShop(); } else if (s.gold) { sfx.wrong(); toast(`Nur für Knobel-Profis: Sammle ${s.gold} Goldsterne mit Knobel-Kometen.`); } else buy(s, () => { state.ships.push(s.id); state.ship = s.id; });
      },
    }, h('span', { class: 'ce' }, s.e), h('b', {}, s.n), h('small', {}, ...(on ? ['aktiv'] : owned ? ['auswählen'] : s.gold ? [`ab ${s.gold} `, icon('sparkles')] : [`${s.p} `, icon('gem')])));
  };
  const themeItem = (t) => {
    const owned = state.themes.includes(t.id);
    const on = state.theme === t.id;
    return h('button', {
      type: 'button', class: 'shop-item' + (on ? ' sel' : ''),
      onClick: () => {
        if (owned) { state.theme = t.id; save(); applySettings(); sfx.click(); renderShop(); } else buy(t, () => { state.themes.push(t.id); state.theme = t.id; });
      },
    }, h('span', { class: 'ce' }, h('span', { class: 'swatch', style: { background: `linear-gradient(135deg, ${t.sw[0]} 50%, ${t.sw[1]} 50%)` } })), h('b', {}, t.n),
    h('small', {}, ...(on ? ['aktiv'] : owned ? ['auswählen'] : [`${t.p} `, icon('gem')])));
  };
  setScene('surface', 210, 'planet');
  screen(
    topbar(),
    h('section', { class: 'panel' },
      h('h1', {}, 'Werft'),
      h('h3', {}, 'Schiffs-Module'),
      h('div', { class: 'shop' }, MODULES.map(moduleItem)),
      h('h3', {}, 'Raumschiffe'),
      h('div', { class: 'shop' }, SHIPS.map(shipItem)),
      h('h3', {}, 'Galaxie-Farben'),
      h('div', { class: 'shop' }, THEMES.map(themeItem)),
      h('div', { class: 'row' }, backBtn())));
}

function buy(item, grant) {
  if (state.crystals < item.p) {
    sfx.wrong();
    toast(`Dir fehlen noch ${item.p - state.crystals} Kristalle.`, 'bad');
    return;
  }
  const answer = state.crystals - item.p;
  let val = '';
  const disp = h('div', { class: 'field active big-field' }, '?');
  const onKey = (k) => {
    if (k === 'back') val = val.slice(0, -1);
    else if (k === 'ok') {
      if (!val) return;
      if (Number(val) === answer) {
        grant();
        state.crystals = answer + 5;
        save();
        applySettings();
        close();
        sfx.coin();
        confetti(80);
        toast('Richtig gerechnet! +5 Kristalle Bonus', 'good');
        renderShop();
        return;
      }
      sfx.wrong();
      shake(disp);
      toast('Hmm, rechne nochmal nach!', 'bad');
      val = '';
    } else if (val.length < 5) val += k;
    disp.textContent = val || '?';
  };
  const close = modal([
    h('h2', {}, item.e ? `${item.e} ${item.n}` : item.n),
    h('p', {}, `Du hast ${state.crystals} Kristalle. Es kostet ${item.p}.`),
    h('p', {}, h('b', {}, 'Wie viele Kristalle bleiben dir übrig?')),
    disp,
    keypad(onKey),
  ], { onClose: () => setKeyHandler(null) });
  setKeyHandler(onKey);
}

/* ---------- Eltern & Lehrkräfte ---------- */

function renderParents() {
  const rows = GAME_LIST.map((g) => {
    const lv = h('b', {}, level(g.id));
    const adj = (d) => { setLevel(g.id, level(g.id) + d); lv.textContent = level(g.id); };
    return h('tr', {},
      h('td', {}, g.name), h('td', { class: 'muted' }, g.topic),
      h('td', { class: 'lvcell' },
        h('button', { type: 'button', class: 'btn small', 'aria-label': 'Stufe runter', onClick: () => adj(-1) }, icon('minus')), lv,
        h('button', { type: 'button', class: 'btn small', 'aria-label': 'Stufe hoch', onClick: () => adj(1) }, icon('plus'))));
  });
  const nameIn = h('input', { type: 'text', maxlength: 16, value: state.name, 'aria-label': 'Name' });
  const soundLabel = () => (state.sound ? withIcon('volume-2', 'Töne an') : withIcon('volume-x', 'Töne aus'));
  const musicLabel = () => (state.music ? withIcon('music', 'Musik an') : withIcon('volume-x', 'Musik aus'));
  setScene('space');
  screen(
    topbar(),
    h('section', { class: 'panel parents' },
      h('h1', {}, 'Für Eltern & Lehrkräfte'),
      h('p', {}, 'Für Kinder, denen Mathe zu leicht ist: neue Themen statt nur schneller rechnen.'),
      h('ul', { class: 'parents-facts' },
        h('li', {}, 'Passt sich an: jeder Planet hat Stufen 1–40, „Zu leicht!“ springt sofort 3 hoch.'),
        h('li', {}, 'Hilfe ohne Strafe: Tipps sind kostenlos, nach einer Niederlage geht es sofort weiter.'),
        h('li', {}, 'Keine Werbung, kein Tracking, kein Konto. Alles bleibt auf diesem Gerät, auch offline.')),
      h('h3', {}, 'Stufen anpassen'),
      h('table', { class: 'levels' }, h('tbody', {}, rows)),
      h('h3', {}, 'Einstellungen'),
      h('div', { class: 'row left' }, nameIn,
        h('button', { type: 'button', class: 'btn small', onClick: () => { state.name = nameIn.value.trim() || state.name; save(); toast('Name gespeichert'); } }, 'Name speichern')),
      h('div', { class: 'row left' },
        h('span', { class: 'muted' }, 'Grafik:'),
        ...[['auto', 'settings', 'Automatisch'], ['low', 'battery-low', 'Sparmodus'], ['high', 'sparkles', 'Volle Grafik']].map(([v, ic, label]) => h('button', {
          type: 'button', class: 'btn small' + ((state.perf || 'auto') === v ? ' primary' : ''), title: v === 'low' ? 'Für ältere iPads' : null,
          onClick: () => { state.perf = v; if (v === 'auto') state.perfAuto = null; save(); applySettings(); renderParents(); },
        }, ...withIcon(ic, label)))),
      h('div', { class: 'row left' },
        h('button', { type: 'button', class: 'btn', onClick: (e) => { state.sound = !state.sound; save(); applySettings(); e.currentTarget.replaceChildren(...soundLabel()); } }, ...soundLabel()),
        h('button', { type: 'button', class: 'btn', onClick: (e) => { state.music = !state.music; save(); applySettings(); if (state.music) music('space'); e.currentTarget.replaceChildren(...musicLabel()); } }, ...musicLabel()),
        h('button', {
          type: 'button', class: 'btn danger',
          onClick: () => modal([
            h('h2', {}, 'Wirklich alles zurücksetzen?'),
            h('p', {}, 'Sterne, Kristalle, Zahlenwesen, Geschichte und Stufen werden gelöscht.'),
            h('button', { type: 'button', class: 'btn danger', onClick: (e) => { e.target.closest('.overlay').remove(); resetState(); applySettings(); renderWelcome(); } }, 'Ja, neu starten'),
          ]),
        }, ...withIcon('trash-2', 'Fortschritt löschen'))),
      h('p', { class: 'muted' }, `Missionen gespielt: ${state.missions}`),
      h('div', { class: 'row' }, backBtn())));
}

/* ---------- Start ---------- */

applySettings();
starfield();
// Wait briefly for the UI font so canvas labels in space are drawn with it (max. 0.8 s, then fallback).
const fontReady = document.fonts ? Promise.race([document.fonts.load('700 21px Outfit'), new Promise((r) => setTimeout(r, 800))]) : Promise.resolve();
fontReady.catch(() => {}).then(() => { if (state.name) renderMap(); else renderWelcome(); });

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
