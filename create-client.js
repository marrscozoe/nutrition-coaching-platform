const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

const supabaseUrl = 'https://fbiubwhffoclindynute.supabase.co';
const envContent = fs.readFileSync('/Users/openclawassistant/.openclaw/workspace/nutrition-coaching-platform/.env.local', 'utf8');
const serviceKey = envContent.split('SUPABASE_SERVICE_ROLE_KEY="')[1]?.split('"')[0];

if (!serviceKey) {
  console.error('Could not find service key');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

async function main() {
  // Get the trainer ID for timbrowser99@test.com
  const { data: trainer, error: trainerError } = await supabase
    .from('trainers')
    .select('id')
    .eq('email', 'timbrowser99@test.com')
    .single();
    
  if (trainerError || !trainer) {
    console.error('Trainer not found:', trainerError);
    process.exit(1);
  }
  
  console.log('Trainer ID:', trainer.id);
  
  // Create a test client under this trainer
  const clientId = uuidv4();
  const clientEmail = 'tim-test-client-' + Date.now() + '@test.com';
  const passwordHash = await bcrypt.hash('TestClient123', 10);
  
  const { data: client, error: clientError } = await supabase
    .from('clients')
    .insert({
      id: clientId,
      trainer_id: trainer.id,
      email: clientEmail,
      password_hash: passwordHash,
      name: 'Tim Test Client',
      gender: 'male',
      program_type: 'general_health',
      starting_weight: 180,
      current_weight: 175,
      goal_weight: 165,
      current_phase: 1,
      current_week: 1,
      waiver_signed: 1,
      subscription_status: 'trial',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .select()
    .single();
    
  if (clientError) {
    console.error('Error creating client:', clientError);
    process.exit(1);
  }
  
  console.log('Client created:', client.id, client.email);
}

main().catch(e => { console.error(e); process.exit(1); });