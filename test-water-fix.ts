// Quick verification script for water oz extraction fix
// Run with: cd nutrition-coaching-platform && npx ts-node test-water-fix.ts

import { extractWaterOzFromDescription, parseFoodDescriptionToPortions } from './src/lib/nutrition-data';

const tests = [
  {
    input: '20oz water 12oz coffee 1 tablespoon heavy cream 1 tablespoon sugar',
    expected: 20,
    label: '20oz water + coffee+cream+ sugar'
  },
  {
    input: '24oz water 24 oz water',
    expected: 48,
    label: '24oz water + 24 oz water (two mentions)'
  },
  {
    input: '12oz coffee 20oz water',
    expected: 20,
    label: '20oz water after coffee'
  },
  {
    input: '20ozwater 12oz coffee',
    expected: 20,
    label: '20ozwater (no space between oz and water)'
  },
  {
    input: 'water 24 oz',
    expected: 24,
    label: 'water 24 oz (num after water)'
  },
  {
    input: '1 cup broccoli 16oz water',
    expected: 16,
    label: '16oz water after veg'
  },
];

let passed = 0;
let failed = 0;

for (const t of tests) {
  const result = extractWaterOzFromDescription(t.input, 32);
  const ok = result === t.expected;
  console.log(`${ok ? '✓' : '✗'} [${t.label}] => ${result} (expected ${t.expected})`);
  ok ? passed++ : failed++;
}

console.log(`\n--- extractWaterOzFromDescription: ${passed}/${passed + failed} passed ---\n`);

// Test parseFoodDescriptionToPortions
const portionTests = [
  {
    input: '20oz water 12oz coffee 1 tablespoon heavy cream 1 tablespoon sugar',
    expectedWaterOz: 20,
    label: 'parseFoodDescriptionToPortions: 20oz water'
  },
  {
    input: '24oz water 24 oz water',
    expectedWaterOz: 48,
    label: 'parseFoodDescriptionToPortions: 48oz water (two mentions)'
  },
];

let pPassed = 0;
let pFailed = 0;

for (const t of portionTests) {
  const result = parseFoodDescriptionToPortions(t.input);
  const ok = result.waterOz === t.expectedWaterOz;
  console.log(`${ok ? '✓' : '✗'} [${t.label}] => waterOz=${result.waterOz} (expected ${t.expectedWaterOz})`);
  ok ? pPassed++ : pFailed++;
}

console.log(`\n--- parseFoodDescriptionToPortions: ${pPassed}/${pPassed + pFailed} passed ---`);
console.log('\nAll tests:', failed === 0 && pFailed === 0 ? '✓ ALL PASSED' : '✗ SOME FAILED');
