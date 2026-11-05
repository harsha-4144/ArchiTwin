@echo off
REM ADT: one command runs everything. No internet needed at runtime.
cd /d "%~dp0"
set PY=python
if exist .venv\Scripts\python.exe set PY=.venv\Scripts\python.exe
if "%ADT_DB%"=="" set ADT_DB=backend\adt.db
if not exist "%ADT_DB%" %PY% -c "import sqlite3,os;p=os.environ['ADT_DB'];os.makedirs(os.path.dirname(p) or '.',exist_ok=True);sqlite3.connect(p).close();print('Created',p)"
echo ADT running at http://localhost:8000  (Ctrl+C to stop)
%PY% -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
