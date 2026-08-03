# Future Features - AI Correction/Learning System

## Overview
Allow trusted testers to report AI mistakes when it misclassifies foods. The AI learns from corrections and adds foods to the correct database lists, making the system smarter over time without code changes.

## Architecture

### User Roles
- **Allen (superadmin)**: Always sees correction button, manages testers, can toggle master switch
- **Testers**: Users marked as `is_tester = true` who can submit corrections
- **Regular users**: Don't see correction button, use base food lists

### Master Controls (Allen-only)
```
Settings:
├── Enable correction feature globally: [ON/OFF]
└── Tester Management:
    ├── User 1: [✓ Tester / ✗ Not tester]
    ├── User 2: [✓ Tester / ✗ Not tester]
    └── User 3: [✓ Tester / ✗ Not tester]
```

### Who Sees the Button
- Allen (superadmin): Always
- Users with `is_tester = true`: See it
- Everyone else: Hidden

## UI Flow

### Correction Button
- Separate from "I messed up" button
- Located in Meal Log page after AI analysis
- Only visible to Allen + testers

### Correction Form
```
Which food was misclassified?
→ Auto-filled with logged food (editable)

What should it be classified as?
→ Dropdown:
  - Starch (Phase 1 violation)
  - Dairy (Phase 1 violation)
  - Sugar (Phase 1 violation)
  - Protein
  - Vegetable
  - Fat
  - Other

[Submit Correction]
```

### After Submission
- Correction saved to database
- Food added to appropriate keyword list
- AI will recognize correctly next time
- Allen can review/delete from admin panel

## Database Changes

### New Tables

#### `food_corrections`
```sql
CREATE TABLE food_corrections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  food_name TEXT NOT NULL,
  correct_category TEXT NOT NULL,
  submitted_by TEXT NOT NULL,
  submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  approved BOOLEAN DEFAULT TRUE,
  reviewed_by TEXT,
  reviewed_at DATETIME
);
```

### User Table Changes
```sql
ALTER TABLE users ADD COLUMN is_tester BOOLEAN DEFAULT FALSE;
```

### Settings Changes
```sql
INSERT INTO settings (key, value) VALUES ('correction_feature_enabled', 'false');
```

## Performance (Keep Fast!)

### Caching Strategy
1. On app startup: Load food corrections from database into memory cache
2. Combine with base keyword lists (hardcoded)
3. All lookups use in-memory cache (O(1) hash lookup)
4. No database queries during normal operation

### Cache Invalidation
- When Allen adds/deletes correction: Update cache immediately
- Background write to database doesn't block user

## Implementation Tasks

### Phase 1 (MVP)
1. Add `is_tester` column to users table
2. Add `correction_feature_enabled` setting
3. Create `food_corrections` table
4. Build tester management UI in admin
5. Add correction button to Meal Log (visible only to Allen + testers)
6. Build correction form dialog
7. Implement correction submission (save to database)
8. Update `analyzeMealPortion` to load corrections into keyword lists
9. In-memory cache for corrections

### Phase 2 (Polish)
10. Admin panel to review/delete corrections
11. Add correction to Allen Dashboard
12. Notifications when testers submit corrections

## Notes
- Corrections apply to ALL clients (global learning)
- Allen is the only one who can manage testers
- Trainer/gym clients don't see this feature
- Speed must remain same as current (in-memory cache)
- Separate from "I messed up" flow - keeps chat clean

---

# Future Feature: Bacon Conditional Approval

## Overview
Bacon is only allowed if it is **low sodium AND nitrate-free**. Only then is it allowed twice per week as a protein + fat source.

## Problem
Current keyword detection just looks for "bacon" and can't automatically know if the bacon is low sodium nitrate-free or not.

## Solution: Option 1 - AI Coach Asks
- Remove bacon from automatic "allowed" list
- When client logs bacon, AI asks: "Was it low sodium nitrate-free?"
- If yes → allowed (counts toward twice per week)
- If no → flagged as violation

## Implementation

### Change to Bacon Status
- Remove bacon from LEAN_PROTEINS list
- Keep bacon off the automatic "allowed" lists

### AI Prompt Addition
Add to the coach prompt:
```
CRITICAL: Bacon is only allowed if LOW SODIUM AND NITRATE-FREE.
When client mentions bacon, ask: "Was it low sodium nitrate-free?"
- If YES: Count as allowed protein, note it toward twice-per-week limit
- If NO or unclear: Flag as violation
```

### Tracking (Optional Enhancement)
Track bacon intake per client per week:
- Store bacon meal entries with date
- Query count of bacon meals in current week
- If count >= 2, warn client they've reached their twice-per-week limit
- If count > 2, flag as violation

