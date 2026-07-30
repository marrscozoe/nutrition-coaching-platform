import { NextRequest, NextResponse } from 'next/server';
import { db_all, db_get, db_run, MealLog } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

// GET - Fetch meal logs for a client
export async function GET(request: NextRequest) {
  try {
    const clientId = request.headers.get('x-client-id');
    if (!clientId) {
      return NextResponse.json({ error: 'Client ID required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = parseInt(searchParams.get('offset') || '0');

    const meals = await db_all(
      `SELECT * FROM meals 
       WHERE client_id = ? 
       ORDER BY logged_at DESC 
       LIMIT ? OFFSET ?`,
      clientId, limit, offset
    );

    return NextResponse.json({ meals });
  } catch (error) {
    console.error('Get meals error:', error);
    return NextResponse.json({ error: 'Failed to fetch meals' }, { status: 500 });
  }
}

// POST - Log a new meal
export async function POST(request: NextRequest) {
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
    // mealDate is the date the meal was eaten (may be today or a past/future day)
    // If not provided, defaults to today
    const effectiveMealDate = mealDate || now.split('T')[0];

    // Ensure meal_date column exists (add if missing)
    try {
      await db_run(`ALTER TABLE meals ADD COLUMN meal_date TEXT`);
    } catch (e: any) {
      // Column may already exist, ignore error
      if (!e.message?.includes('duplicate column') && !e.message?.includes('no such column')) {
        console.log('meal_date column note:', e.message);
      }
    }

    await db_run(
      `INSERT INTO meals (id, client_id, meal_type, food_description, photo_url, analyzed_text, portion_advice, on_phase, messed_up, photo_analyzed, logged_at, meal_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      mealId, clientId, mealType, foodDescription || null, photoUrl || null, analyzedText || null, portionAdvice || null, onPhase ? 1 : 0, messedUp ? 1 : 0, photoUrl ? 1 : 0, now, effectiveMealDate
    );

    // Phase progression: update streak and check phase transitions
    try {
      const client = await db_get('SELECT * FROM clients WHERE id = ?', clientId) as any;
      if (client) {
        const currentPhase = client.current_phase || 1;
        const phaseStartDate = client.phase_start_date || now;
        const currentStreak = client.good_meal_streak || 0;
        const daysInPhase = Math.floor((new Date(now).getTime() - new Date(phaseStartDate).getTime()) / (1000 * 60 * 60 * 24));

        // Update streak: increment on good meal, reset to 0 on messed up
        const newStreak = (onPhase && !messedUp) ? currentStreak + 1 : 0;

        // Check phase transitions
        let newPhase = currentPhase;
        let resetStreak = false;

        if (currentPhase === 1 && daysInPhase >= 14 && newStreak >= 10) {
          // Phase 1 → Phase 2: 14+ days AND 10+ good meal streak
          newPhase = 2;
          resetStreak = true;
        } else if (currentPhase === 2 && daysInPhase >= 7 && client.current_weight < client.starting_weight) {
          // Phase 2 → Phase 3: 7+ days AND weight is improving
          newPhase = 3;
          resetStreak = true;
        }

        if (newPhase !== currentPhase) {
          // Advance phase and reset phase_start_date
          await db_run(
            `UPDATE clients SET current_phase = ?, phase_start_date = ?, good_meal_streak = ?, updated_at = ? WHERE id = ?`,
            newPhase, now, resetStreak ? 0 : newStreak, now, clientId
          );
        } else if (newStreak !== currentStreak) {
          // Just update streak
          await db_run(
            `UPDATE clients SET good_meal_streak = ?, updated_at = ? WHERE id = ?`,
            newStreak, now, clientId
          );
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
