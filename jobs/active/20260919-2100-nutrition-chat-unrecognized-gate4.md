# Gate 4 — Unrecognized Items AI Handling
**Status:** FAIL (Gate 4.2 unresolved)
**Created:** 2026-09-19 21:00
**Assigned:** Tim (independent verification 2026-09-20)

## Issue
Allen Law (2026-09-20): If logged food is not on nutrition-data.ts lists, program code must tell the AI unrecognized/off-list; AI must catch and correct in Allen's voice. Never silent-drop. Never fall through to empty-meal "Please share what you ate!"

## Test Results
- Gate 4.1 (xyzabc123 alone): **PASS**
- Gate 4.2 (grilled chicken + xyzabc123): **FAIL** — unrecognized item not surfaced when mixed with recognized items
- Gates 1–3 regression: **PASS**

## Proof
See: `jobs/proof/20260920-tim-gate4-unrecognized.md`

## Blocker
`getMealEvaluationPrompt()` in `src/lib/ai-coach.ts` only forces AI to ask about unrecognized items when `hasNoRecognizedItems` is true. When a meal has both recognized and unrecognized items, the unrecognized item is listed but not explicitly surfaced with an ask instruction. Fix required: add explicit "ask about each unrecognized item" instruction to the prompt regardless of whether recognized items are present.
