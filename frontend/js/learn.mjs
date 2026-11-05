// learn.mjs - worked example (numbers from calc.mjs), searchable glossary, assumptions (from messages.mjs).
import { MATERIALS, beamDeflection } from '../calc.mjs';
import { DEFLECTION_EXPLAINER, ABOUT } from '../messages.mjs';
import { $, el, fmt } from './util.mjs';
import { statusChip } from './icons.mjs';
import { initReveal } from './reveal.mjs';

$('#explainer').textContent = DEFLECTION_EXPLAINER;

// Worked example: a 5 m timber floor beam, then two fixes.
const base = { material: 'timber', span: 5, b: 0.2, h: 0.3, load: 12 };
const cases = [['Your beam', base], ['Make it deeper (h = 0.5 m)', { ...base, h: 0.5 }], ['Switch to steel', { ...base, material: 'steel' }]];
const rows = cases.map(([label, c]) => ({ label, c, r: beamDeflection(c) }));
const b0 = rows[0];
$('#worked').replaceChildren(
  el('p', { text: `A timber beam spans ${base.span} m. Its section is ${base.b} m wide and ${base.h} m deep, and it carries ${base.load} kN/m. It is simply supported.` }),
  el('ol', { class: 'steps-list' },
    el('li', { text: `Stiffness: timber has E = ${MATERIALS.timber.eGPa} GPa. The section's I comes from the first formula above.` }),
    el('li', { text: `Self weight: the beam adds ${fmt(b0.r.selfWeightKNm)} kN/m, so the total load w is ${fmt(b0.r.totalKNm)} kN/m.` }),
    el('li', { text: `Sag: the simply supported formula gives ${fmt(b0.r.deflectionMm)} mm.` }),
    el('li', { text: `Limit: ${base.span} m ÷ 250 = ${fmt(b0.r.limitMm)} mm. The beam uses ${fmt(b0.r.ratio * 100, 0)}% of what is allowed, so it ${b0.r.pass ? 'passes' : 'fails'}.` })),
  el('div', { class: 'tablewrap', tabindex: '0', role: 'region', 'aria-label': 'Worked example results' }, el('table', { class: 'data' },
    el('caption', { text: 'The same beam with two fixes' }),
    el('thead', {}, el('tr', {}, ...['Case', 'Sag', 'Allowed', 'Share of limit', 'Result'].map((t, i) => el('th', { scope: 'col', class: i > 0 && i < 4 ? 'num' : '', text: t })))),
    el('tbody', {}, ...rows.map(({ label, r }) => el('tr', {}, el('th', { scope: 'row', text: label }), el('td', { class: 'num', text: fmt(r.deflectionMm) + ' mm' }), el('td', { class: 'num', text: fmt(r.limitMm) + ' mm' }),
      el('td', { class: 'num', text: fmt(r.ratio * 100, 0) + '%' }), el('td', {}, statusChip(r.pass ? 'pass' : 'fail'))))))),
  el('p', { class: 'worked-note', text: 'Depth works because it is cubed in I. Steel works because its E is much larger than timber. Try both in the studio.' }),
  el('p', {}, el('a', { href: '/studio?preset=two-storey', text: 'Try these fixes in the studio' })));

// Glossary
const TERMS = [
  ['Bay', 'One rectangular grid cell between four columns. A building with 2 bays in x and 1 in z has two cells side by side.'],
  ['Beam', 'A horizontal member that carries load across a gap to its supports.'],
  ['Cantilever', 'A beam fixed at one end and free at the other, like a balcony. It sags more than a supported beam of the same size.'],
  ['Column', 'A vertical member that carries loads down to the ground.'],
  ['Deflection', 'How far a beam sags under load, in millimetres. ArchiTwin compares it with the limit span/250.'],
  ['kN/m', 'Kilonewtons per metre: force spread along each metre of beam. A typical floor is about 5 to 15 kN/m.'],
  ['Load', 'The force a member must carry: people, furniture, and its own weight.'],
  ['Simply supported', 'A beam resting on a support at each end, free to turn there.'],
  ['Slab', 'A flat floor or roof plate. In ArchiTwin slabs are always 120 mm concrete.'],
  ['Span', 'The distance a beam crosses between its supports.'],
  ['Stiffer', 'Bends less under the same load. Steel is stiffer than concrete, and concrete is stiffer than timber.'],
];
const list = $('#gl-list');
list.replaceChildren(...TERMS.map(([t, d]) => el('div', { class: 'term' }, el('dt', { text: t }), el('dd', { text: d }))));
function filter() {
  const q = $('#gl-q').value.trim().toLowerCase(); let n = 0;
  [...list.children].forEach((row, i) => { const hit = !q || (TERMS[i][0] + ' ' + TERMS[i][1]).toLowerCase().includes(q); row.hidden = !hit; if (hit) n++; });
  $('#gl-count').textContent = n === 0 ? `No terms match "${$('#gl-q').value.trim()}". Try a shorter word.` : `${n} of ${TERMS.length} terms`;
}
$('#gl-q').addEventListener('input', filter); filter();

// Assumptions (same text the studio shows in About this result)
const ul = items => el('ul', {}, ...items.map(i => el('li', { text: i })));
$('#assume').replaceChildren(
  el('h3', { text: 'What the model assumes' }), ul(ABOUT.assumptions.map(a => a[1])),
  el('h3', { text: 'What it does not check' }), ul(ABOUT.limitations),
  el('h3', { text: 'Where the numbers come from' }), ul(ABOUT.source),
  el('p', { text: ABOUT.professional }), el('p', { class: 'flag-line', text: ABOUT.statement }));
initReveal();
