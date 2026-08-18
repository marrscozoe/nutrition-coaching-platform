# Meal Evaluation Protocol — SPEC

**Date:** 2026-08-18
**Status:** Ready for Bob to build
**Team:** Bob builds → Tim tests

---

## Overview

Replace the current meal evaluation approach with a **Hybrid Code + AI** system:
- **Code** does structured food matching against approved food lists
- **AI** receives structured data and delivers coaching in Allen's voice
- Same flow for both: Food Log tab AND Chat tab

---

## Food Categories (Source of Truth: `nutrition-data.ts`)

These are already defined — no changes needed:
- `LEAN_PROTEINS`
- `FIBROUS_VEGETABLES`
- `STARCHY_CARBOHYDRATES`
- `HEALTHY_FATS`

---

## Supplement Category (NEW)

Add a new category:
- `SUPPLEMENTS`: Whey protein, Creatine, Protein drink, Meal replacement, Vitamin

Supplement rules:
- Phase 6: Whey protein + Creatine required (home tab reminds clients)
- AI only discusses supplements when **client asks about them**
- AI does NOT proactively remind clients about supplements

---

## Phase Rules (Source of Truth: `nutrition-data.ts` / `getPortions()`)

| Phase | Protein | Veggies | Fat | Starch | Dairy | Water |
|-------|---------|---------|-----|--------|-------|-------|
| 1 | Required | Required | Required | NOT allowed | Not allowed | Required |
| 2 | Required | Required | Required | Wed/Sat/Sun B/L only | Not allowed | Required |
| 4 | Required | Required | Required | Every meal | Allowed | Required |
| 5 | Required | Required | Required | Follows 3-day rotating sub-phase | Not allowed | Required |
| 6 | Required | Required | Required | Every meal | Allowed | Required |

---

## Code: `analyzeMealPortion()` — Modified

**Location:** `src/lib/ai-coach.ts`

### What it does:

1. **Split meal description** into individual food items (split on commas, spaces, "and")
2. **Match each item** against food categories using substring matching (case-insensitive)
3. **Track recognized categories:**
   - `hasProtein` — if any item matches LEAN_PROTEINS
   - `hasVeg` — if any item matches FIBROUS_VEGETABLES
   - `hasStarch` — if any item matches STARCHY_CARBOHYDRATES
   - `hasFat` — if any item matches HEALTHY_FATS
   - `hasSupplement` — if any item matches SUPPLEMENTS
   - `hasWater` — if description mentions water
4. **Track unrecognized items:** any food item that doesn't match any category
5. **Apply phase rules** to determine:
   - Which required categories are MISSING
   - Which disallowed items are PRESENT
6. **Return structured result:**
   ```typescript
   {
     hasProtein: boolean,
     hasVeg: boolean,
     hasStarch: boolean,
     hasFat: boolean,
     hasWater: boolean,
     hasSupplement: boolean,
     unrecognizedItems: string[], // e.g. ["tacos", "enchiladas"]
     missingCategories: string[], // e.g. ["fat"]
     disallowedItems: string[], // e.g. ["tacos"] in Phase 1
     portionAdvice: string, // coaching text
     onPhase: boolean, // true if no violations
     corrections: string[] // list of specific corrections
   }
   ```

### Phase rule enforcement:
- Phase 1: hasStarch = true → DISALLOWED (violation)
- Phase 2: starch only Wed/Sat/Sun for breakfast/lunch → check day + meal type
- Phase 4/6: starch allowed → no violation
- Phase 5: follows 3-day rotating sub-phase

