// app.js - UI wiring and display formatting only. All numbers come from calc.mjs / building.mjs.
import { generateBuilding, validateParams, DEFAULT_PARAMS, SIDES } from './building.mjs';
import { MATERIALS, summarize, diffSummaries, diffParams, diffComponents, checkAll, componentWeightCost, beamDeflection, totalsByType, compareMaterials, compareBeam, TYPE_GROUPS, DURABILITY_ASSUMED } from './calc.mjs';
import { createViewer, MAT_COLOURS } from './viewer.mjs';

const $ = id => document.getElementById(id);
const params = JSON.parse(JSON.stringify(DEFAULT_PARAMS));
let layer = 'architecture', cmap = false, building = null, check = null, selected = null;
let checkedAll = false, analysed = false, anType = null;

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
  refreshers.push(() => { s.value = params[key]; });
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
  SIDES.forEach(s => {
    const i = el('input', { type: 'number', min: 0, max, step: 1, 'aria-label': `${title} ${s}` });
    i.value = params[key][s]; refreshers.push(() => { i.value = params[key][s]; });
    i.addEventListener('change', () => { params[key][s] = Number(i.value); update(); });
    t.append(el('span', { text: s[0].toUpperCase() + s.slice(1) }), i);
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
const segs = [...document.querySelectorAll('#layers, .layerseg')];
for (const seg of segs) for (const [k, t] of [['structure', 'Structure'], ['architecture', 'Architecture'], ['materials', 'Materials']]) {
  const b = el('button', { type: 'button', role: 'radio', 'data-layer': k, text: t });
  b.addEventListener('click', () => { layer = k; render(); });
  seg.append(b);
}
$('cmap').addEventListener('change', e => { cmap = e.target.checked; render(); });
$('reset').addEventListener('click', () => viewer.resetView());

// ---------- model ----------
const viewerA = createViewer($('viewA'), () => {}), viewerB = createViewer($('viewB'), () => {});
const viewer = createViewer($('view'), c => { selected = c; analysed = false; anType = null; showDetails(); showAnalysis(); showMaterials(); });

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
  render(); showResults(); showDetails(); showAnalysis(); showMaterials();
}

function render() {
  segs.forEach(seg => [...seg.children].forEach(b => b.setAttribute('aria-checked', String(b.dataset.layer === layer))));
  const ratios = cmap ? Object.fromEntries(check.beams.map(r => [r.id, r.ratio])) : null;
  const passFail = checkedAll ? Object.fromEntries(check.beams.map(r => [r.id, r.pass])) : null;
  viewer.setModel(building, { layer, ratios, passFail });
  $('legend').hidden = !cmap;
  const ml = $('matlegend'); ml.hidden = layer !== 'materials'; ml.replaceChildren();
  for (const [k, m] of Object.entries(MATERIALS)) ml.append(el('span', {}, el('i', { style: `background:${hex(MAT_COLOURS[k])}` }), document.createTextNode(m.name)));
  if (selected) viewer.select(selected.id);
  renderCompare();
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
    ['Worst deflection', `${fmt(check.worstDeflectionMm)} mm`, w && !w.pass ? 'fail' : ''],
    ['Allowed (L/250)', w ? `${fmt(w.limitMm)} mm` : 'none'],
    ['Worst beam', w ? w.id.replace(/^beam-/, '') : 'none'],
    ['Worst beam result', w ? (w.pass ? 'PASS' : 'FAIL') : 'none', w && !w.pass ? 'fail' : 'pass'],
    ['Total weight', `${fmt(t.weightKN, 1)} kN`],
    ['Total mass', `${fmt(t.weightKg, 0)} kg`],
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
    ['Volume', `${fmt(r.volume, 4)} m³`], ['Weight', `${fmt(r.weightKN)} kN`], ['Mass', `${fmt(r.weightKg, 1)} kg`], ['Cost', inr(r.cost)]];
  if (c.type === 'beam') {
    const b = check.beams.find(x => x.id === c.id);
    rows.push(['Deflection', `${fmt(b.deflectionMm)} mm`], ['Allowed (L/250)', `${fmt(b.limitMm)} mm`], ['Share of limit', `${fmt(b.ratio * 100, 0)}%`], ['Result', b.pass ? 'PASS' : 'FAIL', b.pass ? 'pass' : 'fail']);
  }
  box.replaceChildren(kv(rows));
}

