// app.js - UI wiring and display formatting only. All numbers come from calc.mjs / building.mjs.
import { generateBuilding, DEFAULT_PARAMS, SIDES } from './building.mjs';
import { MATERIALS, checkAll, componentWeightCost } from './calc.mjs';
import { createViewer, MAT_COLOURS } from './viewer.mjs';

const $ = id => document.getElementById(id);
const params = JSON.parse(JSON.stringify(DEFAULT_PARAMS));
let layer = 'architecture', cmap = false, building = null, check = null, selected = null;

const fmt = (v, d = 2) => Number(v).toLocaleString('en-IN', { maximumFractionDigits: d, minimumFractionDigits: d });
const inr = v => '₹' + Math.round(v).toLocaleString('en-IN');
const hex = n => '#' + n.toString(16).padStart(6, '0');
const el = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) k === 'text' ? e.textContent = v : e.setAttribute(k, v);
  kids.forEach(k => e.append(k)); return e;
};

// ---------- controls ----------
const refreshers = [];
function group(title, ...kids) { const f = el('fieldset', {}, el('legend', { text: title })); kids.forEach(k => f.append(k)); $('controls').append(f); }
function slider(label, key, min, max, step, unit = '', get = () => params[key], set = v => params[key] = v) {
  const out = el('output'), inp = el('input', { type: 'range', min, max, step, 'aria-label': label });
  const show = () => { inp.value = get(); out.textContent = get() + unit; };
  inp.addEventListener('input', () => { set(Number(inp.value)); show(); update(); });
  refreshers.push(show); show();
  return el('div', { class: 'row' }, el('label', { text: label }), out, inp);
}
function select(label, key, options) {
  const s = el('select', { 'aria-label': label });
  for (const [v, t] of options) s.append(el('option', { value: v, text: t }));
  s.value = params[key];
  s.addEventListener('change', () => { params[key] = s.value; update(); });
  return el('div', { class: 'row' }, el('label', { text: label }), s);
}
function checkbox(label, get, set) {
  const c = el('input', { type: 'checkbox' }); c.checked = get();
  c.addEventListener('change', () => { set(c.checked); update(); });
  refreshers.push(() => { c.checked = get(); });
  return { box: el('label', { class: 'chk' }, c, document.createTextNode(label)), input: c };
}
function sideTable(title, key, max) {
  const t = el('div', { class: 'sides' });
  t.append(el('span', { class: 'h', text: title }), el('span', { class: 'h', text: '' }), el('span', { class: 'h', text: '' }));
  SIDES.forEach(s => {
    const i = el('input', { type: 'number', min: 0, max, step: 1, 'aria-label': `${title} ${s}` });
    i.value = params[key][s];
    i.addEventListener('change', () => { params[key][s] = Number(i.value); update(); });
    t.append(el('span', { text: s[0].toUpperCase() + s.slice(1) }), i, el('span'));
  });
  return t;
}

group('Building', slider('Floors', 'floors', 1, 2, 1), slider('Bays in x', 'bays_x', 1, 3, 1), slider('Bays in z', 'bays_z', 1, 3, 1),
  slider('Bay span x', 'span_x', 2, 8, 0.5, ' m'), slider('Bay span z', 'span_z', 2, 8, 0.5, ' m'), slider('Floor height', 'floor_height', 2.5, 4, 0.1, ' m'));
group('Roof', select('Roof type', 'roof_type', [['flat', 'Flat'], ['shed', 'Shed'], ['gable', 'Gable']]), slider('Roof pitch', 'roof_pitch', 0, 45, 1, '°'));
const f1 = checkbox('Floor 1', () => params.floor_visible[0], v => params.floor_visible[0] = v);
const f2 = checkbox('Floor 2', () => params.floor_visible[1], v => params.floor_visible[1] = v);
group('Show parts', el('div', { class: 'tg' },
  checkbox('Walls', () => params.walls, v => params.walls = v).box, checkbox('Roof', () => params.roof, v => params.roof = v).box, f1.box, f2.box));
group('Doors per side', sideTable('Doors', 'doors', 4));
group('Windows per side', sideTable('Windows', 'windows', 8),
  slider('Window width', 'window_w', 0.3, 4, 0.1, ' m'), slider('Window height', 'window_h', 0.3, 3.7, 0.1, ' m'));
group('Structure', select('Material', 'material', Object.entries(MATERIALS).map(([k, m]) => [k, m.name])),
  select('Beam type', 'beam_type', [['simply_supported', 'Simply supported'], ['cantilever', 'Cantilever']]),
  slider('Beam width b', 'beam_b', 0.1, 0.6, 0.05, ' m'), slider('Beam depth h', 'beam_h', 0.15, 0.9, 0.05, ' m'));
group('Loads', slider('Applied load', 'load', 0, 50, 1, ' kN/m'));

