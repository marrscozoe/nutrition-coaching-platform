import { NextRequest, NextResponse } from 'next/server';
import { db_get } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { generateSignupToken } from '@/lib/tokenStore';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, name, password } = body;

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

    // Generate a temporary token - must await to ensure it's stored before returning
    const token = await generateSignupToken({ email, name, passwordHash });

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
