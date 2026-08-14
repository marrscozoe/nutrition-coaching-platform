// Pluggable AI Provider Architecture
// Supports any AI provider: OpenAI, Anthropic, Gemini, Ollama, etc.

// Import corrections cache (server-only)
import { initializeCorrectionsCache, getCorrection, getAllCorrections, isCacheLoaded } from './food-corrections-cache';

// Import centralized nutrition data
import { getPortions, isSnackAllowed, getWaterReminder } from './nutrition-data';

// Initialize corrections cache on module load (server-only)
if (typeof process !== 'undefined' && process.env.SUPABASE_SERVICE_ROLE_KEY) {
  initializeCorrectionsCache().catch(console.error);
}

// Ensure cache is loaded before any correction lookup
async function ensureCacheLoaded(): Promise<void> {
  if (!isCacheLoaded()) {
    await initializeCorrectionsCache();
  }
}

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
  mealType?: 'breakfast' | 'lunch' | 'dinner' | 'snack'; // meal type for Phase 2 starch validation
  // Phase 4 tracking
  todayDairyServings?: number; // dairy servings logged today (men: 2 allowed, women: 1 allowed)
  todaySugarServings?: number; // sugar servings logged today (men: 2 allowed, women: 1 allowed)
  todayProcessedMeals?: number; // processed meals logged today (1 allowed)
  // Phase 5 tracking
  phase5Plan?: Phase5Day[]; // 3-day rotating plan
  phase5StartDate?: string; // YYYY-MM-DD when the current 3-day plan started
}

export interface Phase5Day {
  day: number;
  phase: 1 | 2 | 4; // Full phase rules (P1, P2, or P4)
  label: string;
}

// Phase 5: 14-day plan with 3-day blocks
// Each 3-day block randomly assigned to P1, P2, or P4 FULL rules
export function generatePhase5Plan(): Phase5Day[] {
  const phases: Array<1 | 2 | 4> = [1, 2, 4];
  const phaseLabels: Record<1 | 2 | 4, string> = {
    1: 'No starch — lean protein, veggies, healthy fats only',
    2: 'Starch allowed at breakfast & lunch only',
    4: 'Starch allowed at every meal',
  };
  
  // Generate 14-day plan with 3-day blocks
  // Days 1-3, 4-6, 7-9, 10-12 = 4 full blocks of 3 days
  // Days 13-14 = final partial block (2 days)
  const plan: Phase5Day[] = [];
  let dayNum = 1;
  
  // 4 complete 3-day blocks (days 1-12)
  for (let block = 1; block <= 4; block++) {
    // Pick random phase for this block
    const randomPhase = phases[Math.floor(Math.random() * phases.length)];
    const label = phaseLabels[randomPhase];
    
    // Each block is 3 days
    for (let i = 0; i < 3; i++) {
      plan.push({ day: dayNum++, phase: randomPhase, label });
    }
  }
  
  // Final 2-day block (days 13-14)
  const finalPhase = phases[Math.floor(Math.random() * phases.length)];
  plan.push({ day: 13, phase: finalPhase, label: phaseLabels[finalPhase] });
  plan.push({ day: 14, phase: finalPhase, label: phaseLabels[finalPhase] });
  
  return plan;
}

// Get current day of Phase 5 plan (1-14)
export function getPhase5DayNumber(phase5StartDate: string): number {
  if (!phase5StartDate) return 1;
  const start = new Date(phase5StartDate + 'T12:00:00');
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  // Day 1 = start date
  return Math.min(14, Math.max(1, diffDays + 1));
}

// Check if Phase 5 plan needs regeneration (after 14 days)
export function isPhase5PlanExpired(phase5StartDate: string): boolean {
  if (!phase5StartDate) return true;
  const start = new Date(phase5StartDate + 'T12:00:00');
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays >= 14; // Needs new plan after 14 days
}

// Get tomorrow's phase for Phase 5
export function getTomorrowPhase(
  phase5Plan: Phase5Day[],
  phase5StartDate: string
): 1 | 2 | 4 | null {
  if (!phase5Plan || phase5Plan.length === 0) return null;
  
  const currentDay = getPhase5DayNumber(phase5StartDate);
  const tomorrowDay = Math.min(14, currentDay + 1);
  
  const tomorrowEntry = phase5Plan.find(d => d.day === tomorrowDay);
  return tomorrowEntry?.phase || null;
}

