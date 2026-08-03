// Pluggable AI Provider Architecture
// Supports any AI provider: OpenAI, Anthropic, Gemini, Ollama, etc.

export interface AIProvider {
  name: string;
  analyzeImage(imageBase64: string, prompt: string): Promise<AIResponse>;
  chat(messages: AIMessage[], prompt: string): Promise<AIResponse>;
}

export interface AIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AIResponse {
  text: string;
  error?: string;
  provider?: string;  // Which provider processed the request
  retryable?: boolean; // If true, fallback to next provider
}

// Provider implementations
import { chatWithOpenAI, analyzeImageWithOpenAI } from './ai-providers/openai';
import { chatWithOllama, analyzeImageWithOllama } from './ai-providers/ollama';
import { chatWithMinimax, analyzeImageWithMinimax } from './ai-providers/minimax';
import { chatWithGemini, analyzeImageWithGemini } from './ai-providers/gemini';

// Provider registry - add new providers here
const providers: Record<string, AIProvider> = {
  openai: {
    name: 'OpenAI GPT-4o',
    analyzeImage: analyzeImageWithOpenAI,
    chat: chatWithOpenAI,
  },
  ollama: {
    name: 'Ollama (Local)',
    analyzeImage: analyzeImageWithOllama,
    chat: chatWithOllama,
  },
  minimax: {
    name: 'MiniMax',
    analyzeImage: analyzeImageWithMinimax,
    chat: chatWithMinimax,
  },
  gemini: {
    name: 'Google Gemini Vision',
    analyzeImage: analyzeImageWithGemini,
    chat: chatWithGemini,
  },
};

// Check if a provider has its API key configured
function checkProviderHasKey(provider: string): boolean {
  switch (provider) {
    case 'gemini':
      return !!process.env.GEMINI_API_KEY;
    case 'openai':
      return !!process.env.OPENAI_API_KEY;
    case 'minimax':
      return !!process.env.MINIMAX_API_KEY;
    case 'ollama':
      // Ollama is local - DISABLED by Allen
      return false;
    default:
      return false;
  }
}

// Fallback chain order - tried in sequence until one succeeds
const FALLBACK_CHAIN = ['gemini', 'openai', 'minimax'];

// Get configured provider or fallback chain for a given env var
function getProviderChainFromEnv(envKey: string): string[] {
  const configured = process.env[envKey];
  
  if (configured) {
    // Explicit provider specified - just use that one
    return [configured];
  }
  
  // Use fallback chain - check which providers have API keys configured
  const chain: string[] = [];
  
  for (const provider of FALLBACK_CHAIN) {
    const hasKey = checkProviderHasKey(provider);
    if (hasKey) {
      chain.push(provider);
    }
  }
  
  return chain.length > 0 ? chain : ['ollama']; // Default to ollama as last resort
}

/**
 * Get provider chain for PHOTO analysis
 * Uses PHOTO_AI_PROVIDER env var (defaults to gemini)
 */
export function getPhotoProviderChain(): string[] {
  return getProviderChainFromEnv('PHOTO_AI_PROVIDER');
}

/**
 * Get provider chain for CHAT analysis
 * Uses CHAT_AI_PROVIDER env var (defaults to minimax)
 */
export function getChatProviderChain(): string[] {
  return getProviderChainFromEnv('CHAT_AI_PROVIDER');
}

export function getAIProvider(name?: string): AIProvider {
  if (name && providers[name]) {
    return providers[name];
  }
  
  // Try first available provider in fallback chain
  const chain = getPhotoProviderChain();
  const primaryProvider = providers[chain[0]];
  return primaryProvider || providers.ollama;
}

/**
 * Analyze image using PHOTO_AI_PROVIDER (or fallback chain)
 */
export async function analyzeImageWithPhotoAI(
  imageBase64: string,
  prompt: string,
  preferredProvider?: string
): Promise<AIResponse> {
  const chain = getPhotoProviderChain();
  
  if (preferredProvider && chain.includes(preferredProvider)) {
    const idx = chain.indexOf(preferredProvider);
    chain.splice(idx, 1);
    chain.unshift(preferredProvider);
  }
  
  const errors: string[] = [];
  
  for (const providerName of chain) {
    const provider = providers[providerName];
    if (!provider) continue;
    
    try {
      const result = await provider.analyzeImage(imageBase64, prompt);
      
      if (result.error && (result.retryable || result.error.includes('429') || result.error.includes('rate_limit') || result.error.includes('quota'))) {
        console.warn(`Photo AI ${providerName} failed with retryable error: ${result.error}`);
        errors.push(`${providerName}: ${result.error}`);
        continue;
      }
      
      if (result.error) {
        return { ...result, provider: providerName };
      }
      
      return { ...result, provider: providerName };
    } catch (err: any) {
      console.error(`Photo AI ${providerName} threw error:`, err);
      errors.push(`${providerName}: ${err.message || err}`);
      continue;
    }
  }
  
  return {
    text: '',
    error: `All photo AI providers failed. Errors: ${errors.join('; ')}`,
    provider: 'none',
  };
}

/**
 * Chat using CHAT_AI_PROVIDER (or fallback chain)
 */
