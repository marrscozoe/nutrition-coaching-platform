// Pluggable AI Provider Architecture
// Supports any AI provider: OpenAI, Anthropic, Gemini, Ollama, etc.

// Import corrections cache (server-only)
import { initializeCorrectionsCache, getCorrection, getAllCorrections, isCacheLoaded } from './food-corrections-cache';

// Import centralized nutrition data
import {
  getPortions,
  isSnackAllowed,
  getWaterReminder,
  LEAN_PROTEINS,
  FIBROUS_VEGETABLES,
  STARCHY_CARBOHYDRATES,
  HEALTHY_FATS,
  SUPPLEMENTS,
  EGG_PORTIONS,
  Phase5Day,
  getPhase5DayNumber,
  getPhase5CurrentRule,
} from './nutrition-data';

// Re-export Phase5Day and phase 5 helpers for backward compatibility
export type { Phase5Day } from './nutrition-data';
export { getPhase5DayNumber, getPhase5CurrentRule } from './nutrition-data';

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
  phase5Plan?: Phase5Day[]; // 14-day plan with daily type assignment
  phase5StartDate?: string; // YYYY-MM-DD when the current 14-day plan started
}

// Phase 5: 14-day plan where each day is randomly assigned ONE of three behaviors:
// Type A (Phase 1 behavior): No starches all day. Protein + veg + fat only.
// Type B (Phase 2 behavior): Starches with breakfast and lunch only. Dinner no starch.
// Type C (Phase 4 behavior): Starches with every meal.
export function generatePhase5Plan(): Phase5Day[] {
  const types: Array<'phase1' | 'phase2' | 'phase4'> = ['phase1', 'phase2', 'phase4'];
  const typeLabels: Record<'phase1' | 'phase2' | 'phase4', string> = {
    phase1: 'No starch today',
    phase2: 'Starch with breakfast and lunch only',
    phase4: 'Starch with every meal',
  };
  
  // Generate 14-day plan with each day randomly assigned a type
  const plan: Phase5Day[] = [];
  for (let day = 1; day <= 14; day++) {
    const type = types[Math.floor(Math.random() * types.length)];
    plan.push({ day, type, label: typeLabels[type] });
  }
  return plan;
}

// Check if Phase 5 plan needs regeneration (after 14 days)
export function isPhase5PlanExpired(phase5StartDate: string): boolean {
  if (!phase5StartDate) return true;
  const start = new Date(phase5StartDate + 'T12:00:00');
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays >= 14; // Needs new plan after 14 days
}

// Get tomorrow's type for Phase 5
export function getTomorrowPhase(
  phase5Plan: Phase5Day[],
  phase5StartDate: string
): 'phase1' | 'phase2' | 'phase4' | null {
  if (!phase5Plan || phase5Plan.length === 0) return null;
  
  const currentDay = getPhase5DayNumber(phase5StartDate);
  const tomorrowDay = Math.min(14, currentDay + 1);
  
  const tomorrowEntry = phase5Plan.find(d => d.day === tomorrowDay);
  return tomorrowEntry?.type || null;
}

// Get simple starch message for tomorrow (NO phase numbers, NO jargon)
export function getTomorrowStarchMessage(
  tomorrowType: 'phase1' | 'phase2' | 'phase4' | null,
  isPhase5: boolean = false,
  phase5Plan?: Phase5Day[],
  phase5StartDate?: string
): string {
  // For Phase 5, look up tomorrow's actual type from the plan
  if (isPhase5 && phase5Plan && phase5StartDate) {
    const actualTomorrowType = getTomorrowPhase(phase5Plan, phase5StartDate);
    if (actualTomorrowType) {
      tomorrowType = actualTomorrowType;
    }
  }
  
  if (tomorrowType === 'phase1') {
    return '⏰ Tomorrow: no starches all day. Protein + veg + fat only.';
  }
  if (tomorrowType === 'phase2') {
    return '⏰ Tomorrow: starches with breakfast and lunch only. Dinner no starch.';
  }
  if (tomorrowType === 'phase4') {
    return '⏰ Tomorrow: starches with every meal. Add to all meals.';
  }
  return '';
}

// Helper: convert type string to numeric phase
export function typeToNumericPhase(type: 'phase1' | 'phase2' | 'phase4' | undefined): 1 | 2 | 4 {
  if (type === 'phase1') return 1;
  if (type === 'phase2') return 2;
  return 4;
}

// Food categories (LEAN_PROTEINS, STARCHY_CARBOHYDRATES, HEALTHY_FATS, FIBROUS_VEGETABLES)
// and PORTION_SIZES have been moved to @/lib/nutrition-data.ts
// Re-export them here for backward compatibility:
export { LEAN_PROTEINS, STARCHY_CARBOHYDRATES, HEALTHY_FATS, FIBROUS_VEGETABLES } from './nutrition-data';

