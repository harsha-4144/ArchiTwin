import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// ---------- Material data (assumed values, for learning only) ----------
const MATS = {
  timber:   { name: 'Timber',   E: 11e9,  rho: 600,  k: 0.13, cost: 30000,  color: 0xc19a6b },
  steel:    { name: 'Steel',    E: 200e9, rho: 7850, k: 50,   cost: 470000, color: 0x8a9aa8 },
  concrete: { name: 'Concrete', E: 25e9,  rho: 2400, k: 1.4,  cost: 20000,  color: 0xb4b4b4 },
};

// ---------- State ----------
const state = { mat: 'concrete', span: 5, depth: 0.35, bw: 0.25, load: 10, width: 4, height: 3, exag: 50 };
let versions = [];      // saved designs
let ghostIndex = -1;    // which saved version is shown as orange outline
let selected = null;

// ---------- Calculation (simply supported beam, uniform load) ----------
function calc(p, matKey) {
  const m = MATS[matKey];
  const L = p.span, b = p.bw, h = p.depth;
  const I = b * Math.pow(h, 3) / 12;                 // m^4
  const selfKNm = m.rho * 9.81 * b * h / 1000;       // kN/m
  const w = (p.load + selfKNm) * 1000;               // N/m
  const delta = 5 * w * Math.pow(L, 4) / (384 * m.E * I); // m
  const limit = L / 250;
  const vol = b * h * L;
  return { delta, limit, ok: delta <= limit, vol, weight: vol * m.rho, cost: vol * m.cost, k: m.k };
}

// ---------- Scene ----------
const wrap = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
wrap.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xeef1f5);
const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);
camera.position.set(9, 6, 9);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1.5, 0);
scene.add(new THREE.HemisphereLight(0xffffff, 0x889099, 1.0));
const sun = new THREE.DirectionalLight(0xffffff, 1.2);
sun.position.set(6, 10, 4);
scene.add(sun);
scene.add(new THREE.GridHelper(30, 30, 0xb8c0cc, 0xd5dae2));

let building = new THREE.Group();
scene.add(building);

function resize() {
  const w = wrap.clientWidth, h = wrap.clientHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);

function beamGeometry(p, matKey) {
  const r = calc(p, matKey);
  const g = new THREE.BoxGeometry(p.span, p.depth, p.bw, 48, 1, 1);
  const pos = g.attributes.position;
  const vis = Math.min(r.delta * p.exag, p.span * 0.12);
  for (let i = 0; i < pos.count; i++) {
    const s = (pos.getX(i) + p.span / 2) / p.span;
    pos.setY(i, pos.getY(i) - vis * (16 / 5) * (s - 2 * s ** 3 + s ** 4));
  }
  g.computeVertexNormals();
  return g;
}

function addPart(group, geo, color, pos, info) {
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.8 }));
  mesh.position.set(...pos);
  mesh.userData = info;
  group.add(mesh);
  return mesh;
}

function dims(x, y, z) { return `${x.toFixed(2)} × ${y.toFixed(2)} × ${z.toFixed(2)} m`; }

function info(name, role, x, y, z, matKey, extra) {
  const m = MATS[matKey];
  const vol = x * y * z;
  return { name, role, size: dims(x, y, z), mat: m.name, weight: vol * m.rho, extra: extra || '' };
}

function rebuild() {
  scene.remove(building);
  building.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  building = new THREE.Group();
  const { span: L, width: W, height: H, depth: D, bw } = state;
  const cs = 0.3;
  const conc = 'concrete';

  // floor base
  addPart(building, new THREE.BoxGeometry(L + 1, 0.15, W + 1), MATS.concrete.color, [0, -0.075, 0],
    info('Foundation slab', 'Base of the building', L + 1, 0.15, W + 1, conc));
  // columns
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz], i) => {
    addPart(building, new THREE.BoxGeometry(cs, H - D, cs), MATS.concrete.color,
      [sx * L / 2, (H - D) / 2, sz * W / 2],
      info('Column ' + (i + 1), 'Carries the beam loads down to the foundation', cs, H - D, cs, conc));
  });
  // main beams (analysed) along x
  const r = calc(state, state.mat);
  [-1, 1].forEach((sz, i) => {
    const m = addPart(building, beamGeometry(state, state.mat), MATS[state.mat].color,
      [0, H - D / 2, sz * W / 2],
      info('Main beam ' + (i + 1), 'Spans between columns. This is the part being simulated.',
        L, D, bw, state.mat,
        `Deflection: ${(r.delta * 1000).toFixed(1)} mm (limit ${(r.limit * 1000).toFixed(1)} mm) → ${r.ok ? 'OK' : 'TOO MUCH'}`));
    m.userData.isMain = true;
  });
  // tie beams along z
  [-1, 1].forEach((sx, i) => {
    addPart(building, new THREE.BoxGeometry(0.25, 0.3, W), MATS.concrete.color,
      [sx * L / 2, H - D + 0.15, 0],
      info('Tie beam ' + (i + 1), 'Connects the two sides of the frame', 0.25, 0.3, W, conc));
  });
  // roof slab
  addPart(building, new THREE.BoxGeometry(L + 0.4, 0.12, W + 0.4), 0xd9d2c5, [0, H + 0.06, 0],
    info('Roof slab', 'Covers the building and rests on the beams', L + 0.4, 0.12, W + 0.4, conc));

  // ghost of a saved version (orange outline)
  if (ghostIndex >= 0 && versions[ghostIndex]) {
    const v = versions[ghostIndex];
    const gm = new THREE.Mesh(beamGeometry(v.p, v.p.mat),
      new THREE.MeshBasicMaterial({ color: 0xff7a00, wireframe: true }));
    gm.position.set(0, H - v.p.depth / 2, W / 2);
    building.add(gm);
  }
  scene.add(building);
  if (selected) highlightByName(selected);
}

