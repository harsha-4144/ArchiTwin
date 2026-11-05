// icons.mjs - small inline SVG icon set (24px, 1.5px stroke, currentColor). Display only.
const svg = (inner, extra = '') => `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false" ${extra}>${inner}</svg>`;
export const ICONS = {
  check: svg('<circle cx="12" cy="12" r="9"/><path d="M7.5 12.5l3 3 6-6.5"/>'),
  warn: svg('<path d="M12 3.5l9 16H3z"/><path d="M12 10v4.5M12 17v.2"/>'),
  cross: svg('<circle cx="12" cy="12" r="9"/><path d="M8.5 8.5l7 7M15.5 8.5l-7 7"/>'),
  beam: svg('<path d="M3 9h18v5H3z"/><path d="M5 14v6M19 14v6"/>'),
  swap: svg('<path d="M4 8h13l-3-3M20 16H7l3 3"/>'),
  book: svg('<path d="M4 5.5C7 4.5 9.5 4.8 12 6.5c2.5-1.7 5-2 8-1v13c-3-1-5.5-.7-8 1-2.5-1.7-5-2-8-1z"/><path d="M12 6.5v13"/>'),
  cube: svg('<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/>'),
  menu: svg('<path d="M4 7h16M4 12h16M4 17h16"/>'),
  close: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
  scale: svg('<path d="M12 4v16M6 20h12M5 8h14"/><path d="M5 8l-2.5 6a3 3 0 005 0zM19 8l-2.5 6a3 3 0 005 0z"/>'),
};
export const LOGO = '<svg viewBox="0 0 32 32" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M4 15L16 5l12 10"/><path d="M7 13v14h18V13"/><path d="M13 27v-8h6v8" /></svg>';

// status chip: icon + word, never colour alone
export function statusChip(kind, word) {
  const icon = kind === 'pass' ? ICONS.check : kind === 'warn' ? ICONS.warn : ICONS.cross;
  const w = word || (kind === 'pass' ? 'Pass' : kind === 'warn' ? 'Check' : 'Fail');
  const s = document.createElement('span'); s.className = 'status ' + kind; s.innerHTML = icon + '<span></span>'; s.lastChild.textContent = w; return s;
}

// Fallback house drawing (used when WebGL is unavailable).
export const HOUSE_SVG = `<svg class="ill" viewBox="0 0 400 300" role="img" aria-labelledby="hs-t" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round">
<title id="hs-t">Line drawing of a two-storey house with a gable roof</title>
<path class="acc" d="M70 140l130-70 130 70z"/>
<rect x="85" y="140" width="230" height="110"/><path d="M85 195h230M143 140v110M200 140v110M257 140v110"/>
<path d="M70 140l130-70 130 70"/><rect x="170" y="205" width="60" height="45" fill="var(--paper)"/>
<rect x="105" y="155" width="26" height="26"/><rect x="269" y="155" width="26" height="26"/><rect x="105" y="210" width="26" height="26"/><rect x="269" y="210" width="26" height="26"/>
<path d="M40 250h320" /><path d="M20 262h360M20 274h360" opacity=".35"/></svg>`;
