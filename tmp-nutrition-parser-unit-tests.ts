/**
 * Unit tests for the nutrition parser fix.
 * Run with: cd ~/.openclaw/workspace/nutrition-coaching-platform && npx tsx tmp-nutrition-parser-unit-tests.ts
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

function assertEqual(actual: any, expected: any, field: string) {
  const ok = actual === expected;
  if (!ok) throw new Error(`FAIL [${field}]: expected ${expected}, got ${actual}`);
  console.log(`  PASS: ${field} = ${actual}`);
}

// =============================================================================
// CORE TESTS (existing)
// =============================================================================

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
const resultD = parseFoodDescriptionToPortions('1 tablespoon heavy cream');
const goal = 6;
const remaining = goal - resultD.fatTbsp;
console.log('  goal:', goal, '| meal fat:', resultD.fatTbsp, '| remaining:', remaining, '(expected: 5)');
assert(remaining === 5, `remaining should be 5, got ${remaining}`);
assert(resultD.fatTbsp === 1, 'meal fat should be exactly 1 — never 0 or wrong value');
console.log('Result D: PASS\n');

// =============================================================================
// REGRESSION TESTS
// =============================================================================

console.log('\n=== REGRESSION 1: "6 oz chicken breast, 1 cup broccoli, 1 tbsp olive oil" ===');
const reg1 = parseFoodDescriptionToPortions('6 oz chicken breast, 1 cup broccoli, 1 tbsp olive oil');
console.log('  proteinOz:', reg1.proteinOz, '(expected: 6)');
console.log('  vegCups:', reg1.vegCups, '(expected: 1)');
console.log('  fatTbsp:', reg1.fatTbsp, '(expected: 1)');
assertApprox(reg1.proteinOz, 6, 'proteinOz');
assertApprox(reg1.vegCups, 1, 'vegCups');
assertApprox(reg1.fatTbsp, 1, 'fatTbsp');
console.log('Regression 1: PASS\n');

console.log('\n=== REGRESSION 2: "2 eggs, 1/2 avocado" ===');
// FIX: 1/2 avocado = 1 tbsp fat per the program (avocado entry: "Avocado (1/2 male, 1/4 female)")
// The test previously said 2 tbsp which was wrong.
const reg2 = parseFoodDescriptionToPortions('2 eggs, 1/2 avocado');
console.log('  proteinOz:', reg2.proteinOz, '(expected: 2)');
console.log('  fatTbsp:', reg2.fatTbsp, '(expected: 1 — 1/2 avocado = 1 tbsp fat)');
assertApprox(reg2.proteinOz, 2, 'proteinOz');
assertApprox(reg2.fatTbsp, 1, 'fatTbsp (1/2 avocado = 1 tbsp)');
console.log('Regression 2: PASS\n');

console.log('\n=== REGRESSION 3: "20oz water 12oz coffee" — coffee NOT plain water ===');
const plainWaterCoffee = mealContainsPlainWater('20oz water 12oz coffee');
const waterOzCoffee = extractWaterOzFromDescription('20oz water 12oz coffee', 0);
console.log('  plainWater:', plainWaterCoffee, '(expected: true — water is present)');
console.log('  waterOz:', waterOzCoffee, '(expected: 20)');
assert(plainWaterCoffee === true, 'plainWater should be true (water present separately from coffee)');
assertApprox(waterOzCoffee, 20, 'waterOz');
console.log('Regression 3: PASS\n');

// =============================================================================
// NEW COMPOUND MEAL TESTS — order independence & mixed-format parsing
// =============================================================================

console.log('\n=== NEW TEST 1: water+coffee+cream+sugar ===');
// "20oz water 12oz coffee 1 tablespoon heavy cream 1 tablespoon sugar"
// Water: 20oz (plain water), Coffee: 0oz (not plain), Cream: 1 tbsp fat, Sugar: 0 fat
const t1 = parseFoodDescriptionToPortions('20oz water 12oz coffee 1 tablespoon heavy cream 1 tablespoon sugar');
const t1w = extractWaterOzFromDescription('20oz water 12oz coffee 1 tablespoon heavy cream 1 tablespoon sugar', 0);
console.log('  waterOz:', t1.waterOz, '(expected: 20)');
console.log('  fatTbsp:', t1.fatTbsp, '(expected: 1 — cream only)');
console.log('  proteinOz:', t1.proteinOz, '(expected: 0)');
console.log('  vegCups:', t1.vegCups, '(expected: 0)');
assertApprox(t1.waterOz, 20, 'waterOz');
assertApprox(t1.fatTbsp, 1, 'fatTbsp');
assertApprox(t1.proteinOz, 0, 'proteinOz');
assertApprox(t1.vegCups, 0, 'vegCups');
console.log('NEW TEST 1: PASS\n');

console.log('\n=== NEW TEST 2: protein+veg+fat comma-separated ===');
// "6 oz chicken breast, 1 cup broccoli, 1 tbsp olive oil"
const t2 = parseFoodDescriptionToPortions('6 oz chicken breast, 1 cup broccoli, 1 tbsp olive oil');
console.log('  proteinOz:', t2.proteinOz, '(expected: 6)');
console.log('  vegCups:', t2.vegCups, '(expected: 1)');
console.log('  fatTbsp:', t2.fatTbsp, '(expected: 1)');
assertApprox(t2.proteinOz, 6, 'proteinOz');
assertApprox(t2.vegCups, 1, 'vegCups');
assertApprox(t2.fatTbsp, 1, 'fatTbsp');
console.log('NEW TEST 2: PASS\n');

console.log('\n=== NEW TEST 3: undelimited (no commas) ===');
// "6oz chicken 1cup broccoli 1tbsp olive oil" — no commas
const t3 = parseFoodDescriptionToPortions('6oz chicken 1cup broccoli 1tbsp olive oil');
console.log('  proteinOz:', t3.proteinOz, '(expected: 6)');
console.log('  vegCups:', t3.vegCups, '(expected: 1)');
console.log('  fatTbsp:', t3.fatTbsp, '(expected: 1)');
assertApprox(t3.proteinOz, 6, 'proteinOz');
assertApprox(t3.vegCups, 1, 'vegCups');
assertApprox(t3.fatTbsp, 1, 'fatTbsp');
console.log('NEW TEST 3: PASS\n');

console.log('\n=== NEW TEST 4: "with"/"and" style ===');
// "4 oz salmon with 1/2 cup asparagus and 1 tbsp butter"
const t4 = parseFoodDescriptionToPortions('4 oz salmon with 1/2 cup asparagus and 1 tbsp butter');
console.log('  proteinOz:', t4.proteinOz, '(expected: 4)');
console.log('  vegCups:', t4.vegCups, '(expected: 0.5)');
console.log('  fatTbsp:', t4.fatTbsp, '(expected: 1 — butter)');
assertApprox(t4.proteinOz, 4, 'proteinOz');
assertApprox(t4.vegCups, 0.5, 'vegCups');
assertApprox(t4.fatTbsp, 1, 'fatTbsp');
console.log('NEW TEST 4: PASS\n');

console.log('\n=== NEW TEST 5: period-separated ===');
// "2 eggs. 1/2 avocado." — period-separated; 1/2 avocado = 1 tbsp fat
const t5 = parseFoodDescriptionToPortions('2 eggs. 1/2 avocado.');
console.log('  proteinOz:', t5.proteinOz, '(expected: 2)');
console.log('  fatTbsp:', t5.fatTbsp, '(expected: 1 — 1/2 avocado = 1 tbsp fat)');
assertApprox(t5.proteinOz, 2, 'proteinOz');
assertApprox(t5.fatTbsp, 1, 'fatTbsp (1/2 avocado = 1 tbsp)');
console.log('NEW TEST 5: PASS\n');

console.log('\n=== NEW TEST 6: ground beef in compound meal ===');
// "20oz water 4oz ground beef 1 cup green beans 1 tablespoon olive oil"
// Ground beef: 4oz protein; Water: 20oz plain; Green beans: 1 cup veg; Olive oil: 1 tbsp fat
const t6 = parseFoodDescriptionToPortions('20oz water 4oz ground beef 1 cup green beans 1 tablespoon olive oil');
console.log('  proteinOz:', t6.proteinOz, '(expected: 4)');
console.log('  waterOz:', t6.waterOz, '(expected: 20)');
console.log('  vegCups:', t6.vegCups, '(expected: 1)');
console.log('  fatTbsp:', t6.fatTbsp, '(expected: 1)');
assertApprox(t6.proteinOz, 4, 'proteinOz (ground beef)');
assertApprox(t6.waterOz, 20, 'waterOz');
assertApprox(t6.vegCups, 1, 'vegCups');
assertApprox(t6.fatTbsp, 1, 'fatTbsp');
console.log('NEW TEST 6: PASS\n');

// =============================================================================
// ORDER-INDEPENDENCE TEST
// parse("A, B, C") === parse("A") + parse("B") + parse("C")
// Also verify reverse order gives same result.
// =============================================================================

console.log('\n=== ORDER-INDEPENDENCE TEST ===');

function parseAndSum(...descriptions: string[]) {
  const totals = { proteinOz: 0, vegCups: 0, fatTbsp: 0, starchCups: 0, waterOz: 0 };
  for (const d of descriptions) {
    const r = parseFoodDescriptionToPortions(d);
    totals.proteinOz += r.proteinOz;
    totals.vegCups += r.vegCups;
    totals.fatTbsp += r.fatTbsp;
    totals.starchCups += r.starchCups;
    totals.waterOz += r.waterOz;
  }
  return totals;
}

function assertTotalsMatch(together: any, sum: any, label: string) {
  const fields: Array<keyof typeof together> = ['proteinOz', 'vegCups', 'fatTbsp', 'starchCups', 'waterOz'];
  for (const f of fields) {
    const diff = Math.abs(together[f] - sum[f]);
    if (diff >= 0.05) {
      throw new Error(`FAIL [${label} ${f}]: together=${together[f]}, sum=${sum[f]}`);
    }
  }
  console.log(`  PASS: ${label} — together matches sum of individual items`);
}

// Test 1: comma-separated together vs one-at-a-time
const abcTogether = parseFoodDescriptionToPortions('6 oz chicken breast, 1 cup broccoli, 1 tbsp olive oil');
const abcSum = parseAndSum('6 oz chicken breast', '1 cup broccoli', '1 tbsp olive oil');
assertTotalsMatch(abcTogether, abcSum, 'comma-separated A+B+C vs one-at-a-time');
console.log(`  together=${JSON.stringify(abcTogether)}`);
console.log(`  sum=${JSON.stringify(abcSum)}`);

// Test 2: reverse order
const cbaTogether = parseFoodDescriptionToPortions('1 tbsp olive oil, 1 cup broccoli, 6 oz chicken breast');
const cbaSum = parseAndSum('1 tbsp olive oil', '1 cup broccoli', '6 oz chicken breast');
assertTotalsMatch(cbaTogether, cbaSum, 'reverse comma-separated C+B+A vs one-at-a-time');
assertTotalsMatch(cbaTogether, abcTogether, 'reverse order matches original order');

// Test 3: undelimited together vs one-at-a-time
const undelTogether = parseFoodDescriptionToPortions('6oz chicken 1cup broccoli 1tbsp olive oil');
const undelSum = parseAndSum('6oz chicken', '1cup broccoli', '1tbsp olive oil');
assertTotalsMatch(undelTogether, undelSum, 'undelimited vs one-at-a-time');
console.log(`  undel_together=${JSON.stringify(undelTogether)}`);
console.log(`  undel_sum=${JSON.stringify(undelSum)}`);

// Test 4: mixed format (period + comma) together vs one-at-a-time
const mixedTogether = parseFoodDescriptionToPortions('2 eggs. 1/2 avocado.');
const mixedSum = parseAndSum('2 eggs', '1/2 avocado');
assertTotalsMatch(mixedTogether, mixedSum, 'period-separated vs one-at-a-time');
console.log(`  mixed_together=${JSON.stringify(mixedTogether)}`);
console.log(`  mixed_sum=${JSON.stringify(mixedSum)}`);

console.log('Order-independence: PASS\n');

console.log('\n✅ ALL TESTS PASSED\n');
