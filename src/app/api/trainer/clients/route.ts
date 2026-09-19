import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/db';

// Force dynamic rendering — this route reads request headers and Supabase admin client
export const dynamic = 'force-dynamic';

// GET — Fetch all clients for a trainer (live, no caching)
export async function GET(request: NextRequest) {
  const noStore = { 'Cache-Control': 'no-store, no-cache, must-revalidate' };

  try {
    const trainerId = request.headers.get('x-trainer-id');
    if (!trainerId) {
      return NextResponse.json({ error: 'Trainer ID required' }, { status: 401, headers: noStore });
    }

    const supabase = getAdminClient();

    // Filter by trainer_id — fix for tester@tester.com missing from list (Allen 2026-09-18)
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('id, name, email, gender, program_type, starting_weight, current_weight, goal_weight, event_date, current_phase, current_week, subscription_status, waiver_signed, notes, lead_source, created_at, updated_at, is_tester, trainer_id')
      .eq('trainer_id', trainerId)
      .order('created_at', { ascending: false });

    if (clientsError) {
      console.error('[GET /api/trainer/clients] Supabase error:', clientsError);
      return NextResponse.json(
        { error: 'Failed to fetch clients', detail: clientsError.message },
        { status: 500, headers: noStore }
      );
    }

    console.log(`[GET /api/trainer/clients] Trainer ${trainerId}: raw ${clients?.length ?? 0} clients`);

    // Self-heal: drop ghost rows (deleted in DB but still returned by a stale read)
    let enrichedClients = (clients || []) as any[];
    if (enrichedClients.length > 0) {
      const ids = enrichedClients.map((c: any) => c.id);
      const { data: verifyRows } = await supabase
        .from('clients')
        .select('id')
        .in('id', ids);
      const alive = new Set((verifyRows || []).map((r: any) => r.id));
      const before = enrichedClients.length;
      enrichedClients = enrichedClients.filter((c: any) => alive.has(c.id));
      if (enrichedClients.length !== before) {
        console.warn(`[GET /api/trainer/clients] Dropped ${before - enrichedClients.length} ghost client(s)`);
      }
    }
    console.log(`[GET /api/trainer/clients] Trainer ${trainerId}: returning ${enrichedClients.length} clients`);

    if (enrichedClients.length > 0) {
      const clientIds = enrichedClients.map(c => c.id);

      const { data: mealLogs, error: mealsError } = await supabase
        .from('meals')
        .select('client_id, logged_at')
        .in('client_id', clientIds)
        .order('logged_at', { ascending: false });

      if (mealsError) {
        console.error('[GET /api/trainer/clients] Meal logs error:', mealsError);
        // Non-fatal — continue without last_meal_date
      }

      const lastMealMap: Record<string, string> = {};
      if (mealLogs) {
        for (const log of mealLogs) {
          if (!lastMealMap[log.client_id]) {
            lastMealMap[log.client_id] = log.logged_at;
          }
        }
      }

      enrichedClients = enrichedClients.map(client => ({
        ...client,
        last_meal_date: lastMealMap[client.id] || null,
      }));
    }

    return NextResponse.json({ clients: enrichedClients }, { headers: noStore });
  } catch (error) {
    console.error('[GET /api/trainer/clients] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch clients' },
      { status: 500, headers: noStore }
    );
  }
}
