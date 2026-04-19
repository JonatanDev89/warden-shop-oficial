import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;
const url = new URL(DATABASE_URL);
const config = {
  host: url.hostname,
  user: url.username,
  password: url.password,
  database: url.pathname.slice(1),
  port: url.port || 3306,
  ssl: { rejectUnauthorized: false },
};

async function checkStatus() {
  let connection;
  try {
    connection = await mysql.createConnection(config);
    
    const [order] = await connection.execute(
      'SELECT id, orderNumber, minecraftNickname, status FROM `orders` WHERE id = 3'
    );
    
    if (order.length > 0) {
      console.log('Pedido #' + order[0].id);
      console.log('Número: ' + order[0].orderNumber);
      console.log('Player: ' + order[0].minecraftNickname);
      console.log('Status: ' + order[0].status);
    }
    
  } catch (error) {
    console.error('Erro:', error.message);
  } finally {
    if (connection) await connection.end();
  }
}

checkStatus();
