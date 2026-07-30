import { NextRequest, NextResponse } from 'next/server';
import { getDb, db_get, db_run } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, name, businessName } = body;

    if (!email || !password || !name) {
      return NextResponse.json(
        { error: 'Email, password, and name are required' },
        { status: 400 }
      );
    }

    const db = await getDb();

    // Check if email already exists
    const existing = await db_get(db.prepare('SELECT id FROM trainers WHERE email = ?'), email);
    if (existing) {
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 409 }
      );
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create trainer
    const trainerId = uuidv4();
    const now = new Date().toISOString();

    await db_run(
      db.prepare(`
        INSERT INTO trainers (id, email, password_hash, name, business_name, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `),
      trainerId, email, passwordHash, name, businessName || null, now, now
    );

    return NextResponse.json({
      success: true,
      trainerId,
      message: 'Trainer account created successfully',
    });
  } catch (error) {
    console.error('Trainer signup error:', error);
    return NextResponse.json(
      { error: 'Failed to create trainer account' },
      { status: 500 }
    );
  }
}
