// designs.mjs - starting designs, saved designs (API) and a two-way comparison. Display only: numbers come from calc.mjs.
import { PRESETS } from '../presets.mjs';
import { diffSummaries } from '../calc.mjs';
import { $, el, fmt, inr, analyse, fetchDesigns, ROOFS, MATNAMES } from './util.mjs';
import { statusChip } from './icons.mjs';

const bays = p => `${p.bays_x} by ${p.bays_z}`;
const facts = p => [['Floors', String(p.floors)], ['Bays', bays(p)], ['Roof', ROOFS[p.roof_type] || p.roof_type], ['Material', MATNAMES[p.material] || p.material]];
const dl = rows => el('dl', { class: 'kvl' }, ...rows.flatMap(([k, v]) => [el('dt', { text: k }), el('dd', { text: v })]));

// 1. presets
$('#presets').replaceChildren(...PRESETS.map(p => el('article', { class: 'card' },
  el('h3', { text: p.name.replace(' (demo)', '') }), el('p', { class: 'muted', text: p.blurb }), dl(facts(p.params)),
  el('a', { class: 'btn btn-secondary', href: '/studio?preset=' + p.id, text: 'Open in studio', 'aria-label': 'Open ' + p.name + ' in studio' }))));

// 2. saved
let saved = [];
function renderSaved() {
  const box = $('#saved');
  if (!saved.length) { box.replaceChildren(el('p', { class: 'muted', text: 'You have not saved a design yet. Open the studio, change something, then use Save design.' }), el('a', { class: 'btn btn-secondary', href: '/studio', text: 'Open the studio' })); return; }
  box.replaceChildren(el('div', { class: 'grid cols-4' }, ...saved.map(d => {
    const s = d.summary || {}, n = (s.passCount ?? 0) + (s.failCount ?? 0);
    const card = el('article', { class: 'card' }, el('h3', { text: d.name }), dl(facts(d.params)));
    if (n) card.append(el('p', { class: 'num', text: `${s.passCount} of ${n} beams pass` }));
    card.append(el('a', { class: 'btn btn-secondary', href: '/studio?design=' + d.id, text: 'Open in studio', 'aria-label': 'Open ' + d.name + ' in studio' }));
    return card;
  })));
}

// 3. compare
const options = () => [['', 'Choose a design'], ...PRESETS.map(p => ['preset:' + p.id, p.name.replace(' (demo)', '') + ' (starting)']), ...saved.map(d => ['design:' + d.id, d.name + ' (saved #' + d.id + ')'])];
function fillPicks() {
  for (const id of ['pickA', 'pickB']) {
    const s = $('#' + id), keep = s.value;
    s.replaceChildren(...options().map(([v, t]) => el('option', { value: v, text: t })));
    s.value = options().some(o => o[0] === keep) ? keep : '';
  }
}
const lookup = key => {
  const [kind, id] = key.split(':');
  if (kind === 'preset') { const p = PRESETS.find(x => x.id === id); return p && { name: p.name.replace(' (demo)', ''), params: p.params }; }
  const d = saved.find(x => String(x.id) === id); return d && { name: d.name, params: d.params };
};
const fval = {
  worstDeflectionMm: v => fmt(v) + ' mm', passCount: v => String(v), failCount: v => String(v),
  totalWeightKg: v => fmt(v, 0) + ' kg', totalCost: inr, daylight: v => fmt(v),
};
const PARAM_ROWS = [['Floors', p => String(p.floors)], ['Bays (x by z)', bays], ['Bay span x', p => fmt(p.span_x, 1) + ' m'], ['Bay span z', p => fmt(p.span_z, 1) + ' m'],
  ['Roof', p => ROOFS[p.roof_type] || p.roof_type], ['Material', p => MATNAMES[p.material] || p.material],
  ['Beam section b by h', p => `${p.beam_b} by ${p.beam_h} m`], ['Applied load', p => p.load + ' kN/m']];

function renderCompare(save = false) {
  const box = $('#cmp'), ka = $('#pickA').value, kb = $('#pickB').value;
  if (save) { const u = new URL(location.href); u.search = ''; if (ka) u.searchParams.set('a', ka); if (kb) u.searchParams.set('b', kb); history.replaceState(null, '', u); }
  const A = ka && lookup(ka), B = kb && lookup(kb);
  if (!A || !B) { box.replaceChildren(el('p', { class: 'muted', text: 'Choose two designs to see them side by side.' })); return; }
  let ra, rb;
  try { ra = analyse(A.params); rb = analyse(B.params); }
  catch (e) { box.replaceChildren(el('p', { class: 'status fail', text: 'Cannot compare: ' + e.message })); return; }
  const head = el('tr', {}, el('th', { scope: 'col', text: 'Measure' }), el('th', { scope: 'col', class: 'num', text: A.name }), el('th', { scope: 'col', class: 'num', text: B.name }), el('th', { scope: 'col', text: 'Difference' }));
  const body = el('tbody');
  const sect = t => body.append(el('tr', {}, el('th', { scope: 'rowgroup', colspan: 4, class: 'subhead', text: t })));
  sect('Design');
  for (const [label, f] of PARAM_ROWS) {
    const a = f(ra.building.params), b = f(rb.building.params);
    body.append(el('tr', {}, el('th', { scope: 'row', text: label }), el('td', { class: 'num', text: a }), el('td', { class: 'num', text: b }), el('td', { text: a === b ? 'same' : 'differs' })));
  }
  sect('Results');
  const res = r => r.summary.failCount ? statusChip('fail', `Fail: ${r.summary.failCount} beam${r.summary.failCount > 1 ? 's' : ''}`) : statusChip('pass', 'Pass: all beams');
  body.append(el('tr', {}, el('th', { scope: 'row', text: 'Sag check' }), el('td', { class: 'num' }, res(ra)), el('td', { class: 'num' }, res(rb)), el('td', { text: ra.summary.failCount === rb.summary.failCount ? 'same' : 'differs' })));
  for (const r of diffSummaries(ra.summary, rb.summary)) {
    if (r.key === 'failCount') continue;
    const f = fval[r.key];
    body.append(el('tr', {}, el('th', { scope: 'row', text: r.label.replace(/ \(.*\)/, '') }), el('td', { class: 'num', text: f(r.from) }), el('td', { class: 'num', text: f(r.to) }), el('td', { text: r.word === 'same' ? 'same' : `B is ${r.word}` })));
  }
  const t = el('table', { class: 'data cmp-table' }, el('caption', { text: `${A.name} compared with ${B.name}` }), el('thead', {}, head), body);
  box.replaceChildren(el('div', { class: 'tablewrap', tabindex: '0', role: 'region', 'aria-label': 'Comparison table' }, t),
    el('p', { class: 'stat-note', text: 'Sag check uses the span/250 limit on every beam. Values are rounded teaching numbers.' }));
}
$('#pickA').addEventListener('change', () => renderCompare(true)); $('#pickB').addEventListener('change', () => renderCompare(true));

fillPicks();
const q = new URLSearchParams(location.search);
const restore = () => { if (q.get('a')) $('#pickA').value = q.get('a'); if (q.get('b')) $('#pickB').value = q.get('b'); renderCompare(); };
restore();

try { saved = await fetchDesigns(); renderSaved(); fillPicks(); restore(); }
catch (e) { $('#saved').replaceChildren(el('p', { class: 'status fail', role: 'alert', text: 'Could not load saved designs: ' + e.message }), el('p', { class: 'muted', text: 'Starting designs still work. Check that ArchiTwin is running, then reload the page.' })); }
