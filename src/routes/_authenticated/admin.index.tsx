import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Megaphone,
  FileText,
  Briefcase,
  Sparkles,
  Cake,
  PartyPopper,
  Archive,
  Inbox,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { pendingProfileRequestsQuery } from "@/lib/admin-queries";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: Dashboard,
});

type CardItem = {
  label: string;
  value: number | undefined;
  icon: React.ComponentType<{ className?: string }>;
  to?: string;
  highlight?: boolean;
};

function Dashboard() {
  const nowIso = new Date().toISOString();
  const month = new Date().getMonth() + 1;

  const pending = useQuery(pendingProfileRequestsQuery);

  const cards = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: async () => {
      const [annActive, annExpired, docs, jobsOpen, campaigns, bdMonth, waAll] = await Promise.all([
        supabase
          .from("announcements")
          .select("id", { count: "exact", head: true })
          .eq("status", "publicado")
          .or(`expires_at.is.null,expires_at.gt.${nowIso}`),
        supabase
          .from("announcements")
          .select("id", { count: "exact", head: true })
          .eq("status", "publicado")
          .lt("expires_at", nowIso),
        supabase.from("documents").select("id", { count: "exact", head: true }).eq("active", true),
        supabase
          .from("internal_jobs")
          .select("id", { count: "exact", head: true })
          .eq("status", "aberta"),
        supabase.from("campaigns").select("id", { count: "exact", head: true }).eq("active", true),
        supabase
          .from("birthdays")
          .select("id", { count: "exact", head: true })
          .eq("birthday_month", month)
          .eq("active", true),
        supabase.from("work_anniversaries").select("id,admission_date").eq("active", true),
      ]);
      const waMonth = ((waAll.data ?? []) as { admission_date: string }[]).filter(
        (w) => new Date(w.admission_date).getMonth() + 1 === month,
      ).length;
      return {
        annActive: annActive.count ?? 0,
        annExpired: annExpired.count ?? 0,
        docs: docs.count ?? 0,
        jobsOpen: jobsOpen.count ?? 0,
        campaigns: campaigns.count ?? 0,
        bdMonth: bdMonth.count ?? 0,
        waMonth,
      };
    },
  });

  const items: CardItem[] = [
    {
      label: "Solicitações pendentes",
      value: pending.data,
      icon: Inbox,
      to: "/admin/solicitacoes",
      highlight: (pending.data ?? 0) > 0,
    },
    { label: "Comunicados ativos", value: cards.data?.annActive, icon: Megaphone },
    { label: "Comunicados vencidos", value: cards.data?.annExpired, icon: Archive },
    { label: "Documentos ativos", value: cards.data?.docs, icon: FileText },
    { label: "Vagas abertas", value: cards.data?.jobsOpen, icon: Briefcase },
    { label: "Campanhas ativas", value: cards.data?.campaigns, icon: Sparkles },
    { label: "Aniversariantes do mês", value: cards.data?.bdMonth, icon: Cake },
    { label: "Tempo de casa no mês", value: cards.data?.waMonth, icon: PartyPopper },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-black tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Visão geral do Portal do Colaborador WG.</p>
      </div>
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {items.map((it, i) => {
          const body = (
            <>
              <div
                className={`grid h-11 w-11 place-items-center rounded-xl ${it.highlight ? "bg-accent text-ink" : "bg-primary-softer text-primary"}`}
              >
                <it.icon className="h-5 w-5" />
              </div>
              <div className="mt-3 text-3xl font-black">{it.value ?? "—"}</div>
              <div className="text-xs font-semibold text-muted-foreground mt-1">{it.label}</div>
            </>
          );
          return it.to ? (
            <Link
              key={i}
              to={it.to}
              className="card-soft p-5 transition hover:border-primary/40 hover:shadow-elevated"
            >
              {body}
            </Link>
          ) : (
            <div key={i} className="card-soft p-5">
              {body}
            </div>
          );
        })}
      </div>
    </div>
  );
}