// ---------- Click to inspect ----------
const ray = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let downAt = null;
renderer.domElement.addEventListener('pointerdown', e => { downAt = [e.clientX, e.clientY]; });
renderer.domElement.addEventListener('pointerup', e => {
  if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 4) return;
  const rc = renderer.domElement.getBoundingClientRect();
  mouse.set(((e.clientX - rc.left) / rc.width) * 2 - 1, -((e.clientY - rc.top) / rc.height) * 2 + 1);
  ray.setFromCamera(mouse, camera);
  const hit = ray.intersectObjects(building.children.filter(c => c.userData.name))[0];
  if (hit) { selected = hit.object.userData.name; showInfo(hit.object.userData); highlightByName(selected); }
});
function highlightByName(n) {
  building.children.forEach(c => {
    if (c.material && c.material.emissive) c.material.emissive.setHex(c.userData.name === n ? 0x2255ff : 0x000000);
  });
}
function showInfo(i) {
  document.getElementById('info').innerHTML =
    `<b>${i.name}</b><br>${i.role}<br>Size: ${i.size}<br>Material: ${i.mat}<br>Weight: ${i.weight.toFixed(0)} kg` +
    (i.extra ? `<br><b>${i.extra}</b>` : '');
}

// ---------- UI ----------
const $ = id => document.getElementById(id);
const bind = (id, key, fmt) => {
  const el = $(id);
  el.addEventListener('input', () => {
    state[key] = key === 'mat' ? el.value : parseFloat(el.value);
    if (fmt) $(id + 'V').textContent = fmt(state[key]);
    update();
  });
  if (fmt) $(id + 'V').textContent = fmt(state[key]);
};
bind('mat', 'mat');
bind('span', 'span', v => v.toFixed(1) + ' m');
bind('depth', 'depth', v => (v * 1000).toFixed(0) + ' mm');
bind('bw', 'bw', v => (v * 1000).toFixed(0) + ' mm');
bind('load', 'load', v => v.toFixed(0) + ' kN/m');
bind('width', 'width', v => v.toFixed(1) + ' m');
bind('height', 'height', v => v.toFixed(1) + ' m');
bind('exag', 'exag', v => '×' + v);

function update() {
  const r = calc(state, state.mat);
  $('result').innerHTML =
    `Deflection: <b>${(r.delta * 1000).toFixed(1)} mm</b> &nbsp; Limit (span/250): ${(r.limit * 1000).toFixed(1)} mm<br>` +
    `<span class="${r.ok ? 'ok' : 'bad'}">${r.ok ? '✔ Within limit' : '✖ Bends too much — try a deeper beam, shorter span or stiffer material'}</span>`;
  // material comparison for the current beam size
  $('matTable').innerHTML = '<tr><th>Material</th><th>Deflection</th><th>Weight</th><th>Cost (est.)</th><th>Heat conductivity</th><th></th></tr>' +
    Object.keys(MATS).map(k => {
      const c = calc(state, k);
      return `<tr class="${k === state.mat ? 'cur' : ''}"><td>${MATS[k].name}</td><td>${(c.delta * 1000).toFixed(1)} mm</td>` +
        `<td>${c.weight.toFixed(0)} kg</td><td>₹${Math.round(c.cost).toLocaleString('en-IN')}</td><td>${c.k} W/mK</td>` +
        `<td class="${c.ok ? 'ok' : 'bad'}">${c.ok ? 'OK' : 'Too much'}</td></tr>`;
    }).join('');
  rebuild();
  renderVersions();
  if (selected) {
    const part = building.children.find(c => c.userData.name === selected);
    if (part) showInfo(part.userData);
  }
}

$('save').addEventListener('click', () => {
  const p = { ...state, mat: state.mat };
  versions.push({ name: 'Design ' + String.fromCharCode(65 + versions.length % 26), p, r: calc(p, p.mat) });
  ghostIndex = versions.length - 1;
  update();
});
$('clear').addEventListener('click', () => { versions = []; ghostIndex = -1; update(); });

function renderVersions() {
  $('verTable').innerHTML = versions.length
    ? '<tr><th>Show</th><th>Version</th><th>Material</th><th>Span</th><th>Section</th><th>Load</th><th>Deflection</th><th>Result</th></tr>' +
      versions.map((v, i) => `<tr class="${i === ghostIndex ? 'cur' : ''}"><td><input type="radio" name="g" ${i === ghostIndex ? 'checked' : ''} data-i="${i}"></td>` +
        `<td>${v.name}</td><td>${MATS[v.p.mat].name}</td><td>${v.p.span.toFixed(1)} m</td>` +
        `<td>${(v.p.bw * 1000).toFixed(0)}×${(v.p.depth * 1000).toFixed(0)} mm</td><td>${v.p.load} kN/m</td>` +
        `<td>${(v.r.delta * 1000).toFixed(1)} mm</td><td class="${v.r.ok ? 'ok' : 'bad'}">${v.r.ok ? 'OK' : 'Too much'}</td></tr>`).join('')
    : '<tr><td>No saved designs yet. Press "Save this design", change something, then save again to compare.</td></tr>';
  document.querySelectorAll('#verTable input[type=radio]').forEach(el =>
    el.addEventListener('change', () => { ghostIndex = +el.dataset.i; rebuild(); renderVersions(); }));
}

resize();
update();
(function loop() { controls.update(); renderer.render(scene, camera); requestAnimationFrame(loop); })();
