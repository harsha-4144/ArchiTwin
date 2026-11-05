// presets.mjs - four ready-made design alternatives (data only; validated by building.mjs).
// The Two-storey house is the demo design: timber beams that are too slim for their span, so some fail.
export const PRESETS = [
  { id: 'small', name: 'Small house (1 floor)', demo: false,
    blurb: 'One storey, concrete, flat roof, simple and stiff.',
    params: { floors: 1, bays_x: 2, bays_z: 1, span_x: 3.5, span_z: 4, floor_height: 3, roof_type: 'flat', roof_pitch: 0,
      material: 'concrete', beam_type: 'simply_supported', beam_b: 0.25, beam_h: 0.35, load: 8,
      doors: { north: 0, south: 1, east: 0, west: 0 }, windows: { north: 1, south: 2, east: 1, west: 1 }, window_w: 1.2, window_h: 1.2, partitions: true } },
  { id: 'twostorey', name: 'Two-storey house (demo)', demo: true,
    blurb: 'Two floors, timber frame, gable roof. Some beams are too slim: make them deeper or switch to steel.',
    params: { floors: 2, bays_x: 2, bays_z: 2, span_x: 5, span_z: 4.5, floor_height: 3, roof_type: 'gable', roof_pitch: 25,
      material: 'timber', beam_type: 'simply_supported', beam_b: 0.2, beam_h: 0.3, load: 12,
      doors: { north: 0, south: 1, east: 0, west: 0 }, windows: { north: 2, south: 2, east: 2, west: 2 }, window_w: 1.2, window_h: 1.2, partitions: false } },
  { id: 'hall', name: 'Hall', demo: false,
    blurb: 'One tall steel-framed room with long spans and a shallow shed roof.',
    params: { floors: 1, bays_x: 3, bays_z: 1, span_x: 8, span_z: 8, floor_height: 4, roof_type: 'shed', roof_pitch: 10,
      material: 'steel', beam_type: 'simply_supported', beam_b: 0.3, beam_h: 0.5, load: 15,
      doors: { north: 0, south: 2, east: 1, west: 1 }, windows: { north: 3, south: 2, east: 1, west: 1 }, window_w: 1.5, window_h: 1.5, partitions: false } },
  { id: 'shed', name: 'Shed', demo: false,
    blurb: 'A small timber shed with a steep shed roof and one door.',
    params: { floors: 1, bays_x: 1, bays_z: 1, span_x: 3, span_z: 2.5, floor_height: 2.5, roof_type: 'shed', roof_pitch: 15,
      material: 'timber', beam_type: 'simply_supported', beam_b: 0.1, beam_h: 0.2, load: 3,
      doors: { north: 0, south: 1, east: 0, west: 0 }, windows: { north: 0, south: 0, east: 1, west: 0 }, window_w: 0.8, window_h: 0.8, partitions: false } },
];
