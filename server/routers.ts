
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { addonRouter } from "./addon-router";
import {
  createApiKey,
  createCategory,
  createCoupon,
  createOrder,
  createProduct,
  createWebhook,
  deleteApiKey,
  deleteCategory,
  deleteCoupon,
  deleteOrder,
  deleteProduct,
  deleteWebhook,
  getAllAdmins,
  getAllProducts,
  getActiveWebhooksByType,
  getApiKeys,
  getCategories,
  getCouponByCode,
  getCoupons,
  getDashboardStats,
  getOrderWithItems,
  getOrderWithItemsByNumber,
  getOrders,
  getProductById,
  getProducts,
  getSiteSettings,
  getUserByEmail,
  getWebhooks,
  incrementCouponUsage,
  revokeApiKey,
  searchProducts,
  setUserRole,
  setSiteSettings,
  updateCategory,
  updateCoupon,
  updateOrderNotes,
  updateOrderStatus,
  updateProduct,
  updateWebhook,
  getStoreCustomization,
  updateStoreCustomization,
  reorderCategories,
  reorderProducts,
  getKitItems,
  upsertKitItem,
  deleteKitItem,
} from "./db";
import { initiatePayment, initiatePixPayment } from "./payment/payment.service";
import { getPendingOrdersForAddon } from "./addon-helpers";
import {
  notifyPendingOrder,
  notifyOrderAccepted,
  notifyOrderRejected,
  notifyOrderDelivered,
  sendDeliveryReceipt,
} from "./discord-webhooks";

import crypto from "crypto";
import { nanoid } from "nanoid";
import { createLocalUser, getUserByEmailWithPassword } from "./db";

// ─── Helpers de senha (PBKDF2 nativo) ─────────────────────────────────────────
function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 100_000, 64, "sha512").toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const attempt = crypto.pbkdf2Sync(password, salt, 100_000, 64, "sha512").toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(attempt, "hex"));
}

// ─── Admin guard ───────────────────────────────────────────────────────────────
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado." });
  return next({ ctx });
});



