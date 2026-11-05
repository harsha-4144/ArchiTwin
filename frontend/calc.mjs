// calc.mjs - ALL calculation for the ADT lives here. Pure ES module, no DOM.
// Internal units: metres, newtons, pascals. Outputs: mm, kN/m, kg, kN, INR.
//
// COMPONENT SHAPE (stage 3 building.mjs must produce this):
//   { id: string,
//     type: 'beam'|'column'|'slab'|'wall'|'roof'|'door'|'window'|...,
//     material: 'timber'|'steel'|'concrete',
//     // Box parts (beam, column, wall, ...): metres
//     length, width, height,        // volume = length*width*height
//     // Area parts (slab, roof): area (m2) and thickness (m); volume = area*thickness
//     area, thickness,
//     // Beams only: length = span = bay span; width = b; height = h (section depth)
//     beamType?: 'simply'|'cantilever'  (default 'simply'), load?: kN/m (overrides params.load)
//   }
// Slabs are always concrete (fixed assumption), whatever material is given.
// Durability ratings are ASSUMED teaching values. Costs/properties are rounded assumptions.

export const MATERIALS = {
  timber:   { name: 'Timber',   eGPa: 11,  density: 600,  conductivity: 0.13, costPerM3: 30000,  durability: 'Medium' },
  steel:    { name: 'Steel',    eGPa: 200, density: 7850, conductivity: 50,   costPerM3: 470000, durability: 'High' },
  concrete: { name: 'Concrete', eGPa: 25,  density: 2400, conductivity: 1.4,  costPerM3: 20000,  durability: 'High' },
};
export const DURABILITY_ASSUMED = true;
export const SLAB_THICKNESS_M = 0.12;
export const COLUMN_SIZE_M = 0.3;
export const WALL_THICKNESS_M = 0.2;
export const SLAB_MATERIAL = 'concrete';
export const DEFLECTION_LIMIT_DIVISOR = 250; // limit = L/250
export const G = 9.81;

function mat(key) {
  const m = MATERIALS[key];
  if (!m) throw new Error(`Unknown material: ${key}`);
  return m;
}
function pos(v, name) {
  if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) throw new Error(`${name} must be a positive number`);
  return v;
}
function nonNeg(v, name) {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) throw new Error(`${name} must be a number >= 0`);
  return v;
}

// span, b, h in metres; load (applied) in kN/m.
export function beamDeflection({ material, span, b, h, load, type = 'simply' }) {
  const m = mat(material);
  pos(span, 'span'); pos(b, 'b'); pos(h, 'h'); nonNeg(load, 'load');
  if (type !== 'simply' && type !== 'cantilever') throw new Error(`Unknown beam type: ${type}`);
  const E = m.eGPa * 1e9;
  const I = (b * h ** 3) / 12;
  const selfWeightKNm = (m.density * G * b * h) / 1000;
  const totalKNm = load + selfWeightKNm;
  const w = totalKNm * 1000; // N/m
  const d = type === 'simply'
    ? (5 * w * span ** 4) / (384 * E * I)
    : (w * span ** 4) / (8 * E * I);
  const deflectionMm = d * 1000;
  const limitMm = (span / DEFLECTION_LIMIT_DIVISOR) * 1000;
  return { deflectionMm, limitMm, ratio: deflectionMm / limitMm, pass: deflectionMm <= limitMm, selfWeightKNm, totalKNm };
}

export function componentVolume(c) {
  if (!c || typeof c !== 'object') throw new Error('Bad component');
  if (c.area !== undefined && c.thickness !== undefined) return pos(c.area, 'area') * pos(c.thickness, 'thickness');
  return pos(c.length, 'length') * pos(c.width, 'width') * pos(c.height, 'height');
}

