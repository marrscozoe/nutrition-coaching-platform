import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/db';
import bcrypt from 'bcryptjs';

// Reset trainer password to a known value for testing
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET || 'dev'}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = getAdminClient();
    const newPassword = 'TrainerPassword123!';
    const hash = await bcrypt.hash(newPassword, 10);

    // Try to find the trainer account - amarsbody@gmail.com
    const { data: trainer, error: findError } = await supabase
      .from('trainers')
      .select('id, email')
      .eq('email', 'amarsbody@gmail.com')
      .single();

    if (findError || !trainer) {
      return NextResponse.json({ error: 'Trainer not found: ' + (findError?.message || 'no trainer') }, { status: 404 });
    }

    const { error: updateError } = await supabase
      .from('trainers')
      .update({ password_hash: hash })
      .eq('id', trainer.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ 
      status: 'ok', 
      email: 'amarsbody@gmail.com',
      password: *** 
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
