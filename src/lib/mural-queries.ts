import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type AnnouncementRead = Tables<"announcement_reads">;
export type AnnouncementReaction = Tables<"announcement_reactions">;
export type AnnouncementComment = Tables<"announcement_comments">;

function ensureList<T>(res: { data: T[] | null; error: { message: string } | null }): T[] {
  if (res.error) throw new Error(res.error.message);
  return res.data ?? [];
}

/** Leituras do próprio usuário — o RLS já restringe ao registro dele. */
export const ownReadsQuery = queryOptions({
  queryKey: ["announcement_reads", "own"],
  queryFn: async (): Promise<AnnouncementRead[]> =>
    ensureList(await supabase.from("announcement_reads").select("*")),
});

/** Todas as reações: a contagem é pública ao portal. */
export const reactionsQuery = queryOptions({
  queryKey: ["announcement_reactions"],
  queryFn: async (): Promise<AnnouncementReaction[]> =>
    ensureList(await supabase.from("announcement_reactions").select("*")),
});

/** Só os ids, para contar comentários por comunicado no feed. */
export const commentCountsQuery = queryOptions({
  queryKey: ["announcement_comments", "counts"],
  queryFn: async (): Promise<{ announcement_id: string }[]> =>
    ensureList(
      await supabase.from("announcement_comments").select("announcement_id").eq("active", true),
    ),
});

export function commentsQuery(announcementId: string) {
  return queryOptions({
    queryKey: ["announcement_comments", announcementId],
    queryFn: async (): Promise<AnnouncementComment[]> =>
      ensureList(
        await supabase
          .from("announcement_comments")
          .select("*")
          .eq("announcement_id", announcementId)
          .eq("active", true)
          .order("created_at"),
      ),
  });
}

/** Quantas vezes cada valor aparece — reações e comentários por comunicado. */
export function countBy<T>(rows: T[], key: (row: T) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const row of rows) {
    const k = key(row);
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

export const REACTIONS = [
  { id: "curti", label: "Curti" },
  { id: "importante", label: "Importante" },
  { id: "obrigado", label: "Obrigado" },
  { id: "parabens", label: "Parabéns" },
] as const;

export type ReactionId = (typeof REACTIONS)[number]["id"];