### Database Changes (if tracking)
```sql
CREATE TABLE bacon_tracking (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  logged_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  was_nitrate_free BOOLEAN DEFAULT FALSE,
  was_low_sodium BOOLEAN DEFAULT FALSE
);
```

## Implementation Tasks
1. Remove "Bacon (nitrate-free, twice per week)" from LEAN_PROTEINS
2. Update AI prompt to ask about bacon quality when mentioned
3. Add tracking logic if desired (Phase 2)

---

# Future Feature: Phase 2 Violation Logic Fix

## Overview
Phase 2 should only disable STARCH violation checks (since starch is allowed Wed/Sat/Sun). Phase 2 should STILL check for dairy and sugar violations.

## Problem
Current code in `analyzeMealPortion` disables ALL violation checks for Phase 2+:
```javascript
const starchFound = context.currentPhase === 1
  ? starchKeywords.filter(s => foodLower.includes(s))
  : [];  // Empty for Phase 2+
const dairyFound = context.currentPhase === 1
  ? dairyKeywords.filter(d => foodLower.includes(d))
  : [];  // Empty for Phase 2+
const sugarFound = context.currentPhase === 1
  ? sugarKeywords.filter(s => foodLower.includes(s))
  : [];  // Empty for Phase 2+
```

This means Phase 2 currently allows dairy and sugar, which is INCORRECT.

## Phase 2 Rules (from NOTES.md)
- **Starch:** ALLOWED Wed/Sat/Sun for first 2 meals (not a violation)
- **Dairy:** NOT ALLOWED (still a violation in Phase 2)
- **Sugar:** NOT ALLOWED (still a violation in Phase 2)

## Fix Required
Update the violation logic so Phase 2:
- Does NOT check for starch violations (starch is allowed on specific days)
- DOES check for dairy violations (dairy is never allowed in Phase 2)
- DOES check for sugar violations (sugar is never allowed in Phase 2)

## Implementation Tasks
1. Update `analyzeMealPortion` function in ai-coach.ts
2. Change Phase 2 to only skip starch checks
3. Keep dairy and sugar checks active for Phase 2+
4. Test with sample meals to verify correct behavior

---

# Future Feature: Phase 4 Portion and Processed Food Tracking

## Overview
Phase 4 (Maintenance) has different rules than Phase 1-3:
- Dairy and sugar are ALLOWED but in controlled portions
- Processed food is allowed but limited to ~1 meal per day
- Portion sizes must still be followed
- 5+ lbs above goal weight triggers reset to Phase 1

## Phase 4 Rules (from Allen)

### Portion Guidelines
| Category | Men | Women |
|----------|-----|-------|
| Dairy | 2 servings | 1 serving |
| Sugar | 2 servings | 1 serving |
| Starch | 1-2 cups cooked (same as Phase 2) | 1 cup cooked (same as Phase 2) |
| Protein | 6oz per meal | 4oz per meal |
| Fibrous Veg | 2 cups per meal | 1-2 cups per meal |
| Fat | 2 tbsp per meal | 1 tbsp per meal |

### Serving Size Examples
- **Sugar:** 2 tsp = fine, 5+ tsp = problem
- **Dairy:** per container serving size (e.g., 1 cup milk, 1 oz cheese)

### Processed Food Rule
- ✅ About 1 processed meal per day = OK (if portions are good)
- ❌ If processed meals exceed 1 per day → AI warns client to get back to natural food

### Weight Trigger
- 5+ lbs above goal → automatic reset to Phase 1

## Problem
Current code disables ALL violation checks for Phase 2+:
```javascript
const starchFound = context.currentPhase === 1 ? starchKeywords.filter(...) : [];
const dairyFound = context.currentPhase === 1 ? dairyKeywords.filter(...) : [];
const sugarFound = context.currentPhase === 1 ? sugarKeywords.filter(...) : [];
```

This means Phase 4 allows unlimited dairy, sugar, and processed food - no portion tracking or warnings.

## Solution: Phase 4 Portion Tracking

### AI Prompt Changes
Update `getMealAnalysisPrompt` for Phase 4 to:
1. Acknowledge dairy/sugar is allowed in Phase 4
2. Track portions against serving sizes
3. Warn if portions exceed guidelines (men >2 servings, women >1 serving dairy/sugar)
4. Track processed food intake
5. Warn if processed meals exceed 1 per day

### Implementation Tasks
1. Add Phase 4 portion check logic to `analyzeMealPortion` in ai-coach.ts
2. Update AI prompt to explain Phase 4 rules:
   - "Dairy and sugar are allowed but portions apply"
   - "Men: up to 2 servings dairy/sugar per meal"
   - "Women: up to 1 serving dairy/sugar per meal"
