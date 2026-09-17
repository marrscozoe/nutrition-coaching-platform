import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { redis_get, redis_set } from '@/lib/db';

export interface ConsultSettings {
  noTimeAvailable: boolean;
  bookAheadEndDate: string | null;   // ISO date string YYYY-MM-DD
  noEndDate: boolean;
  duration: number;        // minutes per consult slot
  openDays: number[];       // 0=Sun, 1=Mon, ... 6=Sat
  openHours: { start: string; end: string }; // "09:00", "17:00"
  ctaText: string;
}

const DEFAULT_SETTINGS: ConsultSettings = {
  noTimeAvailable: false,
  bookAheadEndDate: null,
  noEndDate: false,
  duration: 60,
  openDays: [1, 2, 3, 4, 5], // Mon-Fri
  openHours: { start: '09:00', end: '17:00' },
  ctaText: 'Book a Consult',
};

const KV_KEY = 'consult_settings';

/**
 * GET /api/consult
 * Get current consult settings
 */
export async function GET(request: NextRequest) {
  try {
    const trainerId = request.headers.get('x-trainer-id');
    if (!trainerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const settings = await redis_get<ConsultSettings>(KV_KEY);
    const merged: ConsultSettings = { ...DEFAULT_SETTINGS, ...(settings || {}) };

    return NextResponse.json({ settings: merged });
  } catch (e) {
    console.error('[Consult API] GET error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/consult
 * Update consult settings
 * Body: { settings: Partial<ConsultSettings> }
 */
export async function POST(request: NextRequest) {
  try {
    const trainerId = request.headers.get('x-trainer-id');
    if (!trainerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { settings } = body;

    if (!settings || typeof settings !== 'object') {
      return NextResponse.json({ error: 'settings object is required' }, { status: 400 });
    }

    // Load existing
    const existing = await redis_get<Partial<ConsultSettings>>(KV_KEY);
    const merged: ConsultSettings = { ...DEFAULT_SETTINGS, ...(existing || {}), ...settings };

    // Validate
    if (merged.duration < 15 || merged.duration > 240) {
      return NextResponse.json({ error: 'duration must be 15–240 minutes' }, { status: 400 });
    }
    if (merged.bookAheadEndDate && isNaN(Date.parse(merged.bookAheadEndDate))) {
      return NextResponse.json({ error: 'Invalid bookAheadEndDate' }, { status: 400 });
    }
    if (!Array.isArray(merged.openDays) || merged.openDays.some(d => d < 0 || d > 6)) {
      return NextResponse.json({ error: 'openDays must be array of 0–6' }, { status: 400 });
    }

    await redis_set(KV_KEY, merged);

    return NextResponse.json({ success: true, settings: merged });
  } catch (e: any) {
    console.error('[Consult API] POST error:', e);
    return NextResponse.json({ error: e.message || 'Internal server error' }, { status: 500 });
  }
}
