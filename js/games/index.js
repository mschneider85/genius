import pyramid from './pyramid.js';
import sequence from './sequence.js';
import asteroid from './asteroid.js';
import scale from './scale.js';
import binary from './binary.js';
import magic from './magic.js';
import fraction from './fraction.js';
import builder from './builder.js';
import duel from './duel.js';

/**
 * Game contract:
 *  { id, name, topic, emoji, hue, unlock (stars needed), rounds, intro, hint,
 *    create(stage, level, api) → optional { destroy(), hint } }
 *  api: keypad(onKey) → element, setKeys(fn), wrong(msg?), solved({msg?, stars?}), failed(), sfx, toast, ship
 */
export const GAME_LIST = [pyramid, sequence, asteroid, scale, binary, magic, fraction, builder, duel];
export const GAMES = Object.fromEntries(GAME_LIST.map((g) => [g.id, g]));
