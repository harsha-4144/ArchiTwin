// viewer.mjs - Three.js scene for the ADT. Display only: NO engineering maths here.
// Receives components from building.mjs and (optional) per-beam ratios computed by calc.mjs.
import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';

export const MAT_COLOURS = { timber: 0xc19a6b, steel: 0x8a9aa8, concrete: 0xb4b4b4 };
const ARCH_COLOURS = { column: 0xcfc6b8, beam: 0xcfc6b8, slab: 0xd9d2c5, wall: 0xf1e8d6, roof: 0xb5654a };
const STRUCTURE = new Set(['column', 'beam', 'slab']);

// Display-only colour scale: 0 -> blue, 1 (= at the limit) or more -> red.
export function ratioColour(ratio) {
  const t = Math.max(0, Math.min(1, ratio));
  return new THREE.Color().setHSL((1 - t) * 0.62, 0.8, 0.5);
}

export function createViewer(container, onPick) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  container.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf6efe0);
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 300);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x9a9080, 1.1));
  const sun = new THREE.DirectionalLight(0xffffff, 1.1);
  sun.position.set(8, 14, 6);
  scene.add(sun);
  const grid = new THREE.GridHelper(30, 30, 0x8f8264, 0xc4b794);
  scene.add(grid);

  const unit = new THREE.BoxGeometry(1, 1, 1);            // shared by all box parts
  const edgeGeo = new THREE.EdgesGeometry(unit);          // shared outline
  const matCache = new Map();
  const edgeMat = new THREE.LineBasicMaterial({ color: 0x5b5346, transparent: true, opacity: 0.35 });
  const getMat = (hex, opacity = 1) => {
    const k = hex + '|' + opacity;
    if (!matCache.has(k)) matCache.set(k, new THREE.MeshStandardMaterial({
      color: hex, roughness: 0.85, metalness: 0.05, transparent: opacity < 1, opacity,
      polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }));
    return matCache.get(k);
  };

  const hiCache = new Map();   // highlighted (differs) materials, shared
  const getHiMat = base => {
    const k = base.uuid;
    if (!hiCache.has(k)) { const m = base.clone(); m.emissive = new THREE.Color(0xff8a00); m.emissiveIntensity = 0.75; hiCache.set(k, m); }
    return hiCache.get(k);
  };
  const hiEdgeMat = new THREE.LineBasicMaterial({ color: 0xd35400 });
  let dirty = true;
  controls.addEventListener('change', () => { dirty = true; });
  let group = new THREE.Group();
  scene.add(group);
  const byId = new Map();     // component id -> mesh
  let selectedId = null, framed = false, lastModel = null, lastOpts = {};

  function resize() {
    const w = Math.max(1, container.clientWidth), h = Math.max(1, container.clientHeight);
    renderer.setSize(w, h); dirty = true;
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(container);

  function frame(b) {
    const g = b.grid, cx = g.totalX / 2, cz = g.totalZ / 2;
    const rise = Math.max(0, ...b.components.map(c => c.rise || 0));
    const H = g.totalHeight + rise;
    controls.target.set(cx, H / 2, cz);
    const r = Math.hypot(g.totalX, g.totalZ, H) / 2;          // bounding-sphere radius
    resize();
    const vf = camera.fov * Math.PI / 360, hf = Math.atan(Math.tan(vf) * camera.aspect);
    const fit = r / Math.sin(Math.min(vf, hf)) * 1.05;
    const dir = new THREE.Vector3(1.2, 0.8, 1.5).normalize();
    camera.position.copy(controls.target).addScaledVector(dir, fit);
    controls.update(); framed = true;
  }

  function roofGeometry(c, b) {
    const TX = b.grid.totalX, TZ = b.grid.totalZ;
    const s = new THREE.Shape();
    s.moveTo(0, 0); s.lineTo(TZ, 0);
    if (c.roofType === 'shed') s.lineTo(TZ, c.rise); else s.lineTo(TZ / 2, c.rise);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: TX, bevelEnabled: false });
    g.rotateY(-Math.PI / 2); g.translate(TX, b.grid.totalHeight, 0);
    return g;
  }

  function addOpenings(c, parent) {
    const o = c.openings; if (!o || c.interior) return;
    const n = o.doors + o.windows; if (!n) return;
    const alongX = c.side === 'north' || c.side === 'south';
    const sign = (c.side === 'south' || c.side === 'east') ? 1 : -1;
    const slot = c.length / n;
    const y0 = c.position.y - c.height / 2;
    for (let k = 0; k < n; k++) {
      const isDoor = k < o.doors;
      const w = isDoor ? o.doorW : o.windowW, h = isDoor ? o.doorH : o.windowH;
      const yc = y0 + (isDoor ? h / 2 : o.sill + h / 2);
      const off = (k + 0.5) * slot - c.length / 2;
      const m = new THREE.Mesh(unit, getMat(isDoor ? 0x8b5a2b : 0x7ec3e6, isDoor ? 1 : 0.7));
      const depth = c.width + 0.06;
      m.scale.set(alongX ? w : depth, h, alongX ? depth : w);
      m.position.set(c.position.x + (alongX ? off : 0), yc, c.position.z + (alongX ? 0 : off));
      m.userData.comp = c; m.userData.opening = true; m.userData.kind = 'opening';
      parent.add(m);
    }
  }

  function setModel(b, opts = {}) {
    lastModel = b; lastOpts = opts;
    const { layer = 'architecture', ratios = null, passFail = null, highlight = null } = opts;
    dirty = true;
    scene.remove(group);
    group.traverse(o => { if (o.geometry && o.geometry !== unit && o.geometry !== edgeGeo) o.geometry.dispose(); });
    group = new THREE.Group(); scene.add(group); byId.clear();
    for (const c of b.components) {
      const isStruct = STRUCTURE.has(c.type);
      if (layer === 'structure' && !isStruct) continue;
      let hex = layer === 'materials' ? MAT_COLOURS[c.type === 'slab' ? 'concrete' : c.material] : ARCH_COLOURS[c.type];
      if (layer === 'structure') hex = c.type === 'beam' ? 0x6f8f8c : 0xa79f90;
      let mat = getMat(hex, c.type === 'wall' ? 0.5 : (c.type === 'slab' && layer === 'structure') ? 0.4 : 1);
      if (c.type === 'beam' && ratios && ratios[c.id] !== undefined)
        mat = getMat(ratioColour(ratios[c.id]).getHex());
      if (c.type === 'beam' && passFail && passFail[c.id] !== undefined)
        mat = getMat(passFail[c.id] ? 0x2e9e5b : 0xd0382b);
      let mesh;
      if (c.type === 'roof' && c.roofType !== 'flat') {
        mesh = new THREE.Mesh(roofGeometry(c, b), highlight && highlight.has(c.id) ? getHiMat(getMat(hex, 1)) : getMat(hex, 1));
      } else {
        mesh = new THREE.Mesh(unit, mat);
        mesh.scale.set(c.size.sx, c.size.sy, c.size.sz);
        mesh.position.set(c.position.x, c.position.y, c.position.z);
        const hi = highlight && highlight.has(c.id);
        if (hi) mesh.material = getHiMat(mat);
        if (c.type !== 'wall' || hi) mesh.add(new THREE.LineSegments(edgeGeo, hi ? hiEdgeMat : edgeMat));
      }
      mesh.userData.comp = c;
      group.add(mesh); byId.set(c.id, mesh);
      if (c.type === 'wall' && layer !== 'structure') addOpenings(c, group);
    }
    if (!framed) frame(b);
    if (selectedId) select(selectedId);
  }

  function select(id) {
    const old = byId.get(selectedId);
    if (old && old.material.emissive && ![...hiCache.values()].includes(old.material) && old !== byId.get(id)) old.material.emissive.setHex(0);
    selectedId = id;
    const m = byId.get(id);
    if (!m) { selectedId = null; return; }
    // selected part gets its own material so the shared one is not tinted
    dirty = true; m.material = m.material.clone(); m.material.emissive = new THREE.Color(0xd98a00); m.material.emissiveIntensity = 0.6;
  }

  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  let down = null;
  const el = renderer.domElement;
  el.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY }; });
  el.addEventListener('pointerup', e => {
    if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return;
    const r = el.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(group.children, false);
    // Structure layer: slabs are see-through, so prefer a beam or column behind them.
    const hit = (lastOpts.layer === 'structure' && hits.find(h => ['beam', 'column'].includes(h.object.userData.comp.type))) || hits[0];
    const c = hit ? hit.object.userData.comp : null;
    if (c) { selectedId = c.id; setModel(lastModel, lastOpts); }
    onPick(c);
  });

  // For tests/automation: pixel position (page coordinates) of a component centre.
  function screenPosOf(id) {
    const m = byId.get(id); if (!m) return null;
    const v = new THREE.Vector3(); new THREE.Box3().setFromObject(m).getCenter(v);
    v.project(camera);
    const r = el.getBoundingClientRect();
    return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height };
  }

  // Render only when something changed (three viewers share the page, so idle ones cost nothing).
  renderer.setAnimationLoop(() => {
    const moved = controls.update();
    if (moved || dirty) { dirty = false; renderer.render(scene, camera); }
  });
  resize();
  return { setModel, select, resetView: () => { if (lastModel) { frame(lastModel); dirty = true; } }, screenPosOf, ids: () => [...byId.keys()] };
}
