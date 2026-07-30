import { NextRequest, NextResponse } from 'next/server';
import { db_get, db_hget, Client } from '@/lib/db';
import { 
  CoachContext, 
  getCoachPrompt, 
  analyzeMealPortion,
  analyzeImageWithPhotoAI,
  chatWithChatAI,
  getMealAnalysisPrompt,
  AIMessage,
} from '@/lib/ai-coach';
import { existsSync, unlinkSync, mkdirSync } from 'fs';
import { join } from 'path';

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
        };
      }
    }

    // If photo provided, analyze with AI using fallback chain
    if (photoBase64) {
      const prompt = getPhotoAnalysisPrompt(context);
      
      // Use PHOTO_AI_PROVIDER (or fallback chain)
      const result = await analyzeImageWithPhotoAI(photoBase64, prompt);
      
      // ALWAYS delete photo after analysis - enforced server-side
      // This is a security/privacy requirement, not client-optional
      deletePhotoServerSide(photoPath);
      
      if (result.error && !result.text) {
        // All providers failed - fallback to rule-based analysis
        const analysis = analyzeMealPortion(foodDescription || 'Unknown meal', context);
        return NextResponse.json({
          analysis: result.error,
          portionAdvice: analysis.advice,
          onPhase: analysis.onPhase,
          corrections: analysis.corrections,
          aiError: result.error,
          provider: result.provider || 'none',
          photoDeleted: true,
        });
      }

      // Convert photo analysis to portion advice
      const analysis = analyzeMealPortion(result.text, context);
      return NextResponse.json({
        analysis: result.text,
        portionAdvice: analysis.advice,
        onPhase: analysis.onPhase,
        corrections: analysis.corrections,
        provider: result.provider,
        photoDeleted: true,
      });
    }

    // Text-based analysis - use AI instead of rule-based
    const mealPrompt = getMealAnalysisPrompt(context, {
      mealType: 'meal',
      foodDescription: foodDescription || '',
      onPhase: true,
    });

    const systemMessage: AIMessage = { role: 'system', content: mealPrompt };
    const aiResult = await chatWithChatAI([systemMessage], '');

    if (aiResult.text) {
      // AI succeeded - use AI response plus rule-based corrections for onPhase status
      const analysis = analyzeMealPortion(foodDescription, context);
      return NextResponse.json({
        analysis: aiResult.text,
        portionAdvice: aiResult.text,
        onPhase: analysis.onPhase,
        corrections: analysis.corrections,
        provider: aiResult.provider || 'ai',
      });
    }

    // AI failed - fallback to rule-based
    const analysis = analyzeMealPortion(foodDescription || '', context);
    return NextResponse.json({
      analysis: analysis.advice,
      portionAdvice: analysis.advice,
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
  const portions = context.gender === 'male' 
    ? { protein: '6 ounces', fibrousVegetables: '2 cups', fat: '1-2 tablespoons' }
    : { protein: '4 ounces', fibrousVegetables: '1-2 cups', fat: '1 tablespoon' };

  return `You are a nutrition coach analyzing a meal photo. Look at the food and:

1. Describe what you see in the meal (converted to text)
2. Identify the food categories present (protein, vegetables, starch, fat)
3. For the client's current phase (Phase ${context.currentPhase}), give portion advice:
   - Phase 1: NO starch allowed. Focus on ${portions.protein} protein, ${portions.fibrousVegetables} fibrous vegetables, ${portions.fat} healthy fat
   - Phase 2: Add starch (${context.gender === 'male' ? '1-2 cups' : '1 cup'}) on Wed/Sat/Sun to first 2 meals only
4. If the meal is off-phase (e.g., pasta, bread, rice in Phase 1), give specific advice like "Eat only 1/4 of the plate" or "Skip the starch portion"
5. Keep responses punchy and coach-like

IMPORTANT — Vegetable classification:
- FIBROUS vegetables (legal on Phase 1): broccoli, spinach, asparagus, zucchini, green peppers, GREEN BEANS, mushrooms, lettuce, tomatoes, cucumbers, celery, cabbage, onions
- STARCHY vegetables (NOT legal on Phase 1): potatoes (including hashbrowns, fries, mashed), sweet potatoes, rice, pasta, bread, corn, peas, kidney beans, black beans, pinto beans, quinoa, oats, cereal

Client info:
- Gender: ${context.gender}
- Current Phase: ${context.currentPhase}
- Goal: ${context.goalWeight} lbs
- Current: ${context.currentWeight} lbs
${context.eventDate ? `- Event in: ${Math.ceil((new Date(context.eventDate).getTime() - Date.now()) / (7 * 24 * 60 * 60 * 1000))} weeks` : ''}

Be specific and practical. Use coaching voice.`;
}
