// Script to create a test user via Supabase Admin API
const fetch = require('node-fetch');
const fs = require('fs');

async function createTestUser() {
  // Read the .env file
  const envContent = fs.readFileSync('/Users/openclawassistant/.openclaw/workspace/nutrition-coaching-platform/.env', 'utf8');
  
  // Extract keys
  const supabaseUrl = envContent.match(/NEXT_PUBLIC_SUPABASE_URL="([^"]+)"/)[1];
  const serviceRoleKey = envContent.match(/SUPABASE_SERVICE_ROLE_KEY="([^"]+)"/)[1];
  
  console.log('Supabase URL:', supabaseUrl);
  console.log('Service Role Key:', serviceRoleKey.substring(0, 20) + '...');
  
  // Create a test user via Supabase Admin API
  // POST /auth/v1/admin/users
  const response = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${serviceRoleKey}`,
      'apikey': serviceRoleKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email: `phase6test-${Date.now()}@test.com`,
      password: 'TestPass123!',
      email_confirm: true,
      user_metadata: {
        name: 'Phase 6 Test Male'
      }
    })
  });
  
  const data = await response.json();
  console.log('Response status:', response.status);
  console.log('Response:', JSON.stringify(data, null, 2));
  
  if (data.id) {
    console.log('Created user with ID:', data.id);
    
    // Now insert into clients table with Phase 6 settings
    const { Client } = require('pg');
    const dbUrlMatch = envContent.match(/DATABASE_URL="([^"]+)"/);
    const databaseUrl = dbUrlMatch[1];
    
    const client = new Client({
      connectionString: databaseUrl,
      ssl: { rejectUnauthorized: false }
    });
    
    await client.connect();
    
    const insertResult = await client.query(`
      INSERT INTO clients (id, email, name, gender, current_phase, program_type, current_week, subscription_status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (id) DO UPDATE SET
        current_phase = $5,
        program_type = $6
      RETURNING *
    `, [data.id, data.email, 'Phase 6 Test Male', 'male', 6, 'muscle_gain', 4, 'active']);
    
    console.log('Inserted/updated client record:', insertResult.rows[0]);
    
    await client.end();
    
    return { email: data.email, password: 'TestPass123!' };
  }
  
  return null;
}

createTestUser().catch(console.error);
