/**
 * Helpers para integração com o addon Minecraft Bedrock
 * Fornece funções para gerenciar pedidos e comandos
 */

import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { orders, orderItems, products } from "../drizzle/schema";

/**
 * Obter pedidos pendentes (status game_pending)
 * Retorna pedidos com seus comandos agregados dos produtos
 * Apenas pedidos aprovados pelo admin aparecem aqui
 */
export async function getPendingOrdersForAddon() {
  const db = await getDb();
  if (!db) return [];

  const pendingOrders = await db
    .select()
    .from(orders)
    .where(eq(orders.status, 'game_pending'))
    .orderBy(orders.createdAt);

  // Para cada pedido, buscar os comandos dos produtos
  const ordersWithCommands = await Promise.all(
    pendingOrders.map(async (order) => {
      const items = await db
        .select()
        .from(orderItems)
        .where(eq(orderItems.orderId, order.id));

      const allCommands: string[] = [];

      // Buscar comandos de cada produto
      for (const item of items) {
        const product = await db
          .select()
          .from(products)
          .where(eq(products.id, item.productId))
          .limit(1);

        if (product[0]?.commands) {
          try {
            const cmds = JSON.parse(product[0].commands);
            if (Array.isArray(cmds)) {
              allCommands.push(...cmds);
            }
          } catch (e) {
            // Ignorar JSON inválido
          }
        }
      }

      return {
        ...order,
        commands: allCommands.length > 0 ? JSON.stringify(allCommands) : null,
      };
    })
  );

      // Retornar todos os pedidos game_pending (mesmo sem commands, para rastreamento)
  return ordersWithCommands;
}

/**
 * Marcar um pedido como entregue
 */
export async function markOrderAsDelivered(orderId: number) {
  const db = await getDb();
  if (!db) return false;

  try {
    await db
      .update(orders)
      .set({ status: "delivered", updatedAt: new Date() })
      .where(eq(orders.id, orderId));
    
    // Enviar notificação de entrega
    const { notifyOrderDelivered, sendDeliveryReceipt } = await import("./discord-webhooks");
    const order = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (order[0]) {
      await notifyOrderDelivered(order[0]);
      await sendDeliveryReceipt(order[0]);
    }
    
    return true;
  } catch (error) {
    console.error(`[Addon] Erro ao marcar pedido ${orderId} como entregue:`, error);
    return false;
  }
}

/**
 * Obter um pedido específico com seus comandos agregados
 */
export async function getOrderForAddon(orderId: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!result[0]) return null;

  const order = result[0];

  // Buscar itens do pedido
  const items = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));

  const allCommands: string[] = [];

  // Buscar comandos de cada produto
  for (const item of items) {
    const product = await db
      .select()
      .from(products)
      .where(eq(products.id, item.productId))
      .limit(1);

    if (product[0]?.commands) {
      try {
        const cmds = JSON.parse(product[0].commands);
        if (Array.isArray(cmds)) {
          allCommands.push(...cmds);
        }
      } catch (e) {
        // Ignorar JSON inválido
      }
    }
  }

  return {
    ...order,
    commands: allCommands.length > 0 ? JSON.stringify(allCommands) : null,
  };
}

/**
 * Atualizar o status de um pedido
 */
export async function updateOrderStatusForAddon(
  orderId: number,
  status: "pending_approval" | "game_pending" | "delivered" | "cancelled"
) {
  const db = await getDb();
  if (!db) return false;

  try {
    await db
      .update(orders)
      .set({ status, updatedAt: new Date() })
      .where(eq(orders.id, orderId));
    return true;
  } catch (error) {
    console.error(`[Addon] Erro ao atualizar status do pedido ${orderId}:`, error);
    return false;
  }
}
