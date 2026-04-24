import { and, asc, desc, eq, like, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import {
  InsertUser,
  apiKeys,
  categories,
  coupons,
  discordWebhooks,
  orderItems,
  orders,
  products,
  siteSettings,
  storeCustomization,
  users,
  kitItems,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      console.log("[Database] Connecting to:", process.env.DATABASE_URL.replace(/:([^:@]+)@/, ":***@"));
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        family: 4,
      });
      // Test connection
      pool.on("error", (err) => console.error("[Database] Pool error:", err.message));
      await pool.query("SELECT 1");
      console.log("[Database] Connected successfully");
      _db = drizzle(pool);
    } catch (error) {
      console.error("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ─────────────────────────────────────────────────────────────────────
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  for (const field of textFields) {
    const value = user[field];
    if (value === undefined) continue;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  }
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
  await db.insert(users).values(values).onConflictDoUpdate({ target: users.openId, set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getAllAdmins() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).where(eq(users.role, "admin")).orderBy(users.name);
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function setUserRole(userId: number, role: "user" | "admin") {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ role }).where(eq(users.id, userId));
}

export async function getUserByEmailWithPassword(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createLocalUser(data: { name: string; email: string; passwordHash: string; openId: string }) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.insert(users).values({
    ...data,
    loginMethod: "email",
    role: "user",
    lastSignedIn: new Date(),
  });
  const result = await db.select().from(users).where(eq(users.email, data.email)).limit(1);
  return result[0];
}

// ─── Categories ────────────────────────────────────────────────────────────────
export async function getCategories() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(categories).orderBy(asc(categories.sortOrder), asc(categories.name));
}

export async function getCategoryById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(categories).where(eq(categories.id, id)).limit(1);
  return result[0];
}

export async function createCategory(data: { name: string; description?: string }) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(categories).values(data);
  return result[0];
}

export async function updateCategory(id: number, data: { name?: string; description?: string }) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(categories).set(data).where(eq(categories.id, id));
}

export async function deleteCategory(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(categories).where(eq(categories.id, id));
}

export async function reorderCategories(orderedIds: number[]) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  for (let i = 0; i < orderedIds.length; i++) {
    await db.update(categories).set({ sortOrder: i }).where(eq(categories.id, orderedIds[i]!));
  }
}

// ─── Products ──────────────────────────────────────────────────────────────────
export async function getProducts(categoryId?: number) {
  const db = await getDb();
  if (!db) return [];
  if (categoryId) {
    return db
      .select()
      .from(products)
      .where(and(eq(products.categoryId, categoryId), eq(products.active, true)))
      .orderBy(asc(products.sortOrder), asc(products.name));
  }
  return db.select().from(products).where(eq(products.active, true)).orderBy(asc(products.sortOrder), asc(products.name));
}

export async function getAllProducts() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(products).orderBy(asc(products.sortOrder), asc(products.name));
}

export async function getProductById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(products).where(eq(products.id, id)).limit(1);
  return result[0];
}

export async function searchProducts(query: string) {
  const db = await getDb();
  if (!db) return [];
  const q = `%${query}%`;
  return db
    .select()
    .from(products)
    .where(and(eq(products.active, true), or(like(products.name, q), like(products.description, q))))
    .orderBy(products.name);
}

export async function createProduct(data: {
  categoryId: number;
  name: string;
  description?: string;
  kitContents?: string;
  price: string;
  stock?: number;
  imageUrl?: string;
  active?: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.insert(products).values({ ...data, stock: data.stock ?? -1, active: data.active ?? true });
}

export async function updateProduct(
  id: number,
  data: {
    categoryId?: number;
    name?: string;
    description?: string;
    kitContents?: string;
    price?: string;
    stock?: number;
    imageUrl?: string;
    active?: boolean;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(products).set(data).where(eq(products.id, id));
}

export async function deleteProduct(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(products).set({ active: false }).where(eq(products.id, id));
}

export async function reorderProducts(orderedIds: number[]) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  for (let i = 0; i < orderedIds.length; i++) {
    await db.update(products).set({ sortOrder: i }).where(eq(products.id, orderedIds[i]!));
  }
}

// ─── Coupons ───────────────────────────────────────────────────────────────────
export async function getCoupons() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(coupons).orderBy(desc(coupons.createdAt));
}

export async function getCouponByCode(code: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(coupons)
    .where(and(eq(coupons.code, code.toUpperCase()), eq(coupons.active, true)))
    .limit(1);
  return result[0];
}

export async function createCoupon(data: {
  code: string;
  discountType: "fixed" | "percent";
  discountValue: string;
  active?: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.insert(coupons).values({ ...data, code: data.code.toUpperCase(), active: data.active ?? true });
}

export async function updateCoupon(
  id: number,
  data: { code?: string; discountType?: "fixed" | "percent"; discountValue?: string; active?: boolean }
) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const update = data.code ? { ...data, code: data.code.toUpperCase() } : data;
  await db.update(coupons).set(update).where(eq(coupons.id, id));
}

