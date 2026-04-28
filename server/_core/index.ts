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

// Log de diagnóstico de variáveis de ambiente no startup
const mpToken = process.env.MP_ACCESS_TOKEN;
console.log("[ENV Check] MP_ACCESS_TOKEN:", mpToken ? `SET (${mpToken.slice(0, 10)}...)` : "NOT SET");
console.log("[ENV Check] APP_BASE_URL:", process.env.APP_BASE_URL ?? "NOT SET");
console.log("[ENV Check] NODE_ENV:", process.env.NODE_ENV ?? "NOT SET");

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
  
  // REST API para Addon Minecraft (GET - melhor compatibilidade)
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
