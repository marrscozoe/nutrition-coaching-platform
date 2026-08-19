// ============================================
// ALL FOOD CATEGORIES (same for all phases)
// ============================================

export const LEAN_PROTEINS = [
  'Chicken breast',
  'White fish', 'Tuna', 'Salmon', 'Redfish',
  'Whole eggs', 'Egg whites',
  'Lean beef', 'Lean pork', 'Turkey breast', 'Shrimp',
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
  'Berries', 'Cantaloupe', 'Black Eyed Peas', 'Grapefruit',
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
  'Artichoke', 'Brussels sprouts', 'Eggplant',
  'Anaheim peppers', 'Poblano peppers', 'Jalapeño peppers', 'Serrano peppers',
  'Celery root', 'Fennel', 'Leeks', 'Water chestnuts', 'Bean sprouts', 'Alfalfa sprouts',
];
// Fresh or frozen, NO CANS

export const HEALTHY_FATS = [
  'Avocado (1/2 male, 1/4 female)',
  'Olive oil',
  'Almonds', 'Walnuts', 'Mixed nuts',
  'Kerrygold gold butter',
  'Safflower oil', 'Coconut oil',
  'MCT oil (in coffee)',
];

export const SUPPLEMENTS = [
  'Whey protein',
  'Creatine',
  'Protein drink',
  'Meal replacement',
  'Vitamin',
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
        fat: '3 tablespoons',
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
  // Phase 5: NO starch (same as Phase 1 for starch rules)
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
  const day = new Date().getDay();
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
  context: { gender: 'male' | 'female'; currentPhase: number },
  mealType: 'breakfast' | 'lunch' | 'dinner' = 'lunch'
): MealSuggestion {
  const { gender, currentPhase } = context;
  const isMale = gender === 'male';
  const portions = getPortions(gender, currentPhase);

  const mainProteins = LEAN_PROTEINS.filter(
    p => !p.includes('Whey') && !p.includes('Bacon') && !p.includes('Protein powder')
  );
  const proteinChoice = pickRandom(mainProteins, 1)[0];
  const veggiesChoice = pickRandom(FIBROUS_VEGETABLES, 2).join(' & ');
  const fatOptions = HEALTHY_FATS.filter(f => !f.includes('MCT'));
  const fatChoice = pickRandom(fatOptions, 1)[0];
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
  const fatDisplay = fatChoice.includes('Avocado') ? getAvocadoDisplay() : `${portions.fat} ${fatChoice}`;

  let starchDisplay: string | undefined;
  let starchAllowed = false;

  if (currentPhase === 1) {
    starchAllowed = false;
  } else if (currentPhase === 2) {
    const allowedDay = isPhase2AllowedDay();
    const isFirstTwoMeals = mealType === 'breakfast' || mealType === 'lunch';
    starchAllowed = allowedDay && isFirstTwoMeals;
  } else if (currentPhase >= 4) {
    starchAllowed = true;
  }

  if (starchAllowed) {
    const starchChoice = pickRandom(STARCHY_CARBOHYDRATES, 1)[0];
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
    message = "Every meal gets starch — you're in maintenance mode! 🎉";
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

function getPhase5DayNumber(phase5StartDate: string): number {
  if (!phase5StartDate) return 1;
  const start = new Date(phase5StartDate + 'T12:00:00');
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return Math.min(14, Math.max(1, diffDays + 1));
}

function getPhase5CurrentRule(phase5Plan: Phase5Day[], phase5StartDate: string): Phase5Day | null {
  if (!phase5Plan || phase5Plan.length === 0) return null;
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
  phase5StartDate?: string
): PhaseGuidance {
  const p = getPortions(gender, phase);
  const isMale = gender === 'male';
  const proteinOz = isMale ? '6oz' : '4oz';
  const vegPortion = isMale ? '2 cups' : '1-2 cups';
  const fatPortion = p.fat;
  const starchPortion = p.starch;

  // Build food lists from actual food lists
  const proteinList = LEAN_PROTEINS.slice(0, 10).join(', ');
  const veggieList = FIBROUS_VEGETABLES.slice(0, 12).join(', ');
  const starchList = STARCHY_CARBOHYDRATES.slice(0, 10).join(', ');
  const fatList = HEALTHY_FATS.slice(0, 6).join(', ');

  switch (phase) {
    case 1:
      return {
        advice: 'No starch — protein, fibrous vegetables, and healthy fats only',
        canEat: [
          `LEAN PROTEINS: ${proteinList}`,
          `FIBROUS VEGETABLES: ${veggieList}`,
          `HEALTHY FATS: ${fatList}`,
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
          `LEAN PROTEINS: ${proteinList}`,
          `FIBROUS VEGETABLES: ${veggieList}`,
          `HEALTHY FATS: ${fatList}`,
          `STARCHY CARBOHYDRATES (Wed/Sat/Sun only): ${starchList}`,
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
          `LEAN PROTEINS: ${proteinList}`,
          `FIBROUS VEGETABLES: ${veggieList}`,
          `HEALTHY FATS: ${fatList}`,
          `STARCHY CARBOHYDRATES: ${starchList}`,
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
          const subPhaseGuidance = getPhaseGuidance(typeToPhase(currentRule.type), gender);
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
          `LEAN PROTEINS: ${proteinList}`,
          `FIBROUS VEGETABLES: ${veggieList}`,
          `HEALTHY FATS: ${fatList}`,
          'Starch varies by 3-day block: check your plan for today',
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
          `LEAN PROTEINS: ${proteinList}`,
          `FIBROUS VEGETABLES: ${veggieList}`,
          `HEALTHY FATS: ${fatList}`,
          `STARCHY CARBOHYDRATES: ${starchList}`,
          `Whey protein: ${isMale ? '40g' : '20g'} 1st thing AM & last thing PM (NOT with meals)`,
          `Creatine: Daily`,
        ],
        cannotEat: [
          'No processed foods',
          'No cans or boxes (fresh or frozen only)',
        ],
        water: p.water,
        supplements: [
          `Whey protein: ${isMale ? '40g' : '20g'} 1st thing AM & last thing PM`,
          'Creatine: Daily',
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
const STARCH_KEYWORDS = ['bread', 'rice', 'pasta', 'potato', 'beans', 'corn', 'oatmeal', 'cereal', 'fruit', 'banana', 'apple', 'orange', 'mango', 'pineapple', 'grape', 'peach', 'plum', 'cherry', 'melon', 'watermelon', 'berries', 'cantaloupe', 'grapefruit', 'black eyed peas'];
const DAIRY_KEYWORDS = ['milk', 'cheese', 'yogurt', 'ice cream', 'cream'];
const SUGAR_KEYWORDS = ['candy', 'soda', 'sugar', 'honey', 'syrup', 'chocolate', 'cookie', 'cake', 'pie', 'donut', 'pastry'];
const PROCESSED_KEYWORDS = ['chips', 'fries', 'fried', 'nuggets', 'tenders'];
const ALCOHOL_KEYWORDS = ['beer', 'wine', 'vodka', 'whiskey', 'tequila', 'rum', 'cocktail', 'alcohol'];

export function isSnackAllowed(food: string, phase: number): { allowed: boolean; reason?: string } {
  const lowerFood = food.toLowerCase();
  const rules = PHASE_DISALLOWED[phase];
  if (!rules) return { allowed: true };

  if (rules.starch && STARCH_KEYWORDS.some(k => lowerFood.includes(k))) {
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
