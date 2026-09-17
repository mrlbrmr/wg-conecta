import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Award, Bell, Inbox, Lightbulb, ShieldCheck, UserCog } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { adminNotificationsQuery, badgeLabel } from "@/lib/admin-queries";
import type { AdminNotification, NotificationKind } from "@/lib/admin-notifications.functions";
import { formatDayMonth } from "@/lib/tenure";
import { cn } from "@/lib/utils";

const KIND: Record<
  NotificationKind,
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  sim: { label: "SIM", icon: Lightbulb },
  escuta: { label: "Canal de Escuta", icon: ShieldCheck },
  solicitacao: { label: "Solicitações", icon: Inbox },
  cadastral: { label: "Cadastro", icon: UserCog },
  reconhecimento: { label: "Reconhecimentos", icon: Award },
};

const KIND_ORDER: NotificationKind[] = [
  "escuta",
  "sim",
  "solicitacao",
  "cadastral",
  "reconhecimento",
];

/** `dd/mm`. Instante ISO vira o dia em Brasília; data pura fica como está. */
function shortDate(date: string): string {
  if (date.length <= 10) {
    const [, m, d] = date.split("-").map(Number);
    return formatDayMonth(d, m);
  }
  return new Date(date).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

/** Leva à fila certa do painel. */
function NotificationLink({
  n,
  className,
  children,
  onClick,
}: {
  n: AdminNotification;
  className: string;
  children: React.ReactNode;
  onClick: () => void;
}) {
  switch (n.kind) {
    case "sim":
    case "escuta":
      return (
        <Link to="/admin/canais" search={{ canal: n.kind }} className={className} onClick={onClick}>
          {children}
        </Link>
      );
    case "solicitacao":
    case "cadastral":
      return (
        <Link
          to="/admin/solicitacoes"
          search={{ fila: n.kind === "cadastral" ? "cadastral" : "formularios" }}
          className={className}
          onClick={onClick}
        >
          {children}
        </Link>
      );
    case "reconhecimento":
      return (
        <Link
          to="/admin/recurso/$key"
          params={{ key: "reconhecimentos-colegas" }}
          className={className}
          onClick={onClick}
        >
          {children}
        </Link>
      );
  }
}

/** Sino da topbar do painel, com a bolinha de pendências do G&G. */
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const q = useQuery(adminNotificationsQuery);
  const total = q.data?.total ?? 0;
  const items = q.data?.items ?? [];
  const close = () => setOpen(false);

  // O sino balança quando o total sobe (não na primeira carga).
  const [ring, setRing] = useState(0);
  const previous = useRef<number | null>(null);
  useEffect(() => {
    if (!q.data) return;
    if (previous.current !== null && q.data.total > previous.current) setRing((r) => r + 1);
    previous.current = q.data.total;
  }, [q.data]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={
            total === 0 ? "Notificações: nada pendente" : `Notificações: ${total} pendentes`
          }
          className={cn(
            "relative grid h-9 w-9 shrink-0 place-items-center rounded-full border-[1.5px] border-ink bg-surface transition hover:bg-accent",
            open && "bg-accent",
          )}
        >
          <Bell key={ring} className={cn("h-4 w-4", ring > 0 && "animate-bell-ring")} />
          {total > 0 && (
            <span
              aria-hidden
              className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full border-[1.5px] border-paper bg-destructive px-1 text-[10px] font-black tabular-nums leading-none text-destructive-foreground"
            >
              {badgeLabel(total)}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={10}
        className="w-[min(380px,calc(100vw-32px))] overflow-hidden rounded-xl border-[1.5px] border-ink bg-paper p-0 shadow-[4px_4px_0_0_var(--color-ink)]"
      >
        <div className="border-b-[1.5px] border-ink px-4 py-3">
          <div className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-muted-foreground">
            Notificações
          </div>
          <div className="mt-0.5 text-[15px] font-black leading-tight">
            {total === 0
              ? "Tudo em dia por aqui"
              : total === 1
                ? "1 item esperando o G&G"
                : `${total} itens esperando o G&G`}
          </div>
          {total > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {KIND_ORDER.filter((k) => (q.data?.counts[k] ?? 0) > 0).map((k) => (
                <span
                  key={k}
                  className="inline-flex items-center gap-1 rounded-full border border-ink/20 bg-surface px-2 py-0.5 text-[11px] font-bold"
                >
                  {KIND[k].label}
                  <span className="tabular-nums text-primary">{q.data?.counts[k]}</span>
                </span>
              ))}
            </div>
          )}
        </div>

        {q.isError ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">
            Não conseguimos carregar as notificações agora.
          </p>
        ) : q.isLoading ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">Carregando…</p>
        ) : items.length === 0 ? (
          <p className="px-4 py-6 text-sm leading-relaxed text-muted-foreground">
            Nenhum SIM, relato ou solicitação esperando resposta.
          </p>
        ) : (
          <ul className="max-h-[min(420px,60vh)] divide-y divide-ink/10 overflow-y-auto">
            {items.map((n) => {
              const Icon = KIND[n.kind].icon;
              return (
                <li key={`${n.kind}-${n.id}`}>
                  <NotificationLink
                    n={n}
                    onClick={close}
                    className="flex gap-3 px-4 py-3 transition-colors hover:bg-accent-soft focus-visible:bg-accent-soft focus-visible:outline-none"
                  >
                    <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full border-[1.5px] border-ink bg-surface">
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13.5px] font-bold leading-snug">{n.title}</span>
                      <span className="block truncate text-[12.5px] text-muted-foreground">
                        {n.detail}
                      </span>
                    </span>
                    <span className="shrink-0 pt-0.5 text-[11px] tabular-nums text-muted-foreground">
                      {shortDate(n.date)}
                    </span>
                  </NotificationLink>
                </li>
              );
            })}
          </ul>
        )}

        {total > items.length && (
          <div className="border-t-[1.5px] border-ink px-4 py-2.5 text-[12px] text-muted-foreground">
            Mostrando os {items.length} mais recentes de {total}.
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
