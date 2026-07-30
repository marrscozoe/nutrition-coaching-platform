# Nutrition Coaching Platform - Changes Summary
## Date: July 26, 2026

### Backup Location
`nutrition-coaching-platform-BACKUP-20260726-1655.tar.gz` (~122MB)

---

## Bugs Fixed Today

### Bug #1 - Chat Message Duplicate ID (Fixed)
- **Problem:** Rapid clicks on quick action buttons caused `Date.now()` to return same value, giving messages duplicate React keys
- **Fix:** Replaced `Date.now().toString()` with `++msgIdRef.current` for unique sequential IDs
- **File:** `/src/app/client/chat/page.tsx`

### Bug #2 - AI Fallback Giving Wrong Responses (Fixed)
- **Problem:** When AI returned empty (rate limit/quota), fallback called `analyzeMealPortion()` which treated queries as food descriptions
- **Fix:** Added `getFallbackResponse()` that routes based on query type (motivation, food, phase, check-in, weight, default encouragement)
- **File:** `/src/app/api/ai/chat/route.ts`

### Bug #3 - Food Log Date Wrong (Fixed)
- **Problem:** Date off by 1 day due to UTC timezone parsing
- **Root Cause:** `new Date("2026-07-21")` parses as UTC midnight, causing timezone offset shifts
- **Fix:** Changed to `new Date(mealData.mealDate + 'T12:00:00')` to force noon local time interpretation
- **Files:** 
  - `/src/app/client/log/page.tsx` - storing date directly in state
  - `/src/app/client/chat/page.tsx` - date parsing fix

---

## AI Coaching Improvements

### Phase Coaching Messages Updated
- **Phase 1:** Changed from "Consider skipping or eating 1/4" → "NO starch! Skip completely"
- **Phase 2:** Starch allowed Wed/Sat/Sun for first 2 meals only, uses mealDate from context
- **Phase 3:** Changed to "EVALUATION CHECKPOINT" - tells client to check with coach if not at goal
- **Phase 4:** Maintenance phase with gentler tone - notices/suggestions not warnings, starch allowed with portion reminders

### Food Keywords Updated
- Removed tofu/tempeh from protein (processed - AVOID)
- Vegetables (zucchini, tomato, cucumber, celery, cabbage) are fine to eat
- Phase 4: Natural starches preferred over processed (gentle reminder)

---

## Water Tracking Implemented

### CoachContext Updated
Added water tracking fields:
- `todayWaterIntake?: number` - oz of water consumed today
- `todayCoffeeIntake?: number` - oz of coffee consumed today (adds to water requirement)
- `mealsLoggedToday?: number` - number of meals logged today to calculate remaining

### Water Calculation
- **Female:** 80 oz base + coffee = total daily need, 20 oz per meal (4 meals)
- **Male:** 128 oz base + coffee = total daily need, 32 oz per meal (4 meals)

### Water Tracking Message Examples
- No water logged yet: "💧 You need 32oz water per remaining meal. Aim for 128oz total daily."
- Short on water: "💧 You're 64oz short on water today. You need 32oz water per remaining meal."
- On track: "💧 Water tracked. You're on track with water today."
- With coffee: "☕ Coffee counts toward fluids, but you still need water."

---

## Portion Sizes Updated

### Male Portions
- Protein: 6 ounces
- Fibrous Vegetables: 2 cups
- Fat: 2 tablespoons (was 1-2 tablespoons)
- Avocado: 1/2 (was 1/4)

### Female Portions
- Protein: 4 ounces
- Fibrous Vegetables: 1-2 cups
- Fat: 1-2 tablespoons
- Avocado: 1/4

---

## Home Tab Updated

### Phase Guidance Now Shows:
1. Current phase clearly displayed
2. CAN EAT list with specific portions
3. CANNOT EAT list with specific restrictions
4. WATER requirement (128 oz daily for male, 80 oz for female)
5. EXAMPLE MEAL with specific portion sizes

### Example Meal for Phase 1 (Male):
"6oz grilled chicken breast, 2 cups broccoli with 2 tablespoons olive oil, 32oz water"

---

## Home Tab Example Meals (Updated)

**Phase 1:**
- CAN EAT: 6oz lean protein, 2 cups fibrous vegetables, 2 tbsp olive oil or 1/2 avocado
- CANNOT EAT: NO starch
- WATER: 128 oz daily (32 oz per meal)
- EXAMPLE: 6oz grilled chicken breast, 2 cups broccoli with 2 tablespoons olive oil, 32oz water

**Phase 2:**
- CAN EAT: 6oz protein, 2 cups veg, 2 tbsp olive oil or 1/2 avocado, starch (Wed/Sat/Sun only)
- CANNOT EAT: NO starch on Mon/Tue/Thu/Fri
- WATER: 128 oz daily (32 oz per meal)
- EXAMPLE: 3 eggs scrambled, 1 cup oatmeal, 1 cup spinach, 2 tablespoons olive oil, 32oz water

**Phase 3:**
- Same as Phase 2 rules until decision made
- Check with your coach about starch and portions

**Phase 4:**
- CAN EAT: 6oz protein, 2 cups veg, 2 tbsp olive oil or 1/2 avocado, natural starch every meal
- CANNOT EAT: processed starches, 5+ lbs over goal = back to Phase 1
- WATER: 128 oz daily (32 oz per meal)
- EXAMPLE: 6oz grilled fish, 1 cup rice, 2 cups mixed vegetables, 2 tablespoons olive oil, 32oz water

---

## Tim's Testing Results (July 26, 2026)

### Fixed Bugs (from prior sessions)
1. ✅ Weight logging localStorage - Fixed
2. ✅ Starting weight edit localStorage - Fixed
3. ✅ Quick action buttons auto-send - Fixed

### Still Broken
1. ❌ Chat history race condition - rapid messages can get lost (closure vs functional state)
2. ❌ alert() in trainer/onboarding pages - trainer/settings, trainer/signup, onboarding still use alert()

### New Issues Found
1. ⚠️ AI Chat API failing - Gemini returns "models/gemini-1.5-flash is not found" - app is running on fallback mode only
2. ⚠️ Trainer alert() calls - multiple trainer pages still use alert()

---

## Files Modified Today
- `/src/lib/ai-coach.ts` - water tracking, portion sizes, phase coaching
- `/src/app/client/page.tsx` - home tab phase guidance
- `/src/app/client/chat/page.tsx` - date parsing, message ID fix
- `/src/app/client/log/page.tsx` - date handling
- `/src/app/api/ai/chat/route.ts` - fallback routing

---

## App Status
- Running at: http://192.168.1.250:3002
- Backup: nutrition-coaching-platform-BACKUP-20260726-1655.tar.gz
