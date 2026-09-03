import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { z } from "zod";
import { ClipboardList } from "lucide-react";
import { toast } from "sonner";
import {
  Chip,
  FilterPills,
  IconBubble,
  InkButton,
  Kicker,
  PageHeading,
  PaperCard,
} from "@/components/paper";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ICON_MAP } from "@/lib/icon-map";
import { formsQuery, type FormRow } from "@/lib/portal-queries";
import { deadlinesInMonth, monthlyDeadlinesQuery } from "@/lib/gg-queries";
import { ownRequestsQuery, REQUEST_STATUS_LABEL, REQUEST_STATUS_TONE } from "@/lib/profile-queries";
import { openRequest } from "@/lib/portal-write.functions";
import { formatDate } from "@/lib/tenure";

const TODOS = "Todos";

const PRIVACY_NOTE =
  "Uso interno. Nada de CPF, telefone pessoal, endereço, documentos ou dados bancários por aqui.";

export const Route = createFileRoute("/_portal/formularios")({
  head: () => ({ meta: [{ title: "Formulários — Portal WG" }] }),
  validateSearch: z.object({ assunto: z.string().optional() }),
  component: FormulariosPage,
});

function FormulariosPage() {
  const { assunto = TODOS } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const [freeRequest, setFreeRequest] = useState(false);

  const forms = useQuery(formsQuery);
  const items = useMemo(() => forms.data ?? [], [forms.data]);

  const subjects = useMemo(() => {
    const found = Array.from(
      new Set(items.map((f) => f.category).filter(Boolean) as string[]),
    ).sort((a, b) => a.localeCompare(b, "pt-BR"));
    return [TODOS, ...found].map((v) => ({ value: v, label: v }));
  }, [items]);

  const filtered = assunto === TODOS ? items : items.filter((f) => f.category === assunto);

  return (
    <div>
      <PageHeading
        kicker="Formulários"
        title="Pedir pra gente é aqui."
        subtitle="Escolha o assunto, preencha e acompanhe a resposta pelo protocolo. Cada tipo tem um prazo combinado — e a gente avisa quando anda."
      />

      <section className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Kicker>Catálogo</Kicker>
          <FilterPills
            options={subjects}
            value={assunto}
            onChange={(v) => navigate({ search: v === TODOS ? {} : { assunto: v }, replace: true })}
          />
        </div>

        {forms.isLoading ? (
          <Skeleton className="mt-5 h-48 w-full" />
        ) : filtered.length === 0 ? (
          <PaperCard tone="soft" className="mt-5 p-8">
            <p className="text-xl font-black tracking-tight">Nenhum formulário nesse assunto.</p>
            <p className="mt-2 text-[15px] leading-[1.65] text-muted-foreground">
              Tenta outro assunto — ou abre uma solicitação livre que a gente encaminha.
            </p>
          </PaperCard>
        ) : (
          <div className="mt-5 grid gap-3.5 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((f) => (
              <FormCard key={f.id} form={f} />
            ))}
          </div>
        )}
      </section>

      <div className="mt-12 grid items-start gap-6 lg:grid-cols-[1fr_380px]">
        <MyRequests />
        <div className="grid gap-6">
          <AgreedDeadlines />
          <PaperCard tone="accent" className="p-6">
            <p className="text-[19px] font-black leading-tight tracking-[-0.03em]">
              Não achou o formulário certo?
            </p>
            <p className="mt-2 text-sm leading-[1.6] text-ink/75">
              Descreve o que você precisa que a gente encaminha pra pessoa certa.
            </p>
            <InkButton variant="ink" className="mt-5" onClick={() => setFreeRequest(true)}>
              Solicitação livre ↗
            </InkButton>
          </PaperCard>
        </div>
      </div>

      <FreeRequestDialog open={freeRequest} onOpenChange={setFreeRequest} />
    </div>
  );
}

// ── Catálogo ──────────────────────────────────────────────────────────

function FormCard({ form: f }: { form: FormRow }) {
  const Icon = ICON_MAP[f.icon ?? ""] ?? ClipboardList;

  return (
    <PaperCard hover className="flex flex-col p-6">
      <div className="flex items-start justify-between gap-3">
        <IconBubble size={44}>
          <Icon />
        </IconBubble>
        {f.category && (
          <span className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-primary">
            {f.category}
          </span>
        )}
      </div>

      <h3 className="mt-4 text-xl font-black tracking-[-0.03em]">{f.title}</h3>
      {f.description && (
        <p className="mt-2 text-sm leading-[1.55] text-muted-foreground">{f.description}</p>
      )}

      <div className="mt-auto flex items-center justify-between gap-3 border-t border-border pt-4">
        <span className="text-[11px] font-extrabold tabular-nums text-muted-foreground">
          Resposta em {f.sla_days} {f.sla_days === 1 ? "dia útil" : "dias úteis"}
        </span>
        <a
          href={f.external_url}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 text-xs font-extrabold uppercase tracking-[0.12em] text-ink hover:text-primary"
        >
          Preencher ↗
        </a>
      </div>
    </PaperCard>
  );
}

// ── Meus envios ───────────────────────────────────────────────────────

