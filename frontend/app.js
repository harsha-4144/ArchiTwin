// app.js - UI wiring and display formatting only. All numbers come from calc.mjs / building.mjs.
import { generateBuilding, validateParams, DEFAULT_PARAMS, SIDES } from './building.mjs';
import { MATERIALS, summarize, diffSummaries, diffParams, diffComponents, checkAll, componentWeightCost, beamDeflection, totalsByType, compareMaterials, compareBeam, TYPE_GROUPS, DURABILITY_ASSUMED } from './calc.mjs';
import { createViewer, MAT_COLOURS } from './viewer.mjs';
import { ICONS, statusChip } from './js/icons.mjs';
import { PRESETS, resolvePreset, presetOf } from './presets.mjs';
import { generateArchitecture, featureTotals, DECORATIVE_NOTE } from './architecture.mjs';
import { beamMessage, buildingMessage, materialMessage, DEFLECTION_EXPLAINER, ABOUT, ABOUT_CONTEXT, HELP, SELECT_HINT } from './messages.mjs';
import { componentName, componentNameWithId, openingLines } from './names.mjs';
import { bendShape } from './viewer.mjs';

// ---------- motion helpers (display only; respect prefers-reduced-motion) ----------
const BEND_SCALE = 30;   // drawing exaggeration for beam bending; never applied to any number
const reduced = () => matchMedia('(prefers-reduced-motion:reduce)').matches;
const easeOut = t => 1 - (1 - t) ** 3;
const shown = new Map();   // key -> number currently shown (so a new animation starts from what the user sees)
function countTo(node, key, to, f, ms = 300) {
  const from = shown.has(key) ? shown.get(key) : 0;
  shown.set(key, to);
  if (from === to || reduced()) { node.textContent = f(to); return; }
  node.textContent = f(from);
  const t0 = performance.now(), my = (node._tok = {});
  const step = now => {
    if (node._tok !== my) return;
    const p = Math.min(1, (now - t0) / ms), v = p >= 1 ? to : from + (to - from) * easeOut(p);
    node.textContent = f(v); shown.set(key, v);
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
// Eases one number towards a target and calls draw(value) on every frame.
function makeTween(draw, ms = 250) {
  let cur = 0, raf = 0, token = 0;
  return { get value() { return cur; },
    to(target) {
      const from = cur, t0 = performance.now(), my = ++token; cancelAnimationFrame(raf);
      if (reduced() || from === target) { cur = target; draw(cur); return; }
      const step = now => { if (my !== token) return; const p = Math.min(1, (now - t0) / ms); cur = p >= 1 ? target : from + (target - from) * easeOut(p); draw(cur); if (p < 1) raf = requestAnimationFrame(step); };
      raf = requestAnimationFrame(step);
    } };
}

const $ = id => document.getElementById(id);
const params = JSON.parse(JSON.stringify(DEFAULT_PARAMS));
let layer = 'architecture', cmap = false, building = null, check = null, selected = null;
let checkedAll = false, analysed = false, anType = null;
let curPreset = null, arch = [];   // arch = decorative features of the chosen preset (never part of building.components)
const allParts = () => [...building.components, ...arch];

const fmt = (v, d = 2) => Number(v).toLocaleString('en-IN', { maximumFractionDigits: d, minimumFractionDigits: d });
const inr = v => '₹' + Math.round(v).toLocaleString('en-IN');
const hex = n => '#' + n.toString(16).padStart(6, '0');
const el = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) k === 'text' ? e.textContent = v : e.setAttribute(k, v);
  kids.forEach(k => e.append(k)); return e;
};

