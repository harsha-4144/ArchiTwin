#!/usr/bin/env bash
# ADT: one command runs everything. No internet needed at runtime.
set -e
cd "$(dirname "$0")"
# One-time setup (needs internet once): create .venv and install dependencies if missing.
if ! command -v python3 >/dev/null 2>&1; then
  echo "ERROR: python3 not found. Install Python 3.10 or newer." >&2; exit 1
fi
if ! python3 -c "import sys;sys.exit(0 if sys.version_info>=(3,10) else 1)"; then
  echo "ERROR: Python 3.10 or newer is required (found $(python3 --version 2>&1))." >&2; exit 1
fi
if [ ! -x .venv/bin/python ]; then
  echo "First run: creating .venv and installing fastapi, uvicorn, pytest, httpx (internet needed once)..."
  rm -rf .venv
  if ! python3 -m venv .venv; then
    rm -rf .venv
    echo "ERROR: could not create .venv. On Debian/Ubuntu run: sudo apt install python3-venv" >&2; exit 1
  fi
  if ! .venv/bin/pip install fastapi uvicorn pytest httpx; then
    rm -rf .venv
    echo "ERROR: pip install failed (is the internet connected?). Fix it and run ./run.sh again." >&2; exit 1
  fi
fi
. .venv/bin/activate; PY=python
export ADT_DB="${ADT_DB:-backend/adt.db}"
# Create the DB file if missing (stage 1 backend creates tables on startup)
[ -f "$ADT_DB" ] || $PY -c "import sqlite3,os;p=os.environ['ADT_DB'];os.makedirs(os.path.dirname(p) or '.',exist_ok=True);sqlite3.connect(p).close();print('Created',p)"
if $PY -c "import socket,sys;s=socket.socket();s.settimeout(1);sys.exit(0 if s.connect_ex(('127.0.0.1',8000))==0 else 1)"; then
  echo "ERROR: port 8000 is already in use (is ADT already running?). Stop it and try again." >&2
  exit 1
fi
echo "ADT running at http://localhost:8000  (Ctrl+C to stop)"
exec $PY -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