// Get simple starch message for tomorrow (NO phase names, NO jargon)
export function getTomorrowStarchMessage(
  tomorrowPhase: 1 | 2 | 4 | 6 | null,
  isPhase5: boolean = false,
  phase5Plan?: Phase5Day[],
  phase5StartDate?: string
): string {
  // For Phase 5, look up tomorrow's actual phase from the plan
  if (isPhase5 && phase5Plan && phase5StartDate) {
    const actualTomorrowPhase = getTomorrowPhase(phase5Plan, phase5StartDate);
    if (actualTomorrowPhase) {
      tomorrowPhase = actualTomorrowPhase;
    }
  }
  
  if (tomorrowPhase === 1) {
    return 'Tomorrow: no starches';
  }
  if (tomorrowPhase === 2) {
    return 'Tomorrow: add starches to breakfast and lunch. No starch at dinner or snacks.';
  }
  if (tomorrowPhase === 4 || tomorrowPhase === 6) {
    return tomorrowPhase === 6 
      ? 'Tomorrow: add starches every meal. Remember your whey and creatine.'
      : 'Tomorrow: add starches every meal';
  }
  return '';
}

// Get current phase's starch rule description
export function getPhase5CurrentRule(phase5Plan: Phase5Day[], phase5StartDate: string): string {
  if (!phase5Plan || phase5Plan.length === 0) return '';
  
  const currentDay = getPhase5DayNumber(phase5StartDate);
  const currentEntry = phase5Plan.find(d => d.day === currentDay);
  return currentEntry?.label || '';
}

// Food categories (LEAN_PROTEINS, STARCHY_CARBOHYDRATES, HEALTHY_FATS, FIBROUS_VEGETABLES)
// and PORTION_SIZES have been moved to @/lib/nutrition-data.ts
// Re-export them here for backward compatibility:
export { LEAN_PROTEINS, STARCHY_CARBOHYDRATES, HEALTHY_FATS, FIBROUS_VEGETABLES } from './nutrition-data';

