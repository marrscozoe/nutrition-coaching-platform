import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://fbiubwhffoclindynute.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixPhase5StartDate() {
  const { data: client, error: fetchError } = await supabase
    .from('clients')
    .select('id, email, phase5_start_date, current_phase')
    .eq('email', 'testclient_delet_test@test.com')
    .single();
  
  if (fetchError) {
    console.error('Error fetching client:', fetchError);
    process.exit(1);
  }
  
  console.log('Current state:');
  console.log('  email:', client.email);
  console.log('  phase5_start_date:', client.phase5_start_date);
  console.log('  current_phase:', client.current_phase);
  
  if (client.phase5_start_date === '2026-09-18') {
    console.log('\nAlready correct. No fix needed.');
    return;
  }
  
  console.log('\nFixing phase5_start_date to 2026-09-18...');
  
  const { error: updateError } = await supabase
    .from('clients')
    .update({ phase5_start_date: '2026-09-18' })
    .eq('email', 'testclient_delet_test@test.com');
  
  if (updateError) {
    console.error('Error updating:', updateError);
    process.exit(1);
  }
  
  console.log('Fix applied!');
  
  const { data: updated } = await supabase
    .from('clients')
    .select('phase5_start_date')
    .eq('email', 'testclient_delet_test@test.com')
    .single();
  
  console.log('Verified phase5_start_date:', updated?.phase5_start_date);
}

fixPhase5StartDate();
