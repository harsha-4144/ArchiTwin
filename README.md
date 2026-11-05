# ArchiTwin
*Architectural Digital Twin cum Simulator*

A browser app for architecture students. Pick a small building, change floors, bays, spans, material, beam size, load, roof, doors and windows, and see the 3D model, beam checks, weight, cost and cause-and-effect update at once. Designs can be saved and compared.

**Limits.** A simplified virtual model with no live-data link. It uses the standard beam deflection formula (solid rectangle, even load, limit span/250) with rounded teaching values. It is for learning, not for designing a real building.

## Run
Needs Python 3.10+, git and a browser with WebGL (Node 18+ only for the tests). Linux, macOS, or Windows with WSL.
```
git clone https://github.com/harsha-4144/ArchiTwin.git && cd ArchiTwin
./run.sh
```
Open http://localhost:8000. The first run creates `.venv` and installs packages (internet needed once). Stop with Ctrl+C. `run.bat` is untested; use WSL on Windows.

## Test
Run `./run.sh` once first so `.venv` exists, then from the repo root:
```
.venv/bin/python -m pytest
node --test
```

## Demo (3 minutes)
1. Choose **Twin-Gable Family Home (demo)**. Rotate it, use the Structure layer, click a column and a wall.
2. Press **Check all beams**: some turn red. Click one, then set **Beam depth h** to 0.45 m or switch to steel until all turn green.
3. Open **Material Comparison**.
4. Save the original and the modified design and view them side by side. Restart `./run.sh`: both are still there.
5. Open http://localhost:8000/docs and run `GET /designs`.

If anything fails, open `prototype/digital-twin-simulator.html` (single beam, no server).

## Folders
`backend/` FastAPI + SQLite (stores data, never calculates) · `frontend/` plain JS + Three.js (`calc.mjs` has all the maths) · `prototype/` fallback demo · `docs/` plan, source documents, `SOURCES.md` for material values.

## Known limitations
- Beam bending only: no shear, columns, foundations, wind or earthquake.
- Up to 2 floors and 3x3 bays; one uniform load.
- No login or blueprint upload.
- Windows are not clickable; clicking a wall lists its door and window sizes.
- In the Architecture layer a click can hit a wall or roof first; use the Structure layer.
- Material values are rounded teaching numbers; see `docs/SOURCES.md`.
