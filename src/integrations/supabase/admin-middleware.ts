import { createMiddleware } from "@tanstack/react-start";
import { requireSupabaseAuth } from "./auth-middleware";

export type AdminIdentity = { id: string; name: string; email: string };

/**
 * Exige que o usuário autenticado seja um administrador ativo.
 *
 * `requireSupabaseAuth` sozinho apenas garante "tem um JWT válido" — como as
 * server functions operam com o service role (que ignora RLS), qualquer
 * colaborador logado no portal conseguiria chamá-las. Este middleware fecha essa
 * porta consultando `admin_users`, o mesmo critério de `app_private.is_admin`.
 */
export const requireAdmin = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ next, context }) => {
    const { userId } = context as { userId: string };
    // import dinâmico: este módulo é importado por *.functions.ts, que vai ao bundle do cliente
    const { supabaseAdmin } = await import("./client.server");
    const { data, error } = await supabaseAdmin
      .from("admin_users")
      .select("id, name, email")
      .eq("id", userId)
      .eq("active", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Acesso restrito ao time de Gente & Gestão.");
    return next({ context: { admin: data as AdminIdentity } });
  });
