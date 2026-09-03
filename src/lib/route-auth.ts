/**
 * Autenticação para server routes (`src/routes/api/*`).
 *
 * As server functions ganham o bearer de graça pelo `attachSupabaseAuth`, mas
 * um server route recebe a `Request` crua — precisa validar o token na mão.
 * Mesma verificação do `requireSupabaseAuth`: assinatura conferida e `sub`
 * presente.
 */
export async function userIdFromRequest(request: Request): Promise<string | null> {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;

  const token = header.slice("Bearer ".length);
  if (token.split(".").length !== 3) return null;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.auth.getClaims(token);
  if (error || !data?.claims?.sub) return null;

  return data.claims.sub;
}
