// util.mjs - shared display helpers and data access. No engineering maths here (see calc.mjs).
import { generateBuilding } from '../building.mjs';
import { checkAll, summarize } from '../calc.mjs';
import { resolvePreset } from '../presets.mjs';

export const $ = (s, root = document) => root.querySelector(s);
export const el = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) k === 'text' ? e.textContent = v : e.setAttribute(k, v);
  kids.forEach(k => e.append(k)); return e;
};
export const fmt = (v, d = 2) => Number(v).toLocaleString('en-IN', { maximumFractionDigits: d, minimumFractionDigits: d });
export const inr = v => '₹' + Math.round(v).toLocaleString('en-IN');

// Preset slugs accept the old names too (twostorey, small, hall, shed); see presets.mjs.
export const findPreset = resolvePreset;

// Same pipeline the studio uses: params -> building -> beam check -> summary.
export function analyse(params) {
  const building = generateBuilding(params);
  const check = checkAll(building.components, { load: params.load, beamType: building.components.find(c => c.type === 'beam')?.beamType, material: params.material });
  return { building, check, summary: summarize(building, check) };
}

// Saved designs from the API (explicit JSON Accept so content negotiation never returns the page).
export async function fetchDesigns() {
  const r = await fetch('/designs', { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error('The server answered ' + r.status);
  return r.json();
}

export const ROOFS = { flat: 'Flat', shed: 'Shed', gable: 'Gable' };
export const MATNAMES = { timber: 'Timber', steel: 'Steel', concrete: 'Concrete' };
