// ============================================
// ALLERGY TYPES — hard ban keys → display names
// ============================================

export const ALLERGY_TYPES: Record<string, string> = {
  dairy: 'Dairy',
  gluten: 'Gluten/Wheat',
  eggs: 'Eggs',
  soy: 'Soy',
  shellfish: 'Shellfish',
  nuts: 'Tree Nuts',
  peanuts: 'Peanuts',
  fish: 'Fish',
  nightshades: 'Nightshades (tomatoes, peppers, eggplant)',
  histamine: 'Histamine',
};

// ============================================
// ALLERGY → FOOD REMOVAL MAPPINGS
// which allergy removes which foods from which list
// ============================================

// Keyword patterns banned per allergy (partial match on food string)
const ALLERGY_BAN_PATTERNS: Record<string, { list: string; patterns: string[] }[]> = {
  dairy: [
    { list: 'LEAN_PROTEINS', patterns: ['whey', 'yogurt', 'cottage cheese', 'ricotta', 'kefir', 'cream', 'sour cream', 'cheese', 'parmesan', 'mozzarella', 'cheddar', 'swiss', 'gouda', 'feta', 'goat cheese', 'blue cheese', 'cream cheese', 'half and half'] },
    { list: 'HEALTHY_FATS', patterns: ['kerrygold', 'ghee', 'butter'] },
  ],
  gluten: [
    { list: 'STARCHY_CARBOHYDRATES', patterns: ['bread', 'pasta', 'cracker', 'breaded', 'wheat', 'barley', 'rye', 'oats', 'oatmeal', 'couscous', 'bulgur', 'seitan', 'tortilla', 'pita', 'bagel', 'croissant', 'muffin', 'pancake', 'waffle', 'noodle'] },
  ],
  eggs: [
    { list: 'LEAN_PROTEINS', patterns: ['egg', 'mayo', 'aioli', 'quiche', 'meringue', 'custard', 'hollandaise', 'egg white'] },
  ],
  soy: [
    { list: 'STARCHY_CARBOHYDRATES', patterns: ['soybean', 'tofu', 'tempeh', 'edamame', 'soy milk', 'soy sauce', 'soybean', 'soya'] },
  ],
  shellfish: [
    { list: 'LEAN_PROTEINS', patterns: ['shrimp', 'crab', 'lobster', 'crawfish', 'scallop', 'clam', 'mussel', 'oyster', 'crawfish', 'crayfish', 'shellfish'] },
  ],
  nuts: [
    { list: 'HEALTHY_FATS', patterns: ['almond', 'walnut', 'pecan', 'cashew', 'macadamia', 'hazelnut', 'brazil nut', 'pine nut', 'pistachio', 'nuttzo', 'nut butter', 'mixed', 'nut'] },
  ],
  peanuts: [
    { list: 'HEALTHY_FATS', patterns: ['peanut'] },
  ],
  fish: [
    { list: 'LEAN_PROTEINS', patterns: ['salmon', 'tuna', 'cod', 'halibut', 'tilapia', 'bass', 'trout', 'sardine', 'anchovy', 'mackerel', 'catfish', 'mahi', 'swordfish', 'redfish', 'fish', 'red snapper', 'orange roughy', 'perch', 'pollock', 'herring'] },
  ],
  nightshades: [
    { list: 'FIBROUS_VEGETABLES', patterns: ['tomato', 'tomatillo', 'pepper', 'eggplant', 'potato'] },
  ],
  histamine: [
    { list: 'FIBROUS_VEGETABLES', patterns: ['spinach', 'kale', 'avocado'] },
    { list: 'STARCHY_CARBOHYDRATES', patterns: ['fermented'] },
    { list: 'HEALTHY_FATS', patterns: ['aged cheese', 'leftover cooked meat'] },
  ],
};

// ============================================
// ALLERGY FILTERING FUNCTIONS
// ============================================

/**
 * Returns true if a food is banned by any of the given allergies.
 * Uses partial matching: "whey protein" is banned by dairy, "almond butter" is banned by nuts.
 */
export function isFoodBanned(food: string, allergies: string[]): boolean {
  // Extract the food name only (before the first parenthesis) to avoid
  // matching keywords that appear in portion descriptions like "3 small handfuls"
  const foodName = food.split('(')[0].toLowerCase().trim();
  for (const allergy of allergies) {
    const rules = ALLERGY_BAN_PATTERNS[allergy];
    if (!rules) continue;
    for (const rule of rules) {
      for (const pattern of rule.patterns) {
        const pat = pattern.toLowerCase();
        // Use word-boundary regex to avoid "cream" matching "cream" in "cream cheese"
        // but also avoid "cream" matching inside "mixed nuts (cream..." — doesn't apply
        // since we now use foodName only (no portion text)
        if (foodName.includes(pat)) {
          return true;
        }
      }
    }
  }
  return false;
}

