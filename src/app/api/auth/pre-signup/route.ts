import { NextRequest, NextResponse } from 'next/server';
import { db_get } from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, name, password, trainer_id } = body;

    if (!email || !password || !name) {
      return NextResponse.json(
        { error: 'Email, password, and name are required' },
        { status: 400 }
      );
    }

    // Check if email already exists
    const existing = await db_get('SELECT id FROM clients WHERE email = ?', email);
    if (existing) {
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 409 }
      );
    }

    // Hash password for temporary storage
    const passwordHash = await bcrypt.hash(password, 10);

    // Encode token data directly in URL (base64 encoded JSON)
    // This avoids database storage issues with kv_store
    const tokenData = {
      email,
      name,
      passwordHash,
      trainer_id: trainer_id || null,
      createdAt: Date.now(),
    };
    const token = Buffer.from(JSON.stringify(tokenData)).toString('base64url');

    return NextResponse.json({
      success: true,
      token,
      email,
      name,
    });
  } catch (error) {
    console.error('Pre-signup error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: 'Failed to create signup token', details: errorMessage },
      { status: 500 }
    );
  }
}
