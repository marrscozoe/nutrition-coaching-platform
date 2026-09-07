import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/db';
import {
  LEAN_PROTEINS,
  FIBROUS_VEGETABLES,
  HEALTHY_FATS,
  STARCHY_CARBOHYDRATES,
  filterFoodsForAllergies,
  Phase5Day,
} from '@/lib/nutrition-data';

/**
 * Generate a smart grocery list for the client based on their phase, program, and allergies.
 * Clears existing list and generates a fresh one.
 */
export async function POST(request: NextRequest) {
  try {
    const clientId = request.headers.get('x-client-id');
    if (!clientId) {
      return NextResponse.json({ error: 'Client ID required' }, { status: 401 });
    }

    const supabase = getAdminClient();

    // Get client profile
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .single();

    if (clientError || !client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const allergies: string[] = client.allergies || [];
    const customBans: string[] = client.custom_allergy_bans || [];
    const phase = Number(client.current_phase) || 1;
    const gender = client.gender === 'female' ? 'female' : 'male';

    // Determine if starch is allowed in current phase
    const starchAllowed = isStarchAllowedForPhase(phase, client);
    console.log('[GroceryGenerate] phase:', phase, 'type:', typeof phase, 'starchAllowed:', starchAllowed, 'allergies:', allergies);

    // Get filtered food lists
    const proteins = filterFoodsForAllergies(LEAN_PROTEINS, allergies, customBans);
    const veggies = filterFoodsForAllergies(FIBROUS_VEGETABLES, allergies, customBans);
    const fats = filterFoodsForAllergies(HEALTHY_FATS, allergies, customBans);
    const starches = starchAllowed
      ? filterFoodsForAllergies(STARCHY_CARBOHYDRATES, allergies, customBans)
      : [];

    // Get existing item names to avoid duplicates
    const { data: existingItems } = await supabase
      .from('client_grocery_items')
      .select('item_name')
      .eq('client_id', clientId);

    const existingNames = new Set((existingItems || []).map((i: any) => i.item_name));

    // Only add top 3 per category as suggestions (not the full catalog)
    const suggestedProteins = proteins.slice(0, 3).filter(p => !existingNames.has(p));
    const suggestedVeggies = veggies.slice(0, 3).filter(v => !existingNames.has(v));
    const suggestedFats = fats.slice(0, 3).filter(f => !existingNames.has(f));
    const suggestedStarches = (starchAllowed ? starches.slice(0, 3) : []).filter(s => !existingNames.has(s));

    const allSuggestions = [
      ...suggestedProteins.map(p => ({ client_id: clientId, item_name: p, category: 'protein' as const })),
      ...suggestedVeggies.map(v => ({ client_id: clientId, item_name: v, category: 'veggies' as const })),
      ...suggestedFats.map(f => ({ client_id: clientId, item_name: f, category: 'fats' as const })),
      ...suggestedStarches.map(s => ({ client_id: clientId, item_name: s, category: 'starch' as const })),
    ];

    // REMOVE the DELETE call — just INSERT new suggestions
    if (allSuggestions.length > 0) {
      const { error: insertErr } = await supabase.from('client_grocery_items').insert(allSuggestions);
      if (insertErr) console.error('Insert suggestions error:', insertErr);
    }

    // Return only the newly inserted suggestions (by item_name match)
    const newNames = new Set(allSuggestions.map(s => s.item_name));
    const { data: newSuggestions } = await supabase
      .from('client_grocery_items')
      .select('*')
      .eq('client_id', clientId)
      .in('item_name', Array.from(newNames));

    // Build summary
    const summary = {
      totalItems: allSuggestions.length,
      proteinCount: suggestedProteins.length,
      veggieCount: suggestedVeggies.length,
      fatCount: suggestedFats.length,
      starchCount: suggestedStarches.length,
      starchIncluded: starchAllowed,
    };

    return NextResponse.json({
      success: true,
      items: newSuggestions || [],
      summary,
    });
  } catch (error) {
    console.error('Generate grocery error:', error);
    return NextResponse.json({ error: 'Failed to generate grocery list' }, { status: 500 });
  }
}

function isStarchAllowedForPhase(
  phase: number,
  client: {
    current_phase: number;
    phase5_plan?: string | null;
    phase5_start_date?: string | null;
  }
): boolean {
  // Phase 1: no starch
  if (phase === 1) return false;
  // Phase 6: no starch
  if (phase === 6) return false;
  // Phase 2, 3, 4: starch allowed
  if (phase === 2 || phase === 3 || phase === 4) return true;
  // Phase 5: check phase5_plan
  if (phase === 5 && client.phase5_plan && client.phase5_start_date) {
    try {
      const raw = typeof client.phase5_plan === 'string'
        ? JSON.parse(client.phase5_plan)
        : client.phase5_plan;
      const plan: Phase5Day[] = Array.isArray(raw) ? raw : (raw.days || []);
      const startDate = client.phase5_start_date;

      // Get current day number
      const [y, m, d] = startDate.split('-').map(Number);
      const start = new Date(y, m - 1, d, 0, 0, 0);
      const now = new Date();
      const diffDays = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      const currentDay = Math.min(14, Math.max(1, diffDays + 1));

      const todayRule = plan.find(d => d.day === currentDay);
      // phase1 = no starch, phase2 = starch breakfast/lunch, phase4 = starch every meal
      return todayRule?.type === 'phase2' || todayRule?.type === 'phase4';
    } catch {
      return false;
    }
  }
  return false;
}
