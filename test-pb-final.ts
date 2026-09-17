import { parseFoodDescriptionToPortions } from './src/lib/nutrition-data';

const cases = [
  '40g protein bar',
  '40 gram protein bar',
  '40 grams protein bar',
  '40gram protein bar'
];

console.log('=== Protein Bar Gram Parsing ===\n');
let allPass = true;
for (const c of cases) {
  const r = parseFoodDescriptionToPortions(c);
  const ok = Math.abs(r.proteinOz - 6.0) < 0.05;
  const status = ok ? '✅ PASS' : '❌ FAIL';
  if (!ok) allPass = false;
  console.log(`${status}: '${c}' => proteinOz=${r.proteinOz} (expected ~6.0)`);
}

// Also test powder forms still work
console.log('\n=== Powder Regression ===\n');
const powder = parseFoodDescriptionToPortions('40g protein powder');
const powderOk = Math.abs(powder.proteinOz - 6.0) < 0.05;
console.log(`${powderOk ? '✅ PASS' : '❌ FAIL'}: '40g protein powder' => proteinOz=${powder.proteinOz} (expected ~6.0)`);
if (!powderOk) allPass = false;

console.log('\n=== Summary ===');
console.log(allPass ? '✅ ALL TESTS PASS' : '❌ SOME TESTS FAIL');