/**
 * Filters a list of foods, removing any that are banned by the given allergies.
 * Logs removed items at debug level.
 */
export function filterFoodsForAllergies(foods: string[], allergies: string[]): string[] {
  if (!allergies || allergies.length === 0) return foods;
  const removed: string[] = [];
  const filtered = foods.filter(food => {
    if (isFoodBanned(food, allergies)) {
      removed.push(food);
      return false;
    }
    return true;
  });
  if (removed.length > 0) {
    console.debug(`[AllergyFilter] Removed ${removed.length} foods: ${removed.join(', ')}`);
  }
  return filtered;
}

/**
 * Returns the filtered STARCHY_CARBOHYDRATES list for pizza-swap purposes,
 * excluding any items banned by the given allergies.
 * Also returns the starch portion description.
 */
export function getAllowedStarches(allergies: string[]): string {
  const filtered = filterFoodsForAllergies(STARCHY_CARBOHYDRATES, allergies);
  return filtered.join(', ');
}

/**
 * Get filtered food lists based on allergies.
 * Returns a copy of each list with banned items removed.
 */
export function getFilteredFoodLists(allergies: string[]) {
  return {
    leanProteins: filterFoodsForAllergies(LEAN_PROTEINS, allergies),
    starchyCarbohydrates: filterFoodsForAllergies(STARCHY_CARBOHYDRATES, allergies),
    fibrousVegetables: filterFoodsForAllergies(FIBROUS_VEGETABLES, allergies),
    healthyFats: filterFoodsForAllergies(HEALTHY_FATS, allergies),
  };
}

// ============================================
// ALL FOOD CATEGORIES (same for all phases)
// ============================================

export const LEAN_PROTEINS = [
  'Chicken breast',
  'White fish', 'Tuna', 'Salmon', 'Redfish',
  'Eggs (2-3 for men, 1-2 for women)', 'Egg whites',
  'Lean beef', 'Lean pork', 'Turkey breast', 'Shrimp', 'Steak',
  'Plain non-fat Greek yogurt',
  'Tilapia', 'Cod', 'Halibut', 'Trout', 'Catfish', 'Scallops', 'Crab', 'Lobster',
  'Bison', 'Venison', 'Elk', 'Ostrich',
  'Egg beaters', 'Liquid eggs',
  'Protein powder',
  'Whey protein',
  'Bacon (nitrate-free, twice per week)',
];
// NO cheese or dairy while dieting

export const STARCHY_CARBOHYDRATES = [
  'Red potatoes', 'New potatoes', 'Sweet potatoes', 'Yukon Gold', 'Russet', 'Fingerling', 'Purple',
  'Brown rice', 'Wild rice', 'Jasmine rice', 'Basmati rice',
  'Oatmeal', 'Steel cut oats',
  'Barley', 'Bulgur', 'Buckwheat', 'Millet', 'Spelt',
  'Peas', 'Corn', 'Beans', 'Legumes',
  'Lentils', 'Cannellini beans', 'Navy beans', 'Lima beans', 'Butter beans',
  'Black Eyed Peas',
  'Plantain', 'Parsnips', 'Acorn squash', 'Delicata squash',
];
// Fresh or frozen, NO CANS

export const FIBROUS_VEGETABLES = [
  'Broccoli', 'Spinach', 'Asparagus', 'Zucchini',
  'Peppers',
  'Green lettuce (sparingly)',
  'Mushrooms', 'Green beans', 'Cauliflower',
  'Tomatoes', 'Cucumbers', 'Celery', 'Cabbage', 'Onions',
  'Kale', 'Bok choy', 'Radishes', 'Turnips', 'Beets', 'Jicama',
  'Artichoke', 'Brussels sprouts', 'Carrots', 'Eggplant',
  'Anaheim peppers', 'Poblano peppers', 'Jalapeño peppers', 'Serrano peppers',
  'Celery root', 'Fennel', 'Leeks', 'Water chestnuts', 'Bean sprouts', 'Alfalfa sprouts',
];
// Fresh or frozen, NO CANS

export const HEALTHY_FATS = [
  'Avocado (1/2 male, 1/4 female)',
  'Olive oil',
  'Almonds (3 small handfuls male, 2 small handfuls female)', 'Walnuts (3 small handfuls male, 2 small handfuls female)', 'Mixed nuts (3 small handfuls male, 2 small handfuls female)',
  'Kerrygold gold butter',
  'Heavy cream',
  'Safflower oil', 'Coconut oil',
  'MCT oil (in coffee)',
];

