import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FileSpreadsheet, Loader2, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { ImportSpreadsheet } from "@/components/import-spreadsheet";

type Birthday = {
  id: string;
  name: string;
  birthday_day: number;
  birthday_month: number;
  active: boolean;
};

const MONTHS_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const MONTHS_FULL = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length === 1
    ? parts[0].slice(0, 2).toUpperCase()
    : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const AVATAR_COLORS = [
  "bg-blue-100 text-blue-700",
  "bg-purple-100 text-purple-700",
  "bg-pink-100 text-pink-700",
  "bg-amber-100 text-amber-700",
  "bg-teal-100 text-teal-700",
  "bg-indigo-100 text-indigo-700",
  "bg-rose-100 text-rose-700",
  "bg-emerald-100 text-emerald-700",
];

function avatarColor(name: string): string {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

type FormValues = { name: string; birthday_day: number; birthday_month: number; active: boolean };

export function AniversariantesAdmin() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [importing, setImporting] = useState(false);
  const [editing, setEditing] = useState<Birthday | null>(null);
  const [adding, setAdding] = useState(false);

  const q = useQuery({
    queryKey: ["birthdays-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("birthdays")
        .select("*")
        .order("birthday_month", { ascending: true })
        .order("birthday_day", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []) as Birthday[];
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("birthdays").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Removido.");
      qc.invalidateQueries({ queryKey: ["birthdays-admin"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const records = q.data ?? [];
  const term = search.trim().toLowerCase();
  const filtered = term ? records.filter((r) => r.name.toLowerCase().includes(term)) : records;

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50 -m-6 p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-black tracking-tight">Aniversariantes</h1>
        <p className="text-sm text-muted-foreground">Gerencie os aniversariantes cadastrados.</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome…"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-4 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
            />
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => setImporting(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <FileSpreadsheet className="h-4 w-4" /> Importar
            </button>
            <button
              onClick={() => setAdding(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
            >
              <Plus className="h-4 w-4" /> Novo
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Nome</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Data</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Ações</th>
              </tr>
            </thead>
            <tbody>
              {q.isLoading && (
                <tr>
                  <td colSpan={4} className="px-6 py-10 text-center">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto text-primary" />
                  </td>
                </tr>
              )}
              {!q.isLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-10 text-center text-slate-400 text-sm">
                    {records.length === 0
                      ? 'Nenhum aniversariante cadastrado. Clique em "Novo" para adicionar.'
                      : "Nenhum resultado para a busca."}
                  </td>
                </tr>
              )}
              {filtered.map((b) => (
                <tr
                  key={b.id}
                  className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <span
                        className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${avatarColor(b.name)}`}
                      >
                        {initials(b.name)}
                      </span>
                      <span className="font-medium text-slate-900">{b.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-medium text-slate-700">
                    {b.birthday_day}/{MONTHS_SHORT[b.birthday_month - 1]}
                  </td>
                  <td className="px-6 py-4">
                    {b.active
                      ? <span className="chip-success">Ativo</span>
                      : <span className="text-slate-400 text-xs font-semibold">Inativo</span>}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="inline-flex gap-1">
                      <button
                        onClick={() => setEditing(b)}
                        title="Editar"
                        className="rounded-lg p-2 text-slate-400 hover:text-primary hover:bg-primary-softer transition-colors"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm("Remover este aniversariante?")) del.mutate(b.id);
                        }}
                        title="Remover"
                        className="rounded-lg p-2 text-slate-400 hover:text-destructive hover:bg-destructive/10 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filtered.length > 0 && (
          <div className="px-6 py-3 border-t border-slate-100 text-right text-xs text-slate-400">
            {filtered.length} de {records.length} aniversariantes
          </div>
        )}
      </div>

      {(adding || editing) && (
        <BirthdayModal
          initial={editing ?? undefined}
          onClose={() => { setAdding(false); setEditing(null); }}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["birthdays-admin"] });
            setAdding(false);
            setEditing(null);
          }}
        />
      )}

      {importing && (
        <ImportSpreadsheet table="birthdays" onClose={() => setImporting(false)} />
      )}
    </div>
  );
}

function BirthdayModal({
  initial,
  onClose,
  onSaved,
}: {
  initial?: Birthday;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<FormValues>({
    name: initial?.name ?? "",
    birthday_day: initial?.birthday_day ?? 1,
    birthday_month: initial?.birthday_month ?? 1,
    active: initial?.active ?? true,
  });

  const save = useMutation({
    mutationFn: async () => {
      if (initial?.id) {
        const { error } = await supabase.from("birthdays").update(form).eq("id", initial.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase.from("birthdays").insert(form);
        if (error) throw new Error(error.message);
      }
    },
    onSuccess: () => { toast.success("Salvo!"); onSaved(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const daysInMonth = new Date(2024, form.birthday_month, 0).getDate();

  return (
    <div
      className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-6"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-white rounded-t-3xl md:rounded-3xl shadow-elevated max-h-[92vh] overflow-y-auto"
      >
        <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between">
          <h2 className="font-bold">{initial ? `Editar — ${initial.name}` : "Novo aniversariante"}</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 hover:bg-slate-100 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <form
          className="p-6 space-y-4"
          onSubmit={(e) => { e.preventDefault(); save.mutate(); }}
        >
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Nome *</span>
            <input
              required
              value={form.name}
              onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Dia *</span>
              <select
                required
                value={form.birthday_day}
                onChange={(e) => setForm((s) => ({ ...s, birthday_day: Number(e.target.value) }))}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
              >
                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Mês *</span>
              <select
                required
                value={form.birthday_month}
                onChange={(e) => setForm((s) => ({ ...s, birthday_month: Number(e.target.value) }))}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
              >
                {MONTHS_FULL.map((m, i) => (
                  <option key={i + 1} value={i + 1}>{m}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="flex items-center gap-3 text-sm font-semibold cursor-pointer">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm((s) => ({ ...s, active: e.target.checked }))}
              className="h-5 w-5 rounded accent-primary"
            />
            <span>Ativo</span>
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-bold hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={save.isPending}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50"
            >
              {save.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
