// shell.mjs - renders the shared header and footer on every page. Real links, no client routing.
import { LOGO, ICONS } from './icons.mjs';

export const PAGES = [['home', 'Home', '/'], ['studio', 'Studio', '/studio'], ['designs', 'Designs', '/designs'],
  ['materials', 'Materials', '/materials'], ['learn', 'Learn', '/learn'], ['about', 'About', '/about']];
export const REPO = 'https://github.com/harsha-4144/ArchiTwin';
export const LIMITS = 'Simplified model, no live-data link. Not a structural safety check.';

function renderHeader(host, page) {
  const links = PAGES.map(([id, label, href]) =>
    `<li><a class="navlink" href="${href}"${id === page ? ' aria-current="page"' : ''}>${label}</a></li>`).join('');
  // On Home the hero holds the one primary button, so the header one is secondary; the Studio hides it.
  const ctaClass = page === 'home' ? 'btn-secondary' : 'btn-primary';
  host.className = 'site-header';
  host.innerHTML = `<a class="skip" href="#main">Skip to content</a>
  <div class="inner">
    <a class="logo" href="/" aria-label="ArchiTwin, home">${LOGO}<span>ArchiTwin</span></a>
    <button type="button" class="btn btn-secondary menu-btn" id="menu-btn" aria-expanded="false" aria-controls="site-nav" aria-label="Menu">${ICONS.menu}<span>Menu</span></button>
    <nav class="site-nav" id="site-nav" aria-label="Main"><ul>${links}</ul>
      ${page === 'studio' ? '' : `<a class="btn ${ctaClass}" href="/studio">Open the studio</a>`}</nav>
  </div>`;
  const btn = host.querySelector('#menu-btn'), nav = host.querySelector('#site-nav');
  const focusables = () => [btn, ...nav.querySelectorAll('a')];
  const set = open => {
    nav.classList.toggle('open', open); btn.setAttribute('aria-expanded', String(open));
    btn.querySelector('span').textContent = open ? 'Close' : 'Menu';
    btn.querySelector('svg').outerHTML = open ? ICONS.close : ICONS.menu;
  };
  btn.addEventListener('click', () => { const open = btn.getAttribute('aria-expanded') !== 'true'; set(open); if (open) nav.querySelector('a').focus(); });
  document.addEventListener('keydown', e => {
    if (btn.getAttribute('aria-expanded') !== 'true') return;
    if (e.key === 'Escape') { set(false); btn.focus(); return; }
    if (e.key === 'Tab') { // keep focus inside the open menu
      const f = focusables(), first = f[0], last = f[f.length - 1];
      if (!f.includes(document.activeElement)) { e.preventDefault(); first.focus(); }
      else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  nav.addEventListener('click', e => { if (e.target.closest('a')) set(false); });
  matchMedia('(min-width:900px)').addEventListener('change', m => { if (m.matches) set(false); });
}

function renderFooter(host) {
  host.className = 'site-footer';
  host.innerHTML = `<div class="container footer-in"><div class="cols">
    <div><a class="logo" href="/" aria-label="ArchiTwin, home">${LOGO}<span>ArchiTwin</span></a>
      <p class="limits">${LIMITS}</p></div>
    <nav aria-label="Footer"><h2>Pages</h2><ul>${PAGES.map(([, l, h]) => `<li><a href="${h}">${l}</a></li>`).join('')}</ul></nav>
    <div><h2>Project</h2><ul><li><a href="${REPO}" rel="noopener">Source on GitHub</a></li><li><a href="/about#sources">Sources and assumptions</a></li></ul></div>
  </div></div>`;
}

export function initShell() {
  document.documentElement.classList.add('js');
  const page = document.body.dataset.page;
  const h = document.getElementById('site-header'), f = document.getElementById('site-footer');
  if (h) renderHeader(h, page);
  if (f) renderFooter(f);
}
initShell();