export async function deleteCoupon(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(coupons).where(eq(coupons.id, id));
}

export async function incrementCouponUsage(code: string) {
  const db = await getDb();
  if (!db) return;
  
  const upperCode = code.toUpperCase();
  const coupon = await getCouponByCode(upperCode);
  if (!coupon) return;
  
  await db
    .update(coupons)
    .set({ usageCount: (coupon.usageCount ?? 0) + 1 })
    .where(eq(coupons.code, upperCode));
}

// ─── Orders ────────────────────────────────────────────────────────────────────
export async function getOrders() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(orders).orderBy(desc(orders.createdAt));
}

export async function getOrderById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  return result[0];
}

export async function getOrderWithItems(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const order = await getOrderById(id);
  if (!order) return undefined;
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, id));
  return { ...order, items };
}

export async function getOrderByNumber(orderNumber: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(orders).where(eq(orders.orderNumber, orderNumber)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getOrderWithItemsByNumber(orderNumber: string) {
  const db = await getDb();
  if (!db) return undefined;
  const order = await getOrderByNumber(orderNumber);
  if (!order) return undefined;
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
  return { ...order, items };
}

export async function createOrder(
  orderData: {
    orderNumber: string;
    minecraftNickname: string;
    email: string;
    couponCode?: string;
    subtotal: string;
    discount: string;
    total: string;
  },
  items: Array<{ productId: number; productName: string; quantity: number; unitPrice: string }>
) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.insert(orders).values({ ...orderData, status: "pending_approval" });
  const [newOrder] = await db
    .select()
    .from(orders)
    .where(eq(orders.orderNumber, orderData.orderNumber))
    .limit(1);
  if (newOrder && items.length > 0) {
    await db.insert(orderItems).values(items.map((item) => ({ ...item, orderId: newOrder.id })));
  }
  return newOrder;
}

export async function updateOrderStatus(id: number, status: "pending_approval" | "game_pending" | "delivered" | "cancelled") {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(orders).set({ status }).where(eq(orders.id, id));
}

export async function updateOrderNotes(id: number, notes: string) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(orders).set({ notes }).where(eq(orders.id, id));
}

export async function deleteOrder(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(orderItems).where(eq(orderItems.orderId, id));
  await db.delete(orders).where(eq(orders.id, id));
}

export async function getDashboardStats() {
  const db = await getDb();
  if (!db) return null;
  const allOrders = await db.select().from(orders);
  const totalRevenue = allOrders.reduce((sum, o) => sum + parseFloat(String(o.total)), 0);
  const statusCounts = { pending_approval: 0, game_pending: 0, delivered: 0, cancelled: 0 };
  for (const o of allOrders) statusCounts[o.status]++;
  const productCount = await db.select({ count: sql<number>`count(*)` }).from(products).where(eq(products.active, true));
  const categoryCount = await db.select({ count: sql<number>`count(*)` }).from(categories);

  // Last 7 days trend
  const trend: Record<string, { pending_approval: number; game_pending: number; cancelled: number }> = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split("T")[0]!;
    trend[key] = { pending_approval: 0, game_pending: 0, cancelled: 0 };
  }
  for (const o of allOrders) {
    const key = o.createdAt.toISOString().split("T")[0]!;
    if (trend[key]) {
      if (o.status === "delivered" || o.status === "game_pending") trend[key]!.game_pending++;
      else if (o.status === "cancelled") trend[key]!.cancelled++;
      else trend[key]!.pending_approval++;
    }
  }

  // Top buyers — only count delivered orders
  const buyerMap: Record<string, number> = {};
  for (const o of allOrders) {
    if (o.status === "delivered") {
      buyerMap[o.minecraftNickname] = (buyerMap[o.minecraftNickname] || 0) + parseFloat(String(o.total));
    }
  }
  const topBuyers = Object.entries(buyerMap)
    .map(([nickname, total]) => ({ nickname, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  return {
    totalOrders: allOrders.length,
    totalRevenue,
    statusCounts,
    productCount: Number(productCount[0]?.count ?? 0),
    categoryCount: Number(categoryCount[0]?.count ?? 0),
    trend: Object.entries(trend).map(([date, counts]) => ({ date, ...counts })),
    topBuyers,
    deliveredCount: statusCounts.delivered,
  };
}

// ─── API Keys ──────────────────────────────────────────────────────────────────
export async function getApiKeys() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(apiKeys).orderBy(desc(apiKeys.createdAt));
}

export async function createApiKey(name: string, keyHash: string, keyPrefix: string) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.insert(apiKeys).values({ name, keyHash, keyPrefix, active: true });
}

export async function revokeApiKey(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(apiKeys).set({ active: false }).where(eq(apiKeys.id, id));
}

export async function deleteApiKey(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(apiKeys).where(eq(apiKeys.id, id));
}

// ─── Discord Webhooks ──────────────────────────────────────────────────────────
export async function getWebhooks() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(discordWebhooks).orderBy(desc(discordWebhooks.createdAt));
}

