import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ── Mock DB helpers ──────────────────────────────────────────────────────────
vi.mock("./db", () => ({
  getDb: vi.fn(),
  upsertUser: vi.fn(),
  getUserByOpenId: vi.fn(),
  getProducts: vi.fn().mockResolvedValue([
    {
      id: 1,
      name: "Kit Iniciante",
      description: "Kit para novos jogadores",
      price: "19.90",
      stock: -1,
      active: true,
      categoryId: 1,
      imageUrl: null,
      kitContents: '["Espada de ferro","32x Pão"]',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]),
  getAllProducts: vi.fn().mockResolvedValue([]),
  getTopBuyers: vi.fn().mockResolvedValue([{ nickname: "Steve", total: 99.9 }]),
  getProductById: vi.fn().mockResolvedValue({
    id: 1,
    name: "Kit Iniciante",
    description: "Kit para novos jogadores",
    price: "19.90",
    stock: -1,
    active: true,
    categoryId: 1,
    imageUrl: null,
    kitContents: '["Espada de ferro","32x Pão"]',
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
  getCategories: vi.fn().mockResolvedValue([
    { id: 1, name: "Kits", description: "Kits para iniciantes", createdAt: new Date(), updatedAt: new Date() },
  ]),
  searchProducts: vi.fn().mockResolvedValue([
    {
      id: 1,
      name: "Kit Iniciante",
      description: "Kit para novos jogadores",
      price: "19.90",
      stock: -1,
      active: true,
      categoryId: 1,
      imageUrl: null,
      kitContents: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]),
  getCouponByCode: vi.fn().mockResolvedValue({
    id: 1,
    code: "DESCONTO10",
    discountType: "percent",
    discountValue: "10.00",
    active: true,
    usageCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
  createOrder: vi.fn().mockResolvedValue({ id: 1, orderNumber: "WS-001" }),
  createOrderItems: vi.fn().mockResolvedValue(undefined),
  incrementCouponUsage: vi.fn().mockResolvedValue(undefined),
  getSiteSettings: vi.fn().mockResolvedValue({ storeName: "Warden Shop" }),
  getUserByEmail: vi.fn(),
  getAllAdmins: vi.fn().mockResolvedValue([]),
  setUserRole: vi.fn().mockResolvedValue(undefined),
  getOrders: vi.fn().mockResolvedValue([]),
  getOrderById: vi.fn().mockResolvedValue(null),
  updateOrderStatus: vi.fn().mockResolvedValue(undefined),
  updateOrderNotes: vi.fn().mockResolvedValue(undefined),
  deleteOrder: vi.fn().mockResolvedValue(undefined),
  createProduct: vi.fn().mockResolvedValue({ id: 2 }),
  updateProduct: vi.fn().mockResolvedValue(undefined),
  deleteProduct: vi.fn().mockResolvedValue(undefined),
  createCategory: vi.fn().mockResolvedValue({ id: 2 }),
  updateCategory: vi.fn().mockResolvedValue(undefined),
  deleteCategory: vi.fn().mockResolvedValue(undefined),
  getCoupons: vi.fn().mockResolvedValue([]),
  createCoupon: vi.fn().mockResolvedValue({ id: 1 }),
  updateCoupon: vi.fn().mockResolvedValue(undefined),
  deleteCoupon: vi.fn().mockResolvedValue(undefined),
  getWebhooks: vi.fn().mockResolvedValue([]),
  getActiveWebhooksByType: vi.fn().mockResolvedValue([]),
  createWebhook: vi.fn().mockResolvedValue({ id: 1 }),
  updateWebhook: vi.fn().mockResolvedValue(undefined),
  deleteWebhook: vi.fn().mockResolvedValue(undefined),
  getApiKeys: vi.fn().mockResolvedValue([]),
  createApiKey: vi.fn().mockResolvedValue(undefined),
  revokeApiKey: vi.fn().mockResolvedValue(undefined),
  deleteApiKey: vi.fn().mockResolvedValue(undefined),
  setSiteSettings: vi.fn().mockResolvedValue(undefined),
  getDashboardStats: vi.fn().mockResolvedValue({
    totalOrders: 5,
    totalRevenue: 150.0,
    productCount: 3,
    categoryCount: 2,
    statusCounts: { pending: 2, confirmed: 1, delivered: 2, cancelled: 0 },
    trend: [],
    deliveredCount: 2,
  }),
}));

// ── Context helpers ──────────────────────────────────────────────────────────
function makePublicCtx(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

function makeAdminCtx(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "admin-open-id",
      email: "admin@example.com",
      name: "Admin User",
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────
describe("shop.getCategories", () => {
  it("returns a list of categories", async () => {
    const caller = appRouter.createCaller(makePublicCtx());
    const result = await caller.shop.getCategories();
    expect(Array.isArray(result)).toBe(true);
    expect(result[0]?.name).toBe("Kits");
  });
});

describe("shop.getProducts", () => {
  it("returns products without filter", async () => {
    const caller = appRouter.createCaller(makePublicCtx());
    const result = await caller.shop.getProducts({});
    expect(Array.isArray(result)).toBe(true);
    expect(result[0]?.name).toBe("Kit Iniciante");
  });
});

describe("shop.getProduct", () => {
  it("returns a single product by id", async () => {
    const caller = appRouter.createCaller(makePublicCtx());
    const result = await caller.shop.getProduct({ id: 1 });
    expect(result?.id).toBe(1);
    expect(result?.name).toBe("Kit Iniciante");
  });
});

describe("shop.validateCoupon", () => {
  it("validates a valid coupon code", async () => {
    const caller = appRouter.createCaller(makePublicCtx());
    const result = await caller.shop.validateCoupon({ code: "DESCONTO10" });
    expect(result.code).toBe("DESCONTO10");
    expect(result.discountType).toBe("percent");
  });
});

describe("shop.searchProducts", () => {
  it("returns products matching query", async () => {
    const caller = appRouter.createCaller(makePublicCtx());
    const result = await caller.shop.searchProducts({ query: "kit" });
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("shop.getSettings", () => {
  it("returns site settings", async () => {
    const caller = appRouter.createCaller(makePublicCtx());
    const result = await caller.shop.getSettings();
    expect(result).toBeDefined();
  });
});

describe("admin.getDashboard", () => {
  it("returns dashboard stats for admin", async () => {
    const caller = appRouter.createCaller(makeAdminCtx());
    const result = await caller.admin.getDashboard();
    expect(result?.totalOrders).toBe(5);
    expect(result?.totalRevenue).toBe(150.0);
  });
});

describe("admin.getCategories", () => {
  it("returns categories for admin", async () => {
    const caller = appRouter.createCaller(makeAdminCtx());
    const result = await caller.admin.getCategories();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("admin.getCoupons", () => {
  it("returns coupons for admin", async () => {
    const caller = appRouter.createCaller(makeAdminCtx());
    const result = await caller.admin.getCoupons();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("admin.getWebhooks", () => {
  it("returns webhooks for admin", async () => {
    const caller = appRouter.createCaller(makeAdminCtx());
    const result = await caller.admin.getWebhooks();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("admin.getApiKeys", () => {
  it("returns api keys for admin", async () => {
    const caller = appRouter.createCaller(makeAdminCtx());
    const result = await caller.admin.getApiKeys();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("auth.logout", () => {
  it("clears cookie and returns success", async () => {
    const ctx = makePublicCtx();
    const clearedCookies: string[] = [];
    (ctx.res as any).clearCookie = (name: string) => clearedCookies.push(name);
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result.success).toBe(true);
  });
});
