import { NextRequest, NextResponse } from 'next/server';
import { db_get, db_run, forceSyncDb } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import { getSignupToken, deleteSignupToken } from '@/lib/tokenStore';

// Validate bcrypt hash format to prevent storing invalid hashes
// bcrypt hashes look like: $2a$10$... (60 chars total)
function isValidBcryptHash(hash: string | undefined): boolean {
  if (!hash || typeof hash !== 'string') return false;
  // bcrypt hash format: $2[a-z]$\d{2}\$[./A-Za-z0-9]{53}
  return /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(hash);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, gender, programType, currentWeight, goalWeight, eventDate, leadSource, waiver_accepted } = body;

    let email: string;
    let name: string;
    let passwordHash: string;

    // Check if this is a token-based signup
    if (token) {
      const tokenData = await getSignupToken(token);
      if (!tokenData) {
        return NextResponse.json(
          { error: 'Invalid or expired signup token. Please sign up again.' },
          { status: 400 }
        );
      }
      email = tokenData.email;
      name = tokenData.name;
      passwordHash = tokenData.passwordHash;

      // Validate that passwordHash from token is valid before creating account
      // This prevents accounts being created with invalid/empty hashes
      if (!isValidBcryptHash(passwordHash)) {
        console.error('[Signup] Invalid passwordHash from token:', {
          email,
          passwordHashType: typeof passwordHash,
          passwordHashLength: passwordHash?.length,
          passwordHashPrefix: passwordHash?.substring(0, 10)
        });
        // Delete the corrupted token
        await deleteSignupToken(token);
        return NextResponse.json(
          { error: 'Signup session corrupted. Please sign up again.' },
          { status: 400 }
        );
      }

      // Delete the token after use (one-time use)
      await deleteSignupToken(token);
    } else {
      // Traditional signup with direct credentials
      const { email: emailBody, password, name: nameBody } = body;
      if (!emailBody || !password || !nameBody) {
        return NextResponse.json(
          { error: 'Email, password, and name are required' },
          { status: 400 }
        );
      }
      email = emailBody;
      name = nameBody;
      passwordHash = await bcrypt.hash(password, 10);
    }

    // Check if email already exists
    const existing = await db_get('SELECT id FROM clients WHERE email = ?', email);
    if (existing) {
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 409 }
      );
    }

    // Create client
    const clientId = uuidv4();
    const now = new Date().toISOString();

    const result = await db_run(
      `INSERT INTO clients (id, email, password_hash, name, gender, program_type, starting_weight, current_weight, goal_weight, goal_start_date, event_date, lead_source, current_phase, phase_start_date, current_week, waiver_signed, subscription_status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, 1, ?, 'trial', ?, ?)`,
      clientId, email, passwordHash, name, gender || null, programType || null, currentWeight || null, currentWeight || null, goalWeight || null, now, eventDate || null, leadSource || null, now, waiver_accepted ? 1 : 0, now, now
    );

    if (!result.success) {
      console.error('[Signup] INSERT failed:', result.error);
      return NextResponse.json(
        { error: 'Failed to create account', details: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      clientId,
      message: 'Account created successfully',
    });
  } catch (error) {
    console.error('Signup error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: 'Failed to create account', details: errorMessage },
      { status: 500 }
    );
  }
}
