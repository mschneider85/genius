// Leistungsmodus für ältere iPads.
// state.perf: 'auto' (Standard) | 'low' (Sparmodus) | 'high' (volle Grafik)
// Im Auto-Modus schaltet das Spiel dauerhaft in den Sparmodus, sobald es ruckeln misst.
import { state, save } from './state.js';

const slowHardware = (navigator.hardwareConcurrency || 4) <= 2;

export const lowPower = () => state.perf === 'low' || (state.perf !== 'high' && (state.perfAuto === 'low' || slowHardware));

export function applyPerf() {
  document.body.classList.toggle('low-power', lowPower());
}

/** Called when the game measured sustained low frame rates. */
export function reportSlow() {
  if (state.perfAuto === 'low') return;
  state.perfAuto = 'low';
  save();
  applyPerf();
}