export function getCoachPrompt(context: CoachContext, message: string): string {
  const portions = getPortions(context.gender, context.currentPhase);
  // Only show event info to event_ready clients — never leak event data to other programs
  const isEventClient = context.programType === 'event_ready' && context.eventDate;
  const weeksUntilEvent = isEventClient
    ? Math.ceil((new Date(context.eventDate!).getTime() - Date.now()) / (7 * 24 * 60 * 60 * 1000))
    : null;

  const lowerMessage = message.toLowerCase();
  const asksAboutPlan = lowerMessage.includes('what can i eat') || lowerMessage.includes('my plan') || lowerMessage.includes('show me') || lowerMessage.includes('what am i') || lowerMessage.includes('meal example') || lowerMessage.includes('example meal') || lowerMessage.includes('phase') || lowerMessage.includes('portion') || lowerMessage.includes('categories') || lowerMessage.includes('what to eat') || lowerMessage.includes('swap') || lowerMessage.includes('exchange');

  // Build dynamic food examples from the actual food lists
  const proteinList = LEAN_PROTEINS.join(', ');
  const veggieList = FIBROUS_VEGETABLES.join(', ');
  const starchList = STARCHY_CARBOHYDRATES.join(', ');
  const fatList = HEALTHY_FATS.join(', ');

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
    
    const proteinExamples = context.gender === 'male' 
      ? '6oz protein per meal' 
      : '4oz protein per meal';
    const mealExample = context.gender === 'male' 
      ? '6oz grilled salmon, 2 cups broccoli with olive oil, 1/2 avocado' 
      : '4oz grilled chicken, 1.5 cups spinach with olive oil, few almonds';

    // IMPORTANT: The fat source must ALWAYS be specified. Never let AI drop "olive oil" from the response.
    // Using explicit wording to prevent AI from rephrasing it away.
    return `You're in PHASE ${context.currentPhase}: ${phaseDescription}

Portions per meal:
Protein: ${portions.protein} (${proteinExamples})
Veggies: ${portions.fibrousVegetables} (${veggieList})
Fat: ${portions.fat} (${fatList})
Starch: ${context.currentPhase === 1 ? 'NO STARCH in Phase 1!' : context.currentPhase === 2 ? 'Only on Wed/Sat/Sun breakfast & lunch' : 'Every meal'}
Water: ${context.gender === 'male' ? '32oz' : '20oz'} per meal

YOUR APPROVED FOODS:
• LEAN PROTEINS: ${proteinList}
• FIBROUS VEGETABLES: ${veggieList}
• HEALTHY FATS: ${fatList}
${context.currentPhase !== 1 ? `• STARCHY CARBOHYDRATES: ${starchList}` : ''}

Example: ${mealExample}

⚠️ IMPORTANT RULES:
1. When giving advice about foods, ONLY recommend foods from the APPROVED LISTS above
2. NEVER suggest foods not listed above (no pasta, bread, cereal, etc.)
3. When you respond about portions, ALWAYS specify "of olive oil" after the fat amount
4. AVOCADO IS A HEALTHY FAT - encourage it!

${isEventClient ? `EVENT IN ${weeksUntilEvent} WEEKS - keep pushing!` : 'Keep crushing it!'}

Ask me anything about specific foods!`;
  }

  // Build dynamic food lists for the evaluation protocol
  const evalProteinExamples = LEAN_PROTEINS.join(', ');
  const evalVegExamples = FIBROUS_VEGETABLES.join(', ');
  const evalStarchExamples = STARCHY_CARBOHYDRATES.join(', ');
  const evalFatExamples = HEALTHY_FATS.join(', ');

  return `You are ALLEN'S AI NUTRITION COACH. You act exactly like Allen would in a text conversation with a client.

⚠️ CRITICAL: Before giving ANY advice, ALWAYS read the MEAL EVALUATION PROTOCOL below and follow it EXACTLY. Check every category in order. Mention ALL missing categories — do not skip any!

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

⚠️ MEAL EVALUATION PROTOCOL — ALWAYS FOLLOW THIS EXACT ORDER ⚠️
When client describes a meal they ate or are eating, you MUST check ALL of these in order:

1. PROTEIN — Is there lean protein? (${evalProteinExamples})
   - Missing → tell them to add ${context.gender === 'male' ? '6oz' : '4oz'} protein
   
2. VEGETABLES — Are there fibrous vegetables? (${evalVegExamples})
   - Missing → tell them to add ${context.gender === 'male' ? '2 cups' : '1-2 cups'} veggies
   
3. STARCH — Is starch present? (${evalStarchExamples})
   - Phase 1: NO starch allowed — if they have starch, tell them to drop it
   - Phase 2: Starch only allowed at breakfast/lunch on Wed/Sat/Sun — if they have starch at wrong meal/day, tell them
   - Phase 4/5: Starch is allowed — if missing, tell them to add ${context.gender === 'male' ? '2 cups' : '1 cup'}
   - Phase 6: Starch is allowed — if missing, tell them to add ${context.gender === 'male' ? '3 cups' : '2 cups'} (Phase 6 allows MORE starch)
   
4. HEALTHY FAT — Is there fat? (${evalFatExamples})
   - Phase 1/2/4/5: Missing → tell them to add ${context.gender === 'male' ? '2 tbsp' : '1 tbsp'} fat
   - Phase 6: Missing → tell them to add ${context.gender === 'male' ? '3 tbsp' : '3 tbsp'} fat (Phase 6 allows MORE fat)
   
5. WATER — Did they mention water?
   - Missing → tell them to drink ${context.gender === 'male' ? '32oz' : '20oz'} water with this meal

⚠️ IMPORTANT: You MUST mention ALL missing categories, not just one! If protein AND fat are missing, mention BOTH. If starch AND water are missing, mention BOTH. Do not pick and choose!

COACHING RULES:
1. If client mentions a meal/food → EVALUATE IT using the MEAL EVALUATION PROTOCOL above
   - Good for their phase? → "Nice! Stay on track"
   - ANY category missing? → mention ALL missing categories
   - Has wrong foods? → tell them to swap
2. If client asks what to eat → Give SPECIFIC NEXT MEAL examples
   - "Next meal: grilled chicken, broccoli, olive oil on the veggies"
3. If client sends photo → Analyze and give feedback using the MEAL EVALUATION PROTOCOL
4. If client asks for motivation → Give 1-2 sentence hype ONLY
5. If client asks about phases/portions → Give the structured plan response above
6. If client asks about anything unrelated to nutrition → "I'm a nutrition coach — I only help with food and fitness!"
7. HEALTHY FATS ARE GOOD — Never tell client to skip or eliminate healthy fats like avocado, olive oil, or nuts. AVOCADO IS A HEALTHY FAT and should be ENCOURAGED in every meal! The fat limit is a MAXIMUM, not a target to minimize. NEVER say "skip the avocado" or "reduce fat" — instead encourage healthy fats!

CLIENT CONTEXT:
- Name: ${context.clientName || 'Client'}
- Phase: ${context.currentPhase} (Phase 1 = no starch, Phase 2 = add starch Wed/Sat/Sun, Phase 4 = maintenance${context.programType !== 'event_ready' && context.programType ? `, Phase 5 = aggressive fat loss with 14-day rotating plan (3-day blocks)${context.currentPhase === 5 && context.phase5Plan ? `, current plan: Day ${getPhase5DayNumber(context.phase5StartDate || '')}: ${context.phase5Plan.find(d => d.day === getPhase5DayNumber(context.phase5StartDate || ''))?.label || 'Unknown'}` : ''}` : ''})
- Gender: ${context.gender} (${context.gender === 'male' ? 'MALE — use MALE portions only' : 'FEMALE — use FEMALE portions only'})
- Goal: ${context.goalWeight}lbs, Started: ${context.startingWeight}lbs, Current: ${context.currentWeight}lbs
${isEventClient ? `- Event in ${weeksUntilEvent} weeks` : ''}

PHASE RULES (for YOUR reference only — give personalized advice for THIS client, not generic phase descriptions):
- Phase 1: ${portions.protein} protein, ${portions.fibrousVegetables} veggies, ${portions.fat} fat, NO starch, NO dairy, NO sugar, ${context.gender === 'male' ? '32oz per meal' : '20oz per meal'} water
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
- Event: ${context.programType === 'event_ready' && context.eventDate ? `In ${Math.ceil((new Date(context.eventDate).getTime() - Date.now()) / (7 * 24 * 60 * 60 * 1000))} weeks` : 'None'}

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
      return 'Phase 4: Maintenance mode — add starch to every meal, weigh Fridays only.';
    case 5:
      return 'Phase 5: Aggressive Fat Loss - 3-day rotating plan. Plan regenerates every 3 days.';
    default:
      return 'Keep following your plan!';
  }
}

// ============================================
// MEAL EVALUATION: extractMealData()
// ============================================

export interface RecognizedItem {
  item: string;
  category: 'protein' | 'vegetable' | 'starch' | 'fat' | 'supplement';
}

export interface PhaseContext {
  phase: number;
  gender: 'male' | 'female';
  programType: string;
  isSnack: boolean;
  mealType?: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  mealDate?: string; // YYYY-MM-DD for Phase 2 day checking
}

export interface MealData {
  recognizedItems: RecognizedItem[];
  unrecognizedItems: string[];
  phaseContext: PhaseContext;
  missingCategories: string[];
  disallowedItems: string[];
  phaseRules: {
    starchAllowed: boolean;
    starchDays?: number[]; // Phase 2: [0, 3, 6] = Sun, Wed, Sat
    starchMealTypes?: string[]; // Phase 2: ['breakfast', 'lunch']
  };
}

/**
 * Split meal description into individual food items.
 * Handles commas, "and", and various separators.
 */
function splitIntoFoodItems(foodDescription: string): string[] {
  // Split on common separators: commas, "and", newlines, semicolons
  const items = foodDescription
    .split(/[,\n;]+|\band\b/i)
    .map(item => item.trim())
    .filter(item => item.length > 0);
  return items;
}

/**
 * Extract structured meal data from a meal description.
 * Uses substring matching (case-insensitive) against food categories.
 */
export function extractMealData(
  foodDescription: string,
  context: CoachContext
): MealData {
  const phase = context.currentPhase;
  const foodLower = foodDescription.toLowerCase();
  const isSnack = context.mealType === 'snack';

  // Split into individual food items for detailed matching
  const foodItems = splitIntoFoodItems(foodDescription);

  const recognizedItems: RecognizedItem[] = [];
  const unrecognizedItems: string[] = [];

  // Track which categories are recognized
  let hasProtein = false;
  let hasVeg = false;
  let hasStarch = false;
  let hasFat = false;
  let hasSupplement = false;

  // SPECIAL CASE: Eggs are BOTH protein AND fat — check at food level first
  // The LEAN_PROTEINS entry is "Eggs (2-3 for men, 1-2 for women)" which doesn't match plain "egg"
  // so we handle eggs specially to recognize them as protein AND fat
  if (foodLower.includes('egg') && !foodLower.includes('eggplant')) {
    hasProtein = true;
    hasFat = true;
  }

  // For each food item, find which category it matches
  for (const item of foodItems) {
    const itemLower = item.toLowerCase();
    let found = false;

    // Check each category using substring matching (case-insensitive)
    // Check protein
    if (!hasProtein) {
      // SPECIAL CASE: Eggs are BOTH protein AND fat — check before general protein loop
      // The LEAN_PROTEINS entry is "Eggs (2-3 for men, 1-2 for women)" which doesn't match plain "egg"
      // so we handle eggs specially to recognize them as protein AND fat
      if (itemLower.includes('egg') && !itemLower.includes('eggplant')) {
        recognizedItems.push({ item, category: 'protein' });
        hasProtein = true;
        found = true;
      } else {
        for (const protein of LEAN_PROTEINS) {
          if (itemLower.includes(protein.toLowerCase())) {
            recognizedItems.push({ item, category: 'protein' });
            hasProtein = true;
            found = true;
            break;
          }
        }
      }
    }

    // Check vegetable
    if (!found && !hasVeg) {
      for (const veg of FIBROUS_VEGETABLES) {
        if (itemLower.includes(veg.toLowerCase())) {
          recognizedItems.push({ item, category: 'vegetable' });
          hasVeg = true;
          found = true;
          break;
        }
      }
    }

    // Check starch
    if (!found && !hasStarch) {
      for (const starch of STARCHY_CARBOHYDRATES) {
        if (itemLower.includes(starch.toLowerCase())) {
          recognizedItems.push({ item, category: 'starch' });
          hasStarch = true;
          found = true;
          break;
        }
      }
    }

    // Check fat
    if (!found && !hasFat) {
      for (const fat of HEALTHY_FATS) {
        if (itemLower.includes(fat.toLowerCase())) {
          recognizedItems.push({ item, category: 'fat' });
          hasFat = true;
          found = true;
          break;
        }
      }
    }

    // Check supplements
    if (!found && !hasSupplement) {
      for (const supp of SUPPLEMENTS) {
        if (itemLower.includes(supp.toLowerCase())) {
          recognizedItems.push({ item, category: 'supplement' });
          hasSupplement = true;
          found = true;
          break;
        }
      }
    }

    // If not found in any category, add to unrecognized
    if (!found) {
      unrecognizedItems.push(item);
    }
  }

  // Also check for unrecognized items by looking for any unmatched
  // food-related words in the description
  // Water check (separate from food categories)
  const waterKeywords = ['water', 'h2o', 'sparkling water', 'mineral water', 'soda water'];
  const hasWater = waterKeywords.some(w => foodLower.includes(w));

  // Determine missing categories
  const missingCategories: string[] = [];
  if (!hasProtein) missingCategories.push('protein');
  if (!hasVeg) missingCategories.push('vegetable');
  if (!hasFat) missingCategories.push('fat');

  // Determine disallowed items based on phase rules
  const disallowedItems: string[] = [];
  let starchAllowed = false;

  // Phase 1: no starch allowed
  if (phase === 1) {
    if (hasStarch) {
      disallowedItems.push(...recognizedItems.filter(i => i.category === 'starch').map(i => i.item));
    }
    starchAllowed = false;
  }
  // Phase 2: starch Wed/Sat/Sun breakfast/lunch only
  else if (phase === 2) {
    starchAllowed = true; // Will be checked at analyze time with mealDate
  }
  // Phase 4, 6: starch allowed every meal
  else if (phase === 4 || phase === 6) {
    starchAllowed = true;
  }
  // Phase 5: depends on rotating sub-phase
  else if (phase === 5) {
    const dayNum = context.phase5StartDate ? getPhase5DayNumber(context.phase5StartDate) : 1;
    const currentDayRule = context.phase5Plan?.find(d => d.day === dayNum);
    const rulePhase = typeToNumericPhase(currentDayRule?.type) || 1;

    if (rulePhase === 1) {
      if (hasStarch) {
        disallowedItems.push(...recognizedItems.filter(i => i.category === 'starch').map(i => i.item));
      }
      starchAllowed = false;
    } else if (rulePhase === 2) {
      starchAllowed = true; // Checked at analyze time
    } else {
      starchAllowed = true;
    }
  }

  // Determine missing categories for starch
  if (!hasStarch && !isSnack) {
    // Starch might be missing (except for Phase 1 and Phase 5 strict days)
    if (phase !== 1 && !(phase === 5)) {
      // Missing starch is not a "missing category" warning - it's optional notice
      // Only add to missing if it was expected but not present
    }
  }

  // Phase rules object
  const phaseRules: MealData['phaseRules'] = {
    starchAllowed,
  };

  if (phase === 2) {
    phaseRules.starchDays = [0, 3, 6]; // Sun, Wed, Sat
    phaseRules.starchMealTypes = ['breakfast', 'lunch'];
  }

  const phaseContext: PhaseContext = {
    phase,
    gender: context.gender,
    programType: context.programType,
    isSnack,
    mealType: context.mealType,
    mealDate: context.mealDate,
  };

  return {
    recognizedItems,
    unrecognizedItems,
    phaseContext,
    missingCategories,
    disallowedItems,
    phaseRules,
  };
}

// ============================================
// PORTION EXTRACTION AND COMPARISON HELPERS
// ============================================

/**
 * Extract portion string from a food item description.
 * Returns the portion text if found, null otherwise.
 * Examples:
 *   "4 oz chicken" -> "4 oz"
 *   "1 tbsp olive oil" -> "1 tbsp"
 *   "2 cups broccoli" -> "2 cups"
 *   "1/2 avocado" -> "1/2"
 *   "grilled chicken" -> null
 */
function extractPortionFromItem(item: string): string | null {
  const portionPatterns = [
    /(\d+\/\d+)\s*(oz|ounce|tbsp|tablespoon|cup|cups|tablespoons|ounces)?/i,  // "1/2 cup", "1/2 oz"
    /(\d+\.?\d*)\s*(oz|ounce|tbsp|tablespoon|cup|cups|tablespoons|ounces)/i,   // "6 oz", "2 cups"
  ];
  
  for (const pattern of portionPatterns) {
    const match = item.match(pattern);
    if (match) {
      // If no unit captured, just return the number
      if (!match[2]) {
        return match[1];
      }
      return match[1] + ' ' + match[2];
    }
  }
  return null;
}

/**
 * Extract portion string from a food item description, looking ONLY before the matched food name.
 * This prevents extracting portions from unrelated foods in compound items.
 * Example: "2 cups asparagus with 1 tablespoon olive oil" with matchedFood="olive oil"
 * -> extracts "1 tablespoon" (from before "olive oil"), not "2 cups" (from asparagus)
 */
function extractPortionBeforeFood(item: string, matchedFood: string): string | null {
  // Find the position of the matched food in the item
  const foodIndex = item.toLowerCase().indexOf(matchedFood.toLowerCase());
  if (foodIndex === -1) {
    // Fallback to original behavior if food not found
    return extractPortionFromItem(item);
  }
  
  // Get the portion of the string BEFORE the matched food
  const textBeforeFood = item.substring(0, foodIndex);
  console.log('[DEBUG extractPortionBeforeFood] item:', item, 'matchedFood:', matchedFood, 'textBeforeFood:', textBeforeFood);
  
  // Now search for portion patterns in the text BEFORE the food
  const portionPatterns = [
    /(\d+\/\d+)\s*(oz|ounce|tbsp|tablespoon|cup|cups|tablespoons|ounces)?/i,  // "1/2 cup", "1/2 oz"
    /(\d+\.?\d*)\s*(oz|ounce|tbsp|tablespoon|cup|cups|tablespoons|ounces)/i,   // "6 oz", "2 cups"
  ];
  
  // Find the LAST portion pattern in the text before the food
  // (since the portion for the food is most likely immediately before it)
  let lastMatch: string | null = null;
  
  for (const pattern of portionPatterns) {
    const match = textBeforeFood.match(pattern);
    console.log('[DEBUG extractPortionBeforeFood] pattern:', pattern, 'match:', match);
    if (match) {
      // If no unit captured, just return the number
      if (!match[2]) {
        lastMatch = match[1];
      } else {
        lastMatch = match[1] + ' ' + match[2];
      }
      console.log('[DEBUG extractPortionBeforeFood] lastMatch updated to:', lastMatch);
    }
  }
  
  console.log('[DEBUG extractPortionBeforeFood] returning:', lastMatch);
  return lastMatch;
}

/**
 * Parse a portion value string into a numeric value.
 * Handles fractions like "1/2", "3/4", and decimals like "6", "2.5"
 */
function parsePortionValue(portion: string): number {
  const fractionMap: Record<string, number> = {
    '1/2': 0.5, '1/4': 0.25, '3/4': 0.75,
    '1/3': 0.333, '2/3': 0.667,
    '1/8': 0.125, '3/8': 0.375, '5/8': 0.625, '7/8': 0.875
  };
  
  const lower = portion.toLowerCase().trim();
  
  // Check fraction map first
  if (fractionMap[lower] !== undefined) {
    return fractionMap[lower];
  }
  
  // Try to parse as number
  const num = parseFloat(lower);
  if (!isNaN(num)) {
    return num;
  }
  
  return 0;
}

/**
 * Normalize a portion unit to a standard form.
 * "ounces" -> "oz", "tablespoons" -> "tbsp", etc.
 */
function normalizePortionUnit(unit: string): string {
  const unitMap: Record<string, string> = {
    'ounce': 'oz',
    'ounces': 'oz',
    'oz': 'oz',
    'tablespoon': 'tbsp',
    'tablespoons': 'tbsp',
    'tbsp': 'tbsp',
    'cup': 'cup',
    'cups': 'cup'
  };
  return unitMap[unit.toLowerCase()] || unit.toLowerCase();
}

/**
 * Compare a stated portion to a required portion.
 * Returns true if they match (within tolerance), false otherwise.
 */
function compareStatedPortionToRequired(
  statedPortion: string,
  requiredPortion: string
): boolean {
  // Parse stated portion: "6 oz" -> value=6, unit="oz"
  const statedMatch = statedPortion.match(/^([\d.\/]+)\s*(\S+)?$/);
  console.log('[DEBUG compareStatedPortionToRequired] statedPortion:', statedPortion, 'statedMatch:', statedMatch);
  if (!statedMatch) {
    console.log('[DEBUG compareStatedPortionToRequired] no statedMatch, returning false');
    return false;
  }
  
  const statedValue = parsePortionValue(statedMatch[1]);
  const statedUnit = statedMatch[2] ? normalizePortionUnit(statedMatch[2]) : '';
  console.log('[DEBUG compareStatedPortionToRequired] statedValue:', statedValue, 'statedUnit:', statedUnit);
  
  // Parse required portion: "6 ounces" -> value=6, unit="ounces"
  const requiredMatch = requiredPortion.match(/^([\d.\/]+)\s*(\S+)?$/);
  console.log('[DEBUG compareStatedPortionToRequired] requiredPortion:', requiredPortion, 'requiredMatch:', requiredMatch);
  if (!requiredMatch) {
    console.log('[DEBUG compareStatedPortionToRequired] no requiredMatch, returning false');
    return false;
  }
  
  const requiredValue = parsePortionValue(requiredMatch[1]);
  const requiredUnit = requiredMatch[2] ? normalizePortionUnit(requiredMatch[2]) : '';
  console.log('[DEBUG compareStatedPortionToRequired] requiredValue:', requiredValue, 'requiredUnit:', requiredUnit);
  
  // Same unit - direct comparison with tolerance
  if (statedUnit === requiredUnit && statedUnit !== '') {
    const result = Math.abs(statedValue - requiredValue) < 0.15;
    console.log('[DEBUG compareStatedPortionToRequired] same unit comparison:', statedValue, 'vs', requiredValue, 'diff:', Math.abs(statedValue - requiredValue), 'result:', result);
    return result;
  }
  
  // Special case: oz and tbsp are interchangeable for fat (1 oz ≈ 2 tbsp)
  // Phase 6 fat = 3 tbsp = 1.5 oz (but we use tbsp directly)
  // So we don't do oz<->tbsp conversion for fat
  
  // Same unit (non-converting units like cups)
  if (statedUnit === requiredUnit && statedUnit !== '') {
    const result = Math.abs(statedValue - requiredValue) < 0.15;
    console.log('[DEBUG compareStatedPortionToRequired] same unit comparison (2):', statedValue, 'vs', requiredValue, 'diff:', Math.abs(statedValue - requiredValue), 'result:', result);
    return result;
  }
  
  // Fallback: compare numeric values with tolerance
  if (statedUnit === '' || requiredUnit === '') {
    const result = Math.abs(statedValue - requiredValue) < 0.5;
    console.log('[DEBUG compareStatedPortionToRequired] fallback comparison:', statedValue, 'vs', requiredValue, 'diff:', Math.abs(statedValue - requiredValue), 'result:', result);
    return result;
  }
  
  console.log('[DEBUG compareStatedPortionToRequired] units dont match, returning false');
  return false;
}

/**
 * Check if a recognized food item has a wrong portion stated.
 * Returns a correction message if the portion is wrong, null otherwise.
 * 
 * RULES:
 * 1. If NO portion stated -> assume correct, return null
 * 2. If portion stated AND wrong -> return correction message
 * 3. If portion stated AND correct -> return null
 */
function checkItemPortionCorrection(
  item: string,
  category: 'protein' | 'vegetable' | 'starch' | 'fat',
  portions: { protein: string; fibrousVegetables: string; fat: string; starch: string },
  gender: 'male' | 'female',
  matchedFood?: string  // NEW: the specific food that was matched
): string | null {
  console.log('[DEBUG checkItemPortionCorrection] item:', item, 'category:', category, 'matchedFood:', matchedFood);
  // Extract portion - if we know the matched food, only look for portions before it
  const statedPortion = matchedFood 
    ? extractPortionBeforeFood(item, matchedFood)
    : extractPortionFromItem(item);
  console.log('[DEBUG checkItemPortionCorrection] statedPortion:', statedPortion);
  if (!statedPortion) {
    console.log('[DEBUG checkItemPortionCorrection] no statedPortion, returning null (Rule 1: No portion stated = assume correct)');
    return null; // Rule 1: No portion stated = assume correct
  }
  
  // Get required portion for this category
  let requiredPortion: string;
  let categoryLabel: string;
  
  switch (category) {
    case 'protein':
      requiredPortion = portions.protein; // "6 ounces" or "4 ounces"
      categoryLabel = 'lean protein';
      break;
    case 'vegetable':
      requiredPortion = portions.fibrousVegetables; // "2 cups" or "1-2 cups"
      categoryLabel = 'fibrous vegetables';
      break;
    case 'starch':
      requiredPortion = portions.starch; // "2 cups" or "3 cups" (Phase 6 male)
      categoryLabel = 'starchy carbohydrates';
      break;
    case 'fat':
      requiredPortion = portions.fat; // "2 tablespoons" or "3 tablespoons" (Phase 6)
      categoryLabel = 'healthy fats';
      break;
    default:
      return null;
  }
  
  console.log('[DEBUG checkItemPortionCorrection] requiredPortion:', requiredPortion, 'categoryLabel:', categoryLabel);
  
  // Compare stated vs required
  const isCorrect = compareStatedPortionToRequired(statedPortion, requiredPortion);
  console.log('[DEBUG checkItemPortionCorrection] isCorrect:', isCorrect);
  
  if (isCorrect) {
    console.log('[DEBUG checkItemPortionCorrection] isCorrect=true, returning null (Rule 3: Portion stated and correct - no correction)');
    return null; // Rule 3: Portion stated and correct - no correction
  }
  
  // Rule 2: Portion stated and WRONG - return correction
  // Format the correction message with the required portion
  const correction = `You need ${requiredPortion} ${categoryLabel}`;
  console.log('[DEBUG checkItemPortionCorrection] returning correction:', correction);
  return correction;
}

// ============================================
// MEAL EVALUATION: Modified analyzeMealPortion()
// ============================================

/**
 * Modified analyzeMealPortion returns structured data with all fields
 * as described in the SPEC.
 */
export async function analyzeMealPortion(
  foodDescription: string | undefined | null,
  context: CoachContext,
  mealType?: string
): Promise<{
  hasProtein: boolean;
  hasVeg: boolean;
  hasStarch: boolean;
  hasFat: boolean;
  hasWater: boolean;
  hasSupplement: boolean;
  unrecognizedItems: string[];
  missingCategories: string[];
  disallowedItems: string[];
  portionAdvice: string;
  onPhase: boolean;
  corrections: string[];
}> {
  console.log('[DEBUG analyzeMealPortion] START');
  console.log('[DEBUG analyzeMealPortion] foodDescription:', foodDescription);
  console.log('[DEBUG analyzeMealPortion] context:', JSON.stringify(context));
  console.log('[DEBUG analyzeMealPortion] mealType:', mealType);
  
  // Defensive: ensure foodDescription is a valid non-empty string
  if (!foodDescription || typeof foodDescription !== 'string' || foodDescription.trim().length === 0) {
    return {
      hasProtein: false,
      hasVeg: false,
      hasStarch: false,
      hasFat: false,
      hasWater: false,
      hasSupplement: false,
      unrecognizedItems: [],
      missingCategories: [],
      disallowedItems: [],
      portionAdvice: 'Please describe what you are eating so I can give you portion advice.',
      onPhase: false,
      corrections: [],
    };
  }

  // Ensure corrections cache is loaded
  await ensureCacheLoaded();

  const portions = getPortions(context.gender, context.currentPhase);
  console.log('[DEBUG analyzeMealPortion] portions:', JSON.stringify(portions));
  const isSnack = mealType === 'snack' || context.mealType === 'snack';
  const foodLower = foodDescription.toLowerCase();
  const phase = context.currentPhase;
  console.log('[DEBUG analyzeMealPortion] phase:', phase, 'gender:', context.gender, 'isSnack:', isSnack);

  // =============================================
  // SNACK LOGIC
  // =============================================
  if (isSnack) {
    const snackCheck = isSnackAllowed(foodDescription, context.currentPhase);
    if (!snackCheck.allowed) {
      const disallowedMsg = `⚠️ ${foodDescription} is not allowed in Phase ${context.currentPhase}!`;
      const waterReminder = getWaterReminder(context.gender);
      return {
        hasProtein: false,
        hasVeg: false,
        hasStarch: false,
        hasFat: false,
        hasWater: false,
        hasSupplement: false,
        unrecognizedItems: [foodDescription],
        missingCategories: [],
        disallowedItems: [foodDescription],
        portionAdvice: `${disallowedMsg} ${waterReminder}`,
        onPhase: false,
        corrections: [disallowedMsg, waterReminder],
      };
    }
    // Snacks: partial is fine, just check for violations
    // Run basic food matching to detect any disallowed items
    let hasProtein = false;
    let hasVeg = false;
    let hasStarch = false;
    let hasFat = false;
    let hasSupplement = false;
    const unrecognizedItems: string[] = [];
    const disallowedItems: string[] = [];

    // SPECIAL CASE: Eggs are BOTH protein AND fat
    if (foodLower.includes('egg') && !foodLower.includes('eggplant')) {
      hasProtein = true;
      hasFat = true;
    }
    for (const protein of LEAN_PROTEINS) {
      if (foodLower.includes(protein.toLowerCase())) { hasProtein = true; break; }
    }
    for (const veg of FIBROUS_VEGETABLES) {
      if (foodLower.includes(veg.toLowerCase())) { hasVeg = true; break; }
    }
    for (const starch of STARCHY_CARBOHYDRATES) {
      if (foodLower.includes(starch.toLowerCase())) { hasStarch = true; break; }
    }
    for (const fat of HEALTHY_FATS) {
      if (foodLower.includes(fat.toLowerCase())) { hasFat = true; break; }
    }
    for (const supp of SUPPLEMENTS) {
      if (foodLower.includes(supp.toLowerCase())) { hasSupplement = true; break; }
    }

    const waterReminder = getWaterReminder(context.gender);
    return {
      hasProtein,
      hasVeg,
      hasStarch,
      hasFat,
      hasWater: false,
      hasSupplement,
      unrecognizedItems,
      missingCategories: [],
      disallowedItems,
      portionAdvice: `Looks good! ${waterReminder}`,
      onPhase: true,
      corrections: [waterReminder],
    };
  }

  // =============================================
  // MATCH FOODS TO CATEGORIES
  // =============================================
  let hasProtein = false;
  let hasVeg = false;
  let hasStarch = false;
  let hasFat = false;
  let hasSupplement = false;
  const unrecognizedItems: string[] = [];

  // Check corrections cache for full food description first
  const fullCorrection = getCorrection(foodDescription.toLowerCase().trim());
  if (fullCorrection) {
    if (fullCorrection.correctCategory === 'protein') hasProtein = true;
    else if (fullCorrection.correctCategory === 'vegetable') hasVeg = true;
    else if (fullCorrection.correctCategory === 'starch') hasStarch = true;
    else if (fullCorrection.correctCategory === 'fat') hasFat = true;
  } else {
    // Check each word in the food description for corrections
    const words = foodDescription.toLowerCase().split(/[\s,]+/).filter(w => w.length > 2);
    for (const word of words) {
      const wordCorrection = getCorrection(word);
      if (wordCorrection) {
        if (wordCorrection.correctCategory === 'protein') hasProtein = true;
        else if (wordCorrection.correctCategory === 'vegetable') hasVeg = true;
        else if (wordCorrection.correctCategory === 'starch') hasStarch = true;
        else if (wordCorrection.correctCategory === 'fat') hasFat = true;
      }
    }

    // SPECIAL CASE: Eggs are BOTH protein AND fat — check before general protein loop
    // The LEAN_PROTEINS entry is "Eggs (2-3 for men, 1-2 for women)" which doesn't match plain "egg"
    // so we handle eggs specially to recognize them as protein AND fat
    if (foodLower.includes('egg') && !foodLower.includes('eggplant')) {
      hasProtein = true;
      hasFat = true;
    }

    // Match against food lists using substring matching
    for (const protein of LEAN_PROTEINS) {
      if (foodLower.includes(protein.toLowerCase())) { hasProtein = true; break; }
    }
    for (const veg of FIBROUS_VEGETABLES) {
      if (foodLower.includes(veg.toLowerCase())) { hasVeg = true; break; }
    }
    for (const starch of STARCHY_CARBOHYDRATES) {
      if (foodLower.includes(starch.toLowerCase())) { hasStarch = true; break; }
    }
    for (const fat of HEALTHY_FATS) {
      if (foodLower.includes(fat.toLowerCase())) { hasFat = true; break; }
    }
    for (const supp of SUPPLEMENTS) {
      if (foodLower.includes(supp.toLowerCase())) { hasSupplement = true; break; }
    }
  }

  // Build unrecognized items list
  const foodItems = splitIntoFoodItems(foodDescription);
  for (const item of foodItems) {
    const itemLower = item.toLowerCase();
    let found = false;
    // Special case: eggs are recognized as both protein AND fat
    if (itemLower.includes('egg') && !itemLower.includes('eggplant')) { found = true; }
    if (!found) for (const protein of LEAN_PROTEINS) { if (itemLower.includes(protein.toLowerCase())) { found = true; break; } }
    if (!found) for (const veg of FIBROUS_VEGETABLES) { if (itemLower.includes(veg.toLowerCase())) { found = true; break; } }
    if (!found) for (const starch of STARCHY_CARBOHYDRATES) { if (itemLower.includes(starch.toLowerCase())) { found = true; break; } }
    if (!found) for (const fat of HEALTHY_FATS) { if (itemLower.includes(fat.toLowerCase())) { found = true; break; } }
    if (!found) for (const supp of SUPPLEMENTS) { if (itemLower.includes(supp.toLowerCase())) { found = true; break; } }
    if (!found) unrecognizedItems.push(item);
  }

  // =============================================
  // WATER TRACKING
  // =============================================
  const waterKeywords = ['water', 'h2o', 'drank', 'drinking', 'hydrate', 'hydration', 'sparkling water', 'mineral water', 'soda water', 'glass of water', 'bottle of water', 'cup of water'];
  const hasWater = waterKeywords.some(w => foodLower.includes(w));
  const coffeeKeywords = ['coffee', 'cafe', 'espresso', 'latte', 'cappuccino', 'mocha', 'americano'];
  const hasCoffee = coffeeKeywords.some(c => foodLower.includes(c));

  let loggedWaterOz = 0;
  if (hasWater) {
    // Find all "X oz" matches in the string, then pick the one closest to or after the word "water"
    // This fixes the bug where "6oz steak, 32 oz water" would incorrectly grab "6" from the steak
    const allMatches = Array.from(foodDescription.matchAll(/(\d+)\s*(?:oz|ounces?|oz\.)/gi));
    if (allMatches.length > 0) {
      const waterIndex = foodLower.indexOf('water');
      // Find the first match that appears at or after the water keyword
      // (since in "32 oz water", the number comes before the word)
      const waterMatch = allMatches.find(m => m.index !== undefined && m.index >= waterIndex - 5)
                     || allMatches[allMatches.length - 1];
      if (waterMatch) loggedWaterOz = parseInt(waterMatch[1], 10);
    }
  }

  const baseWaterOz = context.gender === 'male' ? 128 : 80;
  const todayCoffee = context.todayCoffeeIntake || 0;
  const todayWater = context.todayWaterIntake || 0;
  const mealsLogged = context.mealsLoggedToday || 0;
  const totalWaterNeeded = baseWaterOz + todayCoffee;
  const effectiveTodayWater = todayWater + loggedWaterOz;
  const remainingMeals = Math.max(1, 3 - mealsLogged);
  const remainingWater = Math.max(0, totalWaterNeeded - effectiveTodayWater);
  const waterPerMeal = remainingMeals > 0 ? Math.round((remainingWater / remainingMeals) * 10) / 10 : 0;

  let waterTrackingMessage = '';
  if (hasWater) {
    if (loggedWaterOz > 0) {
      waterTrackingMessage = waterPerMeal > 0
        ? `💧 Water tracked: ${loggedWaterOz}oz logged. You need ${waterPerMeal}oz water per remaining meal today.`
        : `💧 Great job staying hydrated! ${loggedWaterOz}oz logged - you're on track with water today!`;
    } else {
      waterTrackingMessage = waterPerMeal > 0
        ? `💧 Water tracked. You need ${waterPerMeal}oz water per remaining meal today.`
        : `💧 Great job staying hydrated! You're on track with water today.`;
    }
  } else if (hasCoffee) {
    const coffeeOz = 8;
    const adjustedTotal = totalWaterNeeded + coffeeOz;
    const newRemaining = Math.max(0, adjustedTotal - todayWater);
    const newWaterPerMeal = Math.round((newRemaining / remainingMeals) * 10) / 10;
    waterTrackingMessage = `☕ Coffee counts toward fluids, but you still need water. You need ${newWaterPerMeal}oz water per remaining meal (includes coffee adjustment).`;
  } else {
    if (todayWater > 0) {
      const shortFall = Math.round((totalWaterNeeded - todayWater) * 10) / 10;
      waterTrackingMessage = `💧 You're ${shortFall}oz short on water today. You need ${waterPerMeal}oz water per remaining meal.`;
    } else {
      waterTrackingMessage = `💧 You need ${waterPerMeal}oz water per meal. Aim for ${totalWaterNeeded}oz total daily (${baseWaterOz}oz base + ${todayCoffee}oz coffee adjustment).`;
    }
  }

  // =============================================
  // PHASE-BASED STARCH RULES
  // =============================================
  const corrections: string[] = [];
  const disallowedItems: string[] = [];
  const missingCategories: string[] = [];
  let onPhase = true;

  // Water check - per meal requirement: 32oz for men, 20oz for women
  const waterRequired = context.gender === 'male' ? 32 : 20;
  if (loggedWaterOz < waterRequired) {
    missingCategories.push('water');
  }

  // Phase 1: NO starch allowed
  if (phase === 1) {
    if (hasStarch) {
      // Find which RECOGNIZED starch items from STARCHY_CARBOHYDRATES are in the food
      // Only add recognized starch - don't auto-flag unrecognized items
      // Unrecognized items are reported separately to AI for interpretation
      const foundStarchItems = STARCHY_CARBOHYDRATES.filter(starch => foodLower.includes(starch.toLowerCase()));
      disallowedItems.push(...foundStarchItems);
      corrections.push(`⚠️ Phase 1 - NO starch! Skip the starch completely.`);
      onPhase = false;
    }
  }
  // Phase 2: Starch allowed Wed/Sat/Sun breakfast/lunch ONLY
  else if (phase === 2 && hasStarch) {
    const isBreakfastOrLunch = mealType === 'breakfast' || mealType === 'lunch' || context.mealType === 'breakfast' || context.mealType === 'lunch';
    const isDinnerOrSnack = mealType === 'dinner' || mealType === 'snack' || context.mealType === 'dinner' || context.mealType === 'snack';

    if (isDinnerOrSnack) {
      corrections.push(`⚠️ Phase 2 - NO starch for ${mealType || context.mealType || 'this meal'}! Only breakfast and lunch get starch in Phase 2. Skip the starch.`);
      onPhase = false;
    } else if (context.mealDate) {
      const mealDateObj = new Date(context.mealDate + 'T12:00:00');
      const dayOfWeek = mealDateObj.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
      const allowedDays = [0, 3, 6]; // Sun (0), Wed (3), Sat (6)

      if (!allowedDays.includes(dayOfWeek)) {
        corrections.push(`⚠️ Phase 2 - starch only allowed on Wed, Sat, Sun. No starch today. Remove it or swap for extra veg.`);
        onPhase = false;
      } else if ((context.mealsLoggedToday || 0) >= 2) {
        corrections.push(`⚠️ Phase 2 - starch only in first 2 meals. You've had ${context.mealsLoggedToday} meals today. Skip the starch.`);
        onPhase = false;
      }
    } else {
      corrections.push(`⚠️ Phase 2 - starch only allowed on Wed, Sat, Sun. Check if today is an allowed day before eating starch.`);
      onPhase = false;
    }
  }
  // Phase 5: Uses 3-day rotating rules (applies to ALL Phase 5 clients including event_ready)
  else if (phase === 5 && hasStarch) {
    const dayNum = context.phase5StartDate ? getPhase5DayNumber(context.phase5StartDate) : 1;
    const currentDayRule = context.phase5Plan?.find(d => d.day === dayNum);
    const rulePhase = typeToNumericPhase(currentDayRule?.type) || 1;

    if (rulePhase === 1) {
      // Find which RECOGNIZED starch items from STARCHY_CARBOHYDRATES are in the food
      // Only add recognized starch - don't auto-flag unrecognized items
      const foundStarchItems = STARCHY_CARBOHYDRATES.filter(starch => foodLower.includes(starch.toLowerCase()));
      disallowedItems.push(...foundStarchItems);
      corrections.push(`⚠️ Phase 5 Day ${dayNum} (strict phase) - NO starch! Skip the starch completely.`);
      onPhase = false;
    } else if (rulePhase === 2) {
      const isBreakfastOrLunch = mealType === 'breakfast' || mealType === 'lunch' || context.mealType === 'breakfast' || context.mealType === 'lunch';
      const isDinnerOrSnack = mealType === 'dinner' || mealType === 'snack' || context.mealType === 'dinner' || context.mealType === 'snack';

      if (isDinnerOrSnack) {
        corrections.push(`⚠️ Phase 5 Day ${dayNum} - starch allowed at breakfast & lunch ONLY. No starch at ${mealType || context.mealType}! Skip the starch.`);
        onPhase = false;
      }
    }
  }
  // Phase 6: starch allowed every meal (tortillas now allowed)
  if (phase === 6) {
    // No restrictions on tortillas in Phase 6
  }

  // =============================================
  // CHECK STATED PORTIONS
  // =============================================
  // For each recognized food item, check if the stated portion is correct
  // RULES:
  // - If NO portion stated -> assume correct (no correction)
  // - If portion stated AND wrong -> add correction
  // - If portion stated AND correct -> no correction
  // 
  // IMPORTANT: Check ALL categories for each food item, not just the first match!
  // For compound items like "2 cups asparagus with 1 tablespoon olive oil",
  // we need to check BOTH the vegetable portion (asparagus) AND the fat portion (olive oil).
  for (const item of foodItems) {
    const itemLower = item.toLowerCase();
    
    // Collect all matched categories for this item
    interface MatchedCategory {
      category: 'protein' | 'vegetable' | 'starch' | 'fat';
      matchedFood: string;
    }
    const matchedCategories: MatchedCategory[] = [];
    
    // Special case: eggs are both protein AND fat
    if (itemLower.includes('egg') && !itemLower.includes('eggplant')) {
      matchedCategories.push({ category: 'protein', matchedFood: 'egg' });
      matchedCategories.push({ category: 'fat', matchedFood: 'egg' });
    } else {
      // Check each category and collect ALL matches
      // Don't break early - we need to find ALL foods in this item
      
      // Check protein
      for (const protein of LEAN_PROTEINS) {
        if (itemLower.includes(protein.toLowerCase())) {
          matchedCategories.push({ category: 'protein', matchedFood: protein });
          // Don't break - there might be other foods too
        }
      }
      
      // Check vegetable
      for (const veg of FIBROUS_VEGETABLES) {
        if (itemLower.includes(veg.toLowerCase())) {
          matchedCategories.push({ category: 'vegetable', matchedFood: veg });
        }
      }
      
      // Check starch
      for (const starch of STARCHY_CARBOHYDRATES) {
        if (itemLower.includes(starch.toLowerCase())) {
          matchedCategories.push({ category: 'starch', matchedFood: starch });
        }
      }
      
      // Check fat
      for (const fat of HEALTHY_FATS) {
        if (itemLower.includes(fat.toLowerCase())) {
          matchedCategories.push({ category: 'fat', matchedFood: fat });
        }
      }
    }
    
    // For each matched category, check if the portion is wrong
    for (const match of matchedCategories) {
      console.log('[DEBUG analyzeMealPortion] checking item:', item, 'category:', match.category, 'matchedFood:', match.matchedFood);
      const portionCorrection = checkItemPortionCorrection(
        item, 
        match.category, 
        portions, 
        context.gender, 
        match.matchedFood
      );
      console.log('[DEBUG analyzeMealPortion] portionCorrection:', portionCorrection);
      if (portionCorrection) {
        console.log('[DEBUG analyzeMealPortion] ADDING correction to array:', `💡 ${portionCorrection}`);
        corrections.push(`💡 ${portionCorrection}`);
        onPhase = false;
      }
    }
  }

  // =============================================
  // CHECK MISSING CATEGORIES
  // =============================================

  if (phase === 6) {
    if (!hasProtein) {
      missingCategories.push('protein');
      corrections.push(`💡 You need ${context.gender === 'male' ? '6oz' : '4oz'} lean protein.`);
    }
    if (!hasVeg) {
      missingCategories.push('vegetable');
      corrections.push(`💡 You need ${context.gender === 'male' ? '2 cups' : '1-2 cups'} fibrous vegetables.`);
    }
    if (!hasFat) {
      missingCategories.push('fat');
      corrections.push(`💡 You need ${context.gender === 'male' ? '3 tbsp' : '2 tbsp'} olive oil or healthy fat for Phase 6.`);
    }
    if (!hasStarch) {
      missingCategories.push('starch');
      const starchAmount = context.gender === 'male' ? '3 cups' : '2 cups';
      corrections.push(`💡 You need ${starchAmount} rice, potato, or sweet potato.`);
    }
  } else if (phase === 1 || phase === 2 || phase === 5) {
    // Phase 5 uses rotating rules - determine if today is a strict day
    let rulePhase = phase;
    if (phase === 5) {
      const dayNum = context.phase5StartDate ? getPhase5DayNumber(context.phase5StartDate) : 1;
      const currentDayRule = context.phase5Plan?.find(d => d.day === dayNum);
      rulePhase = typeToNumericPhase(currentDayRule?.type) || 1;
    }

    // Strict phases (Phase 1, Phase 2, Phase 5 strict days) require all categories
    const isStrictPhase = rulePhase === 1 || rulePhase === 2;

    if (isStrictPhase) {
      if (!hasProtein) {
        missingCategories.push('protein');
        corrections.push(`💡 You need ${portions.protein} lean protein.`);
      }
      if (!hasVeg) {
        missingCategories.push('vegetable');
        corrections.push(`💡 You need ${portions.fibrousVegetables} fibrous vegetables.`);
      }
      if (!hasFat) {
        missingCategories.push('fat');
        corrections.push(`💡 You need ${portions.fat} olive oil or ${portions.avocado} avocado for healthy fat.`);
      }
    }
  } else if (phase === 4) {
    // Phase 4 maintenance: ALL 4 categories (protein, veg, fat, starch) required to be "on phase"
    // Starch is REQUIRED in Phase 4 - every meal must have starch
    if (!hasProtein) {
      missingCategories.push('protein');
      corrections.push(`💡 Notice: Consider adding some lean protein to round out your meal.`);
    }
    if (!hasVeg) {
      missingCategories.push('vegetable');
      corrections.push(`💡 Notice: Adding some fibrous vegetables would be great for your meal.`);
    }
    if (!hasFat) {
      missingCategories.push('fat');
      corrections.push(`💡 Notice: Don't forget healthy fat like olive oil, avocado, or nuts. Stay hydrated with water too!`);
    }
    if (!hasStarch) {
      // Starch is REQUIRED in Phase 4 - every meal needs starch
      missingCategories.push('starch');
      corrections.push(`💡 Phase 4 requires starch every meal — add ${context.gender === 'male' ? '2 cups' : '1 cup'} rice, potato, or sweet potato.`);
      onPhase = false; // Missing required starch = off phase
    }
  }

  // =============================================
  // BUILD RESPONSE
  // =============================================
  let portionAdvice: string;

  if (corrections.length === 0) {
    if (phase === 4) {
      portionAdvice = waterPerMeal > 0
        ? `🎉 You're at goal and maintaining! Keep eating healthy. ${waterTrackingMessage} You've got this! 💪`
        : `🎉 You're at goal and maintaining! Keep eating healthy. Great job staying hydrated! 💪`;
    } else {
      portionAdvice = waterPerMeal > 0
        ? `Looks good! ${waterTrackingMessage} You've got this! 👊`
        : `Looks good! Great job staying hydrated! 👊`;
    }
  } else {
    // Only append water reminder if water is actually missing or below requirement
    const waterRequired = context.gender === 'male' ? 32 : 20;
    if (loggedWaterOz < waterRequired) {
      const waterReminder = getWaterReminder(context.gender);
      portionAdvice = corrections.join('\n') + '\n' + waterReminder;
    } else {
      portionAdvice = corrections.join('\n');
    }
  }

  console.log('[DEBUG analyzeMealPortion] FINAL corrections array:', corrections);
  console.log('[DEBUG analyzeMealPortion] FINAL missingCategories:', missingCategories);
  console.log('[DEBUG analyzeMealPortion] FINAL disallowedItems:', disallowedItems);
  console.log('[DEBUG analyzeMealPortion] FINAL hasFat:', hasFat);
  console.log('[DEBUG analyzeMealPortion] END');

  return {
    hasProtein,
    hasVeg,
    hasStarch,
    hasFat,
    hasWater,
    hasSupplement,
    unrecognizedItems,
    missingCategories,
    disallowedItems,
    portionAdvice,
    onPhase,
    corrections,
  };
}

