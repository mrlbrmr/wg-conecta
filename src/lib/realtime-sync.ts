import { useEffect } from "react";
import type { QueryClient, QueryKey } from "@tanstack/react-query";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/**
 * Atualização em tempo real.
 *
 * O banco avisa no canal privado `wg-db` sempre que uma tabela muda
 * (migration `20260917120000_realtime_sync.sql`). O aviso traz só o nome da
 * tabela; aqui ele vira `invalidateQueries` nas consultas que dependem dela.
 * As que estão na tela recarregam na hora, as outras ficam marcadas como
 * velhas e recarregam quando voltarem a aparecer.
 */

/** Primeiro item da `queryKey` de cada consulta que lê a tabela. */
const QUERIES_BY_TABLE: Record<string, string[]> = {
  admin_users: ["admin_users"],
  anniversary_congrats: ["anniversary_congrats"],
  announcement_comments: ["announcement_comments"],
  announcement_reactions: ["announcement_reactions"],
  announcement_reads: ["announcement_reads", "admin-dashboard"],
  announcements: ["announcements", "announcement", "admin-dashboard"],
  audit_log: ["admin-activity"],
  benefits: ["benefits"],
  birthdays: ["employee_directory"],
  campaigns: ["campaigns"],
  channel_submission_messages: [
    "channel-messages",
    "channel-submissions",
    "my-channel-submissions",
    "admin-notifications",
  ],
  channel_submissions: ["channel-submissions", "my-channel-submissions", "admin-notifications"],
  contact_matrix: ["contact_matrix"],
  contacts: ["contacts"],
  culture_events: ["culture_events"],
  culture_photos: ["culture_photos"],
  departments: ["departments"],
  documents: ["documents"],
  employee_cpf_logins: ["employee-cpf-logins"],
  employees: [
    "employees",
    "employee_directory",
    "current-employee",
    "own-profile",
    "peer_recognitions",
    "anniversary_congrats",
    "admin-notifications",
  ],
  faq_items: ["faq_items"],
  forms: ["forms"],
  gg_pages: ["gg_pages"],
  internal_jobs: ["internal_jobs", "admin-dashboard"],
  material_views: ["material_views"],
  monthly_deadlines: ["monthly_deadlines"],
  onboarding_checklist_items: ["onboarding_checklist_items"],
  onboarding_materials: ["onboarding"],
  onboarding_progress: ["onboarding_progress"],
  peer_recognitions: ["peer_recognitions", "admin-notifications"],
  portal_settings: ["portal_settings"],
  profile_update_requests: [
    "profile-requests",
    "profile-requests-pending",
    "own-profile-requests",
    "admin-notifications",
    "admin-dashboard",
  ],
  quick_links: ["quick_links"],
  recognitions: ["recognitions"],
  request_messages: [
    "request_messages",
    "request-messages",
    "requests",
    "portal-requests",
    "admin-notifications",
  ],
  requests: [
    "requests",
    "portal-requests",
    "open-requests-count",
    "admin-dashboard",
    "admin-notifications",
  ],
  work_anniversaries: ["employee_directory"],
};

const TOPIC = "wg-db";
/** Junta avisos seguidos (ex.: importação de planilha) numa recarga só. */
const BATCH_MS = 150;

function affectedKeys(table: string): string[] | null {
  return QUERIES_BY_TABLE[table] ?? null;
}

/** As listas do painel usam ["admin-list", <tabela>] (ver `admin-crud.tsx`). */
function matches(queryKey: QueryKey, keys: Set<string>, tables: Set<string>): boolean {
  const [head, second] = queryKey;
  if (typeof head !== "string") return false;
  if (head === "admin-list") return typeof second === "string" && tables.has(second);
  return keys.has(head);
}

/** Liga o tempo real enquanto houver alguém logado. Usar uma vez, na raiz. */
export function useRealtimeSync(queryClient: QueryClient) {
  useEffect(() => {
    let channel: RealtimeChannel | null = null;
    let channelUser: string | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const pendingTables = new Set<string>();
    let refreshAll = false;
    let wasConnected = false;

    const flush = () => {
      timer = null;
      if (refreshAll) {
        refreshAll = false;
        pendingTables.clear();
        void queryClient.invalidateQueries();
        return;
      }
      const tables = new Set(pendingTables);
      pendingTables.clear();
      const keys = new Set<string>();
      for (const t of tables) {
        const k = affectedKeys(t);
        if (!k) {
          // Tabela sem mapa: melhor recarregar tudo do que mostrar dado velho.
          void queryClient.invalidateQueries();
          return;
        }
        k.forEach((key) => keys.add(key));
      }
      void queryClient.invalidateQueries({
        predicate: (q) => matches(q.queryKey, keys, tables),
      });
    };

    const schedule = () => {
      if (!timer) timer = setTimeout(flush, BATCH_MS);
    };

    const stop = () => {
      if (channel) void supabase.removeChannel(channel);
      channel = null;
      channelUser = null;
      wasConnected = false;
    };

    const start = (userId: string, accessToken: string) => {
      if (channel && channelUser === userId) return;
      stop();
      channelUser = userId;
      // Canal privado: o token precisa estar no socket antes de assinar.
      void supabase.realtime.setAuth(accessToken);
      channel = supabase
        .channel(TOPIC, { config: { private: true } })
        .on("broadcast", { event: "change" }, ({ payload }) => {
          const table = (payload as { table?: unknown } | undefined)?.table;
          if (typeof table === "string") pendingTables.add(table);
          else refreshAll = true;
          schedule();
        })
        .subscribe((status) => {
          if (status !== "SUBSCRIBED") return;
          // Reconectou depois de uma queda: pode ter perdido avisos.
          if (wasConnected) {
            refreshAll = true;
            schedule();
          }
          wasConnected = true;
        });
    };

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) start(session.user.id, session.access_token);
      else stop();
    });

    return () => {
      data.subscription.unsubscribe();
      if (timer) clearTimeout(timer);
      stop();
    };
  }, [queryClient]);
}
