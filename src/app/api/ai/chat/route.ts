import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import {
  chatWithChatAI, 
  CoachContext, 
  AIMessage, 
  getCoachPrompt, 
  getWeightAnalysisPrompt,
  analyzeMealPortion, 
  getWeightResponse,
  extractMealData,
  getMealEvaluationPrompt,
  getSnackEvaluationPrompt,
  LEAN_PROTEINS,
  STARCHY_CARBOHYDRATES,
  FIBROUS_VEGETABLES,
  HEALTHY_FATS,
} from '@/lib/ai-coach';
import { generateMealSuggestion, formatMealSuggestion, getPortions, getPhase5CurrentRule, findAllergyKeyForFood } from '@/lib/nutrition-data';

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
      eventDate: client.program_type === 'event_ready' ? client.event_date : undefined,
      weekNumber: (() => {
        if (!client.goal_start_date) return 1;
        const start = new Date(client.goal_start_date + 'T12:00:00');
        const now = new Date();
        const diffDays = Math.floor((now.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000));
        return Math.max(1, diffDays + 1);
      })(),
      trainerNotes: client.notes,
      // Phase 5 data
      phase5Plan: (() => {
        if (!client.phase5_plan) return undefined;
        const raw = typeof client.phase5_plan === 'string'
          ? JSON.parse(client.phase5_plan)
          : client.phase5_plan;
        console.log('[PHASE5] route extraction — raw type:', typeof raw, 'isArray:', Array.isArray(raw), 'keys:', raw && typeof raw === 'object' ? Object.keys(raw) : 'N/A');
        console.log('[PHASE5] route extraction — raw.days length:', raw?.days?.length);
        return Array.isArray(raw) ? raw : (raw.days || undefined);
      })(),
      phase5StartDate: client.phase5_start_date || undefined,
      phase5RuleType: (() => {
        if (!client.phase5_plan || !client.phase5_start_date) return undefined;
        const raw = typeof client.phase5_plan === 'string'
          ? JSON.parse(client.phase5_plan)
          : client.phase5_plan;
        const plan = Array.isArray(raw) ? raw : (raw.days || []);
        const startDate = client.phase5_start_date;
        const currentDay = (() => {
          const [y, m, d] = startDate.split('-').map(Number);
          const start = new Date(y, m - 1, d, 0, 0, 0);
          const now = new Date();
          return Math.min(14, Math.max(1, Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1));
        })();
        const todayRule = plan.find((d: { day: number }) => d.day === currentDay);
        console.log('[PHASE5-DEBUG] phase5StartDate:', startDate, '| currentDay:', currentDay, '| todayRule:', todayRule?.type, '| label:', todayRule?.label);
        return todayRule?.type as 'phase1' | 'phase2' | 'phase4' | undefined;
      })(),
      // Allergies — hard-ban food allergies
      allergies: client.allergies || [],
      custom_allergy_bans: client.custom_allergy_bans || [],
      allergy_discovery_enabled: client.allergy_discovery_enabled ?? false,
    };

    // Detect digestive-issue keywords in the incoming message
    const lowerMessage = message.toLowerCase();
    const mentionsDigestiveIssue = lowerMessage.includes('bloated') || lowerMessage.includes('bloating') || lowerMessage.includes('stomach pain') || lowerMessage.includes('stomach ache') || lowerMessage.includes('gassy') || lowerMessage.includes('gut hurts');

    // When allergy discovery is ON and user mentions a digestive issue:
    // 1. Find the most recent meal logged today (America/Chicago) to link the symptom to
    // 2. Log the symptom immediately so tracking starts on the FIRST bloated report
    // 3. Pass that meal's food_description into the coach context so the reply can reference specific foods
    let lastMealFood: string | undefined;
    if (context.allergy_discovery_enabled && mentionsDigestiveIssue) {
      const nowChicago = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' }));
      const todayStart = new Date(nowChicago.getFullYear(), nowChicago.getMonth(), nowChicago.getDate(), 0, 0, 0).toISOString();
      const todayEnd   = new Date(nowChicago.getFullYear(), nowChicago.getMonth(), nowChicago.getDate(), 23, 59, 59, 999).toISOString();

      const { data: recentMeals } = await supabase
        .from('meals')
        .select('id, food_description')
        .eq('client_id', clientId)
        .gte('logged_at', todayStart)
        .lte('logged_at', todayEnd)
        .order('logged_at', { ascending: false })
        .limit(1);

      const lastMeal = recentMeals?.[0];

      if (lastMeal) {
        lastMealFood = lastMeal.food_description ?? undefined;

        // Log the symptom NOW — linked to this meal; no gate requiring prior symptom rows
        const symptomType = lowerMessage.includes('stomach pain') || lowerMessage.includes('stomach ache') || lowerMessage.includes('gut hurts')
          ? 'stomach_pain'
          : 'bloating';
        await supabase.from('symptoms').insert({
          id: uuidv4(),
          client_id: clientId,
          type: symptomType,
          meal_id: lastMeal.id,
          notes: null,
          created_at: new Date().toISOString(),
        });
        console.log(`[ALLERGY DISCOVERY] Logged ${symptomType} linked to meal ${lastMeal.id} for client ${clientId}`);
      } else {
        // No meal found today — still log the symptom (unlinked) so tracking begins
        const symptomType = lowerMessage.includes('stomach pain') || lowerMessage.includes('stomach ache') || lowerMessage.includes('gut hurts')
          ? 'stomach_pain'
          : 'bloating';
        await supabase.from('symptoms').insert({
          id: uuidv4(),
          client_id: clientId,
          type: symptomType,
          meal_id: null,
          notes: null,
          created_at: new Date().toISOString(),
        });
        console.log(`[ALLERGY DISCOVERY] Logged ${symptomType} (no meal) for client ${clientId}`);
      }
    }

    // Get recent symptoms count (after the new symptom was just inserted above)
    let symptomCount = 0;
    if (context.allergy_discovery_enabled) {
      const nowChicago = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' }));
      const sevenDaysAgo = new Date(nowChicago.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: recentSymptoms } = await supabase
        .from('symptoms')
        .select('type, created_at')
        .eq('client_id', clientId)
        .gte('created_at', sevenDaysAgo)
        .order('created_at', { ascending: false });
      symptomCount = recentSymptoms?.length || 0;
    }

    // Inject meal food into coach context for allergy discovery
    if (lastMealFood) {
      context.lastMealFood = lastMealFood;
    }
    // Discovery tip: if client mentions bloating/stomach pain and has opted into allergy discovery
    // (gate no longer requires prior symptom rows — first bloated report starts tracking)
    const showDiscoveryTip = context.allergy_discovery_enabled && mentionsDigestiveIssue;

    // Handle meal analysis request - HYBRID FLOW (code + AI)
    if (mealData) {
      const foodDescription = mealData.foodDescription || mealData.description || '';
      // DEBUG: Log mealData.mealType
      console.log('[DEBUG chat route] mealData.mealType:', JSON.stringify(mealData.mealType), 'typeof:', typeof mealData.mealType);
      
      const mealContext: CoachContext = {
        ...context,
        mealType: mealData.mealType as 'breakfast' | 'lunch' | 'dinner' | 'snack' | undefined,
        mealDate: mealData.mealDate || undefined,
      };

      // Step 1: extractMealData - parse meal into structured data
      const mealDataStructured = extractMealData(foodDescription, mealContext);

      // Step 2: analyzeMealPortion - phase rule enforcement
      const analysis = await analyzeMealPortion(foodDescription, mealContext, mealData.mealType);

      // Step 3: getMealEvaluationPrompt - generate MiniMax prompt
      // Use simpler snack prompt for snacks
      let evalPrompt: string;
      if (mealContext.mealType === 'snack') {
        evalPrompt = getSnackEvaluationPrompt(mealDataStructured, mealContext);
      } else {
        evalPrompt = getMealEvaluationPrompt(mealDataStructured, analysis, mealContext);
      }

      // Step 4: Send to MiniMax with structured prompt
      const systemMessage: AIMessage = { role: 'system', content: evalPrompt };
      const result = await chatWithChatAI([systemMessage], `My meal: ${foodDescription}`, preferredProvider);

      if (result.error || !result.text) {
        // Fallback to rule-based response
        return NextResponse.json({
          response: analysis.portionAdvice,
          type: 'meal_analysis',
          provider: result.provider || 'fallback',
        });
      }

      return NextResponse.json({
        response: result.text,
        type: 'meal_analysis',
        provider: result.provider,
        _debug: { phase: mealContext.currentPhase, hasFat: analysis.hasFat, recognizedItems: mealDataStructured.recognizedItems, missingCategories: analysis.missingCategories, corrections: analysis.corrections },
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

    // Intercept simple queries that don't need AI - return simple responses
    const normalizedMessage = message.replace(/['\u2019]/g, "'");
    const lower = normalizedMessage.toLowerCase();
    
    // PORTION SIZES - simple response (no AI)
    if (lower.includes('portion size') || lower.includes('portion sizes')) {
      const isMale = context.gender === 'male';
      
      // Phase 6 has higher starch and fat
      const isPhase6 = context.currentPhase === 6;
      
      const protein = isMale ? '6oz' : '4oz';
      const veggies = isMale ? '2 cups' : '1-2 cups';
      const fat = isPhase6 ? (isMale ? '3 tbsp' : '2 tbsp') : (isMale ? '2 tbsp' : '1 tbsp');
      const starchMale = isPhase6 ? '3 cups' : '2 cups';
      const starchFemale = isPhase6 ? '2 cups' : '1 cup';
      
      let starchNote = '';
      if (context.currentPhase === 1) {
        starchNote = 'Not allowed in Phase 1';
      } else if (context.currentPhase === 2) {
        starchNote = `${isMale ? starchMale : starchFemale} (allowed Wed/Sat/Sun only)`;
      } else if (context.currentPhase === 5) {
        // Phase 5 starch rules vary by day type
        if (context.phase5Plan && context.phase5StartDate) {
          const phase5Rule = getPhase5CurrentRule(context.phase5Plan, context.phase5StartDate);
          console.log('[PHASE5] portion-sizes — phase5StartDate:', context.phase5StartDate);
          console.log('[PHASE5] portion-sizes — phase5Plan type:', typeof context.phase5Plan, 'isArray:', Array.isArray(context.phase5Plan), 'length:', context.phase5Plan?.length);
          console.log('[PHASE5] portion-sizes — currentDay:', (() => {
            const start = new Date(context.phase5StartDate + 'T12:00:00');
            const now = new Date();
            return Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
          })());
          console.log('[PHASE5] portion-sizes — phase5Rule:', JSON.stringify(phase5Rule));
          if (phase5Rule?.type === 'phase1') {
            starchNote = 'Not allowed today (Phase 1 day)';
          } else if (phase5Rule?.type === 'phase2') {
            starchNote = `${isMale ? starchMale : starchFemale} (allowed breakfast/lunch only today — Phase 2 day)`;
          } else if (phase5Rule?.type === 'phase4') {
            starchNote = `${isMale ? starchMale : starchFemale} every meal (Phase 4 day)`;
          } else {
            starchNote = 'Not allowed today (plan data unavailable)';
          }
        } else {
          starchNote = 'Not allowed today (plan data unavailable)';
        }
      } else {
        // Phase 4, 6 - all allow starch every meal
        starchNote = `${isMale ? starchMale : starchFemale} every meal`;
      }
      
      let response = `Your portions per meal:\nProtein: ${protein}\nStarch: ${starchNote}\nVegetables: ${veggies}\nHealthy fats: ${fat} or 1/2 avocado`;
      
      // Phase 6 specific supplements
      if (isPhase6) {
        const whey = isMale ? '40g × 2/day' : '20g × 2/day';
        response += `\n\nSupplements:\nWhey protein powder: ${whey} — 1st AM & last PM (NOT with meals)\nCreatine: Daily (follow container directions)\nWhey protein drink (Premier Protein Drink) — No more than 1 per day\nVitamin (Centrum with dinner)`;
      }
      
      return NextResponse.json({
        response,
        type: 'simple',
      });
    }

    // TIPS - simple generic response (no AI)
    if (lower === 'tips?' || lower === 'tips') {
      return NextResponse.json({
        response: `💡 Plan your meals ahead\n💡 Cook in bulk\n💡 Stay consistent\n💡 Keep going!`,
        type: 'simple',
      });
    }

    // RULE-BASED MEAL SUGGESTION — intercept before AI
    const mealQueryPatterns = [
      'what should my next meal',
      'what do i eat',
      'im hungry',
      "i'm hungry",
      'next meal',
      'what can i eat',
      'what should i eat',
      'example meal',
      'meal suggestion',
      'what to eat',
    ];
    if (mealQueryPatterns.some(p => lower.includes(p))) {
      try {
        const detectedMealType = detectMealType(message);
        const suggestion = generateMealSuggestion(
          { gender: context.gender as 'male' | 'female', currentPhase: context.currentPhase, phase5StartDate: context.phase5StartDate, phase5Plan: context.phase5Plan, allergies: context.allergies, custom_allergy_bans: context.custom_allergy_bans },
          detectedMealType
        );
        const response = formatMealSuggestion(suggestion);
        return NextResponse.json({
          response,
          type: 'meal-suggestion',
        });
      } catch (e) {
        console.error('Meal suggestion error:', e);
        // Fall through to AI if rule-based fails
      }
    }

    // RULE-BASED MEAL CHECK — intercept meal logs before AI
    // Detect meal log patterns like "LUNCH — Fri, Aug 14, Chicken asparagus ✅ On Phase"
    const mealLogPatterns = [
      /^lunch\s*—/i,
      /^breakfast\s*—/i,
      /^dinner\s*—/i,
      /^snack\s*—/i,
      /—\s*\w+,?\s*\w+\s*\d+/i, // contains date pattern like "Fri, Aug 14"
    ];
    const isMealLog = mealLogPatterns.some(p => p.test(message)) || 
      (lower.includes('on phase') && (lower.includes('chicken') || lower.includes('beef') || lower.includes('fish') || lower.includes('asparagus') || lower.includes('rice') || lower.includes('potato')));
    
    if (isMealLog) {
      try {
        // Extract food description - remove the meal prefix and date
        let foodDescription = message
          .replace(/^(lunch|breakfast|dinner|snack)\s*—\s*/i, '')
          .replace(/\s*—\s*.*$/i, '') // remove everything after "—"
          .replace(/\d{1,2}:\d{2}\s*(am|pm)?/i, '') // remove time
          .replace(/✅|❌|✓|✗/g, '') // remove checkmarks
          .replace(/on phase\s*\d*/i, '') // remove "on phase X"
          .trim();
        
        if (foodDescription.length > 2) {
          const analysis = await analyzeMealPortion(foodDescription, context);
          return NextResponse.json({
            response: analysis.portionAdvice,
            type: 'meal_analysis',
            corrections: analysis.corrections,
          });
        }
      } catch (e) {
        console.error('Meal check error:', e);
        // Fall through to AI if rule-based fails
      }
    }

    // Allen law (2026-09-20 Gate 4): If message contains text that could be a meal description,
    // route through meal analysis pipeline so unrecognized items are passed to AI for correction.
    // This prevents 'xyzabc123' and similar unrecognized text from falling through to
    // generic encouragement instead of being analyzed as a meal with unrecognized facts.
    const messageHasTextContent = normalizedMessage.trim().length > 0 && /[a-zA-Z]{2,}/.test(normalizedMessage);
    const isClearlyNonMealQuery = (
      lower.includes('portion size') || lower.includes('portion sizes') ||
      lower === 'tips?' || lower === 'tips' ||
      lower.includes('what should my next meal') || lower.includes('what do i eat') ||
      lower.includes('im hungry') || lower.includes("i'm hungry") ||
      lower.includes('next meal') || lower.includes('what can i eat') ||
      lower.includes('what should i eat') || lower.includes('example meal') ||
      lower.includes('meal suggestion') || lower.includes('what to eat') ||
      lower.includes('motivat') || lower.includes('i got this') ||
      lower.includes('make my grocery list') || lower.includes('generate grocery list') ||
      lower.includes('what is') || lower.includes('what are') ||
      lower.includes('define') || lower.includes('list of') ||
      lower.includes("what's a") || lower.includes('whats a') ||
      lower.includes('motivat') || lower.includes('hello') || lower.includes('hey') ||
      lower.includes('hi ') || lower.includes('how are') || lower.includes('whats up') ||
      lower.includes("what's up") || lower.includes('weight') || lower.includes('lost') ||
      lower.includes('gained') || lower.includes('progress') || lower.includes('down') ||
      lower.includes('scale') || lower.includes('phase')
    );

    if (messageHasTextContent && !isClearlyNonMealQuery) {
      // Try meal analysis first - this ensures unrecognized items are passed to AI with facts
      const mealContext: CoachContext = {
        ...context,
        mealType: undefined, // Unknown meal type from chat
        mealDate: undefined,
      };
      const mealDataStructured = extractMealData(normalizedMessage, mealContext);
      const analysis = await analyzeMealPortion(normalizedMessage, mealContext, undefined);

      // If we found any recognized OR unrecognized items, use meal analysis pipeline
      if (mealDataStructured.recognizedItems.length > 0 || mealDataStructured.unrecognizedItems.length > 0) {
        const evalPrompt = getMealEvaluationPrompt(mealDataStructured, analysis, mealContext);
        const systemMessage: AIMessage = { role: 'system', content: evalPrompt };
        const mealResult = await chatWithChatAI([systemMessage], `My meal: ${normalizedMessage}`, preferredProvider);

        if (!mealResult.error && mealResult.text) {
          await persistAcceptedAllergies(supabase, normalizedMessage, client.allergies || [], client.custom_allergy_bans || [], clientId);
          return NextResponse.json({
            response: mealResult.text,
            type: 'meal_analysis',
            provider: mealResult.provider,
            _debug: { unrecognizedItems: mealDataStructured.unrecognizedItems },
          });
        }
        // AI failed for meal - fall through to coach prompt (not fallback)
      }
    }

    const coachPrompt = getCoachPrompt(context, message);
    // Add discovery tip when client mentions digestive issues and has opted into allergy discovery
    let discoveryTip = '';
    if (showDiscoveryTip) {
      const mealContextNote = context.lastMealFood
        ? ` Their most recent meal today was: ${context.lastMealFood}. Use these specific foods to guide your suspicion.`
        : '';
      discoveryTip = `\n\n⚠️ ALLERGY DISCOVERY TIP: This client has reported ${symptomCount} digestive symptom(s) in the last 7 days (bloating/stomach pain).${mealContextNote} If you suspect a food intolerance, offer to add the suspected food as a hard allergy so it will never be suggested again.`;
    }
    const systemMessage: AIMessage = { role: 'system', content: coachPrompt + discoveryTip };
    const result = await chatWithChatAI([systemMessage], message, preferredProvider);
    
    if (result.error || !result.text) {
      const fallback = await getFallbackResponse(message, context, clientId);
      return NextResponse.json({
        response: fallback,
        type: 'fallback',
        error: result.error,
        provider: result.provider,
      });
    }

    // Persist any accepted hard-allergy additions to the DB
    await persistAcceptedAllergies(supabase, message, client.allergies || [], client.custom_allergy_bans || [], clientId);

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

/**
 * Parses the user message for allergy-acceptance patterns and persists
 * any newly accepted foods as hard allergies in the clients DB row.
 *
 * Acceptance patterns (case-insensitive):
 *   - "yes add [food] as a hard allergy"
 *   - "please add [food] as a hard allergy"
 *   - "add [food] as a hard allergy"
 *   - "yes add [food] and [food] as hard allergies"
 *   - "yes please add [food]..."
 */
async function persistAcceptedAllergies(
  supabase: ReturnType<typeof getAdminClient>,
  message: string,
  currentAllergies: string[],
  currentCustomBans: string[],
  clientId: string
): Promise<void> {
  const lower = message.toLowerCase();

  // Check for allergy-acceptance intent
  const acceptPatterns = [
    /yes\s+(?:please\s+)?add\s+(.+?)\s+(?:as\s+a?\s*)?hard\s+allergies?/i,
    /add\s+(.+?)\s+(?:as\s+a?\s*)?hard\s+allergies?/i,
    /please\s+add\s+(.+?)\s+(?:as\s+a?\s*)?hard\s+allergies?/i,
    /yes\s+(?:please\s+)?add\s+(.+?)$/i,
  ];

  let foodListRaw: string | null = null;
  for (const pattern of acceptPatterns) {
    const m = lower.match(pattern);
    if (m) {
      foodListRaw = m[1];
      break;
    }
  }

  if (!foodListRaw) return;

  // Split on "," or "and" to get individual food names
  const foodNames = foodListRaw
    .split(/\s+and\s+|\s*,\s*/)
    .map(f => f.trim())
    .filter(f => f.length > 0);

  if (foodNames.length === 0) return;

  const newAllergyKeys: string[] = [];
  const newCustomBans: string[] = [];
  const lowerCustomBans = currentCustomBans.map(b => b.toLowerCase());

  for (const foodName of foodNames) {
    const allergyKey = findAllergyKeyForFood(foodName);
    if (allergyKey && !currentAllergies.includes(allergyKey)) {
      // Matches a preset allergy key → add to preset allergies
      newAllergyKeys.push(allergyKey);
    } else if (!allergyKey && !lowerCustomBans.includes(foodName.toLowerCase())) {
      // Doesn't match a preset key → add as a custom ban
      newCustomBans.push(foodName);
    }
  }

  if (newAllergyKeys.length === 0 && newCustomBans.length === 0) return;

  const updatedAllergies = Array.from(new Set([...currentAllergies, ...newAllergyKeys]));
  const updatedCustomBans = Array.from(new Set([...currentCustomBans, ...newCustomBans]));

  console.log(`[ALLERGY DISCOVERY] Adding preset allergies for client ${clientId}:`, newAllergyKeys);
  console.log(`[ALLERGY DISCOVERY] Adding custom bans for client ${clientId}:`, newCustomBans);

  const { error } = await supabase
    .from('clients')
    .update({
      allergies: updatedAllergies,
      custom_allergy_bans: updatedCustomBans,
    })
    .eq('id', clientId);

  if (error) {
    console.error('[ALLERGY DISCOVERY] Failed to persist allergies:', error);
  } else {
    console.log('[ALLERGY DISCOVERY] Successfully persisted allergies:', updatedAllergies, 'custom bans:', updatedCustomBans);
  }
}

function detectMealType(message: string): 'breakfast' | 'lunch' | 'dinner' | 'snack' {
  const lower = message.toLowerCase();
  if (lower.includes('breakfast') || lower.includes('morning') || lower.includes('eggs') || lower.includes('oatmeal')) return 'breakfast';
  if (lower.includes('lunch') || lower.includes('midday') || lower.includes('noon')) return 'lunch';
  if (lower.includes('dinner') || lower.includes('supper') || lower.includes('evening')) return 'dinner';
  if (lower.includes('snack') || lower.includes('crunch') || lower.includes('bite')) return 'snack';
  // Fallback to time-of-day in America/Chicago
  const chicagoTime = new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' });
  const hour = new Date(chicagoTime).getHours();
  if (hour < 10) return 'breakfast';
  if (hour < 17) return 'lunch';
  return 'dinner';
}

async function getFallbackResponse(message: string, context: CoachContext, clientId: string): Promise<string> {
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

  // GROCERY LIST GENERATION
  if (lower.includes('make my grocery list') || lower.includes('generate grocery list') ||
      lower.includes('grocery list') && (lower.includes('generate') || lower.includes('make') || lower.includes('create') || lower.includes('new'))) {
    try {
      const { getAdminClient } = await import('@/lib/db');
      const supabase = getAdminClient();

      // Get client profile
      const { data: client, error: clientError } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .single();

      if (clientError || !client) {
        return 'Sorry, I could not access your profile to generate a grocery list. Please try again later.';
      }

      // Import nutrition-data helpers (lazy to avoid circular deps)
      const {
        LEAN_PROTEINS,
        FIBROUS_VEGETABLES,
        HEALTHY_FATS,
        STARCHY_CARBOHYDRATES,
        filterFoodsForAllergies,
        getPortions,
      } = await import('@/lib/nutrition-data');

      // Define Phase5Day type locally since it's an interface
      type Phase5DayRule = { day: number; type: 'phase1' | 'phase2' | 'phase4'; label: string };

      const allergies: string[] = client.allergies || [];
      const customBans: string[] = client.custom_allergy_bans || [];
      const phase = client.current_phase || 1;
      const gender = client.gender === 'female' ? 'female' : 'male';
      const portions = getPortions(gender, phase);

      // Determine starch allowed
      let starchAllowed = false;
      if (phase === 2 || phase === 3 || phase === 4) starchAllowed = true;
      if (phase === 5 && client.phase5_plan && client.phase5_start_date) {
        try {
          const raw = typeof client.phase5_plan === 'string'
            ? JSON.parse(client.phase5_plan)
            : client.phase5_plan;
          const plan: Phase5DayRule[] = Array.isArray(raw) ? raw : (raw?.days || []);
          const startDate = client.phase5_start_date;
          const [y, m, d] = startDate.split('-').map(Number);
          const start = new Date(y, m - 1, d, 0, 0, 0);
          const now = new Date();
          const diffDays = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
          const currentDay = Math.min(14, Math.max(1, diffDays + 1));
          const todayRule = plan.find((d: { day: number }) => d.day === currentDay);
          starchAllowed = todayRule?.type === 'phase2' || todayRule?.type === 'phase4';
        } catch {
          starchAllowed = false;
        }
      }

      const proteins = filterFoodsForAllergies(LEAN_PROTEINS, allergies, customBans);
      const veggies = filterFoodsForAllergies(FIBROUS_VEGETABLES, allergies, customBans);
      const fats = filterFoodsForAllergies(HEALTHY_FATS, allergies, customBans);
      const starches = starchAllowed
        ? filterFoodsForAllergies(STARCHY_CARBOHYDRATES, allergies, customBans)
        : [];

      // Build items
      const items: Array<{ client_id: string; item_name: string; category: 'protein' | 'veggies' | 'starch' | 'fats' }> = [];

      items.push({ client_id: clientId, item_name: `${portions.protein} per meal × 7 days — your proteins:`, category: 'protein' });
      proteins.forEach(p => items.push({ client_id: clientId, item_name: `• ${p}`, category: 'protein' }));

      items.push({ client_id: clientId, item_name: `${portions.fibrousVegetables} per meal × 7 days — your veggies:`, category: 'veggies' });
      veggies.forEach(v => items.push({ client_id: clientId, item_name: `• ${v}`, category: 'veggies' }));

      items.push({ client_id: clientId, item_name: `${portions.fat} per meal × 7 days — your fats:`, category: 'fats' });
      fats.forEach(f => items.push({ client_id: clientId, item_name: `• ${f}`, category: 'fats' }));

      if (starchAllowed && starches.length > 0) {
        items.push({ client_id: clientId, item_name: `${portions.starch} per meal × 7 days — your starches:`, category: 'starch' });
        starches.forEach(s => items.push({ client_id: clientId, item_name: `• ${s}`, category: 'starch' }));
      }

      // Clear and insert
      await supabase.from('client_grocery_items').delete().eq('client_id', clientId);
      const { error: insertError } = await supabase.from('client_grocery_items').insert(items);

      if (insertError) {
        console.error('Chat grocery insert error:', insertError);
        return 'I had trouble saving your grocery list. Please try again or visit the Grocery page directly.';
      }

      const totalItems = items.length;
      const starchNote = starchAllowed
        ? `${starches.length} starch options`
        : 'No starch (Phase 1 or 6)';

      return `🛒 Your Smart Grocery List is ready!

I've generated a personalized grocery list for you with:
• ${proteins.length} protein options
• ${veggies.length} veggie options
• ${fats.length} fat options
• ${starchNote}

Visit the Grocery page (🛒 icon in the nav) to see your full list and check items as you shop. You can generate a new list anytime!`;
    } catch (err) {
      console.error('Chat grocery generation error:', err);
      return 'I had trouble generating your grocery list. Please try again or visit the Grocery page directly.';
    }
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
      const fatPortion = getPortions(context.gender, context.currentPhase).fat;
      return `Healthy fats for your meals:

• ${HEALTHY_FATS.join('\n• ')}

Your portion: ${fatPortion} per meal

Use sparingly! Good fats support hormone health and nutrient absorption. 💪`;
    }
  }

  // MEAL PLAN / WHAT TO EAT queries → give actual meal suggestion
  if (lower.includes('what can i eat') || lower.includes('what to eat') || lower.includes('what should i eat') ||
      lower.includes('meal plan') || lower.includes('example meal') || lower.includes('my plan') ||
      lower.includes('show me what') || lower.includes('give me a') || lower.includes('next meal')) {
    try {
      const detectedMealType = detectMealType(message);
      const suggestion = generateMealSuggestion(
        {
          gender: context.gender as 'male' | 'female',
          currentPhase: context.currentPhase,
          phase5StartDate: context.phase5StartDate,
          phase5Plan: context.phase5Plan,
          allergies: context.allergies,
          custom_allergy_bans: context.custom_allergy_bans,
        },
        detectedMealType
      );
      const response = formatMealSuggestion(suggestion);
      return response;
    } catch (e) {
      console.error('Meal suggestion error:', e);
      // Fall through to AI if rule-based fails
    }
  }

  // MEAL / FOOD queries → use rule-based meal analyzer
  // Note: 'what can i', 'what should i', 'what am i' removed so specific handlers above can catch them
  if (lower.includes('eat') || lower.includes('meal') || lower.includes('food') ||
      lower.includes('breakfast') || lower.includes('lunch') || lower.includes('dinner') ||
      lower.includes('snack') || lower.includes('chicken') || lower.includes('beef') ||
      lower.includes('veggie') || lower.includes('vegetable') ||
      lower.includes('fat') || lower.includes('starch') ||
      lower.includes('banana') || lower.includes('apple') || lower.includes('orange') ||
      lower.includes('yogurt') || lower.includes('fruit')) {
    const fallback = await analyzeMealPortion(message, context);
    return fallback.portionAdvice;
  }

  // PORTION SIZES - simple response (no AI, no markdown)
  if (lower.includes('portion size') || lower.includes('portion sizes')) {
    const isMale = context.gender === 'male';
    const isPhase6 = context.currentPhase === 6;
    const protein = isMale ? '6oz' : '4oz';
    const veggies = isMale ? '2 cups' : '1-2 cups';
    const fat = isPhase6 ? (isMale ? '3 tbsp' : '2 tbsp') : (isMale ? '2 tbsp' : '1 tbsp');
    const starch = isPhase6 ? (isMale ? '3 cups' : '2 cups') : (isMale ? '2 cups' : '1 cup');
    return `Your portions per meal:\nProtein: ${protein}\nStarch: ${starch}\nVegetables: ${veggies}\nHealthy fats: ${fat} or 1/2 avocado`;
  }

  // PORTION / SIZE queries (only if NOT a phase question)
  if ((lower.includes('portion') || lower.includes('size') ||
      lower.includes('ounce') || lower.includes('cup') || lower.includes('tablespoon') ||
      lower.includes('how much') || lower.includes('amount')) && !lower.includes('phase')) {
    const waterAmount = context.gender === 'male' ? '32oz per meal' : '20oz per meal';
    const portions = context.gender === 'male'
      ? '6oz protein, 2 cups veggies, 2 tbsp fat per meal. No starch in Phase 1!'
      : '4oz protein, 1-2 cups veggies, 1 tbsp fat per meal. No starch in Phase 1!';
    return `Phase ${context.currentPhase} portions: ${portions} ${waterAmount} water. Keep crushing it! 💪`;
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
    case 4:
      return 'Maintenance mode — add starch to every meal, weigh Fridays only.';
    default:
      return 'Keep following your plan!';
  }
}
