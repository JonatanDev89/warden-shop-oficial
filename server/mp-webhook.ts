/**
 * Webhook do Mercado Pago — rota Express pura (não tRPC)
 *
 * Registrado em: POST /api/mp/webhook
 *
 * Segurança:
 * 1. Valida assinatura HMAC-SHA256 (x-signature header)
 * 2. Só processa eventos do tipo "payment"
 * 3. Busca o pagamento diretamente na API do MP (não confia no body)
 * 4. Idempotente: verifica se já foi processado antes de atualizar
 */

import type { Request, Response } from "express";
import { getMpPayment, validateMpWebhookSignature } from "./mercadopago";
import {
  getOrderByNumber,
  getOrderByMpPaymentId,
  markOrderPaid,
  markOrderPaymentFailed,
} from "./db";
import { notifyOrderAccepted } from "./discord-webhooks";

export async function handleMpWebhook(req: Request, res: Response) {
  try {
    const xSignature = req.headers["x-signature"] as string ?? "";
    const xRequestId = req.headers["x-request-id"] as string ?? "";
    const dataId = req.query["data.id"] as string ?? req.body?.data?.id ?? "";
    const topic = req.query["type"] as string ?? req.body?.type ?? "";

    // 1. Validar assinatura
    if (dataId && xSignature) {
      const valid = validateMpWebhookSignature({ xSignature, xRequestId, dataId });
      if (!valid) {
        console.warn("[MP Webhook] Assinatura inválida — rejeitando.");
        return res.status(401).json({ error: "Invalid signature" });
      }
    }

    // 2. Só processar eventos de pagamento
    if (topic !== "payment") {
      return res.status(200).json({ received: true, skipped: true });
    }

    if (!dataId) {
      return res.status(400).json({ error: "Missing data.id" });
    }

    // 3. Buscar pagamento diretamente na API do MP (fonte da verdade)
    const payment = await getMpPayment(dataId);

    if (!payment || !payment.external_reference) {
      console.warn("[MP Webhook] Pagamento sem external_reference:", dataId);
      return res.status(200).json({ received: true });
    }

    const orderNumber = payment.external_reference;
    const paymentStatus = payment.status; // approved | rejected | cancelled | pending | etc.

    // 4. Verificar idempotência — se já processamos esse payment_id, ignorar
    const existingByPaymentId = await getOrderByMpPaymentId(String(payment.id));
    if (existingByPaymentId?.paymentStatus === "approved") {
      console.log("[MP Webhook] Pagamento já processado:", payment.id);
      return res.status(200).json({ received: true, idempotent: true });
    }

    // 5. Buscar pedido pelo orderNumber
    const order = await getOrderByNumber(orderNumber);
    if (!order) {
      console.warn("[MP Webhook] Pedido não encontrado:", orderNumber);
      return res.status(200).json({ received: true });
    }

    // 6. Atualizar status conforme resultado do pagamento
    if (paymentStatus === "approved") {
      await markOrderPaid(orderNumber, String(payment.id));
      console.log(`[MP Webhook] Pedido ${orderNumber} pago — avançando para game_pending.`);

      // Notificar Discord
      try {
        const updatedOrder = await getOrderByNumber(orderNumber);
        if (updatedOrder) {
          await notifyOrderAccepted({
            ...updatedOrder,
            items: [],
            total: parseFloat(String(updatedOrder.total)),
          });
        }
      } catch (e) {
        console.error("[MP Webhook] Erro ao notificar Discord:", e);
      }
    } else if (paymentStatus === "rejected") {
      await markOrderPaymentFailed(orderNumber, String(payment.id), "rejected");
      console.log(`[MP Webhook] Pagamento rejeitado para pedido ${orderNumber}.`);
    } else if (paymentStatus === "cancelled") {
      await markOrderPaymentFailed(orderNumber, String(payment.id), "cancelled");
      console.log(`[MP Webhook] Pagamento cancelado para pedido ${orderNumber}.`);
    } else {
      // pending, in_process, etc. — apenas loga
      console.log(`[MP Webhook] Status intermediário "${paymentStatus}" para pedido ${orderNumber}.`);
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error("[MP Webhook] Erro interno:", error);
    // Retorna 200 para o MP não retentar em erros internos nossos
    return res.status(200).json({ received: true, error: "internal" });
  }
}
