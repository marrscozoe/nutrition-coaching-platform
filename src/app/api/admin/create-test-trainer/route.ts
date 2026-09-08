import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/db';
import bcrypt from 'bcryptjs';

// Create a test trainer account and return credentials
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET || 'dev'}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = getAdminClient();
    const email = 'testtrainer@example.com';
    const password = 'TrainerTest123!';
    const hash = await bcrypt.hash(password, 10);

    // Check if trainer already exists
    const { data: existing } = await supabase
      .from('trainers')
      .select('id, email')
      .eq('email', email)
      .single();

    if (existing) {
      // Update password
      await supabase
        .from('trainers')
        .update({ password_hash: hash })
        .eq('id', existing.id);
      return NextResponse.json({ status: 'ok', email, password: password, note: 'password updated' });
    }

    // Create trainer
    const { error } = await supabase.from('trainers').insert({
      email,
      password_hash: hash,
      name: 'Test Trainer',
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ status: 'ok', email, password: 'TrainerTest123!' });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