export function getCoachPrompt(context: CoachContext, message: string): string {
  const portions = getPortions(context.gender, context.currentPhase);
  const weeksUntilEvent = context.eventDate 
    ? Math.ceil((new Date(context.eventDate).getTime() - Date.now()) / (7 * 24 * 60 * 60 * 1000))
    : null;

  const lowerMessage = message.toLowerCase();
  const asksAboutPlan = lowerMessage.includes('what can i eat') || lowerMessage.includes('my plan') || lowerMessage.includes('show me') || lowerMessage.includes('what am i') || lowerMessage.includes('meal example') || lowerMessage.includes('example meal') || lowerMessage.includes('phase') || lowerMessage.includes('portion') || lowerMessage.includes('categories') || lowerMessage.includes('what to eat') || lowerMessage.includes('swap') || lowerMessage.includes('exchange');

  if (asksAboutPlan) {
    // Build Phase 5 plan description if applicable
    let phase5PlanDesc = '';
    if (context.currentPhase === 5 && context.phase5Plan && context.phase5Plan.length > 0) {
      const dayNum = context.phase5StartDate ? getPhase5DayNumber(context.phase5StartDate) : 1;
      const todayRule = context.phase5Plan.find(d => d.day === dayNum);
      phase5PlanDesc = `\n• You're on DAY ${dayNum} of your 14-day plan: ${todayRule?.label || 'Unknown'}`;
    }

    const phaseDescription = context.currentPhase === 1 ? 'NO STARCH - 14 days of lean protein, veggies, healthy fats only' :
                            context.currentPhase === 2 ? 'STARCH ONLY for BREAKFAST & LUNCH on Wed/Sat/Sun - dinner & snack NEVER get starch' :
                            context.currentPhase === 5 ? `AGGRESSIVE FAT LOSS - 14-day rotating plan with 3-day blocks${phase5PlanDesc}` :
                            'MAINTENANCE - starch every meal, weigh Fri only';
    const phaseNext = context.currentPhase === 1 ? 'Phase 2: Add starch Wed/Sat/Sun' :
                      context.currentPhase === 2 ? 'Phase 4 or back to Phase 1 (based on goal)' :
                      context.currentPhase === 5 ? 'Phase 5 runs 14 days, then transition to maintenance.' :
                      'You\'re done - maintenance!';
    
    const proteinExamples = context.gender === 'male' 
      ? '6oz protein per meal (2-3 whole eggs)' 
      : '4oz protein per meal (1-2 whole eggs)';
    const veggieExamples = 'broccoli, spinach, asparagus, zucchini, peppers, salad';
    const fatExamples = 'olive oil, avocado, almonds';
    const mealExample = context.gender === 'male' 
      ? '6oz grilled salmon, 2 cups broccoli with olive oil, 1/2 avocado' 
      : '4oz grilled chicken, 1.5 cups spinach with olive oil, few almonds';

    return `You're in PHASE ${context.currentPhase}: ${phaseDescription}

Portions per meal:
Protein: ${portions.protein} (${proteinExamples})
Veggies: ${portions.fibrousVegetables} (${veggieExamples})
Fat: ${portions.fat} (${fatExamples})
Water: ${context.gender === 'male' ? '128oz' : '80oz'} daily
${context.currentPhase === 1 ? 'NO STARCH in Phase 1!' : ''}

Example: ${mealExample}

${context.eventDate ? `EVENT IN ${weeksUntilEvent} WEEKS - keep pushing!` : 'Keep crushing it!'}

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
7. HEALTHY FATS ARE GOOD — Never tell client to skip or eliminate healthy fats like avocado, olive oil, or nuts. AVOCADO IS A HEALTHY FAT and should be ENCOURAGED in every meal! The fat limit is a MAXIMUM, not a target to minimize. NEVER say "skip the avocado" or "reduce fat" — instead encourage healthy fats!

CLIENT CONTEXT:
- Name: ${context.clientName || 'Client'}
- Phase: ${context.currentPhase} (Phase 1 = no starch, Phase 2 = add starch Wed/Sat/Sun, Phase 4 = maintenance${context.programType !== 'event_ready' && context.programType ? `, Phase 5 = aggressive fat loss with 14-day rotating plan (3-day blocks)${context.currentPhase === 5 && context.phase5Plan ? `, current plan: Day ${getPhase5DayNumber(context.phase5StartDate || '')}: ${context.phase5Plan.find(d => d.day === getPhase5DayNumber(context.phase5StartDate || ''))?.label || 'Unknown'}` : ''}` : ''})
- Gender: ${context.gender} (${context.gender === 'male' ? 'MALE — use MALE portions only' : 'FEMALE — use FEMALE portions only'})
- Goal: ${context.goalWeight}lbs, Started: ${context.startingWeight}lbs, Current: ${context.currentWeight}lbs
${context.eventDate ? `- Event in ${weeksUntilEvent} weeks` : ''}

PHASE RULES (for YOUR reference only — give personalized advice for THIS client, not generic phase descriptions):
- Phase 1: ${portions.protein} protein, ${portions.fibrousVegetables} veggies, ${portions.fat} fat, NO starch, NO dairy, NO sugar, ${context.gender === 'male' ? '128' : '80'}oz water
- Phase 2: Same as Phase 1 + starch for BREAKFAST & LUNCH ONLY on Wed/Sat/Sun. Dinner and snack NEVER get starch in Phase 2!
- Phase 4: Add starch every meal, weigh Fri only
- Phase 5: 14-day plan with 3-day blocks rotating through strict/strict/lenient rules. Same portions as other phases.

CLIENT'S MESSAGE: "${message}"

Respond as Allen would. Short. Direct. Helpful. Tell them what to do NEXT. Only reference THIS CLIENT'S portions — never mention male/female side by side.`;
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

export async function analyzeMealPortion(
  foodDescription: string | undefined | null,
  context: CoachContext,
  mealType?: string
): Promise<{ advice: string; onPhase: boolean; corrections: string[] }> {
  // Defensive: ensure foodDescription is a valid non-empty string
  if (!foodDescription || typeof foodDescription !== 'string' || foodDescription.trim().length === 0) {
    return {
      advice: 'Please describe what you are eating so I can give you portion advice.',
      onPhase: false,
      corrections: [],
    };
  }
  
  // Ensure corrections cache is loaded before doing any correction lookups
  await ensureCacheLoaded();
  const portions = getPortions(context.gender, context.currentPhase);
  const violationMessages: string[] = [];
  let onPhase = true;
  const isSnack = mealType === 'snack';
  
  const foodLower = foodDescription.toLowerCase();
  
  // SNACK LOGIC: If it's a snack, skip food-group requirements but check if allowed
  if (isSnack) {
    // Check if snack is allowed for this phase
    if (!isSnackAllowed(foodDescription, context.currentPhase)) {
      const disallowedMsg = `⚠️ ${foodDescription} is not allowed in Phase ${context.currentPhase}!`;
      const waterReminder = getWaterReminder(context.gender);
      return {
        advice: `${disallowedMsg} ${waterReminder}`,
        onPhase: false,
        corrections: [disallowedMsg, waterReminder],
      };
    }
    // Snack is allowed - just add water reminder and return success
    const waterReminder = getWaterReminder(context.gender);
    return {
      advice: `Looks good! ${waterReminder}`,
      onPhase: true,
      corrections: [waterReminder],
    };
  }
  
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
  let starchFound = starchKeywords.find(starch => foodLower.includes(starch));
  let dairyFound = dairyKeywords.find(d => foodLower.includes(d));
  let sugarFound = sugarKeywords.find(s => foodLower.includes(s));
  
  // =============================================
  // AI CORRECTIONS CACHE - Override keyword detection with corrections
  // =============================================
  // Check if there's a correction for the full food description
  const fullCorrection = getCorrection(foodDescription);
  if (fullCorrection) {
    // Override: use the corrected category
    const correctedCategory = fullCorrection.correctCategory;
    starchFound = correctedCategory === 'starch' ? starchFound : undefined;
    dairyFound = correctedCategory === 'dairy' ? dairyFound : undefined;
    sugarFound = correctedCategory === 'sugar' ? sugarFound : undefined;
    // If corrected to protein, vegetable, fat, or other, clear all violations
    if (['protein', 'vegetable', 'fat', 'other'].includes(correctedCategory)) {
      starchFound = undefined;
      dairyFound = undefined;
      sugarFound = undefined;
    }
  } else {
    // No full correction - check individual words for corrections
    // Split food description into words and check each for corrections
    const words = foodDescription.toLowerCase().split(/[\s,]+/).filter(w => w.length > 2);
    for (const word of words) {
      const wordCorrection = getCorrection(word);
      if (wordCorrection) {
        // If this word has a correction, apply it
        const correctedCategory = wordCorrection.correctCategory;
        // Override the specific violation category
        if (correctedCategory === 'starch') {
          starchFound = word;
          dairyFound = undefined;
          sugarFound = undefined;
        } else if (correctedCategory === 'dairy') {
          dairyFound = word;
          starchFound = undefined;
          sugarFound = undefined;
        } else if (correctedCategory === 'sugar') {
          sugarFound = word;
          starchFound = undefined;
          dairyFound = undefined;
        } else if (['protein', 'vegetable', 'fat', 'other'].includes(correctedCategory)) {
          // Correction says this is NOT a violation - clear all violations for this word
          if (starchFound === word) starchFound = undefined;
          if (dairyFound === word) dairyFound = undefined;
          if (sugarFound === word) sugarFound = undefined;
        }
      }
    }
  }
  
  // Phase-based rules: starch, dairy, and sugar
  if (context.currentPhase === 1) {
    // Phase 1: NO starch, NO dairy, NO sugar allowed
    if (starchFound) {
      violationMessages.push(`⚠️ Phase 1 - NO starch! Skip the ${starchFound} completely.`);
      onPhase = false;
    }
    if (dairyFound) {
      violationMessages.push(`⚠️ Phase 1 - NO dairy! Skip the ${dairyFound} completely.`);
      onPhase = false;
    }
    if (sugarFound) {
      violationMessages.push(`⚠️ Phase 1 - NO sugar! Skip the ${sugarFound} completely.`);
      onPhase = false;
    }
  } else if (context.currentPhase === 2) {
    // Phase 2: Starch allowed ONLY on Wed, Sat, Sun for first 2 meals
    // BUT dairy and sugar are STILL NOT ALLOWED (same as Phase 1)
    if (dairyFound) {
      violationMessages.push(`⚠️ Phase 2 - NO dairy! Skip the ${dairyFound} completely.`);
      onPhase = false;
    }
    if (sugarFound) {
      violationMessages.push(`⚠️ Phase 2 - NO sugar! Skip the ${sugarFound} completely.`);
      onPhase = false;
    }
    // Phase 2: Starch allowed ONLY on Wed, Sat, Sun for BREAKFAST and LUNCH (first 2 meals)
    // dinner and snack NEVER get starch in Phase 2 (same as Phase 1)
    if (starchFound) {
      const isBreakfastOrLunch = mealType === 'breakfast' || mealType === 'lunch';
      const isDinnerOrSnack = mealType === 'dinner' || mealType === 'snack';
      
      if (isDinnerOrSnack) {
        // dinner and snack NEVER get starch in Phase 2
        violationMessages.push(`⚠️ Phase 2 - NO starch for ${mealType}! Only breakfast and lunch get starch in Phase 2. Skip the ${starchFound}.`);
        onPhase = false;
      } else if (isBreakfastOrLunch && context.mealDate) {
        // Breakfast/lunch: check allowed day and meal count
        const mealDateObj = new Date(context.mealDate + 'T12:00:00');
        const dayOfWeek = mealDateObj.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
        const allowedDays = [0, 3, 6]; // Sun (0), Wed (3), Sat (6)
        
        if (!allowedDays.includes(dayOfWeek)) {
          violationMessages.push(`⚠️ Phase 2 - starch only allowed on Wed, Sat, Sun. No ${starchFound} today. Remove it or swap for extra veg.`);
          onPhase = false;
        } else {
          // On allowed day - check meal count
          const mealsLogged = context.mealsLoggedToday || 0;
          if (mealsLogged >= 2) {
            violationMessages.push(`⚠️ Phase 2 - starch only in first 2 meals. You've had ${mealsLogged} meals today. Skip the ${starchFound}.`);
            onPhase = false;
          }
          // If meal 1 or 2 on allowed day, starch is ALLOWED - don't add violation
        }
      } else if (isBreakfastOrLunch && !context.mealDate) {
        // If no mealDate, be conservative and warn
        violationMessages.push(`⚠️ Phase 2 - starch only allowed on Wed, Sat, Sun. Check if today is an allowed day before eating ${starchFound}.`);
        onPhase = false;
      } else if (!mealType || mealType === 'meal') {
        // Backwards compatibility: no specific mealType, use old meal-count logic
        if (context.mealDate) {
          const mealDateObj = new Date(context.mealDate + 'T12:00:00');
          const dayOfWeek = mealDateObj.getDay();
          const allowedDays = [0, 3, 6];
          
          if (!allowedDays.includes(dayOfWeek)) {
            violationMessages.push(`⚠️ Phase 2 - starch only allowed on Wed, Sat, Sun. No ${starchFound} today. Remove it or swap for extra veg.`);
            onPhase = false;
          } else {
            violationMessages.push(`⚠️ Phase 2 - starch allowed only in first 2 meals today. If this is meal 3 or later, skip the ${starchFound}.`);
            onPhase = false;
          }
        } else {
          violationMessages.push(`⚠️ Phase 2 - starch only allowed on Wed, Sat, Sun. Check if today is an allowed day before eating ${starchFound}.`);
          onPhase = false;
        }
      }
    }
  } else if (context.currentPhase === 4) {
    // Phase 4: Maintenance - starch allowed every meal, dairy/sugar ALLOWED in controlled portions
    // If 5+ lbs over goal = back to Phase 1
    
    // Phase 4 portion limits per meal
    const maxDairyServings = context.gender === 'male' ? 2 : 1;
    const maxSugarServings = context.gender === 'male' ? 2 : 1;
    
    // Dairy portion warning
    if (dairyFound) {
      const dairyServings = 1; // Each dairy item counts as 1 serving
      if (dairyServings > maxDairyServings) {
        violationMessages.push(`⚠️ Phase 4 - Dairy portion exceeded! You can have ${maxDairyServings} serving${maxDairyServings > 1 ? 's' : ''} per meal (${context.gender === 'male' ? 'men' : 'women'} limit). Skip the ${dairyFound} or reduce portions.`);
        onPhase = false;
      } else {
        violationMessages.push(`💡 Phase 4 - Dairy allowed (${dairyServings}/${maxDairyServings} serving). Keep portions in check.`);
      }
    }
    
    // Sugar portion warning
    if (sugarFound) {
      const sugarServings = 1; // Each sugar item counts as 1 serving
      if (sugarServings > maxSugarServings) {
        violationMessages.push(`⚠️ Phase 4 - Sugar portion exceeded! You can have ${maxSugarServings} serving${maxSugarServings > 1 ? 's' : ''} per meal (${context.gender === 'male' ? 'men' : 'women'} limit). Skip the ${sugarFound} or reduce portions.`);
        onPhase = false;
      } else {
        violationMessages.push(`💡 Phase 4 - Sugar allowed (${sugarServings}/${maxSugarServings} serving). Keep portions in check.`);
      }
    }
    
    // Processed food detection and warning
    const processedFoodKeywords = [
      'frozen dinner', 'frozen meal', 'canned soup', 'instant noodles', 'microwave meal',
      'fast food', 'drive through', 'burger king', "mcdonald", 'wendys', 'taco bell',
      'chipotle', 'pizza', 'hot dog', 'sausage', 'pepperoni', 'bacon',
      'chips', 'soda', 'candy', 'ice cream', 'cookies', 'cake', 'pastries',
      'cereal', 'granola bar', 'protein bar', 'meal replacement bar',
      'tv dinner', 'pot pie', 'fish sticks', 'chicken nuggets', 'chicken tenders',
      'french fries', 'onion rings', 'mozzarella sticks', 'nachos', 'queso'
    ];
    const processedFoodFound = processedFoodKeywords.find(p => foodLower.includes(p));
    const mealsLoggedToday = context.mealsLoggedToday || 0;
    
    if (processedFoodFound) {
      // Warn if this appears to be a processed meal
      violationMessages.push(`⚠️ Phase 4 - Processed food detected (${processedFoodFound}). ~1 processed meal per day max. You've had ${mealsLoggedToday} meal${mealsLoggedToday !== 1 ? 's' : ''} logged today. Get back to natural food!`);
      onPhase = false;
    }
    
    // Phase 4 weight check - if 5+ lbs over goal, suggest returning to Phase 1
    const weightOverGoal = context.currentWeight - context.goalWeight;
    if (weightOverGoal >= 5) {
      violationMessages.push(`⚠️ Phase 4 - You're ${weightOverGoal.toFixed(1)} lbs over goal. Time to reset to Phase 1 to get back on track!`);
      onPhase = false;
    }
    
    if (starchFound) {
      violationMessages.push(`💡 Phase 4 - Starch allowed every meal. Keep portions in check: ${portions.protein} protein, ${portions.fibrousVegetables} veg. Natural starches preferred over processed.`);
    }
  } else if (context.currentPhase === 5 && context.programType !== 'event_ready') {
    // Phase 5: Aggressive Fat Loss - 14-day plan with 3-day blocks of P1, P2, or P4 rules
    // Determine which day of the plan we're on
    const dayNum = context.phase5StartDate ? getPhase5DayNumber(context.phase5StartDate) : 1;
    const currentDayRule = context.phase5Plan?.find(d => d.day === dayNum);
    const rulePhase = currentDayRule?.phase || 1; // Default to P1 rules (no starch)
    
    // Phase 5 uses FULL phase rules from P1, P2, or P4 based on the plan
    // Apply the appropriate phase's rules
    
    // Dairy and sugar restrictions depend on the assigned phase
    if (rulePhase === 1 || rulePhase === 2) {
      // P1 and P2: no dairy, no sugar
      if (dairyFound) {
        violationMessages.push(`⚠️ Phase 5 Day ${dayNum} (strict phase) - NO dairy! Skip the ${dairyFound} completely.`);
        onPhase = false;
      }
      if (sugarFound) {
        violationMessages.push(`⚠️ Phase 5 Day ${dayNum} (strict phase) - NO sugar! Skip the ${sugarFound} completely.`);
        onPhase = false;
      }
    }
    // Phase 4 (which is used in Phase 5 rotation): dairy and sugar allowed in controlled portions
    
    // Apply starch rules based on the assigned phase
    if (starchFound) {
      if (rulePhase === 1) {
        // Phase 1 rules: NO starch at all
        violationMessages.push(`⚠️ Phase 5 Day ${dayNum} (strict phase) - NO starch! Skip the ${starchFound} completely.`);
        onPhase = false;
      } else if (rulePhase === 2) {
        // Phase 2 rules: starch at breakfast & lunch ONLY (not dinner or snacks)
        const isBreakfastOrLunch = mealType === 'breakfast' || mealType === 'lunch';
        const isDinnerOrSnack = mealType === 'dinner' || mealType === 'snack';
        
        if (isDinnerOrSnack) {
          violationMessages.push(`⚠️ Phase 5 Day ${dayNum} - starch allowed at breakfast & lunch ONLY. No starch at ${mealType}! Skip the ${starchFound}.`);
          onPhase = false;
        } else if (!isBreakfastOrLunch && mealType) {
          violationMessages.push(`⚠️ Phase 5 Day ${dayNum} - starch allowed at breakfast & lunch only. No ${starchFound} at dinner or snacks.`);
          onPhase = false;
        }
        // If breakfast/lunch with no specific mealType, allow it
      }
      // rulePhase === 4: starch allowed every meal - no violation needed
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
  
  // Extract water amount from food description (e.g., "32 oz of water" → 32)
  // Support formats: "32 oz", "32oz", "32 ounces", "32 ounce"
  let loggedWaterOz = 0;
  if (hasWater) {
    const waterAmountMatch = foodDescription.match(/(\d+)\s*(?:oz|ounces?|oz\.)/i);
    if (waterAmountMatch) {
      loggedWaterOz = parseInt(waterAmountMatch[1], 10);
    }
  }
  
  // Calculate water tracking
  const baseWaterOz = context.gender === 'male' ? 128 : 80;
  const todayCoffee = context.todayCoffeeIntake || 0;
  const todayWater = context.todayWaterIntake || 0;
  const mealsLogged = context.mealsLoggedToday || 0;
  const totalWaterNeeded = baseWaterOz + todayCoffee;
  // Include water logged in THIS meal in the running total
  const effectiveTodayWater = todayWater + loggedWaterOz;
  // remaining meals AFTER this meal is logged (mealsLogged doesn't include this meal)
  const remainingMeals = Math.max(1, 3 - mealsLogged);
  const remainingWater = Math.max(0, totalWaterNeeded - effectiveTodayWater);
  const waterPerMeal = remainingMeals > 0 ? Math.round((remainingWater / remainingMeals) * 10) / 10 : 0; // round to 1 decimal
  
  // Build water tracking message
  let waterTrackingMessage = '';
  if (hasWater) {
    // Client mentioned water - acknowledge the logged amount and give remaining target
    if (loggedWaterOz > 0) {
      // Acknowledge the specific amount logged
      if (waterPerMeal > 0) {
        waterTrackingMessage = `💧 Water tracked: ${loggedWaterOz}oz logged. You need ${waterPerMeal}oz water per remaining meal today.`;
      } else {
        waterTrackingMessage = `💧 Great job staying hydrated! ${loggedWaterOz}oz logged - you're on track with water today!`;
      }
    } else {
      // Water mentioned but no specific amount detected - use generic message
      if (waterPerMeal > 0) {
        waterTrackingMessage = `💧 Water tracked. You need ${waterPerMeal}oz water per remaining meal today.`;
      } else {
        waterTrackingMessage = `💧 Great job staying hydrated! You're on track with water today.`;
      }
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
      violationMessages.push(`💡 Notice: Consider adding some lean protein to round out your meal.`);
    }
    if (!hasVeg) {
      violationMessages.push(`💡 Notice: Adding some fibrous vegetables would be great for your meal.`);
    }
    if (!hasFat) {
      violationMessages.push(`💡 Notice: Don't forget healthy fat like olive oil, avocado, or nuts. Stay hydrated with water too!`);
    }
  } else if (context.currentPhase === 1) {
    // Phase 1: Protein + Veg + Fat required. No starch.
    if (!hasProtein && !hasVeg) {
      let suggestion = `💡 Add ${portions.protein} lean protein + ${portions.fibrousVegetables} fibrous vegetables`;
      if (!hasFat) suggestion += ` + ${portions.fat} olive oil or ${portions.avocado} avocado`;
      suggestion += `. ${waterTrackingMessage}`;
      violationMessages.push(suggestion);
    } else if (!hasProtein) {
      violationMessages.push(`💡 Add ${portions.protein} lean protein + ${portions.fat} olive oil or ${portions.avocado} avocado. ${waterTrackingMessage}`);
    } else if (!hasVeg) {
      violationMessages.push(`💡 Add ${portions.fibrousVegetables} fibrous vegetables + ${portions.fat} olive oil or ${portions.avocado} avocado. ${waterTrackingMessage}`);
    } else if (!hasFat || isStandaloneFatFood) {
      // Don't suggest adding fat if the food IS a fat source (nuts, avocado, oil, etc.)
      if (!isStandaloneFatFood) {
        violationMessages.push(`💡 Add ${portions.fat} olive oil or ${portions.avocado} avocado for healthy fat. ${waterTrackingMessage}`);
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
        violationMessages.push(suggestion);
      } else if (!hasProtein) {
        violationMessages.push(`💡 Add ${portions.protein} lean protein + 1-2 cups oatmeal or natural starch + ${portions.fat} olive oil or ${portions.avocado} avocado. ${waterTrackingMessage}`);
      } else if (!hasVeg) {
        violationMessages.push(`💡 Add ${portions.fibrousVegetables} fibrous vegetables + 1-2 cups oatmeal or natural starch + ${portions.fat} olive oil or ${portions.avocado} avocado. ${waterTrackingMessage}`);
      } else if (!hasFat) {
        violationMessages.push(`💡 Add ${portions.fat} olive oil or ${portions.avocado} avocado + 1-2 cups oatmeal or natural starch. ${waterTrackingMessage}`);
      } else if (!starchFound) {
        // Has protein, veg, fat but no starch on allowed day
        violationMessages.push(`💡 Add 1-2 cups oatmeal or natural starch like potato or rice. ${waterTrackingMessage}`);
      }
    } else {
      // Starch NOT allowed today (not Wed/Sat/Sun)
      if (!hasProtein && !hasVeg) {
        let suggestion = `💡 Add ${portions.protein} lean protein + ${portions.fibrousVegetables} fibrous vegetables`;
        if (!hasFat) suggestion += ` + ${portions.fat} olive oil or ${portions.avocado} avocado`;
        suggestion += `. ${waterTrackingMessage}`;
        violationMessages.push(suggestion);
      } else if (!hasProtein) {
        violationMessages.push(`💡 Add ${portions.protein} lean protein + ${portions.fat} olive oil or ${portions.avocado} avocado. ${waterTrackingMessage}`);
      } else if (!hasVeg) {
        violationMessages.push(`💡 Add ${portions.fibrousVegetables} fibrous vegetables + ${portions.fat} olive oil or ${portions.avocado} avocado. ${waterTrackingMessage}`);
      } else if (!hasFat) {
        violationMessages.push(`💡 Add ${portions.fat} olive oil or ${portions.avocado} avocado. ${waterTrackingMessage}`);
      }
    }
  } else if (context.currentPhase === 5 && context.programType !== 'event_ready') {
    // Phase 5: Aggressive Fat Loss - 14-day plan with 3-day blocks of P1, P2, or P4 rules
    const dayNum = context.phase5StartDate ? getPhase5DayNumber(context.phase5StartDate) : 1;
    const currentDayRule = context.phase5Plan?.find(d => d.day === dayNum);
    const rulePhase = currentDayRule?.phase || 1; // Default to P1 rules (no starch)
    
    if (rulePhase === 1 || rulePhase === 2) {
      // Strict phases (P1 or P2): protein + veg + fat required
      if (!hasProtein && !hasVeg) {
        let suggestion = `💡 Add ${portions.protein} lean protein + ${portions.fibrousVegetables} fibrous vegetables`;
        if (!hasFat) suggestion += ` + ${portions.fat} olive oil or ${portions.avocado} avocado`;
        suggestion += `. ${waterTrackingMessage}`;
        violationMessages.push(suggestion);
      } else if (!hasProtein) {
        violationMessages.push(`💡 Add ${portions.protein} lean protein + ${portions.fat} olive oil or ${portions.avocado} avocado. ${waterTrackingMessage}`);
      } else if (!hasVeg) {
        violationMessages.push(`💡 Add ${portions.fibrousVegetables} fibrous vegetables + ${portions.fat} olive oil or ${portions.avocado} avocado. ${waterTrackingMessage}`);
      } else if (!hasFat || isStandaloneFatFood) {
        if (!isStandaloneFatFood) {
          violationMessages.push(`💡 Add ${portions.fat} olive oil or ${portions.avocado} avocado for healthy fat. ${waterTrackingMessage}`);
        }
      }
    } else if (rulePhase === 4) {
      // Phase 4 rules: more lenient - gentle suggestions
      if (!hasProtein) {
        violationMessages.push(`💡 Notice: Consider adding some lean protein to round out your meal.`);
      }
      if (!hasVeg) {
        violationMessages.push(`💡 Notice: Adding some fibrous vegetables would be great for your meal.`);
      }
      if (!hasFat && !isStandaloneFatFood) {
        violationMessages.push(`💡 Notice: Don't forget healthy fat like olive oil, avocado, or nuts. Stay hydrated with water too!`);
      }
    }
  }
  
  if (violationMessages.length === 0) {
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
  
  // Always include water reminder in the response
  const waterReminder = getWaterReminder(context.gender);
  const finalAdvice = violationMessages.length > 0 
    ? violationMessages.join('\n') + '\n' + waterReminder
    : 'Log your foods and get back on track next meal! ' + waterReminder;
  
  return {
    advice: finalAdvice,
    onPhase,
    corrections: violationMessages,
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
    case 4:
      return 'Phase 4: Maintenance mode - add starch to every meal, weigh Fridays only.';
    case 5:
      return 'Phase 5: Aggressive Fat Loss - 3-day rotating plan. Plan regenerates every 3 days.';
    default:
      return 'Keep following your plan!';
  }
}
