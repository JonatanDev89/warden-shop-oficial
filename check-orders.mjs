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

async function checkOrders() {
  let connection;
  try {
    connection = await mysql.createConnection(config);
    
    console.log('=== TODOS OS PEDIDOS ===\n');
    const [allOrders] = await connection.execute(
      'SELECT id, orderNumber, minecraftNickname, status, total, createdAt FROM `orders` ORDER BY createdAt DESC'
    );
    
    console.log(`Total de pedidos: ${allOrders.length}\n`);
    
    allOrders.forEach((order, index) => {
      console.log(`${index + 1}. Pedido #${order.orderNumber}`);
      console.log(`   ID: ${order.id}`);
      console.log(`   Player: ${order.minecraftNickname}`);
      console.log(`   Status: ${order.status}`);
      console.log(`   Total: R$ ${order.total}`);
      console.log(`   Criado em: ${order.createdAt}\n`);
    });
    
    console.log('\n=== PEDIDOS POR STATUS ===\n');
    const [statusCounts] = await connection.execute(
      'SELECT status, COUNT(*) as count FROM `orders` GROUP BY status'
    );
    
    statusCounts.forEach(row => {
      console.log(`${row.status}: ${row.count}`);
    });
    
    console.log('\n=== PEDIDOS COM STATUS game_pending ===\n');
    const [gamePending] = await connection.execute(
      'SELECT id, orderNumber, minecraftNickname, status FROM `orders` WHERE status = "game_pending"'
    );
    
    if (gamePending.length === 0) {
      console.log('Nenhum pedido com status game_pending encontrado!');
      console.log('\nPara que o addon veja os pedidos, eles precisam estar com status "game_pending".');
      console.log('Você precisa aprovar os pedidos no admin panel.');
    } else {
      console.log(`${gamePending.length} pedido(s) com status game_pending:`);
      gamePending.forEach(order => {
        console.log(`  - #${order.orderNumber} (${order.minecraftNickname})`);
      });
    }
    
  } catch (error) {
    console.error('Erro:', error.message);
  } finally {
    if (connection) await connection.end();
  }
}

checkOrders();
