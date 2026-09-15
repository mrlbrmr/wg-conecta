import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Chip, ChoiceChips, InkButton, Kicker, PaperCard, TextArea } from "@/components/paper";
import { useAdminSearch } from "@/components/admin-search";
import {
  CHANNEL_META,
  SUBMISSION_STATUSES,
  SUBMISSION_STATUS_LABEL,
  categoryLabel,
  renderSubmission,
  type Channel,
  type SubmissionStatus,
} from "@/lib/anonymous-defs";
import {
  listAnonymousMessages,
  listAnonymousSubmissions,
  respondAnonymous,
  setAnonymousStatus,
} from "@/lib/anonymous.functions";
import { formatDate } from "@/lib/tenure";
import { cn } from "@/lib/utils";

/**
 * Canal de Escuta e SIM no painel.
 *
 * Nenhuma linha diz quem enviou — só o que a própria pessoa escreveu, se escreveu. A conversa
 * com quem enviou acontece por aqui e aparece para ela em "Acompanhar", pelo protocolo.
 */

export const Route = createFileRoute("/_authenticated/admin/escuta")({
  head: () => ({ meta: [{ title: "Canal de Escuta e SIM — Portal WG" }] }),
  validateSearch: z.object({ canal: z.enum(["escuta", "sim"]).optional() }),
  component: EscutaAdminPage,
});

type Submission = Awaited<ReturnType<typeof listAnonymousSubmissions>>[number];

const STATUS_TONE: Record<SubmissionStatus, "accent" | "soft" | "success"> = {
  recebido: "accent",
  em_analise: "soft",
  concluido: "success",
};

