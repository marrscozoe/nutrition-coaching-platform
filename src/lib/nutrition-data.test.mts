import { describe, it, expect } from 'vitest';
import { classifyFoodItem, extractAmount } from './nutrition-data';

describe('P0 meal recognition — punctuation-agnostic, portion binding', () => {
  const DINNER_EXACT =
    '📸 DINNER — Mon, Sep 14. 32oz water. 3 beef enchiladas flour tortillas. 2 cups green beans with olive oil.';

  // ── classifyFoodItem — word-level matching ──────────────────────────────────

  describe('classifyFoodItem — word-level matching', () => {
    it('recognizes beef as protein', () => {
      expect(classifyFoodItem('3 beef enchiladas')).toBe('protein');
    });

    it('recognizes beef regardless of surrounding punctuation', () => {
      expect(classifyFoodItem(' Mon, Sep 14. 3 beef enchiladas ')).toBe('protein');
    });

    it('recognizes green beans as veg', () => {
      expect(classifyFoodItem('2 cups green beans with olive oil')).toBe('veg');
    });

    it('recognizes green beans regardless of surrounding punctuation', () => {
      expect(classifyFoodItem(' Mon. 2 cups green beans with olive oil. ')).toBe('veg');
    });

    it('recognizes olive oil as fat', () => {
      expect(classifyFoodItem('olive oil')).toBe('fat');
    });

    it('recognizes olive oil regardless of punctuation', () => {
      expect(classifyFoodItem(' Mon, Sep 14. olive oil. ')).toBe('fat');
    });

    it('does NOT classify plain water as any food category', () => {
      expect(classifyFoodItem('32oz water')).toBeNull();
      expect(classifyFoodItem('water 32oz')).toBeNull();
      expect(classifyFoodItem('water')).toBeNull();
    });

    it('does NOT classify date text as food', () => {
      expect(classifyFoodItem('Mon')).toBeNull();
      expect(classifyFoodItem('Sep 14')).toBeNull();
      expect(classifyFoodItem('Mon, Sep 14')).toBeNull();
    });

    it('classifies flour tortillas as starch', () => {
      expect(classifyFoodItem('flour tortillas')).toBe('starch');
    });
  });

  // ── extractAmount — nearest-token binding, no water stealing ─────────────────

  describe('extractAmount — nearest-token binding, no water stealing', () => {
    it('binds 32oz to water', () => {
      expect(extractAmount('32oz water', 5).amount).toBe(32);
    });

    it('no amount given for olive oil → default 1', () => {
      const r = extractAmount('olive oil', 0);
      expect(r.amount).toBe(1);
      expect(r.unit).toBe('');
    });

    it('captures 1 tsp for olive oil when immediately before', () => {
      const r = extractAmount('1 tsp olive oil', 7);
      expect(r.amount).toBe(1);
      expect(r.unit).toBe('tsp');
    });

    it('binds 2 cups to green beans (food pos near start)', () => {
      const r = extractAmount('2 cups green beans', 3);
      expect(r.amount).toBe(2);
      expect(r.unit).toBe('cups');
    });

    it('binds 3 to beef enchiladas', () => {
      const r = extractAmount('3 beef enchiladas', 2);
      expect(r.amount).toBe(3);
    });
  });

  // ── Full string: period-split items ─────────────────────────────────────────

  describe('DINNER exact string — period-split items', () => {
    const items = DINNER_EXACT.split(/[.;]+/).map(s => s.trim()).filter(Boolean);

    it('produces 4 items after period split (no comma mangling)', () => {
      expect(items.length).toBe(4);
    });

    it('first item is metadata (not a food)', () => {
      expect(classifyFoodItem(items[0])).toBeNull();
    });

    it('water item → null (plain water, not veg)', () => {
      expect(classifyFoodItem(items[1])).toBeNull();
    });

    it('beef enchiladas → protein', () => {
      expect(classifyFoodItem(items[2])).toBe('protein');
    });

    it('green beans with olive oil → veg (first food in compound item)', () => {
      expect(classifyFoodItem(items[3])).toBe('veg');
    });
  });

  // ── Punctuation variants produce same category results ─────────────────────

  describe('punctuation variants produce same protein/veg/fat/water results', () => {
    const variants = [
      '📸 DINNER — Mon, Sep 14. 32oz water. 3 beef enchiladas flour tortillas. 2 cups green beans with olive oil.',
      '📸 DINNER — Mon Sep 14. 32oz water. 3 beef enchiladas flour tortillas. 2 cups green beans with olive oil.',
    ];

    variants.forEach((variant, i) => {
      it(`variant ${i + 1}: beef → protein`, () => {
        const parts = variant.split(/[.;]+/).map(s => s.trim()).filter(Boolean);
        const beefItem = parts.find(item =>
          item.toLowerCase().includes('beef') && !item.toLowerCase().includes('📸')
        );
        expect(beefItem).toBeDefined();
        expect(classifyFoodItem(beefItem!)).toBe('protein');
      });

      it(`variant ${i + 1}: green beans → veg`, () => {
        const parts = variant.split(/[.;]+/).map(s => s.trim()).filter(Boolean);
        const vegItem = parts.find(item => item.toLowerCase().includes('green beans'));
        expect(vegItem).toBeDefined();
        expect(classifyFoodItem(vegItem!)).toBe('veg');
      });

      it(`variant ${i + 1}: olive oil → fat (isolated)`, () => {
        // Isolated test: olive oil alone is fat
        expect(classifyFoodItem('olive oil')).toBe('fat');
      });

      it(`variant ${i + 1}: water → null (plain water, not water chestnuts)`, () => {
        const parts = variant.split(/[.;]+/).map(s => s.trim()).filter(Boolean);
        const waterItem = parts.find(item => item.toLowerCase().includes('water'));
        expect(waterItem).toBeDefined();
        expect(classifyFoodItem(waterItem!)).toBeNull();
      });
    });
  });
});
