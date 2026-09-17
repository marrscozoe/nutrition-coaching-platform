// Test the regex patterns directly

const pattern = /([\d]+(?:\.[\d]+)?(?:\s*\/\s*[\d]+)?|(?:[\d]+\s*\/\s*[\d]+))\s*(oz|ounce|ounces|cups?|tbsp|tablespoons?|handfuls?|handful|egg|eggs|g|gram|grams)\b/gi;
const noSpacePattern = /([\d]+(?:\.[\d]+)?)\s*(g|gram|grams)\b/gi;

const testCases = ['40 gram protein bar', '40 grams protein bar', '40g protein bar', '40gram protein bar'];

for (const tc of testCases) {
  console.log(`\n=== Testing: "${tc}" ===`);
  
  // Reset lastIndex
  pattern.lastIndex = 0;
  noSpacePattern.lastIndex = 0;
  
  let m;
  const matches = [];
  while ((m = pattern.exec(tc)) !== null) {
    matches.push({ what: 'pattern', amount: m[1], unit: m[2], index: m.index });
  }
  
  const noSpaceMatches = [];
  while ((m = noSpacePattern.exec(tc)) !== null) {
    // Check if already covered
    const alreadyCovered = matches.some(existing => m!.index >= existing.index && m!.index < existing.index + existing.unit.length + existing.amount.length + 2);
    if (!alreadyCovered) {
      noSpaceMatches.push({ what: 'noSpace', amount: m[1], unit: m[2], index: m.index });
    }
  }
  
  console.log('pattern matches:', matches);
  console.log('noSpace matches:', noSpaceMatches);
}
