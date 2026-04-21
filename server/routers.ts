
import { nanoid } from "nanoid";
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
} from "./db";
import { getPendingOrdersForAddon } from "./addon-helpers";
import {
  notifyPendingOrder,
  notifyOrderAccepted,
  notifyOrderRejected,
  notifyOrderDelivered,
  sendDeliveryReceipt,
} from "./discord-webhooks";

import axios from "axios";
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

  createOrder: publicProcedure
    .input(
      z.object({
        minecraftNickname: z.string().min(1),
        email: z.string().email(),
        couponCode: z.string().optional(),
        items: z.array(
          z.object({
            productId: z.number(),
            quantity: z.number().min(1),
          })
        ),
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
      const orderNumber = `#${Date.now().toString().slice(-5)}`;

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
    .mutation(({ input }) => updateOrderStatus(input.id, input.status)),
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
      if (order) {
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
      const rawKey = `warden_${nanoid(16)}`;
      const prefix = rawKey.slice(0, 12);
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
