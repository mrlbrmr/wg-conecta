import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Contador de solicitações de atualização cadastral em aberto.
 *
 * Usa o client do browser: a RLS de `profile_update_requests` já restringe a
 * leitura completa a administradores, então um colaborador recebe 0.
 * Erro também vira 0 para nunca quebrar o layout da sidebar.
 */
export const pendingProfileRequestsQuery = queryOptions({
  queryKey: ["profile-requests-pending"],
  queryFn: async (): Promise<number> => {
    const { count, error } = await supabase
      .from("profile_update_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "pendente");
    if (error) return 0;
    return count ?? 0;
  },
  staleTime: 30_000,
  refetchInterval: 60_000,
});

/**
 * Contador de solicitações de formulário ainda abertas.
 *
 * Mesma ideia: a RLS de `requests` só devolve as próprias para o colaborador,
 * então esse número é a fila do G&G apenas para quem é admin.
 */
export const openRequestsQuery = queryOptions({
  queryKey: ["open-requests-count"],
  queryFn: async (): Promise<number> => {
    const { count, error } = await supabase
      .from("requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "em_analise");
    if (error) return 0;
    return count ?? 0;
  },
  staleTime: 30_000,
  refetchInterval: 60_000,
});