// ---------- layers ----------
const seg = $('layers');
for (const [k, t] of [['structure', 'Structure'], ['architecture', 'Architecture'], ['materials', 'Materials']]) {
  const b = el('button', { type: 'button', role: 'radio', 'data-layer': k, text: t });
  b.addEventListener('click', () => { layer = k; render(); });
  seg.append(b);
}
$('cmap').addEventListener('change', e => { cmap = e.target.checked; render(); });
$('reset').addEventListener('click', () => viewer.resetView());

// ---------- model ----------
const viewer = createViewer($('view'), c => { selected = c; showDetails(); });

function update() {
  f2.input.disabled = params.floors < 2;
  try {
    building = generateBuilding(params);
    check = checkAll(building.components, { load: params.load, beamType: building.components.find(c => c.type === 'beam')?.beamType, material: params.material });
    $('err').textContent = '';
  } catch (e) {
    $('err').textContent = 'Not applied: ' + e.message;
    return;
  }
  if (selected && !building.components.some(c => c.id === selected.id)) selected = null;
  else if (selected) selected = building.components.find(c => c.id === selected.id);
  render(); showResults(); showDetails();
}

function render() {
  [...seg.children].forEach(b => b.setAttribute('aria-checked', String(b.dataset.layer === layer)));
  const ratios = cmap ? Object.fromEntries(check.beams.map(r => [r.id, r.ratio])) : null;
  viewer.setModel(building, { layer, ratios });
  $('legend').hidden = !cmap;
  const ml = $('matlegend'); ml.hidden = layer !== 'materials'; ml.replaceChildren();
  for (const [k, m] of Object.entries(MATERIALS)) ml.append(el('span', {}, el('i', { style: `background:${hex(MAT_COLOURS[k])}` }), document.createTextNode(m.name)));
  if (selected) viewer.select(selected.id);
}

function kv(rows) {
  const d = el('dl', { class: 'kv' });
  for (const [k, v, cls] of rows) { d.append(el('dt', { text: k }), el('dd', { text: v, class: cls || '' })); }
  return d;
}

function showResults() {
  const w = check.beams.find(b => b.id === check.worstId);
  const t = building.totals;
  $('resbody').replaceChildren(kv([
    ['Beams passing', `${check.passCount} of ${check.beams.length}`, 'pass'],
    ['Beams failing', String(check.failCount), check.failCount ? 'fail' : ''],
    ['Worst deflection', `${fmt(check.worstDeflectionMm)} mm` + (w ? ` (limit ${fmt(w.limitMm)} mm)` : ''), w && !w.pass ? 'fail' : ''],
    ['Worst beam', w ? `${w.id}: ${w.pass ? 'PASS' : 'FAIL'}` : 'none', w && !w.pass ? 'fail' : ''],
    ['Total weight', `${fmt(t.weightKN, 1)} kN (${fmt(t.weightKg, 0)} kg)`],
    ['Estimated cost', inr(t.cost)],
  ]));
}

function sizeText(c) {
  const mm = v => fmt(v * 1000, 0);
  if (c.type === 'slab' || c.type === 'roof') return `${fmt(c.area)} m² × ${mm(c.thickness)} mm thick`;
  if (c.type === 'wall') return `${fmt(c.length)} m long × ${fmt(c.height)} m high × ${mm(c.thickness)} mm (net area ${fmt(c.area)} m²)`;
  return `${mm(c.width)} × ${mm(c.height)} mm section × ${fmt(c.length)} m`;
}

function showDetails() {
  const box = $('detbody');
  if (!selected) { box.replaceChildren(el('p', { class: 'muted', text: 'Click any part of the building.' })); return; }
  const c = selected, r = componentWeightCost(c, params.material);
  const rows = [['Type', c.type + (c.type === 'wall' && c.side ? ` (${c.side})` : '')], ['ID', c.id], ['Size', sizeText(c)],
    ['Material', MATERIALS[r.material].name + (c.type === 'slab' ? ' (slabs are always concrete)' : '')],
    ['Volume', `${fmt(r.volume, 4)} m³`], ['Weight', `${fmt(r.weightKN)} kN (${fmt(r.weightKg, 1)} kg)`], ['Cost', inr(r.cost)]];
  if (c.type === 'beam') {
    const b = check.beams.find(x => x.id === c.id);
    rows.push(['Deflection', `${fmt(b.deflectionMm)} mm (limit ${fmt(b.limitMm)} mm)`], ['Share of limit', `${fmt(b.ratio * 100, 0)}%`], ['Result', b.pass ? 'PASS' : 'FAIL', b.pass ? 'pass' : 'fail']);
  }
  box.replaceChildren(kv(rows));
}

window.__adt = { viewer, params, get building() { return building; }, get check() { return check; } };
update();
