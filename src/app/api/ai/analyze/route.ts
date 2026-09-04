import { NextRequest, NextResponse } from 'next/server';
import { db_get, db_hget, Client } from '@/lib/db';
import { 
  CoachContext, 
  getCoachPrompt, 
  analyzeMealPortion,
  analyzeImageWithPhotoAI,
  chatWithChatAI,
  AIMessage,
  getTomorrowStarchMessage,
  getTomorrowPhase,
  Phase5Day,
  extractMealData,
  getMealEvaluationPrompt,
  getSnackEvaluationPrompt,
  getPhase5DayNumber,
  typeToNumericPhase,
  isFoodBanned,
  filterFoodsForAllergies,
} from '@/lib/ai-coach';
import { initializeCorrectionsCache } from '@/lib/food-corrections-cache';
import { existsSync, unlinkSync, mkdirSync } from 'fs';
import { join } from 'path';

// Initialize corrections cache on server startup
initializeCorrectionsCache().catch(console.error);

// Ensure uploads directory exists
const UPLOADS_DIR = join(process.cwd(), 'uploads');
const ANALYZED_DIR = join(UPLOADS_DIR, 'analyzed');

function ensureUploadDirs() {
  try {
    if (!existsSync(UPLOADS_DIR)) {
      mkdirSync(UPLOADS_DIR, { recursive: true });
    }
    if (!existsSync(ANALYZED_DIR)) {
      mkdirSync(ANALYZED_DIR, { recursive: true });
    }
  } catch (e) {
    console.error('Error creating upload directories:', e);
  }
}

/**
 * Server-side photo deletion - ENFORCED.
 * Photos are ALWAYS deleted after AI analysis completes.
 * This is a security/privacy requirement - photos must not persist on server.
 */
function deletePhotoServerSide(photoPath: string | undefined): void {
  if (!photoPath) return;
  
  try {
    // Normalize the path - could be relative or absolute
    const fullPath = photoPath.startsWith('/') 
      ? photoPath 
      : join(process.cwd(), photoPath);
    
    if (existsSync(fullPath)) {
      unlinkSync(fullPath);
      console.log(`[PHOTO CLEANUP] Deleted: ${fullPath}`);
    } else {
      // Try the uploads directory path
      const uploadsPath = join(UPLOADS_DIR, photoPath);
      if (existsSync(uploadsPath)) {
        unlinkSync(uploadsPath);
        console.log(`[PHOTO CLEANUP] Deleted: ${uploadsPath}`);
      }
    }
  } catch (deleteError) {
    console.error('[PHOTO CLEANUP] Failed to delete photo:', deleteError);
    // Deletion failure is logged but does NOT fail the request
    // The AI analysis result is what matters
  }
}

// Helper to compute messed_up field - determines if meal violates phase rules
function computeMessUp(
  analysis: { disallowedItems: string[]; hasStarch: boolean },
  context: CoachContext,
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack' | undefined
): boolean {
  const { currentPhase: phase, phase5Plan, phase5StartDate, mealDate, mealsLoggedToday } = context;
  
  // Has disallowed items (e.g., junk food, processed food)
  if (analysis.disallowedItems.length > 0) return true;
  
  // Phase 1: any starch is a violation
  if (phase === 1 && analysis.hasStarch) return true;
  
  // Phase 5: check the rotating plan's rule phase
  if (phase === 5 && analysis.hasStarch) {
    const dayNum = phase5StartDate ? getPhase5DayNumber(phase5StartDate) : 1;
    const currentDayRule = phase5Plan?.find(d => d.day === dayNum);
    const rulePhase = typeToNumericPhase(currentDayRule?.type) || 1;
    // Phase 1 rule days have no starch allowed
    if (rulePhase === 1) return true;
  }
  
  // Phase 2: starch only allowed on Wed/Sat/Sun breakfast/lunch
  if (phase === 2 && analysis.hasStarch) {
    const isBreakfastOrLunch = mealType === 'breakfast' || mealType === 'lunch';
    const isDinnerOrSnack = mealType === 'dinner' || mealType === 'snack';
    
    if (isDinnerOrSnack) return true;
    
    if (mealDate) {
      const mealDateObj = new Date(mealDate + 'T12:00:00');
      const dayOfWeek = mealDateObj.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
      const allowedDays = [0, 3, 6]; // Sun (0), Wed (3), Sat (6)
      if (!allowedDays.includes(dayOfWeek)) return true;
    }
    
    if ((mealsLoggedToday || 0) >= 2) return true;
  }
  
  return false;
}

