// Langzeit-Motivation: Statistik, Tagesaufträge, Abzeichen und Schiffs-Module.
import { pick, shuffle, localDay } from './util.js';
import { state, save } from './state.js';

export const today = () => localDay();
export const stat = (k) => state.stats[k] || 0;
const inc = (k, n = 1) => { state.stats[k] = stat(k) + n; };

/* ------------------------------------------------------------------ */
/* Schiffs-Module (Werft)                                              */
/* ------------------------------------------------------------------ */

export const MODULES = [
  { id: 'shield', icon: 'shield', n: 'Schutzschild', prices: [120, 260, 450], d: (L) => `+${L} Herz${L > 1 ? 'en' : ''} im Bosskampf` },
  { id: 'time', icon: 'hourglass', n: 'Zeitkristall', prices: [100, 220, 400], d: (L) => `Bosse laden ${L * 15} % langsamer` },
  { id: 'laser', icon: 'crosshair', n: 'Laser-Verstärker', prices: [100, 220, 400], d: (L) => `Längeres Zeitfenster für Blitz-Treffer (+${L * 30} %)` },
  { id: 'turbo', icon: 'gauge', n: 'Turbo-Triebwerk', prices: [80, 180, 320], d: (L) => `+${L * 20} % Fluggeschwindigkeit` },
  { id: 'scanner', icon: 'radar', n: 'Schatz-Scanner', prices: [150, 300], d: (L) => (L === 1 ? 'Zeigt Schatztruhen auf der Minikarte' : 'Truhen auf der Minikarte + Pfeil zur nächsten Truhe') },
  { id: 'magnet', icon: 'magnet', n: 'Splitter-Magnet', prices: [90, 200], d: (L) => `Sammelradius +${L * 60} %` },
];
export const mod = (id) => state.modules[id] || 0;

/* ------------------------------------------------------------------ */
/* Tagesaufträge                                                       */
/* ------------------------------------------------------------------ */

const QUEST_REWARD = 40;
const BONUS_REWARD = 100;

// make(ctx) → { kind, target, text, game? }; ctx: { games: [{id, name}], boss: bool }
const POOL = [
  { kind: 'rounds', make: () => { const t = pick([8, 10, 12]); return { target: t, text: `Löse ${t} Rätsel` }; } },
  { kind: 'combo', make: () => { const t = pick([4, 5]); return { target: t, text: `Schaffe eine Combo von ${t}` }; } },
  { kind: 'planets', ok: (c) => c.games.length >= 3, make: () => ({ target: 3, text: 'Spiele Missionen auf 3 verschiedenen Planeten' }) },
  { kind: 'gameRounds', make: (c) => { const g = pick(c.games); return { target: 5, game: g.id, text: `Löse 5 Rätsel auf ${g.name}` }; } },
  { kind: 'perfect', make: () => ({ target: 1, text: 'Schaffe eine Mission ganz ohne Fehler' }) },
  { kind: 'shards', make: () => ({ target: 12, text: 'Sammle 12 Sternensplitter im All' }) },
  { kind: 'chests', make: () => ({ target: 2, text: 'Öffne 2 Schatztruhen im All' }) },
  { kind: 'expedition', make: () => ({ target: 1, text: 'Schließe eine Expedition ab' }) },
  { kind: 'boss', ok: (c) => c.boss, make: () => ({ target: 1, text: 'Besiege den Boss-Kern im Blitzrechnen' }) },
  { kind: 'comet', make: () => ({ target: 1, text: 'Fange einen Knobel-Kometen und knacke ihn' }) },
];

/** Creates today's three quests if needed. Returns true if they were just created. */
export function ensureQuests(ctx) {
  if (state.quests.day === today() && state.quests.list.length) return false;
  const kinds = shuffle(POOL.filter((q) => !q.ok || q.ok(ctx))).slice(0, 3);
  state.quests = {
    day: today(),
    bonus: false,
    list: kinds.map((q) => ({ kind: q.kind, ...q.make(ctx), progress: 0, done: false, seen: [] })),
  };
  save();
  return true;
}

