import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AlertTriangle, Check, Loader2, Search, X } from "lucide-react";
import {
  approveProfileUpdateRequest,
  listProfileRequests,
  rejectProfileUpdateRequest,
  type AdminProfileRequest,
} from "@/lib/profile-request.functions";
import {
  changedFieldLabels,
  fieldLabel,
  normalizeProfileValue,
  STATUS_LABEL,
  type RequestStatus,
} from "@/lib/profile-fields";
import { avatarColor, fmtDateTime, initials } from "@/lib/employee-ui";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/solicitacoes")({
  head: () => ({ meta: [{ title: "Solicitações — Portal WG" }] }),
  component: SolicitacoesPage,
});

type Tab = "pendentes" | "aprovadas" | "rejeitadas" | "todas";

const TAB_STATUS: Record<Tab, string | null> = {
  pendentes: "pendente",
  aprovadas: "aprovada",
  rejeitadas: "rejeitada",
  todas: null,
};

function statusBadge(status: string) {
  const base = "inline-flex items-center rounded px-2.5 py-0.5 text-xs font-bold text-black border";
  switch (status) {
    case "pendente":
      return `${base} bg-amber-200 border-black/40`;
    case "aprovada":
      return `${base} bg-[#8FD152]/40 border-black/40`;
    case "rejeitada":
      return `${base} bg-red-100 border-black/30`;
    default:
      return `${base} bg-white border-black/30`;
  }
}

