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

async function checkPending() {
  let connection;
  try {
    connection = await mysql.createConnection(config);
    
    console.log('=== PEDIDOS COM STATUS game_pending ===\n');
    const [orders] = await connection.execute(
      'SELECT id, orderNumber, minecraftNickname, email, status, total, createdAt FROM `orders` WHERE status = "game_pending" ORDER BY createdAt DESC'
    );
    
    console.log(`Total de pedidos game_pending: ${orders.length}\n`);
    
    orders.forEach((order, index) => {
      console.log(`${index + 1}. Pedido #${order.orderNumber}`);
      console.log(`   ID: ${order.id}`);
      console.log(`   Nickname: "${order.minecraftNickname}"`);
      console.log(`   Email: ${order.email}`);
      console.log(`   Status: ${order.status}`);
      console.log(`   Total: R$ ${order.total}\n`);
    });
    
  } catch (error) {
    console.error('Erro:', error.message);
  } finally {
    if (connection) await connection.end();
  }
}

checkPending();
