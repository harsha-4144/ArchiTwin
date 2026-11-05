// names.mjs - the ONE place that turns a component id/object into a readable name (no maths).
// Grid: x-direction beams run east-west; row = grid line counted from the north (z = 0) wall.
//       z-direction beams run north-south; column line = counted from the west (x = 0) wall.
export function componentName(ref) {
  const id = typeof ref === 'string' ? ref : ref && ref.id;
  if (!id) return '';
  let m;
  if ((m = id.match(/^beam-f(\d+)-([xz])(\d+)-(\d+)$/))) {
    const fl = Number(m[1]) + 1, i = Number(m[3]), j = Number(m[4]);
    return m[2] === 'x' ? `Floor ${fl}, east-west beam, bay ${i + 1}, grid row ${j + 1}`
      : `Floor ${fl}, north-south beam, bay ${j + 1}, grid column ${i + 1}`;
  }
  if ((m = id.match(/^col-f(\d+)-(\d+)-(\d+)$/))) return `Floor ${Number(m[1]) + 1}, column at grid column ${Number(m[2]) + 1}, row ${Number(m[3]) + 1}`;
  if ((m = id.match(/^slab-f(\d+)$/))) return `Floor ${Number(m[1]) + 1} slab`;
  if ((m = id.match(/^wall-f(\d+)-(\w+)$/))) {
    const side = typeof ref === 'object' && ref.side ? ref.side : m[2];
    return `Floor ${Number(m[1]) + 1}, ${side} wall`;
  }
  if ((m = id.match(/^part-f(\d+)$/))) return `Floor ${Number(m[1]) + 1}, partition wall`;
  if (id === 'roof') return 'Roof';
  return id;
}
// Name with the raw id in brackets (for tooltips or where the id helps support).
export const componentNameWithId = ref => { const id = typeof ref === 'string' ? ref : ref.id; const n = componentName(ref); return n === id ? n : `${n} [${id}]`; };

// Plain lines describing a wall's doors and windows, from its openings data (formatting only).
// Returns an array of strings; empty openings give one "no doors or windows" line.
export function openingLines(c, f = v => String(Math.round(v * 100) / 100)) {
  const o = c && c.openings, out = [];
  if (!o) return ['No door or window data for this wall.'];
  if (o.doors) out.push(`${o.doors} door${o.doors === 1 ? '' : 's'}, each ${f(o.doorW)} m wide x ${f(o.doorH)} m high`);
  if (o.windows) out.push(`${o.windows} window${o.windows === 1 ? '' : 's'}, each ${f(o.windowW)} m wide x ${f(o.windowH)} m high`);
  if (!o.doors && !o.windows) out.push('No doors or windows in this wall');
  if (c.grossArea !== undefined) out.push(`Gross area ${f(c.grossArea)} m2, openings ${f(c.grossArea - c.area)} m2, net area ${f(c.area)} m2`);
  return out;
}
