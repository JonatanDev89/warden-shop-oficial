/**
 * payment/mp.service.ts
 * ─────────────────────
 * Camada de serviço do Mercado Pago.
 * Responsabilidades:
 *   - Criar preferências de pagamento
 *   - Verificar pagamentos diretamente na API do MP (fonte da verdade)
 *   - Validar assinatura HMAC-SHA256 dos webhooks
 *   - NUNCA expor o access token em logs ou respostas
 */

import crypto from "crypto";
import { MercadoPagoConfig, Preference, Payment } from "mercadopago";
import { ENV } from "../_core/env";
import { logger } from "./logger";

// ─── Hierarquia de status de pagamento ────────────────────────────────────────
// Garante que nunca regredimos um status (ex: approved → pending)
export type PaymentStatus =
  | "pending"
  | "in_process"
  | "approved"
  | "rejected"
  | "cancelled"
  | "refunded"
  | "charged_back";

const STATUS_RANK: Record<PaymentStatus, number> = {
  pending:      0,
  in_process:   1,
  rejected:     2,
  cancelled:    2,
  approved:     3,
  charged_back: 4,
  refunded:     5,
};

/**
 * Retorna true se `next` é um avanço válido em relação a `current`.
 * Impede regressão de status (ex: approved → pending).
 */
export function canTransitionTo(
  current: PaymentStatus | null | undefined,
  next: PaymentStatus
): boolean {
  const currentRank = STATUS_RANK[current ?? "pending"] ?? 0;
  const nextRank = STATUS_RANK[next] ?? 0;
  return nextRank >= currentRank;
}

// ─── Cliente MP (singleton lazy) ──────────────────────────────────────────────
let _mpClient: MercadoPagoConfig | null = null;

function getMpClient(): MercadoPagoConfig {
  if (!_mpClient) {
    // Lê em tempo de execução para garantir que as env vars do Render estão disponíveis
    const token = process.env.MP_ACCESS_TOKEN ?? ENV.mpAccessToken;
    if (!token) {
      throw new Error("MP_ACCESS_TOKEN não configurado.");
    }
    _mpClient = new MercadoPagoConfig({
      accessToken: token,
      options: { timeout: 12_000, retries: 2 },
    });
  }
  return _mpClient;
}

// ─── Tipos públicos ────────────────────────────────────────────────────────────
export interface MpPreferenceItem {
  id: string;
  title: string;
  quantity: number;
  unit_price: number;
}

export interface CreatePreferenceInput {
  orderNumber: string;
  expectedTotal: number; // valor que calculamos no backend — usado para anti-fraude
  items: MpPreferenceItem[];
  payerEmail: string;
  payerName?: string;
}

export interface MpPreferenceResult {
  preferenceId: string;
  checkoutUrl: string; // URL correta para o ambiente atual
}

export interface VerifiedPayment {
  mpPaymentId: string;
  externalReference: string; // = orderNumber
  status: PaymentStatus;
  statusDetail: string;
  paidAmount: number;        // valor efetivamente pago
  currency: string;
  payerEmail: string;
  paymentMethodId: string;
  dateApproved: Date | null;
}

// ─── Criar preferência ────────────────────────────────────────────────────────
export async function createPreference(
  input: CreatePreferenceInput
): Promise<MpPreferenceResult> {
  const client = getMpClient();
  const preference = new Preference(client);
  const baseUrl = (process.env.APP_BASE_URL ?? ENV.appBaseUrl).replace(/\/$/, "");

  // Arredonda para 2 casas — MP rejeita mais casas decimais
  const items = input.items.map((item) => ({
    id: item.id,
    title: item.title.slice(0, 256),
    quantity: item.quantity,
    unit_price: Math.round(item.unit_price * 100) / 100,
    currency_id: "BRL",
  }));

  // Verifica que a soma dos itens bate com o total esperado (anti-fraude)
  const itemsTotal = items.reduce(
    (sum, i) => sum + i.unit_price * i.quantity,
    0
  );
  const diff = Math.abs(itemsTotal - input.expectedTotal);
  if (diff > 0.02) {
    throw new Error(
      `Inconsistência de valor: itens=${itemsTotal.toFixed(2)} esperado=${input.expectedTotal.toFixed(2)}`
    );
  }

  const result = await preference.create({
    body: {
      external_reference: input.orderNumber,
      items,
      payer: {
        email: input.payerEmail,
        // Não enviamos CPF/nome completo para não expor dados desnecessários
      },
      back_urls: {
        success: `${baseUrl}/pedido-confirmado?orderNumber=${encodeURIComponent(input.orderNumber)}&payment=success`,
        failure: `${baseUrl}/pedido-confirmado?orderNumber=${encodeURIComponent(input.orderNumber)}&payment=failure`,
        pending: `${baseUrl}/pedido-confirmado?orderNumber=${encodeURIComponent(input.orderNumber)}&payment=pending`,
      },
      auto_return: "approved",
      notification_url: `${baseUrl}/api/mp/webhook`,
      statement_descriptor: "WARDEN SHOP",
      expires: true,
      expiration_date_from: new Date().toISOString(),
      expiration_date_to: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    },
  });

  if (!result.id || !result.init_point) {
    throw new Error("Resposta inválida do Mercado Pago ao criar preferência.");
  }

  const checkoutUrl = (process.env.NODE_ENV === "production" || ENV.isProduction)
    ? result.init_point
    : (result.sandbox_init_point ?? result.init_point);

  logger.info("mp.preference.created", {
    orderNumber: input.orderNumber,
    preferenceId: result.id,
    // NÃO loga o access token nem dados do pagador
  });

  return { preferenceId: result.id, checkoutUrl };
}

