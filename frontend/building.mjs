// building.mjs - geometry and counts only (no engineering maths; see calc.mjs).
// Axes: x = east, z = south (north is z=0), y = up. Positions are component centres, metres.
// Floors hidden via floor_visible are omitted from the component list (counts follow visible floors).
import { COLUMN_SIZE_M, SLAB_THICKNESS_M, WALL_THICKNESS_M, SLAB_MATERIAL, MATERIALS, buildingTotals } from './calc.mjs';

export const SIDES = ['north', 'south', 'east', 'west'];
export const DOOR_W = 1.0, DOOR_H = 2.1, ROOF_THICKNESS_M = 0.15, MAX_BEAMS = 48;

export const DEFAULT_PARAMS = Object.freeze({
  floors: 1, bays_x: 2, bays_z: 2, span_x: 4, span_z: 4, floor_height: 3,
  roof_type: 'flat', roof_pitch: 20, material: 'concrete', beam_type: 'simply_supported',
  beam_b: 0.25, beam_h: 0.35, load: 10, walls: true, roof: true, floor_visible: [true, true],
  doors: { north: 0, south: 1, east: 0, west: 0 },
  windows: { north: 1, south: 1, east: 1, west: 1 },
  window_w: 1.2, window_h: 1.2, partitions: false,
});

function int(p, k, lo, hi) {
  const v = p[k];
  if (!Number.isInteger(v) || v < lo || v > hi) throw new Error(`${k} must be an integer ${lo}-${hi}`);
}
function num(p, k, lo, hi) {
  const v = p[k];
  if (typeof v !== 'number' || !Number.isFinite(v) || v < lo || v > hi) throw new Error(`${k} must be a number ${lo}-${hi}`);
}
function bool(p, k) { if (typeof p[k] !== 'boolean') throw new Error(`${k} must be true or false`); }

// Returns normalized params (defaults filled in) or throws on out-of-range values.
export function validateParams(input = {}) {
  const d = DEFAULT_PARAMS;
  const p = { ...d, ...input,
    doors: { ...d.doors, ...(input.doors || {}) },
    windows: { ...d.windows, ...(input.windows || {}) },
    floor_visible: Array.isArray(input.floor_visible) ? input.floor_visible.slice() : d.floor_visible.slice() };
  int(p, 'floors', 1, 2); int(p, 'bays_x', 1, 3); int(p, 'bays_z', 1, 3);
  num(p, 'span_x', 2, 8); num(p, 'span_z', 2, 8); num(p, 'floor_height', 2.5, 4);
  if (!['flat', 'shed', 'gable'].includes(p.roof_type)) throw new Error('roof_type must be flat, shed or gable');
  num(p, 'roof_pitch', 0, 45);
  if (!MATERIALS[p.material]) throw new Error(`Unknown material: ${p.material}`);
  if (!['simply_supported', 'cantilever'].includes(p.beam_type)) throw new Error('beam_type must be simply_supported or cantilever');
  num(p, 'beam_b', 0.05, 1); num(p, 'beam_h', 0.05, 1.5); num(p, 'load', 0, 1000);
  num(p, 'window_w', 0.3, 4); num(p, 'window_h', 0.3, p.floor_height - 0.3);
  for (const k of ['walls', 'roof', 'partitions']) bool(p, k);
  p.floor_visible = [0, 1].map(i => p.floor_visible[i] === undefined ? true : p.floor_visible[i]);
  for (const v of p.floor_visible) if (typeof v !== 'boolean') throw new Error('floor_visible must be booleans');
  const lenOf = s => (s === 'north' || s === 'south') ? p.bays_x * p.span_x : p.bays_z * p.span_z;
  for (const s of SIDES) {
    int(p.doors, s, 0, 4); int(p.windows, s, 0, 8);
    if (p.doors[s] * DOOR_W + p.windows[s] * p.window_w > lenOf(s) - 0.4)
      throw new Error(`doors/windows do not fit on ${s} wall`);
  }
  if (p.floors * (p.bays_x * (p.bays_z + 1) + p.bays_z * (p.bays_x + 1)) > MAX_BEAMS) throw new Error('too many beams');
  return p;
}

