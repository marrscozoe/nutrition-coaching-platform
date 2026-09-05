import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/db';
import bcrypt from 'bcryptjs';

function isValidPassword(password: string): boolean {
  // Minimum 8 chars, at least one letter and one number
  if (password.length < 8) return false;
  if (!/[a-zA-Z]/.test(password)) return false;
  if (!/[0-9]/.test(password)) return false;
  return true;
}

export async function POST(request: NextRequest) {
  try {
    const trainerId = request.headers.get('x-trainer-id');
    if (!trainerId) {
      return NextResponse.json({ error: 'Trainer ID required' }, { status: 401 });
    }

    const body = await request.json();
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: 'Current password and new password are required' }, { status: 400 });
    }

    // Validate new password strength
    if (!isValidPassword(newPassword)) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters with at least one letter and one number' },
        { status: 400 }
      );
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

    // Verify current password
    const loginRes = await fetch(new URL(request.url).origin + '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: trainer.email, password: currentPassword, type: 'trainer' }),
    });

    if (!loginRes.ok) {
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 });
    }

    // Hash new password
    const newHash = await bcrypt.hash(newPassword, 10);

    // Update password
    const { error: updateError } = await adminClient
      .from('trainers')
      .update({ password_hash: newHash, updated_at: new Date().toISOString() })
      .eq('id', trainerId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('POST /api/trainer/change-password error:', error);
    return NextResponse.json({ error: 'Failed to change password' }, { status: 500 });
  }
}
