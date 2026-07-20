/**
 * Converte sequências de barras em uma única barra no pathname.
 * A string de consulta não deve ser passada a esta função, para que URLs
 * incorporadas em parâmetros (por exemplo, URLs de pagamento) permaneçam intactas.
 */
export function normalizePathname(pathname: string): string {
  return pathname.replace(/\/{2,}/g, "/");
}