export async function chatWithChatAI(
  messages: AIMessage[],
  prompt: string,
  preferredProvider?: string
): Promise<AIResponse> {
  const chain = getChatProviderChain();
  
  if (preferredProvider && chain.includes(preferredProvider)) {
    const idx = chain.indexOf(preferredProvider);
    chain.splice(idx, 1);
    chain.unshift(preferredProvider);
  }
  
  const errors: string[] = [];
  
  for (const providerName of chain) {
    const provider = providers[providerName];
    if (!provider) continue;
    
    try {
      const result = await provider.chat(messages, prompt);
      
      if (result.error) {
        errors.push(`${providerName}: ${result.error}`);
        continue;
      }
      
      return { ...result, provider: providerName };
    } catch (err: any) {
      errors.push(`${providerName}: ${err.message || err}`);
      continue;
    }
  }
  
  return {
    text: '',
    error: `All chat AI providers failed. Errors: ${errors.join('; ')}`,
    provider: 'none',
  };
}

/**
 * Legacy fallback wrapper (still works with PHOTO_AI_PROVIDER)
 */
export async function analyzeImageWithFallback(
  imageBase64: string,
  prompt: string,
  preferredProvider?: string
): Promise<AIResponse> {
  return analyzeImageWithPhotoAI(imageBase64, prompt, preferredProvider);
}

/**
 * Legacy fallback wrapper (uses CHAT_AI_PROVIDER now)
 */
export async function chatWithFallback(
  messages: AIMessage[],
  prompt: string,
  preferredProvider?: string
): Promise<AIResponse> {
  return chatWithChatAI(messages, prompt, preferredProvider);
}

// Coach prompts and response logic
export interface CoachContext {
  clientName: string;
  gender: 'male' | 'female';
  currentPhase: number;
  goalWeight: number;
  currentWeight: number;
  startingWeight: number;
  programType: string;
  eventDate?: string;
  weekNumber: number;
  trainerNotes?: string;
  recentMessedUp?: number;
  mealDate?: string; // YYYY-MM-DD format for day-of-week checking in Phase 2
  todayWaterIntake?: number; // oz of water consumed today
  todayCoffeeIntake?: number; // oz of coffee consumed today (adds to water requirement)
  mealsLoggedToday?: number; // number of meals logged today to calculate remaining
}

export const PORTION_SIZES = {
  male: {
    protein: '6 ounces',
    fibrousVegetables: '2 cups',
    fat: '2 tablespoons',
    avocado: '1/2',
    starch: '2 cups',
  },
  female: {
    protein: '4 ounces',
    fibrousVegetables: '1-2 cups',
    fat: '1 tablespoon',
    avocado: '1/4',
    starch: '1 cup',
  },
};

// Allen's approved natural starchy carbohydrates (fresh or frozen, NO CANS)
export const STARCHY_CARBOHYDRATES = [
  'Red potatoes',
  'New potatoes',
  'Sweet potatoes',
  'Brown rice',
  'Oatmeal',
  'Barley',
  'Peas',
  'Corn',
  'Beans',
  'Legumes',
  'Berries',
  'Cantaloupe',
  'Black Eyed Peas',
  'Grapefruit',
];

// Allen's approved lean proteins (fresh or frozen, NO CANS)
export const LEAN_PROTEINS = [
  'Chicken breast',
  'White fish',
  'Tuna',
  'Salmon',
  'Redfish',
  'Whole eggs',
  'Egg whites',
  'Lean beef',
  'Lean pork',
  'Turkey breast',
  'Shrimp',
  'Plain non-fat Greek yogurt',
];

// No cheese or dairy while dieting

// Allen's approved healthy fats
export const HEALTHY_FATS = [
  'Avocado (1/2 male, 1/4 female)',
  'Olive oil',
  'Almonds',
  'Walnuts',
  'Mixed nuts',
  'Kerrygold gold butter',
  'Safflower oil',
  'Coconut oil',
  'MCT oil (in coffee)',
];

// Allen's approved fibrous vegetables (fresh or frozen, NO CANS)
export const FIBROUS_VEGETABLES = [
  'Broccoli',
  'Spinach',
  'Asparagus',
  'Zucchini',
  'Green peppers',
  'Green lettuce (sparingly)',
  'Mushrooms',
  'Green beans',
  'Cauliflower',
  'Tomatoes',
  'Cucumbers',
  'Celery',
  'Cabbage',
  'Onions',
];

