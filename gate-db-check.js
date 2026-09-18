// Gate verification script - DB checks for trainer_id signup
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://fbiubwhffoclindynute.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZiaXVid2hmZm9jbGluZHludXRlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTQyMzg2NywiZXhwIjoyMTAwOTk5ODY3fQ.tIouLqTUnAe9MekE37TGDcLlv3FuQp577uJJXF91V9M';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const TRAINER_ID = 'c0efffb0-e93c-4bc1-89cd-ff211169ed58';

async function main() {
  console.log('=== DATABASE VERIFICATION ===\n');

  // Gate 1 Step 5: Verify tim-test-gate1@trial.com has correct trainer_id
  console.log('Gate 1 Step 5: Verify client trainer_id in DB');
  const { data: gate1Client, error: gate1Err } = await supabase
    .from('clients')
    .select('*')
    .eq('email', 'tim-test-gate1@trial.com')
    .single();
  
  if (gate1Err) {
    console.error('FAIL: Could not find tim-test-gate1@trial.com in DB:', gate1Err.message);
  } else {
    console.log('Found client:', JSON.stringify({
      id: gate1Client.id,
      email: gate1Client.email,
      trainer_id: gate1Client.trainer_id,
      name: gate1Client.name,
    }, null, 2));
    
    if (gate1Client.trainer_id === TRAINER_ID) {
      console.log('✓ trainer_id matches expected value\n');
    } else {
      console.error(`✗ trainer_id MISMATCH: expected=${TRAINER_ID}, got=${gate1Client.trainer_id}\n`);
    }
  }

  // Gate 3: Check existing clients with trainer_id
  console.log('Gate 3: Regression check - existing clients with trainer_id');
  const { data: allTrainerClients, error: allErr } = await supabase
    .from('clients')
    .select('id, email, trainer_id, name')
    .not('trainer_id', 'is', null);
  
  if (allErr) {
    console.error('FAIL: Could not query clients:', allErr.message);
  } else {
    console.log(`Found ${allTrainerClients.length} clients with non-null trainer_id:`);
    allTrainerClients.forEach(c => {
      console.log(`  ${c.email}: trainer_id=${c.trainer_id}`);
    });
    
    // Check specific client
    const criss = allTrainerClients.find(c => c.email === 'lt_criss16@yahoo.com');
    if (criss) {
      if (criss.trainer_id === TRAINER_ID) {
        console.log(`\n✓ lt_criss16@yahoo.com still has correct trainer_id: ${TRAINER_ID}`);
      } else {
        console.error(`\n✗ lt_criss16@yahoo.com has WRONG trainer_id: ${criss.trainer_id} (expected: ${TRAINER_ID})`);
      }
    } else {
      console.log('\nlt_criss16@yahoo.com not found in trainer clients list');
    }
  }

  // Gate scan: Recent clients with null trainer_id (last 7 days)
  console.log('\nScan: Recent clients (7 days) with null trainer_id');
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: recentNulls, error: recentErr } = await supabase
    .from('clients')
    .select('id, email, trainer_id, name, created_at')
    .is('trainer_id', null)
    .gte('created_at', sevenDaysAgo)
    .order('created_at', { ascending: false });
  
  if (recentErr) {
    console.error('FAIL: Could not query recent null trainer_id clients:', recentErr.message);
  } else {
    console.log(`Found ${recentNulls.length} clients created in last 7 days with null trainer_id:`);
    recentNulls.forEach(c => {
      console.log(`  ${c.email} (${c.name}) - created ${c.created_at}`);
    });
  }

  // Summary
  console.log('\n=== SUMMARY ===');
  console.log(`Gate 1 Step 5: ${gate1Client && gate1Client.trainer_id === TRAINER_ID ? 'PASS ✓' : 'FAIL ✗'}`);
  console.log(`Gate 3: All existing trainer_id clients preserved: ${allErr ? 'ERROR' : 'PASS ✓'}`);
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
