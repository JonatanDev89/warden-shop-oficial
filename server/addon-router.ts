/**
 * Router tRPC para endpoints do addon Minecraft Bedrock
 * Endpoints: /api/trpc/addon.*
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { publicProcedure, router } from "./_core/trpc";
import {
  getPendingOrdersForAddon,
  markOrderAsDelivered,
  getOrderForAddon,
  updateOrderStatusForAddon,
} from "./addon-helpers";
import crypto from "crypto";

/**
 * Validar API Key do addon
 * Compara o hash SHA-256 da chave fornecida com as chaves armazenadas
 */
async function validateAddonApiKey(apiKey: string): Promise<boolean> {
  if (!apiKey || !apiKey.startsWith("warden_")) {
    return false;
  }

  try {
    // Importar função de validação de API Key
    const { getDb } = await import("./db");
    const { apiKeys } = await import("../drizzle/schema");
    const { eq } = await import("drizzle-orm");

    const db = await getDb();
    if (!db) return false;

    // Hash da chave fornecida
    const keyHash = crypto.createHash("sha256").update(apiKey).digest("hex");

    // Procurar chave no banco
    const result = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.keyHash, keyHash))
      .limit(1);

    if (result.length === 0) return false;

    const key = result[0];
    return key && key.active === true;
  } catch (error) {
    console.error("[Addon] Erro ao validar API Key:", error);
    return false;
  }
}