const buildingBeamType = () => building.components.find(c => c.type === 'beam')?.beamType ?? 'simply';
const beamTable = (head, rows, foot) => {
  const t = el('table'); t.append(el('thead', {}, el('tr', {}, ...head.map(h => el('th', { text: h })))));
  const tb = el('tbody'); rows.forEach(r => tb.append(el('tr', {}, ...r.map(x => el('td', { text: x }))))); t.append(tb);
  if (foot) t.append(el('tfoot', {}, el('tr', {}, ...foot.map(x => el('td', { text: x })))));
  return t;
};
const btn = (text, fn, cls = '') => { const b = el('button', { type: 'button', text, class: cls }); b.addEventListener('click', fn); return b; };

function showAnalysis() {
  const box = $('anbody'), out = [];
  // (a) analyse selected beam
  out.push(el('h3', { text: 'Selected beam' }));
  if (!selected || selected.type !== 'beam') out.push(el('p', { class: 'muted', text: 'Click a beam in the model (use the Structure layer), then press Analyse beam.' }));
  else {
    const type = anType ?? buildingBeamType();
    const sel = el('select', { 'aria-label': 'Beam type for this analysis' });
    sel.append(el('option', { value: 'simply', text: 'Simply supported' }), el('option', { value: 'cantilever', text: 'Cantilever' }));
    sel.value = type;
    sel.addEventListener('change', () => { anType = sel.value; showAnalysis(); });
    out.push(el('p', { class: 'muted', text: selected.id }), el('div', { class: 'row' }, el('label', { text: 'Support type' }), sel));
    out.push(btn('Analyse beam', () => { analysed = true; showAnalysis(); }));
    if (analysed) {
      const r = beamDeflection({ material: params.material, span: selected.length, b: selected.width, h: selected.height, load: params.load, type });
      out.push(kv([
        ['Deflection', `${fmt(r.deflectionMm)} mm`], ['Limit (span/250)', `${fmt(r.limitMm)} mm`], ['Ratio', fmt(r.ratio, 2)],
        ['Result', r.pass ? 'PASS' : 'FAIL', r.pass ? 'pass' : 'fail'],
        ['Self weight', `${fmt(r.selfWeightKNm)} kN/m`], ['Total w', `${fmt(r.totalKNm)} kN/m`],
      ]));
      const cmp = compareBeam({ span: selected.length, b: selected.width, h: selected.height, load: params.load, type });
      out.push(el('h3', { text: 'This beam in each material' }),
        beamTable(['Material', 'Deflection', 'Limit', 'Result'], Object.entries(cmp).map(([k, v]) => [MATERIALS[k].name, `${fmt(v.deflectionMm)} mm`, `${fmt(v.limitMm)} mm`, v.pass ? 'PASS' : 'FAIL'])));
    }
  }
  // (b) check all
  out.push(el('h3', { text: 'All beams' }));
  out.push(btn('Check all beams', () => { checkedAll = true; render(); showAnalysis(); }));
  if (checkedAll) {
    out.push(btn('Clear colours', () => { checkedAll = false; render(); showAnalysis(); }, 'alt'));
    const fails = check.beams.filter(b => !b.pass);
    const lp = el('p', { class: 'legpf' }, el('i', { style: 'background:#2e9e5b' }), document.createTextNode('pass'), el('i', { style: 'background:#d0382b' }), document.createTextNode('fail'));
    out.push(lp, kv([['Beams passing', `${check.passCount} of ${check.beams.length}`, 'pass'], ['Beams failing', String(check.failCount), fails.length ? 'fail' : 'pass']]));
    if (fails.length) {
      const ul = el('ul', { class: 'failist' });
      fails.forEach(b => ul.append(el('li', { class: 'fail', text: `FAIL ${b.id.replace(/^beam-/, '')}: ${fmt(b.deflectionMm)} mm > ${fmt(b.limitMm)} mm` })));
      out.push(ul);
    } else out.push(el('p', { class: 'pass flag', text: 'All beams PASS.' }));
  }
  // (c) totals
  const t = totalsByType(building.components, params.material);
  out.push(el('h3', { text: 'Whole-building totals' }),
    beamTable(['Part', 'Count', 'Weight kN', 'Cost'], TYPE_GROUPS.map(([k, n]) => [n, String(t.groups[k].count), fmt(t.groups[k].weightKN, 1), inr(t.groups[k].cost)]),
      ['Total', String(building.components.length), fmt(t.total.weightKN, 1), inr(t.total.cost)]));
  box.replaceChildren(...out);
}