// Eggs are counted by number, not ounces — both protein AND fat
// Phases 1, 2, 4, 5: Men = 2-3 eggs, Women = 1-2 eggs
// Phase 6 (muscle gain): Men = 3-4 eggs, Women = 2-3 eggs
export const EGG_PORTIONS: Record<'male' | 'female', Record<number, string>> = {
  male: {
    1: '2-3 eggs',
    2: '2-3 eggs',
    4: '2-3 eggs',
    5: '2-3 eggs',
    6: '3-4 eggs',
  },
  female: {
    1: '1-2 eggs',
    2: '1-2 eggs',
    4: '1-2 eggs',
    5: '1-2 eggs',
    6: '2-3 eggs',
  },
};

export const SUPPLEMENTS = [
  'Whey protein powder — 40g (male) / 20g (female) — 1st thing AM & last thing PM (NOT with meals)',
  'Creatine-(follow container directions)',
  'Whey protein drink (Premier Protein Drink) — No more than 1 per day',
  'Vitamin (Centrum with dinner)',
  'Coffee — unsweetened, breakfast only',
  'MCT oil — follow directions',
];

// ============================================
// PORTION SIZES — by gender AND phase
// ============================================

interface PortionSizes {
  protein: string;
  fibrousVegetables: string;
  fat: string;
  avocado: string;
  starch: string;
  water: string;
}

export function getPortions(gender: 'male' | 'female', phase: number): PortionSizes {
  // Defensive: ensure gender is valid
  const safeGender: 'male' | 'female' = (gender === 'male' || gender === 'female') ? gender : 'male';
  
  // MEMORY.md is the source of truth
  // All phases use same base protein/fat/water portions EXCEPT Phase 6 has higher fat/starch
  // Phase 5 is same as other phases (6oz male / 4oz female protein)

  if (phase === 6) {
    // Phase 6: Muscle Gain - higher fat and starch
    if (gender === 'male') {
      return {
        protein: '6 ounces',
        fibrousVegetables: '2 cups',
        fat: '3 tablespoons',
        avocado: '3/4',
        starch: '3 cups',
        water: '128 oz daily (32 oz per meal)',
      };
    } else {
      return {
        protein: '4 ounces',
        fibrousVegetables: '1-2 cups',
        fat: '2 tablespoons',
        avocado: '3/4',
        starch: '2 cups',
        water: '80 oz daily (20 oz per meal)',
      };
    }
  }

  // Phase 1, 2, 4, 5: base portions (MEMORY.md correct values)
  // Phase 1: NO starch
  // Phase 2: starch on Wed/Sat/Sun B/L only
  // Phase 4: starch every meal
  // Phase 5: starch rules vary by day type (phase1/phase2/phase4 sub-phases)
  if (gender === 'male') {
    return {
      protein: '6 ounces',
      fibrousVegetables: '2 cups',
      fat: '2 tablespoons',
      avocado: '1/2',
      starch: '2 cups',
      water: '128 oz daily (32 oz per meal)',
    };
  } else {
    return {
      protein: '4 ounces',
      fibrousVegetables: '1-2 cups',
      fat: '1 tablespoon',
      avocado: '1/4',
      starch: '1 cup',
      water: '80 oz daily (20 oz per meal)',
    };
  }
}

// ============================================
// RULE-BASED MEAL SUGGESTION ENGINE
// ============================================

function pickRandom<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function isPhase2AllowedDay(): boolean {
  const chicagoTime = new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' });
  const day = new Date(chicagoTime).getDay();
  return day === 3 || day === 6 || day === 0;
}

export interface MealSuggestion {
  meal: string;
  veggies: string;
  fat: string;
  starch?: string;
  message: string;
}

