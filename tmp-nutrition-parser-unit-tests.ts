/**
 * Unit tests for the nutrition parser fix.
 * Run with: cd ~/.openclaw/workspace/nutrition-coaching-platform && tsx /tmp/nutrition-parser-unit-tests.ts
 */
import { parseFoodDescriptionToPortions, mealContainsPlainWater, extractWaterOzFromDescription } from './src/lib/nutrition-data';

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(`FAIL: ${msg}`);
  console.log(`  PASS: ${msg}`);
}

function assertApprox(actual: number, expected: number, field: string) {
  const ok = Math.abs(actual - expected) < 0.05;
  if (!ok) throw new Error(`FAIL [${field}]: expected ~${expected}, got ${actual}`);
  console.log(`  PASS: ${field} = ${actual} (≈ ${expected})`);
}

console.log('\n=== TEST A: Allen exact string ===');
console.log('Input: "20oz water 12oz coffee 1 tablespoon heavy cream 1 tablespoon sugar"');
const resultA = parseFoodDescriptionToPortions('20oz water 12oz coffee 1 tablespoon heavy cream 1 tablespoon sugar');
const plainWaterA = mealContainsPlainWater('20oz water 12oz coffee 1 tablespoon heavy cream 1 tablespoon sugar');
const waterOzA = extractWaterOzFromDescription('20oz water 12oz coffee 1 tablespoon heavy cream 1 tablespoon sugar', 0);
console.log('  plainWater:', plainWaterA, '(expected: true)');
console.log('  waterOz:', waterOzA, '(expected: 20)');
console.log('  fatTbsp:', resultA.fatTbsp, '(expected: 1 — cream only, sugar not fat)');
assert(plainWaterA === true, 'plainWater should be true');
assertApprox(waterOzA, 20, 'waterOz');
// Sugar is not a fat, so only heavy cream = 1 tbsp
assertApprox(resultA.fatTbsp, 1, 'fatTbsp (cream only)');
console.log('Result A: PASS\n');

console.log('\n=== TEST B: "24oz water. 12 oz coffee with 1 tbsp heavy cream" ===');
const resultB = parseFoodDescriptionToPortions('24oz water. 12 oz coffee with 1 tbsp heavy cream');
const plainWaterB = mealContainsPlainWater('24oz water. 12 oz coffee with 1 tbsp heavy cream');
const waterOzB = extractWaterOzFromDescription('24oz water. 12 oz coffee with 1 tbsp heavy cream', 0);
console.log('  plainWater:', plainWaterB, '(expected: true)');
console.log('  waterOz:', waterOzB, '(expected: 24)');
console.log('  fatTbsp:', resultB.fatTbsp, '(expected: 1)');
assert(plainWaterB === true, 'plainWater should be true');
assertApprox(waterOzB, 24, 'waterOz');
assertApprox(resultB.fatTbsp, 1, 'fatTbsp');
console.log('Result B: PASS\n');

console.log('\n=== TEST C: "1 tablespoon heavy cream" alone ===');
const resultC = parseFoodDescriptionToPortions('1 tablespoon heavy cream');
console.log('  fatTbsp:', resultC.fatTbsp, '(expected: 1)');
assertApprox(resultC.fatTbsp, 1, 'fatTbsp');
console.log('Result C: PASS\n');

console.log('\n=== TEST D: Goal 6 fat − 1 cream → remaining 5 ===');
// This is a logical assertion: a meal with only 1 tbsp cream from a goal of 6
// leaves 5 remaining. The parser correctly returns 1 tbsp for this meal.
const resultD = parseFoodDescriptionToPortions('1 tablespoon heavy cream');
const goal = 6;
const remaining = goal - resultD.fatTbsp;
console.log('  goal:', goal, '| meal fat:', resultD.fatTbsp, '| remaining:', remaining, '(expected: 5)');
assert(remaining === 5, `remaining should be 5, got ${remaining}`);
assert(resultD.fatTbsp === 1, 'meal fat should be exactly 1 — never 0 or wrong value');
console.log('Result D: PASS\n');

// Additional regression tests
console.log('\n=== REGRESSION: "6 oz chicken breast, 1 cup broccoli, 1 tbsp olive oil" ===');
const reg1 = parseFoodDescriptionToPortions('6 oz chicken breast, 1 cup broccoli, 1 tbsp olive oil');
console.log('  proteinOz:', reg1.proteinOz, '(expected: 6)');
console.log('  vegCups:', reg1.vegCups, '(expected: 1)');
console.log('  fatTbsp:', reg1.fatTbsp, '(expected: 1)');
assertApprox(reg1.proteinOz, 6, 'proteinOz');
assertApprox(reg1.vegCups, 1, 'vegCups');
assertApprox(reg1.fatTbsp, 1, 'fatTbsp');
console.log('Regression 1: PASS\n');

console.log('\n=== REGRESSION: "2 eggs, 1/2 avocado" ===');
const reg2 = parseFoodDescriptionToPortions('2 eggs, 1/2 avocado');
console.log('  proteinOz:', reg2.proteinOz, '(expected: 2)');
console.log('  fatTbsp:', reg2.fatTbsp, '(expected: 2 — 1/2 avocado ≈ 2 tbsp)');
assertApprox(reg2.proteinOz, 2, 'proteinOz');
assertApprox(reg2.fatTbsp, 2, 'fatTbsp');
console.log('Regression 2: PASS\n');

console.log('\n=== REGRESSION: "20oz water 12oz coffee" — coffee NOT plain water ===');
const plainWaterCoffee = mealContainsPlainWater('20oz water 12oz coffee');
const waterOzCoffee = extractWaterOzFromDescription('20oz water 12oz coffee', 0);
console.log('  plainWater:', plainWaterCoffee, '(expected: true — water is present)');
console.log('  waterOz:', waterOzCoffee, '(expected: 20)');
assert(plainWaterCoffee === true, 'plainWater should be true (water present separately from coffee)');
assertApprox(waterOzCoffee, 20, 'waterOz');
console.log('Regression coffee: PASS\n');

console.log('\n✅ ALL TESTS PASSED\n');
