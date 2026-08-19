import { NextRequest, NextResponse } from 'next/server';
import { db_all, db_get, db_run, getAdminClient, MealLog } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { generatePhase5Plan, getTomorrowPhase, getTomorrowStarchMessage } from '@/lib/ai-coach';

// GET - Fetch meal logs for a client
export async function GET(request: NextRequest) {
  let supabase;
  try {
    supabase = getAdminClient();
  } catch (e) {
    console.error('Admin client not available:', e);
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  try {
    const clientId = request.headers.get('x-client-id');
    if (!clientId) {
      return NextResponse.json({ error: 'Client ID required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Use admin client to bypass RLS
    const { data: meals, error } = await supabase
      .from('meals')
      .select('*')
      .eq('client_id', clientId)
      .order('logged_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Get meals error:', error);
      return NextResponse.json({ error: 'Failed to fetch meals' }, { status: 500 });
    }

    return NextResponse.json({ meals: meals || [] });
  } catch (error) {
    console.error('Get meals error:', error);
    return NextResponse.json({ error: 'Failed to fetch meals' }, { status: 500 });
  }
}

// POST - Log a new meal
export async function POST(request: NextRequest) {
  let supabase;
  try {
    supabase = getAdminClient();
  } catch (e) {
    console.error('Admin client not available:', e);
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  try {
    const clientId = request.headers.get('x-client-id');
    if (!clientId) {
      return NextResponse.json({ error: 'Client ID required' }, { status: 401 });
    }

    const body = await request.json();
    const { mealType, mealDate, foodDescription, photoUrl, analyzedText, portionAdvice, onPhase, messedUp } = body;

    if (!mealType) {
      return NextResponse.json({ error: 'Meal type is required' }, { status: 400 });
    }

    const mealId = uuidv4();
    const now = new Date().toISOString();

    // Use admin client to insert meal (bypasses RLS)
    const { error: insertError } = await supabase.from('meals').insert({
      id: mealId,
      client_id: clientId,
      meal_type: mealType,
      food_description: foodDescription || null,
      photo_url: photoUrl || null,
      analyzed_text: analyzedText || null,
      portion_advice: portionAdvice || null,
      on_phase: onPhase ? 1 : 0,
      messed_up: messedUp ? 1 : 0,
      photo_analyzed: photoUrl ? 1 : 0,
      logged_at: now,
    });

    if (insertError) {
      console.error('Meal insert error:', insertError);
      return NextResponse.json({ error: 'Failed to log meal' }, { status: 500 });
    }

    // Phase progression: update streak and check phase transitions
    try {
      const { data: client, error: clientError } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .single();

      if (!clientError && client) {
        const currentPhase = client.current_phase || 1;
        const phaseStartDate = client.phase_start_date || now;
        const currentStreak = client.good_meal_streak || 0;
        const daysInPhase = Math.floor((new Date(now).getTime() - new Date(phaseStartDate).getTime()) / (1000 * 60 * 60 * 24));

        // Update streak: increment on good meal, reset to 0 on messed up
        const newStreak = (onPhase && !messedUp) ? currentStreak + 1 : 0;

        // Check phase transitions based on program_type
        let newPhase = currentPhase;
        let resetStreak = false;
        const programType = client.program_type || 'get_shredded';
        const goalWeight = client.goal_weight;
        const currentWeight = client.current_weight;

        // GET_SHREDDED: Phase 1 ↔ Phase 5 (14 days each)
        if (programType === 'get_shredded' && newPhase === currentPhase) {
          // Phase 1 → Phase 5: After 14 days
          if (currentPhase === 1 && daysInPhase >= 14) {
            newPhase = 5;
            resetStreak = true;
          }
          // Phase 5 → Phase 1: After 14 days
          else if (currentPhase === 5 && daysInPhase >= 14) {
            newPhase = 1;
            resetStreak = true;
          }
          // Phase 4: If 5+ lbs over goal → Phase 1
          else if (currentPhase === 4 && goalWeight && currentWeight && currentWeight > goalWeight + 5) {
            newPhase = 1;
            resetStreak = true;
          }
        }
        // EVENT_READY: Phase 1 → Phase 2 (14 days), Phase 2 → Phase 1 (7 days)
        else if (programType === 'event_ready' && newPhase === currentPhase) {
          // Phase 1 → Phase 2: After 14 days
          if (currentPhase === 1 && daysInPhase >= 14) {
            newPhase = 2;
            resetStreak = true;
            // Store current weight as phase2_start_weight for weight-based Phase 2 duration
            if (currentWeight) {
              await supabase
                .from('clients')
                .update({ phase2_start_weight: currentWeight })
                .eq('id', clientId);
            }
          }
          // Phase 2 → Phase 1 or Phase 4 (goal): weight-based duration
          else if (currentPhase === 2 && daysInPhase >= 7) {
            const { data: clientForPhase2 } = await supabase
              .from('clients')
              .select('current_weight, phase2_start_weight, goal_weight')
              .eq('id', clientId)
              .single();
            const phase2StartWeight = clientForPhase2?.phase2_start_weight;
            const weightLostInPhase2 = phase2StartWeight && currentWeight ? phase2StartWeight - currentWeight : 0;
            const phase2Duration = weightLostInPhase2 > 2 ? 14 : 7;
            if (daysInPhase >= phase2Duration) {
              if (goalWeight && currentWeight && currentWeight <= goalWeight) {
                newPhase = 4;
              } else {
                newPhase = 1;
              }
              resetStreak = true;
            }
          }
          // Phase 4: If 5+ lbs over goal → Phase 1
          else if (currentPhase === 4 && goalWeight && currentWeight && currentWeight > goalWeight + 5) {
            newPhase = 1;
            resetStreak = true;
          }
        }
        // GENERAL_HEALTH: Phase 4 ↔ Phase 1 (4+ lbs gain triggers Phase 1, 7 days returns to Phase 4)
        else if (programType === 'general_health' && newPhase === currentPhase) {
          // Phase 4 → Phase 1: If client GAINS 4+ lbs over goal
          if (currentPhase === 4 && goalWeight && currentWeight && currentWeight > goalWeight + 4) {
            newPhase = 1;
            resetStreak = true;
          }
          // Phase 1 → Phase 4: After 7 days
          else if (currentPhase === 1 && daysInPhase >= 7) {
            newPhase = 4;
            resetStreak = true;
          }
        }
        // MUSCLE_GAIN: Phase 6 ↔ Phase 4 (at goal = Phase 4, 4+ lbs below = Phase 6)
        else if (programType === 'muscle_gain' && newPhase === currentPhase) {
          // Phase 4 → Phase 6: If weight drops 4+ lbs below goal (independent check)
          if (currentPhase === 4 && goalWeight && currentWeight && currentWeight < goalWeight - 4) {
            newPhase = 6;
            resetStreak = true;
          }
          // Phase 6 → Phase 4: At goal (only trigger when transitioning FROM Phase 6)
          else if (currentPhase === 6 && goalWeight && currentWeight && currentWeight >= goalWeight) {
            newPhase = 4;
            resetStreak = true;
          }
          // Initial goal attainment (from Phase 6) → Phase 4
          // This is handled above by the Phase 6 → Phase 4 check
        }
        
        // Phase 5: Check if plan has expired and needs regeneration
        // Plan expires after 14 days
        // Note: streak is updated as part of this update (newStreak was computed above)
        if (currentPhase === 5 && client.phase5_start_date) {
          const phase5StartDate = new Date(client.phase5_start_date + 'T12:00:00');
          const daysSinceStart = Math.floor((new Date(now).getTime() - phase5StartDate.getTime()) / (1000 * 60 * 60 * 24));
          if (daysSinceStart >= 14) {
            // Plan expired - generate new 14-day plan
            const newPhase5Plan = generatePhase5Plan();
            await supabase
              .from('clients')
              .update({
                phase5_plan: JSON.stringify(newPhase5Plan),
                phase5_start_date: now.split('T')[0], // YYYY-MM-DD
                good_meal_streak: newStreak,
                updated_at: now,
              })
              .eq('id', clientId);
            // Phase 5 plan regenerated - return early but streak was already updated above
            // Still compute tomorrow's plan message for the new plan
            let tomorrowsPlanForRegen = '';
            try {
              const tomorrowType = getTomorrowPhase(newPhase5Plan, now.split('T')[0]);
              tomorrowsPlanForRegen = getTomorrowStarchMessage(tomorrowType, true, newPhase5Plan, now.split('T')[0]);
            } catch (e) {
              console.error('Error computing tomorrow plan:', e);
            }
            return NextResponse.json({
              success: true,
              mealId,
              message: tomorrowsPlanForRegen ? `Meal logged. ${tomorrowsPlanForRegen}` : 'Meal logged successfully',
              tomorrowsPlan: tomorrowsPlanForRegen,
              phase5PlanRegenerated: true,
            });
          }
        }

        if (newPhase !== currentPhase) {
          // Advance phase and reset phase_start_date
          await supabase
            .from('clients')
            .update({
              current_phase: newPhase,
              phase_start_date: now,
              good_meal_streak: resetStreak ? 0 : newStreak,
              updated_at: now,
            })
            .eq('id', clientId);
        } else if (newStreak !== currentStreak) {
          // Just update streak
          await supabase
            .from('clients')
            .update({
              good_meal_streak: newStreak,
              updated_at: now,
            })
            .eq('id', clientId);
        }
      }
    } catch (phaseErr) {
      console.error('Phase progression error:', phaseErr);
      // Don't fail meal logging if phase logic fails
    }

    // Check if this is the last meal of the day (dinner) and compute tomorrow's plan message
    // Also handle "lunch with no dinner" case by checking today's meals
    let tomorrowsPlanMessage = '';
    if (mealType === 'dinner' || mealType === 'lunch') {
      // For lunch, check if dinner exists for today
      let isLastMealOfDay = mealType === 'dinner';
      if (mealType === 'lunch' && !isLastMealOfDay) {
        // Check if dinner exists for today
        const today = now.split('T')[0]; // YYYY-MM-DD
        const { data: todayMeals } = await supabase
          .from('meals')
          .select('meal_type')
          .eq('client_id', clientId)
          .gte('logged_at', today + 'T00:00:00')
          .lte('logged_at', today + 'T23:59:59')
          .eq('meal_type', 'dinner');
        isLastMealOfDay = !todayMeals || todayMeals.length === 0;
      }
      
      if (isLastMealOfDay) {
        // Get client's Phase 5 data to compute tomorrow's plan
        const { data: clientForPlan } = await supabase
          .from('clients')
          .select('phase5_plan, phase5_start_date, current_phase, program_type')
          .eq('id', clientId)
          .single();
        
        if (clientForPlan && clientForPlan.current_phase === 5 && clientForPlan.phase5_plan) {
          try {
            const phase5Plan = JSON.parse(clientForPlan.phase5_plan);
            const tomorrowType = getTomorrowPhase(phase5Plan, clientForPlan.phase5_start_date || '');
            tomorrowsPlanMessage = getTomorrowStarchMessage(tomorrowType, true, phase5Plan, clientForPlan.phase5_start_date);
          } catch (e) {
            console.error('Error computing tomorrow plan:', e);
          }
        } else if (clientForPlan && clientForPlan.program_type === 'get_shredded') {
          // get_shredded clients not in Phase 5 yet - show generic tomorrow message
          // They're likely in Phase 1 (no starch)
          tomorrowsPlanMessage = getTomorrowStarchMessage('phase1', false);
        }
      }
    }

    return NextResponse.json({
      success: true,
      mealId,
      message: tomorrowsPlanMessage ? `Meal logged successfully. ${tomorrowsPlanMessage}` : 'Meal logged successfully',
      tomorrowsPlan: tomorrowsPlanMessage,
    });
  } catch (error) {
    console.error('Log meal error:', error);
    return NextResponse.json({ error: 'Failed to log meal' }, { status: 500 });
  }
}