export function generateMealSuggestion(
  context: {
    gender: 'male' | 'female';
    currentPhase: number;
    phase5StartDate?: string;
    phase5Plan?: Phase5Day[];
    allergies?: string[];
  },
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack' = 'lunch'
): MealSuggestion {
  const { gender, currentPhase, allergies = [] } = context;
  const isMale = gender === 'male';
  const portions = getPortions(gender, currentPhase);

  // Filter food lists by allergies
  const filtered = getFilteredFoodLists(allergies);
  const mainProteins = filtered.leanProteins.filter(
    p => !p.includes('Whey') && !p.includes('Bacon') && !p.includes('Protein powder')
  );
  const proteinChoice = mainProteins.length > 0 ? pickRandom(mainProteins, 1)[0] : 'Chicken breast';
  const veggiesChoice = pickRandom(filtered.fibrousVegetables, 2).join(' & ');
  const fatOptions = filtered.healthyFats.filter(f => !f.includes('MCT'));
  const fatChoice = fatOptions.length > 0 ? pickRandom(fatOptions, 1)[0] : 'Olive oil';
  // Scale avocado amount proportionally based on fat portion
  // 1 tbsp fat → 1/4 avocado; 2 tbsp fat → 1/2 avocado; 3 tbsp fat → 3/4 avocado
  const getAvocadoDisplay = () => {
    const tbspMatch = portions.fat.match(/(\d+)/);
    const fatTbsp = tbspMatch ? parseInt(tbspMatch[1]) : 2;
    const avocadoFraction = fatTbsp / 4;
    if (avocadoFraction === 0.25) return '1/4 avocado';
    if (avocadoFraction === 0.5) return '1/2 avocado';
    if (avocadoFraction === 0.75) return '3/4 avocado';
    return '1/2 avocado';
  };
  const isNuts = fatChoice.includes('Almonds') || fatChoice.includes('Walnuts') || fatChoice.includes('Mixed nuts');
  let fatDisplay: string;
  if (fatChoice.includes('Avocado')) {
    fatDisplay = getAvocadoDisplay();
  } else if (isNuts) {
    // Convert tablespoons to small handfuls for nuts
    const tbspMatch = portions.fat.match(/(\d+)/);
    const fatTbsp = tbspMatch ? parseInt(tbspMatch[1]) : 2;
    const handfuls = fatTbsp === 1 ? '1 small handful' : `${fatTbsp} small handfuls`;
    // Extract just the nut name (e.g., "Almonds" from "Almonds (3 small handfuls male, ...)")
    const nutName = fatChoice.split(' (')[0];
    fatDisplay = `${handfuls} ${nutName}`;
  } else {
    fatDisplay = `${portions.fat} ${fatChoice}`;
  }

  let starchDisplay: string | undefined;
  let starchAllowed = false;

  if (currentPhase === 1) {
    starchAllowed = false;
  } else if (currentPhase === 2) {
    const allowedDay = isPhase2AllowedDay();
    const isFirstTwoMeals = mealType === 'breakfast' || mealType === 'lunch';
    starchAllowed = allowedDay && isFirstTwoMeals;
  } else if (currentPhase === 5) {
    // Phase 5: check sub-phase for starch rules
    // 'phase1' sub-phase: no starch ever
    // 'phase2' sub-phase: starch at BREAKFAST and LUNCH only (not dinner, not snack)
    // 'phase4' sub-phase: starch every meal
    if (context.phase5StartDate && context.phase5Plan) {
      const phase5Rule = getPhase5CurrentRule(context.phase5Plan, context.phase5StartDate);
      console.log('[PHASE5] generateMealSuggestion — phase5StartDate:', context.phase5StartDate);
      console.log('[PHASE5] generateMealSuggestion — phase5Plan type:', typeof context.phase5Plan, 'isArray:', Array.isArray(context.phase5Plan), 'length:', context.phase5Plan?.length);
      console.log('[PHASE5] generateMealSuggestion — currentDay:', (() => {
        const start = new Date(context.phase5StartDate + 'T12:00:00');
        const now = new Date();
        return Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      })());
      console.log('[PHASE5] generateMealSuggestion — phase5Rule:', JSON.stringify(phase5Rule));
      if (phase5Rule?.type === 'phase1') {
        starchAllowed = false;
      } else if (phase5Rule?.type === 'phase2') {
        // Starch allowed only at breakfast and lunch (not dinner, not snack)
        starchAllowed = mealType === 'breakfast' || mealType === 'lunch';
      } else if (phase5Rule?.type === 'phase4') {
        starchAllowed = true;
      } else {
        starchAllowed = false;
      }
    } else {
      starchAllowed = false; // Default to no starch if phase 5 data not available
    }
  } else if (currentPhase >= 4) {
    starchAllowed = true;
  }

  if (starchAllowed) {
    const starchChoice = pickRandom(filtered.starchyCarbohydrates, 1)[0];
    starchDisplay = `${portions.starch} ${starchChoice.toLowerCase()}`;
  }

  let message = '';
  if (currentPhase === 1) {
    message = 'No starch in Phase 1 — stick to protein, veggies & fat! 💪';
  } else if (currentPhase === 2 && !starchAllowed) {
    message = 'No starch right now — save it for Wed/Sat/Sun breakfast or lunch!';
  } else if (currentPhase === 2 && starchAllowed) {
    message = `Starch allowed today! ${portions.starch} — eat up! 🔥`;
  } else if (currentPhase === 4) {
    message = "Every meal gets starch — you're in Phase 4 maintenance mode! 🎉";
  } else if (currentPhase === 5) {
    // Phase 5 message depends on sub-phase
    if (context.phase5StartDate && context.phase5Plan) {
      const phase5Rule = getPhase5CurrentRule(context.phase5Plan, context.phase5StartDate);
      if (phase5Rule?.type === 'phase1') {
        message = 'Phase 5 (Phase 1 day) — no starch! Stick to protein, veggies & fat! 💪';
      } else if (phase5Rule?.type === 'phase2') {
        message = 'Phase 5 (Phase 2 day) — starch at breakfast/lunch only! 📅';
      } else if (phase5Rule?.type === 'phase4') {
        message = 'Phase 5 (Phase 4 day) — starch every meal! 🎉';
      } else {
        message = 'Phase 5 — no starch today (plan data unavailable)! 💪';
      }
    } else {
      message = 'Phase 5 — no starch today (plan data unavailable)! 💪';
    }
  } else if (currentPhase === 6) {
    message = 'Higher carbs today — fuel up! 💪🔥';
  }

  return {
    meal: `${portions.protein} ${proteinChoice.toLowerCase()}`,
    veggies: `${portions.fibrousVegetables} ${veggiesChoice.toLowerCase()}`,
    fat: fatDisplay,
    starch: starchDisplay,
    message,
  };
}

