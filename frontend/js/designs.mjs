// designs.mjs - starting designs, saved designs (API) and a two-way comparison. Display only: numbers come from calc.mjs.
import { PRESETS, presetOf } from '../presets.mjs';
import { diffSummaries } from '../calc.mjs';
import { $, el, fmt, inr, analyse, fetchDesigns, ROOFS, MATNAMES } from './util.mjs';
import { statusChip } from './icons.mjs';
import { getThumb } from './thumbs.mjs';

const bays = p => `${p.bays_x} by ${p.bays_z}`;
const facts = p => [['Floors', String(p.floors)], ['Bays', bays(p)], ['Roof', ROOFS[p.roof_type] || p.roof_type], ['Material', MATNAMES[p.material] || p.material]];
const dl = rows => el('dl', { class: 'kvl' }, ...rows.flatMap(([k, v]) => [el('dt', { text: k }), el('dd', { text: v })]));

// 1. presets: gallery with runtime 3D thumbnails, pass/fail summary (calc.mjs) and filters
const PRESET_INFO = PRESETS.map(p => ({ p, r: analyse(p.params) }));
const FILTERS = { floors: [['1', '1 floor'], ['2', '2 floors']], roof: Object.entries(ROOFS), material: Object.entries(MATNAMES) };
const valueOf = (p, g) => String(g === 'floors' ? p.params.floors : g === 'roof' ? p.params.roof_type : p.params.material);
const chosen = {};   // group -> Set of ticked values
for (const g of Object.keys(FILTERS)) {
  chosen[g] = new Set();
  $('#f-' + g).replaceChildren(...FILTERS[g].map(([v, t]) => {
    const input = el('input', { type: 'checkbox', value: v, id: `f-${g}-${v}` });
    input.addEventListener('change', () => { input.checked ? chosen[g].add(v) : chosen[g].delete(v); applyFilters(); });
    return el('label', { for: input.id }, input, document.createTextNode(t));
  }));
}
const cardFor = ({ p, r }) => {
  const s = r.summary, n = s.passCount + s.failCount;
  const img = el('img', { class: 'thumb', width: '480', height: '320', alt: `${p.name}: 3D view of the house`, src: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 3 2%22%3E%3C/svg%3E' });
  getThumb({ id: p.id, params: p.params, palette: p.palette, features: p.features }).then(u => { img.src = u; });
  const res = s.failCount ? statusChip('fail', `${s.failCount} of ${n} beams fail`) : statusChip('pass', `All ${n} beams pass`);
  const chips = el('ul', { class: 'chips', 'aria-label': 'Key facts' }, ...[`${p.params.floors} floor${p.params.floors > 1 ? 's' : ''}`, `${bays(p.params)} bays`, ROOFS[p.params.roof_type] + ' roof', MATNAMES[p.params.material]].map(t => el('li', { text: t })));
  const card = el('article', { class: 'card dcard', 'data-id': p.id }, img, ...(p.demo ? [el('span', { class: 'demo-chip', text: 'Demo' })] : []), el('h3', { text: p.name }), el('p', { class: 'muted', text: p.tagline }), chips,
    el('p', { class: 'res' }, res), el('a', { class: 'btn btn-secondary', href: '/studio?preset=' + p.id, text: 'Open in studio', 'aria-label': 'Open ' + p.name + ' in studio' }));
  return card;
};
const cards = new Map(PRESET_INFO.map(i => [i.p.id, cardFor(i)]));
$('#presets').replaceChildren(...cards.values());
function applyFilters() {
  let shown = 0;
  for (const { p } of PRESET_INFO) {
    const ok = Object.keys(FILTERS).every(g => !chosen[g].size || chosen[g].has(valueOf(p, g)));
    cards.get(p.id).hidden = !ok; if (ok) shown++;
  }
  $('#f-count').textContent = `Showing ${shown} of ${PRESETS.length} starting designs`;
  $('#f-empty').hidden = shown > 0;
}
function resetFilters() { document.querySelectorAll('#filters input').forEach(i => { i.checked = false; }); for (const g of Object.keys(chosen)) chosen[g].clear(); applyFilters(); }
$('#f-reset').addEventListener('click', resetFilters); $('#f-empty-reset').addEventListener('click', resetFilters);
applyFilters();

// 2. saved
let saved = [];
function renderSaved() {
  const box = $('#saved');
  if (!saved.length) { box.replaceChildren(el('p', { class: 'muted', text: 'You have not saved a design yet. Open the studio, change something, then use Save design.' }), el('a', { class: 'btn btn-secondary', href: '/studio', text: 'Open the studio' })); return; }
  box.replaceChildren(el('div', { class: 'gallery' }, ...saved.map(d => {
    const s = d.summary || {}, n = (s.passCount ?? 0) + (s.failCount ?? 0);
    const img = el('img', { class: 'thumb', width: '480', height: '320', alt: `${d.name}: 3D view`, src: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 3 2%22%3E%3C/svg%3E' });
    const pr = presetOf(d.params);
    getThumb({ id: 'saved-' + d.id, params: d.params, palette: pr && pr.palette, features: pr && pr.features }).then(u => { img.src = u; });
    const card = el('article', { class: 'card dcard' }, img, el('h3', { text: d.name }), dl(facts(d.params)));
    if (n) card.append(el('p', { class: 'num', text: `${s.passCount} of ${n} beams pass` }));
    card.append(el('a', { class: 'btn btn-secondary', href: '/studio?design=' + d.id, text: 'Open in studio', 'aria-label': 'Open ' + d.name + ' in studio' }));
    return card;
  })));
}

// 3. compare
const options = () => [['', 'Choose a design'], ...PRESETS.map(p => ['preset:' + p.id, p.name + ' (starting)']), ...saved.map(d => ['design:' + d.id, d.name + ' (saved #' + d.id + ')'])];
function fillPicks() {
  for (const id of ['pickA', 'pickB']) {
    const s = $('#' + id), keep = s.value;
    s.replaceChildren(...options().map(([v, t]) => el('option', { value: v, text: t })));
    s.value = options().some(o => o[0] === keep) ? keep : '';
  }
}
const lookup = key => {
  const [kind, id] = key.split(':');
  if (kind === 'preset') { const p = PRESETS.find(x => x.id === id); return p && { name: p.name, params: p.params, features: p.features }; }
  const d = saved.find(x => String(x.id) === id); return d && { name: d.name, params: d.params, features: (presetOf(d.params) || {}).features };
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
    body.append(el('tr', a === b ? {} : { class: 'differs-row' }, el('th', { scope: 'row', text: label }), el('td', { class: 'num', text: a }), el('td', { class: 'num', text: b }), el('td', { text: a === b ? 'same' : 'differs' })));
  }
  const fa = (A.features || []).join(', ') || 'none', fb = (B.features || []).join(', ') || 'none';
  body.append(el('tr', fa === fb ? {} : { class: 'differs-row' }, el('th', { scope: 'row', text: 'Decorative features' }), el('td', { class: 'num', text: fa }), el('td', { class: 'num', text: fb }), el('td', { text: fa === fb ? 'same' : 'differs' })));
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