export function getCoachPrompt(context: CoachContext, message: string): string {
  const portions = PORTION_SIZES[context.gender];
  const weeksUntilEvent = context.eventDate 
    ? Math.ceil((new Date(context.eventDate).getTime() - Date.now()) / (7 * 24 * 60 * 60 * 1000))
    : null;

  const lowerMessage = message.toLowerCase();
  const asksAboutPlan = lowerMessage.includes('what can i eat') || lowerMessage.includes('my plan') || lowerMessage.includes('show me') || lowerMessage.includes('what am i') || lowerMessage.includes('meal example') || lowerMessage.includes('example meal') || lowerMessage.includes('phase') || lowerMessage.includes('portion') || lowerMessage.includes('categories') || lowerMessage.includes('what to eat') || lowerMessage.includes('swap') || lowerMessage.includes('exchange');

  if (asksAboutPlan) {
    const phaseDescription = context.currentPhase === 1 ? 'NO STARCH - lean protein, veggies, healthy fats only' :
                            context.currentPhase === 2 ? 'Add starch (Wed, Sat, Sun) to first 2 meals' :
                            context.currentPhase === 3 ? 'Check with coach for next steps' :
                            'Maintenance mode - add starch to every meal';
    
    const proteinExamples = context.gender === 'male' ? '6oz chicken/fish/egg, 4oz beef/pork' : '4oz chicken/fish/egg, 3oz beef/pork';
    const veggieExamples = 'broccoli, spinach, asparagus, zucchini, peppers, salad';
    const fatExamples = 'olive oil, avocado, almonds, cheese';
    const mealExample = context.gender === 'male' 
      ? '6oz grilled salmon, 2 cups broccoli with olive oil, 1/2 avocado' 
      : '4oz grilled chicken, 1.5 cups spinach with olive oil, few almonds';

    return `You're in PHASE ${context.currentPhase}: ${phaseDescription}

YOUR PORTIONS PER MEAL:
• Protein: ${portions.protein} (${proteinExamples})
• Veggies: ${portions.fibrousVegetables} (${veggieExamples})
• Fat: ${portions.fat} (${fatExamples})
• Water: ${context.gender === 'male' ? '128oz' : '80oz'} daily
${context.currentPhase === 1 ? '• NO STARCH in Phase 1!' : ''}

EXAMPLE MEAL:
${mealExample}

${context.eventDate ? `EVENT IN ${weeksUntilEvent} WEEKS - keep pushing! 🔥` : 'Keep crushing it! 💪'}

Ask me anything about specific foods!`;
  }

  return `You are ALLEN'S AI NUTRITION COACH. You act exactly like Allen would in a text conversation with a client.

⚠️ CRITICAL RULE — YOUR ONLY JOB IS NUTRITION COACHING ⚠️
- You ONLY talk about: food, nutrition, diet, phases, portions, weight, fitness, health
- You NEVER talk about: news, weather, politics, sports, entertainment, stories, jokes, or anything NOT related to nutrition/fitness
- If someone asks about something unrelated: "I'm a nutrition coach — I only help with food, diet, and fitness questions! What are you eating?"
- You NEVER write stories, poems, or creative content

ALLEN'S COACHING STYLE:
- Short, punchy text messages (1-3 sentences max)
- Direct: "Good" or "Bad" or "Swap that"
- Tells client exactly what to do for their NEXT meal
- Supportive when they do good, corrective when they mess up
- Says things like: "LETS GOOO!", "Nice!", "Next meal do this instead...", "Drop the starch", "Add more protein"
- Uses some emoji: 🔥 💪 🙌 (sparingly)
- NEVER lectures, NEVER long paragraphs
- NEVER starts with "In Phase 1..." or "Your portions are..."
- NEVER mention both male and female portions in the same response
- NEVER say things like "men should do X / women should do Y" — this client is ${context.gender === 'male' ? 'a man' : 'a woman'}, so only give THEIR portions

COACHING RULES:
1. If client mentions a meal/food → EVALUATE IT and give FEEDBACK
   - Good for their phase? → "Nice! Stay on track"
   - Has issues? → "Swap the rice for veggies" or "Drop the bread"
   - Missing something? → "Add more protein" or "Don't forget the fat"
2. If client asks what to eat → Give SPECIFIC NEXT MEAL examples
   - "Next meal: grilled chicken, broccoli, olive oil on the veggies"
3. If client sends photo → Analyze and give feedback
4. If client asks for motivation → Give 1-2 sentence hype ONLY
5. If client asks about phases/portions → Give the structured plan response above
6. If client asks about anything unrelated to nutrition → "I'm a nutrition coach — I only help with food and fitness!"

CLIENT CONTEXT:
- Name: ${context.clientName || 'Client'}
- Phase: ${context.currentPhase} (Phase 1 = no starch, Phase 2 = add starch Wed/Sat/Sun, Phase 3 = check with coach, Phase 4 = maintenance)
- Gender: ${context.gender} (${context.gender === 'male' ? 'MALE — use MALE portions only' : 'FEMALE — use FEMALE portions only'})
- Goal: ${context.goalWeight}lbs, Started: ${context.startingWeight}lbs, Current: ${context.currentWeight}lbs
${context.eventDate ? `- Event in ${weeksUntilEvent} weeks` : ''}

PHASE RULES (for YOUR reference only — give personalized advice for THIS client, not generic phase descriptions):
- Phase 1: ${portions.protein} protein, ${portions.fibrousVegetables} veggies, ${portions.fat} fat, NO starch, NO dairy, NO sugar, ${context.gender === 'male' ? '128' : '80'}oz water
- Phase 2: Same + starch Wed/Sat/Sun to first 2 meals
- Phase 3: Check with coach
- Phase 4: Add starch every meal, weigh Fri only

CLIENT'S MESSAGE: "${message}"

Respond as Allen would. Short. Direct. Helpful. Tell them what to do NEXT. Only reference THIS CLIENT'S portions — never mention male/female side by side.`;
}

