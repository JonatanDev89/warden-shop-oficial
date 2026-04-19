import mysql from 'mysql2/promise';
import fs from 'fs';

const dbUrl = process.env.DATABASE_URL;
console.log('Connecting to database...');

// Parse the DATABASE_URL
const url = new URL(dbUrl);
const config = {
  host: url.hostname,
  port: url.port || 3306,
  user: url.username,
  password: url.password,
  database: url.pathname.slice(1),
  ssl: url.searchParams.get('ssl') ? JSON.parse(url.searchParams.get('ssl')) : false,
  waitForConnections: true,
  connectionLimit: 1,
  queueLimit: 0,
};

console.log('Config:', { host: config.host, port: config.port, user: config.user, database: config.database });

const sql = fs.readFileSync('/home/ubuntu/warden-shop-oficial/import_data.sql', 'utf8');

(async () => {
  try {
    const connection = await mysql.createConnection(config);
    console.log('Connected to database');
    
    // Split SQL into individual statements
    const statements = sql.split(';').filter(s => s.trim() && !s.trim().startsWith('--'));
    
    for (const statement of statements) {
      const trimmed = statement.trim();
      if (trimmed) {
        try {
          console.log('Executing:', trimmed.substring(0, 80) + '...');
          await connection.execute(trimmed);
        } catch (err) {
          console.error('Error executing statement:', err.message);
        }
      }
    }
    
    await connection.end();
    console.log('Import completed successfully!');
  } catch (error) {
    console.error('Connection error:', error.message);
    process.exit(1);
  }
})();
