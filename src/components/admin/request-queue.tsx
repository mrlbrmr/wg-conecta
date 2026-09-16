import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Check, Loader2, Paperclip, Search, Send, X } from "lucide-react";
import { toast } from "sonner";
import {
  adminAttachmentUrl,
  listRequestMessages,
  listRequests,
  replyToRequest,
  setRequestStatus,
  type AdminRequest,
} from "@/lib/request.functions";
import { PRIORITY_LABEL, renderPayload, type Priority } from "@/lib/form-defs";
import { avatarColor, fmtDate, fmtDateTime, initials } from "@/lib/employee-ui";

/**
 * Fila dos formulários do portal (`requests`).
 *
 * A tela não sabe o formato de nenhum formulário: o `payload` é renderizado por
 * `renderPayload`, então um formulário novo aparece aqui sem tocar neste
 * arquivo. O visual acompanha o desta rota, que ainda é o neo-brutalismo antigo
 * do painel — unificar com o paper/ink é uma limpeza à parte.
 */

type Tab = "abertas" | "respondidas" | "concluidas" | "todas";

const TAB_STATUS: Record<Tab, string | null> = {
  abertas: "em_analise",
  respondidas: "respondida",
  concluidas: "concluida",
  todas: null,
};

const TAB_LABEL: Record<Tab, string> = {
  abertas: "Abertas",
  respondidas: "Respondidas",
  concluidas: "Concluídas",
  todas: "Todas",
};

const STATUS_LABEL: Record<string, string> = {
  em_analise: "Em análise",
  respondida: "Respondida",
  concluida: "Concluída",
};

function statusBadge(status: string) {
  const base = "inline-flex items-center rounded px-2.5 py-0.5 text-xs font-bold text-ink border";
  switch (status) {
    case "em_analise":
      return `${base} bg-warning/30 border-ink/40`;
    case "respondida":
      return `${base} bg-primary-softer border-ink/30`;
    case "concluida":
      return `${base} bg-accent/40 border-ink/40`;
    default:
      return `${base} bg-surface border-ink/30`;
  }
}

/** Só "urgente" e "prioritária" ganham destaque — "normal" é o caso comum. */
function priorityBadge(priority: string | null) {
  if (!priority || priority === "normal") return null;
  const tone =
    priority === "urgente" ? "bg-destructive/10 border-destructive" : "bg-warning/20 border-ink/30";
  return (
    <span
      className={`inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-bold text-ink ${tone}`}
    >
      {PRIORITY_LABEL[priority as Priority] ?? priority}
    </span>
  );
}

/** Prazo vencido numa solicitação que ainda não fechou. */
function isOverdue(r: AdminRequest) {
  return (
    Boolean(r.due_date) &&
    r.due_date! < new Date().toISOString().slice(0, 10) &&
    r.status !== "concluida"
  );
}

