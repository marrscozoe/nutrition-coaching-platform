const { Redis } = require('@upstash/redis');
const initSqlJs = require('sql.js');

async function queryClients() {
  const redis = new Redis({
    url: 'https://profound-eagle-181915.upstash.io',
    token: 'gQAAAAAAAsabAAIgcDI4NTY5ZDBmNzkyYTg0MDUwYWUyOGQyMWQ0ZTU1MjE2ZA',
  });

  const dbBinary = await redis.get('nutrition:sql_db');
  if (!dbBinary) {
    console.log('No database found in Redis');
    return;
  }
  console.log('Got database from Redis, size:', dbBinary.length);

  const SQL = await initSqlJs();
  const db = new SQL.Database(Buffer.from(dbBinary));

  // List all tables
  const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table'");
  console.log('\nTables:', tables);

  // Check clients table
  try {
    const clients = db.exec('SELECT id, email, name, password_hash FROM clients LIMIT 20');
    console.log('\nClients:', clients);
  } catch (e) {
    console.log('Error querying clients:', e.message);
  }

  // Check trainers table
  try {
    const trainers = db.exec('SELECT id, email, name, password_hash FROM trainers LIMIT 20');
    console.log('\nTrainers:', trainers);
  } catch (e) {
    console.log('Error querying trainers:', e.message);
  }

  db.close();
}

queryClients().catch(console.error);
