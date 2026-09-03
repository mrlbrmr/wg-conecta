import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type PeerRecognition = Tables<"peer_recognitions">;
export type ChecklistItem = Tables<"onboarding_checklist_items">;
export type OnboardingProgress = Tables<"onboarding_progress">;
export type PortalRequest = Tables<"requests">;
export type RequestMessage = Tables<"request_messages">;

function ensureList<T>(res: { data: T[] | null; error: { message: string } | null }): T[] {
  if (res.error) throw new Error(res.error.message);
  return res.data ?? [];
}

/** Reconhecimentos recebidos por uma pessoa, do mais recente para o mais antigo. */
export function recognitionsForQuery(employeeId: string | undefined) {
  return queryOptions({
    queryKey: ["peer_recognitions", "to", employeeId],
    enabled: Boolean(employeeId),
    queryFn: async (): Promise<PeerRecognition[]> =>
      ensureList(
        await supabase
          .from("peer_recognitions")
          .select("*")
          .eq("to_employee_id", employeeId!)
          .eq("status", "publicado")
          .eq("active", true)
          .order("created_at", { ascending: false }),
      ),
  });
}

/** Reconhecimentos entre colegas publicados no portal — usado em Cultura. */
export const peerRecognitionsQuery = queryOptions({
  queryKey: ["peer_recognitions", "feed"],
  queryFn: async (): Promise<PeerRecognition[]> =>
    ensureList(
      await supabase
        .from("peer_recognitions")
        .select("*")
        .eq("status", "publicado")
        .eq("active", true)
        .order("created_at", { ascending: false }),
    ),
});

/** Trilha padrão de integração, na ordem definida pelo G&G. */
export const checklistItemsQuery = queryOptions({
  queryKey: ["onboarding_checklist_items"],
  queryFn: async (): Promise<ChecklistItem[]> =>
    ensureList(
      await supabase
        .from("onboarding_checklist_items")
        .select("*")
        .eq("active", true)
        .order("order_index"),
    ),
});

/** Itens já concluídos pelo próprio usuário — o RLS restringe ao seu registro. */
export const ownProgressQuery = queryOptions({
  queryKey: ["onboarding_progress", "own"],
  queryFn: async (): Promise<OnboardingProgress[]> =>
    ensureList(await supabase.from("onboarding_progress").select("*")),
});

/** Materiais já vistos pelo próprio usuário. */
export const ownMaterialViewsQuery = queryOptions({
  queryKey: ["material_views", "own"],
  queryFn: async (): Promise<Tables<"material_views">[]> =>
    ensureList(await supabase.from("material_views").select("*")),
});

/** Solicitações do próprio usuário — o RLS já filtra por colaborador. */
export const ownRequestsQuery = queryOptions({
  queryKey: ["requests", "own"],
  queryFn: async (): Promise<PortalRequest[]> =>
    ensureList(
      await supabase.from("requests").select("*").order("created_at", { ascending: false }),
    ),
});

export function requestMessagesQuery(requestId: string | undefined) {
  return queryOptions({
    queryKey: ["request_messages", requestId],
    enabled: Boolean(requestId),
    queryFn: async (): Promise<RequestMessage[]> =>
      ensureList(
        await supabase
          .from("request_messages")
          .select("*")
          .eq("request_id", requestId!)
          .order("created_at"),
      ),
  });
}

/** Percentual concluído da trilha — sempre derivado, nunca armazenado. */
export function trackProgress(items: ChecklistItem[], done: OnboardingProgress[]) {
  const doneIds = new Set(done.map((d) => d.item_id));
  const completed = items.filter((i) => doneIds.has(i.id)).length;
  return {
    completed,
    total: items.length,
    percent: items.length === 0 ? 0 : Math.round((completed / items.length) * 100),
    doneIds,
  };
}

export const REQUEST_STATUS_LABEL: Record<string, string> = {
  em_analise: "Em análise",
  respondida: "Respondida",
  concluida: "Concluída",
};

export const REQUEST_STATUS_TONE: Record<string, "accent" | "ink" | "success"> = {
  em_analise: "accent",
  respondida: "ink",
  concluida: "success",
};
