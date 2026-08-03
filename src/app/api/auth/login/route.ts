import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/db';
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

    // Use admin client to bypass RLS
    let user;
    let userType = 'client';

    console.log('[Login] Attempting login for:', email, 'type:', type);
    
    // Use admin client to bypass RLS on server-side
    let supabase;
    try {
      supabase = getAdminClient();
    } catch (e) {
      console.error('[Login] Admin client not available:', e);
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }
    
    if (type === 'trainer') {
      const { data, error } = await supabase.from('trainers').select('*').eq('email', email).single();
      user = data;
      userType = 'trainer';
      if (error) console.log('[Login] Trainer query error:', error.message);
    } else {
      const { data, error } = await supabase.from('clients').select('*').eq('email', email).single();
      user = data;
      if (error) console.log('[Login] Client query error:', error.message);
    }
    
    console.log('[Login] db query returned:', user ? 'user found' : 'null');

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
