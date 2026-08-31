import { NextRequest, NextResponse } from 'next/server';
import { db_all, db_run, getAdminClient, insertCoachMessage, hasRecentCoachMessage } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

// GET - Fetch weight history for a client
export async function GET(request: NextRequest) {
  try {
    const clientId = request.headers.get('x-client-id');
    if (!clientId) {
      return NextResponse.json({ error: 'Client ID required' }, { status: 401 });
    }

    const weighIns = await db_all(
      `SELECT * FROM weigh_ins 
       WHERE client_id = ? 
       ORDER BY created_at DESC 
       LIMIT 20`,
      clientId
    );

    return NextResponse.json({ weighIns });
  } catch (error) {
    console.error('Get weight error:', error);
    return NextResponse.json({ error: 'Failed to fetch weight' }, { status: 500 });
  }
}

// POST - Log a new weight
export async function POST(request: NextRequest) {
  try {
    const clientId = request.headers.get('x-client-id');
    if (!clientId) {
      return NextResponse.json({ error: 'Client ID required' }, { status: 401 });
    }

    const body = await request.json();
    const { weight, bodyFatPercent, pantSize, waistSize, notes, weighDay } = body;

    if (!weight) {
      return NextResponse.json({ error: 'Weight is required' }, { status: 400 });
    }

    const weighInId = uuidv4();
    const now = new Date().toISOString();

    // Insert weigh-in
    await db_run(
      `INSERT INTO weigh_ins (id, client_id, weight, body_fat_percent, pant_size, waist_size, notes, weigh_day, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      weighInId, clientId, weight, bodyFatPercent || null, pantSize || null, waistSize || null, notes || null, weighDay || null, now
    );

    // Check for milestones - use admin client to bypass RLS
    const supabase = getAdminClient();
    const { data: client } = await supabase.from('clients').select('*').eq('id', clientId).single();

    // If starting_weight is not set, set it to this first weight
    if (!client?.starting_weight) {
      await db_run(
        `UPDATE clients SET starting_weight = ?, current_weight = ?, phase_start_date = ?, current_week = 1, updated_at = ? WHERE id = ?`,
        weight, weight, now, now, clientId
      );
    } else {
      // Update client's current weight
      await db_run(
        `UPDATE clients SET current_weight = ?, updated_at = ? WHERE id = ?`,
        weight, now, clientId
      );

      // Phase progression check on weight log
      try {
        const { data: updatedClient } = await supabase.from('clients').select('*').eq('id', clientId).single();
        if (updatedClient) {
          const currentPhase = updatedClient.current_phase || 1;
          const goalWeight = updatedClient.goal_weight;
          const phaseStartDate = updatedClient.phase_start_date || now;
          const daysInPhase = Math.floor((new Date(now).getTime() - new Date(phaseStartDate).getTime()) / (1000 * 60 * 60 * 24));
          const programType = updatedClient.program_type;

          let newPhase = currentPhase;
          let resetPhaseStart = false;

          // GOAL ATTAINED - check FIRST (except for muscle_gain and general_health)
          // muscle_gain handles Phase 6 → Phase 4 via its own check below
          // general_health stays in maintenance phase only (no auto-transition to Phase 4)
          if (goalWeight && currentPhase !== 4 && programType !== 'muscle_gain' && programType !== 'general_health') {
            const atGoal = (weight <= goalWeight);
            if (atGoal) {
              newPhase = 4;
              resetPhaseStart = true;
            }
          }

          // ===== PROGRAM-SPECIFIC PHASE TRANSITIONS =====

          // GET_SHREDDED: Phase 1 ↔ Phase 5 (14 days each), Phase 4 when 4+ lbs over goal
          if (programType === 'get_shredded' && newPhase === currentPhase) {
            // Phase 1 → Phase 5: After 14 days
            if (currentPhase === 1 && daysInPhase >= 14) {
              newPhase = 5;
              resetPhaseStart = true;
            }
            // Phase 5 → Phase 1 OR Phase 4 (goal attained): After 14 days
            else if (currentPhase === 5 && daysInPhase >= 14) {
              if (goalWeight && weight <= goalWeight) {
                newPhase = 4; // Goal attained → maintenance
              } else {
                newPhase = 1; // Goal not attained → restart
              }
              resetPhaseStart = true;
            }
            // Phase 4: If 4+ lbs over goal → Phase 1
            else if (currentPhase === 4 && goalWeight && weight > goalWeight + 4) {
              newPhase = 1;
              resetPhaseStart = true;
            }
          }

          // EVENT_READY: Phase 1 → Phase 2 (14 days), Phase 2 → Phase 1/4 (7 days), Phase 4 when 4+ lbs over goal
          else if (programType === 'event_ready' && newPhase === currentPhase) {
            // Phase 1 → Phase 2: After 14 days
            if (currentPhase === 1 && daysInPhase >= 14) {
              newPhase = 2;
              resetPhaseStart = true;
            }
            // Phase 2 → Phase 1 or Phase 4 (goal attained): 7 days
            else if (currentPhase === 2 && daysInPhase >= 7) {
              if (goalWeight && weight <= goalWeight) {
                newPhase = 4; // Goal attained → maintenance
              } else {
                newPhase = 1; // Goal not attained → restart
              }
              resetPhaseStart = true;
            }
            // Phase 4: If 4+ lbs over goal → Phase 1
            else if (currentPhase === 4 && goalWeight && weight > goalWeight + 4) {
              newPhase = 1;
              resetPhaseStart = true;
            }
          }

          // GENERAL_HEALTH: Phase 4 ONLY — if 4+ lbs over goal, AI/trainer advises to switch programs or adjust goal, no phase change

          // MUSCLE_GAIN: Phase 4 → Phase 6 when 4+ lbs below goal; Phase 6 → Phase 4 when at or above goal
          else if (programType === 'muscle_gain' && newPhase === currentPhase) {
            // Phase 6 → Phase 4: at or above goal weight → maintenance
            if (currentPhase === 6 && goalWeight && weight >= goalWeight) {
              newPhase = 4;
              resetPhaseStart = true;
            }
            // Phase 4 → Phase 6: weight drops 4+ lbs below goal
            else if (currentPhase === 4 && goalWeight && weight < goalWeight - 4) {
              newPhase = 6;
              resetPhaseStart = true;
            }
          }

          // Calculate current_week based on phase and days in phase
          let newWeek = updatedClient.current_week || 1;
          if (currentPhase === 1) {
            newWeek = 1;
          } else if (currentPhase === 2) {
            newWeek = Math.min(2, Math.floor(daysInPhase / 7) + 1);
          } else if (currentPhase === 5) {
            newWeek = Math.min(3, Math.floor(daysInPhase / 14) + 1);
          } else if (currentPhase === 4 || currentPhase === 6) {
            newWeek = 4;
          }

          if (newPhase !== currentPhase) {
            if (newPhase === 4) {
              // Transitioning to Phase 4 (maintenance): reset streak
              await db_run(
                `UPDATE clients SET current_phase = ?, phase_start_date = ?, current_week = ?, good_meal_streak = 0, updated_at = ? WHERE id = ?`,
                newPhase, resetPhaseStart ? now : phaseStartDate, newWeek, now, clientId
              );
            } else {
              await db_run(
                `UPDATE clients SET current_phase = ?, phase_start_date = ?, current_week = ?, updated_at = ? WHERE id = ?`,
                newPhase, resetPhaseStart ? now : phaseStartDate, newWeek, now, clientId
              );
            }
          } else if (newWeek !== updatedClient.current_week) {
            // Update week even if phase didn't change
            await db_run(
              `UPDATE clients SET current_week = ?, updated_at = ? WHERE id = ?`,
              newWeek, now, clientId
            );
          }
        }
      } catch (phaseErr) {
        console.error('Phase progression check error:', phaseErr);
      }
    }

    const startingWeight = client?.starting_weight || weight;
    // For muscle_gain, positive = weight gained; for others, positive = weight lost
    const isMuscleGain = client?.program_type === 'muscle_gain';
    const weightChange = startingWeight - weight; // positive = lost, negative = gained
    const weightLost = isMuscleGain ? -(weightChange) : weightChange;

    const milestones: string[] = [];

    // Goal check: for muscle_gain, goal is HIGHER weight (weight >= goalWeight)
    // For other programs, goal is LOWER weight (weight <= goalWeight)
    const atGoal = isMuscleGain ? (weight >= client?.goal_weight) : (weight <= client?.goal_weight);

    if (client?.goal_weight && atGoal) {
      // Check if goal milestone already exists (don't duplicate)
      const { data: existingGoal } = await supabase.from('milestones').select('id').eq('client_id', clientId).eq('milestone_type', 'goal').single();
      if (!existingGoal) {
        await db_run(
          `INSERT INTO milestones (id, client_id, milestone_type, achieved_at) VALUES (?, ?, 'goal', ?)`,
          uuidv4(), clientId, now
        );
        milestones.push('goal');
      }
    } else if (weightLost >= 30) {
      const { data: existing } = await supabase.from('milestones').select('id').eq('client_id', clientId).eq('milestone_type', '30lb').single();
      if (!existing) {
        await db_run(
          `INSERT INTO milestones (id, client_id, milestone_type, achieved_at) VALUES (?, ?, '30lb', ?)`,
          uuidv4(), clientId, now
        );
        milestones.push('30lb');
      }
    } else if (weightLost >= 20) {
      const { data: existing } = await supabase.from('milestones').select('id').eq('client_id', clientId).eq('milestone_type', '20lb').single();
      if (!existing) {
        await db_run(
          `INSERT INTO milestones (id, client_id, milestone_type, achieved_at) VALUES (?, ?, '20lb', ?)`,
          uuidv4(), clientId, now
        );
        milestones.push('20lb');
      }
    } else if (weightLost >= 10) {
      const { data: existing } = await supabase.from('milestones').select('id').eq('client_id', clientId).eq('milestone_type', '10lb').single();
      if (!existing) {
        await db_run(
          `INSERT INTO milestones (id, client_id, milestone_type, achieved_at) VALUES (?, ?, '10lb', ?)`,
          uuidv4(), clientId, now
        );
        milestones.push('10lb');
      }
    }

    // ===== GENERAL_HEALTH: Check if 4+ lbs over goal and send coach message =====
    let coachMessage: { id: string; content: string; message_type: string; created_at: string } | null = null;
    if (client?.program_type === 'general_health' && client?.goal_weight && weight > client.goal_weight + 4) {
      // Only send if we haven't sent a recent goal_alert message (within 24 hours)
      const hasRecent = await hasRecentCoachMessage(clientId, 'goal_alert', 24);
      if (!hasRecent) {
        const clientName = client.name || 'there';
        const messageContent = `Hey ${clientName}! I noticed you're 4+ lbs over your goal weight. You're on the General Health (maintenance) program. Want to keep making progress? Consider switching to EVENT READY or GET SHREDDED to lose that weight. Or if you're happy with where you're at, we can adjust your goal weight. Just let me know!`;
        const result = await insertCoachMessage(clientId, messageContent, 'goal_alert');
        if (result.success && result.messageId) {
          coachMessage = {
            id: result.messageId,
            content: messageContent,
            message_type: 'goal_alert',
            created_at: now,
          };
        }
      }
    }

    return NextResponse.json({
      success: true,
      weighInId,
      weightLost: Math.round(weightLost * 10) / 10,
      milestones,
      message: 'Weight logged successfully',
      coachMessage,
    });
  } catch (error) {
    console.error('Log weight error:', error);
    return NextResponse.json({ error: 'Failed to log weight' }, { status: 500 });
  }
}