// ---------- controls ----------
// Small '?' button that shows/hides a plain-words caption under a control row.
let helpN = 0;
const helpPairs = [];
function helpButton(name, text) {
  const id = 'help-' + (++helpN);
  const cap = el('p', { class: 'hint helpcap', id, role: 'note', text, hidden: '' });
  const b = el('button', { type: 'button', class: 'help', 'aria-label': 'Help: ' + name, 'aria-expanded': 'false', 'aria-controls': id, 'aria-describedby': id, text: '?' });
  const set = open => { cap.hidden = !open; b.setAttribute('aria-expanded', String(open)); };
  b.addEventListener('click', () => set(cap.hidden));
  b.addEventListener('keydown', e => { if (e.key === 'Escape' && !cap.hidden) { set(false); e.stopPropagation(); } });
  helpPairs.push(set);
  return { b, cap };
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') helpPairs.forEach(s => s(false)); });
function withHelp(row, text, name) {
  const label = row.querySelector('label');
  const { b, cap } = helpButton(name || label.textContent, text);
  const wrap = el('span', { class: 'labwrap' }); label.replaceWith(wrap); wrap.append(label, b);
  return el('div', {}, row, cap);
}
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

group('Building', slider('Floors', 'floors', 1, 2, 1), withHelp(slider('Bays in x', 'bays_x', 1, 3, 1), HELP.bay + ' ' + HELP.grid), withHelp(slider('Bays in z', 'bays_z', 1, 3, 1), HELP.bay + ' ' + HELP.grid),
  slider('Bay span x', 'span_x', 2, 8, 0.5, ' m'), slider('Bay span z', 'span_z', 2, 8, 0.5, ' m'), slider('Floor height', 'floor_height', 2.5, 4, 0.1, ' m'));
group('Roof', select('Roof type', 'roof_type', [['flat', 'Flat'], ['shed', 'Shed'], ['gable', 'Gable']]), slider('Roof pitch', 'roof_pitch', 0, 45, 1, '°'));
const f1 = checkbox('Floor 1', () => params.floor_visible[0], v => params.floor_visible[0] = v);
const f2 = checkbox('Floor 2', () => params.floor_visible[1], v => params.floor_visible[1] = v);
group('Show parts', el('div', { class: 'tg' },
  checkbox('Walls', () => params.walls, v => params.walls = v).box, checkbox('Roof', () => params.roof, v => params.roof = v).box, f1.box, f2.box));
group('Doors per side', sideTable('Doors', 'doors', 4));
group('Windows per side', sideTable('Windows', 'windows', 8),
  slider('Window width', 'window_w', 0.3, 4, 0.1, ' m'), slider('Window height', 'window_h', 0.3, 3.7, 0.1, ' m'));
group('Structure', withHelp(select('Material', 'material', Object.entries(MATERIALS).map(([k, m]) => [k, m.name])), HELP.stiffer),
  withHelp(select('Beam type', 'beam_type', [['simply_supported', 'Simply supported'], ['cantilever', 'Cantilever']]), HELP.simply + ' ' + HELP.cantilever),
  slider('Beam width b', 'beam_b', 0.1, 0.6, 0.05, ' m'), slider('Beam depth h', 'beam_h', 0.15, 0.9, 0.05, ' m'));
group('Loads', slider('Applied load', 'load', 0, 50, 1, ' kN/m'), el('p', { class: 'hint', text: 'kN/m = force per metre of beam length. A typical floor is about 5–15 kN/m.' }));

// ---------- layers ----------
const segs = [...document.querySelectorAll('#layers, .layerseg')];
for (const seg of segs) for (const [k, t] of [['structure', 'Structure'], ['architecture', 'Architecture'], ['materials', 'Materials']]) {
  const b = el('button', { type: 'button', role: 'radio', 'data-layer': k, text: t });
  b.addEventListener('click', () => { layer = k; render(); if (seg.id === 'layers') viewer.resetView(); });
  seg.append(b);
}
$('cmap').addEventListener('change', e => { cmap = e.target.checked; render(); });
$('checkall').addEventListener('click', () => checkAllBeams());
$('reset').addEventListener('click', () => viewer.resetView());

// ---------- model ----------
// If WebGL is unavailable the 3D areas show a message and every number, table and diagram still works.
let glFailed = false;
const NOGL = { setModel() {}, select() {}, resetView() {}, focusOn() {}, fitModels() {}, followCamera() {}, onCamera() {}, resize() {}, camState: () => null, screenPosOf: () => null, ids: () => [], sagOf: () => null, sagTarget: () => null, midY: () => null, flying: () => false, controls: {} };
function makeViewer(host, pick, hover) {
  try { return createViewer(host, pick, hover); }
  catch (e) {
    glFailed = true;
    host.replaceChildren(el('p', { class: 'state', role: 'status', text: 'The 3D view cannot start because WebGL is switched off or not supported here. Numbers, tables and the beam diagram still work. Try another browser or turn on hardware acceleration.' }));
    return NOGL;
  }
}
const tip = el('div', { id: 'tip', role: 'tooltip', hidden: '' });
document.body.append(tip);
function tipSize(c) {
  const mm = v => fmt(v * 1000, 0);
  if (c.type === 'feature') return `${fmt(c.size.sx)} × ${fmt(c.size.sz)} × ${fmt(c.size.sy)} m, decorative`;
  if (c.type === 'slab' || c.type === 'roof') return `${fmt(c.area)} m² × ${mm(c.thickness)} mm`;
  if (c.type === 'wall') return `${fmt(c.length)} × ${fmt(c.height)} m × ${mm(c.thickness)} mm`;
  if (c.type === 'column') return `${mm(c.width)} × ${mm(c.length)} mm × ${fmt(c.height)} m`;
  return `${mm(c.width)} × ${mm(c.height)} mm × ${fmt(c.length)} m`;
}
function showTip(c, x, y) {
  if (!c || !building) { tip.hidden = true; return; }
  const r = componentWeightCost(c, c.type === 'feature' ? c.material : params.material);
  tip.replaceChildren(el('b', { text: componentName(c) }), el('span', { text: `${MATERIALS[r.material].name} · ${tipSize(c)}` }), ...(c.type === 'feature' ? [el('em', { text: DECORATIVE_NOTE })] : []));
  tip.hidden = false;
  const w = tip.offsetWidth, h = tip.offsetHeight;
  const px = Math.max(8, Math.min(innerWidth - w - 8, x + 14)), py = Math.max(8, Math.min(innerHeight - h - 8, y + 16));
  tip.style.transform = `translate(${px}px,${py}px)`;
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') tip.hidden = true; });
function showTipAtPart(c) {
  const p = viewer.screenPosOf(c.id); if (p) showTip(c, p.x, p.y);
}
const viewerA = makeViewer($('viewA'), () => {}), viewerB = makeViewer($('viewB'), () => {});
viewerA.followCamera(viewerB); viewerB.followCamera(viewerA);   // the before/after views move together
function pickPart(c, fromList = false) {
  selected = c; analysed = false; anType = null;
  if (fromList) render();
  showDetails(); showAnalysis(); showMaterials(); showBend(); syncPicker();
  if (c) { viewer.focusOn(c.id); if (fromList || matchMedia('(pointer:coarse)').matches) showTipAtPart(c); } else tip.hidden = true;
}
const viewer = makeViewer($('view'), c => pickPart(c), (c, x, y) => { if (c) showTip(c, x, y); else tip.hidden = true; });
const picker = $('partpick');
{ const { b, cap } = helpButton('part names', HELP.grid); $('pickhelp').append(b); $('pickhelp').after(cap); }
let pickerKey = '';
function fillPicker() {
  const key = allParts().map(c => c.id).join('|');
  if (key !== pickerKey) {
    pickerKey = key;
    picker.replaceChildren(el('option', { value: '', text: 'Choose a part…' }));
    for (const [t, n] of TYPE_GROUPS) {
      const og = el('optgroup', { label: n });
      for (const c of building.components) if (c.type === t) og.append(el('option', { value: c.id, text: componentName(c) }));
      if (og.children.length) picker.append(og);
    }
    if (arch.length) {
      const og = el('optgroup', { label: 'Decorative features (not in structural totals)' });
      for (const c of arch) og.append(el('option', { value: c.id, text: componentName(c) }));
      picker.append(og);
    }
  }
  syncPicker();
}
function syncPicker() { picker.value = selected ? selected.id : ''; }
picker.addEventListener('change', () => { const c = allParts().find(x => x.id === picker.value); if (c) pickPart(c, true); });
$('bendnote').textContent = `Bending shown ×${BEND_SCALE}: drawing only, the numbers are exact. Very large bends are clipped in the drawing.`;

function update() {
  f2.input.disabled = params.floors < 2;
  try {
    building = generateBuilding(params);
    arch = curPreset ? generateArchitecture(params, building, curPreset.features) : [];
    check = checkAll(building.components, { load: params.load, beamType: building.components.find(c => c.type === 'beam')?.beamType, material: params.material });
    $('err').textContent = '';
  } catch (e) {
    $('err').textContent = 'Not applied: ' + e.message;
    return;
  }
  if (selected && !allParts().some(c => c.id === selected.id)) selected = null;
  else if (selected) selected = allParts().find(c => c.id === selected.id);
  fillPicker(); render(); showResults(); showDetails(); showAnalysis(); showMaterials(); showBend();
}

function render() {
  segs.forEach(seg => [...seg.children].forEach(b => b.setAttribute('aria-checked', String(b.dataset.layer === layer))));
  const ratios = cmap ? Object.fromEntries(check.beams.map(r => [r.id, r.ratio])) : null;
  const passFail = checkedAll ? Object.fromEntries(check.beams.map(r => [r.id, r.pass])) : null;
  const deflections = Object.fromEntries(check.beams.map(r => [r.id, r.deflectionMm]));
  viewer.setModel(building, { layer, ratios, passFail, deflections, bendScale: BEND_SCALE, features: arch, palette: curPreset ? curPreset.palette : null });
  if (!render.done) { render.done = true; const st = $('viewstate'); if (st) st.remove(); }
  $('legend').hidden = !cmap;
  $('archnote').hidden = !(arch.length && layer !== 'structure');
  const ml = $('matlegend'); ml.hidden = layer !== 'materials'; ml.replaceChildren();
  for (const [k, m] of Object.entries(MATERIALS)) ml.append(el('span', {}, el('i', { style: `background:${hex(MAT_COLOURS[k])}` }), document.createTextNode(m.name)));
  if (selected) viewer.select(selected.id);
  renderCompare();
}

function kv(rows) {
  const d = el('dl', { class: 'kv' });
  for (const [k, v, cls, num] of rows) {
    const dd = el('dd', { text: v, class: cls || '' });
    if (num) countTo(dd, num.key, num.v, num.f);
    d.append(el('dt', { text: k }), dd);
  }
  return d;
}

// ---------- About this result (card 6) ----------
const ABOUT_LABEL = { results: 'What do these results assume?', analysis: 'What does this analysis assume?', materials: 'What do these material numbers assume?', versions: 'What does this comparison assume?' };
function aboutLink(ctx) {
  const b = btn(ABOUT_LABEL[ctx] || 'What does this assume?', () => openAbout(ctx), 'alt about-link');
  b.setAttribute('aria-controls', 'aboutcard');
  return b;
}
function renderAbout(ctx) {
  const c = ABOUT_CONTEXT[ctx];
  const ul = (items, hl) => el('ul', { class: 'plist' }, ...items.map(i => el('li', { text: i, ...(hl ? { class: 'hl' } : {}) })));
  $('aboutbody').replaceChildren(
    el('p', { class: 'abctx', text: c ? `Showing what matters for: ${c.label}. Highlighted items apply most.` : 'What to know before you trust any number here.' }),
    el('h3', { text: 'Data source' }), ul(ABOUT.source, c && c.source),
    el('h3', { text: 'Assumptions' }),
    el('ul', { class: 'plist' }, ...ABOUT.assumptions.map(([id, t]) => el('li', { text: t, class: c && c.ids.includes(id) ? 'hl' : '' }))),
    el('h3', { text: 'Limitations' }), ul(ABOUT.limitations),
    el('h3', { text: 'When to use professional analysis' }), el('p', { text: ABOUT.professional }),
    el('p', { class: 'flag', text: ABOUT.statement }));
}
function openAbout(ctx) {
  renderAbout(ctx);
  const card = $('aboutcard');
  const fold = card.querySelector('details'); if (fold) fold.open = true;
  card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  card.focus({ preventScroll: true });
  card.classList.remove('flash'); void card.offsetWidth; card.classList.add('flash');
}

function showResults() {
  const w = check.beams.find(b => b.id === check.worstId);
  const t = building.totals;
  $('resbody').replaceChildren(kv([
    ['Beams passing', `${check.passCount} of ${check.beams.length} pass`, 'pass', { key: 'pass', v: check.passCount, f: n => `${Math.round(n)} of ${check.beams.length} pass` }],
    ['Beams failing', `${check.failCount} fail`, check.failCount ? 'fail' : 'pass', { key: 'fail', v: check.failCount, f: n => `${Math.round(n)} fail` }],
    ['Worst deflection', `${fmt(check.worstDeflectionMm)} mm`, '', { key: 'worst', v: check.worstDeflectionMm, f: n => `${fmt(n)} mm` }],
    ['Allowed (span ÷ 250)', w ? `${fmt(w.limitMm)} mm` : 'none', '', w ? { key: 'lim', v: w.limitMm, f: n => `${fmt(n)} mm` } : null],
    ['Worst beam', w ? componentName(w.id) : 'none', 'wrapok'],
    ['Worst beam result', w ? (w.pass ? 'PASS' : 'FAIL') : 'none', w && !w.pass ? 'fail' : 'pass'],
    ['Total weight', `${fmt(t.weightKN, 1)} kN`, '', { key: 'kn', v: t.weightKN, f: n => `${fmt(n, 1)} kN` }],
    ['Total mass', `${fmt(t.weightKg, 0)} kg`, '', { key: 'kg', v: t.weightKg, f: n => `${fmt(n, 0)} kg` }],
    ['Estimated cost', inr(t.cost), '', { key: 'cost', v: t.cost, f: inr }],
  ]), el('p', { class: check.failCount ? 'msg fail' : 'msg pass', text: buildingMessage(check, { material: params.material, type: buildingBeamType() }) }),
  el('p', { class: 'hint', text: DEFLECTION_EXPLAINER }),
  ...(arch.length ? [el('p', { class: 'hint', text: `Decorative features (${featureTotals(arch).count} parts, about ${fmt(featureTotals(arch).weightKg, 0)} kg) are listed in the part picker but are not in these totals or beam checks.` })] : []), aboutLink('results'));
}

function sizeText(c) {
  const mm = v => fmt(v * 1000, 0);
  if (c.type === 'slab' || c.type === 'roof') return `${fmt(c.area)} m² × ${mm(c.thickness)} mm thick`;
  if (c.type === 'wall') return `${fmt(c.length)} m long × ${fmt(c.height)} m high × ${mm(c.thickness)} mm (net area ${fmt(c.area)} m²)`;
  if (c.type === 'column') return `${mm(c.width)} × ${mm(c.length)} mm section × ${fmt(c.height)} m high`;
  return `${mm(c.width)} × ${mm(c.height)} mm section × ${fmt(c.length)} m`;
}

function showDetails() {
  const box = $('detbody');
  if (!selected) { box.replaceChildren(el('p', { class: 'muted hintbox', text: SELECT_HINT })); return; }
  const c = selected;
  if (c.type === 'feature') {
    const r = componentWeightCost(c, c.material), mm = v => fmt(v * 1000, 0);
    box.replaceChildren(kv([['Part', c.name], ['Type', `Decorative feature (${c.kind.replace(/-/g, ' ')})`], ['ID', c.id],
      ['Size', `${fmt(c.size.sx)} × ${fmt(c.size.sz)} m on plan, ${fmt(c.size.sy)} m high` + (c.shape === 'prism' ? ' (gable shape, weight uses half the height)' : '')],
      ['Material', MATERIALS[r.material].name], ['Volume', `${fmt(r.volume, 4)} m³`], ['Weight', `${fmt(r.weightKN)} kN`], ['Mass', `${fmt(r.weightKg, 1)} kg`], ['Cost', inr(r.cost)]]),
      el('p', { class: 'msg decorative', text: DECORATIVE_NOTE + ' Shown in the Architecture and Materials layers only.' }));
    return;
  }
  const r = componentWeightCost(c, params.material);
  const rows = [['Part', componentName(c)], ['Type', c.type + (c.type === 'wall' && c.side ? ` (${c.side})` : '')], ['ID', c.id], ['Size', sizeText(c)],
    ['Material', MATERIALS[r.material].name + (c.type === 'slab' ? ' (slabs are always concrete)' : '')],
    ['Volume', `${fmt(r.volume, 4)} m³`], ['Weight', `${fmt(r.weightKN)} kN`], ['Mass', `${fmt(r.weightKg, 1)} kg`], ['Cost', inr(r.cost)]];
  if (c.type === 'beam') {
    const b = check.beams.find(x => x.id === c.id);
    rows.push(['Deflection', `${fmt(b.deflectionMm)} mm`], ['Allowed (span ÷ 250)', `${fmt(b.limitMm)} mm`], ['Share of limit', `${fmt(b.ratio * 100, 0)}%`], ['Result', b.pass ? 'PASS' : 'FAIL', b.pass ? 'pass' : 'fail']);
    box.replaceChildren(kv(rows), el('p', { class: b.pass ? 'msg pass' : 'msg fail', text: beamMessage(b, { material: params.material, type: buildingBeamType() }) }));
    return;
  }
  if (c.type === 'wall') {
    box.replaceChildren(kv(rows), el('h3', { text: 'Doors and windows' }), el('ul', { class: 'plist' }, ...openingLines(c, v => fmt(v)).map(t => el('li', { text: t }))));
    return;
  }
  box.replaceChildren(kv(rows));
}

const buildingBeamType = () => building.components.find(c => c.type === 'beam')?.beamType ?? 'simply';
const beamTable = (head, rows, foot) => {
  const t = el('table'); const wrap = el('div', { class: 'tscroll' }, t); t.append(el('thead', {}, el('tr', {}, ...head.map(h => el('th', { text: h, scope: 'col' })))));
  const tb = el('tbody'); rows.forEach(r => tb.append(el('tr', {}, ...r.map(x => el('td', { text: x, ...(x === 'PASS' || x === 'FAIL' ? { class: x.toLowerCase() } : {}) }))))); t.append(tb);
  if (foot) t.append(el('tfoot', {}, el('tr', {}, ...foot.map(x => el('td', { text: x })))));
  return wrap;
};
const checkAllBeams = () => { checkedAll = true; render(); showAnalysis(); };
const btn = (text, fn, cls = '', tip = '') => { const b = el('button', { type: 'button', text, class: cls, ...(tip ? { title: tip } : {}) }); b.addEventListener('click', fn); return b; };

function showAnalysis() {
  const box = $('anbody'), out = [];
  out.push(el('p', { class: 'assume', text: `Using: ${MATERIALS[params.material].name} beams, ${fmt(params.beam_b * 1000, 0)} × ${fmt(params.beam_h * 1000, 0)} mm, ${params.load} kN/m load, ${buildingBeamType() === 'cantilever' ? 'cantilever' : 'simply supported'}, limit span ÷ 250.` }));
  // (a) analyse selected beam
  out.push(el('h3', { text: 'Selected beam' }));
  if (!selected || selected.type !== 'beam') out.push(el('p', { class: 'muted', text: 'Click a beam in the model (use the Structure layer), then press Analyse beam.' }));
  else {
    const type = anType ?? buildingBeamType();
    const sel = el('select', { 'aria-label': 'Beam type for this analysis' });
    sel.append(el('option', { value: 'simply', text: 'Simply supported' }), el('option', { value: 'cantilever', text: 'Cantilever' }));
    sel.value = type;
    sel.addEventListener('change', () => { anType = sel.value; showAnalysis(); });
    out.push(el('p', { class: 'muted', text: componentNameWithId(selected) }), el('div', { class: 'row' }, el('label', { text: 'Support type' }), sel));
    out.push(btn('Analyse beam', () => { analysed = true; showAnalysis(); }, '', 'Work out the sag of this one beam and compare it in all three materials'), el('p', { class: 'tip', text: 'Works out the sag of the selected beam only.' }));
    if (analysed) {
      const r = beamDeflection({ material: params.material, span: selected.length, b: selected.width, h: selected.height, load: params.load, type });
      out.push(kv([
        ['Deflection', `${fmt(r.deflectionMm)} mm`], ['Limit (span ÷ 250)', `${fmt(r.limitMm)} mm`], ['Ratio', fmt(r.ratio, 2)],
        ['Result', r.pass ? 'PASS' : 'FAIL', r.pass ? 'pass' : 'fail'],
        ['Self weight', `${fmt(r.selfWeightKNm)} kN/m`], ['Total w (own weight + applied load, kN/m = force per metre of beam)', `${fmt(r.totalKNm)} kN/m`],
      ]), el('p', { class: r.pass ? 'msg pass' : 'msg fail', text: beamMessage(r, { material: params.material, type }) }));
      const cmp = compareBeam({ span: selected.length, b: selected.width, h: selected.height, load: params.load, type });
      out.push(el('h3', { text: 'This beam in each material' }),
        beamTable(['Material', 'Deflection', 'Limit', 'Result'], Object.entries(cmp).map(([k, v]) => [MATERIALS[k].name, `${fmt(v.deflectionMm)} mm`, `${fmt(v.limitMm)} mm`, v.pass ? 'PASS' : 'FAIL'])));
    }
  }
  // (b) check all
  out.push(el('h3', { text: 'All beams' }));
  out.push(el('div', { class: 'btnrow' }, btn('Check all beams', checkAllBeams, '', 'Test every beam and colour it green (pass) or red (fail) in the model'),
    ...(checkedAll ? [btn('Clear colours', () => { checkedAll = false; render(); showAnalysis(); }, 'alt', 'Remove the green and red colours from the model')] : [])),
    el('p', { class: 'tip', text: 'Check all beams tests every beam and colours it green (pass) or red (fail) in the model.' + (checkedAll ? ' Clear colours removes those colours.' : '') }));
  if (checkedAll) {
    const fails = check.beams.filter(b => !b.pass);
    const lp = el('p', { class: 'legpf' }, el('i', { style: 'background:#2e9e5b' }), document.createTextNode('pass'), el('i', { style: 'background:#d0382b' }), document.createTextNode('fail'));
    out.push(el('p', { class: fails.length ? 'msg fail' : 'msg pass', text: buildingMessage(check, { material: params.material, type: buildingBeamType() }) }), lp, kv([['Beams passing', `${check.passCount} of ${check.beams.length} pass`, 'pass'], ['Beams failing', `${check.failCount} fail`, fails.length ? 'fail' : 'pass']]));
    if (fails.length) {
      const ul = el('ul', { class: 'failist' });
      fails.forEach(b => ul.append(el('li', { class: 'fail', title: b.id, text: `FAIL ${componentName(b.id)}: ${fmt(b.deflectionMm)} mm > ${fmt(b.limitMm)} mm` })));
      out.push(ul);
    } else out.push(el('p', { class: 'pass flag', text: 'All beams PASS.' }), el('p', { class: 'hint', text: 'This only checks beam bending, under the stated assumptions: see the About card.' }));
  }
  // (c) totals
  const t = totalsByType(building.components, params.material);
  out.push(el('h3', { text: 'Whole-building totals' }),
    beamTable(['Part', 'Count', 'Weight kN', 'Cost'], TYPE_GROUPS.map(([k, n]) => [n, String(t.groups[k].count), fmt(t.groups[k].weightKN, 1), inr(t.groups[k].cost)]),
      ['Total', String(building.components.length), fmt(t.total.weightKN, 1), inr(t.total.cost)]));
  out.push(aboutLink('analysis'));
  box.replaceChildren(...out);
}

// ---------- Beam Bending card: side view of the selected (or worst) beam, eased between values ----------
const SVGNS = 'http://www.w3.org/2000/svg';
const svgEl = (tag, attrs = {}) => { const n = document.createElementNS(SVGNS, tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); return n; };
const BW = 320, BX0 = 28, BX1 = 292, BY = 44, BT = 12, PX = 26, N = 40;   // drawing units; PX = pixels per 100% of the limit
let bendSvg = null, bendKind = 'simply', bendRatio = 0;
const bendTween = makeTween(v => drawBend(v));
function drawBend(r) {
  if (!bendSvg) return;
  const sag = Math.min(3, r) * PX, top = [], bot = [];
  for (let i = 0; i <= N; i++) {
    const xi = i / N, x = BX0 + xi * (BX1 - BX0), y = BY + sag * bendShape(bendKind, xi);
    top.push(`${x.toFixed(1)},${y.toFixed(1)}`); bot.push(`${x.toFixed(1)},${(y + BT).toFixed(1)}`);
  }
  bendSvg.querySelector('.bm').setAttribute('points', top.concat(bot.reverse()).join(' '));
}
function buildBendSvg() {
  const svg = svgEl('svg', { viewBox: `0 0 ${BW} 150`, class: 'bendsvg', role: 'img', 'aria-labelledby': 'bend-t' });
  svg.append(Object.assign(svgEl('title', { id: 'bend-t' }), { textContent: 'Side view of a beam bending under load. The dashed line marks the allowed sag.' }));
  const supports = svgEl('g', { class: 'sup' });
  if (bendKind === 'cantilever') {
    supports.append(svgEl('rect', { x: 10, y: BY - 12, width: 18, height: 52, class: 'wallblk' }));
    for (let k = 0; k < 4; k++) supports.append(svgEl('path', { d: `M10 ${BY - 4 + k * 12}l-6 8` }));
  } else {
    for (const x of [BX0, BX1]) supports.append(svgEl('path', { d: `M${x} ${BY + BT + 1}l-9 16h18z`, class: 'tri' }));
  }
  const lim = svgEl('line', { x1: 10, x2: BW - 6, y1: BY + PX, y2: BY + PX, class: 'lim' });
  const limText = Object.assign(svgEl('text', { x: BW - 8, y: BY + PX - 6, 'text-anchor': 'end', class: 'limt' }), { textContent: 'allowed sag' });
  const base = svgEl('line', { x1: BX0, x2: BX1, y1: BY, y2: BY, class: 'rest' });
  const beam = svgEl('polygon', { class: 'bm' });
  svg.append(supports, base, lim, limText, beam);
  return svg;
}
function showBend() {
  const box = $('bendbody');
  const r = (selected && selected.type === 'beam' && check.beams.find(b => b.id === selected.id)) || check.beams.find(b => b.id === check.worstId);
  if (!r) { box.replaceChildren(el('p', { class: 'muted hintbox', text: 'This design has no beams, so there is nothing to bend. Add a bay in x or z.' })); bendSvg = null; return; }
  const kind = buildingBeamType() === 'cantilever' ? 'cantilever' : 'simply';
  const first = !bendSvg || !box.contains(bendSvg);
  if (first || kind !== bendKind) { bendKind = kind; bendSvg = buildBendSvg(); drawBend(bendTween.value); }
  const chosen = selected && selected.id === r.id;
  const rows = kv([['Deflection', `${fmt(r.deflectionMm)} mm`, '', { key: 'bd', v: r.deflectionMm, f: n => `${fmt(n)} mm` }], ['Allowed (span ÷ 250)', `${fmt(r.limitMm)} mm`], ['Share of limit', `${fmt(r.ratio * 100, 0)}%`]]);
  const chip = statusChip(r.pass ? 'pass' : 'fail');
  box.replaceChildren(el('p', { class: 'muted', text: `${chosen ? 'Selected beam' : 'Worst beam (click a beam to show another)'}: ${componentName(r.id)}` }),
    bendSvg, rows, el('p', { class: 'bendres' }, chip),
    el('p', { class: 'hint', text: `Side view, bending exaggerated: the dashed line is the allowed sag, so a beam that crosses it fails. Real sag is ${fmt(r.deflectionMm)} mm.` }));
  bendRatio = r.ratio; bendTween.to(r.ratio);
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
    kids.push(el('h3', { text: `Selected beam: ${componentName(selected)}` }),
      beamTable(['Material', 'Deflection', 'Result'], Object.entries(cmp).map(([k, v]) => [MATERIALS[k].name, `${fmt(v.deflectionMm)} mm`, v.pass ? 'PASS' : 'FAIL'])));
  } else kids.push(el('p', { class: 'muted', text: 'Select a beam to compare it across materials.' }));
  kids.push(el('p', { class: 'hint', text: 'Why is steel so heavy in total? Steel is about 3 times denser than concrete, and every material here uses the same beam and column section sizes, so the steel building simply weighs more.' }));
  kids.push(el('p', { class: 'hint', text: 'All property, durability and cost values are rounded teaching assumptions, not design data. Slabs are always concrete.' }));
  kids.push(el('ul', { class: 'plist' }, ...Object.entries(cm).map(([k, v]) => el('li', { text: materialMessage(v.passCount, nb, MATERIALS[k].name) }))));
  kids.push(aboutLink('materials'));
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
// params.preset is only a bookmark for the decorative look; it is not a design parameter.
const diffParamsShown = (a, b) => diffParams(a, b).filter(d => d.key !== 'preset');
const currentSummary = () => summarize(building, check);

function setOriginal(name, p) {
  try { original = { name, params: deep(p), ...analyse(p) }; } catch (e) { say('Cannot use that design as original: ' + e.message); return; }
  $('origname').textContent = '(' + name + ')';
  renderCompare();
}

const METRIC_FMT = {
  worstDeflectionMm: v => `${fmt(v)} mm`, passCount: v => fmt(v, 0), failCount: v => fmt(v, 0),
  totalWeightKg: v => `${fmt(v, 0)} kg`, totalCost: inr, daylight: v => fmt(v, 3),
};
const ARROW = { up: '▲', down: '▼', same: '=' };
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
  t.append(tb); return el('div', { class: 'tscroll' }, t);
}
function paramList(diff) {
  if (!diff.length) return el('p', { class: 'muted', text: 'No parameter differs.' });
  const ul = el('ul', { class: 'plist' });
  diff.forEach(d => ul.append(el('li', { text: `${pname(d.key)}: ${pval(d.key, d.from)} → ${pval(d.key, d.to)}` })));
  return ul;
}

function renderCompare() {
  if (!original || !building) return;
  const dc = diffComponents(original.building.components, building.components, { material: false });
  const byMaterial = original.params.material !== params.material;
  viewerA.setModel(original.building, { layer, highlight: dc.original, byMaterial });
  viewerB.setModel(building, { layer, highlight: dc.modified, byMaterial });
  viewerA.fitModels([original.building, building]); viewerB.fitModels([original.building, building]);
  const cl = $('cmplegend'); cl.hidden = !byMaterial; cl.replaceChildren();
  if (byMaterial) for (const k of [original.params.material, params.material]) cl.append(el('span', {}, el('i', { style: `background:${hex(MAT_COLOURS[k])}` }), document.createTextNode(MATERIALS[k].name + (k === original.params.material ? ' (original)' : ' (modified)'))));
  const pd = diffParamsShown(original.building.params, building.params);
  const rows = diffSummaries(original.summary, currentSummary());
  $('cebody').replaceChildren(el('div', { class: 'cols2' },
    el('div', {}, el('h3', { text: `Cause: ${pd.length} parameter${pd.length === 1 ? '' : 's'} changed (old → new)` }), paramList(pd)),
    el('div', {}, el('h3', { text: 'Effect: what moved' }), effectTable(rows, 'Original', 'Modified'))),
    el('p', { class: 'hint', text: 'Daylight indicator = window area / floor area. It is simple arithmetic, not a daylight simulation. Compared against the original shown in section 3.' }));
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
  const pd = diffParamsShown(a.params, b.params);
  box.replaceChildren(el('h3', { text: `Results: ${a.name} vs ${b.name}` }), effectTable(diffSummaries(a.summary, b.summary), a.name, b.name),
    el('h3', { text: `Parameters that differ (${pd.length}), A → B` }), paramList(pd), aboutLink('versions'));
}
function renderSaved() {
  const box = $('vlist');
  if (!saved.length) box.replaceChildren(el('p', { class: 'muted hintbox empty', text: 'No saved designs yet. Type a name above and press Save design to keep the current design. Saved designs are stored on this computer by the app server and survive a restart.' }));
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
  curPreset = presetOf(d.params) || null; refreshers.forEach(f => f()); selected = null; update(); say(`Loaded "${d.name}".`); setQuery('design', d.id);
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

// The chosen preset or saved design lives in the URL (?preset=id or ?design=id) so pages can link to it; replaceState keeps Back clean.
function setQuery(k, v) { const u = new URL(location.href); u.search = ''; u.searchParams.set(k, v); history.replaceState(null, '', u); }
const presetSel = $('preset');
presetSel.append(el('option', { value: '', text: 'Starting design' }));
for (const p of PRESETS) presetSel.append(el('option', { value: p.id, text: p.name + (p.demo ? ' (demo)' : '') + ' - ' + p.tagline }));
function loadPreset(id) {
  const pr = resolvePreset(id); if (!pr) return;
  try {
    const p = validateParams(pr.params); p.preset = pr.id;
    Object.keys(params).forEach(k => delete params[k]); Object.assign(params, deep(p));
  } catch (e) { $('err').textContent = 'Cannot load: ' + e.message; return; }
  curPreset = pr;
  refreshers.forEach(f => f()); selected = null; analysed = false; anType = null; checkedAll = false;
  $('presetblurb').textContent = pr.tagline + ' ' + pr.blurb; presetSel.value = pr.id;
  setQuery('preset', pr.id);
  update();
  if (original) setOriginal(pr.name, pr.params);
}
presetSel.addEventListener('change', () => loadPreset(presetSel.value));

// ---------- before / after slider (role=slider; drag, touch or arrow keys) ----------
const pair = $('pair'), split = $('split');
let splitPct = 50;
function setSplit(v) {
  splitPct = Math.max(0, Math.min(100, Math.round(v * 10) / 10));
  pair.style.setProperty('--p', splitPct + '%');
  split.setAttribute('aria-valuenow', String(Math.round(splitPct)));
  split.setAttribute('aria-valuetext', `${Math.round(splitPct)}% original, ${Math.round(100 - splitPct)}% modified`);
}
split.addEventListener('keydown', e => {
  const step = e.shiftKey ? 10 : 5, k = e.key;
  const next = k === 'ArrowLeft' || k === 'ArrowDown' ? splitPct - step : k === 'ArrowRight' || k === 'ArrowUp' ? splitPct + step
    : k === 'PageDown' ? splitPct - 10 : k === 'PageUp' ? splitPct + 10 : k === 'Home' ? 0 : k === 'End' ? 100 : null;
  if (next === null) return; e.preventDefault(); setSplit(next);
});
const dragTo = e => { const r = pair.getBoundingClientRect(); setSplit((e.clientX - r.left) / r.width * 100); };
split.addEventListener('pointerdown', e => { split.setPointerCapture(e.pointerId); split.classList.add('drag'); split.focus({ preventScroll: true }); dragTo(e); e.preventDefault(); });
split.addEventListener('pointermove', e => { if (split.hasPointerCapture(e.pointerId)) dragTo(e); });
const endDrag = e => { split.classList.remove('drag'); if (split.hasPointerCapture(e.pointerId)) split.releasePointerCapture(e.pointerId); };
split.addEventListener('pointerup', endDrag); split.addEventListener('pointercancel', endDrag);
document.querySelectorAll('#cmpmode button').forEach(b => b.addEventListener('click', () => {
  const slider = b.dataset.mode === 'slider';
  pair.classList.toggle('slider', slider); split.hidden = !slider;
  document.querySelectorAll('#cmpmode button').forEach(x => x.setAttribute('aria-checked', String(x === b)));
  requestAnimationFrame(() => { renderCompare(); });
}));

window.__adt = { loadPreset, setSplit, get splitPct() { return splitPct; }, openAbout, viewerA, viewerB, viewer, params, get building() { return building; }, get check() { return check; }, get arch() { return arch; } };
renderAbout(null);
update();
setOriginal('starting design', building.params);
refreshSaved();
{
  const q = new URLSearchParams(location.search);
  if (q.has('preset')) { const pr = resolvePreset(q.get('preset')); if (pr) loadPreset(pr.id); else { say('Unknown preset in the link; showing the starting design.'); const u = new URL(location.href); u.searchParams.delete('preset'); history.replaceState(null, '', u); } }
  else if (q.has('design')) api('/designs/' + encodeURIComponent(q.get('design'))).then(loadDesign).catch(e => say('Could not open that saved design: ' + e.message));
}

// ---------- narrow screens: secondary cards fold up (desktop: always open) ----------
const narrow = window.matchMedia('(max-width: 900px)');
const FOLDED = ['cmpcard', 'analysis', 'matcard', 'aboutcard', 'versions', 'cause', 'vcompare'];
function applyFolds() {
  document.querySelectorAll('.card > details.fold').forEach(d => {
    d.open = narrow.matches ? !FOLDED.includes(d.parentElement.id) : true;
  });
}
document.querySelectorAll('.card > details.fold > summary').forEach(s => s.addEventListener('click', e => { if (!narrow.matches) e.preventDefault(); }));
narrow.addEventListener('change', applyFolds); applyFolds();
$('jump').addEventListener('click', e => {
  e.preventDefault();
  const d = document.querySelector('#params details'); if (d) d.open = true;
  $('params').scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
  const s = document.querySelector('#params summary'); if (s) s.focus({ preventScroll: true });
});