function EscutaAdminPage() {
  const { canal = "escuta" } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { term: rawTerm } = useAdminSearch();
  const doList = useServerFn(listAnonymousSubmissions);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [status, setStatus] = useState<SubmissionStatus | "todos">("todos");

  const q = useQuery({
    queryKey: ["anonymous-submissions", canal],
    queryFn: () => doList({ data: { channel: canal } }),
  });

  // Trocar de canal fecha o envio aberto.
  useEffect(() => setSelectedId(null), [canal]);

  const term = rawTerm.trim().toLowerCase();
  const rows = useMemo(
    () =>
      (q.data ?? []).filter(
        (r) =>
          (status === "todos" || r.status === status) &&
          (!term ||
            r.protocol.toLowerCase().includes(term) ||
            JSON.stringify(r.payload).toLowerCase().includes(term)),
      ),
    [q.data, status, term],
  );
  const selected = (q.data ?? []).find((r) => r.id === selectedId) ?? null;
  const openCount = (q.data ?? []).filter((r) => r.status !== "concluido").length;

  return (
    <div>
      <Kicker>Gente &amp; Gestão</Kicker>
      <h1 className="mt-2 text-[34px] font-black leading-none tracking-[-0.04em]">
        Canal de Escuta e SIM
      </h1>
      <p className="mt-2 max-w-[70ch] text-sm leading-[1.6] text-muted-foreground">
        O que chegou sem identificação. Nenhum envio diz quem escreveu; nome e contato só aparecem
        quando a própria pessoa preencheu. Suas respostas chegam a ela em “Acompanhar”, pelo
        protocolo.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="inline-flex gap-1 rounded-full border-[1.5px] border-ink bg-surface p-1">
          {(["escuta", "sim"] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => navigate({ search: { canal: c }, replace: true })}
              aria-pressed={canal === c}
              className={cn(
                "rounded-full px-4 py-1.5 text-xs font-extrabold uppercase tracking-[0.08em] transition-colors",
                canal === c ? "bg-ink text-paper" : "text-muted-foreground hover:text-ink",
              )}
            >
              {CHANNEL_META[c].short}
            </button>
          ))}
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as SubmissionStatus | "todos")}
          aria-label="Filtrar por status"
          className="h-[38px] rounded-full border-[1.5px] border-ink bg-surface px-3.5 text-[13px] font-bold outline-none"
        >
          <option value="todos">Todos os status</option>
          {SUBMISSION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {SUBMISSION_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <span className="text-xs font-bold tabular-nums text-muted-foreground">
          {openCount} em aberto
        </span>
      </div>

      <div className="mt-6 grid items-start gap-5 lg:grid-cols-[380px_minmax(0,1fr)]">
        <PaperCard className="overflow-hidden">
          {q.isLoading ? (
            <p className="p-6 text-sm text-muted-foreground">Carregando…</p>
          ) : q.isError ? (
            <p className="p-6 text-sm font-semibold text-destructive">
              {(q.error as Error).message}
            </p>
          ) : rows.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">Nada por aqui.</p>
          ) : (
            <ul className="divide-y divide-border">
              {rows.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(r.id)}
                    className={cn(
                      "flex w-full flex-col gap-1 px-5 py-4 text-left transition-colors hover:bg-accent-soft",
                      r.id === selectedId && "bg-accent-soft",
                    )}
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="font-mono text-[15px] font-black">{r.protocol}</span>
                      <Chip tone={STATUS_TONE[r.status]}>{SUBMISSION_STATUS_LABEL[r.status]}</Chip>
                    </span>
                    <span className="truncate text-[13.5px] font-bold">
                      {categoryLabel(r.channel, r.category)}
                    </span>
                    <span className="truncate text-[12px] text-muted-foreground">
                      {[
                        formatDate(r.received_on),
                        r.channel === "sim" ? (r.payload.sector as string) : null,
                        r.channel === "sim" ? (r.payload.unit as string) : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </PaperCard>

        {selected ? (
          <SubmissionDetail key={selected.id} submission={selected} />
        ) : (
          <PaperCard tone="soft" className="p-8">
            <p className="text-lg font-black tracking-tight">Escolha um envio na lista.</p>
          </PaperCard>
        )}
      </div>
    </div>
  );
}

function SubmissionDetail({ submission: s }: { submission: Submission }) {
  const qc = useQueryClient();
  const doMessages = useServerFn(listAnonymousMessages);
  const doRespond = useServerFn(respondAnonymous);
  const doStatus = useServerFn(setAnonymousStatus);
  const [reply, setReply] = useState("");

  const messages = useQuery({
    queryKey: ["anonymous-messages", s.id],
    queryFn: () => doMessages({ data: { id: s.id } }),
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["anonymous-submissions", s.channel] });
    qc.invalidateQueries({ queryKey: ["anonymous-messages", s.id] });
  };

  const respond = useMutation({
    mutationFn: () => doRespond({ data: { id: s.id, body: reply } }),
    onSuccess: () => {
      setReply("");
      toast.success("Resposta enviada. Aparece para quem enviou em Acompanhar.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const changeStatus = useMutation({
    mutationFn: (status: SubmissionStatus) => doStatus({ data: { id: s.id, status } }),
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <PaperCard className="overflow-hidden">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b-[1.5px] border-ink px-6 py-5">
        <div>
          <Kicker>{CHANNEL_META[s.channel].title}</Kicker>
          <p className="mt-1.5 font-mono text-[24px] font-black tracking-[0.03em]">{s.protocol}</p>
          <p className="text-[13px] text-muted-foreground">Recebido em {formatDate(s.received_on)}</p>
        </div>
        <ChoiceChips
          label="Status"
          options={SUBMISSION_STATUSES.map((v) => ({ value: v, label: SUBMISSION_STATUS_LABEL[v] }))}
          value={s.status}
          onChange={(v) => changeStatus.mutate(v)}
        />
      </header>

      <dl className="grid gap-4 px-6 py-6">
        {renderSubmission(s.channel, s.payload).map((e) => (
          <div key={e.key}>
            <dt className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground">
              {e.label}
            </dt>
            <dd className="mt-0.5 whitespace-pre-wrap text-[15px] leading-[1.6]">{e.value}</dd>
          </div>
        ))}
      </dl>

      <section className="border-t-[1.5px] border-ink px-6 py-6">
        <h2 className="text-[11.5px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground">
          Conversa com quem enviou
        </h2>
        {(messages.data ?? []).length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Nenhuma mensagem ainda.</p>
        ) : (
          <ol className="mt-3 flex flex-col gap-3">
            {(messages.data ?? []).map((m) => (
              <li
                key={m.id}
                className={
                  m.from_gg
                    ? "ml-8 rounded-lg border-[1.5px] border-ink bg-accent-soft p-4"
                    : "mr-8 rounded-lg border-[1.5px] border-ink/30 bg-surface p-4"
                }
              >
                <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground">
                  {m.from_gg ? "G&G" : "Quem enviou"} · {formatDate(m.sent_on)}
                </p>
                <p className="mt-1.5 whitespace-pre-wrap text-[14.5px] leading-[1.6]">{m.body}</p>
              </li>
            ))}
          </ol>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (reply.trim()) respond.mutate();
          }}
          className="mt-5 flex flex-col gap-3"
        >
          <TextArea
            label="Responder"
            rows={3}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Perguntar mais detalhes, contar o que foi feito…"
          />
          <div>
            <InkButton type="submit" disabled={respond.isPending || !reply.trim()}>
              {respond.isPending ? "Enviando…" : "Enviar resposta"}
            </InkButton>
          </div>
        </form>
      </section>
    </PaperCard>
  );
}
