# Proof: Fix protein powder + chat program facts

**Commit:** d4e0ccc042fabcd52ce749be9034e731f2eac5d5
**Branch:** main
**Production URL:** https://nutrition-coaching-platform.vercel.app
**Deployed:** 2026-09-17 15:10 CDT

## Changes

### nutrition-data.ts

1. **classifyFoodItem**: Stop skipping whey/protein powder — now counts as protein for Home deduction (bacon still excluded)
2. **extractAmount unit regex**: Added `g|gram|grams` so "20g protein powder" parses correctly
3. **normalizeToCategoryUnit**: Protein category converts grams → oz: `Math.round((amount / 6.7) * 10) / 10`

### ai-coach.ts

1. **itemMatchesFoodList word-boundary fix**: For last-word-of-entry matching, item must END with that word (prevents "24oz water" matching "Water chestnuts")
2. **isPlainWaterItem guard** (extractMealData + analyzeMealPortion): Items matching `/^\d+\s*(?:oz|ounce|ounces)?\s*water$/i` or `/^water\s+\d+\s*(?:oz|ounce|ounces)?$/i` skip fibrous vegetable matching — plain water never sets hasVeg
3. **Duplicate fat tips fixed**:
   - Phase 1 dairy removal emits ONE fat tip immediately when only dairy fat found (no portion correction for dairy fat)
   - Portion correction loop skips fat corrections if `fatTipEmitted=true`
   - Missing categories path checks `fatTipEmitted` before emitting fat tip
   - Result: fat guidance at most once per meal
4. Mixed nuts count as approved fat — no "need fat" message when approved fat present

## Tim Test Cases

- Home: log "20g protein powder" → protein remaining drops by ~3.0 oz ✓
- Home: log "40g whey protein powder" → ~6.0 oz deducted ✓
- Home: log "6 oz chicken" → still counts in oz as before ✓
- Home: bacon still excluded ✓
- Chat Phase 1: "12oz coffee, 1 tablespoon heavy cream, 1 tablespoon sugar in the raw, 24oz water, 2 handfuls mixed nuts"
  - dairy warning (heavy cream removed) ✓
  - sugar warning ✓
  - protein missing ✓
  - fibrous vegetables missing once ✓
  - fat guidance once (nuts present → no "need fat") ✓
  - no Water chestnuts false veg ✓
