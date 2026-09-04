import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Reset testclient password to a known value so we can test the feature
export async function POST() {
  try {
    // Create admin client with service role key
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { data, error } = await admin.auth.admin.updateUserById(
      '2b485033-0f55-4982-9160-869da27ff793',
      { password: 'TestClient123!' }
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ 
      status: 'ok', 
      message: 'Password reset to TestClient123!',
      user: data.user?.id 
    });
  } catch (err) {
    console.error('[reset-testclient-password] Error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
