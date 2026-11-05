// messages.mjs - ALL plain-language wording lives here (no numbers are calculated here).
// Written for a first-year architecture student: say what a number means and what to change.
const mm = v => (Math.round(v * 10) / 10).toLocaleString('en-IN', { maximumFractionDigits: 1 });

export const DEFLECTION_EXPLAINER =
  'Deflection is how far a beam sags under load (in the middle, or at the free end of a cantilever). ' +
  'The limit used here is span/250: the span divided by 250. For example a 5 m (5000 mm) beam may sag 20 mm.';

// r: a beamDeflection result; ctx: { material, type ('simply'|'cantilever') }
export function beamMessage(r, ctx = {}) {
  const d = mm(r.deflectionMm), l = mm(r.limitMm);
  if (r.pass) return `This beam bends ${d} mm; the limit is ${l} mm, so it passes (it uses ${Math.round(r.ratio * 100)}% of the allowed sag).`;
  const tips = ['a deeper beam (increase beam depth h; depth helps much more than width)'];
  if (ctx.material !== 'steel') tips.push('a stiffer material such as steel (stiffer = bends less under the same load)');
  tips.push(ctx.type === 'cantilever' ? 'a shorter overhang, or supports at both ends instead of a cantilever (a beam fixed at one end only, like a balcony)' : 'a shorter span (add a column or reduce the bay span; a bay is one grid cell between four columns)');
  if (tips.length === 3) return `This beam bends ${d} mm; the limit is ${l} mm. Try ${tips[0]}, ${tips[1]}, or ${tips[2]}.`;
  return `This beam bends ${d} mm; the limit is ${l} mm. Try ${tips[0]}, or ${tips[1]}.`;
}

// check: a checkAll result. Returns one sentence for the whole building.
export function buildingMessage(check, ctx = {}) {
  if (!check.beams.length) return 'There are no beams to check.';
  if (!check.failCount) return `All ${check.beams.length} beams stay within the sag limit (span/250).`;
  const w = check.beams.find(b => b.id === check.worstId);
  return `${check.failCount} of ${check.beams.length} beams sag more than the limit (span/250). ` + beamMessage(w, ctx).replace(/^This beam/, 'The worst beam');
}

export function materialMessage(passCount, total, name) {
  return passCount === total ? `In ${name}, all ${total} beams pass the sag limit.`
    : `In ${name}, ${total - passCount} of ${total} beams sag too much. Try a deeper beam or a stiffer material.`;
}

// ---- About this result (card 6) ----
export const ABOUT_STATEMENT = 'Simplified model, no live-data link. Not a structural safety check.';
export const ABOUT = {
  source: ['Stiffness, density and heat conduction are rounded teaching values near typical published ranges (see Sources and assumptions in the README); steel heat conduction is not verified.',
    'Cost and durability are typical teaching values, not verified against any source.',
    'All material numbers are rounded teaching values, so treat them as approximate.'],
  assumptions: [
    ['beam', 'Each beam is a solid rectangle (width b by depth h) of one material.'],
    ['load', 'The load you enter is spread evenly along the beam, in kN/m (kilonewtons of force per metre of beam length).'],
    ['support', 'A beam is either simply supported (rests on a support at each end) or a cantilever (fixed at one end, free at the other).'],
    ['self', 'The beam\'s own weight is included in its load.'],
    ['slab', 'Slabs are fixed: 120 mm concrete. Slab and wall weight is NOT added to the beam load.'],
    ['sizes', 'Columns are 300 x 300 mm and walls are 200 mm thick.'],
    ['limit', 'A beam passes if its sag is no more than span/250.'],
  ],
  limitations: [
    'Only sagging of beams is checked. Strength, column buckling, connections, wind, earthquake and foundations are not.',
    'Daylight indicator is window area divided by floor area; it is not a daylight simulation.',
    'Cost and weight are rough totals from rounded rates, not a quantity survey.',
  ],
  professional: 'Ask a structural engineer for any real building, anything people will use, or any decision about safety, cost or permits.',
  statement: ABOUT_STATEMENT,
};

// Which assumptions matter most for each result card (used to highlight them in card 6).
export const ABOUT_CONTEXT = {
  results: { label: 'Expected Results', ids: ['limit', 'load', 'self', 'slab'] },
  analysis: { label: 'Analysis', ids: ['beam', 'load', 'support', 'self', 'limit'] },
  materials: { label: 'Material Comparison', ids: ['beam', 'self', 'sizes'], source: true },
  cause: { label: 'Cause and Effect', ids: ['limit', 'slab', 'load'] },
  versions: { label: 'Saved version comparison', ids: ['limit', 'load', 'slab'] },
};

// ---- plain-word help (bay, cantilever, stiffer) and the empty-selection hint ----
export const HELP = {
  bay: 'A bay is one rectangular grid cell between four columns.',
  cantilever: 'A cantilever is a beam fixed at one end and free at the other, like a balcony.',
  stiffer: 'Stiffer means it bends less under the same load (steel is stiffer than timber).',
};
export const SELECT_HINT = 'Click any beam, column, slab, wall or the roof in the 3D view to see its size, material, weight and cost.';
