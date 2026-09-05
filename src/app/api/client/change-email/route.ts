import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/db';
import bcrypt from 'bcryptjs';

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request: NextRequest) {
  try {
    const clientId = request.headers.get('x-client-id');
    if (!clientId) {
      return NextResponse.json({ error: 'Client ID required' }, { status: 401 });
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

    // Get current client data to find their email
    const adminClient = getAdminClient();
    const { data: client, error: fetchError } = await adminClient
      .from('clients')
      .select('email')
      .eq('id', clientId)
      .single();

    if (fetchError || !client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const currentEmail = client.email;

    // Verify current password by calling login
    const loginRes = await fetch(new URL(request.url).origin + '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: currentEmail, password: currentPassword, type: 'client' }),
    });

    if (!loginRes.ok) {
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 });
    }

    // Check if new email is already in use
    const { data: existing } = await adminClient
      .from('clients')
      .select('id')
      .eq('email', newEmail)
      .single();

    if (existing && existing.id !== clientId) {
      return NextResponse.json({ error: 'This email is already in use' }, { status: 409 });
    }

    // Update email
    const { error: updateError } = await adminClient
      .from('clients')
      .update({ email: newEmail, updated_at: new Date().toISOString() })
      .eq('id', clientId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('POST /api/client/change-email error:', error);
    return NextResponse.json({ error: 'Failed to change email' }, { status: 500 });
  }
}
