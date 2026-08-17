import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

/**
 * Temporary admin endpoint to create food_corrections table and trainer accounts
 * This is a one-time setup endpoint
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    const admin = getAdminClient();

    // Action: create_trainer (legacy - use upsert_trainer instead)
    if (action === 'create_trainer' || action === 'upsert_trainer') {
      const { email, password, name } = body;

      if (!email || !password || !name) {
        return NextResponse.json({ error: 'email, password, and name are required' }, { status: 400 });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);
      const now = new Date().toISOString();

      // Check if trainer already exists
      const existing = await admin.from('trainers').select('id,email,name').eq('email', email).single();
      
      if (existing.data) {
        // Update existing trainer's password
        const { error } = await admin.from('trainers').update({
          password_hash: passwordHash,
          updated_at: now,
        }).eq('id', existing.data.id);

        if (error) {
          console.error('[Setup] Update trainer error:', error);
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ 
          success: true, 
          action: 'updated_existing',
          trainerId: existing.data.id, 
          email, 
          name: existing.data.name 
        });
      }

      // Create new trainer
      const trainerId = uuidv4();

      const { error } = await admin.from('trainers').insert({
        id: trainerId,
        email,
        password_hash: passwordHash,
        name,
        brand_color: '#FF6B00',
        created_at: now,
        updated_at: now,
      });

      if (error) {
        console.error('[Setup] Create trainer error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, action: 'created_new', trainerId, email, name });
    }

    // Action: reset_trainer_password - update password for existing trainer
    if (action === 'reset_trainer_password') {
      const { email, password } = body;

      if (!email || !password) {
        return NextResponse.json({ error: 'email and password are required' }, { status: 400 });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);
      const now = new Date().toISOString();

      // Find the trainer
      const existing = await admin.from('trainers').select('id,email,name').eq('email', email).single();
      
      if (!existing.data) {
        return NextResponse.json({ error: 'Trainer not found' }, { status: 404 });
      }

      // Update trainer's password
      const { error } = await admin.from('trainers').update({
        password_hash: passwordHash,
        updated_at: now,
      }).eq('id', existing.data.id);

      if (error) {
        console.error('[Setup] Reset password error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ 
        success: true, 
        action: 'password_reset',
        trainerId: existing.data.id, 
        email 
      });
    }

    // Action: debug_trainer - check trainer record and verify password
    if (action === 'debug_trainer') {
      const { email, password } = body;

      if (!email) {
        return NextResponse.json({ error: 'email is required' }, { status: 400 });
      }

      // Find the trainer
      const existing = await admin.from('trainers').select('id,email,name,password_hash').eq('email', email).single();
      
      if (!existing.data) {
        return NextResponse.json({ found: false, error: 'Trainer not found' }, { status: 404 });
      }

      const result: any = {
        found: true,
        trainerId: existing.data.id,
        email: existing.data.email,
        name: existing.data.name,
        hashLength: existing.data.password_hash?.length || 0,
        hashPrefix: existing.data.password_hash?.substring(0, 10) || 'none',
      };

      // If password is provided, verify it
      if (password) {
        const isValid = await bcrypt.compare(password, existing.data.password_hash || '');
        result.passwordMatch = isValid;
      }

      return NextResponse.json(result);
    }

    // Default: create food_corrections table
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS food_corrections (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        food_name TEXT NOT NULL,
        correct_category TEXT NOT NULL CHECK (correct_category IN ('protein', 'vegetable', 'fat', 'starch', 'dairy', 'sugar', 'other')),
        submitted_by UUID REFERENCES clients(id) ON DELETE SET NULL,
        submitted_by_name TEXT,
        submitted_at TIMESTAMPTZ DEFAULT NOW(),
        approved BOOLEAN DEFAULT false,
        approved_by UUID REFERENCES trainers(id) ON DELETE SET NULL,
        approved_at TIMESTAMPTZ,
        reviewed_at TIMESTAMPTZ,
        reviewed_by UUID REFERENCES trainers(id) ON DELETE SET NULL,
        rejected BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;

    // Try using the admin client
    const { data, error } = await admin.rpc('exec', { sql: createTableSQL }).single();

    if (error) {
      console.log('[Setup] RPC error (may be expected):', error.message);
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Table creation endpoint called',
      note: 'This endpoint attempts to create the table via service role key'
    });
  } catch (e: any) {
    console.error('[Setup] Error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({ status: 'ok', message: 'Setup endpoint - use POST with action=create_trainer' });
}
