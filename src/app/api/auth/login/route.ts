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
    console.log('[Login] Request body:', JSON.stringify({ email, password: '***', type }));
    
    // Use admin client to bypass RLS on server-side
    let supabase;
    try {
      supabase = getAdminClient();
      console.log('[Login] Admin client initialized successfully');
    } catch (e) {
      console.error('[Login] Admin client not available:', e);
      console.error('[Login] Stack:', e instanceof Error ? e.stack : 'N/A');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }
    
    console.log('[Login] Querying table:', type === 'trainer' ? 'trainers' : 'clients');
    
    if (type === 'trainer') {
      const { data, error } = await supabase.from('trainers').select('*').eq('email', email).single();
      user = data;
      userType = 'trainer';
      if (error) {
        console.log('[Login] Trainer query error:', error.message);
        console.log('[Login] Trainer query details:', JSON.stringify(error));
      } else {
        console.log('[Login] Trainer found:', user ? user.id : 'null');
      }
    } else {
      const { data, error } = await supabase.from('clients').select('*').eq('email', email).single();
      user = data;
      if (error) {
        console.log('[Login] Client query error:', error.message);
        console.log('[Login] Client query details:', JSON.stringify(error));
      } else {
        console.log('[Login] Client found:', user ? user.id : 'null');
      }
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

    console.log('[Login] User found, checking password...');
    console.log('[Login] Stored hash length:', storedHash?.length);
    console.log('[Login] Stored hash first 10 chars:', storedHash?.substring(0, 10));

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

    console.log('[Login] Comparing passwords...');
    const validPassword = await bcrypt.compare(password, storedHash);
    console.log('[Login] Password valid:', validPassword);
    
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
