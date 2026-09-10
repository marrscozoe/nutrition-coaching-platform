import { parseFoodDescriptionToPortions, classifyFoodItem } from './src/lib/nutrition-data';

console.log('4oz ground beef alone:', JSON.stringify(parseFoodDescriptionToPortions('4oz ground beef')));
console.log('ground beef alone:', JSON.stringify(parseFoodDescriptionToPortions('ground beef')));
console.log('full compound:', JSON.stringify(parseFoodDescriptionToPortions('20oz water 4oz ground beef 1 cup green beans 1 tablespoon olive oil')));

// Trace splitting
const foodDescription = '20oz water 4oz ground beef 1 cup green beans 1 tablespoon olive oil';
const rawItems = foodDescription.split(/[,;\n]+|\.\s*/);
const items: string[] = [];
for (const raw of rawItems) {
  const andSplit = raw.split(/\s+(?:with|and)\s+/i);
  for (const chunk of andSplit) {
    const unitSplit = chunk.split(/\s+(?=\d{1,4}(?:\.\d+)?(?:\s*\/\s*\d+)?\s*(?:oz|ounce|tbsp|tablespoons?|cups?|handfuls?|egg|eggs)\b)/gi);
    for (const p of unitSplit) {
      const trimmed = p.trim();
      if (trimmed) items.push(trimmed);
    }
  }
}
console.log('Items:', items);

for (const item of items) {
  const cat = classifyFoodItem(item);
  console.log('Item:', JSON.stringify(item), '-> category:', cat);
}

// Check word boundary matching for ground beef
const lower = '4oz ground beef';
const fnBase = 'ground beef';
const escaped = fnBase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const pattern = new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, 'i');
console.log('\nPattern:', pattern);
console.log('Test "4oz ground beef":', pattern.test(lower));

// Check bidirectional for ground beef
const fnWords = fnBase.split(/[\s,]+/);
const fnLastWord = fnWords[fnWords.length - 1];
console.log('fnWords:', fnWords, 'fnLastWord:', fnLastWord);

// Check itemTokens for "4oz ground beef"
const itemTokens = lower.split(/[\s,]+/).filter(t => !t.match(/^\d/) && !['oz', 'ounce', 'ounces', 'cup', 'cups', 'tbsp', 'tablespoon', 'tablespoons', 'handful', 'handfuls'].includes(t));
const itemFoodWord = itemTokens[itemTokens.length - 1] || '';
console.log('itemTokens:', itemTokens, 'itemFoodWord:', itemFoodWord);

// Check if itemFoodWord ends with fnLastWord
console.log('Does', itemFoodWord, 'end with', fnLastWord, '?:', itemFoodWord.endsWith(fnLastWord));