// ─── Shop router (public) ──────────────────────────────────────────────────────
const shopRouter = router({
  getSettings: publicProcedure.query(() => getSiteSettings()),

  getStoreCustomization: publicProcedure.query(() => getStoreCustomization()),

  getOrderByNumber: publicProcedure
    .input(z.object({ orderNumber: z.string() }))
    .query(async ({ input }) => {
      const order = await getOrderWithItemsByNumber(input.orderNumber);
      if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Pedido não encontrado." });
      return order;
    }),

  getCategories: publicProcedure.query(() => getCategories()),

  getProducts: publicProcedure
    .input(z.object({ categoryId: z.number().optional() }))
    .query(({ input }) => getProducts(input.categoryId)),

  getProduct: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const p = await getProductById(input.id);
      if (!p) throw new TRPCError({ code: "NOT_FOUND" });
      return p;
    }),

  searchProducts: publicProcedure
    .input(z.object({ query: z.string().min(1) }))
    .query(({ input }) => searchProducts(input.query)),

  getKitItems: publicProcedure.query(() => getKitItems(true)),

  createKitOrder: publicProcedure
    .input(z.object({
      minecraftNickname: z.string().min(1),
      email: z.string().email(),
      slots: z.array(z.object({
        slot: z.number(),
        minecraftId: z.string(),
        name: z.string(),
        quantity: z.number().min(1),
        unitPrice: z.string(),
        configLabel: z.string().optional(),
      })),
    }))
    .mutation(async ({ input }) => {
      if (input.slots.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Adicione pelo menos um item ao kit." });
      }
      const subtotal = input.slots.reduce((sum, s) => sum + parseFloat(s.unitPrice) * s.quantity, 0);
      const orderNumber = `#KIT${Date.now().toString().slice(-5)}`;
      const kitSummary = input.slots.map(s => `${s.quantity}x ${s.name}`).join(", ");
      const order = await createOrder(
        {
          orderNumber,
          minecraftNickname: input.minecraftNickname,
          email: input.email,
          subtotal: subtotal.toFixed(2),
          discount: "0.00",
          total: subtotal.toFixed(2),
          notes: `KIT PERSONALIZADO: ${kitSummary}`,
        } as Parameters<typeof createOrder>[0],
        input.slots.map((s) => ({
          productId: 0,
          productName: `[SLOT ${s.slot + 1}] ${s.quantity}x ${s.name} [${s.minecraftId}]${s.configLabel ? ` {${s.configLabel}}` : ""}`,
          quantity: s.quantity,
          unitPrice: s.unitPrice,
        }))
      );
      return order;
    }),

  validateCoupon: publicProcedure
    .input(z.object({ code: z.string() }))
    .query(async ({ input }) => {
      const coupon = await getCouponByCode(input.code);
      if (!coupon) throw new TRPCError({ code: "NOT_FOUND", message: "Cupom inválido ou expirado." });
      return coupon;
    }),

  getTopBuyers: publicProcedure.query(async () => {
    const stats = await getDashboardStats();
    return stats?.topBuyers ?? [];
  }),

  // Cria preferência de pagamento no Mercado Pago para um pedido existente
  createMpPayment: publicProcedure
    .input(z.object({ orderNumber: z.string().min(1).max(32) }))
    .mutation(async ({ input }) => {
      try {
        return await initiatePayment(input.orderNumber);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erro ao iniciar pagamento.";
        if (msg.includes("não encontrado")) throw new TRPCError({ code: "NOT_FOUND", message: msg });
        if (msg.includes("já foi pago")) throw new TRPCError({ code: "BAD_REQUEST", message: msg });
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Erro ao iniciar pagamento. Tente novamente." });
      }
    }),

  // Cria pagamento PIX inline (sem redirect) — retorna QR code
  createPixPayment: publicProcedure
    .input(z.object({
      orderNumber: z.string().min(1).max(32),
      payerEmail: z.string().email(),
      payerName: z.string().min(1),
    }))
    .mutation(async ({ input }) => {
      try {
        return await initiatePixPayment(input.orderNumber, input.payerEmail, input.payerName);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erro ao gerar PIX.";
        if (msg.includes("não encontrado")) throw new TRPCError({ code: "NOT_FOUND", message: msg });
        if (msg.includes("já foi pago")) throw new TRPCError({ code: "BAD_REQUEST", message: msg });
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: msg });
      }
    }),

  // Polling de status — frontend usa para confirmar pagamento sem depender do redirect
  getOrderStatus: publicProcedure
    .input(z.object({ orderNumber: z.string().min(1).max(32) }))
    .query(async ({ input }) => {
      const order = await getOrderWithItemsByNumber(input.orderNumber);
      if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Pedido não encontrado." });
      return {
        orderNumber: order.orderNumber,
        status: order.status,
        paymentStatus: order.paymentStatus ?? "pending",
        paymentStatusDetail: (order as any).paymentStatusDetail ?? "",
        total: order.total,
        paidAt: order.paidAt ?? null,
      };
    }),

  getMonthlyGoal: publicProcedure.query(async () => {
    const settings = await getSiteSettings();
    const target = parseFloat(settings.monthlyGoalTarget ?? "0");
    const label = settings.monthlyGoalLabel ?? "Meta do mês";

    // Calculate current month revenue from delivered orders
    const db = await import("./db").then((m) => m.getDb());
    let current = 0;
    if (db) {
      const { orders } = await import("../drizzle/schema");
      const { eq, and, gte, lte } = await import("drizzle-orm");
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      const monthOrders = await db
        .select()
        .from(orders)
        .where(
          and(
            eq(orders.status, "delivered"),
            gte(orders.createdAt, startOfMonth),
            lte(orders.createdAt, endOfMonth)
          )
        );
      current = monthOrders.reduce((sum, o) => sum + parseFloat(String(o.total)), 0);
    }

    return { target, current, label };
  }),

  createOrder: publicProcedure
    .input(
      z.object({
        minecraftNickname: z.string()
          .min(1, "Nickname obrigatório")
          .max(16, "Nickname muito longo")
          .regex(/^[a-zA-Z0-9_]+$/, "Nickname inválido — use apenas letras, números e _"),
        email: z.string().email("E-mail inválido").max(320),
        couponCode: z.string().max(64).optional(),
        items: z.array(
          z.object({
            productId: z.number().int().positive(),
            quantity: z.number().int().min(1).max(99),
          })
        ).min(1).max(20),
      })
    )
    .mutation(async ({ input }) => {
      // Resolve products
      const resolvedItems: Array<{
        productId: number;
        productName: string;
        quantity: number;
        unitPrice: string;
      }> = [];
      let subtotal = 0;
      for (const item of input.items) {
        const product = await getProductById(item.productId);
        if (!product || !product.active) {
          throw new TRPCError({ code: "BAD_REQUEST", message: `Produto #${item.productId} não encontrado.` });
        }
        const price = parseFloat(String(product.price));
        subtotal += price * item.quantity;
        resolvedItems.push({
          productId: product.id,
          productName: product.name,
          quantity: item.quantity,
          unitPrice: price.toFixed(2),
        });
      }

      // Apply coupon
      let discount = 0;
      let couponCode: string | undefined;
      if (input.couponCode) {
        const coupon = await getCouponByCode(input.couponCode);
        if (coupon) {
          couponCode = coupon.code;
          if (coupon.discountType === "percent") {
            discount = subtotal * (parseFloat(String(coupon.discountValue)) / 100);
          } else {
            discount = parseFloat(String(coupon.discountValue));
          }
          discount = Math.min(discount, subtotal);
          await incrementCouponUsage(coupon.code);
        }
      }

      const total = Math.max(0, subtotal - discount);
      const orderNumber = `#${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 5).toUpperCase()}`;

      const order = await createOrder(
        {
          orderNumber,
          minecraftNickname: input.minecraftNickname,
          email: input.email,
          couponCode,
          subtotal: subtotal.toFixed(2),
          discount: discount.toFixed(2),
          total: total.toFixed(2),
        },
        resolvedItems
      );

      // Send Discord notification for new pending order
      await notifyPendingOrder({
        ...order,
        minecraftNickname: input.minecraftNickname,
        total: parseFloat(String(order.total)),
      });

      return order;
    }),
});

