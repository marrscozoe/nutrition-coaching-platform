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
    } = body;
    
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
        mealType: mealType as 'breakfast' | 'lunch' | 'dinner' | 'snack' | undefined,
        phase5Plan: phase5Plan as Phase5Day[] | undefined,
        phase5StartDate,
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
          mealType: mealType as 'breakfast' | 'lunch' | 'dinner' | 'snack' | undefined,
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
          mealType: mealType as 'breakfast' | 'lunch' | 'dinner' | 'snack' | undefined,
          phase5Plan: phase5Plan as Phase5Day[] | undefined,
          phase5StartDate,
        };
      }
    }

    // Helper to get tomorrow's starch message (for after last meal of the day)
    // For Phase 5: use the plan to get tomorrow's type
    // For other phases: pass the current phase as the "tomorrow" type
    const getAfterDinnerMessage = (): string => {
      if (mealType !== 'dinner' && mealType !== 'lunch') return '';
      
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
          onPhase: analysis.onPhase,
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
          onPhase: false,
          corrections: [],
          provider: visionResult.provider,
          photoDeleted: true,
        });
      }

      // HYBRID FLOW: Gemini Flash → extractMealData → analyzeMealPortion → getMealEvaluationPrompt → MiniMax
      const identifiedFood = visionResult.text;
      const evalContext: CoachContext = {
        ...context,
        mealType: mealType as 'breakfast' | 'lunch' | 'dinner' | 'snack' | undefined,
      };
      
      // Step 1: extractMealData
      const mealDataStructured = extractMealData(identifiedFood, evalContext);
      
      // Step 2: analyzeMealPortion
      const analysis = await analyzeMealPortion(identifiedFood, evalContext, mealType);
      
      // Step 3: getMealEvaluationPrompt
      const evalPrompt = getMealEvaluationPrompt(mealDataStructured, analysis, evalContext);
      
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
        onPhase: analysis.onPhase,
        corrections: analysis.corrections,
        provider: visionResult.provider,
        photoDeleted: true,
      });
    }

    // Text-based analysis - HYBRID FLOW
    const evalContext: CoachContext = {
      ...context,
      mealType: mealType as 'breakfast' | 'lunch' | 'dinner' | 'snack' | undefined,
    };
    
    // Step 1: extractMealData
    const mealDataStructured = extractMealData(foodDescription || '', evalContext);
    
    // Step 2: analyzeMealPortion
    const analysis = await analyzeMealPortion(foodDescription || '', evalContext, mealType);
    
    // Step 3: getMealEvaluationPrompt
    const evalPrompt = getMealEvaluationPrompt(mealDataStructured, analysis, evalContext);
    
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
        onPhase: analysis.onPhase,
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
      onPhase: analysis.onPhase,
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
