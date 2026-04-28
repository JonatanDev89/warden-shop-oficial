/**
 * Mercado Pago integration — Checkout Pro
 *
 * Segurança:
 * - Nunca recebe dados de cartão (tudo no checkout hospedado pelo MP)
 * - Webhook validado via assinatura HMAC-SHA256
 * - Preferência criada server-side com external_reference = orderNumber
 * - Idempotência: cada pedido tem um external_reference único
 */

import { MercadoPagoConfig, Preference, Payment } from "mercadopago";
import { ENV } from "./_core/env";

// ─── Cliente MP (lazy init) ────────────────────────────────────────────────────
let _mpClient: MercadoPagoConfig | null = null;

function getMpClient(): MercadoPagoConfig {
  if (!_mpClient) {
    if (!ENV.mpAccessToken) {
      throw new Error("MP_ACCESS_TOKEN não configurado. Adicione ao .env.");
    }
    _mpClient = new MercadoPagoConfig({
      accessToken: ENV.mpAccessToken,
      options: { timeout: 10_000 },
    });
  }
  return _mpClient;
}

// ─── Tipos ─────────────────────────────────────────────────────────────────────
export interface MpItem {
  id: string;
  title: string;
  quantity: number;
  unit_price: number;
  currency_id?: string;
}

export interface CreatePreferenceInput {
  orderNumber: string;
  items: MpItem[];
  payerEmail: string;
  payerName?: string;
}

export interface MpPreferenceResult {
  id: string;
  init_point: string;       // URL de pagamento (produção)
  sandbox_init_point: string; // URL de pagamento (sandbox)
}

// ─── Criar preferência de pagamento ───────────────────────────────────────────
export async function createMpPreference(
  input: CreatePreferenceInput
): Promise<MpPreferenceResult> {
  const client = getMpClient();
  const preference = new Preference(client);

  const baseUrl = ENV.appBaseUrl.replace(/\/$/, "");

  const result = await preference.create({
    body: {
      external_reference: input.orderNumber,
      items: input.items.map((item) => ({
        id: item.id,
        title: item.title,
        quantity: item.quantity,
        unit_price: item.unit_price,
        currency_id: item.currency_id ?? "BRL",
      })),
      payer: {
        email: input.payerEmail,
        name: input.payerName,
      },
      back_urls: {
        success: `${baseUrl}/pedido-confirmado?orderNumber=${input.orderNumber}&payment=success`,
        failure: `${baseUrl}/checkout?orderNumber=${input.orderNumber}&payment=failure`,
        pending: `${baseUrl}/pedido-confirmado?orderNumber=${input.orderNumber}&payment=pending`,
      },
      auto_return: "approved",
      notification_url: `${baseUrl}/api/mp/webhook`,
      statement_descriptor: "WARDEN SHOP",
      // Expira em 24h
      expires: true,
      expiration_date_from: new Date().toISOString(),
      expiration_date_to: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    },
  });

  if (!result.id || !result.init_point) {
    throw new Error("Falha ao criar preferência no Mercado Pago.");
  }

  return {
    id: result.id,
    init_point: result.init_point,
    sandbox_init_point: result.sandbox_init_point ?? result.init_point,
  };
}

// ─── Buscar pagamento por ID ───────────────────────────────────────────────────
export async function getMpPayment(paymentId: string) {
  const client = getMpClient();
  const payment = new Payment(client);
  return payment.get({ id: paymentId });
}

// ─── Validar assinatura do webhook ────────────────────────────────────────────
/**
 * O Mercado Pago envia o header x-signature com:
 *   ts=<timestamp>,v1=<hmac>
 *
 * A string assinada é: "id:<payment_id>;request-id:<x-request-id>;ts:<ts>;"
 * Ref: https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks
 */
import crypto from "crypto";

export function validateMpWebhookSignature(params: {
  xSignature: string;
  xRequestId: string;
  dataId: string;
}): boolean {
  if (!ENV.mpWebhookSecret) {
    // Se não configurou o secret, loga aviso mas não bloqueia em dev
    if (!ENV.isProduction) {
      console.warn("[MP Webhook] MP_WEBHOOK_SECRET não configurado — pulando validação em dev.");
      return true;
    }
    console.error("[MP Webhook] MP_WEBHOOK_SECRET não configurado em produção!");
    return false;
  }

  try {
    const parts = params.xSignature.split(",");
    let ts = "";
    let v1 = "";
    for (const part of parts) {
      const [key, val] = part.trim().split("=");
      if (key === "ts") ts = val ?? "";
      if (key === "v1") v1 = val ?? "";
    }

    if (!ts || !v1) return false;

    const manifest = `id:${params.dataId};request-id:${params.xRequestId};ts:${ts};`;
    const expected = crypto
      .createHmac("sha256", ENV.mpWebhookSecret)
      .update(manifest)
      .digest("hex");

    return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(v1, "hex"));
  } catch {
    return false;
  }
}