export function getMealAnalysisPrompt(context: CoachContext, mealData: {
  mealType: string;
  foodDescription: string;
  analyzedText?: string;
  onPhase: boolean;
  messedUp?: boolean;
}): string {
  const portions = PORTION_SIZES[context.gender];
  const status = mealData.messedUp ? 'OFF PHASE' : mealData.onPhase ? 'ON PHASE' : 'NEEDS REVIEW';
  const emoji = mealData.messedUp ? '⚠️' : mealData.onPhase ? '✅' : '🤔';

  // Check for Phase 1 violations - starch, dairy, AND sugar
  const foodLower = mealData.foodDescription.toLowerCase();
  const starchKeywords = [
    // Original
    'pasta', 'bread', 'rice', 'potato', 'noodles', 'spaghetti', 'lasagna', 'tortilla', 'cereal', 'oatmeal',
    'kidney beans', 'pinto beans', 'black beans', 'corn', 'peas', 'quinoa', 'couscous',
    'bagel', 'muffin', 'croissant', 'pancake', 'waffle', 'roll',
    // Potato dishes
    'french fries', 'fry', 'hash browns', 'mashed potatoes', 'baked potato', 'potato chips',
    'sweet potato fries', 'tater tots', 'potato salad', 'home fries', 'breakfast potatoes',
    // Bread/grains
    'crackers', 'saltines', 'graham crackers', 'biscuits', 'cornbread', 'stuffing', 'croutons',
    'focaccia', 'naan', 'pita bread', 'flour tortilla', 'cornbread',
    // Pasta/rice
    'mac and cheese', 'macaroni', 'ravioli', 'gnocchi', 'fried rice', 'risotto', 'pilaf',
    'white rice', 'instant rice', 'rice noodles', 'cellophane noodles',
    // Snacks
    'pretzels', 'popcorn', 'tortilla chips', 'corn chips', 'pita chips', 'rice cakes',
    'chex', 'cheez-its', 'goldfish', 'tortilla snack bags', 'snack crackers',
    // Breakfast
    'granola', 'grits', 'hominy', 'biscuits and gravy', 'french toast', 'waffle sticks',
    // Beans
    'refried beans', 'baked beans', 'canned beans', 'hummus', 'chickpeas',
    // Desserts/sweets
    'pie crust', 'cake', 'cookies', 'brownies', 'pastries', 'donuts', 'scones', 'cobbler', 'dumplings',
    // Other
    'breadcrumbs', 'tempura', 'egg roll wrapper', 'wonton wrapper', 'flour', 'cornmeal', 'pancake mix',
  ];
  const dairyKeywords = [
    // Original
    'cream', 'milk', 'cheese', 'yogurt', 'butter', 'sour cream', 'half and half', 'creamer', 'whipped cream', 'ice cream', 'cottage cheese', 'ricotta',
    // Added
    'cream cheese', 'philadelphia', 'heavy cream', 'heavy whipping cream', 'milk chocolate',
    'butter pecan', 'cheese sauce', 'cheese dip', 'cheese ball', 'cheese spread',
    'alfredo sauce', 'queso', 'nacho cheese', 'velveeta', 'mac and cheese',
    'cheese fries', 'cheese curds', 'cream gravy', 'white sauce', 'bechamel',
  ];
  const sugarKeywords = ['sugar', 'syrup', 'honey', 'agave', 'molasses', 'cane juice', 'high fructose', 'aspartame', 'splenda', 'equal', 'sweetener', 'stevia'];

  const starchFound = context.currentPhase === 1
    ? starchKeywords.filter(s => foodLower.includes(s))
    : [];
  const dairyFound = context.currentPhase === 1
    ? dairyKeywords.filter(d => foodLower.includes(d))
    : [];
  const sugarFound = context.currentPhase === 1
    ? sugarKeywords.filter(s => foodLower.includes(s))
    : [];

  const hasStarchViolation = starchFound.length > 0 && context.currentPhase === 1;
  const hasDairyViolation = dairyFound.length > 0 && context.currentPhase === 1;
  const hasSugarViolation = sugarFound.length > 0 && context.currentPhase === 1;
  const hasViolation = hasStarchViolation || hasDairyViolation || hasSugarViolation;

  return `You are ALLEN'S AI NUTRITION COACH. A client just logged a meal. Give SHORT, PUNCHY coaching feedback (1-3 sentences).

⚠️ CRITICAL: You are a NUTRITION COACH. Your ONLY job is to give nutrition feedback.
- DO NOT write stories, poems, or any creative content
- DO NOT talk about animals, weather, news, or anything unrelated to nutrition
- If you cannot analyze the food, say "I can't identify this food — describe what you ate"

MEAL LOGGED:
- Type: ${mealData.mealType}
- Food: ${mealData.foodDescription}
${mealData.analyzedText ? `- AI Analysis: ${mealData.analyzedText}` : ''}
- Status: ${status} ${emoji}

CLIENT CONTEXT:
- Name: ${context.clientName || 'Client'}
- Phase: ${context.currentPhase}
- Gender: ${context.gender}
- Current: ${context.currentWeight}lbs → Goal: ${context.goalWeight}lbs

COACHING RULES (CRITICAL - FOLLOW THESE):
1. PHASE 1 = ZERO CARBOHYDRATES. This means NO rice, NO pasta, NO bread, NO potatoes, NO beans, NO corn, NO oats, NO cereal — and NO sugar, NO honey, NO syrup, NO sweetener of any kind. Sugar IS a simple carbohydrate. "No starch" means ZERO CARBS — the AI coach must use COMMON SENSE: if something is sweet or starchy, it's off-limits in Phase 1.
   - NO DAIRY either: cream, milk, cheese, butter, yogurt, half & half, creamer, etc.
2. If the meal has ANY Phase 1 violation: "Swap that!" and tell them exactly what to remove/swap
3. If ON PHASE (and no violations): "Nice!", "Great choice!", "Stay on track" + what to do NEXT
4. If OFF PHASE for other reasons: "Swap the [X] for [Y]" or "Drop the [X]" - give specific correction
5. If needs review: Ask a quick question or give portion reminder
6. End with what they should do for their NEXT meal
7. Never lecture, never long paragraphs
8. Use 🔥 💪 🙌 sparingly

IMPORTANT: Think about what the client ACTUALLY ate. "Coffee with cream and sugar" = cream (dairy) + sugar (carb) = DOUBLE VIOLATION. Say "Swap that!" and tell them to remove both.

${hasViolation ? `\n⚠️ VIOLATION DETECTED: This meal contains: ${[...starchFound, ...dairyFound, ...sugarFound].join(', ')}. In Phase 1, NO starch, NO dairy, NO sugar allowed! Response MUST be corrective: "Swap that! Drop the ${[...starchFound, ...dairyFound, ...sugarFound][0]}!" or similar.` : ''}

Give coaching feedback now:`;
}

