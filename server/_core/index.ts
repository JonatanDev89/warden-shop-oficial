import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { runMigrations } from "../db";
import { handleMpWebhook } from "../payment/webhook.controller";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  await runMigrations();

  // ─── Redirect intermediário para evitar App Links do Android ──────────────
  // O Android intercepta URLs do mercadopago.com e abre o app.
  // Esta rota serve uma página HTML no nosso domínio com um link simples —
  // o browser já está aberto, então o Android não consegue mais interceptar.
  app.get('/ir', (req, res) => {
    const url = req.query.url as string;
    if (!url || !url.startsWith('https://')) {
      return res.status(400).send('URL inválida');
    }
    const escaped = url.replace(/"/g, '&quot;').replace(/</g, '&lt;');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Redirecionando para o pagamento...</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: sans-serif; background: #1a1f2e; color: #e2e8f0; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 24px; }
    .card { background: #222840; border-radius: 12px; padding: 32px 24px; max-width: 400px; width: 100%; text-align: center; }
    .logo { font-size: 2rem; margin-bottom: 16px; }
    h1 { font-size: 1.1rem; font-weight: 600; margin-bottom: 8px; }
    p { font-size: 0.875rem; color: #94a3b8; margin-bottom: 24px; line-height: 1.5; }
    a { display: block; background: #00c8c8; color: #0a0f1a; font-weight: 700; font-size: 1rem; padding: 14px 24px; border-radius: 8px; text-decoration: none; }
    a:active { opacity: 0.85; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">💳</div>
    <h1>Pagamento via Mercado Pago</h1>
    <p>Clique no botão abaixo para prosseguir com o pagamento de forma segura.</p>
    <a href="${escaped}" rel="noopener noreferrer">Ir para o pagamento</a>
  </div>
  <script>
    // Tenta redirecionar automaticamente após 1s
    // Se o Android interceptar, o usuário ainda tem o botão acima
    setTimeout(function() {
      window.location.replace("${escaped}");
    }, 1000);
  </script>
</body>
</html>`);
  });
  app.get('/api/addon/pending-orders', async (req, res) => {
    try {
      const apiKey = (req.query.apiKey as string) || (req.headers['x-api-key'] as string);
      if (!apiKey) {
        return res.status(400).json({ error: 'API Key required' });
      }
      
      // Validar API Key
      const crypto = await import('crypto');
      const { getDb } = await import('../db');
      const { apiKeys } = await import('../../drizzle/schema');
      const { eq } = await import('drizzle-orm');
      
      const db = await getDb();
      if (!db) {
        return res.status(500).json({ error: 'Database unavailable' });
      }
      
      const keyHash = crypto.default.createHash('sha256').update(apiKey).digest('hex');
      const result = await db.select().from(apiKeys).where(eq(apiKeys.keyHash, keyHash)).limit(1);
      
      if (result.length === 0 || !result[0].active) {
        return res.status(401).json({ error: 'Invalid or revoked API Key' });
      }
      
      // Buscar pedidos pendentes
      const { getPendingOrdersForAddon } = await import('../addon-helpers');
      const orders = await getPendingOrdersForAddon();
      
      return res.json({ success: true, orders });
    } catch (error) {
      console.error('[Addon API] Error:', error);
      return res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' });
    }
  });
  
  // REST API para Addon Minecraft (POST)
  app.post('/api/addon/pending-orders', async (req, res) => {
    try {
      const { apiKey } = req.body;
      if (!apiKey) {
        return res.status(400).json({ error: 'API Key required' });
      }
      
      // Validar API Key
      const crypto = await import('crypto');
      const { getDb } = await import('../db');
      const { apiKeys } = await import('../../drizzle/schema');
      const { eq } = await import('drizzle-orm');
      
      const db = await getDb();
      if (!db) {
        return res.status(500).json({ error: 'Database unavailable' });
      }
      
      const keyHash = crypto.default.createHash('sha256').update(apiKey).digest('hex');
      const result = await db.select().from(apiKeys).where(eq(apiKeys.keyHash, keyHash)).limit(1);
      
      if (result.length === 0 || !result[0].active) {
        return res.status(401).json({ error: 'Invalid or revoked API Key' });
      }
      
      // Buscar pedidos pendentes
      const { getPendingOrdersForAddon } = await import('../addon-helpers');
      const orders = await getPendingOrdersForAddon();
      
      return res.json({ success: true, orders });
    } catch (error) {
      console.error('[Addon API] Error:', error);
      return res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' });
    }
  });
  
  // Kit orders — pedidos de kit personalizado pendentes com itens JSON
  app.get('/api/addon/kit-orders', async (req, res) => {
    try {
      const apiKey = (req.query.apiKey as string) || (req.headers['x-api-key'] as string);
      if (!apiKey) return res.status(400).json({ error: 'API Key required' });

      const crypto = await import('crypto');
      const { getDb } = await import('../db');
      const { apiKeys, orders, orderItems } = await import('../../drizzle/schema');
      const { eq, and, like } = await import('drizzle-orm');

      const db = await getDb();
      if (!db) return res.status(500).json({ error: 'Database unavailable' });

      const keyHash = crypto.default.createHash('sha256').update(apiKey).digest('hex');
      const keyResult = await db.select().from(apiKeys).where(eq(apiKeys.keyHash, keyHash)).limit(1);
      if (keyResult.length === 0 || !keyResult[0].active) return res.status(401).json({ error: 'Invalid API Key' });

      // Buscar pedidos de kit (orderNumber começa com #KIT) com status game_pending
      const kitOrders = await db.select().from(orders)
        .where(and(eq(orders.status, 'game_pending'), like(orders.orderNumber, '#KIT%')));

      const result = await Promise.all(kitOrders.map(async (order) => {
        const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
        const kitSlots = items.map((item) => {
          // Format: "[SLOT X] Nx Name [minecraftId] {configLabel}"
          const match = item.productName.match(/^\[SLOT (\d+)\] (\d+)x (.+?) \[([^\]]+)\](?:\s*\{([^}]*)\})?$/);
          if (!match) return null;
          const configLabel = match[5] ?? null;
          const enchants: { id: string; level: number }[] = [];
          if (configLabel && configLabel !== "Full" && configLabel !== "God" && configLabel !== "Sem encantamentos") {
            for (const part of configLabel.split(",")) {
              const m = part.trim().match(/^(.+?)\s+(\d+)$/);
              if (m) enchants.push({ id: m[1]!.trim(), level: parseInt(m[2]!) });
            }
          }
          return {
            slot: parseInt(match[1]!) - 1,
            quantity: parseInt(match[2]!),
            name: match[3]!,
            minecraftId: match[4]!,
            configLabel,
            enchants,
          };
        }).filter(Boolean);

        return {
          id: order.id,
          orderNumber: order.orderNumber,
          nickname: order.minecraftNickname,
          total: parseFloat(order.total.toString()),
          kitSlots,
        };
      }));

      return res.json({ success: true, orders: result });
    } catch (error) {
      console.error('[Addon Kit API] Error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Marcar pedido como entregue
  app.post('/api/addon/mark-delivered', async (req, res) => {
    try {
      const { apiKey, orderId } = req.body;
      if (!apiKey || !orderId) {
        return res.status(400).json({ error: 'API Key and orderId required' });
      }
      
      // Validar API Key
      const crypto = await import('crypto');
      const { getDb } = await import('../db');
      const { apiKeys, orders } = await import('../../drizzle/schema');
      const { eq } = await import('drizzle-orm');
      
      const db = await getDb();
      if (!db) {
        return res.status(500).json({ error: 'Database unavailable' });
      }
      
      const keyHash = crypto.default.createHash('sha256').update(apiKey).digest('hex');
      const result = await db.select().from(apiKeys).where(eq(apiKeys.keyHash, keyHash)).limit(1);
      
      if (result.length === 0 || !result[0].active) {
        return res.status(401).json({ error: 'Invalid or revoked API Key' });
      }
      
      // Atualizar status do pedido para delivered
      await db.update(orders).set({ status: 'delivered' }).where(eq(orders.id, orderId));
      
      // Buscar dados completos do pedido para enviar comprovante e notificação
      const updatedOrder = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
      if (updatedOrder.length > 0) {
        const { sendDeliveryReceipt, notifyOrderDelivered } = await import('../discord-webhooks');
        await notifyOrderDelivered(updatedOrder[0]);
        await sendDeliveryReceipt(updatedOrder[0]);
      }
      
      return res.json({ success: true, message: 'Order marked as delivered' });
    } catch (error) {
      console.error('[Addon API] Mark Delivered Error:', error);
      return res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' });
    }
  });

  // Buscar items pendentes (entrega individual)
  app.get('/api/addon/pending-items', async (req, res) => {
    try {
      const apiKey = (req.query.apiKey as string) || (req.headers['x-api-key'] as string);
      if (!apiKey) {
        return res.status(400).json({ error: 'API Key required' });
      }
      
      // Validar API Key
      const crypto = await import('crypto');
      const { getDb } = await import('../db');
      const { apiKeys } = await import('../../drizzle/schema');
      const { eq } = await import('drizzle-orm');
      
      const db = await getDb();
      if (!db) {
        return res.status(500).json({ error: 'Database unavailable' });
      }
      
      const keyHash = crypto.default.createHash('sha256').update(apiKey).digest('hex');
      const result = await db.select().from(apiKeys).where(eq(apiKeys.keyHash, keyHash)).limit(1);
      
      if (result.length === 0 || !result[0].active) {
        return res.status(401).json({ error: 'Invalid or revoked API Key' });
      }
      
      // Buscar items pendentes
      const { getPendingOrderItems, getProductCommands } = await import('../db');
      const pendingItems = await getPendingOrderItems();
      
      // Buscar comandos de cada produto
      const itemsWithCommands = await Promise.all(
        pendingItems.map(async (item) => {
          const commands = await getProductCommands(item.productId);
          return {
            itemId: item.itemId,
            orderId: item.orderId,
            productId: item.productId,
            productName: item.productName,
            quantity: item.quantity,
            unitPrice: parseFloat(item.unitPrice.toString()),
            orderNumber: item.orderNumber,
            minecraftNickname: item.minecraftNickname,
            email: item.email,
            total: parseFloat(item.total.toString()),
            commands,
            createdAt: item.createdAt.toISOString(),
          };
        })
      );
      
      return res.json({ success: true, items: itemsWithCommands, count: itemsWithCommands.length });
    } catch (error) {
      console.error('[Addon API] Pending Items Error:', error);
      return res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' });
    }
  });

  // Marcar item individual como entregue
  app.post('/api/addon/mark-item-delivered', async (req, res) => {
    try {
      const { apiKey, itemId } = req.body;
      if (!apiKey || !itemId) {
        return res.status(400).json({ error: 'API Key and itemId required' });
      }
      
      // Validar API Key
      const crypto = await import('crypto');
      const { getDb } = await import('../db');
      const { apiKeys } = await import('../../drizzle/schema');
      const { eq } = await import('drizzle-orm');
      
      const db = await getDb();
      if (!db) {
        return res.status(500).json({ error: 'Database unavailable' });
      }
      
      const keyHash = crypto.default.createHash('sha256').update(apiKey).digest('hex');
      const result = await db.select().from(apiKeys).where(eq(apiKeys.keyHash, keyHash)).limit(1);
      
      if (result.length === 0 || !result[0].active) {
        return res.status(401).json({ error: 'Invalid or revoked API Key' });
      }
      
      // Marcar item como entregue
      const { markOrderItemDelivered } = await import('../db');
      await markOrderItemDelivered(itemId);
      
      return res.json({ success: true, message: 'Item marked as delivered' });
    } catch (error) {
      console.error('[Addon API] Mark Item Delivered Error:', error);
      return res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' });
    }
  });
  
  // Ping endpoint para manter o servidor acordado
  app.get("/ping", (_req, res) => {
    res.status(200).send("ok");
  });

  // Mercado Pago webhook — DEVE vir antes do tRPC
  app.post("/api/mp/webhook", handleMpWebhook);

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
