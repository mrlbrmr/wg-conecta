import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Chip, InkButton, Kicker, KpiCard, PaperCard } from "@/components/paper";
import { UserAvatar } from "@/components/user-avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { directoryQuery } from "@/lib/directory-queries";
import { pendingProfileRequestsQuery } from "@/lib/admin-queries";
import { formatDate } from "@/lib/tenure";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({ meta: [{ title: "Dashboard — Painel WG" }] }),
  component: Dashboard,
});

function ensureList<T>(res: { data: T[] | null; error: { message: string } | null }): T[] {
  if (res.error) throw new Error(res.error.message);
  return res.data ?? [];
}

function Dashboard() {
  const stats = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: async () => {
      const nowIso = new Date().toISOString();
      const today = nowIso.slice(0, 10);

      const [announcements, jobs, reads, requests, progress, recognitions] = await Promise.all([
        supabase
          .from("announcements")
          .select("id, title, category, status, published_at, expires_at")
          .order("published_at", { ascending: false }),
        supabase.from("internal_jobs").select("id, status"),
        supabase.from("announcement_reads").select("announcement_id"),
        supabase.from("requests").select("id, status, due_date"),
        supabase.from("onboarding_progress").select("employee_id"),
        supabase.from("peer_recognitions").select("id, status"),
      ]);

      const anns = ensureList(announcements);
      const published = anns.filter(
        (a) => a.status === "publicado" && (!a.expires_at || a.expires_at > nowIso),
      );
      const readRows = ensureList(reads);
      const reqRows = ensureList(requests);

      return {
        announcements: published,
        activeAnnouncements: published.length,
        openJobs: ensureList(jobs).filter((j) => j.status === "aberta").length,
        readsByAnnouncement: readRows.reduce<Record<string, number>>((acc, r) => {
          acc[r.announcement_id] = (acc[r.announcement_id] ?? 0) + 1;
          return acc;
        }, {}),
        totalReads: readRows.length,
        openRequests: reqRows.filter((r) => r.status !== "concluida").length,
        lateRequests: reqRows.filter(
          (r) => r.status !== "concluida" && r.due_date != null && r.due_date < today,
        ).length,
        onboarding: new Set(ensureList(progress).map((p) => p.employee_id)).size,
        pendingRecognitions: ensureList(recognitions).filter((r) => r.status === "em_revisao")
          .length,
      };
    },
  });

  const directory = useQuery(directoryQuery);
  const pendingProfile = useQuery(pendingProfileRequestsQuery);
  const activity = useQuery({
    queryKey: ["admin-activity"],
    queryFn: async () =>
      ensureList(
        await supabase
          .from("audit_log")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(6),
      ),
  });

  const month = new Date().getMonth() + 1;
  const birthdays = (directory.data ?? []).filter((e) => e.birthday_month === month).length;
  const headcount = (directory.data ?? []).length;

  // Alcance: leituras registradas sobre o total possível (comunicados × pessoas).
  const possible = (stats.data?.activeAnnouncements ?? 0) * Math.max(headcount, 1);
  const reach = possible === 0 ? 0 : Math.round(((stats.data?.totalReads ?? 0) / possible) * 100);

  if (stats.isLoading) {
    return (
      <div className="grid gap-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const attention = [
    {
      label: "Atualização cadastral pendente",
      detail: "Colaboradores esperando a revisão do G&G",
      value: pendingProfile.data ?? 0,
      to: "/admin/solicitacoes" as const,
      params: undefined,
    },
    {
      label: "Solicitações fora do prazo",
      detail: "Vencidas e ainda sem resposta",
      value: stats.data?.lateRequests ?? 0,
      to: "/admin/recurso/$key" as const,
      params: { key: "solicitacoes-portal" },
    },
    {
      label: "Reconhecimentos aguardando",
      detail: "Publicados por colegas, em revisão",
      value: stats.data?.pendingRecognitions ?? 0,
      to: "/admin/recurso/$key" as const,
      params: { key: "reconhecimentos-colegas" },
    },
    {
      label: "Solicitações abertas",
      detail: "Em análise ou já respondidas",
      value: stats.data?.openRequests ?? 0,
      to: "/admin/recurso/$key" as const,
      params: { key: "solicitacoes-portal" },
    },
  ];

  return (
    <div>
      <header className="flex flex-wrap items-end justify-between gap-4 border-b-[1.5px] border-ink pb-6">
        <div>
          <Kicker>Visão geral</Kicker>
          <h1 className="mt-3 text-[32px] font-black leading-[1.02] tracking-[-0.045em] sm:text-[40px] lg:text-[48px]">
            {greeting()}.
          </h1>
          <p className="mt-3 max-w-[56ch] text-base leading-[1.7] text-muted-foreground">
            O que está no ar, o que precisa de atenção e o que o time andou fazendo por aqui.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <InkButton asChild>
            <Link to="/admin/recurso/$key" params={{ key: "comunicados" }}>
              Novo comunicado ↗
            </Link>
          </InkButton>
        </div>
      </header>

      {/* Faixa de destaque */}
      <div className="mt-6 grid gap-4 lg:grid-cols-12">
        <PaperCard tone="ink" className="p-7 lg:col-span-5">
          <Kicker color="var(--color-accent)">Precisa de atenção</Kicker>
          <ul className="mt-3">
            {attention.map((a) => (
              <li key={a.label} className="border-b border-paper/15 last:border-b-0">
                <Link
                  to={a.to}
                  {...(a.params ? { params: a.params } : {})}
                  className="flex items-center justify-between gap-4 py-3.5"
                >
                  <span className="min-w-0">
                    <span className="block text-base font-extrabold">{a.label}</span>
                    <span className="block text-[12.5px] text-paper/70">{a.detail}</span>
                  </span>
                  <span className="shrink-0 text-[22px] font-black tabular-nums text-accent">
                    {a.value}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </PaperCard>

        <PaperCard tone="accent" className="p-7 lg:col-span-3">
          <span className="block text-[52px] font-black leading-none tracking-[-0.06em] tabular-nums lg:text-[68px]">
            {reach}%
          </span>
          <p className="mt-3 text-[15px] font-extrabold">de alcance do mural</p>
          <p className="mt-2 text-[13px] leading-[1.6] text-ink/[0.72]">
            Leituras registradas sobre o total possível deste mês.
          </p>
        </PaperCard>

        <div className="grid gap-4 sm:grid-cols-2 lg:col-span-4">
          <KpiCard
            size="sm"
            label="Comunicados ativos"
            value={stats.data?.activeAnnouncements ?? 0}
          />
          <KpiCard size="sm" label="Vagas abertas" value={stats.data?.openJobs ?? 0} />
          <KpiCard size="sm" label="Em integração" value={stats.data?.onboarding ?? 0} />
          <KpiCard size="sm" label="Aniversariantes" value={birthdays} note="neste mês" />
        </div>
      </div>

      {/* Conteúdo publicado + atividade */}
      <div className="mt-8 grid items-start gap-6 lg:grid-cols-[1fr_380px]">
        <section>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <Kicker>Conteúdo publicado</Kicker>
            <Link
              to="/admin/recurso/$key"
              params={{ key: "comunicados" }}
              className="text-xs font-extrabold uppercase tracking-[0.12em] text-ink hover:text-primary"
            >
              Gerenciar comunicados ↗
            </Link>
          </div>

          <div className="mt-4 border-t-[1.5px] border-ink">
            {(stats.data?.announcements ?? []).slice(0, 6).map((a) => {
              const reads = stats.data?.readsByAnnouncement[a.id] ?? 0;
              const pct = headcount === 0 ? 0 : Math.round((reads / headcount) * 100);
              return (
                <div
                  key={a.id}
                  className="grid grid-cols-[1fr_auto] items-center gap-4 border-b border-border py-[15px] sm:grid-cols-[1fr_130px_120px]"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[17px] font-extrabold">{a.title}</p>
                    <p className="truncate text-xs tabular-nums text-muted-foreground">
                      {[a.category, formatDate(a.published_at)].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <span className="hidden text-[13px] font-bold tabular-nums text-muted-foreground sm:block">
                    {pct}% lido
                  </span>
                  <Chip tone="success">Publicado</Chip>
                </div>
              );
            })}

            {(stats.data?.announcements ?? []).length === 0 && (
              <p className="py-8 text-[15px] leading-[1.65] text-muted-foreground">
                Nenhum comunicado no ar agora.
              </p>
            )}
          </div>
        </section>

        <PaperCard className="p-6 md:p-[26px]">
          <Kicker>Atividade recente</Kicker>
          {activity.isLoading ? (
            <Skeleton className="mt-4 h-32 w-full" />
          ) : (activity.data ?? []).length === 0 ? (
            <p className="mt-4 text-[15px] leading-[1.65] text-muted-foreground">
              Nada registrado ainda. As ações do painel passam a aparecer aqui.
            </p>
          ) : (
            <ul className="mt-4 flex flex-col gap-4">
              {(activity.data ?? []).map((row) => (
                <li key={row.id} className="grid grid-cols-[34px_1fr] gap-3">
                  <UserAvatar name={row.actor_label} size={34} tone="muted" />
                  <div className="min-w-0">
                    <p className="text-sm leading-[1.45]">{row.summary ?? row.action}</p>
                    <p className="mt-0.5 text-[11px] font-extrabold uppercase tracking-[0.12em] tabular-nums text-muted-foreground">
                      {formatDate(row.created_at)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </PaperCard>
      </div>
    </div>
  );
}

/** "Bom dia" / "Boa tarde" / "Boa noite" pela hora do navegador. */
function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}
