// Regression test: exact dinner string from Presley P0 gate
import { analyzeMealPortion } from './nutrition-data';

const dinnerString = '📸 DINNER — Mon, Sep 14. 32oz water. 3 beef enchiladas flour tortillas. 2 cups green beans with olive oil.';

describe('P0 dinner string regression', () => {
  it('hasProtein / hasVeg / hasFat all true for the exact dinner string', () => {
    const result = analyzeMealPortion(dinnerString, { phase: 1 });
    expect(result.hasProtein).toBe(true);
    expect(result.hasVeg).toBe(true);
    expect(result.hasFat).toBe(true);
  });

  it('flour tortillas REMOVED as correction, not protein', () => {
    const result = analyzeMealPortion(dinnerString, { phase: 1 });
    const tortillaCorrection = result.corrections?.find(c => c.item.toLowerCase().includes('tortilla'));
    expect(tortillaCorrection?.action).toBe('remove');
  });

  it('no "need protein/veg/fat" tips for this meal', () => {
    const result = analyzeMealPortion(dinnerString, { phase: 1 });
    const tipsText = JSON.stringify(result.tips || []);
    expect(tipsText.toLowerCase()).not.toMatch(/need.*protein/);
    expect(tipsText.toLowerCase()).not.toMatch(/need.*veg/);
    expect(tipsText.toLowerCase()).not.toMatch(/need.*fat/);
  });

  it('water oz does not bind to oil or veg', () => {
    const result = analyzeMealPortion(dinnerString, { phase: 1 });
    const tipsText = JSON.stringify(result.tips || []);
    // Water should not be nagged about fat/veg pairing
    expect(tipsText).not.toMatch(/32oz.*oil/);
    expect(tipsText).not.toMatch(/32oz.*veg/);
  });

  it('punctuation variants produce same categories', () => {
    const v1 = analyzeMealPortion('📸 DINNER — Mon, Sep 14. 32oz water. 3 beef enchiladas flour tortillas. 2 cups green beans with olive oil.', { phase: 1 });
    const v2 = analyzeMealPortion('📸 DINNER - Mon Sep 14 32oz water 3 beef enchiladas flour tortillas 2 cups green beans with olive oil', { phase: 1 });
    expect(v1.hasProtein).toBe(v2.hasProtein);
    expect(v1.hasVeg).toBe(v2.hasVeg);
    expect(v1.hasFat).toBe(v2.hasFat);
  });

  it('olive oil with no amount = fat present, no portion nag', () => {
    const result = analyzeMealPortion('📸 DINNER — Mon, Sep 14. 2 cups green beans with olive oil.', { phase: 1 });
    expect(result.hasFat).toBe(true);
    const tipsText = JSON.stringify(result.tips || []);
    expect(tipsText.toLowerCase()).not.toMatch(/olive oil.*portion/i);
  });
});