export const questsOpen = () => (state.quests.day === today() ? state.quests.list.filter((q) => !q.done).length : 0);

function advanceQuests(ev, data, out) {
  if (state.quests.day !== today()) return;
  for (const q of state.quests.list) {
    if (q.done) continue;
    const before = q.progress;
    if (ev === 'round' && q.kind === 'rounds') q.progress++;
    if (ev === 'round' && q.kind === 'combo') q.progress = Math.max(q.progress, data.combo);
    if (ev === 'round' && q.kind === 'gameRounds' && data.game === q.game) q.progress++;
    if (ev === 'mission' && q.kind === 'planets') {
      for (const g of data.games) if (!q.seen.includes(g)) q.seen.push(g);
      q.progress = q.seen.length;
    }
    if (ev === 'mission' && q.kind === 'perfect' && data.perfect) q.progress++;
    if (ev === 'mission' && q.kind === 'expedition' && data.expedition) q.progress++;
    if ((ev === 'boss' || ev === 'comet') && q.kind === ev) q.progress++;
    if (ev === 'shard' && q.kind === 'shards') q.progress++;
    if (ev === 'chest' && q.kind === 'chests') q.progress++;
    if (q.progress !== before && q.progress >= q.target) {
      q.progress = q.target;
      q.done = true;
      state.crystals += QUEST_REWARD;
      out.push({ icon: 'check', title: 'Auftrag erledigt!', text: q.text, reward: `+${QUEST_REWARD} Kristalle` });
    }
  }
  if (!state.quests.bonus && state.quests.list.every((q) => q.done)) {
    state.quests.bonus = true;
    state.crystals += BONUS_REWARD;
    state.eggs = (state.eggs || 0) + 1;
    inc('questDays');
    out.push({ icon: 'trophy', title: 'Alle Tagesaufträge geschafft!', text: 'Morgen gibt es neue.', reward: `+${BONUS_REWARD} Kristalle · +1 Ei` });
  }
}

/* ------------------------------------------------------------------ */
/* Abzeichen                                                           */
/* ------------------------------------------------------------------ */

const BADGE_REWARD = 25;
const maxLevel = () => Math.max(0, ...Object.values(state.levels));