export function formatMealSuggestion(suggestion: MealSuggestion): string {
  let response = `${suggestion.meal}\n${suggestion.veggies}\n${suggestion.fat}`;
  if (suggestion.starch) {
    response += `\n${suggestion.starch}`;
  }
  response += `\n\n${suggestion.message}`;
  return response;
}

// ============================================
// PHASE 5 SUPPORT — shared with ai-coach.ts
// ============================================

export interface Phase5Day {
  day: number;
  type: 'phase1' | 'phase2' | 'phase4';
  label: string;
}

export function getPhase5DayNumber(phase5StartDate: string): number {
  if (!phase5StartDate) return 1;
  const [y, m, d] = phase5StartDate.split('-').map(Number);
  // Plan date is a calendar date in the user's timezone (America/Chicago).
  // Parse it as local time (same calendar date, midnight).
  // Then compute days elapsed against current local time.
  const start = new Date(y, m - 1, d, 0, 0, 0);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const result = Math.min(14, Math.max(1, diffDays + 1));
  console.log('[PHASE5-DEBUG] phase5StartDate:', phase5StartDate, '| startLocal:', start.toISOString(), '| nowLocal:', now.toISOString(), '| diffDays:', diffDays, '| currentDay:', result);
  return result;
}

export function getPhase5CurrentRule(phase5Plan: Phase5Day[], phase5StartDate: string): Phase5Day | null {
  if (!Array.isArray(phase5Plan) || phase5Plan.length === 0) return null;
  const currentDay = getPhase5DayNumber(phase5StartDate);
  return phase5Plan.find(d => d.day === currentDay) || null;
}

// Map type string to numeric phase for sub-phase logic
function typeToPhase(type: 'phase1' | 'phase2' | 'phase4'): 1 | 2 | 4 {
  if (type === 'phase1') return 1;
  if (type === 'phase2') return 2;
  return 4;
}

// ============================================
// PHASE GUIDANCE — for app home tab
// ============================================

interface PhaseGuidance {
  advice: string;
  canEat: string[];
  cannotEat: string[];
  water: string;
  exampleMeal: string;
  supplements?: string[];
}