function showMaterials() {
  const sw = el('div', { class: 'sw' });
  for (const [k, m] of Object.entries(MATERIALS)) sw.append(el('div', {}, el('i', { style: `background:${hex(MAT_COLOURS[k])}` }), el('b', { text: m.name }),
    el('div', { text: `Density ${fmt(m.density, 0)} kg/m³` }), el('div', { text: `Conductivity ${fmt(m.conductivity, 2)} W/mK` }),
    el('div', { text: `Durability ${m.durability}${DURABILITY_ASSUMED ? ' (assumed rating)' : ''}` }), el('div', { text: `Cost ~${inr(m.costPerM3)} per m³` })));
  const cm = compareMaterials(building.components, { load: params.load, beamType: buildingBeamType() });
  const nb = check.beams.length;
  const whole = beamTable(['Material', 'Weight kN', 'Cost', 'Beams passing'], Object.entries(cm).map(([k, v]) => [MATERIALS[k].name, fmt(v.weightKN, 1), inr(v.cost), `${v.passCount} of ${nb}`]));
  const kids = [sw, el('h3', { text: 'Whole structure, same design in each material' }), whole];
  if (selected && selected.type === 'beam') {
    const cmp = compareBeam({ span: selected.length, b: selected.width, h: selected.height, load: params.load, type: anType ?? buildingBeamType() });
    kids.push(el('h3', { text: `Selected beam (${selected.id.replace(/^beam-/, '')})` }),
      beamTable(['Material', 'Deflection', 'Result'], Object.entries(cmp).map(([k, v]) => [MATERIALS[k].name, `${fmt(v.deflectionMm)} mm`, v.pass ? 'PASS' : 'FAIL'])));
  } else kids.push(el('p', { class: 'muted', text: 'Select a beam to compare it across materials.' }));
  kids.push(el('p', { class: 'hint', text: 'All property, durability and cost values are rounded teaching assumptions, not design data. Slabs are always concrete.' }));
  $('matbody').replaceChildren(...kids);
}

// ---------- versions, comparison, cause and effect ----------
const api = async (path, opts) => {
  const r = await fetch(path, opts);
  if (!r.ok) { let m = r.statusText; try { const j = await r.json(); m = typeof j.detail === 'string' ? j.detail : j.detail.map(d => d.loc.join('.') + ': ' + d.msg).join('; '); } catch {} throw new Error(m); }
  return r.status === 204 ? null : r.json();
};
const deep = o => JSON.parse(JSON.stringify(o));
const say = t => { $('vmsg').textContent = t; };
let saved = [], original = null;

function analyse(p) {
  const b = generateBuilding(p);
  const ch = checkAll(b.components, { load: p.load, beamType: b.components.find(c => c.type === 'beam')?.beamType, material: p.material });
  return { building: b, check: ch, summary: summarize(b, ch) };
}
const currentSummary = () => summarize(building, check);