export const addonRouter = router({
  /**
   * Health check - verifica se a API está online
   * GET /api/trpc/addon.health
   */
  health: publicProcedure.query(async () => {
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
      version: "1.0.0",
    };
  }),

  /**
   * Listar items de pedidos pendentes (entrega individual)
   * POST /api/trpc/addon.getPendingItems
   * Body: {"apiKey": "warden_..."}
   * Retorna cada item de cada pedido separadamente para resgate individual
   */
  getPendingItems: publicProcedure
    .input(
      z.object({
        apiKey: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      const isValid = await validateAddonApiKey(input.apiKey);
      if (!isValid) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "API Key inválida ou revogada",
        });
      }

      try {
        const { getPendingOrderItems, getProductCommands } = await import("./db");
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

        return {
          success: true,
          items: itemsWithCommands,
          count: itemsWithCommands.length,
        };
      } catch (error) {
        console.error("[Addon] Erro ao listar items:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erro ao listar items",
        });
      }
    }),

  /**
   * Listar pedidos pendentes (DEPRECATED - use getPendingItems para entrega individual)
   * POST /api/trpc/addon.getPendingOrders
   * Body: {"apiKey": "warden_..."}
   */
  getPendingOrders: publicProcedure
    .input(
      z.object({
        apiKey: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      // Validar API Key
      const isValid = await validateAddonApiKey(input.apiKey);
      if (!isValid) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "API Key inválida ou revogada",
        });
      }

      try {
        const pendingOrders = await getPendingOrdersForAddon();

        // Formatar resposta para o addon
        return {
          success: true,
          orders: pendingOrders.map((order) => ({
            id: order.id,
            orderNumber: order.orderNumber,
            nickname: order.minecraftNickname,
            email: order.email,
            status: order.status,
            total: parseFloat(order.total.toString()),
            commands: order.commands
              ? (() => {
                  try {
                    return JSON.parse(order.commands);
                  } catch {
                    return [];
                  }
                })()
              : [],
            createdAt: order.createdAt.toISOString(),
          })),
          count: pendingOrders.length,
        };
      } catch (error) {
        console.error("[Addon] Erro ao listar pedidos:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erro ao listar pedidos",
        });
      }
    }),

  /**
   * Marcar item individual como entregue
   * POST /api/trpc/addon.markItemDelivered
   */
  markItemDelivered: publicProcedure
    .input(
      z.object({
        apiKey: z.string().min(1),
        itemId: z.number().int().positive(),
      })
    )
    .mutation(async ({ input }) => {
      const isValid = await validateAddonApiKey(input.apiKey);
      if (!isValid) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "API Key inválida ou revogada",
        });
      }

      try {
        const { markOrderItemDelivered } = await import("./db");
        await markOrderItemDelivered(input.itemId);

        return {
          success: true,
          itemId: input.itemId,
          message: `Item #${input.itemId} marcado como entregue`,
        };
      } catch (error) {
        console.error("[Addon] Erro ao marcar item entregue:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erro ao processar item",
        });
      }
    }),

  /**
   * Marcar pedido como entregue (DEPRECATED - use markItemDelivered)
   * POST /api/trpc/addon.markDelivered
   * Requer: Authorization: Bearer {API_KEY}
   */
  markDelivered: publicProcedure
    .input(
      z.object({
        apiKey: z.string().min(1),
        orderId: z.number().int().positive(),
      })
    )
    .mutation(async ({ input }) => {
      // Validar API Key
      const isValid = await validateAddonApiKey(input.apiKey);
      if (!isValid) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "API Key inválida ou revogada",
        });
      }

      try {
        // Verificar se pedido existe
        const order = await getOrderForAddon(input.orderId);
        if (!order) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `Pedido #${input.orderId} não encontrado`,
          });
        }

        // Marcar como entregue
        const success = await markOrderAsDelivered(input.orderId);

        if (!success) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Erro ao atualizar pedido",
          });
        }

        return {
          success: true,
          orderId: input.orderId,
          message: `Pedido #${input.orderId} marcado como entregue`,
        };
      } catch (error) {
        console.error("[Addon] Erro ao marcar entregue:", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erro ao processar pedido",
        });
      }
    }),

  /**
   * Obter detalhes de um pedido específico
   * GET /api/trpc/addon.getOrder
   */
  getOrder: publicProcedure
    .input(
      z.object({
        apiKey: z.string().min(1),
        orderId: z.number().int().positive(),
      })
    )
    .query(async ({ input }) => {
      const isValid = await validateAddonApiKey(input.apiKey);
      if (!isValid) throw new TRPCError({ code: "UNAUTHORIZED", message: "API Key inválida ou revogada" });

      try {
        const order = await getOrderForAddon(input.orderId);
        if (!order) throw new TRPCError({ code: "NOT_FOUND", message: `Pedido #${input.orderId} não encontrado` });

        return {
          success: true,
          order: {
            id: order.id,
            orderNumber: order.orderNumber,
            nickname: order.minecraftNickname,
            email: order.email,
            status: order.status,
            total: parseFloat(order.total.toString()),
            commands: order.commands ? (() => { try { return JSON.parse(order.commands); } catch { return []; } })() : [],
            createdAt: order.createdAt.toISOString(),
          },
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Erro ao obter pedido" });
      }
    }),

  /**
   * Obter pedidos de kit personalizado pendentes com JSON dos itens
   * POST /api/trpc/addon.getKitOrders
   */
  getKitOrders: publicProcedure
    .input(z.object({ apiKey: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const isValid = await validateAddonApiKey(input.apiKey);
      if (!isValid) throw new TRPCError({ code: "UNAUTHORIZED", message: "API Key inválida ou revogada" });

      try {
        const { getDb } = await import("./db");
        const { orders, orderItems } = await import("../drizzle/schema");
        const { eq, and, like } = await import("drizzle-orm");

        const db = await getDb();
        if (!db) return { success: true, orders: [] };

        // Kit orders have orderNumber starting with #KIT and status game_pending
        const kitOrders = await db
          .select()
          .from(orders)
          .where(and(eq(orders.status, "game_pending"), like(orders.orderNumber, "#KIT%")));

        const result = await Promise.all(kitOrders.map(async (order) => {
          const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));

          // Parse kit items from productName field: "[SLOT X] Nx Name [minecraftId] {configLabel}"
          const kitSlots = items.map((item) => {
            const match = item.productName.match(/^\[SLOT (\d+)\] (\d+)x (.+?) \[([^\]]+)\](?:\s*\{([^}]*)\})?$/);
            if (!match) return null;
            const configLabel = match[5] ?? null;
            // Parse enchants from configLabel, e.g. "Afiação 5" or "Eficiência 3, Resistência 2"
            const enchants: { id: string; level: number }[] = [];
            if (configLabel && configLabel !== "Full" && configLabel !== "God" && configLabel !== "Sem encantamentos") {
              for (const part of configLabel.split(",")) {
                const m = part.trim().match(/^(.+?)\s+(\d+)$/);
                if (m) {
                  enchants.push({ id: m[1]!.trim(), level: parseInt(m[2]!) });
                }
              }
            }
            return {
              slot: parseInt(match[1]!) - 1,
              quantity: parseInt(match[2]!),
              name: match[3]!,
              minecraftId: match[4]!,
              unitPrice: parseFloat(item.unitPrice.toString()),
              configLabel,
              enchants,
            };
          }).filter(Boolean);

          // Also parse from notes: "KIT PERSONALIZADO: 64x Pack TNT, ..."
          return {
            id: order.id,
            orderNumber: order.orderNumber,
            nickname: order.minecraftNickname,
            total: parseFloat(order.total.toString()),
            notes: order.notes ?? "",
            kitSlots,
            createdAt: order.createdAt.toISOString(),
          };
        }));

        return { success: true, orders: result };
      } catch (error) {
        console.error("[Addon] Erro ao obter kit orders:", error);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Erro ao obter kit orders" });
      }
    }),
});
