// Script to check database for users and phases
const { Client } = require('pg');
const fs = require('fs');

async function checkDatabase() {
  // Read the .env file
  const envContent = fs.readFileSync('/Users/openclawassistant/.openclaw/workspace/nutrition-coaching-platform/.env', 'utf8');
  
  // Extract DATABASE_URL
  const dbUrlMatch = envContent.match(/DATABASE_URL="([^"]+)"/);
  if (!dbUrlMatch) {
    console.error('DATABASE_URL not found in .env');
    return;
  }
  
  const databaseUrl = dbUrlMatch[1];
  console.log('Found DATABASE_URL:', databaseUrl.replace(/:([^@]+)@/, ':***@'));
  
  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    console.log('Connected to database!');
    
    // Check what tables exist
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    console.log('Tables:', tablesResult.rows.map(r => r.table_name).join(', '));
    
    // Check clients table structure
    const columnsResult = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'clients'
    `);
    console.log('Clients table columns:', columnsResult.rows.map(r => `${r.column_name} (${r.data_type})`).join(', '));
    
    // Check for existing users
    const usersResult = await client.query('SELECT id, email, name, gender, current_phase, program_type FROM clients LIMIT 10');
    console.log('Found', usersResult.rows.length, 'users:');
    usersResult.rows.forEach(u => {
      console.log(`  - ${u.email}: ${u.name}, ${u.gender}, phase ${u.current_phase}, program ${u.program_type}`);
    });
    
    // Check if any users are in Phase 6
    const phase6Users = usersResult.rows.filter(u => u.current_phase === 6);
    console.log('Phase 6 users:', phase6Users.length);
    
  } catch (error) {
    console.error('Database error:', error.message);
  } finally {
    await client.end();
  }
}

checkDatabase();
