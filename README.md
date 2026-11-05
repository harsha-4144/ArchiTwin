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
node --test                               # frontend: calculations, generator, messages (run from the repo root)
```
Use plain `node --test` from the repo root (Node 18+; it finds `frontend/tests/*.test.mjs` by itself). Do not use `node --test frontend/tests`: it fails on Node 22.

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

## Sources and assumptions
Values are rounded teaching assumptions, not design data. Costs are rough. "Checked" means the page below was opened and shows a number or range near ours; the rounded value is ours.

| Material | Young's modulus E | Density | Thermal conductivity | Cost per m3 | Durability |
|---|---|---|---|---|---|
| Timber | 11 GPa. Checked: a Python library implementing EN 338:2016 (https://blueprints.readthedocs.io/en/stable/API%20reference/codes/eurocode/en_338_2016/chapter_5_classification_of_structural_timber/table_1/) gives C24 mean bending modulus 11.0 (N/mm2 = GPa x 1000 as listed). Only C24 is shown. Engineering ToolBox (https://www.engineeringtoolbox.com/young-modulus-d_417.html) lists 9 to 13 GPa for pine, oak, Douglas fir. | 600 kg/m3. Engineering ToolBox seasoned wood (https://www.engineeringtoolbox.com/wood-density-d_40.html): pines 350 to 850, oak 600 to 900. EN 338 C24 mean is 420 (same library page), so 600 is on the heavy side: ours is a rounded middle value. | 0.13 W/mK. Engineering ToolBox (https://engineeringtoolbox.com/thermal-conductivity-d_429.html): softwoods 0.12, hardwoods 0.16, pine 0.14 to 0.15. | typical teaching value, not verified | typical teaching value, not verified |
| Steel | 200 GPa. Checked: Engineering ToolBox (https://www.engineeringtoolbox.com/young-modulus-d_417.html) gives 200 GPa for structural steel ASTM A36. | 7850 kg/m3. Engineering ToolBox (https://www.engineeringtoolbox.com/density-solids-d_1265.html) gives 7820; ours is the common rounded 7850. | typical teaching value, not verified (the Engineering ToolBox page lists steel but shows no number) | typical teaching value, not verified | typical teaching value, not verified |
| Concrete | 25 GPa. Checked: IS 456:2000 clause 6.2.3.1 Ec = 5000 sqrt(fck) MPa, as quoted on a secondary site (https://infralens.in/code/IS-456-2000), gives 25 GPa for M25 (the BIS text itself was not opened). Engineering ToolBox shows 17 to 30 GPa. | 2400 kg/m3. Engineering ToolBox dense concrete 2000 to 2400 (https://www.engineeringtoolbox.com/density-solids-d_1265.html). IS 456 reinforced concrete unit weight 25 kN/m3 (about 2500 kg/m3), same secondary site. | 1.4 W/mK. Engineering ToolBox dense concrete 1.0 to 1.8 (https://engineeringtoolbox.com/thermal-conductivity-d_429.html). | typical teaching value, not verified | typical teaching value, not verified |

Cost (INR 30,000 / 470,000 / 20,000 per m3) is not taken from any Schedule of Rates. Durability (Medium / High / High) is a qualitative assumption.
