# TIM Gate 4 — Unrecognized Items Proof
**Date:** 2026-09-20
**Tester:** Tim (independent verification)
**Production SHA:** f3e786ab85838942d7550507ccc9da9563fcc753
**Client:** testclient_delet_test@test.com (ID: 2b485033-0f55-4982-9160-869da27ff793)
**Result:** FAIL

---

## Production Commit Verification
- Local git SHA: `f3e786ab85838942d7550507ccc9da9563fcc753`
- Commit message: `fix: Gate 4 — unrecognized items must reach AI not empty-meal fallback`
- Status: **PASS** — production commit confirmed at or beyond required SHA

---

## Gate 4.1 — xyzabc123 alone
**Input:** `xyzabc123`
**Expected:** Coach reply must NOT be "Please share what you ate!" — must acknowledge unknown item and ask what it is in Allen's voice.
**Actual Response:**
```
Hey, I don't have **"xyzabc123"** in my food list — what's that? I need to know what you're actually eating before I can give you real feedback.

---

**You need 6 ounces lean protein.**

**You need 2 cups fibrous vegetables.**

**You need 2 tablespoons olive oil or 1/2 avocado for healthy fat.**

**You need 32oz water.**
```
**Result: PASS** — Allen asks about xyzabc123, no empty-meal ask.

---

## Gate 4.2 — grilled chicken and xyzabc123
**Input:** `grilled chicken and xyzabc123`
**Expected:** Chicken treated as protein AND xyzabc123 surfaced as unrecognized (AI mentions/asks about the unknown item).
**Actual Response:**
```
Nice protein, but you're missing the essentials.

You need 2 cups fibrous vegetables.

You need 2 tablespoons olive oil or 1/2 avocado for healthy fat.

You need 32oz water.

Add some avocado for healthy fat — it'll round this out right.
```
**Result: FAIL** — Chicken correctly recognized as protein, but xyzabc123 is NOT surfaced as unrecognized. No ask about the unknown item. The AI treats the meal as a standard under-portion meal and ignores the unrecognized component entirely.

**Root Cause (code inspection):** In `getMealEvaluationPrompt()` (ai-coach.ts), when a meal has BOTH recognized and unrecognized items, the prompt includes `UNRECOGNIZED (use your judgment): xyzabc123` but does NOT include the critical override section that forces the AI to ask about it. The "IMPORTANT" section (which says "acknowledge this specific item(s) and ask for clarification about what it is in Allen's voice") only fires when `hasNoRecognizedItems` is true — i.e., only when the meal has zero recognized items. When there are recognized items, the AI uses its own judgment and deprioritizes the unrecognized item.

**Required fix:** Add an explicit instruction to the meal evaluation prompt that when unrecognizedItems.length > 0, the AI MUST acknowledge each unrecognized item and ask what it is in Allen's voice — regardless of whether recognized items are present.

---

## Gates 1–3 Regression Smoke
All regression tests PASS (no regression to empty-meal on real foods).

### Gate 1 — Burger protein path
**Input:** `burger with no bun`
**Response:** "Solid move skipping the bun — that's sugar and starch gone right there. But you're missing some key stuff. You need 2 cups fibrous vegetables. You need 2 tablespoons olive oil or 1/2 avocado for healthy fat. You need 32oz water."
**Result: PASS** — Protein recognized (AI says "Solid move skipping the bun"), no empty-meal ask.

### Gate 2 — Under-protein detection
**Input:** `I just had a small handful of almonds for lunch`
**Response:** "You need 6 ounces lean protein. You need 2 cups fibrous vegetables. You need 32oz water."
**Result: PASS** — Missing protein explicitly flagged.

### Gate 3 — Real food recognition / Phase 5 off-plan
**Input:** `I ate grilled salmon with asparagus and a tablespoon of olive oil`
**Response:** "Good. Protein, veggies, healthy fat — you're covered. You need 32oz water."
**Input:** `2 eggs scrambled with spinach and half an avocado`
**Response:** "Good. Protein, veggies, healthy fat — you're covered. You need 32oz water."
**Result: PASS** — Real foods recognized correctly, Phase 5 rules applied, no empty-meal ask.

---

## Summary
| Test | Result |
|------|--------|
| Gate 4.1: xyzabc123 alone | PASS |
| Gate 4.2: grilled chicken + xyzabc123 | **FAIL** |
| Gate 1 regression (burger protein) | PASS |
| Gate 2 regression (under-protein) | PASS |
| Gate 3 regression (real food / Phase 5) | PASS |
| Production SHA ≥ f3e786ab | PASS |

**Overall: FAIL** — Gate 4.2 not satisfied. Active job remains open.