// ─── Verificar pagamento na API do MP (fonte da verdade) ──────────────────────
export async function verifyPayment(paymentId: string): Promise<VerifiedPayment> {
  const client = getMpClient();
  const paymentApi = new Payment(client);

  const data = await paymentApi.get({ id: paymentId });

  if (!data || !data.id) {
    throw new Error(`Pagamento ${paymentId} não encontrado na API do MP.`);
  }

  const status = normalizeStatus(data.status ?? "pending");

  return {
    mpPaymentId: String(data.id),
    externalReference: data.external_reference ?? "",
    status,
    statusDetail: data.status_detail ?? "",
    paidAmount: data.transaction_amount ?? 0,
    currency: data.currency_id ?? "BRL",
    payerEmail: data.payer?.email ?? "",
    paymentMethodId: data.payment_method_id ?? "",
    dateApproved: data.date_approved ? new Date(data.date_approved) : null,
  };
}

// ─── Normalizar status do MP para nosso enum ──────────────────────────────────
function normalizeStatus(mpStatus: string): PaymentStatus {
  const map: Record<string, PaymentStatus> = {
    pending:      "pending",
    in_process:   "in_process",
    approved:     "approved",
    rejected:     "rejected",
    cancelled:    "cancelled",
    refunded:     "refunded",
    charged_back: "charged_back",
    authorized:   "in_process",
  };
  return map[mpStatus] ?? "pending";
}

// ─── Validar assinatura HMAC-SHA256 do webhook ────────────────────────────────
/**
 * Formato do header x-signature:
 *   ts=<timestamp>,v1=<hmac-hex>
 *
 * String assinada:
 *   "id:<data.id>;request-id:<x-request-id>;ts:<ts>;"
 *
 * Ref: https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks
 */
export function validateWebhookSignature(params: {
  xSignature: string;
  xRequestId: string;
  dataId: string;
}): { valid: boolean; reason?: string } {
  const secret = process.env.MP_WEBHOOK_SECRET ?? ENV.mpWebhookSecret;
  if (!secret) {
    if (!ENV.isProduction) {
      logger.warn("mp.webhook.no_secret", { msg: "MP_WEBHOOK_SECRET ausente — pulando validação em dev" });
      return { valid: true };
    }
    return { valid: false, reason: "MP_WEBHOOK_SECRET não configurado em produção" };
  }

  if (!params.xSignature) {
    return { valid: false, reason: "Header x-signature ausente" };
  }

  try {
    const parts = params.xSignature.split(",");
    let ts = "";
    let v1 = "";

    for (const part of parts) {
      const eqIdx = part.indexOf("=");
      if (eqIdx === -1) continue;
      const key = part.slice(0, eqIdx).trim();
      const val = part.slice(eqIdx + 1).trim();
      if (key === "ts") ts = val;
      if (key === "v1") v1 = val;
    }

    if (!ts || !v1) {
      return { valid: false, reason: "x-signature malformado (ts ou v1 ausente)" };
    }

    // Rejeitar timestamps muito antigos (replay attack — janela de 5 min)
    const tsMs = parseInt(ts, 10) * 1000;
    const ageSec = (Date.now() - tsMs) / 1000;
    if (ageSec > 300) {
      return { valid: false, reason: `Timestamp expirado (${Math.round(ageSec)}s atrás)` };
    }

    const manifest = `id:${params.dataId};request-id:${params.xRequestId};ts:${ts};`;
    const expected = crypto
      .createHmac("sha256", secret)
      .update(manifest)
      .digest("hex");

    // Comparação em tempo constante para evitar timing attacks
    const expectedBuf = Buffer.from(expected, "hex");
    const receivedBuf = Buffer.from(v1, "hex");

    if (expectedBuf.length !== receivedBuf.length) {
      return { valid: false, reason: "Tamanho do HMAC inválido" };
    }

    const match = crypto.timingSafeEqual(expectedBuf, receivedBuf);
    return match ? { valid: true } : { valid: false, reason: "HMAC não confere" };
  } catch (err) {
    return { valid: false, reason: `Erro ao validar assinatura: ${String(err)}` };
  }
}
