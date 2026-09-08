import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/db';
import bcrypt from 'bcryptjs';

// Create a test trainer account. Never return the password in the response.
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET || 'dev'}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = getAdminClient();
    const email = 'testtrainer@example.com';
    const password = process.env.TEST_TRAINER_PASSWORD || 'TrainerTest123!';
    const hash = await bcrypt.hash(password, 10);

    const { data: existing } = await supabase
      .from('trainers')
      .select('id, email')
      .eq('email', email)
      .single();

    if (existing) {
      await supabase
        .from('trainers')
        .update({ password_hash: hash })
        .eq('id', existing.id);
      return NextResponse.json({ status: 'ok', email, note: 'password updated (not returned)' });
    }

    const { error } = await supabase.from('trainers').insert({
      email,
      password_hash: hash,
      name: 'Test Trainer',
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ status: 'ok', email, note: 'created (password not returned)' });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
