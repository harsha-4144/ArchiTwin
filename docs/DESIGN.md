# ArchiTwin v2: design system

## Direction and tone
ArchiTwin looks like a well-made architect's field notebook that happens to be alive: warm paper, deep teal ink, a drafting-table sense of order. Type is editorial (serif headings, quiet sans body, mono for every number) so results read like measured values, not marketing. Copy is plain and teacher-like: say what a thing is and what it does. The Ideate look is kept (cream ground, teal headings, numbered round badges, rounded cards) but sharpened: fewer boxes, more whitespace and hairlines, one deep-teal "ink band" per page, and the 3D house as the hero object.

## Dials
Layout variance 7 (asymmetric splits, offset headings, staggered rows; never broken reading order). Motion intensity 6 (considered reveals and hover, a slowly rotating house; nothing flashy). Visual density 5 (data panels are compact, marketing pages breathe).

## Colour tokens
Contrast is WCAG 2.x, measured.
```css
:root{
  --cream:#f6efe0;      /* page ground */
  --paper:#fffaf0;      /* card ground */
  --sand:#efe3c4;       /* quiet panel, table stripe */
  --line:#c9bb98;       /* hairline, 1.7:1, decoration only */
  --line-soft:#e3d8bf;  /* inner dividers */
  --ink:#2d2a24;        /* body text */
  --muted:#5e5646;      /* meta text */
  --teal:#1f6f6b;       /* accent: links, badges, primary button */
  --teal-deep:#124f4c;  /* ink band ground, hover/pressed */
  --brass:#e0b25a;      /* highlight on teal-deep only */
  --pass:#276b43;  --warn:#8a5a00;  --fail:#b3392b;
  --pass-bg:#e1efe3; --warn-bg:#f6e6bf; --fail-bg:#f6dcd6;
  --focus:#124f4c;
}
```
| Pair | Ratio | AA |
|---|---|---|
| ink on cream / on paper | 12.5 / 13.8 | pass (AAA) |
| muted on cream / on paper | 6.3 / 7.0 | pass |
| teal on cream / on paper | 5.2 / 5.7 | pass |
| white on teal | 5.9 | pass |
| white or cream on teal-deep | 9.3 / 8.2 | pass |
| brass on teal-deep | 4.8 | pass (text 16px+) |
| pass on cream | 5.6 | pass |
| warn on cream | 5.2 | pass |
| fail on cream | 5.2 | pass |

Rules: status is never colour alone. Every pass/warn/fail carries an icon glyph (check, triangle, cross, drawn in SVG) and a word ("Pass", "Check", "Fail"). Stress heatmaps use a blue-green-red ramp plus a numeric legend and values on hover/focus. `--line` is for borders of non-text shapes only; form controls use `--teal-deep` 1px borders (3:1 or better).

## Type
Only system fonts, no downloads.
```css
--font-display:"Iowan Old Style","Palatino Linotype",Palatino,"Book Antiqua","URW Palladio L",P052,Georgia,serif;
--font-body:"Avenir Next",Seravek,"Segoe UI","Gill Sans Nova","Trebuchet MS",Ubuntu,Cantarell,"Helvetica Neue",Arial,sans-serif;
--font-mono:ui-monospace,"SF Mono","Cascadia Mono","Roboto Mono",Menlo,Consolas,"DejaVu Sans Mono",monospace;
```
Display for h1-h3 and the wordmark (weight 600, tracking -0.01em, line-height 1.1). Body for everything else (400/600, line-height 1.55, measure max 62ch). Mono with `font-variant-numeric:tabular-nums` for every number, unit and table value. Sentence case; labels 13px weight 600, no tracked capitals.

Scale (clamp = 390px to 1440px):
```css
--t-hero:clamp(2.5rem,1.6rem + 3.8vw,4.5rem);
--t-h1:clamp(2rem,1.5rem + 2.2vw,3.25rem);
--t-h2:clamp(1.5rem,1.25rem + 1.1vw,2.25rem);
--t-h3:clamp(1.2rem,1.1rem + .45vw,1.5rem);
--t-lead:clamp(1.1rem,1.05rem + .3vw,1.3rem);
--t-body:1rem;  --t-small:.875rem;  --t-label:.8125rem; /* nothing smaller than 13px */
--t-num:clamp(1.5rem,1.2rem + 1.2vw,2.25rem); /* big readouts, mono */
```

## Spacing, radius, shadow
Spacing (4-based): `--s-1:4px --s-2:8px --s-3:12px --s-4:16px --s-5:24px --s-6:32px --s-7:48px --s-8:64px --s-9:96px --s-10:128px`. Section padding block: 96px desktop, 64px tablet, 48px phone.
Radius: `--r-sm:8px` (controls), `--r-md:16px` (cards, panels), `--r-lg:24px` (viewport frame, hero), `--r-pill:999px`.
Shadow: `--sh-1:0 1px 2px rgba(60,45,15,.08)` (cards at rest); `--sh-2:0 8px 24px -8px rgba(60,45,15,.18)` (hover, menus). Warm-tinted, no glow, no stacked shadows.

## Layout
- 12-column grid, 24px gap (16px under 640). Content max width 1200px; Studio and Designs may use 1440px. Side margin `max(20px, (100vw - max)/2)`: left and right edges are always equal. The wide ultra-screen at 1920 centres the container; background bands run full bleed.
- Breakpoints: 390 (base), 640, 900, 1200, 1440, 1920. Mobile first. `html,body{overflow-x:clip}` is a safety net only; nothing may rely on it. Test at 390, 768, 1024, 1366, 1440, 1920 with no horizontal scroll.
- Studio: three columns from 1200 (parameters 280, 3D view fluid, results 320), two from 900, one stacked below, view first. Other pages: asymmetric 5/7 or 4/8 splits, alternating, collapsing to one column below 900.
- Touch targets 44px minimum on phone.

