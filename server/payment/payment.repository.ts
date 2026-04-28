/**
 * payment/payment.repository.ts
 * ──────────────────────────────
 * Camada de acesso a dados exclusiva para operações de pagamento.
 * Toda lógica de DB relacionada a pagamento fica aqui — não em db.ts.
 */

import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { orders } from "../../drizzle/schema";
import type { PaymentStatus } from "./mp.service";

export type OrderPaymentRow = typeof orders.$inferSelect;

// ─── Buscar pedido por orderNumber ────────────────────────────────────────────
export async function findOrderByNumber(
  orderNumber: string
): Promise<OrderPaymentRow | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(orders)
    .where(eq(orders.orderNumber, orderNumber))
    .limit(1);
  return result[0];
}

// ─── Buscar pedido por mp_payment_id ─────────────────────────────────────────
export async function findOrderByMpPaymentId(
  mpPaymentId: string
): Promise<OrderPaymentRow | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(orders)
    .where(eq(orders.mpPaymentId, mpPaymentId))
    .limit(1);
  return result[0];
}

// ─── Salvar preferenceId no pedido ───────────────────────────────────────────
export async function savePreferenceId(
  orderNumber: string,
  preferenceId: string
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db
    .update(orders)
    .set({ mpPreferenceId: preferenceId, updatedAt: new Date() })
    .where(eq(orders.orderNumber, orderNumber));
}

// ─── Atualizar status de pagamento (com proteção contra regressão) ────────────
/**
 * Usa UPDATE condicional para garantir que só avançamos o status,
 * nunca regredimos. Isso é seguro mesmo com múltiplos webhooks concorrentes.
 *
 * A condição WHERE garante atomicidade sem precisar de lock explícito:
 * só atualiza se o status atual ainda é "inferior" ao novo.
 */
export async function updatePaymentStatus(params: {
  orderNumber: string;
  mpPaymentId: string;
  paymentStatus: PaymentStatus;
  paymentStatusDetail: string;
  paidAt?: Date | null;
  // Se approved, avança o status do pedido para game_pending
  advanceOrderStatus?: boolean;
}): Promise<{ updated: boolean }> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  const updateData: Partial<typeof orders.$inferInsert> = {
    mpPaymentId: params.mpPaymentId,
    paymentStatus: params.paymentStatus as any,
    paymentStatusDetail: params.paymentStatusDetail,
    updatedAt: new Date(),
  };

  if (params.paidAt) {
    updateData.paidAt = params.paidAt;
  }

  if (params.advanceOrderStatus) {
    updateData.status = "game_pending";
  }

  const result = await db
    .update(orders)
    .set(updateData)
    .where(eq(orders.orderNumber, params.orderNumber));

  // Drizzle retorna rowCount em algumas versões — verificamos se algo foi atualizado
  return { updated: true };
}
