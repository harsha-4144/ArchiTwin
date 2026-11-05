import test from 'node:test';
import assert from 'node:assert/strict';
import { componentName, componentNameWithId, openingLines } from '../names.mjs';
import { generateBuilding, DEFAULT_PARAMS } from '../building.mjs';
import * as C from '../calc.mjs';

test('readable names for every component kind', () => {
  assert.equal(componentName('beam-f0-x0-1'), 'Floor 1, east-west beam, bay 1, grid row 2');
  assert.equal(componentName('beam-f1-z2-0'), 'Floor 2, north-south beam, bay 1, grid column 3');
  assert.equal(componentName('slab-f1'), 'Floor 2 slab');
  assert.equal(componentName('roof'), 'Roof');
  assert.equal(componentNameWithId('beam-f0-x0-1'), 'Floor 1, east-west beam, bay 1, grid row 2 [beam-f0-x0-1]');
  const b = generateBuilding({ ...DEFAULT_PARAMS, partitions: true });
  for (const c of b.components) { const n = componentName(c); assert.ok(n && n !== c.id, c.id); assert.ok(!/^(beam|col|wall|slab|part)-/.test(n)); }
});
test('names are unique per component', () => {
  const b = generateBuilding({ ...DEFAULT_PARAMS, floors: 2, bays_x: 3, bays_z: 3, partitions: true });
  assert.equal(new Set(b.components.map(componentName)).size, b.components.length);
});
test('openingLines uses openings data', () => {
  const b = generateBuilding({ ...DEFAULT_PARAMS, doors: { south: 1 }, windows: { south: 2 } });
  const w = b.components.find(c => c.id === 'wall-f0-south');
  const t = openingLines(w).join(' | ');
  assert.match(t, /1 door, each 0\.9 m wide x 2\.1 m high|1 door,/);
  assert.match(t, /2 windows, each/);
  assert.match(t, /Gross area/); assert.match(t, new RegExp(`net area ${Math.round(w.area * 100) / 100}`));
});
test('diffComponents can ignore material and still sees size/position', () => {
  const a = generateBuilding(DEFAULT_PARAMS).components;
  assert.equal(C.diffComponents(a, generateBuilding({ ...DEFAULT_PARAMS, material: 'steel' }).components, { material: false }).modified.size, 0);
  assert.ok(C.diffComponents(a, generateBuilding({ ...DEFAULT_PARAMS, beam_h: 0.5 }).components, { material: false }).modified.size > 0);
  assert.ok(C.diffComponents(a, generateBuilding({ ...DEFAULT_PARAMS, floor_height: 3.5 }).components, { material: false }).modified.size > 0);
});
