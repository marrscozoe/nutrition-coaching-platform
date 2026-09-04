import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/db';
import {
  LEAN_PROTEINS,
  FIBROUS_VEGETABLES,
  HEALTHY_FATS,
  STARCHY_CARBOHYDRATES,
  filterFoodsForAllergies,
  getPortions,
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
    const phase = client.current_phase || 1;
    const gender = client.gender === 'female' ? 'female' : 'male';

    // Determine if starch is allowed in current phase
    const starchAllowed = isStarchAllowedForPhase(phase, client);

    // Get filtered food lists
    const proteins = filterFoodsForAllergies(LEAN_PROTEINS, allergies);
    const veggies = filterFoodsForAllergies(FIBROUS_VEGETABLES, allergies);
    const fats = filterFoodsForAllergies(HEALTHY_FATS, allergies);
    const starches = starchAllowed
      ? filterFoodsForAllergies(STARCHY_CARBOHYDRATES, allergies)
      : [];

    // Build grocery items with quantities based on portions
    const portions = getPortions(gender, phase);
    const items: Array<{
      client_id: string;
      item_name: string;
      category: 'protein' | 'veggies' | 'starch' | 'fats';
    }> = [];

    // Proteins: ~42oz for 7 days (6oz × 7 meals, one per day as baseline)
    if (gender === 'male') {
      items.push({ client_id: clientId, item_name: `${portions.protein} per meal × 7 days — select your proteins below`, category: 'protein' });
    } else {
      items.push({ client_id: clientId, item_name: `${portions.protein} per meal × 7 days — select your proteins below`, category: 'protein' });
    }
    // Add individual protein options
    proteins.forEach(p => {
      items.push({ client_id: clientId, item_name: p, category: 'protein' });
    });

    // Veggies: ~14 cups for 7 days
    items.push({ client_id: clientId, item_name: `${portions.fibrousVegetables} per meal × 7 days — select your veggies below`, category: 'veggies' });
    veggies.forEach(v => {
      items.push({ client_id: clientId, item_name: v, category: 'veggies' });
    });

    // Fats: ~14 servings for 7 days
    items.push({ client_id: clientId, item_name: `${portions.fat} per meal × 7 days — select your fats below`, category: 'fats' });
    fats.forEach(f => {
      items.push({ client_id: clientId, item_name: f, category: 'fats' });
    });

    // Starch: only if allowed
    if (starchAllowed && starches.length > 0) {
      items.push({ client_id: clientId, item_name: `${portions.starch} per meal × 7 days — select your starches below`, category: 'starch' });
      starches.forEach(s => {
        items.push({ client_id: clientId, item_name: s, category: 'starch' });
      });
    }

    // Clear existing items
    await supabase
      .from('client_grocery_items')
      .delete()
      .eq('client_id', clientId);

    // Insert new items
    const { data: insertedItems, error: insertError } = await supabase
      .from('client_grocery_items')
      .insert(items)
      .select()
      .order('category', { ascending: true })
      .order('item_name', { ascending: true });

    if (insertError) {
      console.error('Insert grocery items error:', insertError);
      return NextResponse.json({ error: 'Failed to generate grocery list' }, { status: 500 });
    }

    // Build summary
    const summary = {
      totalItems: insertedItems?.length || 0,
      proteinCount: proteins.length,
      veggieCount: veggies.length,
      fatCount: fats.length,
      starchCount: starchAllowed ? starches.length : 0,
      starchIncluded: starchAllowed,
    };

    return NextResponse.json({
      success: true,
      items: insertedItems || [],
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
