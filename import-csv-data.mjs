import pg from "pg";
import * as dotenv from "dotenv";
dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  const client = await pool.connect();
  try {
    console.log("Conectado ao banco. Iniciando importação...\n");

    // ── Products ──────────────────────────────────────────────────────────────
    console.log("Inserindo produtos...");
    await client.query(`
      INSERT INTO products (id, "categoryId", name, description, "kitContents", price, stock, "imageUrl", active, "commands", "createdAt", "updatedAt")
      VALUES
        (1, 1, 'Kit Dima',
          'O kit perfeito para quem está começando no servidor. Inclui ferramentas de ferro, comida e recursos básicos para sobreviver nos primeiros dias.',
          '["Espada de ferro","Picareta de ferro","Pá de ferro","32x Pão","16x Tocha","5x Poção de Cura"]',
          2.99, -1, NULL, true,
          '["/execute as {player} at @s run structure load kitdima ~ ~ ~"]',
          '2026-04-17 22:30:17', '2026-04-17 23:52:59'),
        (30001, 1, 'kit trio',
          NULL, NULL,
          35.00, -1, NULL, true,
          '["/execute as {player} at @s run structure load kittrio ~ ~ ~"]',
          '2026-04-18 18:59:09', '2026-04-18 19:00:25')
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        "kitContents" = EXCLUDED."kitContents",
        price = EXCLUDED.price,
        commands = EXCLUDED.commands,
        "updatedAt" = EXCLUDED."updatedAt";
    `);
    console.log("  ✓ 2 produtos inseridos/atualizados");

    // ── Orders ────────────────────────────────────────────────────────────────
    console.log("Inserindo pedidos...");
    await client.query(`
      INSERT INTO orders (id, "orderNumber", "minecraftNickname", email, "couponCode", subtotal, discount, total, status, notes, "createdAt", "updatedAt")
      VALUES
        (3,     '#31763', 'Predador78X', 'marlonott33@gmail.com', NULL,       2.99, 0.00, 2.99,  'delivered', NULL, '2026-04-18 00:30:31', '2026-04-18 00:42:56'),
        (4,     '#14918', 'Predador78X', 'marlonott33@gmail.com', NULL,       2.99, 0.00, 2.99,  'delivered', NULL, '2026-04-18 00:45:14', '2026-04-18 01:17:14'),
        (30001, '#52662', 'Predador78X', 'marlonott33@gmail.com', 'WARDEN10', 2.99, 0.30, 2.69,  'delivered', NULL, '2026-04-18 18:39:12', '2026-04-18 18:39:41'),
        (30002, '#60638', 'Predador78X', 'marlonott33@gmail.com', 'WARDEN10', 2.99, 0.30, 2.69,  'delivered', NULL, '2026-04-18 18:41:00', '2026-04-18 18:41:48'),
        (30003, '#77656', 'Predador78X', 'marlonott33@gmail.com', NULL,      35.00, 0.00, 35.00, 'delivered', NULL, '2026-04-18 18:59:37', '2026-04-18 18:59:58'),
        (30004, '#55562', 'Predador78X', 'marlonott33@gmail.com', NULL,      35.00, 0.00, 35.00, 'delivered', NULL, '2026-04-18 19:00:55', '2026-04-18 19:14:59'),
        (30005, '#40253', 'Predador78X', 'marlonott33@gmail.com', NULL,       2.99, 0.00, 2.99,  'pending_approval', NULL, '2026-04-18 19:19:00', '2026-04-18 19:19:00')
      ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        "updatedAt" = EXCLUDED."updatedAt";
    `);
    console.log("  ✓ 7 pedidos inseridos/atualizados");

    // ── Order Items ───────────────────────────────────────────────────────────
    console.log("Inserindo itens dos pedidos...");
    await client.query(`
      INSERT INTO order_items (id, "orderId", "productId", "productName", quantity, "unitPrice", "createdAt")
      VALUES
        (3,     3,     1,     'Kit Dima',  1, 2.99,  '2026-04-18 00:30:31'),
        (4,     4,     1,     'Kit Dima',  1, 2.99,  '2026-04-18 00:45:14'),
        (30001, 30001, 1,     'Kit Dima',  1, 2.99,  '2026-04-18 18:39:12'),
        (30002, 30002, 1,     'Kit Dima',  1, 2.99,  '2026-04-18 18:41:00'),
        (30003, 30003, 30001, 'kit trio',  1, 35.00, '2026-04-18 18:59:37'),
        (30004, 30004, 30001, 'kit trio',  1, 35.00, '2026-04-18 19:00:55'),
        (30005, 30005, 1,     'Kit Dima',  1, 2.99,  '2026-04-18 19:19:00')
      ON CONFLICT (id) DO NOTHING;
    `);
    console.log("  ✓ 7 itens inseridos");

    // ── Discord Webhooks ──────────────────────────────────────────────────────
    console.log("Inserindo webhooks do Discord...");
    await client.query(`
      INSERT INTO discord_webhooks (id, type, url, active, "createdAt", "updatedAt")
      VALUES
        (1, 'notification', 'https://discordapp.com/api/webhooks/1492950580669452399/T6i0IimgRG9aBpxrg11RCDpRZ_MEuOP1sVLLOjUEi4JJMyUyMXX55jUbC0IYMCkZZU1i', true, '2026-04-18 18:40:20', '2026-04-18 18:40:20'),
        (2, 'receipt',      'https://discordapp.com/api/webhooks/1494745459997151422/OkTfFYJozh0y0THKtSF1u5mGY-Fyqe-5dc9bKFEBE6aWqMoXD4MOa0pNlUvYBk6galy_', true, '2026-04-18 18:40:38', '2026-04-18 18:40:38')
      ON CONFLICT (id) DO UPDATE SET
        url = EXCLUDED.url,
        active = EXCLUDED.active,
        "updatedAt" = EXCLUDED."updatedAt";
    `);
    console.log("  ✓ 2 webhooks inseridos/atualizados");

    // ── Atualizar sequences ───────────────────────────────────────────────────
    console.log("Atualizando sequences...");
    await client.query(`SELECT setval(pg_get_serial_sequence('products', 'id'), GREATEST((SELECT MAX(id) FROM products), 1));`);
    await client.query(`SELECT setval(pg_get_serial_sequence('orders', 'id'), GREATEST((SELECT MAX(id) FROM orders), 1));`);
    await client.query(`SELECT setval(pg_get_serial_sequence('order_items', 'id'), GREATEST((SELECT MAX(id) FROM order_items), 1));`);
    await client.query(`SELECT setval(pg_get_serial_sequence('discord_webhooks', 'id'), GREATEST((SELECT MAX(id) FROM discord_webhooks), 1));`);
    console.log("  ✓ Sequences atualizadas");

    console.log("\n✅ Importação concluída com sucesso!");
  } catch (err) {
    console.error("❌ Erro durante a importação:", err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
