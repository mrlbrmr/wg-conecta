import { createMiddleware } from "@tanstack/react-start";
import { requireSupabaseAuth } from "./auth-middleware";

/**
 * Exige que o usuário autenticado seja admin (linha ativa em `admin_users`).
 *
 * `requireSupabaseAuth` sozinho só garante que existe um JWT válido. Como os
 * handlers administrativos usam o service role — que atravessa o RLS —, sem
 * esta checagem qualquer colaborador logado conseguiria chamar `listEmployees`,
 * `updateEmployee`, `createAdminUser` e afins.
 */
export const requireAdmin = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ next, context }) => {
    const { userId } = context as { userId: string };
    const { supabaseAdmin } = await import("./client.server");

    const { data, error } = await supabaseAdmin
      .from("admin_users")
      .select("id")
      .eq("id", userId)
      .eq("active", true)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) throw new Error("Acesso restrito ao time de Gente & Gestão.");

    return next({ context: { isAdmin: true as const } });
  });
