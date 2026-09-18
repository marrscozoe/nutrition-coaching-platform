// Regression test: exact dinner string from Presley P0 gate
import { analyzeMealPortion } from '@/lib/ai-coach';

const dinnerString = '📸 DINNER — Mon, Sep 14. 32oz water. 3 beef enchiladas flour tortillas. 2 cups green beans with olive oil.';

const phase1MaleContext = {
  clientName: 'Test Male',
  gender: 'male' as const,
  currentPhase: 1,
  goalWeight: 180,
  currentWeight: 200,
  startingWeight: 220,
  programType: 'standard',
  weekNumber: 2,
  mealType: 'dinner' as const,
  mealDate: '2026-09-14',
  todayWaterIntake: 0,
  todayCoffeeIntake: 0,
  mealsLoggedToday: 0,
};

describe('P0 dinner string regression', () => {
  it('hasProtein / hasVeg / hasFat all true for the exact dinner string', async () => {
    const result = await analyzeMealPortion(dinnerString, phase1MaleContext, 'dinner');
    expect(result.hasProtein).toBe(true);
    expect(result.hasVeg).toBe(true);
    expect(result.hasFat).toBe(true);
  });

  it('flour tortillas are in disallowedItems (Phase 1 no starch)', async () => {
    const result = await analyzeMealPortion(dinnerString, phase1MaleContext, 'dinner');
    expect(result.disallowedItems).toContain('Flour tortilla');
    expect(result.disallowedItems).toContain('Tortilla');
  });

  it('no "need protein/veg/fat" tips for this meal', async () => {
    const result = await analyzeMealPortion(dinnerString, phase1MaleContext, 'dinner');
    const tipsText = JSON.stringify(result.missingCategories || []);
    expect(tipsText.toLowerCase()).not.toMatch(/protein/);
    expect(tipsText.toLowerCase()).not.toMatch(/veg/);
    expect(tipsText.toLowerCase()).not.toMatch(/fat/);
  });

  it('water oz does not bind to oil or veg', async () => {
    const result = await analyzeMealPortion(dinnerString, phase1MaleContext, 'dinner');
    const adviceText = JSON.stringify(result.portionAdvice || '');
    // Water should not be nagged about fat/veg pairing
    expect(adviceText).not.toMatch(/32oz.*oil/i);
    expect(adviceText).not.toMatch(/32oz.*veg/i);
  });

  it('punctuation variants produce same categories', async () => {
    const v1 = await analyzeMealPortion('📸 DINNER — Mon, Sep 14. 32oz water. 3 beef enchiladas flour tortillas. 2 cups green beans with olive oil.', phase1MaleContext, 'dinner');
    const v2 = await analyzeMealPortion('📸 DINNER - Mon Sep 14 32oz water 3 beef enchiladas flour tortillas 2 cups green beans with olive oil', phase1MaleContext, 'dinner');
    expect(v1.hasProtein).toBe(v2.hasProtein);
    expect(v1.hasVeg).toBe(v2.hasVeg);
    expect(v1.hasFat).toBe(v2.hasFat);
  });

  it('olive oil with no amount = fat present, no portion nag', async () => {
    const result = await analyzeMealPortion('📸 DINNER — Mon, Sep 14. 2 cups green beans with olive oil.', phase1MaleContext, 'dinner');
    expect(result.hasFat).toBe(true);
    const adviceText = JSON.stringify(result.portionAdvice || '');
    expect(adviceText.toLowerCase()).not.toMatch(/olive oil.*portion/i);
  });
});