export async function createWebhook(data: { type: "receipt" | "notification"; url: string; message?: string; msgPendente?: string; msgAceito?: string; msgRecusado?: string; msgEntregue?: string; msgDeletado?: string }) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.insert(discordWebhooks).values({ ...data, active: true });
}

export async function updateWebhook(id: number, data: { url?: string; active?: boolean; message?: string; msgPendente?: string; msgAceito?: string; msgRecusado?: string; msgEntregue?: string; msgDeletado?: string }) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(discordWebhooks).set(data).where(eq(discordWebhooks.id, id));
}

export async function deleteWebhook(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(discordWebhooks).where(eq(discordWebhooks.id, id));
}

export async function getActiveWebhooksByType(type: "receipt" | "notification") {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(discordWebhooks)
    .where(and(eq(discordWebhooks.type, type), eq(discordWebhooks.active, true)));
}

// ─── Site Settings ─────────────────────────────────────────────────────────────
export async function getSiteSettings(): Promise<Record<string, string>> {
  const db = await getDb();
  if (!db) return {};
  const rows = await db.select().from(siteSettings);
  return Object.fromEntries(rows.map((r) => [r.key, r.value ?? ""]));
}

export async function setSiteSetting(key: string, value: string) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db
    .insert(siteSettings)
    .values({ key, value })
    .onConflictDoUpdate({ target: siteSettings.key, set: { value } });
}

export async function setSiteSettings(settings: Record<string, string>) {
  for (const [key, value] of Object.entries(settings)) {
    await setSiteSetting(key, value);
  }
}


// ─── Store Customization ───────────────────────────────────────────────────────
export async function getStoreCustomization() {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(storeCustomization).limit(1);
  return result[0] || null;
}

export async function updateStoreCustomization(data: {
  pixKey?: string;
  pixKeyType?: "cpf" | "email" | "phone" | "random";
  storeName?: string;
  storeDescription?: string;
  bannerText?: string;
  bannerColor?: string;
  primaryColor?: string;
  secondaryColor?: string;
  logoUrl?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  
  const existing = await getStoreCustomization();
  
  if (existing) {
    await db.update(storeCustomization).set(data).where(eq(storeCustomization.id, existing.id));
  } else {
    await db.insert(storeCustomization).values(data as any);
  }
}

// ─── Kit Items ─────────────────────────────────────────────────────────────────
export async function getKitItems(onlyActive = false) {
  const db = await getDb();
  if (!db) return [];
  if (onlyActive) {
    return db.select().from(kitItems).where(eq(kitItems.active, true)).orderBy(asc(kitItems.name));
  }
  return db.select().from(kitItems).orderBy(asc(kitItems.name));
}

export async function upsertKitItem(data: {
  minecraftId: string;
  name: string;
  price: string;
  minPerSlot?: number;
  maxPerSlot?: number;
  pricePerUnit?: boolean;
  imageUrl?: string;
  active?: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db
    .insert(kitItems)
    .values({ ...data, minPerSlot: data.minPerSlot ?? 1, maxPerSlot: data.maxPerSlot ?? 64, pricePerUnit: data.pricePerUnit ?? false, active: data.active ?? true })
    .onConflictDoUpdate({
      target: kitItems.minecraftId,
      set: {
        name: data.name,
        price: data.price,
        minPerSlot: data.minPerSlot ?? 1,
        maxPerSlot: data.maxPerSlot ?? 64,
        pricePerUnit: data.pricePerUnit ?? false,
        imageUrl: data.imageUrl ?? null,
        active: data.active ?? true,
        updatedAt: new Date(),
      },
    });
}

export async function deleteKitItem(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(kitItems).where(eq(kitItems.id, id));
}

export async function runMigrations() {
  const db = await getDb();
  if (!db) return;
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "kit_items" (
        "id" serial PRIMARY KEY NOT NULL,
        "minecraftId" varchar(128) NOT NULL,
        "name" varchar(256) NOT NULL,
        "price" numeric(10, 2) NOT NULL DEFAULT '0',
        "maxPerSlot" integer NOT NULL DEFAULT 64,
        "imageUrl" text,
        "active" boolean NOT NULL DEFAULT true,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "kit_items_minecraftId_unique" UNIQUE("minecraftId")
      )
    `);
    // Add imageUrl column if table already exists without it
    await db.execute(sql`
      ALTER TABLE "kit_items" ADD COLUMN IF NOT EXISTS "imageUrl" text
    `);
    await db.execute(sql`
      ALTER TABLE "kit_items" ADD COLUMN IF NOT EXISTS "minPerSlot" integer NOT NULL DEFAULT 1
    `);
    await db.execute(sql`
      ALTER TABLE "kit_items" ADD COLUMN IF NOT EXISTS "pricePerUnit" boolean NOT NULL DEFAULT false
    `);
    console.log("[DB] Migrations applied.");
  } catch (e) {
    console.error("[DB] Migration error:", e);
  }
}
