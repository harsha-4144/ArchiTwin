import test from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../calc.mjs';
import { generateBuilding, DEFAULT_PARAMS } from '../building.mjs';

const near = (a, b, t = 1e-9) => assert.ok(Math.abs(a - b) <= t, `${a} vs ${b}`);
const sum = p => { const b = generateBuilding(p); return { b, s: C.summarize(b, C.checkAll(b.components, { load: p.load, beamType: 'simply', material: p.material })) }; };

test('daylight indicator is window area / floor area', () => {
  near(C.daylightIndicator(4, 20), 0.2);
  assert.equal(C.daylightIndicator(0, 20), 0);
  assert.equal(C.daylightIndicator(3, 0), 0);
  assert.throws(() => C.daylightIndicator(-1, 10));
});
test('default building daylight matches hand arithmetic', () => {
  // 4 windows of 1.2 x 1.2 = 5.76 m2; floor 8 x 8 = 64 m2
  const { s } = sum(DEFAULT_PARAMS);
  near(s.daylight, 5.76 / 64, 1e-9);
});
test('diffParams lists every changed value, nested too', () => {
  const a = { ...DEFAULT_PARAMS };
  const b = { ...DEFAULT_PARAMS, floors: 2, material: 'timber', windows: { ...a.windows, north: 3 }, floor_visible: [true, false] };
  const d = C.diffParams(a, b);
  assert.deepEqual(d.map(x => x.key).sort(), ['floor_visible[1]', 'floors', 'material', 'windows.north']);
  assert.deepEqual(d.find(x => x.key === 'floors'), { key: 'floors', from: 1, to: 2 });
  assert.equal(C.diffParams(a, { ...a }).length, 0);
});
test('diffSummaries gives direction and words', () => {
  const a = sum(DEFAULT_PARAMS).s, b = sum({ ...DEFAULT_PARAMS, material: 'steel', windows: { ...DEFAULT_PARAMS.windows, north: 3 } }).s;
  const rows = C.diffSummaries(a, b), r = k => rows.find(x => x.key === k);
  assert.equal(r('totalWeightKg').direction, 'up'); assert.equal(r('totalWeightKg').word, 'higher');
  assert.equal(r('totalCost').direction, 'up');
  assert.equal(r('worstDeflectionMm').direction, 'down'); assert.equal(r('worstDeflectionMm').word, 'lower');
  assert.equal(r('daylight').direction, 'up');
  near(r('daylight').change, b.daylight - a.daylight);
  assert.ok(C.diffSummaries(a, a).every(x => x.direction === 'same' && x.word === 'same'));
});
test('diffComponents flags changed size, material and count', () => {
  const a = generateBuilding(DEFAULT_PARAMS), same = C.diffComponents(a.components, generateBuilding(DEFAULT_PARAMS).components);
  assert.equal(same.original.size + same.modified.size, 0);
  const bh = C.diffComponents(a.components, generateBuilding({ ...DEFAULT_PARAMS, beam_h: 0.5 }).components);
  const nBeams = a.components.filter(c => c.type === 'beam').length;
  assert.equal(bh.modified.size, nBeams);
  assert.ok([...bh.modified].every(id => id.startsWith('beam-')));
  const fl = C.diffComponents(a.components, generateBuilding({ ...DEFAULT_PARAMS, floors: 2 }).components);
  assert.ok([...fl.original].every(id => id === 'roof')); /* roof moves up: a position change */ assert.ok(fl.modified.size > 0 && [...fl.modified].some(id => id.startsWith('col-f1')));
  const m = C.diffComponents(a.components, generateBuilding({ ...DEFAULT_PARAMS, material: 'steel' }).components);
  assert.ok(m.modified.size > 0 && !m.modified.has('slab-f0'));
});