function setOriginal(name, p) {
  try { original = { name, params: deep(p), ...analyse(p) }; } catch (e) { say('Cannot use that design as original: ' + e.message); return; }
  $('origname').textContent = '(' + name + ')';
  viewerA.resetView(); renderCompare();
}

const METRIC_FMT = {
  worstDeflectionMm: v => `${fmt(v)} mm`, passCount: v => fmt(v, 0), failCount: v => fmt(v, 0),
  totalWeightKg: v => `${fmt(v, 0)} kg`, totalCost: inr, daylight: v => fmt(v, 3),
};
const ARROW = { up: '▲', down: '▼', same: '＝' };
const PNAME = { floor_visible: 'Floor visible', roof_type: 'Roof type', beam_type: 'Beam type', beam_b: 'Beam width b', beam_h: 'Beam depth h', span_x: 'Bay span x', span_z: 'Bay span z',
  bays_x: 'Bays in x', bays_z: 'Bays in z', window_w: 'Window width', window_h: 'Window height', roof_pitch: 'Roof pitch', load: 'Applied load', floor_height: 'Floor height' };
function pname(k) {
  const m = k.match(/^floor_visible\[(\d)\]$/); if (m) return `Floor ${Number(m[1]) + 1} visible`;
  if (PNAME[k]) return PNAME[k];
  const s = k.replace(/[_.]/g, ' '); return s[0].toUpperCase() + s.slice(1);
}
function pval(k, v) {
  if (v === undefined) return 'none';
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  if (k === 'material') return MATERIALS[v]?.name ?? v;
  if (typeof v === 'number') return fmt(v, 3).replace(/\.?0+$/, '');
  return String(v).replace(/_/g, ' ');
}
function effectTable(rows, nameA, nameB) {
  const t = el('table', { class: 'etab' });
  t.append(el('thead', {}, el('tr', {}, ...['Measure', nameA, nameB, 'Change'].map(x => el('th', { text: x })))));
  const tb = el('tbody');
  for (const r of rows) {
    const f = METRIC_FMT[r.key];
    const ch = r.direction === 'same' ? 'same' : `${r.word} by ${f(Math.abs(r.change))}`;
    tb.append(el('tr', {}, el('td', { text: r.label }), el('td', { text: f(r.from) }), el('td', { text: f(r.to) }),
      el('td', { class: 'chg ' + r.direction, text: `${ARROW[r.direction]} ${ch}` })));
  }
  t.append(tb); return t;
}
function paramList(diff) {
  if (!diff.length) return el('p', { class: 'muted', text: 'No parameter differs.' });
  const ul = el('ul', { class: 'plist' });
  diff.forEach(d => ul.append(el('li', { text: `${pname(d.key)}: ${pval(d.key, d.from)} → ${pval(d.key, d.to)}` })));
  return ul;
}

function renderCompare() {
  if (!original || !building) return;
  const dc = diffComponents(original.building.components, building.components);
  viewerA.setModel(original.building, { layer, highlight: dc.original });
  viewerB.setModel(building, { layer, highlight: dc.modified });
  const pd = diffParams(original.building.params, building.params);
  const rows = diffSummaries(original.summary, currentSummary());
  $('cebody').replaceChildren(el('div', { class: 'cols2' },
    el('div', {}, el('h3', { text: `Cause: ${pd.length} parameter${pd.length === 1 ? '' : 's'} changed (old → new)` }), paramList(pd)),
    el('div', {}, el('h3', { text: 'Effect: what moved' }), effectTable(rows, 'Original', 'Modified'))),
    el('p', { class: 'hint', text: 'Daylight indicator = window area / floor area. It is simple arithmetic, not a daylight simulation. Compared against the original shown in section 8.' }));
  renderVersionCompare();
}

