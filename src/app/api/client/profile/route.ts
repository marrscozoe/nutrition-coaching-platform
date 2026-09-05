import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/db';

// GET /api/client/profile — return client profile including allergies array
export async function GET(request: NextRequest) {
  try {
    const clientId = request.headers.get('x-client-id');
    if (!clientId) {
      return NextResponse.json({ error: 'Client ID required' }, { status: 401 });
    }

    const supabase = getAdminClient();
    const { data: client, error } = await supabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .single();

    if (error || !client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // Return profile data including allergies
    return NextResponse.json({
      id: client.id,
      name: client.name,
      email: client.email,
      gender: client.gender,
      program_type: client.program_type,
      current_phase: client.current_phase,
      starting_weight: client.starting_weight,
      current_weight: client.current_weight,
      goal_weight: client.goal_weight,
      goal_start_date: client.goal_start_date,
      event_date: client.event_date,
      notes: client.notes,
      allergies: client.allergies || [],
      allergy_discovery_enabled: client.allergy_discovery_enabled ?? false,
      photo_meal_log_enabled: client.photo_meal_log_enabled ?? false,
      created_at: client.created_at,
    });
  } catch (error) {
    console.error('GET /api/client/profile error:', error);
    return NextResponse.json({ error: 'Failed to get profile' }, { status: 500 });
  }
}

// PATCH /api/client/profile — update profile fields including allergies
export async function PATCH(request: NextRequest) {
  try {
    const clientId = request.headers.get('x-client-id');
    if (!clientId) {
      return NextResponse.json({ error: 'Client ID required' }, { status: 401 });
    }

    const body = await request.json();
    const { allergies, allergy_discovery_enabled, photo_meal_log_enabled, name, gender, goal_weight, starting_weight, program_type, event_date } = body;

    const supabase = getAdminClient();

    // Build update object — only include provided fields
    const updates: Record<string, any> = {};
    if (allergies !== undefined) updates.allergies = allergies;
    if (allergy_discovery_enabled !== undefined) updates.allergy_discovery_enabled = allergy_discovery_enabled;
    if (photo_meal_log_enabled !== undefined) updates.photo_meal_log_enabled = photo_meal_log_enabled;
    if (name !== undefined) updates.name = name;
    if (gender !== undefined) updates.gender = gender;
    if (goal_weight !== undefined) updates.goal_weight = goal_weight;
    if (starting_weight !== undefined) updates.starting_weight = starting_weight;
    if (program_type !== undefined) updates.program_type = program_type;
    if (event_date !== undefined) updates.event_date = event_date;
    updates.updated_at = new Date().toISOString();

    if (Object.keys(updates).length === 1 && updates.updated_at) {
      // Only updated_at — nothing meaningful to update
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const { data: updated, error } = await supabase
      .from('clients')
      .update(updates)
      .eq('id', clientId)
      .select()
      .single();

    if (error) {
      console.error('PATCH /api/client/profile error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      client: {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        gender: updated.gender,
        allergies: updated.allergies || [],
        allergy_discovery_enabled: updated.allergy_discovery_enabled ?? false,
        current_phase: updated.current_phase,
      },
    });
  } catch (error) {
    console.error('PATCH /api/client/profile error:', error);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}
