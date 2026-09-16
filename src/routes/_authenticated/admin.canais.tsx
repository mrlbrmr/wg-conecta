import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Chip, ChoiceChips, InkButton, Kicker, PaperCard } from "@/components/paper";
import { useAdminSearch } from "@/components/admin-search";
import { SubmissionConversation, SubmissionFields } from "@/components/channel/submission-thread";
import {
  CHANNEL_META,
  CHANNELS,
  ESCUTA_CATEGORIES,
  SIM_KINDS,
  SIM_REASONS,
  SUBMISSION_STATUSES,
  SUBMISSION_STATUS_LABEL,
  SUBMISSION_STATUS_TONE,
  type Channel,
  type SubmissionStatus,
} from "@/lib/channel-defs";
import {
  listChannelMessages,
  listChannelSubmissions,
  respondChannelSubmission,
  setChannelSubmissionStatus,
} from "@/lib/channel.functions";
import { UNITS } from "@/lib/org";
import { formatDate } from "@/lib/tenure";
import { cn } from "@/lib/utils";

/**
 * SIM e Canal de Escuta no painel, um por aba.
 *
 * Envio sem identificação não diz quem escreveu (o Canal de Escuta é sempre assim). No identificado, o nome e o contato são os que
 * foram gravados no próprio envio. A conversa acontece por aqui: quem enviou vê no Perfil ou em
 * "Acompanhar", pelo protocolo.
 */

export const Route = createFileRoute("/_authenticated/admin/canais")({
  head: () => ({ meta: [{ title: "SIM e Canal de Escuta — Portal WG" }] }),
  validateSearch: z.object({ canal: z.enum(CHANNELS).optional() }),
  component: ChannelsAdminPage,
});

type Submission = Awaited<ReturnType<typeof listChannelSubmissions>>[number];

const ALL = "";

interface Filters {
  status: SubmissionStatus | typeof ALL;
  unit: string;
  reason: string;
  kind: string;
  identified: "" | "sim" | "nao";
  /** Assunto do Canal de Escuta (o rótulo, que é o que fica em `category`). */
  category: string;
}

const NO_FILTERS: Filters = {
  status: ALL,
  unit: ALL,
  reason: ALL,
  kind: ALL,
  identified: "",
  category: ALL,
};

const INTRO: Record<Channel, string> = {
  sim: "Sugestões, críticas e elogios que chegaram pelo portal. Quem escolheu enviar sem se identificar não aparece em lugar nenhum; quem enviou com o nome recebe um aviso por e-mail quando você responde.",
  escuta:
    "Relatos de assédio, discriminação, conduta antiética e segurança. Todos chegam sem autor: nome e contato só aparecem se a pessoa escreveu no relato. A conversa acontece pelo protocolo, em Acompanhar.",
};

function matches(r: Submission, f: Filters, term: string): boolean {
  if (f.status && r.status !== f.status) return false;
  if (f.unit && r.payload.unit !== f.unit) return false;
  if (f.reason && r.payload.reason !== f.reason) return false;
  if (f.kind && r.payload.kind !== f.kind) return false;
  if (f.identified && r.identified !== (f.identified === "sim")) return false;
  if (f.category && r.category !== f.category) return false;
  return (
    !term ||
    r.protocol.toLowerCase().includes(term) ||
    JSON.stringify(r.payload).toLowerCase().includes(term)
  );
}

