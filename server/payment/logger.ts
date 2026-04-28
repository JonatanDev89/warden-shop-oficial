/**
 * payment/logger.ts
 * ─────────────────
 * Logger estruturado para o módulo de pagamento.
 * Garante que tokens, chaves e dados sensíveis NUNCA apareçam nos logs.
 *
 * Campos bloqueados automaticamente:
 *   access_token, mp_access_token, password, passwordHash,
 *   pixKey, cardNumber, cvv, secret
 */

const SENSITIVE_KEYS = new Set([
  "access_token",
  "mp_access_token",
  "accesstoken",
  "password",
  "passwordhash",
  "pixkey",
  "cardnumber",
  "cvv",
  "secret",
  "mp_webhook_secret",
  "authorization",
  "cookie",
]);

function redact(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.has(k.toLowerCase())) {
      out[k] = "[REDACTED]";
    } else if (v && typeof v === "object" && !Array.isArray(v)) {
      out[k] = redact(v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out;
}

function format(level: string, event: string, data?: Record<string, unknown>): string {
  const ts = new Date().toISOString();
  const safe = data ? redact(data) : {};
  return JSON.stringify({ ts, level, event, ...safe });
}

export const logger = {
  info(event: string, data?: Record<string, unknown>) {
    console.log(format("INFO", event, data));
  },
  warn(event: string, data?: Record<string, unknown>) {
    console.warn(format("WARN", event, data));
  },
  error(event: string, data?: Record<string, unknown>) {
    console.error(format("ERROR", event, data));
  },
};
