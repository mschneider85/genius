import { h } from './util.js';
import { sfx } from './audio.js';
import { shake } from './fx.js';

let keyHandler = null;
export function setKeyHandler(fn) { keyHandler = fn; }
export const getKeyHandler = () => keyHandler;

document.addEventListener('keydown', (e) => {
  if (!keyHandler || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.target.matches?.('input, textarea')) return;
  let k = null;
  if (/^[0-9]$/.test(e.key)) k = e.key;
  else if (e.key === 'Backspace' || e.key === 'Delete') k = 'back';
  else if (e.key === 'Enter') k = 'ok';
  if (k) {
    e.preventDefault(); // also suppresses Enter-activation of a focused button
    keyHandler(k);
  }
});

const KEYS = ['7', '8', '9', '4', '5', '6', '1', '2', '3', 'back', '0', 'ok'];

export function keypad(onKey) {
  return h('div', { class: 'keypad' }, KEYS.map((k) => h('button', {
    type: 'button',
    class: 'key k-' + k,
    'aria-label': k === 'back' ? 'Löschen' : k === 'ok' ? 'Prüfen' : k,
    onClick: () => { sfx.click(); onKey(k); },
  }, k === 'back' ? '⌫' : k === 'ok' ? '✓' : k)));
}

/**
 * Number entry for one or more answer fields sharing one keypad.
 * fields: [{ el, answer, wrongMsg?(value) }]; the first unsolved field is active.
 * Returns the keypad element.
 */
export function fieldInput(api, fields, { maxLen = 5, onDone } = {}) {
  let active = null;
  const show = (f) => {
    f.el.textContent = f.val === '' ? '?' : f.val;
    f.el.classList.toggle('empty', f.val === '');
  };
  const select = (f) => {
    if (!f || f.done) return;
    active?.el.classList.remove('active');
    active = f;
    f.el.classList.add('active');
  };
  for (const f of fields) {
    f.val = '';
    f.done = false;
    f.el.classList.add('field');
    show(f);
    f.el.addEventListener('click', () => { sfx.click(); select(f); });
  }
  select(fields[0]);

  return api.keypad((k) => {
    const f = active;
    if (!f) return;
    if (k === 'back') f.val = f.val.slice(0, -1);
    else if (k === 'ok') {
      if (f.val === '') return;
      const v = Number(f.val);
      if (v === f.answer) {
        f.done = true;
        f.el.classList.remove('active', 'bad');
        f.el.classList.add('good');
        active = null;
        f.onSolved?.();
        const next = fields.find((x) => !x.done);
        if (next) { sfx.tick(); select(next); } else onDone?.();
      } else {
        shake(f.el);
        f.el.classList.add('bad');
        setTimeout(() => f.el.classList.remove('bad'), 500);
        api.wrong(f.wrongMsg?.(v));
        f.val = '';
      }
    } else if (f.val.length < maxLen) f.val = (f.val === '0' ? '' : f.val) + k;
    show(f);
  });
}

export function modal(kids, { onClose, closable = true } = {}) {
  const close = () => {
    ov.remove();
    document.removeEventListener('keydown', esc);
    onClose?.();
  };
  const esc = (e) => { if (e.key === 'Escape' && closable) close(); };
  const ov = h('div', { class: 'overlay', onClick: (e) => { if (e.target === ov && closable) close(); } },
    h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true' },
      closable ? h('button', { class: 'icon modal-x', type: 'button', 'aria-label': 'Schließen', onClick: close }, '✖') : null,
      kids));
  document.body.append(ov);
  document.addEventListener('keydown', esc);
  return close;
}

export const frac = (a, b) => h('span', { class: 'frac' }, h('span', {}, a), h('span', {}, b));