## Components
- **Buttons**: one shape, pill, 44px high, 16px label, 24px side padding. Primary: teal fill, white text, hover teal-deep, press translateY(1px). Secondary: transparent, 1px teal-deep border, teal-deep text, hover sand fill. At most one primary per view. Label is a verb plus object ("Open the studio"); never "Learn more". No gradients or shadows on buttons.
- **Cards**: paper ground, 1px `--line-soft`, `--r-md`, `--sh-1`, 20-24px padding. One level deep only: never a card in a card; inside, use hairlines, spacing and sand stripes. A linked card lifts 2px and takes `--sh-2` on hover.
- **Badges**: 28px round, teal fill, white mono numeral 14px, sit left of the h2 or on a card's top-left corner; numbering follows reading order. Decorative badges are `aria-hidden`; the heading text carries the meaning.
- **Tables**: mono tabular numbers right-aligned, text left-aligned, sticky header on scroll containers, sand zebra rows, 1px `--line-soft` row rules, `scope` on headers, caption present. Wide tables scroll inside their own `overflow-x:auto` wrapper, which is focusable. Status cells show icon plus word.
- **Nav**: header on cream with a 1px hairline, logo left, six links (Home, Studio, Designs, Materials, Learn, About), the single primary "Open the studio" right. Current page: `aria-current="page"` and a 2px teal underline. Links are real anchors, visible focus, skip link first. Under 900: a 44px menu button (`aria-expanded`, `aria-controls`) opens a full-width sheet, Escape closes it and returns focus, focus stays inside while open.
- **Tooltips**: appear on hover and focus, dismiss with Escape, paper ground, 1px line, `--sh-2`, 13px text, linked via `aria-describedby`; never the only place a fact lives. A tap toggles on touch.
- **Focus ring**: `:focus-visible{outline:3px solid var(--focus);outline-offset:2px}` on every interactive element; on teal-deep grounds use `--brass`. Never removed.
- **Forms**: sliders use accent teal with a mono output; every control has a visible label; errors in text plus icon, not colour alone.

## Motion
- Durations: 120ms (press, hover colour), 240ms (lift, menu), 600ms (reveal). Easing `cubic-bezier(.2,.7,.2,1)` for entering, `ease-in-out` for loops.
- Animate only `transform` and `opacity` (60 fps, no layout thrash). No animation library; CSS plus small `IntersectionObserver` code and `requestAnimationFrame`.
- Scroll-reveal (fade plus 16px rise, children staggered 60ms, once only) on Home, Materials and Learn only. Never on Studio, Designs or About, where the user is working or reading data.
- Home hero: the 3D house rotates at about 0.1 rad/s, pauses when the tab is hidden or the canvas is off screen, and stops on pointer drag.
- Hover: card lift 2px, link underline draws left to right, button colour step.
- `@media (prefers-reduced-motion:reduce)`: all transitions and animations off, reveals show immediately, the house is static (user can still orbit), no smooth scroll.
- Content is visible without JavaScript: reveal classes are added by script, never hidden by default CSS.

## Illustration
SVG or code only; no photographs, no raster files, no external images. Style: thin 1.5px line drawings in teal-deep on cream, with one brass or sand accent shape; section dividers drawn as a faint blueprint grid or contour lines. Every SVG is inline, uses `currentColor` and tokens, has `role="img"` plus a title when meaningful, else `aria-hidden`. Material swatches are CSS patterns (hatching for concrete, grain lines for timber, cross-hatch for steel). The Home house and the Studio model are Three.js. Icons are a small hand-drawn inline set, 24px, 1.5px stroke. No caption under a purely decorative picture.

## Pages (one-line intent)
- **Home**: show a live rotating house and say plainly what the tool does, with one action to open the studio.
- **Studio**: the simulator; parameters left, 3D view centre, numbered result cards right, status always icon plus word.
- **Designs**: browse saved designs as a gallery and compare two side by side with differences marked.
- **Materials**: explore each material's properties with plain-language meaning, and sort or filter them.
- **Learn**: teach how to read deflection, stress and checks, with a searchable glossary.
- **About**: who made it, what it is not (a teaching aid, not certified engineering), and its sources.

## Skill notes
Skill used: `design-taste-frontend` (from leonxlnx/taste-skill). It offers only this one skill; there is no separate redesign skill. Read as guidance only; no scripts, assets or network used.
Applied: plain category-first copy and verb-plus-object buttons; one system (one button shape, one radius family, one card recipe, one hairline); a 4-based spacing scale; equal left and right edges; one accent colour with a neutral interface; hairline fixed-style nav with `aria-current`; real product UI (the live 3D model) as the hero instead of stock art; headings that name a noun; text at 16px or more with muted only for meta; sentence case; hover lift of 2px and link underline draw; no violet; cards one level deep.
Overridden by the brief: scroll-reveal is kept on Home, Materials and Learn (skill bans it), gated by `prefers-reduced-motion`; the skill's "one section per screen" height rule is not enforced (Studio is a tool, pages scroll naturally); the skill's photographs, real third-party icons, shader effects and installers are replaced by SVG/code illustrations; the skill's single-nav-height and sticky rules are relaxed for the Studio toolbar; fonts are system stacks, not downloaded pairings; density is 5 with data panels.
