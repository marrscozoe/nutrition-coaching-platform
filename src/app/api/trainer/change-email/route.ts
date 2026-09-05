import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/db';

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request: NextRequest) {
  try {
    const trainerId = request.headers.get('x-trainer-id');
    if (!trainerId) {
      return NextResponse.json({ error: 'Trainer ID required' }, { status: 401 });
    }

    const body = await request.json();
    const { newEmail, currentPassword } = body;

    if (!newEmail || !currentPassword) {
      return NextResponse.json({ error: 'New email and current password are required' }, { status: 400 });
    }

    // Validate email format
    if (!isValidEmail(newEmail)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    // Get current trainer data
    const adminClient = getAdminClient();
    const { data: trainer, error: fetchError } = await adminClient
      .from('trainers')
      .select('email')
      .eq('id', trainerId)
      .single();

    if (fetchError || !trainer) {
      return NextResponse.json({ error: 'Trainer not found' }, { status: 404 });
    }

    const currentEmail = trainer.email;

    // Verify current password
    const loginRes = await fetch(new URL(request.url).origin + '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: currentEmail, password: currentPassword, type: 'trainer' }),
    });

    if (!loginRes.ok) {
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 });
    }

    // Check if new email is already in use
    const { data: existing } = await adminClient
      .from('trainers')
      .select('id')
      .eq('email', newEmail)
      .single();

    if (existing && existing.id !== trainerId) {
      return NextResponse.json({ error: 'This email is already in use' }, { status: 409 });
    }

    // Update email
    const { error: updateError } = await adminClient
      .from('trainers')
      .update({ email: newEmail, updated_at: new Date().toISOString() })
      .eq('id', trainerId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('POST /api/trainer/change-email error:', error);
    return NextResponse.json({ error: 'Failed to change email' }, { status: 500 });
  }
}
