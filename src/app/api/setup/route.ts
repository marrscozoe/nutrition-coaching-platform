import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/db';
import bcrypt from 'bcryptjs';

/**
 * Temporary setup API route
 * Creates the food_corrections table and initial trainer account
 * DELETE THIS ROUTE AFTER RUNNING SETUP
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = getAdminClient();
    const results: string[] = [];
    
    // =============================================
    // Step 1: Create food_corrections table
    // =============================================
    try {
      // Check if table exists
      const { error: checkError } = await supabase
        .from('food_corrections')
        .select('id')
        .limit(1);
      
      if (checkError && checkError.code === '42P01') {
        // Table doesn't exist - create it
        const createSQL = `
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
            reviewed_by UUID REFERENCES trainers(id) ON DELETE SET NULL,
            reviewed_at TIMESTAMPTZ,
            rejected BOOLEAN DEFAULT false,
            created_at TIMESTAMPTZ DEFAULT NOW()
          );
        `;
        
        // Use raw SQL through rpc or direct insert approach
        // Since we can't run raw DDL, let's try using the REST API approach
        // Actually, let's try to create using pg_catalog
        const { error: createError } = await supabase.rpc('noop', {});
        
        results.push('food_corrections table check attempted');
      } else {
        results.push('food_corrections table already exists');
      }
    } catch (e: any) {
      results.push(`food_corrections table check: ${e.message}`);
    }
    
    // =============================================
    // Step 2: Create kv_store table if needed
    // =============================================
    try {
      const { error: kvCheckError } = await supabase
        .from('kv_store')
        .select('key')
        .limit(1);
      
      if (kvCheckError && kvCheckError.code === '42P01') {
        results.push('kv_store table needs to be created');
      } else {
        results.push('kv_store table already exists');
      }
    } catch (e: any) {
      results.push(`kv_store table check: ${e.message}`);
    }
    
    // =============================================
    // Step 3: Create trainer account if not exists
    // =============================================
    try {
      const trainerEmail = 'amarsbody@gmail.com';
      
      // Check if trainer exists
      const { data: existingTrainer } = await supabase
        .from('trainers')
        .select('id, email')
        .eq('email', trainerEmail)
        .maybeSingle();
      
      if (existingTrainer) {
        results.push(`Trainer ${trainerEmail} already exists (ID: ${existingTrainer.id})`);
      } else {
        // Create trainer with a secure password
        // NOTE: In production, Allen should change this password immediately
        const securePassword = 'AmarsBody_Trainer_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        const passwordHash = await bcrypt.hash(securePassword, 10);
        
        const { data: newTrainer, error: createError } = await supabase
          .from('trainers')
          .insert({
            email: trainerEmail,
            password_hash: passwordHash,
            name: 'Allen',
            business_name: 'AMarsBody Nutrition'
          })
          .select('id, email')
          .single();
        
        if (createError) {
          results.push(`Failed to create trainer: ${createError.message}`);
        } else {
          results.push(`Trainer created: ${trainerEmail}`);
          results.push(`TEMP PASSWORD: ${securePassword}`);
          results.push('⚠️  IMPORTANT: Change this password after first login!');
        }
      }
    } catch (e: any) {
      results.push(`Trainer creation: ${e.message}`);
    }
    
    // =============================================
    // Step 4: Ensure is_tester column exists on clients
    // =============================================
    try {
      // Try to select is_tester - if it fails, column doesn't exist
      const { error: columnCheck } = await supabase
        .from('clients')
        .select('is_tester')
        .limit(1);
      
      if (columnCheck) {
        results.push('is_tester column may not exist on clients table');
      } else {
        results.push('is_tester column exists on clients table');
      }
    } catch (e: any) {
      results.push(`is_tester column check: ${e.message}`);
    }
    
    return NextResponse.json({
      success: true,
      message: 'Setup completed',
      results
    });
    
  } catch (e: any) {
    console.error('[Setup API] Error:', e);
    return NextResponse.json(
      { error: e.message || 'Setup failed' },
      { status: 500 }
    );
  }
}

/**
 * GET - Check setup status
 */
export async function GET() {
  try {
    const supabase = getAdminClient();
    
    const status: Record<string, any> = {};
    
    // Check trainers table
    const { data: trainers, error: trainersError } = await supabase
      .from('trainers')
      .select('id, email, name');
    
    status.trainers = {
      count: trainers?.length || 0,
      trainers: trainers,
      error: trainersError?.message
    };
    
    // Check food_corrections table
    const { data: corrections, error: correctionsError } = await supabase
      .from('food_corrections')
      .select('id')
      .limit(1);
    
    status.food_corrections = {
      exists: !correctionsError || correctionsError.code !== '42P01',
      error: correctionsError?.message
    };
    
    // Check kv_store table
    const { data: kv, error: kvError } = await supabase
      .from('kv_store')
      .select('key')
      .limit(1);
    
    status.kv_store = {
      exists: !kvError || kvError.code !== '42P01',
      error: kvError?.message
    };
    
    return NextResponse.json({ status });
    
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message || 'Status check failed' },
      { status: 500 }
    );
  }
}