// ─── Admin router (protected + admin role) ─────────────────────────────────────
const adminRouter = router({
  getDashboard: adminProcedure.query(() => getDashboardStats()),

  // Orders
  getOrders: adminProcedure.query(() => getOrders()),
  getOrder: adminProcedure
    .input(z.object({ id: z.number() }))
    .query(({ input }) => getOrderWithItems(input.id)),
  updateOrderStatus: adminProcedure
    .input(z.object({ id: z.number(), status: z.enum(["pending_approval", "game_pending", "delivered", "cancelled"]) }))
    .mutation(async ({ input }) => {
      console.log('[Router] ===== updateOrderStatus CHAMADO =====');
      console.log('[Router] Input:', JSON.stringify(input));
      
      const result = await updateOrderStatus(input.id, input.status);
      
      // Se o status for "delivered", enviar notificações
      if (input.status === "delivered") {
        console.log('[Router] ===== STATUS É DELIVERED =====');
        console.log('[Router] Buscando pedido com ID:', input.id);
        
        const order = await getOrderWithItems(input.id);
        
        if (order) {
          console.log('[Router] ===== PEDIDO ENCONTRADO =====');
          console.log('[Router] Order:', JSON.stringify({
            orderNumber: order.orderNumber,
            status: order.status,
            id: order.id
          }));
          
          console.log('[Router] ===== IMPORTANDO FUNÇÕES DE WEBHOOK =====');
          const { notifyOrderDelivered, sendDeliveryReceipt } = await import("./discord-webhooks");
          
          console.log('[Router] ===== PREPARANDO OBJETO DO PEDIDO =====');
          // Garantir que o status está correto no objeto
          const orderWithStatus = {
            ...order,
            status: 'delivered' as const, // Forçar o status correto
            total: parseFloat(String(order.total)),
          };
          
          console.log('[Router] ===== CHAMANDO notifyOrderDelivered =====');
          await notifyOrderDelivered(orderWithStatus);
          
          console.log('[Router] ===== CHAMANDO sendDeliveryReceipt =====');
          await sendDeliveryReceipt(orderWithStatus);
          
          console.log('[Router] ===== NOTIFICAÇÕES ENVIADAS COM SUCESSO =====');
        } else {
          console.log('[Router] ===== PEDIDO NÃO ENCONTRADO =====');
        }
      } else {
        console.log('[Router] Status não é delivered, é:', input.status);
      }
      
      return result;
    }),
  updateOrderNotes: adminProcedure
    .input(z.object({ id: z.number(), notes: z.string() }))
    .mutation(({ input }) => updateOrderNotes(input.id, input.notes)),
  deleteOrder: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => deleteOrder(input.id)),
  acceptOrder: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const result = await updateOrderStatus(input.id, "game_pending");
      const order = await getOrderWithItems(input.id);
      // Só notifica se o pagamento NÃO foi pelo MP — evita duplicar com o webhook
      if (order && order.paymentStatus !== "approved") {
        await notifyOrderAccepted({
          ...order,
          total: parseFloat(String(order.total)),
        });
      }
      return result;
    }),
  rejectOrder: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const result = await updateOrderStatus(input.id, "cancelled");
      const order = await getOrderWithItems(input.id);
      if (order) {
        await notifyOrderRejected({
          ...order,
          total: parseFloat(String(order.total)),
        });
      }
      return result;
    }),

  // Products
  getProducts: adminProcedure.query(() => getAllProducts()),
  createProduct: adminProcedure
    .input(
      z.object({
        categoryId: z.number(),
        name: z.string().min(1),
        description: z.string().optional(),
        kitContents: z.string().optional(),
        price: z.string(),
        stock: z.number().optional(),
        imageUrl: z.string().optional(),
        commands: z.string().optional(),
        active: z.boolean().optional(),
      })
    )
    .mutation(({ input }) => createProduct(input)),
  updateProduct: adminProcedure
    .input(
      z.object({
        id: z.number(),
        categoryId: z.number().optional(),
        name: z.string().optional(),
        description: z.string().optional(),
        kitContents: z.string().optional(),
        price: z.string().optional(),
        stock: z.number().optional(),
        imageUrl: z.string().optional(),
        commands: z.string().optional(),
        active: z.boolean().optional(),
      })
    )
    .mutation(({ input }) => {
      const { id, ...data } = input;
      return updateProduct(id, data);
    }),
  deleteProduct: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => deleteProduct(input.id)),
  reorderProducts: adminProcedure
    .input(z.object({ orderedIds: z.array(z.number()) }))
    .mutation(({ input }) => reorderProducts(input.orderedIds)),

  // Categories
  getCategories: adminProcedure.query(() => getCategories()),
  createCategory: adminProcedure
    .input(z.object({ name: z.string().min(1), description: z.string().optional(), imageUrl: z.string().optional() }))
    .mutation(({ input }) => createCategory(input)),
  updateCategory: adminProcedure
    .input(z.object({ id: z.number(), name: z.string().optional(), description: z.string().optional(), imageUrl: z.string().optional() }))
    .mutation(({ input }) => {
      const { id, ...data } = input;
      return updateCategory(id, data);
    }),
  deleteCategory: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => deleteCategory(input.id)),
  reorderCategories: adminProcedure
    .input(z.object({ orderedIds: z.array(z.number()) }))
    .mutation(({ input }) => reorderCategories(input.orderedIds)),

  // Coupons
  getCoupons: adminProcedure.query(() => getCoupons()),
  createCoupon: adminProcedure
    .input(
      z.object({
        code: z.string().min(1),
        discountType: z.enum(["fixed", "percent"]),
        discountValue: z.string(),
        active: z.boolean().optional(),
      })
    )
    .mutation(({ input }) => createCoupon(input)),
  updateCoupon: adminProcedure
    .input(
      z.object({
        id: z.number(),
        code: z.string().optional(),
        discountType: z.enum(["fixed", "percent"]).optional(),
        discountValue: z.string().optional(),
        active: z.boolean().optional(),
      })
    )
    .mutation(({ input }) => {
      const { id, ...data } = input;
      return updateCoupon(id, data);
    }),
  deleteCoupon: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => deleteCoupon(input.id)),

  // Webhooks
  getWebhooks: adminProcedure.query(() => getWebhooks()),
  createWebhook: adminProcedure
    .input(z.object({ type: z.enum(["receipt", "notification"]), url: z.string().url(), message: z.string().optional(), msgPendente: z.string().optional(), msgAceito: z.string().optional(), msgRecusado: z.string().optional(), msgEntregue: z.string().optional(), msgDeletado: z.string().optional() }))
    .mutation(({ input }) => createWebhook(input)),
  updateWebhook: adminProcedure
    .input(z.object({ id: z.number(), url: z.string().url().optional(), active: z.boolean().optional(), message: z.string().optional(), msgPendente: z.string().optional(), msgAceito: z.string().optional(), msgRecusado: z.string().optional(), msgEntregue: z.string().optional(), msgDeletado: z.string().optional() }))
    .mutation(({ input }) => {
      const { id, ...data } = input;
      return updateWebhook(id, data);
    }),
  deleteWebhook: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => deleteWebhook(input.id)),

  // API Keys
  getApiKeys: adminProcedure.query(() => getApiKeys()),
  createApiKey: adminProcedure
    .input(z.object({ name: z.string().min(1) }))
    .mutation(async ({ input }) => {
      // 48 bytes aleatórios → 64 chars hex = 256 bits de entropia
      const secret = crypto.randomBytes(48).toString("hex");
      const rawKey = `wsk_${secret}`;
      const prefix = `wsk_${secret.slice(0, 8)}`;
      const hash = crypto.createHash("sha256").update(rawKey).digest("hex");
      await createApiKey(input.name, hash, prefix);
      return { key: rawKey, prefix };
    }),
  revokeApiKey: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => revokeApiKey(input.id)),
  deleteApiKey: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => deleteApiKey(input.id)),

  // Store Customization
  getStoreCustomization: adminProcedure.query(() => getStoreCustomization()),
  updateStoreCustomization: adminProcedure
    .input(
      z.object({
        pixKey: z.string().optional(),
        pixKeyType: z.enum(["cpf", "email", "phone", "random"]).optional(),
        storeName: z.string().optional(),
        storeDescription: z.string().optional(),
        bannerText: z.string().optional(),
        bannerColor: z.string().optional(),
        primaryColor: z.string().optional(),
        secondaryColor: z.string().optional(),
        logoUrl: z.string().optional(),
      })
    )
    .mutation(({ input }) => updateStoreCustomization(input)),

  // Site Settings
  getSettings: adminProcedure.query(() => getSiteSettings()),
  saveSettings: adminProcedure
    .input(z.record(z.string(), z.string()))
    .mutation(({ input }) => setSiteSettings(input)),

  // Kit Items
  getKitItems: adminProcedure.query(() => getKitItems()),
  upsertKitItem: adminProcedure
    .input(z.object({
      minecraftId: z.string().min(1),
      name: z.string().min(1),
      price: z.string(),
      minPerSlot: z.number().optional(),
      maxPerSlot: z.number().optional(),
      pricePerUnit: z.boolean().optional(),
      imageUrl: z.string().optional(),
      itemConfig: z.string().optional(),
      active: z.boolean().optional(),
    }))
    .mutation(({ input }) => {
      // Converter undefined para null para campos opcionais
      const data = {
        ...input,
        imageUrl: input.imageUrl || null,
        itemConfig: input.itemConfig || null,
      };
      return upsertKitItem(data);
    }),
  deleteKitItem: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => deleteKitItem(input.id)),

  // Admins
  getAdmins: adminProcedure.query(() => getAllAdmins()),
  addAdmin: adminProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ input }) => {
      const user = await getUserByEmail(input.email);
      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "Usuário não encontrado." });
      await setUserRole(user.id, "admin");
      return { success: true };
    }),
  removeAdmin: adminProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      if (input.userId === ctx.user.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Você não pode remover a si mesmo." });
      }
      await setUserRole(input.userId, "user");
      return { success: true };
    }),
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
    register: publicProcedure
      .input(z.object({
        name: z.string().min(2, "Nome muito curto"),
        email: z.string().email("Email inválido"),
        password: z.string().min(8, "Senha deve ter no mínimo 8 caracteres"),
      }))
      .mutation(async ({ input, ctx }) => {
        const existing = await getUserByEmailWithPassword(input.email);
        if (existing) throw new TRPCError({ code: "CONFLICT", message: "Email já cadastrado." });

        const openId = `local_${nanoid(16)}`;
        const passwordHash = hashPassword(input.password);
        const user = await createLocalUser({ name: input.name, email: input.email, passwordHash, openId });
        if (!user) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        const { sdk } = await import("./_core/sdk");
        const { ONE_YEAR_MS } = await import("@shared/const");
        const token = await sdk.createSessionToken(user.openId, { name: user.name ?? "", expiresInMs: ONE_YEAR_MS });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: ONE_YEAR_MS });
        return { success: true };
      }),
    login: publicProcedure
      .input(z.object({
        email: z.string().email("Email inválido"),
        password: z.string().min(1),
      }))
      .mutation(async ({ input, ctx }) => {
        const user = await getUserByEmailWithPassword(input.email);
        if (!user || !user.passwordHash) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Email ou senha incorretos." });
        }
        const valid = verifyPassword(input.password, user.passwordHash);
        if (!valid) throw new TRPCError({ code: "UNAUTHORIZED", message: "Email ou senha incorretos." });

        const { sdk } = await import("./_core/sdk");
        const { ONE_YEAR_MS } = await import("@shared/const");
        const token = await sdk.createSessionToken(user.openId, { name: user.name ?? "", expiresInMs: ONE_YEAR_MS });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: ONE_YEAR_MS });
        return { success: true };
      }),
  }),
  shop: shopRouter,
  admin: adminRouter,
  addon: addonRouter,
});

export type AppRouter = typeof appRouter;
