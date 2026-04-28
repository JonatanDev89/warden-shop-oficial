/**
 * payment/webhook.controller.ts
 * ──────────────────────────────
 * Controller HTTP para o webhook do Mercado Pago.
 *
 * Registrado em: POST /api/mp/webhook
 *
 * Princípios:
 *   1. Responde 200 IMEDIATAMENTE — lógica pesada roda em background
 *   2. Valida assinatura ANTES de qualquer processamento
 *   3. Só processa eventos do tipo "payment"
 *   4. NUNCA confia no body — busca pagamento na API do MP
 *   5. Logs estruturados sem dados sensíveis
 */

import type { Request, Response } from "express";
import { validateWebhookSignature } from "./mp.service";
import { processPaymentUpdate } from "./payment.service";
import { logger } from "./logger";
import { notifyOrderAccepted } from "../discord-webhooks";
import { findOrderByNumber } from "./payment.repository";

export async function handleMpWebhook(req: Request, res: Response): Promise<void> {
  const requestId = (req.headers["x-request-id"] as string) ?? "";
  const xSignature = (req.headers["x-signature"] as string) ?? "";

  // Extrai data.id de query string ou body (MP envia de ambas as formas)
  const dataId =
    (req.query["data.id"] as string) ??
    (req.body?.data?.id as string) ??
    "";
  const topic =
    (req.query["type"] as string) ??
    (req.body?.type as string) ??
    "";

  // ── 1. Responde 200 imediatamente para o MP não retentar por timeout ─────────
  // O processamento real acontece em background (fire-and-forget com tratamento)
  res.status(200).json({ received: true });

  // ── 2. Validar assinatura HMAC-SHA256 ────────────────────────────────────────
  if (dataId) {
    const { valid, reason } = validateWebhookSignature({
      xSignature,
      xRequestId: requestId,
      dataId,
    });

    if (!valid) {
      logger.warn("webhook.signature_invalid", {
        requestId,
        dataId,
        reason,
        // NÃO loga o xSignature completo (contém HMAC)
      });
      return; // Já respondemos 200, apenas ignoramos
    }
  }

  // ── 3. Filtrar apenas eventos de pagamento ───────────────────────────────────
  if (topic !== "payment") {
    logger.info("webhook.skipped_topic", { topic, requestId });
    return;
  }

  if (!dataId) {
    logger.warn("webhook.missing_data_id", { requestId, body: "[omitted]" });
    return;
  }

  // ── 4. Processar em background (não bloqueia a resposta HTTP) ────────────────
  setImmediate(async () => {
    try {
      const result = await processPaymentUpdate(dataId);

      logger.info("webhook.processed", {
        requestId,
        mpPaymentId: dataId,
        action: result.action,
        orderNumber: result.orderNumber,
        reason: result.reason,
      });

      // Notificar Discord apenas quando aprovado
      if (result.action === "approved" && result.orderNumber) {
        try {
          const order = await findOrderByNumber(result.orderNumber);
          if (order) {
            await notifyOrderAccepted({
              ...order,
              items: [],
              total: parseFloat(String(order.total)),
            });
          }
        } catch (discordErr) {
          // Falha no Discord não deve afetar o fluxo de pagamento
          logger.error("webhook.discord_notify_failed", {
            orderNumber: result.orderNumber,
            error: String(discordErr),
          });
        }
      }

      if (result.action === "fraud_detected") {
        logger.error("webhook.fraud_alert", {
          orderNumber: result.orderNumber,
          mpPaymentId: dataId,
          reason: result.reason,
        });
        // TODO: enviar alerta para Discord/email do admin
      }
    } catch (err) {
      logger.error("webhook.processing_error", {
        requestId,
        mpPaymentId: dataId,
        error: String(err),
      });
      // Não relança — já respondemos 200. O MP não vai retentar.
      // Para casos críticos, o admin pode reprocessar manualmente via painel.
    }
  });
}