3. Add processed food detection and daily tracking
4. Add warning message when processed meals exceed 1 per day
5. Track daily processed meal count in client session
6. Reset processed meal counter daily
7. Test: log 2 processed meals in one day → should warn

---

# Future Feature: Update Program Choices (Signup)

## Overview
Update the program choices shown to clients during onboarding.

## Current State
- UI shows: event_ready, muscle_gain, general_health, first_responder
- Database accepts: lose_body_fat, muscle_gain, event_ready, general_health
- MISMATCH: first_responder in UI but lose_body_fat in DB

## Changes Required
1. Remove "First Responder" from UI program choices
2. Change "Lose Body Fat" to "Get Shredded" (display text only)
3. Update VALID_PROGRAMS in update-program route if needed

## New Program Choices
1. 🎯 Event Ready
2. 🔥 Get Shredded (was Lose Body Fat)
3. 💪 Muscle Gain
4. 🏥 General Health

## Files to Update
1. `/src/app/onboarding/page.tsx` - update select options
2. `/src/app/api/client/update-program/route.ts` - update VALID_PROGRAMS if needed
3. Test signup flow with new program choices

---

# Future Feature: Program Definitions & Rules

## Overview
Each program (Event Ready, Get Shredded, Muscle Gain, General Health) has different rules and phase progressions. Currently only Event Ready is implemented with the Phase 1-4 loop.

## Program Types

### 1. Event Ready
**Phase Progression:** Full Phase 1-4 loop
- Phase 1: No starch, dairy, sugar (14 days + 10 streak → Phase 2)
- Phase 2: Add starch Wed/Sat/Sun (7 days + weight improving → Phase 3)
- Phase 3: Evaluation checkpoint (at goal → Phase 4, 14 days not at goal → Phase 1)
- Phase 4: Maintenance (starch every meal, dairy/sugar portions, ~1 processed meal/day, 5+ lbs trigger → Phase 1)
- Loops back to Phase 1 if not at goal

### 2. Get Shredded
**Status:** TBD - rules not yet defined

### 3. Muscle Gain
**Base:** Phase 4 (maintenance) with modifications

**Daily Supplements:**
- Whey protein shot at START and END of day
- Creatine taken as directed on container

**Daily Portions (vs standard Phase 4):**

| | Men | Women | Phase 4 (for reference) |
|---|---|---|---|
| Whey Protein | 40g start + 40g end | 20g start + 20g end | N/A |
| Natural Starch | 3 cups per meal | 2 cups per meal | 1-2 cups men, 1 cup women |
| Fat | 3 tbsp per meal | 2 tbsp per meal | 2 tbsp men, 1 tbsp women |
| Protein | Same as Phase 1 | Same as Phase 1 | 6oz men, 4oz women |
| Fibrous Veg | Same as Phase 1 | Same as Phase 1 | 2 cups men, 1-2 cups women |

**Weight Expectations:**
- Expect 1-2 lbs weight GAIN per week until goal met

**Meal Timing:**
- Biggest meal = RIGHT AFTER weight training
- Starch (banana/fruit) 30 minutes BEFORE weight training

### 4. General Health
**Base:** Phase 4 (maintenance)

**Goals:**
- No real weight change expected (maybe a few pounds loss)
- Focus: teach client to eat natural health food and correct portions

**Processed Food Rules:**
- AI should be MORE RESTRICTIVE on processed foods than standard Phase 4 maintenance
- Emphasis on natural, whole foods

**Portions:**
- Same as standard Phase 4 portions

**Weight Expectations:**
- No weight gain expected (slight loss OK)

## Shared Rules (All Programs)

### Water Intake
- Water intake is the SAME in all phases and programs

### Phase 4 Portion Reference (Standard)
- Starch: Men 1-2 cups cooked, Women 1 cup cooked
- Protein: Men 6oz, Women 4oz
- Fibrous Veg: Men 2 cups, Women 1-2 cups
- Fat: Men 2 tbsp, Women 1 tbsp
- Dairy: Men 2 servings, Women 1 serving
- Sugar: Men 2 servings, Women 1 serving
- Processed Food: ~1 meal per day max

## Implementation Tasks
1. Define rules for Get Shredded program
2. Add program-specific AI prompts/configs
3. Update `getPhaseAdvice` to return different advice per program
4. Add Muscle Gain specific meal timing recommendations
5. Add General Health more restrictive processed food detection
6. Update AI coach to check program type when giving advice
7. Add program-specific weight expectation tracking
8. Test each program flow with sample client
