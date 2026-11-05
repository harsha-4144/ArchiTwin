# Architectural Digital Twin cum Simulator

Read `ADT_Plan.pdf` first (decision-of-record) and `docs/Ideate_Phase.pdf` (source). Do not change LOCKED items without asking.

## Pace
No deadline. Quality first: build one stage per session, in order, and stop at each gate. Milestones M1 and M2 are the points where reviewers run.

## Rules
- Stages in order. Stop at each gate and show the real test output.
- No features outside the plan: no login, no blueprint upload, no rainwater, no sunlight yet. New ideas go in the LATER list.
- All calculation lives in `frontend/calc.mjs` (browser). The backend stores data, it never calculates.
- One command runs everything (`./run.sh` or `run.bat`). No Docker. No internet at runtime.
- `git commit` at every gate (message = stage name) so we can roll back. Tag `v1` at the end.
- Never overwrite an existing file without asking. Tell me what is wrong before fixing silently.
- Keep replies short. Credits are limited.
- First message from me will say my operating system. Use the matching run script.

## Reviewers (.claude/agents)
Run them with the Agent tool, in parallel, only at M1 and M2 as listed in the plan. They only report. Fix only what they list, then re-run only the one that failed.

## Look
The UI must follow the PDF images in docs/reference/ (layout, panels, colours: cream background, teal headings, numbered round badges, rounded cards). View them with the Read tool before stage 4.

## Layout
backend/ (FastAPI + SQLite)  frontend/ (Three.js, plain JS)  prototype/ (earlier working single-file version: reuse its 3D code, and keep it as the fallback demo)  docs/
