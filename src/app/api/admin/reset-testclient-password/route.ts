import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/db';
import bcrypt from 'bcryptjs';

// Reset testclient password to a known value for testing
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET || 'dev'}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = getAdminClient();
    const newPassword = 'TestPassword123!';
    const hash = await bcrypt.hash(newPassword, 10);

    const { error } = await supabase
      .from('clients')
      .update({ password_hash: hash })
      .eq('email', 'testclient_delet_test@test.com');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ 
      status: 'ok', 
      email: 'testclient_delet_test@test.com',
      password: newPassword 
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
