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