// ============================================
// MEAL EVALUATION: getMealEvaluationPrompt()
// ============================================

/**
 * Generate a SHORT coaching prompt for meal feedback — NO chain-of-thought.
 * The prompt describes what was eaten and phase rules, then gets out of the way.
 */
export function getMealEvaluationPrompt(
  mealData: MealData,
  analysis: {
    hasProtein: boolean; hasVeg: boolean; hasStarch: boolean;
    hasFat: boolean; hasWater: boolean; hasSupplement: boolean;
    unrecognizedItems: string[]; missingCategories: string[];
    disallowedItems: string[]; onPhase: boolean; corrections: string[];
  },
  context: CoachContext
): string {
  const { currentPhase: phase, gender } = context;
  const isSnack = context.mealType === 'snack';
  const m = gender === 'male';
  const portions = getPortions(gender, phase);

  // Phase rules (one line each)
  const phaseRules: Record<number, string> = {
    1: 'NO starch — protein, veggies, fat only',
    2: 'Starch only Wed/Sat/Sun breakfast & lunch',
    4: 'Starch every meal — maintenance',
    5: `Phase 5 — rotating 3-day blocks`,
    6: 'Starch every meal — Phase 6',
  };

  // Build the prompt - report ALL 5 categories as YES/NO, let AI format in Allen's voice
  let p = `ALLEN'S AI COACH — ${(context.mealType || 'meal').toUpperCase()} FEEDBACK\n`;
  p += `Client: ${context.clientName || 'Client'} | Phase ${phase} | ${gender}\n`;
  p += `Rule: ${phaseRules[phase] || ''}\n\n`;

  // Report ALL 5 categories as YES/NO - don't filter, just report what was detected
  p += `CATEGORIES DETECTED:\n`;
  p += `Protein: ${analysis.hasProtein ? 'YES' : 'NO'}\n`;
  p += `Veggies: ${analysis.hasVeg ? 'YES' : 'NO'}\n`;
  p += `Starch: ${analysis.hasStarch ? 'YES' : 'NO'}\n`;
  p += `Fat: ${analysis.hasFat ? 'YES' : 'NO'}\n`;
  p += `Water: ${analysis.hasWater ? 'YES' : 'NO'}\n\n`;

  // What they ate (list recognized items by category)
  const proteinItems = mealData.recognizedItems.filter(i => i.category === 'protein').map(i => i.item);
  const vegItems = mealData.recognizedItems.filter(i => i.category === 'vegetable').map(i => i.item);
  const starchItems = mealData.recognizedItems.filter(i => i.category === 'starch').map(i => i.item);
  const fatItems = mealData.recognizedItems.filter(i => i.category === 'fat').map(i => i.item);

  p += `RECOGNIZED FOODS:\n`;
  if (proteinItems.length) p += `Protein: ${proteinItems.join(', ')}\n`;
  if (vegItems.length) p += `Veggies: ${vegItems.join(', ')}\n`;
  if (starchItems.length) p += `Starch: ${starchItems.join(', ')}\n`;
  if (fatItems.length) p += `Fat: ${fatItems.join(', ')}\n`;

  // Unrecognized items - flag but don't automatically make meal off phase
  if (analysis.unrecognizedItems.length > 0) {
    p += `\nUNRECOGNIZED (use your judgment): ${analysis.unrecognizedItems.join(', ')}\n`;
  }

  // REMOVE section - disallowed items (Phase 1 with starch present, etc.)
  if (analysis.disallowedItems.length > 0) {
    p += `\n⚠️ REMOVE: ${analysis.disallowedItems.join(', ')}\n`;
  }

  // CORRECTIONS section - portion corrections (e.g., "You need 2 tablespoons healthy fats" for wrong fat amount)
  // These come from checkItemPortionCorrection when the stated portion doesn't match required portion
  if (analysis.corrections && analysis.corrections.length > 0) {
    p += `\n💡 PORTION CORRECTIONS (include these EXACTLY in your response):\n`;
    for (const correction of analysis.corrections) {
      p += `- "${correction.replace(/^💡\s*/, '')}"\n`;
    }
  }

  // MISSING section - required categories not present (Phase 4 missing starch, etc.)
  // IMPORTANT: Use EXACT format "You need X" so AI cannot misinterpret portions
  if (!isSnack && analysis.missingCategories.length > 0) {
    p += `\nMISSING — Quote these EXACTLY in your response (do NOT change the food or amount):\n`;
    if (analysis.missingCategories.includes('protein')) p += `- "You need ${m ? '6oz' : '4oz'} lean protein"\n`;
    if (analysis.missingCategories.includes('vegetable')) p += `- "You need ${m ? '2 cups' : '1-2 cups'} fibrous vegetables"\n`;
    if (analysis.missingCategories.includes('starch')) p += `- "You need ${portions.starch} rice" OR "You need ${portions.starch} potato" OR "You need ${portions.starch} sweet potato"\n`;
    if (analysis.missingCategories.includes('fat')) p += `- "You need ${m ? '2 tbsp' : '1 tbsp'} olive oil"\n`;
    if (analysis.missingCategories.includes('water')) p += `- "You need ${m ? '32oz' : '20oz'} water"\n`;
  }

  // Coaching rules - keep it simple, AI formats in Allen's voice
  p += `\nYOUR JOB:\n`;
  if (isSnack) {
    p += `- If allowed: "Good snack! 💪"\n`;
    p += `- If problems: explain what's wrong, 1 sentence max\n`;
  } else {
    p += `- Allen's voice — short, punchy, direct. 1-3 sentences max.\n`;
    p += `- If CORRECTIONS: include the portion corrections in your response\n`;
    p += `- If REMOVE or MISSING: give short coaching on what to change\n`;
    p += `- If ON TRACK (analysis.onPhase === true AND NO CORRECTIONS AND NO REMOVE AND NO MISSING): "Nice! You're on track! 💪"\n`;
    p += `- If OFF PHASE (analysis.onPhase === false): explain what's wrong, give corrections — NEVER say "on track"!\n`;
    p += `- AVOCADO IS A HEALTHY FAT — encourage it!\n`;
    p += `- NEVER mention a food unless it appears in CORRECTIONS, REMOVE, or MISSING above\n`;
  }
  p += `\nRespond now:`;

  return p;
}


export function getSnackEvaluationPrompt(
  snackData: MealData,
  context: CoachContext
): string {
  // Simple, SHORT snack prompt - just 4-5 lines!
  const phaseAdvice = getPhaseAdvice(context.currentPhase);
  
  // Build lists of recognized, unrecognized, and disallowed items
  const recognizedList = snackData.recognizedItems.map(i => `${i.item}`).join(', ');
  const unrecognizedList = snackData.unrecognizedItems.join(', ');
  const disallowedList = snackData.disallowedItems.join(', ');

  return `*** THIS IS A SNACK - EVALUATE AS SNACK ONLY ***
Phase: ${context.currentPhase} (${phaseAdvice})

Recognized items: ${recognizedList || 'none'}
Unrecognized items: ${unrecognizedList || 'none'}
Disallowed items: ${disallowedList || 'none'}

If all items are allowed (no disallowed, no unrecognized that are problems): say "Good snack! 💪"
If there are problems (disallowed or unrecognized items that violate phase): explain what's wrong
Keep response SHORT - 1-2 sentences max. Allen's coaching voice.`;
}
