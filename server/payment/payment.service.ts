/**
 * payment/payment.service.ts
 * ──────────────────────────
 * Orquestra toda a lógica de negócio de pagamento.
 *
 * Responsabilidades:
 *   - Criar preferência MP a partir de um pedido existente
 *   - Processar atualização de pagamento (chamado pelo webhook)
 *   - Anti-fraude: validar valor pago vs esperado
 *   - Idempotência: não reprocessar o mesmo payment_id com mesmo status
 *   - Hierarquia de status: nunca regredir
 */

import {
  createPreference,
  verifyPayment,
  canTransitionTo,
  type PaymentStatus,
  type MpPreferenceItem,
} from "./mp.service";
import {
  findOrderByNumber,
  findOrderByMpPaymentId,
  savePreferenceId,
  updatePaymentStatus,
  type OrderPaymentRow,
} from "./payment.repository";
import { getOrderWithItemsByNumber } from "../db";
import { logger } from "./logger";
import { ENV } from "../_core/env";

// ─── Tolerância de valor para anti-fraude (R$ 0,01) ──────────────────────────
const AMOUNT_TOLERANCE = 0.01;

// ─── Criar preferência de pagamento ──────────────────────────────────────────
export async function initiatePayment(orderNumber: string): Promise<{
  preferenceId: string;
  checkoutUrl: string;
}> {
  const order = await getOrderWithItemsByNumber(orderNumber);
  if (!order) {
    throw new Error(`Pedido ${orderNumber} não encontrado.`);
  }

  // Não permite criar nova preferência se já foi pago
  if (order.paymentStatus === "approved") {
    throw new Error("Este pedido já foi pago.");
  }

  const expectedTotal = parseFloat(String(order.total));

  // Monta itens para o MP a partir dos itens reais do pedido
  const mpItems: MpPreferenceItem[] = order.items.map((item) => ({
    id: String(item.productId || item.id),
    title: item.productName.slice(0, 256),
    quantity: item.quantity,
    unit_price: Math.round(parseFloat(String(item.unitPrice)) * 100) / 100,
  }));

  // Se tiver desconto, adiciona como item negativo para o MP
  const discount = parseFloat(String(order.discount ?? "0"));
  if (discount > 0) {
    mpItems.push({
      id: "discount",
      title: `Desconto (${order.couponCode ?? "cupom"})`,
      quantity: 1,
      unit_price: -Math.round(discount * 100) / 100,
    });
  }

  const result = await createPreference({
    orderNumber,
    expectedTotal,
    items: mpItems,
    payerEmail: order.email,
    payerName: order.minecraftNickname,
  });

  await savePreferenceId(orderNumber, result.preferenceId);

  logger.info("payment.initiated", {
    orderNumber,
    preferenceId: result.preferenceId,
    expectedTotal,
  });

  return result;
}

// ─── Processar atualização de pagamento (chamado pelo webhook) ────────────────
export interface ProcessPaymentResult {
  action: "approved" | "failed" | "pending" | "skipped" | "fraud_detected";
  orderNumber: string;
  reason?: string;
}

export async function processPaymentUpdate(
  mpPaymentId: string
): Promise<ProcessPaymentResult> {
  // 1. Buscar pagamento diretamente na API do MP (NUNCA confiar no body do webhook)
  let verified;
  try {
    verified = await verifyPayment(mpPaymentId);
  } catch (err) {
    logger.error("payment.verify.failed", { mpPaymentId, error: String(err) });
    throw err; // Propaga para o webhook responder 500 e o MP retentar
  }

  const { externalReference: orderNumber, status, statusDetail, paidAmount } = verified;

  if (!orderNumber) {
    logger.warn("payment.no_external_reference", { mpPaymentId });
    return { action: "skipped", orderNumber: "", reason: "external_reference ausente" };
  }

  // 2. Idempotência — verificar se já processamos este payment_id com este status
  const existingByPaymentId = await findOrderByMpPaymentId(mpPaymentId);
  if (existingByPaymentId) {
    const currentStatus = existingByPaymentId.paymentStatus as PaymentStatus | null;
    if (!canTransitionTo(currentStatus, status)) {
      logger.info("payment.idempotent_skip", {
        mpPaymentId,
        orderNumber,
        currentStatus,
        incomingStatus: status,
      });
      return { action: "skipped", orderNumber, reason: `Regressão de status bloqueada: ${currentStatus} → ${status}` };
    }
  }

  // 3. Buscar pedido pelo orderNumber
  const order = await findOrderByNumber(orderNumber);
  if (!order) {
    logger.warn("payment.order_not_found", { mpPaymentId, orderNumber });
    return { action: "skipped", orderNumber, reason: "Pedido não encontrado" };
  }

  // 4. Verificar hierarquia de status do pedido atual
  const currentPaymentStatus = order.paymentStatus as PaymentStatus | null;
  if (!canTransitionTo(currentPaymentStatus, status)) {
    logger.info("payment.status_regression_blocked", {
      orderNumber,
      currentPaymentStatus,
      incomingStatus: status,
    });
    return {
      action: "skipped",
      orderNumber,
      reason: `Regressão bloqueada: ${currentPaymentStatus} → ${status}`,
    };
  }

  // 5. Anti-fraude: validar valor pago vs valor esperado (só para approved)
  if (status === "approved") {
    const expectedTotal = parseFloat(String(order.total));
    const diff = Math.abs(paidAmount - expectedTotal);

    if (diff > AMOUNT_TOLERANCE) {
      logger.error("payment.fraud_detected", {
        orderNumber,
        mpPaymentId,
        expectedTotal,
        paidAmount,
        diff,
      });
      // Marca como suspeito mas NÃO cancela automaticamente — admin deve revisar
      await updatePaymentStatus({
        orderNumber,
        mpPaymentId,
        paymentStatus: "pending",
        paymentStatusDetail: `FRAUDE_SUSPEITA: esperado=${expectedTotal} pago=${paidAmount}`,
      });
      return {
        action: "fraud_detected",
        orderNumber,
        reason: `Valor pago (${paidAmount}) difere do esperado (${expectedTotal})`,
      };
    }
  }

  // 6. Aplicar transição de status
  if (status === "approved") {
    await updatePaymentStatus({
      orderNumber,
      mpPaymentId,
      paymentStatus: "approved",
      paymentStatusDetail: statusDetail,
      paidAt: verified.dateApproved ?? new Date(),
      advanceOrderStatus: true, // → game_pending
    });

    logger.info("payment.approved", {
      orderNumber,
      mpPaymentId,
      paidAmount,
      paymentMethod: verified.paymentMethodId,
    });

    return { action: "approved", orderNumber };
  }

  if (status === "rejected" || status === "cancelled") {
    await updatePaymentStatus({
      orderNumber,
      mpPaymentId,
      paymentStatus: status,
      paymentStatusDetail: statusDetail,
    });

    logger.info("payment.failed", { orderNumber, mpPaymentId, status, statusDetail });
    return { action: "failed", orderNumber };
  }

  if (status === "refunded" || status === "charged_back") {
    await updatePaymentStatus({
      orderNumber,
      mpPaymentId,
      paymentStatus: status,
      paymentStatusDetail: statusDetail,
    });

    logger.info("payment.refunded", { orderNumber, mpPaymentId, status });
    return { action: "failed", orderNumber };
  }

  // in_process, pending — status intermediário
  await updatePaymentStatus({
    orderNumber,
    mpPaymentId,
    paymentStatus: status,
    paymentStatusDetail: statusDetail,
  });

  logger.info("payment.pending", { orderNumber, mpPaymentId, status, statusDetail });
  return { action: "pending", orderNumber };
}
