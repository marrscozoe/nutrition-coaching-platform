# REGRESSION GATES — Meal Recognition P0

These strings must always produce correct meal analysis results.
Run after any change to `nutrition-data.ts`, `ai-coach.ts`, or food-list changes.

---

## Gate 1: Phase 1 Male Dinner (2026-09-14)

**Input:**
```
📸 DINNER — Mon, Sep 14. 32oz water. 3 beef enchiladas flour tortillas. 2 cups green beans with olive oil.
```

**Expected Phase 1 Male Dinner Results:**
- `hasProtein === true` (beef detected in compound item "3 beef enchiladas flour tortillas")
- `hasVeg === true` (green beans detected)
- `hasFat === true` (olive oil detected)
- `hasStarch === true` (flour tortillas detected)
- `disallowedItems` includes flour tortillas → "Phase 1 REMOVE" tip fires
- `missingCategories` is EMPTY — NO protein tip, NO veg tip, NO fat tip
- `corrections` contains ONLY the Phase 1 starch warning — NO "need 2 tablespoons healthy fats" tip
- Water (32oz water) does NOT count as vegetable
- The "2 cups" amount binds to green beans, NOT to olive oil

**Anti-regression rules enforced:**
1. Punctuation/commas/dates never block food recognition
2. No amount stated → assume correct portion, no tip
3. Wrong amount → advise correct amount once
4. AI must not invent competing tips
5. Compound items detect ALL food categories present

---

## Gate 2: Order-Independence

**Input:** `"6 oz chicken breast, 1 cup broccoli, 1 tbsp olive oil"`
**Expected:** `proteinOz=6, vegCups=1, fatTbsp=1`

**Input:** `"1 tbsp olive oil, 1 cup broccoli, 6 oz chicken breast"` (reverse order)
**Expected:** Same as above

---

## Gate 3: Water ≠ Vegetable

**Input:** `"32oz water"`
**Expected:** `hasVeg=false, hasWater=true` (water chestnuts ≠ plain water)

---

## Gate 4: Phase 1 No-Starch Tip Only

**Input:** `"6oz chicken 1cup broccoli 1tbsp olive oil"` (Phase 1, no starch)
**Expected:** `missingCategories=[], corrections=[]` (perfect meal — no tips)
