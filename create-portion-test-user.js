// Script to create a test user for portion testing
const fetch = require('node-fetch');
const { Client } = require('pg');
const fs = require('fs');

async function main() {
  const envContent = fs.readFileSync('.env', 'utf8');
  const supabaseUrl = envContent.match(/NEXT_PUBLIC_SUPABASE_URL="([^"]+)"/)[1];
  const serviceRoleKey = envContent.match(/SUPABASE_SERVICE_ROLE_KEY="([^"]+)"/)[1];
  const dbUrlMatch = envContent.match(/DATABASE_URL="([^"]+)"/);
  const databaseUrl = dbUrlMatch[1];

  // Create test user via Supabase Admin API
  const timestamp = Date.now();
  const testEmail = 'portiontest-' + timestamp + '@test.com';
  const testPassword = 'TestPass123!';
  
  console.log('Creating test user:', testEmail);
  
  const response = await fetch(supabaseUrl + '/auth/v1/admin/users', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + serviceRoleKey,
      'apikey': serviceRoleKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email: testEmail,
      password: testPassword,
      email_confirm: true,
      user_metadata: {
        name: 'Portion Test Male'
      }
    })
  });
  
  const data = await response.json();
  console.log('Response status:', response.status);
  
  if (data.id) {
    console.log('Created user with ID:', data.id);
    
    // Insert into clients table with Phase 6 male settings
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
        program_type = $6,
        gender = $4
      RETURNING *
    `, [data.id, testEmail, 'Portion Test Male', 'male', 6, 'muscle_gain', 4, 'active']);
    
    console.log('Client record:', JSON.stringify(insertResult.rows[0], null, 2));
    
    await client.end();
    
    console.log('\n=== TEST CREDENTIALS ===');
    console.log('Email:', testEmail);
    console.log('Password:', testPassword);
    console.log('========================');
  } else {
    console.log('Error:', JSON.stringify(data, null, 2));
  }
}

main().catch(console.error);
