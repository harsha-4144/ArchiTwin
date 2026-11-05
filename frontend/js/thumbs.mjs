// thumbs.mjs - preset thumbnails drawn at runtime from the 3D scene (no image files are stored).
// One shared offscreen renderer, jobs run one after another, results cached in memory and sessionStorage.
// If WebGL is missing or fails, an inline SVG silhouette is returned instead.
import { createViewer } from '../viewer.mjs';
import { generateBuilding } from '../building.mjs';
import { generateArchitecture } from '../architecture.mjs';

const W = 480, H = 320, VERSION = 'v1';
const cache = new Map();          // key -> Promise<dataURL>
let viewer = null, host = null, glFailed = false, queue = Promise.resolve();

const keyOf = d => `adt-thumb-${VERSION}-${d.id}-${JSON.stringify([d.params, d.palette || null, d.features || null])}`;

// Fallback: a simple flat drawing from the parameters (not the 3D model).
export function silhouetteSvg(d) {
  const p = d.params, pal = { wall: '#e8dcc0', trim: '#b8ad94', roof: '#8a5a44', accent: '#6b4a2a', ...(d.palette || {}) };
  const tx = p.bays_x * p.span_x, h = p.floors * p.floor_height, sc = Math.min(380 / tx, 190 / (h + 3));
  const w = tx * sc, bh = h * sc, x0 = (W - w) / 2, yb = 270, rh = (p.roof_type === 'flat' ? 0.25 : Math.max(0.8, p.roof_pitch / 12)) * sc;
  const wall = `<rect x="${x0}" y="${yb - bh}" width="${w}" height="${bh}" fill="${pal.wall}" stroke="${pal.trim}" stroke-width="3"/>`;
  const roof = p.roof_type === 'gable' ? `<polygon points="${x0 - 8},${yb - bh} ${W / 2},${yb - bh - rh * 1.6} ${x0 + w + 8},${yb - bh}" fill="${pal.roof}"/>`
    : p.roof_type === 'shed' ? `<polygon points="${x0 - 6},${yb - bh} ${x0 + w + 6},${yb - bh - rh} ${x0 + w + 6},${yb - bh + 6} ${x0 - 6},${yb - bh + 6}" fill="${pal.roof}"/>`
    : `<rect x="${x0 - 6}" y="${yb - bh - rh}" width="${w + 12}" height="${rh}" fill="${pal.roof}"/>`;
  let wins = '';
  for (let f = 0; f < p.floors; f++) for (let i = 0; i < Math.max(1, p.windows.south); i++)
    wins += `<rect x="${x0 + w * (i + 0.5) / (p.windows.south + 1) + 6}" y="${yb - bh + f * p.floor_height * sc + 0.3 * p.floor_height * sc}" width="${p.window_w * sc * 0.8}" height="${p.window_h * sc * 0.8}" fill="#a9d3e6"/>`;
  const door = `<rect x="${x0 + w * 0.1}" y="${yb - 2.1 * sc}" width="${sc}" height="${2.1 * sc}" fill="${pal.accent}"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#f6efe0"/><rect y="${yb}" width="${W}" height="${H - yb}" fill="#e4d9bd"/>${wall}${roof}${wins}${door}</svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

function ensureViewer() {
  if (viewer) return viewer;
  host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = `position:fixed;left:-10000px;top:0;width:${W}px;height:${H}px;pointer-events:none`;
  document.body.appendChild(host);
  viewer = createViewer(host, () => {}, null, { thumb: true });
  return viewer;
}

// d: { id, params, palette?, features? }  ->  Promise<string> (data URL)
export function getThumb(d) {
  const key = keyOf(d);
  if (cache.has(key)) return cache.get(key);
  try { const s = sessionStorage.getItem(key); if (s) { const pr = Promise.resolve(s); cache.set(key, pr); return pr; } } catch { /* storage blocked */ }
  const job = queue.then(() => new Promise(resolve => setTimeout(resolve, 0))).then(() => {
    if (glFailed) return silhouetteSvg(d);
    try {
      const v = ensureViewer(), b = generateBuilding(d.params);
      v.setModel(b, { layer: 'architecture', palette: d.palette || null, wallOpacity: 0.97, features: d.features ? generateArchitecture(d.params, b, d.features) : null });
      const url = v.snapshot(W, H);
      if (!url || url.length < 2000) throw new Error('blank');
      try { sessionStorage.setItem(key, url); } catch { /* quota */ }
      return url;
    } catch (e) { glFailed = true; return silhouetteSvg(d); }
  });
  queue = job.catch(() => {});
  cache.set(key, job);
  return job;
}
