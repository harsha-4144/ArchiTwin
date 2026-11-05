"""ADT backend: stores and returns data only. It NEVER calculates (see frontend/calc.mjs).

params keys (validated only if present, others such as walls, roof, windows pass through):
  floors 1-2, bays_x 1-3, bays_z 1-3, span_x 2-8 m, span_z 2-8 m, floor_height 2.5-4 m,
  roof_type flat|shed|gable, roof_pitch, material (must exist in /materials),
  beam_type simply_supported|cantilever, beam_b, beam_h, load, walls, roof, windows ...
summary keys (stored as sent): pass/fail counts, worst deflection, total weight, total cost.
"""
import math
import json
import os
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Any, Dict

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, model_validator

from .db import connect, init_db

@asynccontextmanager
async def lifespan(_app):
    init_db()
    yield


app = FastAPI(title="ADT API", lifespan=lifespan)


@app.exception_handler(RequestValidationError)
async def bad_request(_: Request, exc: RequestValidationError):
    # Echoing the input back would crash on NaN/inf, so send only location and message.
    return JSONResponse(status_code=422, content={"detail": [
        {"loc": [str(x) for x in e.get("loc", ())], "msg": str(e.get("msg", "invalid"))} for e in exc.errors()]})
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FRONTEND = os.path.join(ROOT, "frontend")

RANGES = {"floors": (1, 2, True), "bays_x": (1, 3, True), "bays_z": (1, 3, True),
          "span_x": (2, 8, False), "span_z": (2, 8, False), "floor_height": (2.5, 4, False)}
CHOICES = {"beam_type": {"simply_supported", "cantilever"}, "roof_type": {"flat", "shed", "gable"}}
POSITIVE = ("roof_pitch", "beam_b", "beam_h", "load")  # reject negatives only


def _num(v):
    return isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v)


def _all_finite(v) -> bool:
    if isinstance(v, float):
        return math.isfinite(v)
    if isinstance(v, dict):
        return all(_all_finite(x) for x in v.values())
    if isinstance(v, (list, tuple)):
        return all(_all_finite(x) for x in v)
    return True


def validate_params(p: Dict[str, Any], materials) -> None:
    if not _all_finite(p):
        raise ValueError("params must not contain NaN or infinity")
    for k, (lo, hi, integer) in RANGES.items():
        if k in p:
            v = p[k]
            if not _num(v) or not lo <= v <= hi or (integer and v != int(v)):
                raise ValueError(f"{k} must be {'an integer ' if integer else ''}between {lo} and {hi}")
    for k, ok in CHOICES.items():
        if k in p and p[k] not in ok:
            raise ValueError(f"{k} must be one of {sorted(ok)}")
    for k in POSITIVE:
        if k in p and (not _num(p[k]) or p[k] < 0):
            raise ValueError(f"{k} must be a non-negative number")
    if "material" in p and p["material"] not in materials:
        raise ValueError(f"unknown material {p['material']!r}")


class DesignIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    params: Dict[str, Any]
    summary: Dict[str, Any]

    @model_validator(mode="after")
    def check(self):
        con = connect()
        mats = {r["name"] for r in con.execute("SELECT name FROM materials")}
        con.close()
        validate_params(self.params, mats)
        if not _all_finite(self.summary):
            raise ValueError("summary must not contain NaN or infinity")
        for k, v in self.summary.items():
            if _num(v) and v < 0:
                raise ValueError(f"summary.{k} must not be negative")
        return self


def _design(r):
    return {"id": r["id"], "name": r["name"], "created_at": r["created_at"],
            "params": json.loads(r["params_json"]), "summary": json.loads(r["summary_json"])}


@app.get("/health")
def health():
    return {"status": "ok"}


def wants_html(request: Request) -> bool:
    """True only when the Accept header explicitly prefers text/html over JSON (browser navigation).
    fetch(), curl and API clients send */* or application/json and keep getting JSON."""
    q = {}
    for part in request.headers.get("accept", "").split(","):
        bits = [b.strip() for b in part.split(";")]
        if not bits[0]:
            continue
        w = 1.0
        for b in bits[1:]:
            if b.startswith("q="):
                try:
                    w = float(b[2:])
                except ValueError:
                    w = 0.0
        q[bits[0].lower()] = w
    html = q.get("text/html", 0.0)
    other = max(q.get("application/json", 0.0), q.get("application/*", 0.0), q.get("*/*", 0.0))
    return html > 0 and html >= other and html > q.get("application/json", 0.0)


def page(name: str) -> FileResponse:
    return FileResponse(os.path.join(FRONTEND, name), media_type="text/html; charset=utf-8", headers={"Vary": "Accept"})


@app.get("/", include_in_schema=False)
def home_page():
    return page("home.html")


@app.get("/studio", include_in_schema=False)
def studio_page():
    return page("studio.html")


@app.get("/learn", include_in_schema=False)
def learn_page():
    return page("learn.html")


@app.get("/about", include_in_schema=False)
def about_page():
    return page("about.html")


@app.get("/materials")
def materials(request: Request, response: Response):
    if wants_html(request):
        return page("materials.html")
    response.headers["Vary"] = "Accept"
    con = connect()
    rows = [dict(r) for r in con.execute("SELECT * FROM materials ORDER BY id")]
    con.close()
    return rows


@app.get("/designs")
def list_designs(request: Request, response: Response):
    if wants_html(request):
        return page("designs.html")
    response.headers["Vary"] = "Accept"
    con = connect()
    rows = [_design(r) for r in con.execute("SELECT * FROM designs ORDER BY id")]
    con.close()
    return rows


@app.post("/designs", status_code=201)
def create_design(d: DesignIn):
    con = connect()
    with con:
        cur = con.execute(
            "INSERT INTO designs(name,created_at,params_json,summary_json) VALUES(?,?,?,?)",
            (d.name, datetime.now(timezone.utc).isoformat(timespec="seconds"),
             json.dumps(d.params), json.dumps(d.summary)))
    r = con.execute("SELECT * FROM designs WHERE id=?", (cur.lastrowid,)).fetchone()
    con.close()
    return _design(r)


INT64 = (-2**63, 2**63 - 1)


def _unknown(design_id: int) -> bool:
    """SQLite INTEGER is int64; anything outside cannot exist (and would raise OverflowError)."""
    return not INT64[0] <= design_id <= INT64[1]


@app.get("/designs/{design_id}")
def get_design(design_id: int):
    if _unknown(design_id):
        raise HTTPException(404, "design not found")
    con = connect()
    r = con.execute("SELECT * FROM designs WHERE id=?", (design_id,)).fetchone()
    con.close()
    if not r:
        raise HTTPException(404, "design not found")
    return _design(r)


@app.delete("/designs/{design_id}", status_code=204)
def delete_design(design_id: int):
    if _unknown(design_id):
        raise HTTPException(404, "design not found")
    con = connect()
    with con:
        n = con.execute("DELETE FROM designs WHERE id=?", (design_id,)).rowcount
    con.close()
    if not n:
        raise HTTPException(404, "design not found")
    return Response(status_code=204)


# Static frontend last, so API routes take priority.
# Pages are explicit routes above; StaticFiles serves css/, js/, vendor/ and the .mjs modules.
app.mount("/", StaticFiles(directory=FRONTEND), name="frontend")
