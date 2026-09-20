const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

async function main() {
  const supabaseUrl = 'https://fbiubwhffoclindynute.supabase.co';
  
  // Read service role key from .env.local
  const fs = require('fs');
  const envContent = fs.readFileSync('/Users/openclawassistant/.openclaw/workspace/nutrition-coaching-platform/.env.local', 'utf8');
  const serviceKey = envContent.match(/SUPABASE_SERVICE_ROLE_KEY="([^"]+)"/)?.[1];
  
  if (!serviceKey) {
    console.error('Could not find SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }
  
  console.log('Service key found, length:', serviceKey.length);
  
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  
  // Create a trainer with a known password
  const email = 'tim-known2@test.com';
  const password = '***';
  const passwordHash = await bcrypt.hash(password, 10);
  
  console.log('Password:', password);
  console.log('Hash:', passwordHash);
  
  // Check if trainer already exists
  const existing = await supabase.from('trainers').select('id').eq('email', email).single();
  if (existing.data) {
    console.log('Trainer already exists, deleting...');
    await supabase.from('trainers').delete().eq('id', existing.data.id);
  }
  
  const { data, error } = await supabase
    .from('trainers')
    .insert({
      id: uuidv4(),
      email,
      password_hash: passwordHash,
      name: 'Tim Known',
      business_name: 'Tim QA',
      brand_color: '#3B82F6',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .select()
    .single();
  
  if (error) {
    console.error('Error creating trainer:', error);
    process.exit(1);
  }
  
  console.log('Trainer created:', data.id, data.email);
  
  // Now test login - retrieve and compare
  const { data: loginData, error: loginError } = await supabase
    .from('trainers')
    .select('*')
    .eq('email', email)
    .single();
  
  if (loginError) {
    console.error('Login test failed:', loginError);
    process.exit(1);
  }
  
  console.log('Retrieved hash:', loginData.password_hash);
  const isValid = await bcrypt.compare(password, loginData.password_hash);
  console.log('Password validation:', isValid ? 'SUCCESS' : 'FAILED');
  
  if (!isValid) {
    console.log('BUG: Password hash mismatch!');
    console.log('Expected password:', password);
    console.log('Expected hash:', passwordHash);
    console.log('Got hash:', loginData.password_hash);
  }
}

main().catch(e => { console.error(e); process.exit(1); });