export function getWeightAnalysisPrompt(context: CoachContext, weightData: {
  weight: number;
  previousWeight?: number;
  change?: number;
}): string {
  const prevWeight = weightData.previousWeight || context.startingWeight;
  const currentWeight = weightData.weight;
  // change is positive = weight LOSS (current < previous)
  // change is negative = weight GAIN (current > previous)
  // change is 0 = maintained
  const change = weightData.change !== undefined ? weightData.change : (prevWeight - currentWeight);
  const goalDiff = currentWeight - context.goalWeight;

  // Determine direction: is this a LOSS, GAIN, or MAINTAINED?
  const isLoss = change > 0.05;      // lost weight (positive change value)
  const isGain = change < -0.05;     // gained weight (negative change value)  
  const isMaintained = Math.abs(change) <= 0.05; // within 0.1 lb tolerance

  const lossLbs = isLoss ? change.toFixed(1) : null;
  const gainLbs = isGain ? Math.abs(change).toFixed(1) : null;

  return `You are ALLEN'S AI NUTRITION COACH. A client just logged their weight. Give SHORT, PUNCHY feedback (1-3 sentences).

WEIGHT LOGGED:
- New Weight: ${currentWeight} lbs
- Previous Weight: ${prevWeight} lbs
${isLoss ? `- LOST ${lossLbs} lbs this weigh-in! 🎉` : ''}
${isGain ? `- GAINED ${gainLbs} lbs this weigh-in` : ''}
${isMaintained ? `- MAINTAINED (same weight)` : ''}
- Goal: ${context.goalWeight} lbs
${goalDiff > 0 ? `- ${goalDiff.toFixed(1)} lbs to go!` : '🎯 AT GOAL!'}

CLIENT CONTEXT:
- Name: ${context.clientName || 'Client'}
- Phase: ${context.currentPhase}
- Event: ${context.eventDate ? `In ${Math.ceil((new Date(context.eventDate).getTime() - Date.now()) / (7 * 24 * 60 * 60 * 1000))} weeks` : 'None'}

COACHING STYLE:
- 1-3 sentences ONLY
${isLoss ? `- WEIGHT LOSS: Celebrate BIG! "Dropped ${lossLbs} lbs! 🔥 LETS GOOO!" or "Down ${lossLbs} lbs - you\'re crushing it! 🎉" + brief encouragement` : ''}
${isGain ? `- WEIGHT GAIN: Be supportive, not harsh. "Gained ${gainLbs} lbs - that\'s ok, keep pushing!" or "Up ${gainLbs} lbs - no worries, we\'ll get back on track! 💪" + brief tip` : ''}
${isMaintained ? `- MAINTAINED: Acknowledge it positively. "Holding steady! Consistency is key! 💪" + brief encouragement` : ''}
- End with brief motivation or next action
- Never lecture, never long paragraphs
- Use emoji sparingly: 🎉 🔥 💪

Give coaching feedback now:`;
}