export function RequestQueue() {
  const qc = useQueryClient();
  const doList = useServerFn(listRequests);

  const [tab, setTab] = useState<Tab>("abertas");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<AdminRequest | null>(null);

  const q = useQuery({ queryKey: ["portal-requests"], queryFn: () => doList() });
  const requests = (q.data ?? []) as AdminRequest[];

  const term = search.trim().toLowerCase();
  const filtered = requests.filter((r) => {
    const status = TAB_STATUS[tab];
    if (status && r.status !== status) return false;
    if (!term) return true;
    return (
      r.title.toLowerCase().includes(term) ||
      String(r.protocol).includes(term) ||
      (r.employee?.name.toLowerCase().includes(term) ?? false) ||
      (r.subject?.toLowerCase().includes(term) ?? false)
    );
  });

  const counts: Record<Tab, number> = {
    abertas: requests.filter((r) => r.status === "em_analise").length,
    respondidas: requests.filter((r) => r.status === "respondida").length,
    concluidas: requests.filter((r) => r.status === "concluida").length,
    todas: requests.length,
  };

  return (
    <div>
      <div className="bg-surface rounded-lg border-[1.5px] border-ink shadow-paper overflow-hidden">
        <div className="flex flex-col sm:flex-row items-center gap-4 px-4 py-3 border-b border-ink/20">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink/40 pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por protocolo, nome ou assunto…"
              className="w-full rounded-lg border-[1.5px] border-ink/20 bg-surface pl-9 pr-4 py-2 text-sm text-ink outline-none transition focus:border-ink focus:ring-2 focus:ring-ink/10"
            />
          </div>
          <div className="inline-flex items-center gap-1 rounded-lg bg-ink/5 p-1 border border-ink/20">
            {(Object.keys(TAB_STATUS) as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded px-3 py-1 text-sm transition-all ${
                  tab === t
                    ? "bg-surface border border-ink text-ink font-bold"
                    : "text-muted-foreground hover:text-ink"
                }`}
              >
                {TAB_LABEL[t]}
                <span
                  className={`ml-1.5 text-xs ${tab === t ? "text-ink/60" : "text-muted-foreground"}`}
                >
                  {counts[t]}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink/20 bg-ink/5">
                {["Protocolo", "Colaborador", "Solicitação", "Prazo", "Status", ""].map((h, i) => (
                  <th
                    key={h || i}
                    className={`px-6 py-3 text-xs font-bold uppercase tracking-wider text-ink ${
                      i === 5 ? "text-right" : "text-left"
                    }`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {q.isLoading && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto text-primary" />
                  </td>
                </tr>
              )}
              {!q.isLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-muted-foreground text-sm">
                    {requests.length === 0
                      ? "Nenhuma solicitação recebida até agora."
                      : "Nenhum resultado para os filtros aplicados."}
                  </td>
                </tr>
              )}
              {filtered.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-ink/20 last:border-0 hover:bg-accent-soft/50 transition-colors"
                >
                  <td className="px-6 py-4 font-bold tabular-nums text-ink">{r.protocol}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {r.employee?.photo_url ? (
                        <img
                          src={r.employee.photo_url}
                          alt={r.employee.name}
                          className="h-9 w-9 shrink-0 rounded-full object-cover object-top"
                        />
                      ) : (
                        <span
                          className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${avatarColor(r.employee?.name ?? "?")}`}
                        >
                          {initials(r.employee?.name ?? "?")}
                        </span>
                      )}
                      <div className="min-w-0">
                        <div className="font-medium text-ink">
                          {r.employee?.name ?? "Colaborador removido"}
                        </div>
                        {r.employee?.department && (
                          <div className="text-xs text-muted-foreground">
                            {r.employee.department}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-ink">{r.title}</span>
                      {priorityBadge(r.priority)}
                      {r.attachment_path && (
                        <Paperclip
                          className="h-3.5 w-3.5 text-muted-foreground"
                          aria-label="Com anexo"
                        />
                      )}
                    </div>
                    {r.subject && <div className="text-xs text-muted-foreground">{r.subject}</div>}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span
                      className={
                        isOverdue(r) ? "font-bold text-destructive" : "text-muted-foreground"
                      }
                    >
                      {r.due_date ? fmtDate(r.due_date) : "—"}
                      {isOverdue(r) && " · vencido"}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={statusBadge(r.status)}>
                      {STATUS_LABEL[r.status] ?? r.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => setOpen(r)}
                      className="rounded-lg border-[1.5px] border-ink bg-surface px-3 py-1.5 text-xs font-bold text-ink shadow-[2px_2px_0_var(--color-ink)] hover:shadow-none hover:translate-y-[2px] hover:translate-x-[2px] transition-all"
                    >
                      Abrir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {open && (
        <RequestModal
          request={open}
          onClose={() => setOpen(null)}
          onChanged={() => {
            qc.invalidateQueries({ queryKey: ["portal-requests"] });
            qc.invalidateQueries({ queryKey: ["open-requests-count"] });
            qc.invalidateQueries({ queryKey: ["admin-dashboard"] });
          }}
        />
      )}
    </div>
  );
}

// ── Detalhe e resposta ────────────────────────────────────────────────

function RequestModal({
  request,
  onClose,
  onChanged,
}: {
  request: AdminRequest;
  onClose: () => void;
  onChanged: () => void;
}) {
  const doMessages = useServerFn(listRequestMessages);
  const doReply = useServerFn(replyToRequest);
  const doStatus = useServerFn(setRequestStatus);
  const doAttachment = useServerFn(adminAttachmentUrl);

  const [reply, setReply] = useState("");

  const messages = useQuery({
    queryKey: ["request-messages", request.id],
    queryFn: () => doMessages({ data: { request_id: request.id } }),
  });

  const mReply = useMutation({
    mutationFn: () => doReply({ data: { request_id: request.id, body: reply.trim() } }),
    onSuccess: () => {
      toast.success("Resposta enviada.");
      setReply("");
      messages.refetch();
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mConclude = useMutation({
    mutationFn: () => doStatus({ data: { request_id: request.id, status: "concluida" } }),
    onSuccess: () => {
      toast.success("Solicitação concluída.");
      onClose();
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openAttachment = async () => {
    if (!request.attachment_path) return;
    try {
      const { url } = await doAttachment({ data: { path: request.attachment_path } });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const entries = renderPayload(request.form_slug ?? "", request.payload);

  return (
    <div
      className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-6"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl bg-surface rounded-t-lg md:rounded-lg border-[1.5px] border-ink shadow-elevated max-h-[95vh] flex flex-col"
      >
        <div className="sticky top-0 bg-surface border-b border-border px-6 py-4 flex items-center justify-between rounded-t-lg">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground tabular-nums">
              Protocolo {request.protocol}
              {request.subject ? ` · ${request.subject}` : ""}
            </p>
            <h2 className="text-base font-semibold text-ink truncate">{request.title}</h2>
            <p className="text-xs text-muted-foreground truncate">
              {request.employee?.name ?? "Colaborador removido"}
              {request.employee?.department ? ` · ${request.employee.department}` : ""} · enviada em{" "}
              {fmtDateTime(request.created_at)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:text-ink hover:bg-accent-soft transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
          {entries.length > 0 && (
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full text-sm">
                <tbody>
                  {entries.map((e) => (
                    <tr key={e.label} className="border-b border-border align-top last:border-0">
                      <td className="px-4 py-2.5 w-48 font-semibold text-muted-foreground">
                        {e.label}
                      </td>
                      <td className="px-4 py-2.5 whitespace-pre-line text-ink">{e.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {request.attachment_path && (
            <button
              onClick={openAttachment}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface-muted px-3.5 py-2 text-sm font-semibold text-ink hover:bg-accent-soft"
            >
              <Paperclip className="h-4 w-4" /> Abrir anexo
            </button>
          )}

          <div>
            <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Conversa
            </h3>
            {messages.isLoading ? (
              <Loader2 className="mt-3 h-4 w-4 animate-spin text-primary" />
            ) : (messages.data ?? []).length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                Nenhuma mensagem ainda. Sua resposta abre a conversa.
              </p>
            ) : (
              <ul className="mt-3 space-y-3">
                {(messages.data ?? []).map((m) => (
                  <li key={m.id} className="rounded-lg bg-surface-muted p-3">
                    <div className="text-xs font-bold text-muted-foreground">
                      {m.author_name ?? "Gente & Gestão"} · {fmtDateTime(m.created_at)}
                    </div>
                    <p className="mt-1 whitespace-pre-line text-sm text-ink">{m.body}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <label className="block">
            <span className="text-sm font-medium text-muted-foreground">Responder</span>
            <textarea
              rows={3}
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="A resposta aparece para o colaborador no portal."
              className="mt-1.5 w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm text-ink outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </label>
        </div>

        <div className="sticky bottom-0 bg-surface border-t border-border px-6 py-4 flex flex-wrap justify-end gap-2 rounded-b-lg">
          {request.status !== "concluida" && (
            <button
              onClick={() => mConclude.mutate()}
              disabled={mConclude.isPending}
              className="inline-flex items-center gap-2 rounded-lg border-[1.5px] border-ink bg-accent px-4 py-2 text-sm font-bold text-ink shadow-[2px_2px_0_var(--color-ink)] hover:shadow-none hover:translate-y-[2px] hover:translate-x-[2px] transition-all disabled:opacity-50 disabled:shadow-none"
            >
              {mConclude.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              <Check className="h-4 w-4" /> Concluir
            </button>
          )}
          <button
            onClick={() => mReply.mutate()}
            disabled={mReply.isPending || reply.trim().length < 2}
            className="inline-flex items-center gap-2 rounded-lg border-[1.5px] border-ink bg-surface px-4 py-2 text-sm font-bold text-ink shadow-[2px_2px_0_var(--color-ink)] hover:shadow-none hover:translate-y-[2px] hover:translate-x-[2px] transition-all disabled:opacity-50 disabled:shadow-none"
          >
            {mReply.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            <Send className="h-4 w-4" /> Enviar resposta
          </button>
        </div>
      </div>
    </div>
  );
}
