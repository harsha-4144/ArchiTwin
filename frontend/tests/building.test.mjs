import test from 'node:test';
import assert from 'node:assert/strict';
import { generateBuilding, validateParams, DEFAULT_PARAMS } from '../building.mjs';
import { componentWeightCost, buildingTotals } from '../calc.mjs';

const sets = [
  { floors: 1, bays_x: 1, bays_z: 1 },
  { floors: 2, bays_x: 3, bays_z: 3 },
  { floors: 1, bays_x: 3, bays_z: 2, span_x: 6, roof_type: 'gable' },
  { floors: 2, bays_x: 2, bays_z: 1, span_z: 7, roof_type: 'shed', partitions: true },
  { floors: 2, bays_x: 1, bays_z: 3, floor_height: 3.5, material: 'steel', beam_type: 'cantilever' },
];

for (const [n, s] of sets.entries()) {
  test(`counts match formulas, set ${n + 1}`, () => {
    const b = generateBuilding(s), p = b.params, f = p.floors, bx = p.bays_x, bz = p.bays_z;
    assert.equal(b.counts.columns, f * (bx + 1) * (bz + 1));
    assert.equal(b.counts.beams, f * (bx * (bz + 1) + bz * (bx + 1)));
    assert.ok(b.counts.beams <= 48);
    assert.equal(b.counts.slabs, f);
    assert.equal(b.counts.walls, f * 4 + (p.partitions ? f : 0));
    assert.equal(b.counts.roofs, 1);
    assert.equal(b.floorArea, f * bx * p.span_x * bz * p.span_z);
    const sum = b.components.reduce((a, c) => a + componentWeightCost(c, p.material).weightKg, 0);
    assert.ok(Math.abs(sum - buildingTotals(b.components, p.material).weightKg) < 1e-6);
    assert.ok(Math.abs(b.totals.weightKg - sum) < 1e-6);
  });
}

test('defaults', () => {
  const b = generateBuilding();
  assert.deepEqual(b.params.doors, DEFAULT_PARAMS.doors);
  assert.equal(b.counts.columns, 9); assert.equal(b.counts.beams, 12);
  assert.equal(b.components.find(c => c.type === 'beam').beamType, 'simply');
});
test('cantilever maps to calc name', () => {
  assert.equal(generateBuilding({ beam_type: 'cantilever' }).components.find(c => c.type === 'beam').beamType, 'cantilever');
});
test('toggles', () => {
  const b = generateBuilding({ floors: 2, walls: false, roof: false, floor_visible: [true, false] });
  assert.equal(b.counts.walls, 0); assert.equal(b.counts.roofs, 0); assert.equal(b.counts.slabs, 1);
});
test('wall openings and roof area', () => {
  const b = generateBuilding({ roof_type: 'gable', roof_pitch: 30 });
  const w = b.components.find(c => c.id === 'wall-f0-south');
  assert.ok(Math.abs(w.area - (8 * 3 - 2.1 - 1.44)) < 1e-9);
  assert.equal(w.thickness, 0.2);
  const r = b.components.find(c => c.type === 'roof');
  assert.ok(Math.abs(r.area - 64 / Math.cos(Math.PI / 6)) < 1e-9);
  assert.equal(generateBuilding({ roof_type: 'flat', roof_pitch: 30 }).components.find(c => c.type === 'roof').area, 64);
  assert.equal(b.windowArea, 4 * 1.44);
});
test('out-of-range rejected', () => {
  for (const bad of [{ floors: 3 }, { bays_x: 4 }, { bays_z: 0 }, { span_x: 1.9 }, { span_z: 8.1 }, { floor_height: 2.4 },
    { floor_height: 4.1 }, { roof_type: 'dome' }, { roof_pitch: 60 }, { material: 'wood' }, { beam_type: 'x' },
    { doors: { north: 9 } }, { windows: { east: 8 }, window_w: 4 }, { walls: 'yes' }])
    assert.throws(() => validateParams(bad), undefined, JSON.stringify(bad));
});
test('deterministic', () => {
  assert.deepEqual(generateBuilding(sets[3]), generateBuilding(sets[3]));
});
test('ids unique', () => {
  for (const s of sets) {
    const ids = generateBuilding(s).components.map(c => c.id);
    assert.equal(new Set(ids).size, ids.length);
  }
});
