# PROGRESS

## Readiness check: **READY**

1. Files: all present (CLAUDE.md, START_HERE.md, ADT_Plan.pdf, docs/Ideate_Phase.pdf, docs/STAGE_PROMPTS.md, 6 reference images viewed, prototype html + main.js, 5 agents).
2. Tools: python 3.12.3, node v22.23.4, npm 10.9.9, git identity set; `.venv` imports fastapi, uvicorn, httpx, pytest OK; port 8000 free.
   - `pdftotext` is not installed; PDFs were read with pypdf in a throwaway venv (scratchpad). Reviewer agents that call pdftotext will need the same workaround: use `docs/plan.txt`-style extraction via pypdf if needed.
3. Maths (throwaway script): A = 4.40 mm, B = 1.64 mm, C = 5.78 mm. Match.
4. Consistency notes (none blocking):
   - Mind map layer toggle shows Sunlight and mind map mentions "section view" and "window position"; plan makes Daylight/Section LATER and uses window size/count per side. Plan followed.
   - Mind map shows Glass as a material; plan has timber/steel/concrete only. Plan followed.
   - Plan formula puts only beam self weight + applied load on a beam (slab weight is not added to beams). Assumed as written; slab/column/wall weights count in building totals only.
   - Cantilever vs simply supported: plan does not say how a building beam gets its type. Assumption: a per-design "beam type" parameter applies to all beams (default simply supported); single-beam analysis can switch type.
   - O6 (material values cited) stays OPEN; O7 resolved: Linux/WSL, so run.sh.
   - Every stage 0-8 has a gate; Ideate section 6 features are covered or LATER/DROPPED.
5. Verdict: READY.

## Stages
### Stage 0: Setup — gate PASS
- python 3.12.3, node 22, .venv imports OK; run.sh/run.bat written; vendor copied; prototype JS parse-checked (no browser installed, so not opened visually).
- Assumption: three 0.187.0 ships no `three.module.min.js`; vendored `three.module.js` + `three.core.js` + `OrbitControls.js` instead (plan name differs, same purpose).
### Stage 1: Backend and materials — gate PASS
- pytest 17 passed; /health, /docs (200), /materials (timber, steel, concrete) verified via ./run.sh; saved design survives restart.
- Assumption: durability rating lives in the frontend (plan's materials table has no such column). Param validation covers floors 1-2, bays 1-3, span 2-8, floor height 2.5-4, material, beam type, roof type.
### Stage 2: Calculation — gate PASS
- Tests A/B/C within 0.01 mm, trend, totals, bad-input tests: 9 pass via `node --test frontend/tests/*.test.mjs`; pytest 17 pass.
- Deviation: plan's `node --test frontend/tests` fails on Node 22 (MODULE_NOT_FOUND); the glob form is used everywhere instead.
- Assumption: slabs are always concrete (plan: "concrete slab of 120 mm").
### Stage 3: Building generator — gate PASS
- Counts match formulas for 5+ parameter sets; total weight = sum of parts. node 21/21 pass, pytest 17 pass.
- Assumptions: validateParams throws (no clamping); doors/windows stored as `openings` on walls (not separate components); doors on floor 0 only; one partition wall per floor; one roof component. Hidden floors (floor_visible) are currently omitted from components; stage 4 should make visibility a view-only concern if it affects totals unexpectedly.
### Stage 4: Viewer and look — gate PASS
- Real Chromium (Playwright, kept outside the project) at 1366x768 and 390px: no console errors; floors/bays/span/roof/material changes rebuild the model; clicking a 5 m concrete 250x350 beam showed volume 0.4375 m3, weight 10.30 kN, cost ₹8,750, deflection 4.40 mm (matches hand calc). Node 21/21, pytest 17.
- Known gaps: in Architecture layer walls/roof catch clicks (use Structure layer for hidden parts); on mobile 3D view comes first so badge order reads 2,1,3.
### M1 reviewers (code, math, spec, design)
- math: PASS. spec: no missing items; flagged `compareMaterials`/`diffResults` (calc.mjs) and Expected Results panel as early stage 5/6 content — kept (needed later, panel is in plan layout).
- code: non-finite numbers gave 500 -> fixed (422 + tests); run.sh printed "running" on bind failure -> fixed (port check). design: 6 layout issues (hidden panel scroll, wrapped values, grid gap, small 3D view, low-contrast text, mobile badge order) -> fixed.
- Commit "Review fixes M1". pytest 29, node 21.
### Stage 5: Analysis panel — gate PASS
- stage5.test.mjs proves check-all failing set == beams failing beamDeflection (mixed case) and totals == sum of parts. Node 24 pass, pytest 33. Browser: timber 8x3 m config -> 6 of 12 red/green, consistent across Expected Results, list and material card; no console errors; no overflow at 390px.
- Assumption: Analysis card has no number badge (badges 1-6 follow the mind map cards). Right column is long; design review at M2.
### Stage 6: Versions and comparison — gate PASS
- Saved "Original house" + "Modified steel", stopped server by PID, restarted on same DB: both listed and loadable; two-version compare table works; Original vs Modified two views with orange highlight; Cause and Effect lists every changed parameter (old -> new) and results with arrows plus words (lower/higher). Node 29, pytest 33; no console errors; no overflow at 390px.
- Assumptions: the "original" baseline is in memory only (resets on reload; defaults to start design until "Set as original"); a material change highlights all parts; daylight indicator = window area / floor area, labelled not a simulation. Badge 8 used for the Original vs Modified card.
### Stage 7: Alternatives, messages, About panel — gate PASS
- 4 presets (Small house, Two-storey house, Hall, Shed) load with zero console errors; Two-storey house = timber, 12 of 24 beams fail, fixed by depth 0.5 m or steel (tested). Five "About this result" buttons open card 6. Node 33, pytest 33.
- Assumption: demo house is timber so check-all shows red beams. Last CSS-only tweak (highlight bullets) was not re-screenshotted; stage 8 re-verifies.