### Portion validation:
- If portions ARE given in the meal description → validate against phase portions
- If portions are NOT given → assume portions are correct (don't flag)

### Snacks:
- Partial meals are OK for snacks
- If mealType = 'snack': don't require all categories
- Just check that food items are allowed in phase (no violations)

---

## Code: `extractMealData()` — NEW

**Location:** `src/lib/ai-coach.ts`

Takes a meal description string and returns structured data for AI:

```typescript
{
  recognizedItems: { item: string, category: 'protein' | 'vegetable' | 'starch' | 'fat' | 'supplement' }[],
  unrecognizedItems: string[],
  phaseContext: {
    phase: number,
    gender: 'male' | 'female',
    programType: string,
    isSnack: boolean,
    mealType?: 'breakfast' | 'lunch' | 'dinner' | 'snack',
    mealDate?: string // for Phase 2 day checking
  },
  missingCategories: string[],
  disallowedItems: string[],
  phaseRules: {
    starchAllowed: boolean,
    starchDays?: number[], // Phase 2: [0, 3, 6] = Sun, Wed, Sat
    starchMealTypes?: string[] // Phase 2: ['breakfast', 'lunch']
  }
}
```

---

## AI: `getMealEvaluationPrompt()` — NEW

**Location:** `src/lib/ai-coach.ts`

Takes `extractMealData()` output and returns a prompt for MiniMax.

**Prompt structure:**

```
Client context: [name], Phase [X], [gender], [program type]

Code detected:
- Recognized foods: [list with categories]
- Unrecognized foods: [list]
- Missing categories: [list]
- Disallowed items: [list]

Phase [X] rules:
- [List the phase rules simply]

Your job:
1. For each UNRECOGNIZED item: use your knowledge to tell client what's in it and if it violates phase rules. Be specific about what ingredient is the problem (e.g. "tacos have a tortilla = starch")
2. For MISSING categories: tell client what's missing and the portion size for their phase
3. For DISALLOWED items: tell client to remove/replace it
4. Keep response SHORT — 1-3 sentences per issue. Allen's coaching voice.
5. If everything looks good: "Nice! You're on track! 💪"
6. If client asks about supplements: give advice. Otherwise stay silent on supplements.
```

---

## Modified Routes

### `/api/ai/chat` (text messages)
- Parse meal description with `extractMealData()`
- Run `analyzeMealPortion()` for phase rule enforcement
- Generate prompt with `getMealEvaluationPrompt()`
- Send to MiniMax with the structured prompt
- Return MiniMax response to client

### `/api/ai/analyze` (food log)
- Same flow: `extractMealData()` → `analyzeMealPortion()` → `getMealEvaluationPrompt()` → MiniMax
- Remove the current approach of sending raw meal description to MiniMax

### Photo flow (`/api/ai/analyze` with photo)
- Gemini Flash identifies food → returns text description
- Text description → `extractMealData()` → same flow as above
- Remove current approach of sending Gemini output directly to MiniMax with raw description

---

## Coaching Rules

1. **Short, punchy responses** — 1-3 sentences max per issue
2. **Allen voice** — direct, supportive, no lectures
3. **Supplement questions only** — only discuss supplements when client asks
4. **Snacks** — partial is fine, don't bug about missing categories
5. **Water** — always check if mentioned, remind if missing

---

## Out of Scope (for this build)

- Changing the food lists (they're already correct)
- Phase progression logic (already working)
- Trainer dashboard
- Corrections toggle UI
- Onboarding flow

---

## Test Cases

### Test 1: Simple clean meal (Phase 1)
- Input: "grilled chicken breast green beans with olive oil, 32 ounce water"
- Expected: Code recognizes all → AI says "Nice! On track 💪"

### Test 2: Complex unrecognized food (Phase 1)
- Input: "2 beef tacos"
- Expected: Code recognizes beef, flags "tacos" as unrecognized → AI explains tacos = tortilla = starch not allowed in Phase 1 → swap suggestion

### Test 3: Missing category (Phase 1)
- Input: "grilled chicken breast"
- Expected: Code recognizes protein, missing veggies + fat → AI tells client what's missing with portions

### Test 4: Phase 2 starch day
- Input: "6oz salmon with 1 cup rice, broccoli" (Wednesday breakfast)
- Expected: Phase 2, Wed, breakfast → starch allowed → AI says "Nice! On track 💪"

### Test 5: Phase 2 wrong day
- Input: "6oz salmon with 1 cup rice, broccoli" (Friday dinner)
- Expected: Phase 2, Fri, dinner → starch not allowed → AI flags rice

### Test 6: Snack partial meal
- Input: "chicken breast" (snack, Phase 1)
- Expected: No missing category warnings → just check no violations

### Test 7: Supplement question
- Input: "do I need to take creatine"
- Expected: AI answers about creatine for Phase 6 client

### Test 8: Phase 6 complex food
- Input: "chicken burrito bowl with rice beans cheese"
- Expected: Phase 6, starch/cheese allowed → code recognizes all → AI says on track
