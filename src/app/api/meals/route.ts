import { NextRequest, NextResponse } from 'next/server';
import { db_all, db_get, db_run, getAdminClient, MealLog } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { generatePhase5Plan } from '@/lib/ai-coach';

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

        // Check phase transitions
        let newPhase = currentPhase;
        let resetStreak = false;

        // Phase 1 → Phase 2: 14+ days in phase (simple, no extension)
        if (currentPhase === 1 && daysInPhase >= 14) {
          // Phase 1 → Phase 2: 14+ days in phase
          newPhase = 2;
          resetStreak = true;
          // Store current weight as phase2_start_weight for weight-based Phase 2 duration
          const { data: clientForWeight } = await supabase
            .from('clients')
            .select('current_weight')
            .eq('id', clientId)
            .single();
          if (clientForWeight?.current_weight) {
            await supabase
              .from('clients')
              .update({ phase2_start_weight: clientForWeight.current_weight })
              .eq('id', clientId);
          }
        } else if (currentPhase === 2 && daysInPhase >= 7) {
          // Phase 2 → Phase 4 (goal) or Phase 1 (not at goal): weight-based duration
          // If >2 lbs lost in Phase 2, need 14 days; otherwise 7 days
          const { data: clientForPhase2 } = await supabase
            .from('clients')
            .select('current_weight, phase2_start_weight, goal_weight')
            .eq('id', clientId)
            .single();
          const phase2StartWeight = clientForPhase2?.phase2_start_weight;
          const currentWeight = clientForPhase2?.current_weight;
          const goalWeight = clientForPhase2?.goal_weight;
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
        
        // Phase 5: Check if plan has expired and needs regeneration
        // Plan expires after 3 days (day 1, 2, 3 = 3 days total)
        if (currentPhase === 5 && client.phase5_start_date) {
          const phase5StartDate = new Date(client.phase5_start_date + 'T12:00:00');
          const daysSinceStart = Math.floor((new Date(now).getTime() - phase5StartDate.getTime()) / (1000 * 60 * 60 * 24));
          if (daysSinceStart >= 3) {
            // Plan expired - generate new 3-day plan
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
            // Phase 5 plan regenerated - skip phase transition logic
            return NextResponse.json({
              success: true,
              mealId,
              message: 'Meal logged successfully',
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

    return NextResponse.json({
      success: true,
      mealId,
      message: 'Meal logged successfully',
    });
  } catch (error) {
    console.error('Log meal error:', error);
    return NextResponse.json({ error: 'Failed to log meal' }, { status: 500 });
  }
}
