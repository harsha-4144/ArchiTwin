import test from 'node:test';
import assert from 'node:assert/strict';
import { PRESETS, resolvePreset } from '../presets.mjs';
import { validateParams, generateBuilding } from '../building.mjs';
import { checkAll, componentWeightCost } from '../calc.mjs';
import { generateArchitecture, featureTotals, FEATURE_NAMES } from '../architecture.mjs';
import { componentName } from '../names.mjs';

const check = (b, p) => checkAll(b.components, { load: p.load, beamType: 'simply', material: p.material });

test('each preset is valid, runs checkAll and has features', () => {
  for (const pr of PRESETS) {
    assert.doesNotThrow(() => validateParams(pr.params), pr.id);
    const b = generateBuilding(pr.params);
    assert.ok(check(b, pr.params).beams.length > 0, pr.id);
    assert.ok(Array.isArray(pr.features) && pr.features.length >= 2, pr.id);
    assert.ok(pr.features.every(f => FEATURE_NAMES.includes(f)), pr.id);
    assert.match(pr.id, /^[a-z]+(-[a-z]+)*$/);
    assert.ok(pr.tagline && pr.palette && ['wall', 'trim', 'roof', 'accent'].every(k => /^#[0-9a-f]{6}$/i.test(pr.palette[k])), pr.id);
    const f = generateArchitecture(pr.params, b, pr.features);
    assert.ok(f.length >= 5, pr.id);
    assert.equal(new Set(f.map(x => x.id)).size, f.length, 'unique ids ' + pr.id);
    for (const c of f) {
      assert.equal(c.type, 'feature'); assert.ok(c.kind && c.decorative && c.name && c.floor >= 0);
      assert.ok(c.size.sx > 0 && c.size.sy > 0 && c.size.sz > 0);
      const r = componentWeightCost(c, c.material);
      assert.ok(r.weightKg > 0 && r.cost > 0, c.id);
      assert.ok(componentName(c).includes(c.name));
    }
  }
});

test('feature lists, palettes, roofs and materials differ between presets', () => {
  assert.equal(new Set(PRESETS.map(p => JSON.stringify(p.features))).size, 6);
  assert.equal(new Set(PRESETS.map(p => p.id)).size, 6);
  assert.equal(new Set(PRESETS.map(p => p.palette.wall + p.palette.roof)).size, 6);
  const kinds = PRESETS.map(p => new Set(generateArchitecture(p.params, generateBuilding(p.params), p.features).map(c => c.kind)));
  kinds.forEach((k, i) => assert.ok([...k].some(x => kinds.filter((o, j) => j !== i && o.has(x)).length === 0), 'unique kind in ' + PRESETS[i].id));
  assert.throws(() => generateArchitecture(PRESETS[0].params, generateBuilding(PRESETS[0].params), ['nonsense']), /Unknown/);
});

test('features never touch structural counts, checkAll or totals', () => {
  for (const pr of PRESETS) {
    const p = pr.params, b1 = generateBuilding(p), before = JSON.stringify([b1.counts, b1.totals, b1.components, check(b1, p)]);
    const f = generateArchitecture(p, b1, pr.features);
    assert.equal(JSON.stringify([b1.counts, b1.totals, b1.components, check(b1, p)]), before, 'generation must not mutate ' + pr.id);
    const b2 = generateBuilding(p);
    assert.equal(JSON.stringify([b2.counts, b2.totals, b2.components, check(b2, p)]), before);
    assert.ok(!b2.components.some(c => c.type === 'feature'));
    assert.ok(f.every(c => !b1.components.includes(c)));
    const tot = featureTotals(f);
    assert.equal(tot.count, f.length); assert.ok(tot.weightKg > 0 && tot.cost > 0);
  }
});

test('generateBuilding counts for the six presets follow the protected formulas', () => {
  for (const pr of PRESETS) {
    const { floors: F, bays_x: X, bays_z: Z } = pr.params, c = generateBuilding(pr.params).counts;
    assert.deepEqual(c, { columns: F * (X + 1) * (Z + 1), beams: F * (X * (Z + 1) + Z * (X + 1)), slabs: F, walls: 4 * F, roofs: 1 }, pr.id);
    assert.ok(pr.params.floors <= 2 && X <= 3 && Z <= 3);
  }
});

test('demo design: at least a third of beams fail, fixed by beam_h 0.45 or steel', () => {
  const demo = PRESETS.find(p => p.demo), run = q => { const p = { ...demo.params, ...q }; return check(generateBuilding(p), p); };
  const c = run({});
  assert.ok(c.failCount / c.beams.length >= 1 / 3, `${c.failCount} of ${c.beams.length}`);
  assert.equal(run({ beam_h: 0.45 }).failCount, 0);
  assert.equal(run({ material: 'steel' }).failCount, 0);
});

test('old preset slugs map to the nearest new house', () => {
  assert.equal(resolvePreset('twostorey').id, 'twin-gable');
  assert.equal(resolvePreset('two-storey').id, 'twin-gable');
  assert.equal(resolvePreset('small').id, 'sunrise-cottage');
  assert.equal(resolvePreset('hall').id, 'community-hall');
  assert.equal(resolvePreset('shed').id, 'garden-studio');
  for (const p of PRESETS) assert.equal(resolvePreset(p.id), p);
  assert.equal(resolvePreset('nope'), undefined);
});
