"""SQLite storage. Path from env ADT_DB (default backend/adt.db). Created if missing."""
import os
import sqlite3

DEFAULT_DB = os.path.join(os.path.dirname(os.path.abspath(__file__)), "adt.db")

SCHEMA = """
CREATE TABLE IF NOT EXISTS materials(
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE NOT NULL,
  e_gpa REAL NOT NULL, density REAL NOT NULL, conductivity REAL NOT NULL,
  cost_per_m3 REAL NOT NULL, note TEXT);
CREATE TABLE IF NOT EXISTS designs(
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
  created_at TEXT NOT NULL, params_json TEXT NOT NULL, summary_json TEXT NOT NULL);
"""


def db_path():
    return os.environ.get("ADT_DB") or DEFAULT_DB


def connect():
    p = db_path()
    os.makedirs(os.path.dirname(os.path.abspath(p)), exist_ok=True)
    con = sqlite3.connect(p)
    con.row_factory = sqlite3.Row
    return con


def init_db():
    from .seed import seed
    con = connect()
    with con:
        con.executescript(SCHEMA)
        seed(con)
    con.close()
