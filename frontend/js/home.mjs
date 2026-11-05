// home.mjs - the slowly rotating 3D house, feature icons and scroll reveal.
import { createViewer } from '../viewer.mjs';
import { generateBuilding } from '../building.mjs';
import { PRESETS } from '../presets.mjs';
import { HOUSE_SVG, ICONS } from './icons.mjs';
import { initReveal } from './reveal.mjs';

for (const [id, ic] of [['i1', 'cube'], ['i2', 'beam'], ['i3', 'swap']]) document.getElementById(id).innerHTML = ICONS[ic];
initReveal();

const stage = document.getElementById('hero-stage');
const RATE = 0.1; // radians per second
const reduced = matchMedia('(prefers-reduced-motion:reduce)').matches;

function fallback() {
  stage.innerHTML = HOUSE_SVG;
  document.getElementById('hero-cap').textContent = 'Line drawing of a two-storey house. The live 3D model needs WebGL; the studio will tell you if it cannot run.';
}

try {
  const preset = PRESETS.find(p => p.id === 'twostorey');
  const viewer = createViewer(stage, () => {});
  viewer.setModel(generateBuilding(preset.params), { layer: 'architecture' });
  viewer.controls.enableZoom = false;                 // let the page scroll over the house
  viewer.controls.enablePan = false;
  stage.querySelector('canvas').style.touchAction = 'pan-y';
  let dragged = false, onScreen = true, last = 0, raf = 0;
  viewer.onUserStart(() => { dragged = true; });
  const running = () => !reduced && !dragged && onScreen && !document.hidden;
  const tick = t => {
    raf = 0;
    if (!running()) return;
    if (last) viewer.orbit(-RATE * Math.min(0.1, (t - last) / 1000));
    last = t; raf = requestAnimationFrame(tick);
  };
  const kick = () => { last = 0; if (!raf && running()) raf = requestAnimationFrame(tick); };
  new IntersectionObserver(es => { onScreen = es[0].isIntersecting; kick(); }).observe(stage);
  document.addEventListener('visibilitychange', kick);
  kick();
  window.__home = { viewer, get rotating() { return running(); } };
} catch (e) {
  fallback();
}