export function analyzeMealPortion(
  foodDescription: string,
  context: CoachContext
): { advice: string; onPhase: boolean; corrections: string[] } {
  const portions = PORTION_SIZES[context.gender];
  const corrections: string[] = [];
  let onPhase = true;
  
  const foodLower = foodDescription.toLowerCase();
  
  // Comprehensive starch keywords list
  const starchKeywords = [
    'pasta', 'bread', 'rice', 'potato', 'noodles', 'spaghetti', 'lasagna', 
    'tortilla', 'cereal', 'oatmeal', 'kidney beans', 'pinto beans', 'black beans', 'corn', 'peas', 'quinoa', 
    'couscous', 'bagel', 'muffin', 'croissant', 'pancake', 'waffle', 
    'cracker', 'pretzel', 'chips', 'fries', 'grits', 'polenta', 'hashbrowns'
  ];
  
  // Dairy keywords (NO dairy in Phase 1)
  const dairyKeywords = [
    'cream', 'milk', 'cheese', 'yogurt', 'butter', 'sour cream', 
    'half and half', 'creamer', 'whipped cream', 'ice cream', 
    'cottage cheese', 'ricotta', 'mozzarella', 'cheddar', 'parmesan',
    'feta', 'goat cheese', 'brie', 'gouda', 'cream cheese'
  ];
  
  // Sugar keywords (NO sugar in Phase 1)
  const sugarKeywords = [
    'sugar', 'syrup', 'honey', 'agave', 'molasses', 'cane juice', 
    'high fructose', 'aspartame', 'splenda', 'equal', 'sweetener', 
    'stevia', 'truvia', 'brown sugar', 'powdered sugar', 'confectioner'
  ];
  
  // Check if food contains starch
  const starchFound = starchKeywords.find(starch => foodLower.includes(starch));
  const dairyFound = dairyKeywords.find(d => foodLower.includes(d));
  const sugarFound = sugarKeywords.find(s => foodLower.includes(s));
  
  // Phase-based rules: starch, dairy, and sugar
  if (context.currentPhase === 1) {
    // Phase 1: NO starch, NO dairy, NO sugar allowed
    if (starchFound) {
      corrections.push(`⚠️ Phase 1 - NO starch! Skip the ${starchFound} completely.`);
      onPhase = false;
    }
    if (dairyFound) {
      corrections.push(`⚠️ Phase 1 - NO dairy! Skip the ${dairyFound} completely.`);
      onPhase = false;
    }
    if (sugarFound) {
      corrections.push(`⚠️ Phase 1 - NO sugar! Skip the ${sugarFound} completely.`);
      onPhase = false;
    }
  } else if (context.currentPhase === 2) {
    // Phase 2: Starch allowed ONLY on Wed, Sat, Sun for first 2 meals
    if (starchFound && context.mealDate) {
      const mealDateObj = new Date(context.mealDate + 'T12:00:00');
      const dayOfWeek = mealDateObj.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
      const allowedDays = [0, 3, 6]; // Sun (0), Wed (3), Sat (6)
      
      if (!allowedDays.includes(dayOfWeek)) {
        corrections.push(`⚠️ Phase 2 - starch only allowed on Wed, Sat, Sun. No ${starchFound} today. Remove it or swap for extra veg.`);
        onPhase = false;
      } else {
        corrections.push(`⚠️ Phase 2 - starch allowed only in first 2 meals today. If this is meal 3 or later, skip the ${starchFound}.`);
        onPhase = false;
      }
    } else if (starchFound && !context.mealDate) {
      // If no mealDate, be conservative and warn
      corrections.push(`⚠️ Phase 2 - starch only allowed on Wed, Sat, Sun. Check if today is an allowed day before eating ${starchFound}.`);
      onPhase = false;
    }
  } else if (context.currentPhase === 3) {
    // Phase 3: EVALUATION CHECKPOINT - not a diet phase, it's a decision point
    // Are you at goal? NO = back to Phase 1, YES = Phase 4
    // Starch rules stay same as Phase 2 until decision is made
    if (starchFound) {
      corrections.push(`⚠️ Phase 3 is an EVALUATION CHECKPOINT. If you're not at goal yet, you should be back in Phase 1. Check with your coach.`);
      onPhase = false;
    }
  } else if (context.currentPhase === 4) {
    // Phase 4: Maintenance - starch allowed every meal but still portion control + natural food focus
    // If 5+ lbs over goal = back to Phase 1
    if (starchFound) {
      corrections.push(`💡 Phase 4 - Starch allowed every meal. Keep portions in check: ${portions.protein} protein, ${portions.fibrousVegetables} veg. Natural starches preferred over processed.`);
    }
  }
  
  // Check protein (avoid tofu/tempeh - processed)
  const proteinKeywords = ['chicken', 'beef', 'pork', 'fish', 'salmon', 'turkey', 'egg', 'yogurt', 'protein', 'steak', 'shrimp'];
  const hasProtein = proteinKeywords.some(p => foodLower.includes(p));
  
  // Check vegetables
  const vegKeywords = ['broccoli', 'spinach', 'salad', 'lettuce', 'pepper', 'onion', 'mushroom', 'asparagus', 'green beans', 'cauliflower', 'zucchini', 'tomato', 'cucumber', 'celery', 'cabbage'];
  const hasVeg = vegKeywords.some(v => foodLower.includes(v));
  
  // Check healthy fats
  const fatKeywords = ['olive oil', 'avocado', 'nuts', 'almonds', 'walnuts', 'cashews', 'butter', 'coconut oil', 'mayo', 'mayonnaise', 'oil', 'fat'];
  const hasFat = fatKeywords.some(f => foodLower.includes(f));
  
  // Check if the food itself IS a healthy fat source (not just contains fat as an ingredient)
  // These are standalone fat foods - don't suggest adding MORE fat if logged
  const standaloneFatKeywords = ['mixed nuts', 'almonds', 'walnuts', 'cashews', 'macadamia', 'pecans', 'peanuts', 'pistachios', 'hazelnuts', 'brazil nuts', 'avocado', 'olive oil', 'coconut oil', 'mct oil', 'kerrygold', 'gold butter'];
  const isStandaloneFatFood = standaloneFatKeywords.some(f => foodLower.includes(f));
  
  // Check for water intake
  const waterKeywords = ['water', 'h2o', 'drank', 'drinking', 'hydrate', 'hydration', 'sparkling water', 'mineral water', 'soda water', 'glass of water', 'bottle of water', 'cup of water'];
  const hasWater = waterKeywords.some(w => foodLower.includes(w));
  
  // Check for coffee intake
  const coffeeKeywords = ['coffee', 'cafe', 'espresso', 'latte', 'cappuccino', 'mocha', 'americano'];
  const hasCoffee = coffeeKeywords.some(c => foodLower.includes(c));
  
  // Calculate water tracking
  const baseWaterOz = context.gender === 'male' ? 128 : 80;
  const todayCoffee = context.todayCoffeeIntake || 0;
  const todayWater = context.todayWaterIntake || 0;
  const mealsLogged = context.mealsLoggedToday || 0;
  const totalWaterNeeded = baseWaterOz + todayCoffee;
  const remainingMeals = Math.max(1, 4 - mealsLogged); // at least 1 meal remaining
  const remainingWater = Math.max(0, totalWaterNeeded - todayWater);
  const waterPerMeal = Math.round((remainingWater / remainingMeals) * 10) / 10; // round to 1 decimal
  
  // Build water tracking message
  let waterTrackingMessage = '';
  if (hasWater) {
    // Client mentioned water - acknowledge and give remaining target
    if (waterPerMeal > 0) {
      waterTrackingMessage = `💧 Water tracked. You need ${waterPerMeal}oz water per remaining meal today.`;
    } else {
      waterTrackingMessage = `💧 Great job staying hydrated! You're on track with water today.`;
    }
  } else if (hasCoffee) {
    // Coffee counts toward fluid but still need water
    const coffeeOz = 8; // estimate for a cup of coffee
    const adjustedTotal = totalWaterNeeded + coffeeOz;
    const newRemaining = Math.max(0, adjustedTotal - todayWater);
    const newWaterPerMeal = Math.round((newRemaining / remainingMeals) * 10) / 10;
    waterTrackingMessage = `☕ Coffee counts toward fluids, but you still need water. You need ${newWaterPerMeal}oz water per remaining meal (includes coffee adjustment).`;
  } else {
    // No water mentioned - tell them how much they need
    if (todayWater > 0) {
      // Already had some water but not this meal
      const shortFall = Math.round((totalWaterNeeded - todayWater) * 10) / 10;
      waterTrackingMessage = `💧 You're ${shortFall}oz short on water today. You need ${waterPerMeal}oz water per remaining meal.`;
    } else {
      // No water intake yet today
      waterTrackingMessage = `💧 You need ${waterPerMeal}oz water per meal. Aim for ${totalWaterNeeded}oz total daily (${baseWaterOz}oz base + ${todayCoffee}oz coffee adjustment).`;
    }
  }
  
  // Check if it's Phase 2 allowed day for starch check
  let isPhase2AllowedDay = false;
  if (context.currentPhase === 2 && context.mealDate) {
    const mealDateObj = new Date(context.mealDate + 'T12:00:00');
    const dayOfWeek = mealDateObj.getDay();
    const allowedDays = [0, 3, 6]; // Sun (0), Wed (3), Sat (6)
    isPhase2AllowedDay = allowedDays.includes(dayOfWeek);
  }
  
  // Phase-specific suggestions for missing food categories
  if (context.currentPhase === 4) {
    // Phase 4: Gentle notices, client is maintaining
    if (!hasProtein) {
      corrections.push(`💡 Notice: Consider adding some lean protein to round out your meal.`);
    }
    if (!hasVeg) {
      corrections.push(`💡 Notice: Adding some fibrous vegetables would be great for your meal.`);
    }
    if (!hasFat) {
      corrections.push(`💡 Notice: Don't forget healthy fat like olive oil, avocado, or nuts. Stay hydrated with water too!`);
    }
  } else if (context.currentPhase === 1) {
    // Phase 1: Protein + Veg + Fat required. No starch.
    if (!hasProtein && !hasVeg) {
      let suggestion = `💡 Add ${portions.protein} lean protein + ${portions.fibrousVegetables} fibrous vegetables`;
      if (!hasFat) suggestion += ` + ${portions.fat} olive oil or ${portions.avocado} avocado`;
      suggestion += `. ${waterTrackingMessage}`;
      corrections.push(suggestion);
    } else if (!hasProtein) {
      corrections.push(`💡 Add ${portions.protein} lean protein + ${portions.fat} olive oil or ${portions.avocado} avocado. ${waterTrackingMessage}`);
    } else if (!hasVeg) {
      corrections.push(`💡 Add ${portions.fibrousVegetables} fibrous vegetables + ${portions.fat} olive oil or ${portions.avocado} avocado. ${waterTrackingMessage}`);
    } else if (!hasFat || isStandaloneFatFood) {
      // Don't suggest adding fat if the food IS a fat source (nuts, avocado, oil, etc.)
      if (!isStandaloneFatFood) {
        corrections.push(`💡 Add ${portions.fat} olive oil or ${portions.avocado} avocado for healthy fat. ${waterTrackingMessage}`);
      }
    }
  } else if (context.currentPhase === 2) {
    // Phase 2: Protein + Veg + Fat required. Starch only on Wed/Sat/Sun allowed day + first 2 meals
    if (isPhase2AllowedDay) {
      // Starch is allowed today
      if (!hasProtein && !hasVeg) {
        let suggestion = `💡 Add ${portions.protein} lean protein + ${portions.fibrousVegetables} veg + 1-2 cups oatmeal or natural starch`;
        if (!hasFat) suggestion += ` + ${portions.fat} olive oil or ${portions.avocado} avocado`;
        suggestion += `. ${waterTrackingMessage}`;
        corrections.push(suggestion);
      } else if (!hasProtein) {
        corrections.push(`💡 Add ${portions.protein} lean protein + 1-2 cups oatmeal or natural starch + ${portions.fat} olive oil or ${portions.avocado} avocado. ${waterTrackingMessage}`);
      } else if (!hasVeg) {
        corrections.push(`💡 Add ${portions.fibrousVegetables} fibrous vegetables + 1-2 cups oatmeal or natural starch + ${portions.fat} olive oil or ${portions.avocado} avocado. ${waterTrackingMessage}`);
      } else if (!hasFat) {
        corrections.push(`💡 Add ${portions.fat} olive oil or ${portions.avocado} avocado + 1-2 cups oatmeal or natural starch. ${waterTrackingMessage}`);
      } else if (!starchFound) {
        // Has protein, veg, fat but no starch on allowed day
        corrections.push(`💡 Add 1-2 cups oatmeal or natural starch like potato or rice. ${waterTrackingMessage}`);
      }
    } else {
      // Starch NOT allowed today (not Wed/Sat/Sun)
      if (!hasProtein && !hasVeg) {
        let suggestion = `💡 Add ${portions.protein} lean protein + ${portions.fibrousVegetables} fibrous vegetables`;
        if (!hasFat) suggestion += ` + ${portions.fat} olive oil or ${portions.avocado} avocado`;
        suggestion += `. ${waterTrackingMessage}`;
        corrections.push(suggestion);
      } else if (!hasProtein) {
        corrections.push(`💡 Add ${portions.protein} lean protein + ${portions.fat} olive oil or ${portions.avocado} avocado. ${waterTrackingMessage}`);
      } else if (!hasVeg) {
        corrections.push(`💡 Add ${portions.fibrousVegetables} fibrous vegetables + ${portions.fat} olive oil or ${portions.avocado} avocado. ${waterTrackingMessage}`);
      } else if (!hasFat) {
        corrections.push(`💡 Add ${portions.fat} olive oil or ${portions.avocado} avocado. ${waterTrackingMessage}`);
      }
    }
  } else if (context.currentPhase === 3) {
    // Phase 3: Evaluation checkpoint - same rules as Phase 2 until decision
    if (!hasProtein && !hasVeg) {
      corrections.push(`💡 Add ${portions.protein} lean protein + ${portions.fibrousVegetables} fibrous vegetables + ${portions.fat} olive oil or ${portions.avocado} avocado. ${waterTrackingMessage}`);
    } else if (!hasProtein) {
      corrections.push(`💡 Add ${portions.protein} lean protein + ${portions.fat} olive oil or ${portions.avocado} avocado. ${waterTrackingMessage}`);
    } else if (!hasVeg) {
      corrections.push(`💡 Add ${portions.fibrousVegetables} fibrous vegetables + ${portions.fat} olive oil or ${portions.avocado} avocado. ${waterTrackingMessage}`);
    } else if (!hasFat) {
      corrections.push(`💡 Add ${portions.fat} olive oil or ${portions.avocado} avocado. ${waterTrackingMessage}`);
    }
  }
  
  if (corrections.length === 0) {
    // Client is on phase with no violations - check water intake
    if (context.currentPhase === 4) {
      if (waterPerMeal > 0) {
        return {
          advice: `🎉 You're at goal and maintaining! Keep eating healthy most of the time. Natural starches preferred, stay active, weigh Fridays. ${waterTrackingMessage} You've got this! 💪`,
          onPhase: true,
          corrections: [waterTrackingMessage],
        };
      }
      return {
        advice: `🎉 You're at goal and maintaining! Keep eating healthy most of the time. Natural starches preferred, stay active, weigh Fridays. Great job staying hydrated! 💪`,
        onPhase: true,
        corrections: [],
      };
    }
    if (waterPerMeal > 0) {
      return {
        advice: `Looks good! Keep those portions in check. ${portions.protein} protein, ${portions.fibrousVegetables} fibrous vegetables, ${portions.fat} fat per meal. ${waterTrackingMessage} You've got this! 👊`,
        onPhase: true,
        corrections: [waterTrackingMessage],
      };
    }
    return {
      advice: `Looks good! Keep those portions in check. ${portions.protein} protein, ${portions.fibrousVegetables} fibrous vegetables, ${portions.fat} fat per meal. Great job staying hydrated! 👊`,
      onPhase: true,
      corrections: [],
    };
  }
  
  return {
    advice: corrections.length > 0 
      ? corrections.join('\n')
      : 'Log your foods and get back on track next meal!',
    onPhase,
    corrections,
  };
}

