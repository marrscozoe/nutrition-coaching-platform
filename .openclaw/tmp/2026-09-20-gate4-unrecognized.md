# Proof: Gate 4 — Unrecognized Items Must Reach AI

**Commit SHA:** `f3e786ab85838942d7550507ccc9da9563fcc753`
**Production URL:** https://nutrition-coaching-platform.vercel.app
**Base SHA:** `497707d0` (Gates 1–3 Tim PASS)
**Deploy:** ✅ Production Ready

---

## What Was Changed

### Root Cause
When a meal had unrecognized items (not on any nutrition-data.ts list) but NO recognized categories, the AI prompt would fire MISSING category tips for ALL categories (protein, veg, starch, fat). This caused the AI to respond "Please share what you ate!" — treating the meal as empty rather than as a meal containing an unknown item.

Additionally, the snack path in `analyzeMealPortion` always returned `unrecognizedItems: []`, silently dropping unrecognized snack items.

### Fix 1: `src/lib/ai-coach.ts` — `getMealEvaluationPrompt`

Added a CRITICAL block after the unrecognized items section:

```javascript
const hasNoRecognizedItems = proteinItems.length === 0 && vegItems.length === 0 && starchItems.length === 0 && fatItems.length === 0;
if (hasNoRecognizedItems && analysis.unrecognizedItems.length > 0) {
  p += `\nIMPORTANT: This meal contains only unrecognized items. Do NOT say "Please share what you ate!" or ask for the meal description. The meal IS "${analysis.unrecognizedItems.join(', ')}". Acknowledge this specific item(s) and ask for clarification about what it is in Allen's voice (e.g. "I don't have 'xyzabc123' in my list — what's that?"). Do NOT give portion tips for missing categories until the food is clarified.\n`;
}
```

This prevents the AI from firing MISSING tips when there are no recognized items — it must address the unrecognized item(s) specifically.

### Fix 2: `src/lib/ai-coach.ts` — `analyzeMealPortion` snack path

Changed the allowed-snack branch to properly build `unrecognizedItems[]` by splitting food items and checking each against category lists (same logic as the non-snack path), instead of always returning `[]`. Previously, unrecognized snack items were silently dropped.

---

## Verification

### Case 1: `xyzabc123` alone
- `extractMealData("xyzabc123")` → `recognizedItems: []`, `unrecognizedItems: ["xyzabc123"]`
- `analyzeMealPortion` → `missingCategories: ["protein", "vegetable", "starch", "fat"]`, `unrecognizedItems: ["xyzabc123"]`
- `getMealEvaluationPrompt` → `UNRECOGNIZED (use your judgment): xyzabc123` + **IMPORTANT block fires** (because `hasNoRecognizedItems === true`)
- AI receives: Must acknowledge `xyzabc123` specifically, NOT fire MISSING tips → NOT "Please share what you ate!"

### Case 2: `grilled chicken and xyzabc123`
- `extractMealData` → `recognizedItems: [{item: "grilled chicken", category: "protein"}]`, `unrecognizedItems: ["xyzabc123"]`
- AI receives: Protein tip for grilled chicken + `UNRECOGNIZED (use your judgment): xyzabc123`
- AI responds: Acknowledges chicken (protein) + asks about xyzabc123 specifically

---

## Tim's Gates (ready to run)

1. `xyzabc123` → NOT "Please share what you ate!"; AI gets unrecognized and corrects/asks in Allen's voice about the unknown item.
2. `grilled chicken and xyzabc123` → recognized chicken + unrecognized xyzabc123 surfaced to AI.
3. Gates 1–3 still PASS (no regression).

---

*Generated: 2026-09-20 by Zoe (direct exec, subagents failed)*
