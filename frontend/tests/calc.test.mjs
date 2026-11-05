import test from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../calc.mjs';

const near = (a, b, t = 0.01) => assert.ok(Math.abs(a - b) <= t, `${a} vs ${b}`);
const base = { material: 'concrete', span: 5, b: 0.25, h: 0.35, load: 10, type: 'simply' };

test('A concrete SS = 4.40 mm', () => near(C.beamDeflection(base).deflectionMm, 4.40));
test('B steel SS = 1.64 mm', () => near(C.beamDeflection({ material: 'steel', span: 4, b: 0.1, h: 0.2, load: 5, type: 'simply' }).deflectionMm, 1.64));
test('C timber cantilever = 5.78 mm', () => near(C.beamDeflection({ material: 'timber', span: 2, b: 0.1, h: 0.2, load: 2, type: 'cantilever' }).deflectionMm, 5.78));

test('result fields and limit', () => {
  const r = C.beamDeflection(base);
  assert.equal(r.limitMm, 20);
  near(r.selfWeightKNm, 2400 * 9.81 * 0.25 * 0.35 / 1000, 1e-9);
  near(r.totalKNm, 10 + r.selfWeightKNm, 1e-9);
  assert.equal(r.pass, true);
  near(r.ratio, r.deflectionMm / 20, 1e-12);
});

test('trends', () => {
  const d = o => C.beamDeflection({ ...base, ...o }).deflectionMm;
  assert.ok(d({ span: 6 }) > d({}));
  assert.ok(d({ load: 20 }) > d({}));
  assert.ok(d({ h: 0.45 }) < d({}));
  assert.ok(d({ material: 'steel' }) < d({}));
  assert.ok(d({ material: 'timber' }) > d({}));
  assert.ok(d({ type: 'cantilever' }) > d({}));
});

const comps = [
  { id: 'b1', type: 'beam', material: 'concrete', length: 5, width: 0.25, height: 0.35 },
  { id: 'b2', type: 'beam', material: 'concrete', length: 5, width: 0.1, height: 0.15 },
  { id: 'c1', type: 'column', material: 'concrete', length: 0.3, width: 0.3, height: 3 },
  { id: 's1', type: 'slab', material: 'timber', area: 25, thickness: 0.12 },
  { id: 'w1', type: 'wall', material: 'concrete', length: 5, width: 0.2, height: 3 },
];

test('checkAll flags failing beams', () => {
  const r = C.checkAll(comps, { load: 10 });
  assert.equal(r.beams.length, 2);
  assert.equal(r.passCount, 1);
  assert.equal(r.failCount, 1);
  assert.equal(r.worstId, 'b2');
});

test('totals equal sum of parts; slab always concrete', () => {
  const t = C.buildingTotals(comps);
  const parts = comps.map(c => C.componentWeightCost(c));
  near(t.weightKg, parts.reduce((s, p) => s + p.weightKg, 0), 1e-6);
  near(t.cost, parts.reduce((s, p) => s + p.cost, 0), 1e-6);
  near(parts[3].weightKg, 25 * 0.12 * 2400, 1e-9);
  near(parts[3].weightKN, parts[3].weightKg * 9.81 / 1000, 1e-9);
});

test('compareMaterials and diff', () => {
  const m = C.compareMaterials(comps, { load: 10 });
  assert.ok(m.steel.weightKg > m.timber.weightKg);
  assert.ok(m.steel.cost > m.concrete.cost);
  const a = { check: C.checkAll(comps, { load: 10 }), totals: C.buildingTotals(comps) };
  const b = { check: C.checkAll(comps, { load: 10, material: 'steel' }), totals: C.buildingTotals(comps, 'steel') };
  const d = C.diffResults(a, b);
  assert.equal(d.cost.direction, 'up');
  assert.equal(d.worstDeflectionMm.direction, 'down');
  assert.equal(C.diffResults(a, a).weightKg.direction, 'same');
});

test('bad input throws', () => {
  assert.throws(() => C.beamDeflection({ ...base, b: -1 }));
  assert.throws(() => C.beamDeflection({ ...base, span: 0 }));
  assert.throws(() => C.beamDeflection({ ...base, material: 'wood' }));
  assert.throws(() => C.beamDeflection({ ...base, type: 'fixed' }));
  assert.throws(() => C.beamDeflection({ ...base, load: NaN }));
  assert.throws(() => C.componentWeightCost({ type: 'wall', material: 'steel', length: 1, width: -1, height: 1 }));
});