export function getWeightResponse(
  currentWeight: number,
  previousWeight: number,
  goalWeight: number,
  gender: 'male' | 'female'
): string {
  const change = previousWeight - currentWeight;
  const totalLost = Math.round((currentWeight - goalWeight) * 10) / 10;
  
  if (change > 0) {
    if (change >= 3) {
      return `LEEEETS GOOOO! 🎉 ${change.toFixed(1)} lbs down! That's incredible work! We're crushing this!`;
    } else if (change >= 2) {
      return `Way to go! 👊 ${change.toFixed(1)} lbs lost this week! You're doing great!`;
    } else {
      return `Good job! ${change.toFixed(1)} lbs down. Keep it up!`;
    }
  } else if (change < 0) {
    return `No worries - let's get back on track this week. Plan those foods! You've got this! 💪`;
  } else {
    return `Same weight - that's totally fine! Plan those foods and eat perfect this week. Don't let your brain prevent your body from reaching your goal!`;
  }
}

export function getPhaseAdvice(clientPhase: number): string {
  switch (clientPhase) {
    case 1:
      return 'Phase 1: No starch! Focus on lean protein, fibrous vegetables, and healthy fats.';
    case 2:
      return 'Phase 2: Add starch on Wed/Sat/Sun to first 2 meals only.';
    case 3:
      return 'Phase 3: Evaluation checkpoint - are you at goal?';
    case 4:
      return 'Phase 4: Maintenance mode - add starch to every meal, weigh Fridays only.';
    default:
      return 'Keep following your plan!';
  }
}
