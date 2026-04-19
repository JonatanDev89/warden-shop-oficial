import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const url = new URL(DATABASE_URL);
const config = {
  host: url.hostname,
  user: url.username,
  password: url.password,
  database: url.pathname.slice(1),
  port: url.port || 3306,
  ssl: { rejectUnauthorized: false },
};

async function getApiKey() {
  let connection;
  try {
    connection = await mysql.createConnection(config);
    
    console.log('Consultando API Keys no banco de dados...\n');
    const [rows] = await connection.execute(
      'SELECT id, name, keyPrefix, active, createdAt FROM `api_keys` ORDER BY createdAt DESC'
    );
    
    if (rows.length === 0) {
      console.log('Nenhuma API Key encontrada no banco de dados.');
      return;
    }
    
    console.log('API Keys encontradas:\n');
    rows.forEach((row, index) => {
      console.log(`${index + 1}. ${row.name}`);
      console.log(`   Prefixo: ${row.keyPrefix}`);
      console.log(`   Status: ${row.active ? '✓ Ativa' : '✗ Revogada'}`);
      console.log(`   Criada em: ${row.createdAt}\n`);
    });
  } catch (error) {
    console.error('Erro ao consultar banco:', error.message);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

getApiKey();
