// viewer.mjs - Three.js scene for the ADT. Display only: NO engineering maths here.
// Receives components from building.mjs and (optional) per-beam ratios computed by calc.mjs.
import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';

export const MAT_COLOURS = { timber: 0xc19a6b, steel: 0x8a9aa8, concrete: 0xb4b4b4 };
const ARCH_COLOURS = { column: 0xcfc6b8, beam: 0xcfc6b8, slab: 0xd9d2c5, wall: 0xf1e8d6, roof: 0xb5654a };
const STRUCTURE = new Set(['column', 'beam', 'slab']);
const hexNum = h => typeof h === 'string' ? parseInt(h.replace('#', ''), 16) : h;
// Fallback colours for decorative features when no preset palette is given.
const DEFAULT_PALETTE = { wall: '#f1e8d6', trim: '#cfc6b8', roof: '#b5654a', accent: '#8b5a2b' };
const FIXED_ROLES = { brick: 0x9a5445, glass: 0x9ec9d9 };
const FADE_TYPES = new Set(['wall', 'roof', 'opening']);   // parts that fade in/out instead of popping
const BEND_MS = 250, FADE_MS = 300, CAM_MS = 500, SEG = 16;
const reducedMotion = () => matchMedia('(prefers-reduced-motion:reduce)').matches;
const easeOut = t => 1 - (1 - t) ** 3, easeInOut = t => t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;

// Display-only beam bending shape: 0 at the supports, 1 at the maximum sag.
// xi runs 0..1 along the beam. Simply supported: peak at mid-span. Cantilever: fixed at xi = 0, peak at the free end.
export function bendShape(type, xi) {
  return type === 'cantilever' ? (6 * xi ** 2 - 4 * xi ** 3 + xi ** 4) / 3 : 3.2 * (xi - 2 * xi ** 3 + xi ** 4);
}
// Drawn sag in metres = calculated deflection x exaggeration, clipped to 40% of the span so it stays readable. Never used for numbers.
export function drawnSag(deflectionMm, scale, span) { return Math.min(deflectionMm / 1000 * scale, 0.4 * span); }

// Display-only colour scale: 0 -> blue, 1 (= at the limit) or more -> red.
export function ratioColour(ratio) {
  const t = Math.max(0, Math.min(1, ratio));
  return new THREE.Color().setHSL((1 - t) * 0.62, 0.8, 0.5);
}

