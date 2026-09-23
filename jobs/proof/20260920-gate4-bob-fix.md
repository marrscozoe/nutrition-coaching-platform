# Bob Fix Proof: Gate 4.2 — Unrecognized Items Must Reach AI

**Date:** 2026-09-20
**Commit:** `eaeacf3f` (force-pushed to update from broken first attempt)
**Branch:** main
**Deployment:** https://nutrition-coaching-platform-c6ge3gag9-marrscozoes-projects.vercel.app

---

## Problem

Gate 4.2 was failing: When a meal has both recognized items (e.g., "grilled chicken") AND unrecognized items (e.g., "xyzabc123"), the AI was deprioritizing the unrecognized item and not asking about it.

**Root Cause:** In `getMealEvaluationPrompt()` (ai-coach.ts), the "IMPORTANT" override that forces the AI to ask about unrecognized items was gated behind a `hasNoRecognizedItems` check. This check is `false` when ANY recognized items exist, so the override never fired when there were both recognized and unrecognized items.

**Before (broken):**
```javascript
const hasNoRecognizedItems = proteinItems.length === 0 && vegItems.length === 0 && starchItems.length === 0 && fatItems.length === 0;
if (hasNoRecognizedItems && analysis.unrecognizedItems.length > 0) {
  // IMPORTANT override only fires when ZERO recognized items
  p += `...ask about unrecognized items...`;
}
```

**After (fixed):**
```javascript
if (nonSugarUnrecognized.length > 0) {
  const hasNoRecognizedItems = ...;
  if (hasNoRecognizedItems) {
    // All items unrecognized — same behavior (no portion tips until clarified)
    p += `...ask about unrecognized items, no portion tips...`;
  } else {
    // Some items recognized, some not — acknowledge unrecognized AND give portion tips
    p += `...ask about unrecognized items, then normal portion tips...`;
  }
}
```

---

## Changes Made

**File:** `src/lib/ai-coach.ts`

Moved the "IMPORTANT" override inside the `if (nonSugarUnrecognized.length > 0)` block and changed the condition to always trigger when there are unrecognized items — regardless of whether recognized items exist:

- If ALL items unrecognized: same behavior (no portion tips until food clarified)
- If SOME items recognized: acknowledge unrecognized items AND give portion tips

---

## Verification

- TypeScript compilation: ✅ PASS (`npx tsc --noEmit --skipLibCheck` no errors)
- Deployment: ✅ Ready (production)

---

## Gates 1-3 Regression

No changes to food recognition logic — Gates 1-3 continue to pass as before.

---

## Proof SHA

`eaeacf3f`
