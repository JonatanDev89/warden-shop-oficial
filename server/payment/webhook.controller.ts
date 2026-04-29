/**
 * payment/webhook.controller.ts
 * ──────────────────────────────
 * Controller HTTP para o webhook do Mercado Pago.
 * Registrado em: POST /api/mp/webhook
 */

import type { Request, Response } from "express";
import { validateWebhookSignature } from "./mp.service";
import { processPaymentUpdate } from "./payment.service";
import { findOrderByNumber } from "./payment.repository";
import { notifyOrderAccepted } from "../discord-webhooks";

const log = {
  info: (event: string, data?: Record<string, unknown>) =>
    console.log(JSON.stringify({ ts: new Date().toISOString(), level: "INFO", event, ...data })),
  warn: (event: string, data?: Record<string, unknown>) =>
    console.warn(JSON.stringify({ ts: new Date().toISOString(), level: "WARN", event, ...data })),
  error: (event: string, data?: Record<string, unknown>) =>
    console.error(JSON.stringify({ ts: new Date().toISOString(), level: "ERROR", event, ...data })),
};

export async function handleMpWebhook(req: Request, res: Response): Promise<void> {
  const requestId = (req.headers["x-request-id"] as string) ?? "";
  const xSignature = (req.headers["x-signature"] as string) ?? "";
  const dataId =
    (req.query["data.id"] as string) ??
    (req.body?.data?.id as string) ??
    "";
  const topic =
    (req.query["type"] as string) ??
    (req.body?.type as string) ??
    "";

  // Responde 200 imediatamente — MP não retenta por timeout
  res.status(200).json({ received: true });

  // Validar assinatura
  if (dataId) {
    const { valid, reason } = validateWebhookSignature({ xSignature, xRequestId: requestId, dataId });
    if (!valid) {
      log.warn("webhook.signature_invalid", { requestId, dataId, reason });
      return;
    }
  }

  if (topic !== "payment") {
    log.info("webhook.skipped_topic", { topic, requestId });
    return;
  }

  if (!dataId) {
    log.warn("webhook.missing_data_id", { requestId });
    return;
  }

  // Processar em background
  setImmediate(async () => {
    try {
      const result = await processPaymentUpdate(dataId);

      log.info("webhook.processed", {
        requestId,
        mpPaymentId: dataId,
        action: result.action,
        orderNumber: result.orderNumber,
        reason: result.reason,
      });

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
          log.error("webhook.discord_notify_failed", {
            orderNumber: result.orderNumber,
            error: String(discordErr),
          });
        }
      }

      if (result.action === "fraud_detected") {
        log.error("webhook.fraud_alert", {
          orderNumber: result.orderNumber,
          mpPaymentId: dataId,
          reason: result.reason,
        });
      }
    } catch (err) {
      log.error("webhook.processing_error", {
        requestId,
        mpPaymentId: dataId,
        error: String(err),
      });
    }
  });
}