function MyRequests() {
  const requests = useQuery(ownRequestsQuery);
  const list = requests.data ?? [];

  return (
    <section>
      <div className="flex items-baseline justify-between gap-4">
        <Kicker>Meus envios</Kicker>
        <span className="text-xs font-bold tabular-nums text-muted-foreground">
          {list.length} {list.length === 1 ? "envio" : "envios"}
        </span>
      </div>

      {requests.isLoading ? (
        <Skeleton className="mt-4 h-40 w-full" />
      ) : list.length === 0 ? (
        <PaperCard tone="soft" className="mt-4 p-8">
          <p className="text-xl font-black tracking-tight">Você ainda não enviou nada.</p>
          <p className="mt-2 text-[15px] leading-[1.65] text-muted-foreground">
            Quando enviar, o protocolo e o andamento aparecem aqui — e também no seu perfil.
          </p>
        </PaperCard>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          {list.map((r) => (
            <PaperCard key={r.id} className="grid gap-5 p-[22px] sm:grid-cols-[1fr_auto]">
              <div className="min-w-0">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] tabular-nums text-primary">
                  Protocolo {r.protocol}
                  {r.subject ? ` · ${r.subject}` : ""}
                </p>
                <h3 className="mt-1.5 text-xl font-black tracking-[-0.03em]">{r.title}</h3>
                <p className="mt-1.5 text-[13.5px] tabular-nums text-muted-foreground">
                  Enviado em {formatDate(r.created_at)}
                  {r.due_date ? ` · prazo até ${formatDate(r.due_date)}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-4 sm:flex-col sm:items-end sm:justify-between">
                <Chip tone={REQUEST_STATUS_TONE[r.status] ?? "soft"}>
                  {REQUEST_STATUS_LABEL[r.status] ?? r.status}
                </Chip>
                <Link
                  to="/perfil"
                  search={{ aba: "solicitacoes" }}
                  className="text-xs font-extrabold uppercase tracking-[0.12em] text-ink hover:text-primary"
                >
                  Ver conversa ↗
                </Link>
              </div>
            </PaperCard>
          ))}
        </div>
      )}
    </section>
  );
}

// ── Prazos combinados ─────────────────────────────────────────────────

function AgreedDeadlines() {
  const deadlines = useQuery(monthlyDeadlinesQuery);
  const list = deadlinesInMonth(deadlines.data ?? []);

  return (
    <PaperCard tone="ink" className="p-6 md:p-[26px]">
      <Kicker color="var(--color-accent)">Prazos combinados</Kicker>

      {list.length === 0 ? (
        <p className="mt-4 text-[15px] leading-[1.65] text-paper/70">
          Nenhum prazo combinado para este mês.
        </p>
      ) : (
        <ul className="mt-3">
          {list.map((d) => (
            <li
              key={d.id}
              className="flex items-center justify-between gap-4 border-b border-paper/15 py-[11px] last:border-b-0"
            >
              <span className="min-w-0 text-sm font-bold">{d.label}</span>
              <span className="shrink-0 whitespace-nowrap text-[13px] font-black tabular-nums text-accent">
                {formatDate(d.due_date)}
              </span>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-4 text-xs leading-[1.6] text-paper/70">
        Contamos em dias úteis, a partir do envio. Passou do prazo? Cobra a gente sem cerimônia.
      </p>
    </PaperCard>
  );
}

// ── Solicitação livre ─────────────────────────────────────────────────

function FreeRequestDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const send = useServerFn(openRequest);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const mutation = useMutation({
    mutationFn: () => send({ data: { title: title.trim(), body: body.trim() || null } }),
    onSuccess: (res) => {
      toast.success(`Solicitação aberta! Protocolo ${res.protocol}.`);
      setTitle("");
      setBody("");
      qc.invalidateQueries({ queryKey: ["requests"] });
      onOpenChange(false);
    },
    onError: () => toast.error("Não conseguimos salvar agora. Tenta de novo em instantes?"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[520px] border-[1.5px] border-ink bg-paper p-0 shadow-elevated sm:rounded-lg">
        <div className="border-b-[1.5px] border-ink px-6 py-5">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-primary">
            Formulários
          </p>
          <DialogTitle className="mt-1 text-[22px] font-black tracking-[-0.03em]">
            Solicitação livre
          </DialogTitle>
        </div>

        <div className="flex flex-col gap-4 px-6 py-6">
          <label className="block">
            <span className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted-foreground">
              O que você precisa
            </span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex.: 2ª via do cartão do vale-refeição"
              className="mt-2 w-full rounded-lg border-[1.5px] border-ink bg-surface px-3.5 py-3 text-[15px] outline-none"
            />
          </label>

          <label className="block">
            <span className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted-foreground">
              Detalhes
            </span>
            <textarea
              rows={3}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Conta o contexto pra gente resolver de primeira."
              className="mt-2 w-full resize-y rounded-lg border-[1.5px] border-ink bg-surface px-3.5 py-3 text-[15px] leading-[1.6] outline-none"
            />
          </label>

          <p className="text-xs leading-[1.6] text-muted-foreground">{PRIVACY_NOTE}</p>

          <div className="flex flex-wrap items-center gap-4">
            <InkButton
              disabled={title.trim().length < 3 || mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? "Enviando…" : "Enviar ↗"}
            </InkButton>
            <span className="text-xs text-muted-foreground">
              Você recebe um protocolo para acompanhar.
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
