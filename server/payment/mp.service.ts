/**
 * payment/mp.service.ts
 * ─────────────────────
 * Camada de serviço do Mercado Pago — Checkout Pro.
 *
 * Segurança:
 *   - Token NUNCA exposto em logs (apenas prefixo)
 *   - Webhook validado via HMAC-SHA256
 *   - Anti-fraude: valor pago vs esperado
 *   - Hierarquia de status: nunca regredir
 */

import crypto from "crypto";
import { MercadoPagoConfig, Preference, Payment } from "mercadopago";
import { ENV } from "../_core/env";

// ─── Logger seguro inline (evita problema de resolução de módulo) ─────────────
const log = {
  info: (event: string, data?: Record<string, unknown>) =>
    console.log(JSON.stringify({ ts: new Date().toISOString(), level: "INFO", event, ...redact(data ?? {}) })),
  warn: (event: string, data?: Record<string, unknown>) =>
    console.warn(JSON.stringify({ ts: new Date().toISOString(), level: "WARN", event, ...redact(data ?? {}) })),
  error: (event: string, data?: Record<string, unknown>) =>
    console.error(JSON.stringify({ ts: new Date().toISOString(), level: "ERROR", event, ...redact(data ?? {}) })),
};

const SENSITIVE = new Set(["access_token", "mp_access_token", "password", "secret", "authorization"]);
function redact(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = SENSITIVE.has(k.toLowerCase()) ? "[REDACTED]" : v;
  }
  return out;
}

// ─── Hierarquia de status ─────────────────────────────────────────────────────
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

export function canTransitionTo(
  current: PaymentStatus | null | undefined,
  next: PaymentStatus
): boolean {
  const currentRank = STATUS_RANK[current ?? "pending"] ?? 0;
  const nextRank = STATUS_RANK[next] ?? 0;
  return nextRank >= currentRank;
}

// ─── Validar token na inicialização ──────────────────────────────────────────
function validateToken(token: string): void {
  if (!token) throw new Error("MP_ACCESS_TOKEN não configurado. Adicione ao .env ou variáveis do Render.");
  if (!token.startsWith("APP_USR-") && !token.startsWith("TEST-")) {
    throw new Error(`MP_ACCESS_TOKEN inválido — deve começar com APP_USR- (produção) ou TEST- (sandbox). Prefixo recebido: ${token.slice(0, 8)}...`);
  }
  const isSandbox = token.startsWith("TEST-");
  log.info("mp.token.validated", {
    environment: isSandbox ? "sandbox" : "production",
    prefix: token.slice(0, 12) + "...",
  });
}

// ─── Cliente MP (singleton lazy) ──────────────────────────────────────────────
let _mpClient: MercadoPagoConfig | null = null;

