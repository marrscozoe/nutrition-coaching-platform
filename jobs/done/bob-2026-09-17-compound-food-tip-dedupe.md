# BOB: Fix compound food recognition, tip dedupe, and no-amount assumption

## Commit
`ff59e25e95c87edfa050dc8c379d666729977ac4`

## Preview
https://nutrition-coaching-platform-74cgcqe0n-marrscozoes-projects.vercel.app

## What was fixed

### BUG 1 — Compound foods missed
- `extractMealData`: extended fallback scan from veg-only to ALL categories (protein, veg, fat, starch). Guards against plain-water false positives.
- `analyzeMealPortion`: added full-string fallback after per-item loop for all categories. Catches "green beans with olive oil" → olive oil as fat, "3 beef enchiladas flour tortillas" → beef as protein + tortillas as starch.

### BUG 2 — Duplicate tips
- `getMealEvaluationPrompt`: dedupe corrections FIRST (normalize + dedupe), then build coveredCategories set. Only add MISSING section tip if category not already covered. Final dedupe pass catches any remaining normalized duplicates.

### BUG 3 — No-amount fat nag
- After Bug 1 fix: "green beans with olive oil" → hasFat=true. checkItemPortionCorrection sees no stated portion → returns null (Rule 1: no portion = assume correct). No fat correction added. MISSING section also won't add fat tip since missingCategories won't contain 'fat'.

### BUG 4 — Phase 1 REMOVE tortillas
- Already correctly handled: Phase 1 starch block pushes tortillas to disallowedItems; REMOVE section formats them as "⚠️ Remove: tortillas".

## Regression guard preserved
- Plain-water guard (24oz water ≠ Water chestnuts) untouched in both functions.

## Test case
Meal: "32oz water. 3 beef enchiladas flour tortillas. 2 cups green beans with olive oil"
Phase: 1, Male

Expected:
- hasProtein=true (beef)
- hasVeg=true (green beans)
- hasFat=true (olive oil — no amount stated → no fat portion correction)
- hasStarch=true (tortillas)
- disallowedItems includes flour tortillas/tortillas (Phase 1 REMOVE)
- NO fat tip ("You need 2 tbsp healthy fats") since olive oil present with no stated amount = assumed correct
- NO duplicate tips