export function getPhaseGuidance(
  phase: number,
  gender: 'male' | 'female',
  phase5Plan?: Phase5Day[],
  phase5StartDate?: string,
  allergies: string[] = []
): PhaseGuidance {
  const p = getPortions(gender, phase);
  const isMale = gender === 'male';
  const proteinOz = isMale ? '6oz' : '4oz';
  const vegPortion = isMale ? '2 cups' : '1-2 cups';
  const fatPortion = p.fat;
  const starchPortion = p.starch;

  // Build food lists from actual food lists (filtered by allergies)
  const filtered = getFilteredFoodLists(allergies);
  const proteinList = filtered.leanProteins.join(', ');
  const veggieList = filtered.fibrousVegetables.join(', ');
  const starchList = filtered.starchyCarbohydrates.join(', ');
  const fatList = filtered.healthyFats.join(', ');

  switch (phase) {
    case 1:
      return {
        advice: 'No starch — protein, fibrous vegetables, and healthy fats only',
        canEat: [
          `LEAN PROTEINS ${proteinOz}: ${proteinList}`,
          `FIBROUS VEGETABLES ${vegPortion}: ${veggieList}`,
          `HEALTHY FATS ${fatPortion}: ${fatList}`,
        ],
        cannotEat: [
          'NO starch — no bread, rice, pasta, potato, beans, corn, oatmeal, cereal',
          'NO dairy',
          'NO sugar',
          'No processed foods (no cans or boxes, fresh or frozen only)',
        ],
        water: p.water,
        exampleMeal: `${proteinOz} grilled chicken breast, ${vegPortion} broccoli, ${fatPortion} olive oil, water`,
      };
    case 2:
      return {
        advice: 'Add starch Wed/Sat/Sun to first 2 meals',
        canEat: [
          `LEAN PROTEINS ${proteinOz}: ${proteinList}`,
          `FIBROUS VEGETABLES ${vegPortion}: ${veggieList}`,
          `HEALTHY FATS ${fatPortion}: ${fatList}`,
          `STARCHY CARBOHYDRATES ${starchPortion} (Wed/Sat/Sun only): ${starchList}`,
        ],
        cannotEat: [
          'NO starch on Mon, Tue, Thu, Fri',
          'NO starch in dinner or snacks',
          'NO dairy',
          'NO sugar',
          'No processed foods (no cans or boxes, fresh or frozen only)',
        ],
        water: p.water,
        exampleMeal: `Example (Wed/Sat/Sun breakfast): ${isMale ? '3' : '2'} eggs scrambled, ${starchPortion} oatmeal, 1 cup spinach, no additional fat, water`,
      };
    case 4:
      return {
        advice: 'Maintenance — add starch to every meal',
        canEat: [
          `LEAN PROTEINS ${proteinOz}: ${proteinList}`,
          `FIBROUS VEGETABLES ${vegPortion}: ${veggieList}`,
          `HEALTHY FATS ${fatPortion}: ${fatList}`,
          `STARCHY CARBOHYDRATES ${starchPortion}: ${starchList}`,
        ],
        cannotEat: [
          'No processed foods',
          'No cans or boxes (fresh or frozen only)',
        ],
        water: p.water,
        exampleMeal: `${proteinOz} grilled fish, ${starchPortion} rice, ${vegPortion} broccoli, ${fatPortion} olive oil, water`,
      };
    case 5: {
      // When phase5Plan and phase5StartDate are provided, compute today's specific rule
      if (phase5Plan && phase5Plan.length > 0 && phase5StartDate) {
        const currentRule = getPhase5CurrentRule(phase5Plan, phase5StartDate);
        const dayNum = getPhase5DayNumber(phase5StartDate);
        if (currentRule) {
          // Delegate to the sub-phase's guidance (1, 2, or 4) with Phase 5 day context
          const subPhaseGuidance = getPhaseGuidance(typeToPhase(currentRule.type), gender, undefined, undefined, allergies);
          return {
            ...subPhaseGuidance,
            advice: `Day ${dayNum} of 14 — ${currentRule.label}`,
          };
        }
      }
      // Fallback when no plan data available
      return {
        advice: 'Aggressive fat loss — 14-day rotating plan with 3-day blocks',
        canEat: [
          `LEAN PROTEINS ${proteinOz}: ${proteinList}`,
          `FIBROUS VEGETABLES ${vegPortion}: ${veggieList}`,
          `HEALTHY FATS ${fatPortion}: ${fatList}`,
          'Starch varies by day: check your plan for today',
        ],
        cannotEat: [
          'NO starch during strict blocks',
          'NO dairy',
          'NO sugar',
          'No processed foods',
          'No cans or boxes (fresh or frozen only)',
        ],
        water: isMale ? '128 oz daily (32 oz per meal)' : '80 oz daily (20 oz per meal)',
        exampleMeal: `${proteinOz} grilled chicken breast, ${vegPortion} mixed greens, ${fatPortion} olive oil, water`,
      };
    }
    case 6:
      return {
        advice: 'Muscle gain — higher carbs and fats to fuel growth',
        canEat: [
          `LEAN PROTEINS ${proteinOz}: ${proteinList}`,
          `FIBROUS VEGETABLES ${vegPortion}: ${veggieList}`,
          `HEALTHY FATS ${fatPortion}: ${fatList}`,
          `STARCHY CARBOHYDRATES ${starchPortion}: ${starchList}`,
        ],
        cannotEat: [
          'No processed foods',
          'No cans or boxes (fresh or frozen only)',
        ],
        water: p.water,
        supplements: [
          `Whey protein powder: ${isMale ? '40g' : '20g'} — 1st thing AM & last thing PM (NOT with meals)`,
          'Creatine: Daily (follow container directions)',
          'Whey protein drink (Premier Protein Drink) — No more than 1 per day',
          'Vitamin (Centrum with dinner)',
        ],
        exampleMeal: `${proteinOz} grilled chicken, ${starchPortion} rice, ${vegPortion} broccoli, ${fatPortion} olive oil, water`,
      };
    default:
      return {
        advice: 'Keep following your plan',
        canEat: [],
        cannotEat: [],
        water: p.water,
        exampleMeal: '',
      };
  }
}

