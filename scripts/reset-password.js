const bcrypt = require('bcryptjs');

// Mock the sql.js imports since we just need to run raw SQL
async function resetPassword() {
  // Connect directly to Redis to get the database
  const { Redis } = require('@upstash/redis');
  
  const redis = new Redis({
    url: 'https://profound-eagle-181915.upstash.io',
    token: 'gQAAAAAAAsabAAIgcDI4NTY5ZDBmNzkyYTg0MDUwYWUyOGQyMWQ0ZTU1MjE2ZA',
  });

  // Get the database binary from Redis
  const dbBinary = await redis.get('nutrition:sql_db');
  if (!dbBinary) {
    console.log('No database found in Redis');
    return;
  }
  console.log('Got database from Redis, size:', dbBinary.length);

  // Load SQL.js
  const initSqlJs = require('sql.js');
  const SQL = await initSqlJs();
  
  // Create database from binary
  const db = new SQL.Database(Buffer.from(dbBinary));
  
  // Hash new password
  const passwordHash = await bcrypt.hash('123456', 10);
  console.log('Password hash created');
  
  // Check if user exists in clients
  const clientStmt = db.prepare('SELECT * FROM clients WHERE email = ?');
  clientStmt.bind(['marrs.allen@gmail.com']);
  
  if (clientStmt.step()) {
    const user = clientStmt.getAsObject();
    console.log('Found client:', user.email);
    
    db.run('UPDATE clients SET password_hash = ? WHERE email = ?', [passwordHash, 'marrs.allen@gmail.com']);
    console.log('Client password updated');
  } else {
    // Check trainers
    const trainerStmt = db.prepare('SELECT * FROM trainers WHERE email = ?');
    trainerStmt.bind(['marrs.allen@gmail.com']);
    
    if (trainerStmt.step()) {
      const trainer = trainerStmt.getAsObject();
      console.log('Found trainer:', trainer.email);
      
      db.run('UPDATE trainers SET password_hash = ? WHERE email = ?', [passwordHash, 'marrs.allen@gmail.com']);
      console.log('Trainer password updated');
    } else {
      console.log('User not found');
    }
  }
  
  // Save back to Redis
  const data = db.export();
  const base64 = Buffer.from(data).toString('base64');
  await redis.set('nutrition:sql_db', base64);
  console.log('Database saved to Redis');
  
  db.close();
  console.log('Done! Password reset to 123456');
}

resetPassword().catch(console.error);