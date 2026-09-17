import { parseFoodDescriptionToPortions } from './src/lib/nutrition-data';

const cases = [
  '40 gram protein bar',
  '40 grams protein bar',
  '40g protein bar',
  '40gram protein bar'
];
for (const c of cases) {
  const r = parseFoodDescriptionToPortions(c);
  console.log(`'${c}' => proteinOz=${r.proteinOz} (expected ~6.0)`);
}