// ============================================
// PROGRAM → PHASE FLOW
// ============================================

export const PROGRAM_PHASES: Record<string, number[]> = {
  event_ready: [1, 2, 4],
  get_shredded: [1, 5, 4],
  general_health: [4],
  muscle_gain: [6, 4],
};

// ============================================
// SNACK RULES
// ============================================

// Snacks follow the SAME phase rules as meals
// The only difference: snacks do NOT require all food groups
// (no "missing protein/veg/fat" warnings)
// But water reminder should always be included

// Disallowed food categories per phase (same rules as meals)
const PHASE_DISALLOWED: Record<number, { starch: boolean; dairy: boolean; sugar: boolean; processed: boolean; alcohol: boolean }> = {
  1: { starch: true, dairy: true, sugar: true, processed: true, alcohol: true },
  2: { starch: true, dairy: true, sugar: true, processed: true, alcohol: true },
  4: { starch: false, dairy: false, sugar: false, processed: true, alcohol: true },
  5: { starch: true, dairy: true, sugar: true, processed: true, alcohol: true },
  6: { starch: false, dairy: false, sugar: false, processed: true, alcohol: true },
};

// Keywords to detect disallowed foods
const STARCH_KEYWORDS = ['bread', 'rice', 'pasta', 'potato', 'beans', 'corn', 'oatmeal', 'cereal', 'banana', 'apple', 'orange', 'mango', 'pineapple', 'grape', 'peach', 'plum', 'cherry'];
const DAIRY_KEYWORDS = ['milk', 'cheese', 'ice cream'];
const SUGAR_KEYWORDS = ['candy', 'soda', 'sugar', 'honey', 'syrup', 'chocolate', 'cookie', 'cake', 'pie', 'donut', 'pastry'];
const PROCESSED_KEYWORDS = ['chips', 'fries', 'fried', 'nuggets', 'tenders', 'tortilla', 'tortillas', 'bread', 'pasta', 'cereal', 'crackers', 'bagel', 'croissant', 'muffin', 'pancake', 'waffle', 'french toast', 'sandwich', 'sandwiches', 'bun', 'buns', 'roll', 'rolls', 'wrap', 'wraps', 'bagels', 'toast', 'sub', 'subs', 'hoagie', 'hoagies', 'hero', 'baguette', 'flatbread', 'naan', 'pita'];
const ALCOHOL_KEYWORDS = ['beer', 'wine', 'vodka', 'whiskey', 'tequila', 'rum', 'cocktail', 'alcohol'];

// Helper: check if a food appears on any approved list
function isOnApprovedList(food: string): boolean {
  const lower = food.toLowerCase();
  // Check lean proteins (but not whey/bacon)
  const leanCheck = LEAN_PROTEINS.filter(p => !p.includes('Whey') && !p.includes('Bacon'));
  if (leanCheck.some(p => lower.includes(p.toLowerCase()))) return true;
  // Check starch list
  if (STARCHY_CARBOHYDRATES.some(p => lower.includes(p.toLowerCase()))) return true;
  // Check vegetable list
  if (FIBROUS_VEGETABLES.some(p => lower.includes(p.toLowerCase()))) return true;
  // Check healthy fats
  if (HEALTHY_FATS.some(p => lower.includes(p.toLowerCase()))) return true;
  return false;
}

