# Prompts

## Prompt A: readiness check + stage 0 (paste first)
```
Read CLAUDE.md and ADT_Plan.pdf fully (use pdftotext), and docs/Ideate_Phase.pdf. Then do a READINESS CHECK before any work. Fix nothing in the plan or docs; only report.

1. Files: confirm these exist: CLAUDE.md, START_HERE.md, ADT_Plan.pdf, docs/Ideate_Phase.pdf, docs/STAGE_PROMPTS.md, the six images in docs/reference/, prototype/digital-twin-simulator.html, and the five agents in .claude/agents/. View the six reference images with the Read tool.
2. Tools: report version and pass/fail for python3 (>=3.10), node (>=18), npm, git (user.name and user.email set). Create a venv in .venv, pip install fastapi uvicorn pytest httpx, and confirm `python -c "import fastapi, uvicorn, httpx, pytest"` works. Confirm port 8000 is free.
3. Vendor files: in a temp folder run `npm i three`, then confirm build/three.module.min.js and examples/jsm/controls/OrbitControls.js exist. Do not copy them yet.
4. Maths: in a throwaway script (not the app), compute the plan's tests A, B, C and paste the results. They must be 4.40 mm, 1.64 mm, 5.78 mm. If they differ, STOP and report.
5. Consistency: check that the plan's stages 0 to 8 each have a gate, that every feature in the Ideate PDF's selected direction (section 6) is covered or explicitly LATER/DROPPED, that the screen layout described in the plan matches docs/reference/mind_map.jpg, and that nothing in the plan contradicts itself. List anything that would make you stop and ask during the build. Anything marked LOCKED is not a question.
6. Verdict: READY or NOT READY with the exact blockers.

If READY, do STAGE 0 only (setup): create the folders and run.sh and run.bat, copy the two vendor files into frontend/vendor/, confirm the prototype file opens (headless Chrome or a quick parse), git commit "Stage 0". Then stop and give a STAGE 0 REPORT: what you did, what you verified, anything unclear.
```

## Prompt B: build stages 1 to 8 (paste after Stage 0 looks good)
```
Build stages 1 to 8 from ADT_Plan.pdf section 5, in order, by yourself. Keep CLAUDE.md rules.

For EACH stage:
1. Start a fresh subagent (Agent tool) for that stage. Give it: the stage number, its gate text from the plan, the relevant LOCKED decisions, and "read CLAUDE.md and ADT_Plan.pdf; touch only files for this stage". For stage 4 also tell it to view docs/reference/ images first.
2. The subagent implements the stage, runs `python -m pytest` and `node --test frontend/tests`, and proves the stage GATE with real command output (not "should work").
3. If the gate fails, the subagent fixes it and re-runs. If it still fails after 3 tries, STOP the whole build and report the failure; do not skip the stage.
4. When the gate passes: `git add -A && git commit -m "Stage N: <name>"`, and append to PROGRESS.md: stage, gate result, commit hash, any assumption you made.

Reviewers: after stage 4 (M1) run code-reviewer, math-reviewer, spec-reviewer and design-reviewer in parallel with the Agent tool. After stage 8 (M2) run all five in parallel. Fix only what they list, re-run only the reviewer that failed, commit "Review fixes M1" or "Review fixes M2".

Rules while building: no features outside the plan; calculation only in frontend/calc.mjs; backend stores data only; never edit a test to make it pass; never claim something works without showing the output; if a LOCKED decision seems wrong, stop and ask instead of changing it.

At the end give a BUILD REPORT: each stage's gate result, reviewer findings and how they were fixed, how to run (`./run.sh`), the demo script from plan section 8 walked through once for real, and everything not done or not verified.
```

## Resume (if it stops)
```
Read CLAUDE.md, ADT_Plan.pdf and PROGRESS.md. Check `git log` and `git status` (stash or report any uncommitted work first). Find the last stage whose gate passed, and continue Prompt B from the next stage. Do not redo finished stages.
```

## One stage at a time (if you prefer manual control)
```
Do STAGE N only, from ADT_Plan.pdf section 5. Use a fresh subagent. Prove the gate with real test output, commit, update PROGRESS.md, then stop and report.
```
