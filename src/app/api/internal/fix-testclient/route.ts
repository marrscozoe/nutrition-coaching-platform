import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/db';

// Internal endpoint — called by a Vercel cron job or another internal route
// Uses the service role key admin client to perform DDL/DML
export async function POST() {
  try {
    const supabase = getAdminClient();

    // Step 1: Drop FK on weigh_ins
    await supabase.rpc('exec', {
      sql: 'ALTER TABLE weigh_ins DROP CONSTRAINT IF EXISTS weigh_ins_client_id_fkey;',
    }).catch(() => null);

    // Step 2: Update clients.id to match Supabase Auth UID
    const { error: updateError } = await supabase
      .from('clients')
      .update({ id: '2b485033-0f55-4982-9160-869da27ff793' })
      .eq('id', '20a539d7-b082-4b02-ab5e-d6fcc0cfe4ef');

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Step 3: Recreate FK with ON UPDATE CASCADE
    await supabase.rpc('exec', {
      sql: `ALTER TABLE weigh_ins ADD CONSTRAINT weigh_ins_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON UPDATE CASCADE;`,
    }).catch(() => null);

    // Step 4: Verify
    const { data: client } = await supabase
      .from('clients')
      .select('id, email, allergy_discovery_enabled')
      .eq('email', 'testclient_delet_test@test.com')
      .single();

    return NextResponse.json({
      status: 'ok',
      message: 'Testclient UID fixed',
      client,
    });
  } catch (err) {
    console.error('[internal/fix-testclient] Error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
