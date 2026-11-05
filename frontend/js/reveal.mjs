// reveal.mjs - scroll reveal (fade + 16px rise, staggered 60ms, once). Off under reduced motion.
export function initReveal(root = document) {
  if (matchMedia('(prefers-reduced-motion:reduce)').matches || !('IntersectionObserver' in window)) return;
  const targets = [...root.querySelectorAll('[data-reveal]')];
  const items = [];
  for (const t of targets) {
    const kids = t.hasAttribute('data-reveal-children') ? [...t.children] : [t];
    kids.forEach((k, i) => { k.style.setProperty('--i', i); k.classList.add('reveal'); items.push(k); });
  }
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { const t = e.target; t.classList.add('in'); io.unobserve(t); setTimeout(() => { t.classList.remove('reveal', 'in'); t.style.removeProperty('--i'); }, 700 + 60 * Number(t.style.getPropertyValue('--i') || 0)); } }), { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
  items.forEach(i => io.observe(i));
}
