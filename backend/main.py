"""ADT backend: stores and returns data only. It NEVER calculates (see frontend/calc.mjs).

params keys (validated only if present, others such as walls, roof, windows pass through):
  floors 1-2, bays_x 1-3, bays_z 1-3, span_x 2-8 m, span_z 2-8 m, floor_height 2.5-4 m,
  roof_type flat|shed|gable, roof_pitch, material (must exist in /materials),
  beam_type simply_supported|cantilever, beam_b, beam_h, load, walls, roof, windows ...
summary keys (stored as sent): pass/fail counts, worst deflection, total weight, total cost.
"""
import json
import os
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Any, Dict

from fastapi import FastAPI, HTTPException, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, model_validator

from .db import connect, init_db

@asynccontextmanager
async def lifespan(_app):
    init_db()
    yield


app = FastAPI(title="ADT API", lifespan=lifespan)
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FRONTEND = os.path.join(ROOT, "frontend")

RANGES = {"floors": (1, 2, True), "bays_x": (1, 3, True), "bays_z": (1, 3, True),
          "span_x": (2, 8, False), "span_z": (2, 8, False), "floor_height": (2.5, 4, False)}
CHOICES = {"beam_type": {"simply_supported", "cantilever"}, "roof_type": {"flat", "shed", "gable"}}
POSITIVE = ("roof_pitch", "beam_b", "beam_h", "load")  # reject negatives only


def _num(v):
    return isinstance(v, (int, float)) and not isinstance(v, bool)


def validate_params(p: Dict[str, Any], materials) -> None:
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


@app.get("/materials")
def materials():
    con = connect()
    rows = [dict(r) for r in con.execute("SELECT * FROM materials ORDER BY id")]
    con.close()
    return rows


@app.get("/designs")
def list_designs():
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


@app.get("/designs/{design_id}")
def get_design(design_id: int):
    con = connect()
    r = con.execute("SELECT * FROM designs WHERE id=?", (design_id,)).fetchone()
    con.close()
    if not r:
        raise HTTPException(404, "design not found")
    return _design(r)


@app.delete("/designs/{design_id}", status_code=204)
def delete_design(design_id: int):
    con = connect()
    with con:
        n = con.execute("DELETE FROM designs WHERE id=?", (design_id,)).rowcount
    con.close()
    if not n:
        raise HTTPException(404, "design not found")
    return Response(status_code=204)


# Static frontend last, so API routes take priority.
os.makedirs(FRONTEND, exist_ok=True)
if not os.path.exists(os.path.join(FRONTEND, "index.html")):
    with open(os.path.join(FRONTEND, "index.html"), "w") as f:
        f.write("<!doctype html><title>ADT</title><h1>ADT placeholder</h1>")
app.mount("/", StaticFiles(directory=FRONTEND, html=True), name="frontend")
