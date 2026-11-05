import test from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../calc.mjs';
import { generateBuilding, DEFAULT_PARAMS } from '../building.mjs';

const near = (a, b, t = 1e-6) => assert.ok(Math.abs(a - b) <= t, `${a} vs ${b}`);
// timber, small section, long span, so some beams fail and some pass (shorter z span passes)
const P = { ...DEFAULT_PARAMS, material: 'timber', beam_b: 0.1, beam_h: 0.25, span_x: 8, span_z: 3, bays_x: 2, bays_z: 2, load: 5 };
const bld = generateBuilding(P);
const beams = bld.components.filter(c => c.type === 'beam');

test('check-all failing set equals set of beams where beamDeflection fails', () => {
  const chk = C.checkAll(bld.components, { load: P.load, beamType: beams[0].beamType, material: P.material });
  const expected = beams.filter(b => !C.beamDeflection({ material: P.material, span: b.length, b: b.width, h: b.height, load: P.load, type: b.beamType }).pass).map(b => b.id).sort();
  const got = chk.beams.filter(b => !b.pass).map(b => b.id).sort();
  assert.ok(got.length > 0 && got.length < beams.length, 'mixed pass/fail expected');
  assert.deepEqual(got, expected);
  assert.equal(chk.failCount, expected.length);
  assert.equal(chk.passCount + chk.failCount, beams.length);
});

test('totals equal sum of parts, by type and overall', () => {
  const t = C.totalsByType(bld.components, P.material);
  const parts = bld.components.map(c => C.componentWeightCost(c, P.material));
  near(t.total.weightKg, parts.reduce((s, p) => s + p.weightKg, 0));
  near(t.total.cost, parts.reduce((s, p) => s + p.cost, 0));
  near(Object.values(t.groups).reduce((s, g) => s + g.cost, 0), t.total.cost);
  near(Object.values(t.groups).reduce((s, g) => s + g.weightKg, 0), t.total.weightKg);
  near(t.total.weightKg, bld.totals.weightKg); near(t.total.cost, bld.totals.cost);
  assert.equal(Object.values(t.groups).reduce((s, g) => s + g.count, 0), bld.components.length);
});

test('compareBeam matches beamDeflection per material', () => {
  const r = C.compareBeam({ span: 5, b: 0.25, h: 0.35, load: 10 });
  for (const k of Object.keys(C.MATERIALS)) assert.equal(r[k].deflectionMm, C.beamDeflection({ material: k, span: 5, b: 0.25, h: 0.35, load: 10 }).deflectionMm);
});
