import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import type { DirectoryEntry } from "@/lib/directory-queries";
import { isTenureMilestone, parseISODate, yearsOnAnniversary } from "@/lib/tenure";

export type CulturePhoto = Tables<"culture_photos">;
export type CultureEvent = Tables<"culture_events">;
export type AnniversaryCongrat = Tables<"anniversary_congrats">;

function ensureList<T>(res: { data: T[] | null; error: { message: string } | null }): T[] {
  if (res.error) throw new Error(res.error.message);
  return res.data ?? [];
}

export const culturePhotosQuery = queryOptions({
  queryKey: ["culture_photos"],
  queryFn: async (): Promise<CulturePhoto[]> =>
    ensureList(
      await supabase
        .from("culture_photos")
        .select("*")
        .eq("active", true)
        .order("event_date", { ascending: false })
        .order("order_index"),
    ),
});

export const cultureEventsQuery = queryOptions({
  queryKey: ["culture_events"],
  queryFn: async (): Promise<CultureEvent[]> =>
    ensureList(
      await supabase.from("culture_events").select("*").eq("active", true).order("event_date"),
    ),
});

/** Todos os parabéns — a contagem é pública ao portal. */
export const congratsQuery = queryOptions({
  queryKey: ["anniversary_congrats"],
  queryFn: async (): Promise<AnniversaryCongrat[]> =>
    ensureList(await supabase.from("anniversary_congrats").select("*")),
});

/** Parabéns de tempo de casa que a pessoa recebeu, do ano mais recente para o mais antigo. */
export const receivedCongratsQuery = (employeeId: string) =>
  queryOptions({
    queryKey: ["anniversary_congrats", "received", employeeId],
    queryFn: async (): Promise<AnniversaryCongrat[]> =>
      ensureList(
        await supabase
          .from("anniversary_congrats")
          .select("*")
          .eq("to_employee_id", employeeId)
          .order("year", { ascending: false })
          .order("created_at", { ascending: false }),
      ),
  });

/** Aniversariantes do mês de referência (1–12). */
export function birthdaysInMonth(entries: DirectoryEntry[], month: number) {
  return entries
    .filter((e) => e.birthday_month === month)
    .sort((a, b) => (a.birthday_day ?? 0) - (b.birthday_day ?? 0));
}

/**
 * Aniversários de casa do mês — só quem faz marco (3, 5, 7, 10 anos e, depois, de 5 em 5) no
 * aniversário deste ano. Os anos são os do aniversário, não os de hoje: quem faz 3 anos no fim
 * do mês já aparece.
 */
export function anniversariesInMonth(entries: DirectoryEntry[], month: number) {
  return entries
    .filter((e): e is DirectoryEntry & { admission_date: string } => e.admission_date != null)
    .filter(
      (e) =>
        parseISODate(e.admission_date).getMonth() + 1 === month &&
        isTenureMilestone(yearsOnAnniversary(e.admission_date)),
    )
    .sort(
      (a, b) => parseISODate(a.admission_date).getDate() - parseISODate(b.admission_date).getDate(),
    );
}

/**
 * Quem entrou nos últimos 90 dias (o período de experiência), em ordem cronológica:
 * de quem chegou primeiro — e está mais perto de fechar os 90 dias — para quem chegou agora.
 */
export function newcomers(entries: DirectoryEntry[], days = 90) {
  const today = new Date();
  const cutoff = new Date(today.getFullYear(), today.getMonth(), today.getDate() - days);
  return entries
    .filter((e): e is DirectoryEntry & { admission_date: string } => e.admission_date != null)
    .filter((e) => parseISODate(e.admission_date) >= cutoff)
    .sort((a, b) => a.admission_date.localeCompare(b.admission_date));
}

/** Eventos daqui pra frente, do mais próximo para o mais distante. */
export function upcomingEvents(events: CultureEvent[], limit = 6) {
  const today = new Date().toISOString().slice(0, 10);
  return events.filter((e) => e.event_date >= today).slice(0, limit);
}

/** `accent` para saúde e celebração; `soft` para o resto. */
export function eventTone(type: string): "accent" | "soft" {
  return type === "saude" || type === "celebracao" ? "accent" : "soft";
}

export const EVENT_TYPE_LABEL: Record<string, string> = {
  saude: "Saúde",
  celebracao: "Celebração",
  treinamento: "Treinamento",
  campanha: "Campanha",
  geral: "Interno",
};
