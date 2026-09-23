# TIM — Gate 4 only: unrecognized item must reach AI (FAIL not PARTIAL)

**Repo:** ~/.openclaw/workspace/nutrition-coaching-platform
**Live:** https://nutrition-coaching-platform.vercel.app
**Bob SHA (must be on production):** `f3e786ab85838942d7550507ccc9da9563fcc753`
**Base:** `497707d0` (Gates 1–3 previously PASS)
**You are Tim only. Do NOT spawn Bob. Serial cabinet — one agent.**

Bob already shipped Gate 4 to production. Proof: `jobs/proof/2026-09-20-gate4-unrecognized.md`.
Confirm live deploy meta/githubCommitSha is `f3e786ab…` (or later ancestor of that SHA).

## Allen standing law
If logged food is not on nutrition-data.ts lists, program code must tell the AI unrecognized/off-list; AI must catch and correct in Allen's voice. Never silent-drop. Never fall through to empty-meal “Please share what you ate!”

## Hard gates — FAIL any miss (no PARTIAL PASS)
1. Log exactly `xyzabc123` (alone) → coach reply must NOT be “Please share what you ate!” (or equivalent empty-meal ask). Must acknowledge the unknown item and ask what it is in Allen’s voice.
2. Log `grilled chicken and xyzabc123` → chicken treated as protein AND xyzabc123 surfaced as unrecognized (AI mentions/asks about the unknown item).
3. Re-run Gates 1–3 regression smoke still PASS (meal recognition / Phase 5 off-plan / under-protein / burger protein path from prior P0 — no regression to empty-meal on real foods).
4. Production commit ≥ `f3e786ab`. Write proof to `jobs/proof/20260920-tim-gate4-unrecognized.md` with PASS or FAIL, exact AI reply quotes, and SHA checked.
5. On PASS: move `jobs/active/20260919-2100-nutrition-chat-unrecognized-gate4.md` to `jobs/done/`. On FAIL: leave active and write FAIL proof; do not mark PARTIAL.
6. Ping Presley webhook on PASS or FAIL (Zoe-done webhook if configured).

**Test client:** `testclient_delet_test@test.com` (reuse — never create new test clients).
**Proof path:** /Users/openclawassistant/.openclaw/workspace/jobs/proof/20260920-tim-gate4-unrecognized.md