export function generateBuilding(input = {}) {
  const p = validateParams(input);
  const H = p.floor_height, TX = p.bays_x * p.span_x, TZ = p.bays_z * p.span_z;
  const beamType = p.beam_type === 'cantilever' ? 'cantilever' : 'simply';
  const wallT = WALL_THICKNESS_M, st = SLAB_THICKNESS_M, cs = COLUMN_SIZE_M;
  const gx = i => i * p.span_x, gz = j => j * p.span_z; // grid line coordinates
  const components = [];
  const add = c => components.push(c);

  for (let f = 0; f < p.floors; f++) {
    if (!p.floor_visible[f]) continue;
    const y0 = f * H;
    for (let i = 0; i <= p.bays_x; i++) for (let j = 0; j <= p.bays_z; j++) {
      add({ id: `col-f${f}-${i}-${j}`, type: 'column', floor: f, material: p.material,
        length: cs, width: cs, height: H,
        position: { x: gx(i), y: y0 + H / 2, z: gz(j) }, size: { sx: cs, sy: H, sz: cs } });
    }
    const by = y0 + H - st - p.beam_h / 2;
    const beamBase = { type: 'beam', floor: f, material: p.material, width: p.beam_b, height: p.beam_h, beamType, load: p.load };
    for (let j = 0; j <= p.bays_z; j++) for (let i = 0; i < p.bays_x; i++) {
      add({ ...beamBase, id: `beam-f${f}-x${i}-${j}`, axis: 'x', length: p.span_x, span: p.span_x,
        position: { x: gx(i) + p.span_x / 2, y: by, z: gz(j) }, size: { sx: p.span_x, sy: p.beam_h, sz: p.beam_b } });
    }
    for (let i = 0; i <= p.bays_x; i++) for (let j = 0; j < p.bays_z; j++) {
      add({ ...beamBase, id: `beam-f${f}-z${i}-${j}`, axis: 'z', length: p.span_z, span: p.span_z,
        position: { x: gx(i), y: by, z: gz(j) + p.span_z / 2 }, size: { sx: p.beam_b, sy: p.beam_h, sz: p.span_z } });
    }
    add({ id: `slab-f${f}`, type: 'slab', floor: f, material: SLAB_MATERIAL, area: TX * TZ, thickness: st,
      position: { x: TX / 2, y: y0 + H - st / 2, z: TZ / 2 }, size: { sx: TX, sy: st, sz: TZ } });

    if (p.walls) {
      for (const s of SIDES) {
        const alongX = s === 'north' || s === 'south';
        const len = alongX ? TX : TZ;
        const nDoor = f === 0 ? p.doors[s] : 0, nWin = p.windows[s];
        const doorArea = nDoor * DOOR_W * DOOR_H, winArea = nWin * p.window_w * p.window_h;
        const gross = len * H;
        const pos = alongX ? { x: TX / 2, y: y0 + H / 2, z: s === 'north' ? 0 : TZ }
                           : { x: s === 'west' ? 0 : TX, y: y0 + H / 2, z: TZ / 2 };
        add({ id: `wall-f${f}-${s}`, type: 'wall', floor: f, material: p.material, side: s,
          length: len, width: wallT, height: H, grossArea: gross, area: gross - doorArea - winArea, thickness: wallT,
          openings: { doors: nDoor, windows: nWin, doorW: DOOR_W, doorH: DOOR_H, windowW: p.window_w, windowH: p.window_h,
            doorArea, windowArea: winArea, sill: Math.min(0.9, H - p.window_h - 0.2) },
          position: pos, size: alongX ? { sx: len, sy: H, sz: wallT } : { sx: wallT, sy: H, sz: len } });
      }
    }
    if (p.partitions) {
      const area = TX * H;
      add({ id: `part-f${f}`, type: 'wall', floor: f, material: p.material, side: 'interior', interior: true,
        length: TX, width: wallT, height: H, grossArea: area, area, thickness: wallT,
        openings: { doors: 0, windows: 0, doorW: DOOR_W, doorH: DOOR_H, windowW: p.window_w, windowH: p.window_h, doorArea: 0, windowArea: 0, sill: 0 },
        position: { x: TX / 2, y: y0 + H / 2, z: TZ / 2 }, size: { sx: TX, sy: H, sz: wallT } });
    }
  }

  const top = p.floors - 1;
  if (p.roof && p.floor_visible[top]) {
    const pitch = p.roof_type === 'flat' ? 0 : p.roof_pitch;
    const rad = pitch * Math.PI / 180;
    const plan = TX * TZ;
    const rise = p.roof_type === 'shed' ? TZ * Math.tan(rad) : p.roof_type === 'gable' ? (TZ / 2) * Math.tan(rad) : 0;
    const yBase = p.floors * H;
    add({ id: 'roof', type: 'roof', floor: top, material: p.material, roofType: p.roof_type, pitch,
      ridgeAxis: 'x', rise, planArea: plan, area: plan / Math.cos(rad), thickness: ROOF_THICKNESS_M,
      position: { x: TX / 2, y: yBase + (p.roof_type === 'flat' ? ROOF_THICKNESS_M / 2 : rise / 2), z: TZ / 2 },
      size: { sx: TX, sy: p.roof_type === 'flat' ? ROOF_THICKNESS_M : rise, sz: TZ } });
  }

  const count = t => components.filter(c => c.type === t).length;
  const counts = { columns: count('column'), beams: count('beam'), slabs: count('slab'), walls: count('wall'), roofs: count('roof') };
  const windowArea = components.reduce((a, c) => a + (c.openings ? c.openings.windowArea : 0), 0);
  const nVis = p.floor_visible.slice(0, p.floors).filter(Boolean).length;
  return {
    params: p, components, counts,
    grid: { bays_x: p.bays_x, bays_z: p.bays_z, xs: Array.from({ length: p.bays_x + 1 }, (_, i) => gx(i)),
      zs: Array.from({ length: p.bays_z + 1 }, (_, j) => gz(j)), totalX: TX, totalZ: TZ, totalHeight: p.floors * H },
    floorArea: TX * TZ * nVis, windowArea,
    totals: buildingTotals(components, p.material),
  };
}
