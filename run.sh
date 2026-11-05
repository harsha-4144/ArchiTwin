#!/usr/bin/env bash
# ADT: one command runs everything. No internet needed at runtime.
set -e
cd "$(dirname "$0")"
if [ -f .venv/bin/activate ]; then . .venv/bin/activate; PY=python; else PY=python3; fi
export ADT_DB="${ADT_DB:-backend/adt.db}"
# Create the DB file if missing (stage 1 backend creates tables on startup)
[ -f "$ADT_DB" ] || $PY -c "import sqlite3,os;p=os.environ['ADT_DB'];os.makedirs(os.path.dirname(p) or '.',exist_ok=True);sqlite3.connect(p).close();print('Created',p)"
echo "ADT running at http://localhost:8000  (Ctrl+C to stop)"
exec $PY -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
