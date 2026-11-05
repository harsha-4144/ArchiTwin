# ADT kit: start here

1. Pre-flight (10 min, once). In Ubuntu/WSL:
   - `python3 --version` (3.10+), `node --version` (18+), `git --version`.
   - `pip install fastapi uvicorn pytest httpx` (use a venv if pip complains: `python3 -m venv .venv && source .venv/bin/activate`).
   - Chrome on Windows is fine for viewing at http://localhost:8000.
2. Unzip this kit into an empty folder called `adt`, then:  `cd adt && git init && git add -A && git commit -m "Kit"`
3. Run `claude` in that folder. It reads CLAUDE.md automatically.
4. Paste Prompt A from docs/STAGE_PROMPTS.md. Wait for READY. Check its report.
5. Paste Prompt B. It builds stages 1 to 8 by itself, one fresh helper per stage, and writes PROGRESS.md.
6. If it stops (usage limit, crash), start `claude` again and paste the Resume line.
7. When done: run `./run.sh`, open http://localhost:8000, follow the demo script in ADT_Plan.pdf section 8.
8. Stage 9 (student test) is you plus 3 to 5 students. Not Claude.

Files: ADT_Plan.pdf (decisions and gates) · docs/Ideate_Phase.pdf (source) · docs/reference/ (PDF images to copy the look from) · prototype/ (single-beam fallback demo) · .claude/agents/ (5 read-only reviewers).