export const BADGES = [
  { id: 'first', e: '🚀', n: 'Erster Einsatz', d: 'Schließe deine erste Mission ab.', ok: () => stat('missions') >= 1 },
  { id: 'perfect', e: '💯', n: 'Fehlerfrei', d: 'Eine Mission ganz ohne Fehler.', ok: () => stat('perfectMissions') >= 1 },
  { id: 'r100', e: '🧮', n: 'Rechen-Rakete', d: 'Löse 100 Rätsel.', ok: () => stat('rounds') >= 100 },
  { id: 'r500', e: '🌋', n: 'Rechen-Vulkan', d: 'Löse 500 Rätsel.', ok: () => stat('rounds') >= 500 },
  { id: 'combo5', e: '🔥', n: 'Heiße Serie', d: 'Schaffe eine Combo von 5.', ok: () => stat('maxCombo') >= 5 },
  { id: 'combo10', e: '☄️', n: 'Unaufhaltsam', d: 'Schaffe eine Combo von 10.', ok: () => stat('maxCombo') >= 10 },
  { id: 'prime', e: '🪨', n: 'Primzahl-Jäger', d: 'Zerlege 30 Asteroiden.', ok: () => stat('r_asteroid') >= 30 },
  { id: 'binary', e: '🤖', n: 'Robotersprachler', d: 'Löse 30 Binär-Rätsel.', ok: () => stat('r_binary') >= 30 },
  { id: 'algebra', e: '⚖️', n: 'Waagen-Detektiv', d: 'Löse 30 Waagen-Rätsel.', ok: () => stat('r_scale') >= 30 },
  { id: 'boss', e: '⚔️', n: 'Kernbrecher', d: 'Gewinne 3 Bosskämpfe im Blitzrechnen.', ok: () => stat('bossWins') >= 3 },
  { id: 'decode', e: '📩', n: 'Code-Knacker', d: 'Entschlüssle 8 Geheimbotschaften.', ok: () => stat('decoded') >= 8 },
  { id: 'comet', e: '🌠', n: 'Kometenfänger', d: 'Knacke 5 Knobel-Kometen.', ok: () => stat('comets') >= 5 },
  { id: 'chest', e: '🎁', n: 'Schatzsucher', d: 'Öffne 10 Schatztruhen.', ok: () => stat('chests') >= 10 },
  { id: 'shard', e: '✨', n: 'Splitter-Sammler', d: 'Sammle 100 Sternensplitter.', ok: () => stat('shards') >= 100 },
  { id: 'explorer', e: '🌌', n: 'Entdecker', d: 'Schließe 5 Expeditionen ab.', ok: () => stat('expeditions') >= 5 },
  { id: 'shine', e: '🌟', n: 'Strahlemacher', d: 'Bringe einen Planeten zum Strahlen.', ok: () => stat('shining') >= 1 },
  { id: 'finale', e: '🏆', n: 'Retter von Numeria', d: 'Besiege den Bösewicht der ersten Galaxie.', ok: () => state.finales[0] },
  { id: 'genius', e: '🧠', n: 'Genius', d: 'Rette beide Galaxien.', ok: () => state.finales[0] && state.finales[1] },
  { id: 'lvl20', e: '📈', n: 'Überflieger', d: 'Erreiche Stufe 20 auf einem Planeten.', ok: () => maxLevel() >= 20 },
  { id: 'lvl40', e: '🏔️', n: 'Gipfelstürmer', d: 'Erreiche Stufe 40.', ok: () => maxLevel() >= 40 },
  { id: 'quests', e: '📋', n: 'Tagesheld', d: 'Schaffe alle Tagesaufträge eines Tages.', ok: () => stat('questDays') >= 1 },
  { id: 'streak7', e: '📅', n: 'Dranbleiber', d: 'Spiele 7 Tage hintereinander.', ok: () => state.streak >= 7 },
];

function checkBadges(out) {
  for (const b of BADGES) {
    if (state.badges.includes(b.id) || !b.ok()) continue;
    state.badges.push(b.id);
    state.crystals += BADGE_REWARD;
    out.push({ e: b.e, title: 'Neues Abzeichen!', text: b.n, reward: `+${BADGE_REWARD} Kristalle` });
  }
}

/* ------------------------------------------------------------------ */
/* Ereignisse                                                          */
/* ------------------------------------------------------------------ */

/**
 * Record a game event. Returns achievements to announce: [{ e, title, text, reward }].
 * ev: 'round' {game, combo} · 'mission' {games, expedition, perfect} · 'boss' · 'comet' · 'chest' · 'shard'
 *     · 'decoded' · 'shine' · 'check' (re-evaluate badges only)
 */
export function track(ev, data = {}) {
  const out = [];
  if (ev === 'round') {
    inc('rounds');
    inc('r_' + data.game);
    state.stats.maxCombo = Math.max(stat('maxCombo'), data.combo || 0);
  }
  if (ev === 'mission') {
    inc('missions');
    if (data.perfect) inc('perfectMissions');
    if (data.expedition) inc('expeditions');
  }
  if (ev === 'boss') inc('bossWins');
  if (ev === 'comet') inc('comets');
  if (ev === 'chest') inc('chests');
  if (ev === 'shard') inc('shards');
  if (ev === 'decoded') inc('decoded');
  if (ev === 'shine') inc('shining');
  advanceQuests(ev, data, out);
  checkBadges(out);
  save();
  return out;
}