export async function POST(request: NextRequest) {
  try {
    const clientId = request.headers.get('x-client-id');
    if (!clientId) {
      return NextResponse.json({ error: 'Client ID required' }, { status: 401 });
    }

    const body = await request.json();
    const { 
      foodDescription, 
      photoBase64, 
      photoPath,  // Optional: path to photo file to delete after analysis
      gender, 
      currentPhase, 
      goalWeight, 
      currentWeight, 
      startingWeight, 
      programType, 
      eventDate, 
      weekNumber, 
      trainerNotes,
      mealType,
      phase5Plan, // 14-day Phase 5 plan array
      phase5StartDate, // YYYY-MM-DD when Phase 5 started
      allergies, // client's hard-ban allergies
    } = body;
    
    // BUG #6 FIX: Validate mealType - only allow valid values, default to undefined otherwise
    const validMealTypes = ['breakfast', 'lunch', 'dinner', 'snack'];
    const validatedMealType: 'breakfast' | 'lunch' | 'dinner' | 'snack' | undefined = 
      mealType && validMealTypes.includes(mealType) 
        ? mealType as 'breakfast' | 'lunch' | 'dinner' | 'snack' 
        : undefined;
    
    // NOTE: Photo deletion is ALWAYS enforced server-side.
    // The client cannot override this for privacy/security reasons.

    if (!foodDescription && !photoBase64) {
      return NextResponse.json({ error: 'Food description or photo required' }, { status: 400 });
    }

    // Build client context - prefer passed parameters, fall back to Redis
    let context: CoachContext;
    
    if (gender && currentPhase && goalWeight) {
      // Use provided context
      context = {
        clientName: 'Client',
        gender,
        currentPhase,
        goalWeight,
        currentWeight: currentWeight || 0,
        startingWeight: startingWeight || currentWeight || 0,
        programType: programType || 'general_health',
        eventDate,
        weekNumber: weekNumber || 1,
        trainerNotes,
        mealType: validatedMealType,
        phase5Plan: phase5Plan as Phase5Day[] | undefined,
        phase5StartDate,
        allergies: allergies || [],
      };
    } else {
      // Try to get from Redis
      const clientData = await db_hget<Client>(`client:${clientId}`, 'data');
      
      if (clientData) {
        context = {
          clientName: clientData.name || 'Client',
          gender: clientData.gender || 'male',
          currentPhase: clientData.current_phase || 1,
          goalWeight: clientData.goal_weight || 0,
          currentWeight: clientData.current_weight || 0,
          startingWeight: clientData.starting_weight || clientData.current_weight || 0,
          programType: clientData.program_type || 'general_health',
          eventDate: clientData.event_date,
          weekNumber: (() => {
            if (!clientData.goal_start_date) return 1;
            const start = new Date(clientData.goal_start_date + 'T12:00:00');
            const now = new Date();
            const diffDays = Math.floor((now.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000));
            return Math.max(1, diffDays + 1);
          })(),
          trainerNotes: clientData.notes,
          mealType: validatedMealType,
          allergies: clientData.allergies || [],
        };
      } else {
        // Default context
        context = {
          clientName: 'Client',
          gender: 'male',
          currentPhase: 1,
          goalWeight: goalWeight || 0,
          currentWeight: currentWeight || 0,
          startingWeight: startingWeight || currentWeight || 0,
          programType: programType || 'general_health',
          eventDate,
          weekNumber: weekNumber || 1,
          trainerNotes,
          mealType: validatedMealType,
          phase5Plan: phase5Plan as Phase5Day[] | undefined,
          phase5StartDate,
          allergies: allergies || [],
        };
      }
    }

    // Helper to get tomorrow's starch message (only for dinner - the last meal of the day)
    // For Phase 5: use the plan to get tomorrow's type
    // For other phases: pass the current phase as the "tomorrow" type
    const getAfterDinnerMessage = (): string => {
      if (mealType !== 'dinner') return '';
      
      const isPhase5 = context.currentPhase === 5;
      
      if (isPhase5) {
        // Phase 5: look up tomorrow's type from the plan
        const tomorrowType = getTomorrowPhase(context.phase5Plan || [], context.phase5StartDate || '');
        return getTomorrowStarchMessage(tomorrowType, true, context.phase5Plan, context.phase5StartDate);
      } else {
        // Non-Phase 5: tomorrow has same rules as today
        const phaseToType: Record<number, 'phase1' | 'phase2' | 'phase4'> = {
          1: 'phase1',
          2: 'phase2',
          4: 'phase4',
          6: 'phase4',
        };
        const tomorrowType = phaseToType[context.currentPhase] || 'phase1';
        return getTomorrowStarchMessage(tomorrowType, false);
      }
    };

    // If photo provided, analyze with AI using fallback chain
    if (photoBase64) {
      const prompt = getPhotoAnalysisPrompt(context);
      
      // Use PHOTO_AI_PROVIDER (or fallback chain) - Vision AI only identifies food, does NOT give advice
      const visionResult = await analyzeImageWithPhotoAI(photoBase64, prompt);
      
      // ALWAYS delete photo after analysis - enforced server-side
      // This is a security/privacy requirement, not client-optional
      deletePhotoServerSide(photoPath);
      
      if (visionResult.error && !visionResult.text) {
        // All providers failed - fallback to rule-based analysis
        const analysis = await analyzeMealPortion(foodDescription || 'Unknown meal', context, mealType);
        const afterDinnerMsg = getAfterDinnerMessage();
        const portionAdvice = afterDinnerMsg 
          ? `${analysis.portionAdvice}\n\n${afterDinnerMsg}` 
          : analysis.portionAdvice;
        return NextResponse.json({
          analysis: visionResult.error,
          portionAdvice,
          messed_up: computeMessUp(analysis, context, validatedMealType),
          corrections: analysis.corrections,
          aiError: visionResult.error,
          provider: visionResult.provider || 'none',
          photoDeleted: true,
        });
      }

      // Check if Vision AI identified food content
      const foodKeywords = ['protein', 'starch', 'phase', 'oz', 'cup', 'fat', 'vegetable', 'chicken', 'beef', 'fish', 'salad', 'rice', 'pasta', 'bread', 'nut', 'almond', 'walnut', 'broccoli', 'spinach', 'potato', 'egg', 'yogurt', 'cheese', 'milk', 'cream', 'avocado', 'oil', 'calorie', 'gram', 'fiber', 'sodium', 'sugar', 'frozen', 'canned', 'fresh', 'portion', 'handful', 'tablespoon', 'ounce', 'food', 'eat', 'meal', 'dish', 'sauce', 'salad', 'fruit', 'meat', 'fish', 'seafood', 'toast', 'bacon', 'sausage', 'ham', 'turkey', 'steak', 'pork', 'shrimp'];
      const lowerResponse = (visionResult.text || '').toLowerCase();
      const hasFoodContent = foodKeywords.some(kw => lowerResponse.includes(kw));
      
      // If no food content detected, return "cannot identify" message
      if (!hasFoodContent) {
        return NextResponse.json({
          analysis: 'I cannot identify this food from the photo. Please describe what you are eating and I\'ll give you portion advice.',
          portionAdvice: 'Please describe your meal so I can help with portions.',
          messed_up: false, // Cannot identify = not a mess-up per se
          corrections: [],
          provider: visionResult.provider,
          photoDeleted: true,
        });
      }

      // HYBRID FLOW: Gemini Flash → extractMealData → analyzeMealPortion → getMealEvaluationPrompt → MiniMax
      const identifiedFood = visionResult.text;
      const evalContext: CoachContext = {
        ...context,
        mealType: validatedMealType,
      };
      
      // Step 1: extractMealData
      const mealDataStructured = extractMealData(identifiedFood, evalContext);
      
      // Step 2: analyzeMealPortion
      const analysis = await analyzeMealPortion(identifiedFood, evalContext, mealType);
      
      // Step 3: getMealEvaluationPrompt - use simpler snack prompt for snacks
      let evalPrompt: string;
      if (evalContext.mealType === 'snack') {
        evalPrompt = getSnackEvaluationPrompt(mealDataStructured, evalContext);
      } else {
        evalPrompt = getMealEvaluationPrompt(mealDataStructured, analysis, evalContext);
      }
      
      // Step 4: Send to MiniMax
      const systemMessage: AIMessage = { role: 'system', content: evalPrompt };
      const chatResult = await chatWithChatAI([systemMessage], `My meal: ${identifiedFood}`);
      
      const afterDinnerMsg = getAfterDinnerMessage();
      let portionAdvice = chatResult.text || analysis.portionAdvice;
      if (afterDinnerMsg) {
        portionAdvice = `${portionAdvice}\n\n${afterDinnerMsg}`;
      }
      
      return NextResponse.json({
        analysis: visionResult.text, // Vision AI's food identification (for reference)
        portionAdvice, // Chat AI's coaching advice
        messed_up: computeMessUp(analysis, context, validatedMealType),
        corrections: analysis.corrections,
        provider: visionResult.provider,
        photoDeleted: true,
      });
    }

    // Text-based analysis - HYBRID FLOW
    const evalContext: CoachContext = {
      ...context,
      mealType: validatedMealType,
    };
    
    // Step 1: extractMealData
    const mealDataStructured = extractMealData(foodDescription || '', evalContext);
    
    // Step 2: analyzeMealPortion
    const analysis = await analyzeMealPortion(foodDescription || '', evalContext, mealType);
    
    // Step 3: getMealEvaluationPrompt - use simpler snack prompt for snacks
    let evalPrompt: string;
    if (evalContext.mealType === 'snack') {
      evalPrompt = getSnackEvaluationPrompt(mealDataStructured, evalContext);
    } else {
      evalPrompt = getMealEvaluationPrompt(mealDataStructured, analysis, evalContext);
    }
    
    // Step 4: Send to MiniMax
    const systemMessage: AIMessage = { role: 'system', content: evalPrompt };
    const aiResult = await chatWithChatAI([systemMessage], `My meal: ${foodDescription || ''}`);

    if (aiResult.text) {
      const afterDinnerMsg = getAfterDinnerMessage();
      let portionAdvice = aiResult.text;
      if (afterDinnerMsg) {
        portionAdvice = `${portionAdvice}\n\n${afterDinnerMsg}`;
      }
      return NextResponse.json({
        analysis: aiResult.text,
        portionAdvice,
        messed_up: computeMessUp(analysis, context, validatedMealType),
        corrections: analysis.corrections,
        provider: aiResult.provider || 'ai',
      });
    }

    // AI failed - fallback to rule-based
    const afterDinnerMsg = getAfterDinnerMessage();
    const portionAdvice = afterDinnerMsg 
      ? `${analysis.portionAdvice}\n\n${afterDinnerMsg}` 
      : analysis.portionAdvice;
    return NextResponse.json({
      analysis: portionAdvice,
      portionAdvice,
      messed_up: computeMessUp(analysis, context, validatedMealType),
      corrections: analysis.corrections,
      provider: 'rule-based',
      aiError: aiResult.error,
    });
  } catch (error) {
    console.error('AI analyze error:', error);
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 });
  }
}

/**
 * GET handler to check AI provider status
 */
export async function GET() {
  try {
    const geminiKey = !!process.env.GEMINI_API_KEY;
    const openaiKey = !!process.env.OPENAI_API_KEY;
    const minimaxKey = !!process.env.MINIMAX_API_KEY;
    
    return NextResponse.json({
      providers: {
        gemini: { available: geminiKey, name: 'Google Gemini Vision' },
        openai: { available: openaiKey, name: 'OpenAI GPT-4o' },
        minimax: { available: minimaxKey, name: 'MiniMax' },
        ollama: { available: true, name: 'Ollama (Local)' },
      },
      fallbackChain: ['gemini', 'openai', 'minimax', 'ollama'],
      activeProvider: process.env.AI_PROVIDER || 'auto (fallback chain)',
    });
  } catch (error) {
    console.error('Error checking provider status:', error);
    return NextResponse.json({ error: 'Failed to check provider status' }, { status: 500 });
  }
}

function getPhotoAnalysisPrompt(context: CoachContext): string {
  return `Identify what food you see in this photo. Describe it briefly.

If you cannot identify the food, say EXACTLY: "I cannot identify this food. Please describe what you are eating."

Be brief. Just identify the food — nothing else.`;
}