function SolicitacoesPage() {
  const qc = useQueryClient();
  const doList = useServerFn(listProfileRequests);
  const doApprove = useServerFn(approveProfileUpdateRequest);
  const doReject = useServerFn(rejectProfileUpdateRequest);

  const [tab, setTab] = useState<Tab>("pendentes");
  const [search, setSearch] = useState("");
  const [reviewing, setReviewing] = useState<AdminProfileRequest | null>(null);

  const q = useQuery({ queryKey: ["profile-requests"], queryFn: () => doList() });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["profile-requests"] });
    qc.invalidateQueries({ queryKey: ["profile-requests-pending"] });
    qc.invalidateQueries({ queryKey: ["employees"] });
    qc.invalidateQueries({ queryKey: ["admin-dashboard"] });
  };

  const mApprove = useMutation({
    mutationFn: (p: { id: string; reviewer_note?: string }) => doApprove({ data: p }),
    onSuccess: () => {
      toast.success("Solicitação aprovada e cadastro atualizado.");
      setReviewing(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mReject = useMutation({
    mutationFn: (p: { id: string; reviewer_note: string }) => doReject({ data: p }),
    onSuccess: () => {
      toast.success("Solicitação rejeitada.");
      setReviewing(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const requests = (q.data ?? []) as AdminProfileRequest[];
  const term = search.trim().toLowerCase();
  const filtered = requests.filter((r) => {
    const status = TAB_STATUS[tab];
    if (status && r.status !== status) return false;
    if (!term) return true;
    return (
      (r.employee?.name.toLowerCase().includes(term) ?? false) ||
      (r.employee?.department?.toLowerCase().includes(term) ?? false)
    );
  });

  const counts: Record<Tab, number> = {
    pendentes: requests.filter((r) => r.status === "pendente").length,
    aprovadas: requests.filter((r) => r.status === "aprovada").length,
    rejeitadas: requests.filter((r) => r.status === "rejeitada").length,
    todas: requests.length,
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#F5F2E9] -m-6 p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-black tracking-tight text-black">Solicitações</h1>
        <p className="text-sm text-gray-700">
          Pedidos de atualização cadastral enviados pelos colaboradores no portal.
        </p>
      </div>

      <div className="bg-white rounded-xl border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
        <div className="flex flex-col sm:flex-row items-center gap-4 px-4 py-3 border-b border-black/20">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-black/40 pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome ou filial…"
              className="w-full rounded-lg border-2 border-black/20 bg-white pl-9 pr-4 py-2 text-sm text-black outline-none transition focus:border-black focus:ring-2 focus:ring-black/10"
            />
          </div>
          <div className="inline-flex items-center gap-1 rounded-lg bg-black/5 p-1 border border-black/20">
            {(Object.keys(TAB_STATUS) as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded px-3 py-1 text-sm transition-all ${
                  tab === t
                    ? "bg-white border border-black text-black font-bold"
                    : "text-gray-700 hover:text-black"
                }`}
              >
                <span className="capitalize">{t}</span>
                <span className={`ml-1.5 text-xs ${tab === t ? "text-black/60" : "text-gray-500"}`}>
                  {counts[t]}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/20 bg-black/5">
                <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-black">
                  Colaborador
                </th>
                <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-black">
                  Campos solicitados
                </th>
                <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-black">
                  Enviada em
                </th>
                <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-black">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-bold uppercase tracking-wider text-black">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {q.isLoading && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto text-[#2F8F4A]" />
                  </td>
                </tr>
              )}
              {!q.isLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-gray-700 text-sm">
                    {requests.length === 0
                      ? "Nenhuma solicitação recebida até agora."
                      : "Nenhum resultado para os filtros aplicados."}
                  </td>
                </tr>
              )}
              {filtered.map((r) => {
                const labels = changedFieldLabels(r.changes);
                return (
                  <tr
                    key={r.id}
                    className="border-b border-black/20 last:border-0 hover:bg-[#F5F2E9]/50 transition-colors"
                  >
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
                        <div>
                          <div className="font-medium text-black">
                            {r.employee?.name ?? "Colaborador removido"}
                          </div>
                          {r.employee?.department && (
                            <div className="text-xs text-gray-700">{r.employee.department}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {labels.slice(0, 3).map((l) => (
                          <span
                            key={l}
                            className="inline-flex items-center rounded border border-black/20 bg-black/5 px-2 py-0.5 text-xs font-semibold text-black"
                          >
                            {l}
                          </span>
                        ))}
                        {labels.length > 3 && (
                          <span className="inline-flex items-center rounded border border-black/20 px-2 py-0.5 text-xs font-semibold text-gray-700">
                            +{labels.length - 3}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">{fmtDateTime(r.created_at)}</td>
                    <td className="px-6 py-4">
                      <span className={statusBadge(r.status)}>
                        {STATUS_LABEL[r.status as RequestStatus] ?? r.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => setReviewing(r)}
                        className="rounded-lg border-2 border-black bg-white px-3 py-1.5 text-xs font-bold text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-y-[2px] hover:translate-x-[2px] transition-all"
                      >
                        {r.status === "pendente" ? "Revisar" : "Ver detalhes"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {reviewing && (
        <ReviewModal
          request={reviewing}
          onClose={() => setReviewing(null)}
          onApprove={(note) =>
            mApprove.mutate({ id: reviewing.id, reviewer_note: note || undefined })
          }
          onReject={(note) => mReject.mutate({ id: reviewing.id, reviewer_note: note })}
          approving={mApprove.isPending}
          rejecting={mReject.isPending}
        />
      )}
    </div>
  );
}

function ReviewModal({
  request,
  onClose,
  onApprove,
  onReject,
  approving,
  rejecting,
}: {
  request: AdminProfileRequest;
  onClose: () => void;
  onApprove: (note: string) => void;
  onReject: (note: string) => void;
  approving: boolean;
  rejecting: boolean;
}) {
  const [note, setNote] = useState("");
  const isPending = request.status === "pendente";
  const busy = approving || rejecting;
  const entries = Object.entries(request.changes);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-6"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl bg-white rounded-t-2xl md:rounded-2xl shadow-2xl max-h-[95vh] flex flex-col"
      >
        <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-slate-900 truncate">
              {request.employee?.name ?? "Colaborador removido"}
            </h2>
            <p className="text-xs text-slate-500 truncate">
              {[request.employee?.job_title, request.employee?.department]
                .filter(Boolean)
                .join(" · ") || "Sem cargo/filial informados"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
          {request.note && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
              <div className="text-xs font-bold uppercase tracking-wide text-amber-800">
                Observação do colaborador
              </div>
              <p className="mt-1 whitespace-pre-line text-sm text-amber-900">{request.note}</p>
            </div>
          )}

          <div className="overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-wider text-slate-600">
                <tr>
                  <th className="px-4 py-2.5">Campo</th>
                  <th className="px-4 py-2.5">Atual</th>
                  <th className="px-4 py-2.5">Solicitado</th>
                </tr>
              </thead>
              <tbody>
                {entries.map(([key, change]) => {
                  const current = request.employee?.current?.[key] ?? null;
                  const diverged =
                    normalizeProfileValue(key, current) !== normalizeProfileValue(key, change.from);
                  return (
                    <tr key={key} className="border-t border-slate-100 align-top">
                      <td className="px-4 py-2.5 font-semibold text-slate-800">
                        {fieldLabel(key)}
                      </td>
                      <td className="px-4 py-2.5 text-slate-500">
                        <span className="line-through">{change.from ?? "vazio"}</span>
                        {diverged && (
                          <span className="mt-1 flex items-start gap-1 text-xs font-semibold text-amber-700">
                            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                            Mudou no cadastro desde o envio: {current ?? "vazio"}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 font-bold text-slate-900">
                        {change.to ?? "vazio"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {isPending ? (
            <label className="block">
              <span className="text-sm font-medium text-slate-700">
                Nota do revisor{" "}
                <span className="font-normal text-slate-400">(obrigatória para rejeitar)</span>
              </span>
              <textarea
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ex.: comprovante de residência recebido e conferido."
                className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-green-500 focus:ring-1 focus:ring-green-500"
              />
            </label>
          ) : (
            <div className="rounded-xl bg-slate-50 p-3 text-sm">
              <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
                {STATUS_LABEL[request.status as RequestStatus] ?? request.status}
                {request.reviewer_name ? ` por ${request.reviewer_name}` : ""}
                {request.reviewed_at ? ` em ${fmtDateTime(request.reviewed_at)}` : ""}
              </div>
              {request.reviewer_note && (
                <p className="mt-1 whitespace-pre-line text-slate-800">{request.reviewer_note}</p>
              )}
            </div>
          )}
        </div>

        {isPending && (
          <div className="sticky bottom-0 bg-white border-t border-slate-100 px-6 py-4 flex justify-end gap-2 rounded-b-2xl">
            <button
              onClick={() => onReject(note.trim())}
              disabled={busy || note.trim().length < 3}
              className="inline-flex items-center gap-2 rounded-lg border-2 border-black bg-red-100 px-4 py-2 text-sm font-bold text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-y-[2px] hover:translate-x-[2px] transition-all disabled:opacity-50 disabled:shadow-none"
            >
              {rejecting && <Loader2 className="h-4 w-4 animate-spin" />}
              <X className="h-4 w-4" /> Rejeitar
            </button>
            <button
              onClick={() => onApprove(note.trim())}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-lg border-2 border-black bg-[#8FD152] px-4 py-2 text-sm font-bold text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-y-[2px] hover:translate-x-[2px] transition-all disabled:opacity-50 disabled:shadow-none"
            >
              {approving && <Loader2 className="h-4 w-4 animate-spin" />}
              <Check className="h-4 w-4" /> Aprovar e aplicar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
