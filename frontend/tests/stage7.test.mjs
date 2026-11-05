import test from 'node:test';
import assert from 'node:assert/strict';
import { PRESETS } from '../presets.mjs';
import { validateParams, generateBuilding } from '../building.mjs';
import { checkAll, beamDeflection } from '../calc.mjs';
import { beamMessage, buildingMessage, ABOUT, ABOUT_CONTEXT, ABOUT_STATEMENT } from '../messages.mjs';

const run = p => { const b = generateBuilding(p.params); return { b, c: checkAll(b.components, { load: p.params.load, beamType: 'simply', material: p.params.material }) }; };

test('four presets, distinct, all valid and run checkAll', () => {
  assert.equal(PRESETS.length, 4);
  assert.deepEqual(PRESETS.map(p => p.name.split(' (')[0]), ['Small house', 'Two-storey house', 'Hall', 'Shed']);
  assert.equal(new Set(PRESETS.map(p => JSON.stringify(p.params))).size, 4);
  assert.ok(new Set(PRESETS.map(p => p.params.roof_type)).size >= 3);
  assert.ok(new Set(PRESETS.map(p => p.params.material)).size >= 3);
  for (const p of PRESETS) {
    assert.doesNotThrow(() => validateParams(p.params), p.id);
    const { b, c } = run(p);
    assert.ok(b.components.length > 0 && c.beams.length > 0, p.id);
  }
});
test('demo preset has failing beams that go green when deeper or steel', () => {
  const demo = PRESETS.find(p => p.demo);
  assert.equal(demo.id, 'twostorey');
  const { c } = run(demo);
  assert.ok(c.failCount > 0);
  const deeper = run({ params: { ...demo.params, beam_h: 0.5 } });
  assert.equal(deeper.c.failCount, 0);
  const steel = run({ params: { ...demo.params, material: 'steel' } });
  assert.equal(steel.c.failCount, 0);
});
test('failing beam message says what to change', () => {
  const r = beamDeflection({ material: 'timber', span: 5, b: 0.2, h: 0.3, load: 12 });
  assert.ok(!r.pass);
  const m = beamMessage(r, { material: 'timber', type: 'simply' });
  assert.match(m, /bends \d/); assert.match(m, /the limit is/);
  assert.match(m, /deeper beam/); assert.match(m, /steel/); assert.match(m, /shorter span/);
  const ms = beamMessage({ ...r, pass: false }, { material: 'steel', type: 'cantilever' });
  assert.ok(!/stiffer material/.test(ms) && /cantilever/.test(ms));
  assert.match(beamMessage({ ...r, pass: true, ratio: 0.5 }), /passes/);
  const { c } = run(PRESETS[1]);
  assert.match(buildingMessage(c, { material: 'timber' }), /Try a deeper beam/);
});
test('about content has all required parts', () => {
  assert.ok(ABOUT.source.some(s => /not yet from a cited source/.test(s)) && ABOUT.limitations.length && ABOUT.professional);
  assert.match(ABOUT_STATEMENT, /Simplified model, no live-data link/);
  const ids = ABOUT.assumptions.map(a => a[0]);
  for (const k of ['results', 'analysis', 'materials', 'cause', 'versions']) for (const i of ABOUT_CONTEXT[k].ids) assert.ok(ids.includes(i), `${k}:${i}`);
  const txt = ABOUT.assumptions.map(a => a[1]).join(' ');
  for (const w of ['rectangle', 'evenly', 'cantilever', '120 mm', '300 x 300', '200 mm', 'own weight', 'NOT added']) assert.ok(txt.includes(w), w);
});