export function componentWeightCost(component, material) {
  const key = component.type === 'slab' ? SLAB_MATERIAL : (material ?? component.material);
  const m = mat(key);
  const volume = componentVolume(component);
  const weightKg = volume * m.density;
  return { volume, material: key, weightKg, weightKN: (weightKg * G) / 1000, cost: volume * m.costPerM3 };
}

// params: { load (kN/m), beamType (default 'simply'), material? (override for all non-slab) }
export function checkAll(components, params = {}) {
  const beams = [];
  for (const c of components) {
    if (c.type !== 'beam') continue;
    const material = params.material ?? c.material;
    const r = beamDeflection({
      material, span: c.span ?? c.length, b: c.width, h: c.height,
      load: c.load ?? params.load ?? 0, type: c.beamType ?? params.beamType ?? 'simply',
    });
    beams.push({ id: c.id, ...r });
  }
  const passCount = beams.filter(r => r.pass).length;
  let worst = null;
  for (const r of beams) if (!worst || r.ratio > worst.ratio) worst = r;
  return {
    beams, passCount, failCount: beams.length - passCount,
    worstDeflectionMm: worst ? worst.deflectionMm : 0, worstId: worst ? worst.id : null,
  };
}

export function buildingTotals(components, material) {
  let weightKg = 0, cost = 0;
  for (const c of components) {
    const r = componentWeightCost(c, material);
    weightKg += r.weightKg; cost += r.cost;
  }
  return { weightKg, weightKN: (weightKg * G) / 1000, cost };
}

export function compareMaterials(components, params = {}) {
  const out = {};
  for (const key of Object.keys(MATERIALS)) {
    const p = { ...params, material: key };
    const t = buildingTotals(components, key);
    const ch = checkAll(components, p);
    out[key] = { weightKg: t.weightKg, weightKN: t.weightKN, cost: t.cost,
      passCount: ch.passCount, failCount: ch.failCount, worstDeflectionMm: ch.worstDeflectionMm };
  }
  return out;
}

function dir(a, b) {
  const eps = 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
  return Math.abs(b - a) <= eps ? 'same' : (b > a ? 'up' : 'down');
}
// Each side: { check: checkAll result, totals: buildingTotals result }
export function diffResults(a, b) {
  const row = (x, y) => ({ from: x, to: y, change: y - x, direction: dir(x, y) });
  return {
    worstDeflectionMm: row(a.check.worstDeflectionMm, b.check.worstDeflectionMm),
    passCount: row(a.check.passCount, b.check.passCount),
    weightKg: row(a.totals.weightKg, b.totals.weightKg),
    cost: row(a.totals.cost, b.totals.cost),
  };
}

// ---- Stage 5 additions ----
export const TYPE_GROUPS = [['column', 'Columns'], ['beam', 'Beams'], ['slab', 'Slabs'], ['wall', 'Walls'], ['roof', 'Roof']];

// Weight and cost per component type; `total` is the sum of the groups (door/window types, if any, go to 'other').
export function totalsByType(components, material) {
  const groups = {};
  for (const [k] of TYPE_GROUPS) groups[k] = { count: 0, weightKg: 0, weightKN: 0, cost: 0 };
  groups.other = { count: 0, weightKg: 0, weightKN: 0, cost: 0 };
  for (const c of components) {
    const r = componentWeightCost(c, material);
    const g = groups[c.type] ?? groups.other;
    g.count++; g.weightKg += r.weightKg; g.cost += r.cost;
  }
  let weightKg = 0, cost = 0;
  for (const g of Object.values(groups)) { g.weightKN = (g.weightKg * G) / 1000; weightKg += g.weightKg; cost += g.cost; }
  return { groups, total: { weightKg, weightKN: (weightKg * G) / 1000, cost } };
}

// One beam (span, b, h in m; load kN/m) in every material.
export function compareBeam({ span, b, h, load, type = 'simply' }) {
  const out = {};
  for (const key of Object.keys(MATERIALS)) out[key] = beamDeflection({ material: key, span, b, h, load, type });
  return out;
}
