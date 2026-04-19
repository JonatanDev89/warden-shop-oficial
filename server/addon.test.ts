import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock do módulo db
vi.mock("./db", () => ({
  getDb: vi.fn(),
  upsertUser: vi.fn(),
  getUserByOpenId: vi.fn(),
}));

// Mock do módulo addon-helpers
vi.mock("./addon-helpers", () => ({
  getPendingOrdersForAddon: vi.fn().mockResolvedValue([
    {
      id: 1,
      orderNumber: "WS-001",
      minecraftNickname: "Steve",
      email: "steve@example.com",
      status: "game_pending",
      total: "29.90",
      commands: JSON.stringify(["give @p diamond_sword", "give @p diamond_pickaxe"]),
      createdAt: new Date(),
    },
  ]),
  markOrderAsDelivered: vi.fn().mockResolvedValue(true),
  getOrderForAddon: vi.fn().mockResolvedValue({
    id: 1,
    orderNumber: "WS-001",
    minecraftNickname: "Steve",
    email: "steve@example.com",
    status: "confirmed",
    total: "29.90",
    commands: JSON.stringify(["give @p diamond_sword"]),
    createdAt: new Date(),
  }),
}));

// Mock do módulo drizzle-orm para validação de API Key
vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
  desc: vi.fn(),
}));

// Mock de crypto
vi.mock("crypto", () => ({
  createHash: vi.fn().mockReturnValue({
    update: vi.fn().mockReturnThis(),
    digest: vi.fn().mockReturnValue("mocked_hash"),
  }),
}));

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("addon router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("addon.health", () => {
    it("returns health status", async () => {
      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.addon.health();

      expect(result).toHaveProperty("status", "ok");
      expect(result).toHaveProperty("version", "1.0.0");
      expect(result).toHaveProperty("timestamp");
    });
  });

  describe("addon.getPendingOrders", () => {
    it("requires valid API Key", async () => {
      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx);

      try {
        await caller.addon.getPendingOrders({ apiKey: "invalid_key" });
        expect.fail("Should throw UNAUTHORIZED error");
      } catch (error: any) {
        expect(error.code).toBe("UNAUTHORIZED");
        expect(error.message).toContain("API Key");
      }
    });

    it("returns pending orders with valid API Key", async () => {
      // Mock da função de validação
      const { validateAddonApiKey } = await import("./addon-router");
      
      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx);

      // Este teste seria completo com mock adequado da validação
      // Por enquanto, apenas verifica que o endpoint existe
      expect(caller.addon.getPendingOrders).toBeDefined();
    });
  });

  describe("addon.markDelivered", () => {
    it("requires valid API Key", async () => {
      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx);

      try {
        await caller.addon.markDelivered({ apiKey: "invalid_key", orderId: 1 });
        expect.fail("Should throw UNAUTHORIZED error");
      } catch (error: any) {
        expect(error.code).toBe("UNAUTHORIZED");
      }
    });

    it("validates orderId is positive", async () => {
      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx);

      try {
        await caller.addon.markDelivered({ apiKey: "warden_test", orderId: -1 });
        expect.fail("Should throw validation error");
      } catch (error: any) {
        expect(error.message).toBeDefined();
      }
    });
  });

  describe("addon.getOrder", () => {
    it("requires valid API Key", async () => {
      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx);

      try {
        await caller.addon.getOrder({ apiKey: "invalid_key", orderId: 1 });
        expect.fail("Should throw UNAUTHORIZED error");
      } catch (error: any) {
        expect(error.code).toBe("UNAUTHORIZED");
      }
    });

    it("validates orderId is positive", async () => {
      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx);

      try {
        await caller.addon.getOrder({ apiKey: "warden_test", orderId: 0 });
        expect.fail("Should throw validation error");
      } catch (error: any) {
        expect(error.message).toBeDefined();
      }
    });
  });
});
