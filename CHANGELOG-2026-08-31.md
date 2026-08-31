# Nutrition Coaching Platform - Changes Made 2026-08-31

## Summary of Work Done

### 1. Phase 6 Text Update
- **Changed:** Phase 6 description text
- **From:** "Take whey protein post-workout and creatine daily. If you hit your goal weight, you will move to Phase 4."
- **To:** "Take whey protein 1st thing Am and last thing Pm and creatine as directed on container. If you hit your goal weight, you will move to maintenance."
- **File:** `src/app/client/log/page.tsx` line 567

### 2. Removed On Phase/Off Phase Indicators
- **Removed:** The visual "On Phase" / "Off Phase" badge (✅/⚠️) from meal displays in the chat tab
- **Files:** `src/app/client/chat/page.tsx` (3 places)

### 3. Removed On Phase/Off Phase Logic
- **Removed:** The `onPhase` flag and determination logic entirely from the code
- **Keep:** Portion checking, corrections, AI coaching responses
- **Files Changed:**
  - `src/lib/ai-coach.ts` - removed `onPhase` from analyzeMealPortion()
  - `src/app/api/analyze/route.ts` - removed `onPhase` from API responses
  - `src/app/api/meals/route.ts` - removed `on_phase` from database inserts
  - `src/app/client/chat/page.tsx` - removed from frontend
  - `src/app/client/log/page.tsx` - removed from frontend

### 4. Fixed Food Recognition Bug
- **Issue:** Food items like "grilled chicken" and "rice" were not being recognized
- **Root Cause:** Matching logic was backwards - checking if food list entry was in user input
- **Fix:** Added `itemMatchesFoodList()` helper for bidirectional matching
- **File:** `src/lib/ai-coach.ts`

### 5. Fixed "What Can I Eat?" Food Lists
- **Issue:** Quick suggestion showed foods not on approved list (flour tortilla, etc.)
- **Fix:** Consolidated to use only the approved food lists from nutrition-data.ts
- **Removed from STARCHY_CARBOHYDRATES:**
  - Flour tortilla, Corn tortilla, Tortilla
  - Pineapple, Banana, Granny smith apple, Grapes
- **File:** `src/lib/nutrition-data.ts`

### 6. Fixed Auto-Shift to Phase 4 (Maintenance)
- **Issue:** When goal weight reached, system stayed on Phase 6 instead of shifting to Phase 4
- **Fix:** Added automatic phase transition when current_weight >= goal_weight for muscle_gain program
- **Files Changed:**
  - `src/app/api/weight/route.ts` - weight logging scenario
  - `src/app/api/client/update-goal/route.ts` - profile goal update scenario
  - `src/app/api/client/update-weight/route.ts` - weight update scenario

## Commits Made
- a54e4a46 - Update Phase 6 muscle gain description text
- 3ab31895 - Remove phase descriptions from log tab
- b849e20d - Restore Quick Suggestion block with Phase 6 wording
- (various commits for onPhase removal)
- (commit for food recognition fix)
- 4ee8b156 - Remove unapproved foods from STARCHY_CARBOHYDRATES
- 69636f59 - Fix auto-shift from Phase 6 to Phase 4 when goal weight reached

## Database Note
- Deleted 7 test accounts created by Tim, only allen.marrs@yahoo.com remains in clients table

## Backups
- nutrition-coaching-platform-BACKUP-20260831-161248.tar.gz (latest)
