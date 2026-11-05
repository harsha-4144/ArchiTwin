// materials.mjs - material cards, property bars and a live same-beam demo. Numbers come from calc.mjs (MATERIALS, compareBeam).
import { MATERIALS, compareBeam } from '../calc.mjs';
import { $, el, fmt, inr } from './util.mjs';
import { statusChip } from './icons.mjs';
import { initReveal } from './reveal.mjs';

const KEYS = Object.keys(MATERIALS);
const PROPS = [
  ['eGPa', "Stiffness (Young's modulus E)", v => v + ' GPa', 'How hard it is to bend. Higher means the beam sags less under the same load.'],
  ['density', 'Density', v => v.toLocaleString('en-IN') + ' kg/m3', 'How heavy a cubic metre is. Heavier beams carry their own weight as extra load.'],
  ['conductivity', 'Thermal conductivity', v => v + ' W/mK', 'How easily heat passes through. Low means it insulates; high means it conducts heat and cold.'],
  ['costPerM3', 'Cost per m3', inr, 'A rough price for one cubic metre. A teaching figure, not a quote.'],
  ['durability', 'Durability', v => v, 'How well it lasts with weather and time. A qualitative assumption here.'],
];
const SWATCH = { timber: 'Timber grain lines', steel: 'Steel cross-hatch', concrete: 'Concrete hatching' };

$('#mat-cards').replaceChildren(...KEYS.map((k, i) => {
  const m = MATERIALS[k];
  return el('article', { class: 'card mat-card' },
    el('div', { class: 'swatch sw-' + k, role: 'img', 'aria-label': SWATCH[k] }),
    el('h3', { text: m.name }),
    el('dl', { class: 'kvl' }, ...PROPS.flatMap(([key, label, f]) => [el('dt', { text: label.replace(/ \(.*\)/, '') }), el('dd', { text: f(m[key]) })])));
}));

$('#meaning').replaceChildren(...PROPS.flatMap(([, label, , text]) => [el('dt', { text: label }), el('dd', { text })]));

// bars: width is a display ratio of the largest value in the group
const BARS = [['density', 'Weight (density)', v => v.toLocaleString('en-IN') + ' kg/m3', 'Lower is lighter.'],
  ['costPerM3', 'Cost per m3', inr, 'Lower is cheaper.'],
  ['eGPa', 'Stiffness (E)', v => v + ' GPa', 'Higher bends less.'],
  ['conductivity', 'Thermal conductivity', v => v + ' W/mK', 'Lower insulates better.']];
$('#bars').replaceChildren(...BARS.map(([key, title, f, note]) => {
  const max = Math.max(...KEYS.map(k => MATERIALS[k][key]));
  return el('section', { class: 'card barcard', 'aria-label': title }, el('h3', { text: title }), el('p', { class: 'stat-note', text: note }),
    ...KEYS.map(k => {
      const v = MATERIALS[k][key], w = Math.max(1, v / max * 100);
      const bar = el('span', { class: 'bar-track', 'aria-hidden': 'true' }, el('span', { class: 'bar-fill sw-' + k, style: `width:${w.toFixed(2)}%` }));
      return el('div', { class: 'barrow' }, el('span', { class: 'bl', text: MATERIALS[k].name }), bar, el('span', { class: 'bv num', text: f(v) }));
    }));
}));

// live demo
const val = id => Number($('#' + id).value);
function demo() {
  const span = val('d-span'), b = val('d-b'), h = val('d-h'), load = val('d-load'), type = $('#d-type').value;
  $('#o-span').textContent = span + ' m'; $('#o-b').textContent = b + ' m'; $('#o-h').textContent = h + ' m'; $('#o-load').textContent = load + ' kN/m';
  const r = compareBeam({ span, b, h, load, type });
  const rows = KEYS.map(k => {
    const x = r[k], pct = Math.min(150, x.ratio * 100);
    return el('tr', {}, el('th', { scope: 'row', text: MATERIALS[k].name }), el('td', { class: 'num', text: fmt(x.deflectionMm) + ' mm' }), el('td', { class: 'num', text: fmt(x.limitMm) + ' mm' }),
      el('td', { class: 'num' }, el('span', { class: 'share' }, el('span', { class: 'bar-track', 'aria-hidden': 'true' }, el('span', { class: 'bar-fill ' + (x.pass ? 'ok' : 'bad'), style: `width:${(pct / 1.5).toFixed(1)}%` }), el('span', { class: 'mark' })), el('span', { text: fmt(x.ratio * 100, 0) + '%' }))),
      el('td', {}, statusChip(x.pass ? 'pass' : 'fail')));
  });
  const passN = KEYS.filter(k => r[k].pass).length;
  $('#demo-out').replaceChildren(
    el('div', { class: 'tablewrap', tabindex: '0', role: 'region', 'aria-label': 'Beam results by material' }, el('table', { class: 'data on-paper' },
      el('caption', { text: `Same ${span} m ${type === 'simply' ? 'simply supported beam' : 'cantilever'}, ${b} by ${h} m, ${load} kN/m` }),
      el('thead', {}, el('tr', {}, ...['Material', 'Sag', 'Allowed (span/250)', 'Share of limit', 'Result'].map((t, i) => el('th', { scope: 'col', class: i > 0 && i < 4 ? 'num' : '', text: t })))),
      el('tbody', {}, ...rows))),
    el('p', { class: 'demo-sum', text: passN === 3 ? 'All three materials pass this beam.' : passN === 0 ? 'No material passes. Try a deeper beam or a shorter span.' : `${passN} of 3 materials pass. Where it fails, a deeper beam or a stiffer material helps.` }));
}
$('#demo-form').addEventListener('input', demo);
demo();
initReveal();
