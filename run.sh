#!/usr/bin/env bash
# ADT: one command runs everything. No internet needed at runtime.
set -e
cd "$(dirname "$0")"
if [ -f .venv/bin/activate ]; then . .venv/bin/activate; PY=python; else PY=python3; fi
export ADT_DB="${ADT_DB:-backend/adt.db}"
# Create the DB file if missing (stage 1 backend creates tables on startup)
[ -f "$ADT_DB" ] || $PY -c "import sqlite3,os;p=os.environ['ADT_DB'];os.makedirs(os.path.dirname(p) or '.',exist_ok=True);sqlite3.connect(p).close();print('Created',p)"
if $PY -c "import socket,sys;s=socket.socket();s.settimeout(1);sys.exit(0 if s.connect_ex(('127.0.0.1',8000))==0 else 1)"; then
  echo "ERROR: port 8000 is already in use (is ADT already running?). Stop it and try again." >&2
  exit 1
fi
echo "ADT running at http://localhost:8000  (Ctrl+C to stop)"
exec $PY -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