function versionOptions() {
  return [['cur', 'Current design (unsaved)'], ...saved.map(d => ['d' + d.id, `${d.name} (#${d.id})`])];
}
function versionData(key) {
  if (key === 'cur') return { name: 'Current', params: building.params, summary: currentSummary() };
  const d = saved.find(x => 'd' + x.id === key); return d && { name: d.name, params: d.params, summary: d.summary };
}
function fillSelect(sel, def) {
  const keep = sel.value, opts = versionOptions();
  sel.replaceChildren(...opts.map(([v, t]) => el('option', { value: v, text: t })));
  sel.value = opts.some(o => o[0] === keep) ? keep : def;
}
function renderVersionCompare() {
  const a = versionData($('vcA').value), b = versionData($('vcB').value), box = $('vcbody');
  if (!a || !b) { box.replaceChildren(el('p', { class: 'muted', text: 'Save a design to compare versions.' })); return; }
  const pd = diffParams(a.params, b.params);
  box.replaceChildren(el('h3', { text: `Results: ${a.name} vs ${b.name}` }), effectTable(diffSummaries(a.summary, b.summary), a.name, b.name),
    el('h3', { text: `Parameters that differ (${pd.length}), A → B` }), paramList(pd));
}
function renderSaved() {
  const box = $('vlist');
  if (!saved.length) box.replaceChildren(el('p', { class: 'muted', text: 'No saved designs yet. Name the current design and press Save design.' }));
  else box.replaceChildren(...saved.map(d => {
    const s = d.summary, nb = (s.passCount ?? 0) + (s.failCount ?? 0);
    const sm = `${s.passCount} of ${nb} beams pass · worst ${fmt(s.worstDeflectionMm)} mm · ${fmt(s.totalWeightKg, 0)} kg · ${inr(s.totalCost)}`;
    return el('div', { class: 'vrow', 'data-id': d.id }, el('span', { class: 'nm', text: d.name }), el('span', { class: 'sm', text: sm }),
      el('span', { class: 'acts' }, btn('Load', () => loadDesign(d)), btn('Set as original', () => { setOriginal(d.name, d.params); say(`Original is now "${d.name}".`); }, 'alt'),
        btn('Delete', () => removeDesign(d), 'del')));
  }));
  fillSelect($('vcA'), 'cur'); fillSelect($('vcB'), 'cur');
  if ($('vcA').value === $('vcB').value && saved.length) { $('vcA').value = 'd' + saved[0].id; }
  if (building) renderVersionCompare();
}
async function refreshSaved() {
  try { saved = await api('/designs'); renderSaved(); } catch (e) { say('Could not load saved designs: ' + e.message); }
}
function loadDesign(d) {
  try {
    const p = validateParams(d.params);
    Object.keys(params).forEach(k => delete params[k]); Object.assign(params, deep(p));
  } catch (e) { say('Cannot load: ' + e.message); return; }
  refreshers.forEach(f => f()); selected = null; update(); say(`Loaded "${d.name}".`);
}
async function removeDesign(d) {
  try { await api('/designs/' + d.id, { method: 'DELETE' }); say(`Deleted "${d.name}".`); await refreshSaved(); } catch (e) { say('Delete failed: ' + e.message); }
}
$('vsave').addEventListener('click', async () => {
  const name = $('vname').value.trim();
  if (!name) { say('Type a name first.'); return; }
  if ($('err').textContent) { say('Fix the error in the parameters before saving.'); return; }
  try {
    await api('/designs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, params: deep(building.params), summary: currentSummary() }) });
    say(`Saved "${name}".`); $('vname').value = ''; await refreshSaved();
  } catch (e) { say('Save failed: ' + e.message); }
});
$('setorig').addEventListener('click', () => { setOriginal('current design when set', building.params); say('Original set to the current design.'); });
$('vcA').addEventListener('change', renderVersionCompare); $('vcB').addEventListener('change', renderVersionCompare);

window.__adt = { viewerA, viewerB, viewer, params, get building() { return building; }, get check() { return check; } };
update();
setOriginal('starting design', building.params);
refreshSaved();
