import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createHash } from "crypto";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function sha256(v: string) {
  return createHash("sha256").update(v, "utf8").digest("hex");
}

/** Verifica o código de acesso do colaborador (pública). */
export const verifyAccessCode = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ code: z.string().min(1).max(200) }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("portal_access")
      .select("access_code_hash")
      .eq("singleton", true)
      .maybeSingle();
    if (error) throw new Error("Não foi possível verificar o código.");
    const submitted = sha256(data.code.trim());
    const ok = !!row?.access_code_hash && row.access_code_hash === submitted;
    return { ok };
  });

/** Atualiza o código de acesso (admin autenticado). */
export const setAccessCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ code: z.string().min(4).max(200) }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const hash = sha256(data.code.trim());
    const { error } = await supabaseAdmin
      .from("portal_access")
      .update({ access_code_hash: hash, updated_at: new Date().toISOString() })
      .eq("singleton", true);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