export function isSnackAllowed(food: string, phase: number): { allowed: boolean; reason?: string } {
  const lowerFood = food.toLowerCase();
  const rules = PHASE_DISALLOWED[phase];
  if (!rules) return { allowed: true };

  // NEVER ban a food that appears on the approved list
  if (isOnApprovedList(food)) return { allowed: true };

  // Phase 2: snacks follow the same starch rules as meals
  // Only block starch on non-starch days OR after 8pm Chicago time
  if (phase === 2 && rules.starch && STARCH_KEYWORDS.some(k => lowerFood.includes(k))) {
    const isStarchDay = isPhase2AllowedDay();
    if (!isStarchDay) {
      return { allowed: false, reason: `No starch in Phase ${phase}` };
    }
    // It's a starch day — check if it's a daytime snack (not after 8pm Chicago)
    const chicagoTime = new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' });
    const hour = new Date(chicagoTime).getHours();
    if (hour >= 20) {
      return { allowed: false, reason: `No starch in Phase ${phase} after 8pm` };
    }
    // Daytime starch day snack — allowed
    return { allowed: true };
  } else if (rules.starch && STARCH_KEYWORDS.some(k => lowerFood.includes(k))) {
    return { allowed: false, reason: `No starch in Phase ${phase}` };
  }
  if (rules.dairy && DAIRY_KEYWORDS.some(k => lowerFood.includes(k))) {
    return { allowed: false, reason: 'No dairy!' };
  }
  if (rules.sugar && SUGAR_KEYWORDS.some(k => lowerFood.includes(k))) {
    return { allowed: false, reason: 'No sugar!' };
  }
  if (rules.processed && PROCESSED_KEYWORDS.some(k => lowerFood.includes(k))) {
    return { allowed: false, reason: 'No processed foods!' };
  }
  if (rules.alcohol && ALCOHOL_KEYWORDS.some(k => lowerFood.includes(k))) {
    return { allowed: false, reason: 'No alcohol!' };
  }

  return { allowed: true };
}

// ============================================
// WATER REMINDER
// ============================================

export function getWaterReminder(gender: 'male' | 'female'): string {
  return gender === 'male' 
    ? "Don't forget your water — 128 oz daily (32 oz per meal)"
    : "Don't forget your water — 80 oz daily (20 oz per meal)";
}

// ============================================
// PROGRAM FLOWS
// ============================================

export const PROGRAM_FLOWS = {
  event_ready: {
    name: "Event Ready",
    phases: [1, 2, 4],
    description: "Short-term fat loss for events. Weddings, reunions, beach trips.",
    flow: "Phase 1 (14d MAX) → Phase 2 (7d FIXED) → Phase 1 loop OR Phase 4 (goal)",
    transitions: {
      1: { next: 2, condition: "14 days completed OR goal attained" },
      2: { next: 4, condition: "7 days completed AND goal attained" },
      "2_to_1": { next: 1, condition: "7 days completed AND goal not attained" },
      4: { next: 1, condition: "weight > goal + 4 lbs" }
    }
  },
  
  get_shredded: {
    name: "Get Shredded",
    phases: [1, 4, 5],
    description: "Intense fat loss. Go from burning fat to peak definition.",
    flow: "Phase 1 (14d MAX) → Phase 5 (14d FIXED) → Phase 1 loop OR Phase 4 (goal)",
    transitions: {
      1: { next: 5, condition: "14 days completed" },
      5: { next: 4, condition: "14 days completed AND goal attained" },
      "5_to_1": { next: 1, condition: "14 days completed AND goal not attained" },
      4: { next: 1, condition: "weight > goal + 4 lbs" }
    }
  },
  
  general_health: {
    name: "General Health",
    phases: [4],
    description: "Maintenance-focused. Long-term healthy habits.",
    flow: "Phase 4 (steady)",
    transitions: {
      4: { next: 4, condition: "stays in Phase 4 - no weight-based transitions" }
    }
  },
  
  muscle_gain: {
    name: "Muscle Gain",
    phases: [4, 6],
    description: "Build lean muscle. Strategic portion increases.",
    flow: "Phase 6 → Phase 4 (goal attained) → Phase 6 (weight < goal - 4)",
    transitions: {
      6: { next: 4, condition: "goal attained" },
      4: { next: 6, condition: "weight < goal - 4 lbs" }
    }
  }
} as const;

// Phase Day Limits
export const PHASE_DAY_LIMITS = {
  1: { event_ready: 14, get_shredded: 14, general_health: 7 },
  2: { event_ready: 7 },
  4: { all: null }, // maintenance - no limit
  5: { get_shredded: 14 },
  6: { muscle_gain: null } // until goal attained
} as const;

// Helper function to get phase day limit
export function getPhaseDayLimit(program: keyof typeof PROGRAM_FLOWS, phase: number): number | null {
  const limits = PHASE_DAY_LIMITS[phase as keyof typeof PHASE_DAY_LIMITS];
  if (!limits) return null;
  if ('all' in limits && limits.all === null) return null;
  if (program in limits) return limits[program as keyof typeof limits];
  return null;
}

// Helper function to get program info
export function getProgramInfo(program: keyof typeof PROGRAM_FLOWS) {
  return PROGRAM_FLOWS[program] || null;
}
