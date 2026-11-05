# Architectural Digital Twin cum Simulator (ADT)

A browser app for architecture students. Pick a small building, change its parameters (floors, bays, spans, material, beam size, load, roof, doors, windows) and see the 3D model, beam deflection checks, weight, cost and cause-and-effect messages update at once. Designs can be saved, reloaded and compared.

**Limits (please read).** This is a *virtual model* of a design. It has **no live sensor or real-data link**. It uses the standard beam deflection formula with stated assumptions (solid rectangular section, evenly spread load, simple supports or cantilever, limit span/250). It is for learning, not for designing a real building. Material values are rounded teaching numbers.

## Requirements
- Python 3.10+ (3.12 tested), Node 18+ (only for the tests), Linux/WSL/Mac or Windows.
- No internet at runtime. Three.js is bundled in `frontend/vendor/`. The only internet use is a one-time `pip install` of fastapi and uvicorn (see below).

## Run (one command)
```
./run.sh        # Linux / WSL / Mac
run.bat         # Windows
```
Then open http://localhost:8000. On the very first run `run.sh` creates `.venv` and installs `fastapi uvicorn pytest httpx` (internet needed once). On Windows create the venv yourself first: `python -m venv .venv` then `.venv\Scripts\pip install fastapi uvicorn pytest httpx`. The SQLite file `backend/adt.db` is created automatically (set `ADT_DB` to use another path). Stop with Ctrl+C.

## Tests
```
python -m pytest                          # backend (use .venv/bin/python if not activated)
node --test frontend/tests/*.test.mjs     # calculations and building generator
```
Use the glob form; the bare directory form fails on Node 22.

## Folder map
- `backend/` FastAPI + SQLite. Stores materials and saved designs. It never calculates.
- `frontend/` plain JS + Three.js. `calc.mjs` holds ALL calculation; `building.mjs` generates the model; `app.js` is the UI.
- `prototype/` earlier single-file version (fallback demo, see below).
- `docs/` source documents and reference images. `ADT_Plan.pdf` is the decision record.

## API (http://localhost:8000/docs for the interactive page)
- `GET /health`
- `GET /materials`
- `GET /designs`, `POST /designs`
- `GET /designs/{id}`, `DELETE /designs/{id}`

## 3-minute demo script
1. Choose **Two-storey house (demo)**. Rotate it, switch layer to hide the walls and show the frame, click a column and a window.
2. In the Analysis panel press **Check all beams**: some turn red. Click a red beam, read how far it bends, make it deeper (or switch to steel) until it turns green.
3. Open **Material Comparison**: weight, cost and pass count for timber, steel and concrete.
4. Save the original design and the modified design, set one as original and view them side by side. Stop the server and run `./run.sh` again: both are still listed.
5. Open http://localhost:8000/docs, run `GET /designs` to show the stored rows. Show the passing test output.

## Fallback demo
If anything fails, open `prototype/digital-twin-simulator.html` directly in a browser (single beam, no server).

## Known limitations
- Beam deflection only: no shear, moment capacity, columns, foundations, wind or seismic checks.
- Caps: 2 floors and 3x3 bays. One uniform load for the whole building.
- Single local user: no login, no blueprint upload.
- Designs saved by the backend are not edited in place; save under a new name instead.

## Open item O6
Material values (modulus, density, cost in rupees) are rounded assumptions. Citing a published source for them is still **open**.
