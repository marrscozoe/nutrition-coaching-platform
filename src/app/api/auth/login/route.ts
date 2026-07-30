import { NextRequest, NextResponse } from 'next/server';
import { db_get } from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, type } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Check client first, then trainer
    let user;
    let userType = 'client';

    console.log('[Login] Attempting login for:', email, 'type:', type);
    
    if (type === 'trainer') {
      user = await db_get('SELECT * FROM trainers WHERE email = ?', email);
      userType = 'trainer';
    } else {
      user = await db_get('SELECT * FROM clients WHERE email = ?', email);
    }
    
    console.log('[Login] db_get returned:', user ? 'user found' : 'null');

    if (!user) {
      console.log('[Login] No user found for email:', email);
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    const userAny = user as any;
    const storedHash = userAny.password_hash;

    // Validate stored hash format before comparison
    if (!storedHash || typeof storedHash !== 'string' || storedHash.length < 50) {
      console.error('[Login] Invalid stored password hash:', {
        email,
        hashType: typeof storedHash,
        hashLength: storedHash?.length,
        hashValue: storedHash?.substring(0, 10)
      });
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    const validPassword = await bcrypt.compare(password, storedHash);
    if (!validPassword) {
      // Don't log the password itself for security reasons
      console.error('[Login] Password mismatch:', { email, userType });
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Return user data (excluding password)
    const { password_hash, ...userData } = userAny;

    return NextResponse.json({
      success: true,
      user: userData,
      userType,
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Login failed' },
      { status: 500 }
    );
  }
}
