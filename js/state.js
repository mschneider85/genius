const KEY = 'genius-v1';
export const MAX_LEVEL = 40;

const DEFAULT = {
  v: 1,
  name: '',
  avatar: '🧑‍🚀',
  grade: 2,
  crystals: 0,
  stars: 0,
  missions: 0,
  levels: {},
  creatures: [],
  eggs: 0,
  galaxy: 0,
  maxGalaxy: 0,
  seen: [],
  restore: {},
  decoded: {},
  finales: [false, false],
  goldStars: 0,
  cometLevel: null,
  cometReady: false,
  cometDay: null,
  cometIntro: false,
  music: true,
  perf: 'auto',
  perfAuto: null,
  flightTutorial: false,
  ships: ['🚀'],
  ship: '🚀',
  themes: ['nebula'],
  theme: 'nebula',
  sound: true,
  streak: 0,
  lastDay: null,
  stats: {},
  badges: [],
  quests: { day: null, list: [], bonus: false },
  modules: {},
  world: { day: null, taken: [] },
};

// JSON copy instead of structuredClone (only available from iPadOS 15.4).
const fresh = () => JSON.parse(JSON.stringify(DEFAULT));

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && s.v === 1) return { ...fresh(), ...s };
  } catch { /* corrupted storage → fresh start */ }
  return fresh();
}

export let state = load();

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode */ }
}

export function resetState() {
  localStorage.removeItem(KEY);
  state = fresh();
}

export const level = (id) => state.levels[id] ?? 1;

export function setLevel(id, L) {
  state.levels[id] = Math.max(1, Math.min(MAX_LEVEL, Math.round(L)));
  save();
}
