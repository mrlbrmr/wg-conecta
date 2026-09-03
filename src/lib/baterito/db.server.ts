import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Ponte temporária de tipos.
 *
 * `src/integrations/supabase/types.ts` é gerado a partir do banco e ainda não
 * conhece `baterito_queries` nem `baterito_search()` — a migration
 * `20260905120000_baterito.sql` não foi aplicada. Enquanto isso, estas duas
 * operações usam o client sem o genérico `Database`, e as linhas são tipadas
 * aqui embaixo.
 *
 * Quando a migration rodar e os tipos forem regenerados, este arquivo sai e as
 * chamadas voltam a usar `supabaseAdmin` direto.
 */
export async function bateritoDb(): Promise<SupabaseClient> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as SupabaseClient;
}

/** Uma linha de `baterito_search()`. */
export interface BateritoSearchRow {
  source: string;
  title: string;
  url: string;
  content: string;
  rank: number;
}