function ChannelsAdminPage() {
  const { canal = CHANNELS[0] } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { term: rawTerm } = useAdminSearch();
  const doList = useServerFn(listChannelSubmissions);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);

  const q = useQuery({
    queryKey: ["channel-submissions", canal],
    queryFn: () => doList({ data: { channel: canal } }),
  });

  // Trocar de canal fecha o envio aberto e limpa os filtros, que são de cada canal.
  useEffect(() => {
    setSelectedId(null);
    setFilters(NO_FILTERS);
  }, [canal]);

  const term = rawTerm.trim().toLowerCase();
  const rows = useMemo(
    () => (q.data ?? []).filter((r) => matches(r, filters, term)),
    [q.data, filters, term],
  );
  const selected = (q.data ?? []).find((r) => r.id === selectedId) ?? null;
  const openCount = (q.data ?? []).filter((r) => r.status !== "concluido").length;
  const filtering = JSON.stringify(filters) !== JSON.stringify(NO_FILTERS);

  const setFilter =
    <K extends keyof Filters>(key: K) =>
    (value: Filters[K]) =>
      setFilters((f) => ({ ...f, [key]: value }));

  return (
    <div>
      {/* Mesmo cabeçalho das demais telas do painel (AdminCrud). */}
      <header className="border-b-[1.5px] border-ink pb-5">
        <Kicker>Gente &amp; Gestão</Kicker>
        <h1 className="mt-3 text-[28px] font-black leading-[1.02] tracking-[-0.045em] sm:text-[34px] lg:text-[42px]">
          {CHANNEL_META[canal].title}
        </h1>
        <p className="mt-3 max-w-[60ch] text-[15.5px] leading-[1.7] text-muted-foreground">
          {INTRO[canal]}
        </p>
      </header>

      {CHANNELS.length > 1 && (
        <div className="mt-6 inline-flex gap-1 rounded-full border-[1.5px] border-ink bg-surface p-1">
          {CHANNELS.map((c) => (
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
      )}

      <div className="mt-6 flex flex-wrap items-center gap-2.5">
        <FilterSelect
          label="Status"
          allLabel="Todos os status"
          value={filters.status}
          onChange={setFilter("status")}
          options={SUBMISSION_STATUSES.map((s) => ({
            value: s,
            label: SUBMISSION_STATUS_LABEL[s],
          }))}
        />
        {canal === "escuta" ? (
          <FilterSelect
            label="Assunto"
            allLabel="Todos os assuntos"
            value={filters.category}
            onChange={setFilter("category")}
            options={ESCUTA_CATEGORIES.map((c) => c.label)}
          />
        ) : (
          <>
            <FilterSelect
              label="Local de trabalho"
              allLabel="Todas as filiais"
              value={filters.unit}
              onChange={setFilter("unit")}
              options={UNITS}
            />
            <FilterSelect
              label="Motivo"
              allLabel="Todos os motivos"
              value={filters.reason}
              onChange={setFilter("reason")}
              options={SIM_REASONS}
            />
            <FilterSelect
              label="Tipo"
              allLabel="Interna e externa"
              value={filters.kind}
              onChange={setFilter("kind")}
              options={SIM_KINDS}
            />
            <FilterSelect
              label="Identificação"
              allLabel="Com e sem nome"
              value={filters.identified}
              onChange={setFilter("identified")}
              options={[
                { value: "sim", label: "Com nome" },
                { value: "nao", label: "Anônimos" },
              ]}
            />
          </>
        )}
        {filtering && (
          <button
            type="button"
            onClick={() => setFilters(NO_FILTERS)}
            className="text-xs font-extrabold uppercase tracking-[0.1em] text-primary hover:underline"
          >
            Limpar filtros
          </button>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs font-bold tabular-nums text-muted-foreground">
          {rows.length} {rows.length === 1 ? "envio" : "envios"}
          {filtering || term ? " no filtro" : ""} · {openCount} em aberto no total
        </span>
        <InkButton
          variant="outline"
          disabled={rows.length === 0}
          onClick={() => downloadCsv(rows, canal)}
        >
          <Download className="h-4 w-4" /> Exportar CSV
        </InkButton>
      </div>

      <div className="mt-5 grid items-start gap-5 lg:grid-cols-[380px_minmax(0,1fr)]">
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
                      <Chip tone={SUBMISSION_STATUS_TONE[r.status]}>
                        {SUBMISSION_STATUS_LABEL[r.status]}
                      </Chip>
                    </span>
                    <span className="truncate text-[13.5px] font-bold">{r.category}</span>
                    <span className="truncate text-[12px] text-muted-foreground">
                      {[
                        formatDate(r.received_on),
                        r.payload.sector,
                        r.payload.unit,
                        r.payload.where,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                    <span className="truncate text-[12px] font-bold">
                      {r.identified
                        ? (r.payload.contact_name ?? "Com nome")
                        : r.payload.contact_name
                          ? `${r.payload.contact_name} (escreveu no relato)`
                          : "Anônimo"}
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

function FilterSelect<T extends string>({
  label,
  allLabel,
  value,
  onChange,
  options,
}: {
  label: string;
  allLabel: string;
  value: T | "";
  onChange: (value: T | "") => void;
  options: readonly string[] | readonly { value: string; label: string }[];
}) {
  const items = options.map((o) => (typeof o === "string" ? { value: o, label: o } : o));
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T | "")}
      aria-label={label}
      className={cn(
        "h-[38px] rounded-full border-[1.5px] border-ink px-3.5 text-[13px] font-bold outline-none",
        value ? "bg-accent" : "bg-surface",
      )}
    >
      <option value="">{allLabel}</option>
      {items.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

// ── Exportação ────────────────────────────────────────────────────────

type CsvColumn = [header: string, value: (r: Submission) => string];

const CSV_COMMON: CsvColumn[] = [
  ["Protocolo", (r) => r.protocol],
  ["Data", (r) => formatDate(r.received_on)],
  ["Status", (r) => SUBMISSION_STATUS_LABEL[r.status]],
  ["Identificação", (r) => (r.identified ? "Com nome" : "Anônimo")],
  ["Nome", (r) => r.payload.contact_name ?? ""],
  ["Contato", (r) => r.payload.contact ?? ""],
];

const CSV_COLUMNS: Record<Channel, CsvColumn[]> = {
  escuta: [
    ...CSV_COMMON,
    ["Assunto", (r) => r.category],
    ["Relato", (r) => r.payload.description ?? ""],
    ["Onde", (r) => r.payload.where ?? ""],
    ["Quando", (r) => r.payload.when ?? ""],
    ["Pessoas envolvidas", (r) => r.payload.involved ?? ""],
  ],
  sim: [
    ...CSV_COMMON,
    ["Local de trabalho", (r) => r.payload.unit ?? ""],
    ["Tipo de melhoria", (r) => r.payload.kind ?? ""],
    ["Setor", (r) => r.payload.sector ?? ""],
    ["Motivo", (r) => r.payload.reason ?? ""],
    ["Situação e possível solução", (r) => r.payload.description ?? ""],
  ],
};

/**
 * Ponto e vírgula e BOM: é o que o Excel em português abre direto, com acentos. Texto que começa
 * com = + - @ ganha um apóstrofo, senão o Excel executa como fórmula o que o colaborador digitou.
 */
function downloadCsv(rows: Submission[], channel: Channel) {
  const columns = CSV_COLUMNS[channel];
  const cell = (v: string) => `"${(/^[=+\-@\t\r]/.test(v) ? `'${v}` : v).replace(/"/g, '""')}"`;
  const lines = [
    columns.map(([h]) => cell(h)).join(";"),
    ...rows.map((r) => columns.map(([, get]) => cell(get(r))).join(";")),
  ];
  const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${channel}-${new Date().toLocaleDateString("en-CA")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Detalhe ───────────────────────────────────────────────────────────

function SubmissionDetail({ submission: s }: { submission: Submission }) {
  const qc = useQueryClient();
  const doMessages = useServerFn(listChannelMessages);
  const doRespond = useServerFn(respondChannelSubmission);
  const doStatus = useServerFn(setChannelSubmissionStatus);

  const messages = useQuery({
    queryKey: ["channel-messages", s.id],
    queryFn: () => doMessages({ data: { id: s.id } }),
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["channel-submissions", s.channel] });
    qc.invalidateQueries({ queryKey: ["channel-messages", s.id] });
  };

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
          <p className="text-[13px] text-muted-foreground">
            Recebido em {formatDate(s.received_on)} ·{" "}
            <strong className="text-ink">{s.identified ? "Com nome" : "Anônimo"}</strong>
          </p>
        </div>
        <ChoiceChips
          label="Status"
          options={SUBMISSION_STATUSES.map((v) => ({
            value: v,
            label: SUBMISSION_STATUS_LABEL[v],
          }))}
          value={s.status}
          onChange={(v) => changeStatus.mutate(v)}
        />
      </header>

      <SubmissionFields channel={s.channel} payload={s.payload} className="gap-4 px-6 py-6" />

      <section className="border-t-[1.5px] border-ink px-6 py-6">
        <h2 className="text-[11.5px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground">
          Conversa com quem enviou
        </h2>
        <div className="mt-3">
          <SubmissionConversation
            messages={messages.data ?? []}
            viewer="gg"
            authorLabel={s.payload.contact_name || "Quem enviou"}
            emptyText="Nenhuma mensagem ainda."
            replyLabel="Responder"
            placeholder="Perguntar mais detalhes, contar o que foi feito…"
            onSend={async (body) => {
              await doRespond({ data: { id: s.id, body } });
              toast.success(
                s.identified
                  ? "Resposta enviada. A pessoa recebe um aviso e vê no Perfil."
                  : "Resposta enviada. Aparece para quem enviou em Acompanhar.",
              );
              refresh();
            }}
          />
        </div>
      </section>
    </PaperCard>
  );
}
