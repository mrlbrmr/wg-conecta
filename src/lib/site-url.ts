const FALLBACK = "http://localhost:8080";

/**
 * Normaliza a origem pública do portal.
 *
 * Em produção o SITE_URL chegou a valer `https://wg-conecta.vercel.app//` com um
 * curinga no fim — alguém colou ali o padrão que pertence à allowlist de
 * Redirect URLs do Supabase. Como o código só removia a barra final, todo link
 * montado no servidor ganhava esse trecho no meio do caminho e apontava para uma
 * rota inexistente: convites de acesso e recuperações de senha chegavam com link
 * morto, em silêncio. Normalizar aqui evita que um valor mal colado volte a
 * quebrar isso.
 */
export function normalizeSiteUrl(raw: string | undefined | null, fallback = FALLBACK): string {
  const value = (raw ?? "").trim();
  if (!value) return stripTrailingSlashes(fallback);
  try {
    const url = new URL(value);
    const path = url.pathname
      .replace(/\*+/g, "") // curingas de allowlist não pertencem a uma origem
      .replace(/\/{2,}/g, "/") // barras duplicadas
      .replace(/\/+$/, ""); // barra final
    return `${url.origin}${path}`;
  } catch {
    return stripTrailingSlashes(fallback);
  }
}

function stripTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, "");
}
