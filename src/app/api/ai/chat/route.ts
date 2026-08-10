import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/db';
import { 
  chatWithChatAI, 
  CoachContext, 
  AIMessage, 
  getCoachPrompt, 
  getWeightAnalysisPrompt,
  analyzeMealPortion, 
  getWeightResponse,
  LEAN_PROTEINS,
  STARCHY_CARBOHYDRATES,
  FIBROUS_VEGETABLES,
  HEALTHY_FATS,
  PORTION_SIZES
} from '@/lib/ai-coach';

export async function POST(request: NextRequest) {
  try {
    const clientId = request.headers.get('x-client-id');
    if (!clientId) {
      return NextResponse.json({ error: 'Client ID required' }, { status: 401 });
    }

    const body = await request.json();
    const { message, mealData, weightData, preferredProvider } = body;

    // Get client context using admin client to bypass RLS
    const supabase = getAdminClient();
    const { data: client, error } = await supabase.from('clients').select('*').eq('id', clientId).single();
    if (error || !client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }
    
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const context: CoachContext = {
      clientName: client.name,
      gender: client.gender || 'male',
      currentPhase: client.current_phase || 1,
      goalWeight: client.goal_weight || 0,
      currentWeight: client.current_weight || client.starting_weight || 0,
      startingWeight: client.starting_weight || client.current_weight || 0,
      programType: client.program_type || 'general_health',
      eventDate: client.event_date,
      weekNumber: (() => {
        if (!client.goal_start_date) return 1;
        const start = new Date(client.goal_start_date + 'T12:00:00');
        const now = new Date();
        const diffDays = Math.floor((now.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000));
        return Math.max(1, diffDays + 1);
      })(),
      trainerNotes: client.notes,
      // Phase 5 data
      phase5Plan: client.phase5_plan ? JSON.parse(client.phase5_plan) : undefined,
      phase5StartDate: client.phase5_start_date || undefined,
    };

    // Handle meal analysis request - use getCoachPrompt (same as chat!)
    if (mealData) {
      const foodDescription = mealData.foodDescription || mealData.description || '';
      const mealMessage = `I'm eating ${foodDescription}`;
      const coachPrompt = getCoachPrompt(context, mealMessage);

      const systemMessage: AIMessage = { role: 'system', content: coachPrompt };
      const result = await chatWithChatAI([systemMessage], mealMessage, preferredProvider);

      if (result.error || !result.text) {
        // Fallback to rule-based response
        const fallback = await analyzeMealPortion(foodDescription, context, mealData.mealType);
        return NextResponse.json({
          response: fallback.advice,
          type: 'meal_analysis',
          provider: result.provider || 'fallback',
        });
      }

      return NextResponse.json({
        response: result.text,
        type: 'meal_analysis',
        provider: result.provider,
      });
    }

    // Handle weight analysis request
    if (weightData) {
      // Prefer the previousWeight passed from the weight page (captured before DB update)
      // Fall back to database only if not provided
      const prevWeight = weightData.previousWeight 
        ? weightData.previousWeight 
        : (client.current_weight || client.starting_weight || context.startingWeight);
      const currentWeight = weightData.weight;
      // Use the change if explicitly passed, otherwise calculate it
      const change = weightData.change !== undefined 
        ? weightData.change 
        : (prevWeight - currentWeight);

      const prompt = getWeightAnalysisPrompt(context, {
        weight: currentWeight,
        previousWeight: prevWeight,
        change,
      });

      const systemMessage: AIMessage = { role: 'system', content: prompt };
      const result = await chatWithChatAI([systemMessage], '', preferredProvider);

      if (result.error || !result.text) {
        // Fallback to rule-based response
        const fallback = getWeightResponse(currentWeight, prevWeight, context.goalWeight, context.gender);
        return NextResponse.json({
          response: fallback,
          type: 'weight_analysis',
          provider: result.provider || 'fallback',
        });
      }

      return NextResponse.json({
        response: result.text,
        type: 'weight_analysis',
        provider: result.provider,
      });
    }

    // Handle regular chat message
    if (!message || message.trim().length === 0) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const coachPrompt = getCoachPrompt(context, message);
    const systemMessage: AIMessage = { role: 'system', content: coachPrompt };
    const result = await chatWithChatAI([systemMessage], message, preferredProvider);
    
    if (result.error || !result.text) {
      const fallback = await getFallbackResponse(message, context);
      return NextResponse.json({
        response: fallback,
        type: 'fallback',
        error: result.error,
        provider: result.provider,
      });
    }

    return NextResponse.json({
      response: result.text,
      type: 'coach',
      provider: result.provider,
    });

  } catch (error) {
    console.error('AI chat error:', error);
    return NextResponse.json({ error: 'Chat failed' }, { status: 500 });
  }
}

