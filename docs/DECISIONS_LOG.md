# Decisions log

All build decisions, taken from PROGRESS.md. Date: 2026-11-05 (build session).

| Date | Question | Answer |
|---|---|---|
| 2026-11-05 | Is the project ready to build? | READY: files, tools and tests A/B/C (4.40, 1.64, 5.78 mm) all verified. |
| 2026-11-05 | How to read the PDFs without pdftotext? | Used pypdf in a throwaway venv outside the project. |
| 2026-11-05 | Does slab weight load the beams? | No. Plan formula: beam load = applied load + beam self weight. Slab, wall and column weights count in building totals only. |
| 2026-11-05 | How does a building beam get its type (simply supported / cantilever)? | One per-design beam type applies to all beams (default simply supported); the single-beam analysis can switch type. |
| 2026-11-05 | Vendor file names (stage 0) | three 0.187 ships no three.module.min.js, so three.module.js + three.core.js + OrbitControls.js are vendored. |
| 2026-11-05 | Where does the durability rating live? | In the frontend (calc.mjs). The plan's materials table has no durability column. |
| 2026-11-05 | How are frontend tests run? | `node --test frontend/tests` fails on Node 22, so plain `node --test` from the repo root is the documented command. |
| 2026-11-05 | What material are slabs? | Always concrete (plan: 120 mm concrete slab), whatever the design material. |
| 2026-11-05 | How are doors, windows, partitions and roofs modelled? | Doors/windows are openings stored on wall components (not separate parts); doors on floor 0 only; one partition per floor; one roof component. validateParams throws instead of clamping. |
| 2026-11-05 | Extra functions built early (compareMaterials, diffResults, Expected Results panel)? | Kept: needed by stages 5-6 and the panel is in the plan's layout. |
| 2026-11-05 | Non-finite numbers in POST /designs? | Rejected with 422 anywhere in params or summary (code review). |
| 2026-11-05 | Number badge for the Analysis card | Badges follow reading order in the final layout (1-11). |
| 2026-11-05 | Original baseline for Original vs Modified | Kept in memory only; defaults to the start design until 'Set as original'. |
| 2026-11-05 | Daylight indicator | Window area / floor area, labelled as not a simulation (no ray tracing). |
| 2026-11-05 | Demo design | Two-storey house is timber so Check all shows red beams that turn green with depth or steel. |
| 2026-11-05 | About assertion in stage7.test.mjs | Reworded when 'O6' jargon was removed; later strengthened to also prove source wording, all seven assumption topics and limitations. |
| 2026-11-05 | stage6.test.mjs diffComponents assertion | After adding a floor only the roof differs (positions are compared and the roof moves up). Now asserts exactly ['roof'] rather than an empty set. |
| 2026-11-05 | Material sources (O6) | README 'Sources and assumptions': E, density, conductivity checked against public pages where possible; steel conductivity, cost and durability labelled 'typical teaching value, not verified'. |
| 2026-11-05 | run.sh venv | Keys on .venv only (system fastapi no longer skips venv creation). run.bat is untested; WSL recommended on Windows. |
| 2026-11-05 | Product name | User request: ArchiTwin, with 'Architectural Digital Twin cum Simulator' kept as subtitle. This overrides the plan's LOCKED name item. |
| 2026-11-05 | Redesign: which design skill? | Installed design-taste-frontend (leonxlnx/taste-skill) with the requested command; it is the only skill in that repo. Used as guidance only (no scripts run, nothing fetched); dials layout 7, motion 6, density 5. Skill files are git-ignored. |
| 2026-11-05 | Skill rules vs the brief | Brief wins: scroll-reveal kept on Home/Materials/Learn (reduced-motion safe); SVG/code illustrations instead of photographs; system font stacks. |
| 2026-11-05 | /designs and /materials are both pages and API endpoints | Serve HTML only when Accept prefers text/html; otherwise JSON as before (API contract unchanged). |
| 2026-11-05 | How do the six houses get extra architecture? | A separate architecture.mjs layer adds decorative components from each preset's feature list. generateBuilding and its count formulas are unchanged; features are excluded from structural totals and beam checks and marked decorative. |
| 2026-11-05 | Which house is the demo? | Twin-Gable Family Home (timber, 16 of 34 beams fail; beam depth 0.45 m or steel fixes it). Old slugs twostorey/small/hall/shed alias to new presets. |
| 2026-11-05 | Test edits in v2 | stage7.test.mjs only, to follow the 4->6 preset change (count, names, demo id, demo lookup); all stricter properties kept. New tests: architecture.test.mjs, three page-route tests, a huge-id test. Answer-key tests A/B/C and generator count tests untouched; calc.mjs and building.mjs have zero diff. |
| 2026-11-05 | Saved designs and decorative features | Saving stores params.preset (extra key; API unchanged) so features/palette are restored on load, compare and thumbnails. |
| 2026-11-05 | Display exaggeration of bending | Beams are drawn x30 (labelled 'drawing only, the numbers are exact'). |
| 2026-11-05 | Known gap kept | Studio before/after Original view does not draw decorative features; Studio mobile keeps parameters after the model (with a Jump to parameters link). |
