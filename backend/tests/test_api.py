import json
import pytest
from fastapi.testclient import TestClient

GOOD = {"name": "t", "params": {"floors": 2, "bays_x": 2, "bays_z": 1, "span_x": 5, "span_z": 4,
        "floor_height": 3, "roof_type": "gable", "material": "timber",
        "beam_type": "simply_supported", "windows": 2},
        "summary": {"pass": 3, "fail": 1, "worst_deflection_mm": 4.2, "weight_kg": 900, "cost": 1234}}


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("ADT_DB", str(tmp_path / "t.db"))
    from backend.main import app
    with TestClient(app) as c:
        yield c


def test_health_and_materials(client):
    assert client.get("/health").json() == {"status": "ok"}
    m = {r["name"]: r for r in client.get("/materials").json()}
    assert {"timber", "steel", "concrete"} <= set(m)
    assert m["steel"]["e_gpa"] == 200 and m["concrete"]["note"] == "rounded teaching assumption"


def test_crud(client):
    r = client.post("/designs", json=GOOD)
    assert r.status_code == 201
    i = r.json()["id"]
    assert client.get(f"/designs/{i}").json()["params"]["windows"] == 2
    assert len(client.get("/designs").json()) == 1
    assert client.delete(f"/designs/{i}").status_code == 204
    assert client.get(f"/designs/{i}").status_code == 404
    assert client.delete(f"/designs/{i}").status_code == 404


@pytest.mark.parametrize("k,v", [("floors", 3), ("floors", 0), ("bays_x", 4), ("bays_z", -1),
    ("span_x", 1), ("span_z", 9), ("floor_height", 2), ("floor_height", 5), ("material", "wood"),
    ("beam_type", "fixed"), ("roof_type", "dome"), ("load", -5), ("floors", 1.5)])
def test_rejects_bad_params(client, k, v):
    body = {**GOOD, "params": {**GOOD["params"], k: v}}
    assert client.post("/designs", json=body).status_code == 422


def test_rejects_bad_shape(client):
    assert client.post("/designs", json={**GOOD, "params": []}).status_code == 422
    assert client.post("/designs", json={**GOOD, "summary": "x"}).status_code == 422
    assert client.post("/designs", json={"name": "x"}).status_code == 422


def test_persists_across_restart(tmp_path, monkeypatch):
    monkeypatch.setenv("ADT_DB", str(tmp_path / "p.db"))
    from backend.main import app
    with TestClient(app) as c:
        i = c.post("/designs", json=GOOD).json()["id"]
    with TestClient(app) as c:
        assert c.get(f"/designs/{i}").status_code == 200
        assert len(c.get("/materials").json()) == 3


@pytest.mark.parametrize("raw", ["NaN", "Infinity", "-Infinity", "1e999"])
@pytest.mark.parametrize("where", ["span_x", "load", "summary"])
def test_rejects_non_finite(client, raw, where):
    if where == "summary":
        body = json.dumps(GOOD).replace('"cost": 1234', '"cost": RAW').replace("RAW", raw)
    else:
        body = json.dumps({**GOOD, "params": {**GOOD["params"], where: 0}}).replace(f'"{where}": 0', f'"{where}": {raw}')
    r = client.post("/designs", content=body, headers={"content-type": "application/json"})
    assert r.status_code == 422