async function getFallbackResponse(message: string, context: CoachContext): Promise<string> {
  // Normalize apostrophes - replace curly/smart apostrophes with straight apostrophe
  const normalizedMessage = message.replace(/['\u2019]/g, "'");
  const lower = normalizedMessage.toLowerCase();

  // MOTIVATION queries
  if (lower.includes('motivat') || lower.includes('i got this') || lower.includes('you got this') ||
      lower.includes('lets go') || lower.includes('gooooo') || lower.includes('come on') ||
      lower.includes('push') || lower.includes('hype') || lower.includes('inspire')) {
    const motivational = [
      "You Got This! 💪 Don't let your brain prevent your body from reaching your goal!",
      "LETS GOOOO! 🔥 You're doing this — one meal at a time!",
      "Oh looookout! Good things happening! 💪 Keep crushing it!",
      "If you want to look better than the average population, you have to do what the average population won't! 🙌",
      "Everyone falls off track. It's those that get back on track and those that don't. You got this! 💪",
    ];
    return motivational[Math.floor(Math.random() * motivational.length)];
  }

  // GENERAL NUTRITION QUESTIONS → give helpful educational answers
  if (lower.includes('what is') || lower.includes('what are') || lower.includes('what a') ||
      lower.includes('define') || lower.includes('list of') || lower.includes('examples of') ||
      lower.includes("what's a") || lower.includes('whats a')) {
    // Protein question
    if (lower.includes('protein')) {
      const proteinPortion = context.gender === 'male' ? '6oz' : '4oz';
      return `Great question! Lean protein options (fresh or frozen, NO CANS):

• ${LEAN_PROTEINS.join('\n• ')}

Your portion: ${proteinPortion} per meal

No cheese or dairy while dieting! Keep it lean! 💪`;
    }
    // Carb/Starch question
    if (lower.includes('carb') || lower.includes('starch')) {
      const starchPortion = context.gender === 'male' ? '2 cups' : '1 cup';
      if (context.currentPhase === 1) {
        return `Starchy carbohydrates (fresh or frozen, NO CANS):

• ${STARCHY_CARBOHYDRATES.join('\n• ')}

⚠️ NO STARCHES IN PHASE 1!
Your portion: ${starchPortion} per meal (when you reach Phase 2+)

Stay focused! Keep it lean! 💪`;
      } else if (context.currentPhase === 2) {
        return `Starchy carbohydrates (fresh or frozen, NO CANS):

• ${STARCHY_CARBOHYDRATES.join('\n• ')}

✅ STARCH ALLOWED on Wed, Sat, Sun (first 2 meals only)
Your portion: ${starchPortion} per meal cooked

Keep it clean! 💪`;
      } else if (context.currentPhase === 3) {
        return `Starchy carbohydrates (fresh or frozen, NO CANS):

• ${STARCHY_CARBOHYDRATES.join('\n• ')}

⚠️ PHASE 3 is a checkpoint - check with your coach!
Your portion: ${starchPortion} per meal cooked

Keep it lean! 💪`;
      } else {
        return `Starchy carbohydrates (fresh or frozen, NO CANS):

• ${STARCHY_CARBOHYDRATES.join('\n• ')}

✅ STARCH ALLOWED every meal in Phase 4!
Your portion: ${starchPortion} per meal cooked

Keep it clean! 💪`;
      }
    }
    // Vegetable/Fiber question
    if (lower.includes('veggie') || lower.includes('vegetable') || lower.includes('fiber') || lower.includes('what greens')) {
      const vegPortion = context.gender === 'male' ? '2 cups' : '1-2 cups';
      return `Load up on fibrous veggies (fresh or frozen, NO CANS)! Great options:

• ${FIBROUS_VEGETABLES.join('\n• ')}

Your portion: ${vegPortion} per meal

Fill half your plate! Fiber fills you up without the calories. 💪`;
    }
    // Fat question
    if (lower.includes('fat') || lower.includes('fats') || lower.includes('healthy fat') || lower.includes('what fat')) {
      const fatPortion = context.gender === 'male' ? '2 tablespoons' : '1 tablespoon';
      return `Healthy fats for your meals:

• ${HEALTHY_FATS.join('\n• ')}

Your portion: ${fatPortion} per meal

Use sparingly! Good fats support hormone health and nutrient absorption. 💪`;
    }
  }

  // MEAL PLAN / WHAT TO EAT queries → give phase-appropriate meal suggestions
  if (lower.includes('what can i eat') || lower.includes('what to eat') || lower.includes('what should i eat') ||
      lower.includes('meal plan') || lower.includes('example meal') || lower.includes('my plan') ||
      lower.includes('show me what') || lower.includes('give me a') || lower.includes('next meal')) {
    const portions = PORTION_SIZES[context.gender];
    const phaseDescription = context.currentPhase === 1 ? 'NO STARCH - lean protein, veggies, healthy fats only' :
                            context.currentPhase === 2 ? 'Add starch (Wed, Sat, Sun) to first 2 meals' :
                            context.currentPhase === 3 ? 'Check with coach for next steps' :
                            'Maintenance mode - add starch to every meal';
    
    const proteinExamples = context.gender === 'male' ? '6oz chicken/fish/egg/beef/pork' : '4oz chicken/fish/egg/beef/pork';
    const veggieExamples = 'broccoli, spinach, asparagus, zucchini, peppers, salad';
    const fatExamples = 'olive oil, avocado, almonds, walnuts';
    const starchNote = context.currentPhase === 1 ? '\n• NO STARCH in Phase 1!' :
                       context.currentPhase === 2 ? '\n• Starch allowed on Wed, Sat, Sun only (first 2 meals)' :
                       '\n• Starch allowed every meal in Phase 4';
    
    const mealExample = context.gender === 'male' 
      ? `• ${portions.protein} chicken breast\n• 2 cups green beans\n• 2 tablespoons olive oil`
      : `• ${portions.protein} chicken breast\n• 1-2 cups green beans\n• 1 tablespoon olive oil`;

    return `You're in PHASE ${context.currentPhase}: ${phaseDescription}

YOUR PORTIONS PER MEAL:
• Protein: ${portions.protein} (${proteinExamples})
• Veggies: ${portions.fibrousVegetables} (${veggieExamples})
• Fat: ${portions.fat} (${fatExamples})${starchNote}
• Water: ${context.gender === 'male' ? '128oz' : '80oz'} daily

EXAMPLE MEAL:
${mealExample}

Ask me anything about specific foods! 💪`;
  }

  // MEAL / FOOD queries → use rule-based meal analyzer
  if (lower.includes('eat') || lower.includes('meal') || lower.includes('food') ||
      lower.includes('breakfast') || lower.includes('lunch') || lower.includes('dinner') ||
      lower.includes('snack') || lower.includes('chicken') || lower.includes('beef') ||
      lower.includes('veggie') || lower.includes('vegetable') ||
      lower.includes('fat') || lower.includes('starch') ||
      lower.includes('what can i') || lower.includes('what should i') || lower.includes('what am i')) {
    const fallback = await analyzeMealPortion(message, context);
    return fallback.advice;
  }

  // PORTION / SIZE queries (only if NOT a phase question)
  if ((lower.includes('portion') || lower.includes('size') ||
      lower.includes('ounce') || lower.includes('cup') || lower.includes('tablespoon') ||
      lower.includes('how much') || lower.includes('amount')) && !lower.includes('phase')) {
    const waterAmount = context.gender === 'male' ? '128oz' : '80oz';
    const portions = context.gender === 'male'
      ? '6oz protein, 2 cups veggies, 2 tbsp fat per meal. No starch in Phase 1!'
      : '4oz protein, 1-2 cups veggies, 1 tbsp fat per meal. No starch in Phase 1!';
    return `Phase ${context.currentPhase} portions: ${portions} ${waterAmount} water daily. Keep crushing it! 💪`;
  }

  // PHASE tips queries
  if (lower.includes('phase')) {
    return `💡 Plan your meals out for the next few days.
💡 Cook in bulk on Sunday and Wednesday.

Keep crushing it! 💪`;
  }

  // ENCOURAGEMENT / CHECK-IN queries
  if (lower.includes('hello') || lower.includes('hey') || lower.includes('hi ') ||
      lower.includes('how are') || lower.includes('whats up') || lower.includes("what's up")) {
    return `Hey ${context.clientName || 'there'}! Ready to crush it today? 💪 Log those foods and let's go!`;
  }

  // WEIGHT / PROGRESS queries
  if (lower.includes('weight') || lower.includes('lost') || lower.includes('gained') ||
      lower.includes('progress') || lower.includes('down') || lower.includes('scale')) {
    const diff = context.startingWeight - context.currentWeight;
    const diffStr = diff > 0 ? `Down ${diff.toFixed(1)} lbs from where you started! 🔥` : '';
    const toGo = context.currentWeight - context.goalWeight;
    const toGoStr = toGo > 0 ? `${toGo.toFixed(1)} lbs to go! Keep pushing! 💪` : "You're at goal! 🎉";
    return `${diffStr} ${toGoStr}`.trim();
  }

  // Default: general encouragement
  const defaults = [
    "Log your foods and get back on track next meal! You've got this! 💪",
    "Keep your goal in focus! One meal at a time! 🔥",
    "Don't turn a bad meal into a bad week — plan those foods! 💪",
    "IT'S GONNA BE A GREAT DAY! Get after it! 💪",
  ];
  return defaults[Math.floor(Math.random() * defaults.length)];
}

function getPhaseAdvice(phase: number): string {
  switch (phase) {
    case 1:
      return 'No starch! Focus on lean protein, fibrous vegetables, and healthy fats.';
    case 2:
      return 'Add starch on Wed/Sat/Sun to first 2 meals only.';
    case 3:
      return 'Evaluation checkpoint — are you at goal?';
    case 4:
      return 'Maintenance mode — add starch to every meal, weigh Fridays only.';
    default:
      return 'Keep following your plan!';
  }
}