// vopts.thumb: still-image mode for thumbnails (no animation loop, no fades, buffer kept so toDataURL works).
export function createViewer(container, onPick, onHover = null, vopts = {}) {
  const thumb = !!vopts.thumb;
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: thumb });
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
  const camListeners = [];
  controls.addEventListener('change', () => { dirty = true; camListeners.forEach(f => f()); });
  const anims = new Set();        // running tweens: fn(now) returns true when finished
  const bend = new Map();         // beam id -> { cur, from, to, t0 } (drawn sag in metres)
  let fly = null;
  controls.addEventListener('start', () => { fly = null; });
  const ghosts = new THREE.Group(); scene.add(ghosts);
  let prevFade = new Map();       // key -> mesh of the last model's fading parts
  let group = new THREE.Group();
  scene.add(group);
  const byId = new Map();     // component id -> mesh
  let selectedId = null, framed = false, lastModel = null, lastOpts = {}, hover = null;
  const hoverCb = c => { if (onHover) onHover(c, 0, 0); };

  function resize() {
    const w = Math.max(1, container.clientWidth), h = Math.max(1, container.clientHeight);
    renderer.setSize(w, h); dirty = true;
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  if (!thumb) new ResizeObserver(resize).observe(container);
  if (thumb) { const gr = new THREE.Mesh(unit, new THREE.MeshStandardMaterial({ color: 0xe4d9bd, roughness: 1 })); gr.scale.set(80, 0.02, 80); gr.position.set(6, -0.012, 6); scene.add(gr); }

  function flyTo(pos, tgt, ms = CAM_MS) {
    if (reducedMotion()) { camera.position.copy(pos); controls.target.copy(tgt); controls.update(); dirty = true; fly = null; return; }
    fly = { p0: camera.position.clone(), t0v: controls.target.clone(), p1: pos.clone(), t1: tgt.clone(), start: performance.now(), ms };
  }
  function frame(b, models = [b], animate = false) {   // fits the union bounding box of all models
    let X = 0, Z = 0, H = 0;
    for (const m of models) {
      X = Math.max(X, m.grid.totalX); Z = Math.max(Z, m.grid.totalZ);
      H = Math.max(H, m.grid.totalHeight + Math.max(0, ...m.components.map(c => c.rise || 0)));
    }
    const tgt = new THREE.Vector3(X / 2, H / 2, Z / 2);
    const r = Math.hypot(X, Z, H) / 2;          // bounding-sphere radius
    resize();
    const vf = camera.fov * Math.PI / 360, hf = Math.atan(Math.tan(vf) * camera.aspect);
    const fit = r / Math.sin(Math.min(vf, hf)) * 1.05;
    const dir = new THREE.Vector3(1.2, 0.8, 1.5).normalize();
    const pos = tgt.clone().addScaledVector(dir, fit);
    framed = true;
    if (animate) { flyTo(pos, tgt); return; }
    controls.target.copy(tgt); camera.position.copy(pos); controls.update();
  }
  // Ease the camera towards one part (target = its centre; only ever moves closer, never out).
  function focusOn(id) {
    const m = byId.get(id); if (!m) return;
    const box = new THREE.Box3().setFromObject(m), c = box.getCenter(new THREE.Vector3());
    const r = box.getBoundingSphere(new THREE.Sphere()).radius;
    const dir = camera.position.clone().sub(controls.target), cur = dir.length();
    const dist = Math.min(cur, Math.max(7, r * 2.6));
    flyTo(c.clone().addScaledVector(dir.normalize(), dist), c);
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

  function addOpenings(c, parent, fade, pal = null) {
    const o = c.openings; if (!o || c.interior) return;
    const n = o.doors + o.windows; if (!n) return;
    const alongX = c.side === 'north' || c.side === 'south';
    const slot = c.length / n;
    const y0 = c.position.y - c.height / 2;
    for (let k = 0; k < n; k++) {
      const isDoor = k < o.doors;
      const w = isDoor ? o.doorW : o.windowW, h = isDoor ? o.doorH : o.windowH;
      const yc = y0 + (isDoor ? h / 2 : o.sill + h / 2);
      const off = (k + 0.5) * slot - c.length / 2;
      const m = new THREE.Mesh(unit, getMat(isDoor ? (pal ? hexNum(pal.accent) : 0x8b5a2b) : 0x7ec3e6, isDoor ? 1 : 0.7));
      const depth = c.width + 0.06;
      m.scale.set(alongX ? w : depth, h, alongX ? depth : w);
      m.position.set(c.position.x + (alongX ? off : 0), yc, c.position.z + (alongX ? 0 : off));
      m.userData.comp = c; m.userData.opening = true; m.userData.kind = 'opening';
      parent.add(m); fade.set(`${c.id}#o${k}`, m);
    }
  }

  // ---- beam bending (drawing only): segmented box + outline whose vertices follow bendShape ----
  function beamEdgeBase(axis) {
    const pts = [], P = (a, u, v) => axis === 'x' ? [a, u, v] : [u, v, a], h = 0.5;
    const corners = [[-h, -h], [h, -h], [h, h], [-h, h]];
    for (const [u, v] of corners) for (let i = 0; i < SEG; i++) pts.push(...P(-h + i / SEG, u, v), ...P(-h + (i + 1) / SEG, u, v));
    for (const a of [-h, h]) for (let k = 0; k < 4; k++) { const [u1, v1] = corners[k], [u2, v2] = corners[(k + 1) % 4]; pts.push(...P(a, u1, v1), ...P(a, u2, v2)); }
    return new Float32Array(pts);
  }
  function makeBendBeam(c, mat) {
    const x = c.axis === 'x';
    const geo = new THREE.BoxGeometry(1, 1, 1, x ? SEG : 1, 1, x ? 1 : SEG);
    geo.userData.base = geo.attributes.position.array.slice();
    const eg = new THREE.BufferGeometry(); const base = beamEdgeBase(c.axis);
    eg.setAttribute('position', new THREE.BufferAttribute(base.slice(), 3)); eg.userData.base = base;
    const mesh = new THREE.Mesh(geo, mat);
    const lines = new THREE.LineSegments(eg, edgeMat); mesh.add(lines);
    mesh.userData.bend = { axis: c.axis, type: c.beamType, sy: c.size.sy, lines };
    return mesh;
  }
  function shapeInto(geo, axis, type, sagLocal) {
    const base = geo.userData.base, pos = geo.attributes.position.array, ai = axis === 'x' ? 0 : 2;
    for (let i = 0; i < base.length; i += 3) { pos[i] = base[i]; pos[i + 2] = base[i + 2]; pos[i + 1] = base[i + 1] - sagLocal * bendShape(type, base[i + ai] + 0.5); }
    geo.attributes.position.needsUpdate = true;
  }
  function applyBend(mesh, sag) {
    const b = mesh.userData.bend, local = sag / b.sy;
    shapeInto(mesh.geometry, b.axis, b.type, local); shapeInto(b.lines.geometry, b.axis, b.type, local);
    mesh.geometry.computeVertexNormals(); mesh.geometry.computeBoundingSphere(); mesh.geometry.computeBoundingBox();
  }
  function stepBend(now) {
    let active = false;
    for (const [id, e] of bend) {
      if (e.cur === e.to) continue;
      const p = Math.min(1, (now - e.t0) / BEND_MS);
      e.cur = p >= 1 ? e.to : e.from + (e.to - e.from) * easeOut(p);
      const m = byId.get(id); if (m && m.userData.bend) applyBend(m, e.cur);
      active = true;
    }
    return active;
  }

  // ---- fade in / out for walls and roof ----
  function fadeMesh(mesh, from, to, done) {
    const base = mesh.material, m = base.clone(); m.transparent = true;
    const target = base.opacity; mesh.material = m;
    const kids = mesh.children.filter(k => k.isLineSegments); kids.forEach(k => { k.visible = false; });
    const t0 = performance.now();
    anims.add(now => {
      const p = Math.min(1, (now - t0) / FADE_MS), e = easeOut(p);
      m.opacity = target * (from + (to - from) * e); dirty = true;
      if (p < 1) return false;
      if (mesh.material === m) mesh.material = base;
      m.dispose(); kids.forEach(k => { k.visible = true; }); if (done) done(); return true;
    });
  }
  function dropGhost(mesh) {
    ghosts.remove(mesh);
    mesh.traverse(o => { if (o.geometry && o.geometry !== unit && o.geometry !== edgeGeo) o.geometry.dispose(); });
  }

  function setModel(b, opts = {}) {
    lastModel = b; lastOpts = opts;
    const { layer = 'architecture', ratios = null, passFail = null, highlight = null, byMaterial = false, deflections = null, bendScale = 0, features = null, palette = null, wallOpacity = 0.5 } = opts;
    dirty = true;
    const oldGroup = group, oldFade = prevFade, reduced = thumb || reducedMotion();
    const pal = layer === 'architecture' ? (palette || null) : null;
    const palHex = role => FIXED_ROLES[role] ?? hexNum((pal || DEFAULT_PALETTE)[role] ?? DEFAULT_PALETTE.trim);
    group = new THREE.Group(); byId.clear(); hover = null; hoverCb(null);
    const fadeNow = new Map(), seen = new Set();
    for (const c of b.components) {
      const isStruct = STRUCTURE.has(c.type);
      if (layer === 'structure' && !isStruct) continue;
      let hex = layer === 'materials' ? MAT_COLOURS[c.type === 'slab' ? 'concrete' : c.material] : ARCH_COLOURS[c.type];
      if (pal) hex = palHex({ column: 'trim', beam: 'trim', slab: 'trim', wall: 'wall', roof: 'roof' }[c.type] || 'trim');
      if (layer === 'structure') hex = c.type === 'beam' ? 0x6f8f8c : 0xa79f90;
      if (byMaterial) hex = MAT_COLOURS[c.type === 'slab' ? 'concrete' : c.material];
      let mat = getMat(hex, c.type === 'wall' ? wallOpacity : (c.type === 'slab' && layer === 'structure') ? 0.4 : 1);
      if (c.type === 'beam' && ratios && ratios[c.id] !== undefined)
        mat = getMat(ratioColour(ratios[c.id]).getHex());
      if (c.type === 'beam' && passFail && passFail[c.id] !== undefined)
        mat = getMat(passFail[c.id] ? 0x2e9e5b : 0xd0382b);
      let mesh;
      const hi = highlight && highlight.has(c.id);
      if (c.type === 'roof' && c.roofType !== 'flat') {
        mesh = new THREE.Mesh(roofGeometry(c, b), hi ? getHiMat(getMat(hex, 1)) : getMat(hex, 1));
      } else if (c.type === 'beam' && bendScale && deflections && deflections[c.id] !== undefined) {
        mesh = makeBendBeam(c, hi ? getHiMat(mat) : mat);
        mesh.scale.set(c.size.sx, c.size.sy, c.size.sz);
        mesh.position.set(c.position.x, c.position.y, c.position.z);
        const target = drawnSag(deflections[c.id], bendScale, c.span ?? c.length), prev = bend.get(c.id);
        const cur = prev ? prev.cur : 0, e = { cur: reduced ? target : cur, from: cur, to: target, t0: performance.now() };
        if (reduced) e.cur = target; bend.set(c.id, e); seen.add(c.id);
        applyBend(mesh, e.cur);
      } else {
        mesh = new THREE.Mesh(unit, hi ? getHiMat(mat) : mat);
        mesh.scale.set(c.size.sx, c.size.sy, c.size.sz);
        mesh.position.set(c.position.x, c.position.y, c.position.z);
        if (c.type !== 'wall' || hi) mesh.add(new THREE.LineSegments(edgeGeo, hi ? hiEdgeMat : edgeMat));
      }
      mesh.userData.comp = c;
      group.add(mesh); byId.set(c.id, mesh);
      if (FADE_TYPES.has(c.type)) fadeNow.set(c.id, mesh);
      if (c.type === 'wall' && layer !== 'structure') addOpenings(c, group, fadeNow, pal);
    }
    // decorative architecture parts: only in the Architecture and Materials layers; never part of b.components
    if (features && layer !== 'structure') for (const c of features) {
      const hexF = layer === 'materials' ? MAT_COLOURS[c.material] : palHex(c.role);
      const hi = highlight && highlight.has(c.id);
      const fm = getMat(hexF, c.opacity ?? 1);
      let mesh;
      if (c.shape === 'prism') {
        const sh = new THREE.Shape(); sh.moveTo(-c.size.sx / 2, 0); sh.lineTo(c.size.sx / 2, 0); sh.lineTo(0, c.size.sy); sh.closePath();
        const g = new THREE.ExtrudeGeometry(sh, { depth: c.size.sz, bevelEnabled: false });
        g.translate(0, -c.size.sy / 2, -c.size.sz / 2);
        mesh = new THREE.Mesh(g, hi ? getHiMat(fm) : fm);
        mesh.position.set(c.position.x, c.position.y, c.position.z);
      } else {
        mesh = new THREE.Mesh(unit, hi ? getHiMat(fm) : fm);
        mesh.scale.set(c.size.sx, c.size.sy, c.size.sz);
        mesh.position.set(c.position.x, c.position.y, c.position.z);
        mesh.add(new THREE.LineSegments(edgeGeo, edgeMat));
      }
      if (c.rotX) mesh.rotation.x = c.rotX;
      mesh.userData.comp = c;
      group.add(mesh); byId.set(c.id, mesh);
    }
    for (const id of [...bend.keys()]) if (!seen.has(id)) bend.delete(id);
    // swap the groups; walls and roof that leave fade out as ghosts, new ones fade in
    scene.remove(oldGroup); scene.add(group);
    if (!reduced) {
      for (const [k, m] of oldFade) if (!fadeNow.has(k)) { oldGroup.remove(m); ghosts.add(m); fadeMesh(m, 1, 0, () => dropGhost(m)); }
      for (const [k, m] of fadeNow) if (!oldFade.has(k)) fadeMesh(m, 0, 1);
    }
    oldGroup.traverse(o => { if (o.geometry && o.geometry !== unit && o.geometry !== edgeGeo) o.geometry.dispose(); });
    prevFade = fadeNow;
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

  // ---- hover: highlight the part under the pointer and report it for a tooltip ----
  const hoverMats = new Map();
  const hoverMatOf = base => { if (!hoverMats.has(base.uuid)) { const m = base.clone(); m.emissive = new THREE.Color(0x1f8f89); m.emissiveIntensity = 0.55; hoverMats.set(base.uuid, m); } return hoverMats.get(base.uuid); };
  function setHover(c, x, y) {
    const mesh = c ? byId.get(c.id) : null;
    if ((hover && hover.mesh) !== mesh) {
      if (hover && hover.mesh && hover.mesh.material === hover.hm) hover.mesh.material = hover.orig;
      hover = null;
      if (mesh && c.id !== selectedId && !(mesh.material.emissive && mesh.material.emissive.getHex())) {
        const hm = hoverMatOf(mesh.material); hover = { mesh, orig: mesh.material, hm }; mesh.material = hm;
      } else if (mesh) hover = { mesh, orig: mesh.material, hm: null };
      dirty = true;
    }
    if (onHover) onHover(c, x, y);
  }
  let hoverQ = null, hoverRaf = 0;
  el.addEventListener('pointermove', e => {
    if (!onHover || e.buttons) return;
    hoverQ = { x: e.clientX, y: e.clientY };
    if (hoverRaf) return;
    hoverRaf = requestAnimationFrame(() => {
      hoverRaf = 0; const q = hoverQ; if (!q) return;
      const r = el.getBoundingClientRect();
      ndc.set(((q.x - r.left) / r.width) * 2 - 1, -((q.y - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const hits = ray.intersectObjects(group.children, false);
      const hit = (lastOpts.layer === 'structure' && hits.find(h => ['beam', 'column'].includes(h.object.userData.comp.type))) || hits[0];
      setHover(hit ? hit.object.userData.comp : null, q.x, q.y);
    });
  });
  el.addEventListener('pointerleave', () => { hoverQ = null; setHover(null, 0, 0); });
  el.addEventListener('pointerdown', () => { setHover(null, 0, 0); });

  // Render only when something changed (three viewers share the page, so idle ones cost nothing).
  if (!thumb) renderer.setAnimationLoop(() => {
    const now = performance.now();
    if (fly) {
      const p = Math.min(1, (now - fly.start) / fly.ms), e = easeInOut(p);
      camera.position.lerpVectors(fly.p0, fly.p1, e); controls.target.lerpVectors(fly.t0v, fly.t1, e);
      if (p >= 1) fly = null;
      dirty = true;
    }
    for (const a of anims) if (a(now)) anims.delete(a);
    if (stepBend(now)) dirty = true;
    const moved = controls.update();
    if (moved || dirty) { dirty = false; renderer.render(scene, camera); }
  });
  resize();
  // Thumbnail: size the canvas, fit the camera to everything drawn (3/4 view from the south-east), render once, return a data URL.
  function snapshot(w, h) {
    renderer.setPixelRatio(1); renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    grid.visible = false;
    const box = new THREE.Box3().setFromObject(group), ctr = box.getCenter(new THREE.Vector3());
    const r = box.getBoundingSphere(new THREE.Sphere()).radius;
    const vf = camera.fov * Math.PI / 360, hf = Math.atan(Math.tan(vf) * camera.aspect);
    const dir = new THREE.Vector3(1.2, 0.75, 1.5).normalize();
    camera.position.copy(ctr).addScaledVector(dir, r / Math.sin(Math.min(vf, hf)) * 0.98);
    camera.lookAt(ctr);
    renderer.render(scene, camera);
    return renderer.domElement.toDataURL('image/jpeg', 0.88);
  }
  const camState = () => ({ pos: camera.position.clone(), tgt: controls.target.clone() });
  let syncing = false;
  return { setModel, select, snapshot, resetView: () => { if (lastModel) frame(lastModel, [lastModel], true); }, focusOn,
    fitModels: models => { frame(models[0], models); dirty = true; }, screenPosOf, ids: () => [...byId.keys()],
    // Camera sync for the before/after slider: the other viewer follows this one.
    followCamera(other) { other.onCamera(() => { if (syncing) return; syncing = true; const s = other.camState(); camera.position.copy(s.pos); controls.target.copy(s.tgt); controls.update(); dirty = true; syncing = false; }); },
    onCamera(fn) { camListeners.push(fn); }, camState, resize, flying: () => !!fly,
    // Test hooks: the drawn sag (m) of a beam now, its target, and the y of its middle vertex in world units.
    sagOf: id => bend.get(id)?.cur ?? null, sagTarget: id => bend.get(id)?.to ?? null,
    midY(id) { const m = byId.get(id); if (!m || !m.userData.bend) return null; const pa = m.geometry.attributes.position.array, base = m.geometry.userData.base; let best = 0; for (let i = 0; i < base.length; i += 3) if (Math.abs(base[i + (m.userData.bend.axis === 'x' ? 0 : 2)]) < Math.abs(base[best + (m.userData.bend.axis === 'x' ? 0 : 2)])) best = i; return m.position.y + pa[best + 1] * m.scale.y; },
    // Display helpers for the Home hero: turn the camera about the vertical axis, and know when the user drags.
    orbit(angle) { const t = controls.target, p = camera.position.clone().sub(t); p.applyAxisAngle(new THREE.Vector3(0, 1, 0), angle); camera.position.copy(t).add(p); camera.lookAt(t); dirty = true; },
    controls, onUserStart(fn) { controls.addEventListener('start', fn); }, dispose() { renderer.setAnimationLoop(null); renderer.dispose(); } };
}