function getMpClient(): MercadoPagoConfig {
  if (!_mpClient) {
    validateToken(ENV.mpAccessToken);
    _mpClient = new MercadoPagoConfig({
      accessToken: ENV.mpAccessToken,
      options: { timeout: 15_000 },
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
  expectedTotal: number;
  items: MpPreferenceItem[];
  payerEmail: string;
}

export interface MpPreferenceResult {
  preferenceId: string;
  checkoutUrl: string;
}

export interface VerifiedPayment {
  mpPaymentId: string;
  externalReference: string;
  status: PaymentStatus;
  statusDetail: string;
  paidAmount: number;
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
  const baseUrl = ENV.appBaseUrl.replace(/\/$/, "");
  const isSandbox = ENV.mpAccessToken.startsWith("TEST-");

  // ── Validações críticas ────────────────────────────────────────────────────
  if (input.expectedTotal < 0.01) {
    throw new Error(`Valor inválido para pagamento: R$ ${input.expectedTotal}. Mínimo é R$ 0,01.`);
  }

  // ── Montar itens — NUNCA usar preço negativo (MP rejeita) ─────────────────
  // O desconto é absorvido no unit_price do item principal, não como item separado
  const rawItems = input.items.filter(i => i.unit_price > 0);

  if (rawItems.length === 0) {
    throw new Error("Nenhum item válido para criar preferência (todos com preço <= 0).");
  }

  // Recalcula total dos itens positivos
  const itemsPositiveTotal = rawItems.reduce((s, i) => s + i.unit_price * i.quantity, 0);

  // Se há desconto, distribui proporcionalmente nos itens
  const discountTotal = Math.max(0, itemsPositiveTotal - input.expectedTotal);
  const discountRatio = discountTotal > 0 ? discountTotal / itemsPositiveTotal : 0;

  const mpItems = rawItems.map((item, idx) => {
    let price = item.unit_price * (1 - discountRatio);
    price = Math.round(price * 100) / 100;
    // Garante mínimo de 0.01 por item
    if (price < 0.01) price = 0.01;
    return {
      id: item.id || String(idx + 1),
      title: item.title.slice(0, 256),
      quantity: item.quantity,
      unit_price: price,
      currency_id: "BRL",
    };
  });

  // Verifica consistência final (tolerância de R$ 0,05 por arredondamentos)
  const finalTotal = mpItems.reduce((s, i) => s + i.unit_price * i.quantity, 0);
  const diff = Math.abs(finalTotal - input.expectedTotal);
  if (diff > 0.05) {
    log.warn("mp.preference.value_mismatch", {
      orderNumber: input.orderNumber,
      expectedTotal: input.expectedTotal,
      computedTotal: finalTotal,
      diff,
    });
  }

  const body = {
    external_reference: input.orderNumber,
    items: mpItems,
    // Não enviamos payer.email — quando o email do pagador é igual ao do vendedor
    // o MP desabilita o botão "Criar Pix". Sem email, o MP deixa qualquer um pagar.
    back_urls: {
      success: `${baseUrl}/pedido-confirmado?orderNumber=${encodeURIComponent(input.orderNumber)}&payment=success`,
      failure: `${baseUrl}/pedido-confirmado?orderNumber=${encodeURIComponent(input.orderNumber)}&payment=failure`,
      pending: `${baseUrl}/pedido-confirmado?orderNumber=${encodeURIComponent(input.orderNumber)}&payment=pending`,
    },
    auto_return: "approved" as const,
    notification_url: `${baseUrl}/api/mp/webhook`,
    statement_descriptor: "WARDEN SHOP",
    // Garantir que PIX (bank_transfer) está habilitado explicitamente
    payment_methods: {
      excluded_payment_types: [] as { id: string }[],
      installments: 12,
    },
    expires: true,
    expiration_date_from: new Date().toISOString(),
    expiration_date_to: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };

  log.info("mp.preference.request", {
    orderNumber: input.orderNumber,
    itemCount: mpItems.length,
    expectedTotal: input.expectedTotal,
    finalTotal,
    isSandbox,
    baseUrl,
  });

  let result;
  try {
    result = await preference.create({ body });
  } catch (err: any) {
    // Log completo do erro da API do MP
    const mpError = err?.cause ?? err?.response ?? err;
    log.error("mp.preference.api_error", {
      orderNumber: input.orderNumber,
      status: mpError?.status ?? mpError?.statusCode ?? "unknown",
      message: mpError?.message ?? String(err),
      detail: JSON.stringify(mpError?.data ?? mpError?.body ?? mpError).slice(0, 500),
    });
    throw new Error(`Mercado Pago recusou a preferência: ${mpError?.message ?? String(err)}`);
  }

  log.info("mp.preference.response", {
    orderNumber: input.orderNumber,
    preferenceId: result.id,
    hasInitPoint: !!result.init_point,
    hasSandboxPoint: !!result.sandbox_init_point,
    isSandbox,
  });

  if (!result.id || !result.init_point) {
    throw new Error("Resposta inválida do Mercado Pago: sem id ou init_point.");
  }

  const checkoutUrl = isSandbox
    ? (result.sandbox_init_point ?? result.init_point)
    : result.init_point;

  log.info("mp.preference.created", {
    orderNumber: input.orderNumber,
    preferenceId: result.id,
    checkoutUrl: checkoutUrl.slice(0, 80) + "...",
  });

  return { preferenceId: result.id, checkoutUrl };
}

// ─── Verificar pagamento na API do MP ─────────────────────────────────────────
export async function verifyPayment(paymentId: string): Promise<VerifiedPayment> {
  const client = getMpClient();
  const paymentApi = new Payment(client);

  let data;
  try {
    data = await paymentApi.get({ id: paymentId });
  } catch (err: any) {
    const mpError = err?.cause ?? err?.response ?? err;
    log.error("mp.payment.get_error", {
      paymentId,
      status: mpError?.status ?? "unknown",
      message: mpError?.message ?? String(err),
    });
    throw err;
  }

  if (!data || !data.id) {
    throw new Error(`Pagamento ${paymentId} não encontrado na API do MP.`);
  }

  const status = normalizeStatus(data.status ?? "pending");

  log.info("mp.payment.verified", {
    paymentId,
    status,
    statusDetail: data.status_detail,
    paidAmount: data.transaction_amount,
    paymentMethod: data.payment_method_id,
  });

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

// ─── Normalizar status ────────────────────────────────────────────────────────
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
export function validateWebhookSignature(params: {
  xSignature: string;
  xRequestId: string;
  dataId: string;
}): { valid: boolean; reason?: string } {
  if (!ENV.mpWebhookSecret) {
    if (!ENV.isProduction) {
      log.warn("mp.webhook.no_secret", { msg: "MP_WEBHOOK_SECRET ausente — pulando validação em dev" });
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

    const tsMs = parseInt(ts, 10) * 1000;
    const ageSec = (Date.now() - tsMs) / 1000;
    if (ageSec > 300) {
      return { valid: false, reason: `Timestamp expirado (${Math.round(ageSec)}s atrás)` };
    }

    const manifest = `id:${params.dataId};request-id:${params.xRequestId};ts:${ts};`;
    const expected = crypto
      .createHmac("sha256", ENV.mpWebhookSecret)
      .update(manifest)
      .digest("hex");

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
