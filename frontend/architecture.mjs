// architecture.mjs - decorative "architecture layer" parts (veranda, chimney, parapet ...), generated from a
// preset's feature list ONLY. These are NOT structural: they are never added to generateBuilding(), so they cannot
// change beam checks, Expected Results totals or the structural counts. Geometry only, no engineering maths.
// Each feature has the same dimension fields as a structural component (length, width, height) so
// componentWeightCost() can give its weight and cost for the component card.
import { validateParams } from './building.mjs';
import { componentWeightCost } from './calc.mjs';

export const DECORATIVE_NOTE = 'Decorative: not in the structural totals or beam checks.';
export const FEATURE_NAMES = ['veranda', 'chimney', 'parapet', 'terrace', 'deck', 'cladding', 'shutters', 'porch', 'canopy', 'portal', 'steps', 'pergola'];

export function generateArchitecture(params, building, presetFeatures = []) {
  const p = (building && building.params) || validateParams(params);
  const TX = p.bays_x * p.span_x, TZ = p.bays_z * p.span_z, H = p.floor_height;
  const top = p.floors * H;
  const roof = building && building.components.find(c => c.type === 'roof');
  const rise = roof ? roof.rise : 0;
  const out = [];
  const count = {};
  const add = (kind, label, mat, role, [cx, cy, cz], [sx, sy, sz], extra = {}) => {
    count[kind] = (count[kind] || 0) + 1;
    const n = extra.suffix ? '-' + extra.suffix : '-' + count[kind];
    const prism = extra.shape === 'prism';
    out.push({ id: `feat-${kind}${n}`, type: 'feature', kind, name: label, floor: extra.floor ?? 0, material: mat, role,
      decorative: true, length: sx, width: sz, height: prism ? sy / 2 : sy,
      position: { x: cx, y: cy, z: cz }, size: { sx, sy, sz },
      ...(extra.shape ? { shape: extra.shape } : {}), ...(extra.rotX ? { rotX: extra.rotX } : {}), ...(extra.opacity ? { opacity: extra.opacity } : {}) });
  };
  // x of opening k (doors first, then windows) along the south wall of a floor
  const southSlot = (f, k) => { const n = (f === 0 ? p.doors.south : 0) + p.windows.south; return (k + 0.5) * TX / n; };
  const sill = Math.min(0.9, H - p.window_h - 0.2);

  const gen = {
    veranda() {
      const d = 1.8, ph = Math.min(2.7, H - 0.1), nP = Math.max(2, Math.round(TX / 2.5) + 1);
      add('deck', 'Veranda floor', 'timber', 'trim', [TX / 2, 0.05, TZ + d / 2], [TX, 0.1, d], { suffix: 'veranda-floor' });
      for (let i = 0; i < nP; i++) add('veranda-post', `Veranda post ${i + 1} of ${nP}`, 'timber', 'accent', [i * TX / (nP - 1), ph / 2, TZ + d - 0.1], [0.1, ph, 0.1], { suffix: String(i + 1) });
      const sz = d + 0.3;
      add('veranda-roof', 'Veranda roof', 'timber', 'roof', [TX / 2, ph + 0.05, TZ - 0.1 + sz / 2], [TX + 0.4, 0.1, sz], { rotX: 0.1 });
    },
    chimney() {
      const z = TZ * 0.3, x = TX * 0.72;
      const rz = roof ? (roof.roofType === 'gable' ? rise * (1 - Math.abs(z - TZ / 2) / (TZ / 2)) : roof.roofType === 'shed' ? rise * z / TZ : 0) : 0;
      const topY = top + Math.max(rz + 0.7, rise + 0.5), y0 = top - 0.2;
      add('chimney', 'Chimney', 'concrete', 'brick', [x, (y0 + topY) / 2, z], [0.7, topY - y0, 0.7]);
    },
    parapet() {
      const y = top + 0.15 + 0.25, h = 0.5, t = 0.2;
      add('parapet', 'Parapet, north', 'concrete', 'trim', [TX / 2, y, 0], [TX + t, h, t], { suffix: 'north' });
      add('parapet', 'Parapet, south', 'concrete', 'trim', [TX / 2, y, TZ], [TX + t, h, t], { suffix: 'south' });
      add('parapet', 'Parapet, west', 'concrete', 'trim', [0, y, TZ / 2], [t, h, TZ - t], { suffix: 'west' });
      add('parapet', 'Parapet, east', 'concrete', 'trim', [TX, y, TZ / 2], [t, h, TZ - t], { suffix: 'east' });
    },
    terrace() {
      const base = top + 0.15, x0 = 1, x1 = TX - 1, z0 = TZ * 0.42, z1 = TZ - 0.9, w = x1 - x0, d = z1 - z0;
      add('terrace', 'Roof terrace deck', 'timber', 'accent', [(x0 + x1) / 2, base + 0.03, (z0 + z1) / 2], [w, 0.06, d], { suffix: 'deck' });
      const rh = 0.95, ry = base + rh / 2, rt = 0.05, g = { opacity: 0.5 };
      add('railing', 'Terrace railing, north', 'steel', 'glass', [(x0 + x1) / 2, ry, z0], [w, rh, rt], { suffix: 'north', ...g });
      add('railing', 'Terrace railing, south', 'steel', 'glass', [(x0 + x1) / 2, ry, z1], [w, rh, rt], { suffix: 'south', ...g });
      add('railing', 'Terrace railing, west', 'steel', 'glass', [x0, ry, (z0 + z1) / 2], [rt, rh, d], { suffix: 'west', ...g });
      add('railing', 'Terrace railing, east', 'steel', 'glass', [x1, ry, (z0 + z1) / 2], [rt, rh, d], { suffix: 'east', ...g });
      add('terrace', 'Roof stair-head', 'concrete', 'trim', [1.9, base + 1.1, TZ * 0.2], [1.6, 2.2, 1.6], { suffix: 'stairhead' });
    },
    deck() {
      const dw = 2.4, ty = 0.45, tz = TZ, cx = TX + dw / 2 - 0.1;
      add('deck', 'Side deck', 'timber', 'accent', [cx, ty - 0.06, TZ / 2], [dw, 0.12, tz], { suffix: 'side' });
      for (const [sz, n] of [[0.3, 'north'], [TZ - 0.3, 'south']])
        add('deck-post', `Deck post, ${n}`, 'timber', 'trim', [TX + dw - 0.3, (ty - 0.12) / 2, sz], [0.15, ty - 0.12, 0.15], { suffix: n });
      const ry = ty + 0.45;
      add('railing', 'Deck railing, outer', 'timber', 'trim', [TX + dw - 0.1, ry, TZ / 2], [0.06, 0.9, tz], { suffix: 'outer' });
      add('railing', 'Deck railing, north', 'timber', 'trim', [cx, ry, 0.03], [dw, 0.9, 0.06], { suffix: 'north' });
      add('railing', 'Deck railing, south', 'timber', 'trim', [cx, ry, TZ - 0.03], [dw, 0.9, 0.06], { suffix: 'south' });
    },
    cladding() {
      const ch = H * 0.62, t = 0.015, off = 0.1 + t / 2;
      const walls = { south: [[TX / 2, ch / 2, TZ + off], [TX, ch, t]], north: [[TX / 2, ch / 2, -off], [TX, ch, t]],
        east: [[TX + off, ch / 2, TZ / 2], [t, ch, TZ]], west: [[-off, ch / 2, TZ / 2], [t, ch, TZ]] };
      for (const [s, [pos, size]] of Object.entries(walls)) add('cladding', `Timber cladding, ${s} wall`, 'timber', 'accent', pos, size, { suffix: s });
    },
    shutters() {
      const w = p.window_w, wh = p.window_h, sw = 0.4;
      for (let f = 0; f < p.floors; f++) for (let k = 0; k < p.windows.south; k++) {
        const cx = southSlot(f, (f === 0 ? p.doors.south : 0) + k), cy = f * H + sill + wh / 2;
        for (const [sd, dx] of [['left', -1], ['right', 1]])
          add('shutter', `Shutter, floor ${f + 1}, window ${k + 1}, ${sd}`, 'timber', 'accent', [cx + dx * (w / 2 + sw / 2 + 0.03), cy, TZ + 0.13], [sw, wh, 0.05], { floor: f, suffix: `f${f}-w${k + 1}-${sd[0]}` });
      }
    },
    porch() {
      if (!p.doors.south) return;
      const cx = southSlot(0, 0), pw = 2.6, pd = 1.6, ph = Math.min(2.6, H - 0.4);
      add('porch', 'Porch floor', 'concrete', 'trim', [cx, 0.1, TZ + pd / 2], [pw, 0.2, pd], { suffix: 'floor' });
      for (const [s, dx] of [['left', -1], ['right', 1]])
        add('porch-post', `Porch post, ${s}`, 'timber', 'trim', [cx + dx * (pw / 2 - 0.15), 0.2 + ph / 2, TZ + pd - 0.15], [0.12, ph, 0.12], { suffix: s[0] });
      add('porch-roof', 'Porch gable roof', 'timber', 'roof', [cx, 0.2 + ph + 0.45, TZ + pd / 2 - 0.1], [pw + 0.3, 0.9, pd + 0.2], { shape: 'prism' });
    },
    canopy() {
      if (!p.doors.south) return;
      const cx = southSlot(0, 0), cy = Math.min(H - 0.5, 3.2), cw = 4.2, cd = 2.6;
      add('canopy', 'Entrance canopy', 'steel', 'accent', [cx, cy + 0.075, TZ + cd / 2 - 0.1], [cw, 0.15, cd]);
      for (const [s, dx] of [['left', -1], ['right', 1]])
        add('canopy-post', `Canopy support, ${s}`, 'steel', 'trim', [cx + dx * (cw / 2 - 0.2), cy / 2, TZ + cd - 0.3], [0.14, cy, 0.14], { suffix: s[0] });
    },
    portal() {
      if (!p.doors.south) return;
      const cx = southSlot(0, 0), ph = Math.min(3.0, H - 0.4);
      add('portal', 'Large entrance surround', 'steel', 'trim', [cx, ph / 2, TZ + 0.1], [2.8, ph, 0.04]);
    },
    steps() {
      if (!p.doors.south) return;
      const cx = southSlot(0, 0);
      add('steps', 'Entrance step, lower', 'concrete', 'trim', [cx, 0.06, TZ + 0.65], [2.2, 0.12, 1.0], { suffix: 'lower' });
      add('steps', 'Entrance step, upper', 'concrete', 'trim', [cx, 0.14, TZ + 0.35], [1.8, 0.28, 0.5], { suffix: 'upper' });
    },
    pergola() {
      const d = 2.6, ph = Math.min(2.6, H - 0.1), x0 = 0.3, x1 = TX - 0.3, n = Math.max(4, Math.round(TX / 1.2));
      for (const [s, x] of [['west', x0], ['east', x1]]) add('pergola-post', `Pergola post, ${s}`, 'timber', 'accent', [x, ph / 2, TZ + d - 0.1], [0.12, ph, 0.12], { suffix: s });
      add('pergola-beam', 'Pergola front beam', 'timber', 'accent', [TX / 2, ph + 0.05, TZ + d - 0.1], [TX - 0.2, 0.16, 0.14], { suffix: 'front' });
      for (let i = 0; i < n; i++) add('pergola-beam', `Pergola rafter ${i + 1} of ${n}`, 'timber', 'accent', [x0 + i * (x1 - x0) / (n - 1), ph + 0.12, TZ + d / 2 - 0.1], [0.08, 0.1, d], { suffix: 'r' + (i + 1) });
    },
  };

  for (const f of presetFeatures || []) {
    const name = typeof f === 'string' ? f : f && f.kind;
    if (!gen[name]) throw new Error(`Unknown architecture feature: ${name}`);
    gen[name]();
  }
  return out;
}

// Weight and cost of the decorative parts, kept apart from the structural totals (display only).
export function featureTotals(features) {
  let weightKg = 0, cost = 0;
  for (const f of features) { const r = componentWeightCost(f, f.material); weightKg += r.weightKg; cost += r.cost; }
  return { count: features.length, weightKg, cost };
}
