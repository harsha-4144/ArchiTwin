// presets.mjs - six ready-made houses (data only; params are validated by building.mjs).
// Each has its own palette (hex colours for the Architecture layer) and a list of decorative features
// (expanded by architecture.mjs; they never change the structural counts or totals).
// Twin-Gable Family Home is the demo design: timber beams that are too slim for their span, so some fail.
export const PRESETS = [
  { id: 'sunrise-cottage', name: 'Sunrise Cottage', demo: false,
    tagline: 'A cosy one-storey home with a front veranda and a chimney.',
    blurb: 'One floor, concrete frame, gable roof. The veranda and chimney are decoration only.',
    palette: { wall: '#f4e6c8', trim: '#e3cfa2', roof: '#b4553a', accent: '#7b4a2a' },
    features: ['veranda', 'chimney'],
    params: { floors: 1, bays_x: 2, bays_z: 2, span_x: 3.5, span_z: 3.5, floor_height: 3, roof_type: 'gable', roof_pitch: 32,
      material: 'concrete', beam_type: 'simply_supported', beam_b: 0.25, beam_h: 0.35, load: 8,
      doors: { north: 0, south: 1, east: 0, west: 0 }, windows: { north: 2, south: 2, east: 1, west: 1 }, window_w: 1.0, window_h: 1.2, partitions: false } },
  { id: 'urban-box', name: 'Urban Box', demo: false,
    tagline: 'Two floors of concrete with big windows and a roof terrace.',
    blurb: 'Two floors, flat roof with a parapet and a railed roof terrace, concrete finish.',
    palette: { wall: '#a3a4a6', trim: '#74767a', roof: '#4f5154', accent: '#e07a3f' },
    features: ['parapet', 'terrace'],
    params: { floors: 2, bays_x: 2, bays_z: 2, span_x: 4, span_z: 4, floor_height: 3.2, roof_type: 'flat', roof_pitch: 0,
      material: 'concrete', beam_type: 'simply_supported', beam_b: 0.25, beam_h: 0.4, load: 10,
      doors: { north: 0, south: 1, east: 0, west: 0 }, windows: { north: 2, south: 2, east: 2, west: 1 }, window_w: 2.0, window_h: 2.0, partitions: false } },
  { id: 'hill-retreat', name: 'Hill Retreat', demo: false,
    tagline: 'A long timber cabin with a sloping roof and a side deck.',
    blurb: 'One floor on a long 3 by 1 plan, sloping shed roof, timber cladding and a raised side deck.',
    palette: { wall: '#d3dcc4', trim: '#8b6b4a', roof: '#3f5a4a', accent: '#b9824f' },
    features: ['cladding', 'deck'],
    params: { floors: 1, bays_x: 3, bays_z: 1, span_x: 4.5, span_z: 5, floor_height: 3, roof_type: 'shed', roof_pitch: 14,
      material: 'timber', beam_type: 'simply_supported', beam_b: 0.15, beam_h: 0.3, load: 5,
      doors: { north: 0, south: 1, east: 0, west: 0 }, windows: { north: 1, south: 3, east: 2, west: 0 }, window_w: 1.6, window_h: 1.6, partitions: false } },
  { id: 'twin-gable', name: 'Twin-Gable Family Home', demo: true,
    tagline: 'A two-storey family home with shutters and a gabled front porch.',
    blurb: 'Two floors, timber frame, gable roof. Some beams are too slim: make them deeper or switch to steel.',
    palette: { wall: '#dcbc92', trim: '#f3ead6', roof: '#47556b', accent: '#8c2f39' },
    features: ['shutters', 'porch'],
    params: { floors: 2, bays_x: 3, bays_z: 2, span_x: 4.5, span_z: 5, floor_height: 3, roof_type: 'gable', roof_pitch: 30,
      material: 'timber', beam_type: 'simply_supported', beam_b: 0.2, beam_h: 0.3, load: 12,
      doors: { north: 0, south: 1, east: 0, west: 0 }, windows: { north: 2, south: 2, east: 2, west: 2 }, window_w: 1.2, window_h: 1.3, partitions: false } },
  { id: 'community-hall', name: 'Community Hall', demo: false,
    tagline: 'A wide single-storey hall with a grand entrance and canopy.',
    blurb: 'One tall steel-framed room, wide flat roof, few windows, one large entrance with a canopy.',
    palette: { wall: '#e6dfcd', trim: '#b8ad94', roof: '#7c8b97', accent: '#2a6f77' },
    features: ['portal', 'canopy', 'steps'],
    params: { floors: 1, bays_x: 3, bays_z: 3, span_x: 6, span_z: 5, floor_height: 4, roof_type: 'flat', roof_pitch: 0,
      material: 'steel', beam_type: 'simply_supported', beam_b: 0.3, beam_h: 0.5, load: 15,
      doors: { north: 0, south: 1, east: 0, west: 0 }, windows: { north: 2, south: 0, east: 2, west: 2 }, window_w: 1.0, window_h: 0.8, partitions: false } },
  { id: 'garden-studio', name: 'Garden Studio', demo: false,
    tagline: 'A small steel-framed studio with a glass front and a pergola.',
    blurb: 'One small floor, light steel frame, light shed roof, large windows on the south side.',
    palette: { wall: '#eef3f2', trim: '#8fb0b5', roof: '#d5e0de', accent: '#2d4a52' },
    features: ['pergola', 'steps'],
    params: { floors: 1, bays_x: 2, bays_z: 1, span_x: 3.5, span_z: 3.5, floor_height: 2.8, roof_type: 'shed', roof_pitch: 6,
      material: 'steel', beam_type: 'simply_supported', beam_b: 0.2, beam_h: 0.3, load: 4,
      doors: { north: 0, south: 1, east: 0, west: 0 }, windows: { north: 1, south: 3, east: 1, west: 0 }, window_w: 1.5, window_h: 2.2, partitions: false } },
];

// Old links (?preset=twostorey etc.) keep working: each old slug maps to the nearest new house.
export const PRESET_ALIASES = { twostorey: 'twin-gable', small: 'sunrise-cottage', hall: 'community-hall', shed: 'garden-studio' };
const squash = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
export function resolvePreset(slug) {
  const k = squash(slug);
  if (!k) return undefined;
  return PRESETS.find(p => squash(p.id) === k) || PRESETS.find(p => p.id === PRESET_ALIASES[k]);
}

// A saved design remembers its starting design in params.preset (extra key; never used by any calculation).
export const presetOf = params => (params && typeof params.preset === 'string') ? PRESETS.find(p => p.id === params.preset) : undefined;
