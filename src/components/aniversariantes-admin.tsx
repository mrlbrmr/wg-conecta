import * as XLSX from "xlsx";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fileUrl, uploadFile } from "@/lib/storage";
import {
  ArrowDown, ArrowUp, ArrowUpDown,
  Loader2, Pencil, Plus, Search, Trash2, Upload, X,
} from "lucide-react";
import { toast } from "sonner";

/* ─── Tipos ──────────────────────────────────────────────────────────────────── */

type Birthday = {
  id: string;
  name: string;
  birthday_day: number;
  birthday_month: number;
  active: boolean;
  photo_url: string | null;
  role: string | null;
  unit: string | null;
};

type ParsedRow = { name: string; birthday_day: number; birthday_month: number };

type SortKey = "name" | "date";
type SortDir = "asc" | "desc";

/* ─── Constantes ─────────────────────────────────────────────────────────────── */

const MONTHS_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const MONTHS_FULL = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

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

/* ─── Utilitários ────────────────────────────────────────────────────────────── */

const LOWER_PT = new Set(["de", "da", "do", "dos", "das", "e", "a", "o", "em", "na", "no"]);

function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word, i) =>
      i === 0 || !LOWER_PT.has(word)
        ? word.charAt(0).toUpperCase() + word.slice(1)
        : word,
    )
    .join(" ");
}

function normKey(k: string): string {
  return k
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, "")
    .trim();
}

function parseBirthDate(raw: unknown): { day: number; month: number } | null {
  if (raw === null || raw === undefined || raw === "") return null;

  // Excel serial number
  if (typeof raw === "number") {
    const d = new Date(Math.round((raw - 25569) * 86400 * 1000));
    const day = d.getUTCDate();
    const month = d.getUTCMonth() + 1;
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) return { day, month };
    return null;
  }

  // DD/MM/YYYY string
  const m = String(raw).trim().match(/^(\d{1,2})\/(\d{1,2})(?:\/\d{2,4})?$/);
  if (m) {
    const day = parseInt(m[1], 10);
    const month = parseInt(m[2], 10);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) return { day, month };
  }
  return null;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length === 1
    ? parts[0].slice(0, 2).toUpperCase()
    : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function avatarColor(name: string): string {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

/* ─── Ícone de ordenação ─────────────────────────────────────────────────────── */

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (sortKey !== col) return <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />;
  return sortDir === "asc"
    ? <ArrowUp className="h-3.5 w-3.5 text-primary" />
    : <ArrowDown className="h-3.5 w-3.5 text-primary" />;
}

/* ─── Componente principal ───────────────────────────────────────────────────── */

type FormValues = {
  name: string;
  birthday_day: number;
  birthday_month: number;
  active: boolean;
  photo_url: string | null;
  role: string;
  unit: string;
};

export function AniversariantesAdmin() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [editing, setEditing] = useState<Birthday | null>(null);
  const [adding, setAdding] = useState(false);
  const [importRows, setImportRows] = useState<ParsedRow[] | null>(null);
  const [parsing, setParsing] = useState(false);

  const q = useQuery({
    queryKey: ["birthdays-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("birthdays")
        .select("*");
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

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  }

  const records = q.data ?? [];
  const term = search.trim().toLowerCase();
  const filtered = term ? records.filter(r => r.name.toLowerCase().includes(term)) : records;

  const sorted = [...filtered].sort((a, b) => {
    const cmp = sortKey === "name"
      ? a.name.localeCompare(b.name, "pt-BR")
      : (a.birthday_month - b.birthday_month) || (a.birthday_day - b.birthday_day);
    return sortDir === "asc" ? cmp : -cmp;
  });

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setParsing(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });

      const parsed: ParsedRow[] = [];

      for (const r of raw) {
        // Mapa normalizado de chaves
        const norm: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(r)) norm[normKey(k)] = v;

        // Coluna nome
        const nomeKey = Object.keys(norm).find(k => k === "nome" || k.startsWith("nome ") || k.endsWith(" nome"));
        if (!nomeKey) continue;
        const nomeRaw = String(norm[nomeKey] ?? "").trim();
        if (!nomeRaw || nomeRaw.length < 2) continue;

        // Coluna data nasc. (Domínio: "Data Nasc.", "Dt. Nasc.", "Data de Nascimento")
        const dataKey = Object.keys(norm).find(k =>
          (k.includes("nasc") && (k.includes("data") || k.includes("dt"))) ||
          k === "data nascimento" || k === "nascimento",
        );
        if (!dataKey) continue;

        const date = parseBirthDate(norm[dataKey]);
        if (!date) continue;

        parsed.push({
          name: toTitleCase(nomeRaw),
          birthday_day: date.day,
          birthday_month: date.month,
        });
      }

      // Deduplicar pelo nome dentro do arquivo
      const seen = new Set<string>();
      const unique = parsed.filter(r => {
        const k = r.name.toLowerCase();
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });

      if (unique.length === 0) {
        toast.error("Nenhum registro válido encontrado. Verifique se a planilha tem as colunas Nome e Data Nasc.");
        return;
      }

      setImportRows(unique);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setParsing(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background -m-6 p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-black tracking-tight">Aniversariantes</h1>
        <p className="text-sm text-muted-foreground">Gerencie os aniversariantes cadastrados.</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nome…"
              className="w-full rounded-lg border border-border bg-surface pl-9 pr-4 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
            />
          </div>
          <div className="flex gap-2 shrink-0">
            <label className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer">
              {parsing
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Upload className="h-4 w-4" />}
              Importar
              <input
                ref={fileRef}
                type="file"
                hidden
                accept=".csv,.xlsx,.xls"
                onChange={handleImportFile}
              />
            </label>
            <button
              onClick={() => setAdding(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
            >
              <Plus className="h-4 w-4" /> Novo
            </button>
          </div>
        </div>

        {/* Tabela */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="px-6 py-3 text-left">
                  <button
                    onClick={() => toggleSort("name")}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-700 transition-colors"
                  >
                    Nome <SortIcon col="name" sortKey={sortKey} sortDir={sortDir} />
                  </button>
                </th>
                <th className="px-6 py-3 text-left">
                  <button
                    onClick={() => toggleSort("date")}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-700 transition-colors"
                  >
                    Data <SortIcon col="date" sortKey={sortKey} sortDir={sortDir} />
                  </button>
                </th>
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
              {!q.isLoading && sorted.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-10 text-center text-muted-foreground text-sm">
                    {records.length === 0
                      ? 'Nenhum aniversariante cadastrado. Clique em "Novo" para adicionar.'
                      : "Nenhum resultado para a busca."}
                  </td>
                </tr>
              )}
              {sorted.map(b => (
                <tr
                  key={b.id}
                  className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {fileUrl(b.photo_url) ? (
                        <img
                          src={fileUrl(b.photo_url)!}
                          alt={b.name}
                          className="h-8 w-8 shrink-0 rounded-full object-cover"
                        />
                      ) : (
                        <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${avatarColor(b.name)}`}>
                          {initials(b.name)}
                        </span>
                      )}
                      <div>
                        <div className="font-medium text-slate-900">{b.name}</div>
                        {(b.role || b.unit) && (
                          <div className="text-xs text-muted-foreground">
                            {[b.role, b.unit].filter(Boolean).join(" · ")}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-medium text-slate-700">
                    {b.birthday_day}/{MONTHS_SHORT[b.birthday_month - 1]}
                  </td>
                  <td className="px-6 py-4">
                    {b.active
                      ? <span className="chip-success">Ativo</span>
                      : <span className="text-muted-foreground text-xs font-semibold">Inativo</span>}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="inline-flex gap-1">
                      <button
                        onClick={() => setEditing(b)}
                        title="Editar"
                        className="rounded-lg p-2 text-muted-foreground hover:text-primary hover:bg-primary-softer transition-colors"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => { if (confirm("Remover este aniversariante?")) del.mutate(b.id); }}
                        title="Remover"
                        className="rounded-lg p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
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

        {sorted.length > 0 && (
          <div className="px-6 py-3 border-t border-slate-100 text-right text-xs text-muted-foreground">
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

      {importRows && (
        <ImportPreviewModal
          rows={importRows}
          onClose={() => setImportRows(null)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["birthdays-admin"] });
            setImportRows(null);
          }}
        />
      )}
    </div>
  );
}

/* ─── Modal de prévia de importação ─────────────────────────────────────────── */

function ImportPreviewModal({
  rows,
  onClose,
  onSaved,
}: {
  rows: ParsedRow[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const save = useMutation({
    mutationFn: async () => {
      // Busca nomes existentes para evitar duplicatas
      const { data: existing } = await supabase.from("birthdays").select("name");
      const existingNames = new Set((existing ?? []).map(r => r.name.toLowerCase()));

      const toInsert = rows
        .filter(r => !existingNames.has(r.name.toLowerCase()))
        .map(r => ({ ...r, active: true }));

      if (toInsert.length > 0) {
        const { error } = await supabase.from("birthdays").insert(toInsert);
        if (error) throw new Error(error.message);
      }

      return { inserted: toInsert.length, skipped: rows.length - toInsert.length };
    },
    onSuccess: (result) => {
      const msg = result.inserted > 0
        ? `${result.inserted} inserido${result.inserted > 1 ? "s" : ""}${result.skipped > 0 ? ` · ${result.skipped} já existia${result.skipped > 1 ? "m" : ""}` : ""}.`
        : "Todos os registros já estavam cadastrados.";
      toast.success(msg);
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div
      className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-6"
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="w-full max-w-2xl bg-white rounded-t-3xl md:rounded-3xl shadow-elevated max-h-[92vh] overflow-y-auto"
      >
        <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="font-bold">Prévia da importação</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{rows.length} registros encontrados na planilha</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-slate-100 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="rounded-xl bg-surface-muted px-4 py-3 text-xs text-muted-foreground space-y-1">
            <p className="font-semibold text-foreground">Regras aplicadas automaticamente:</p>
            <p>• Nomes convertidos para Title Case (preposições em minúsculo)</p>
            <p>• Apenas dia e mês extraídos da data de nascimento</p>
            <p>• Registros já existentes (mesmo nome) serão ignorados</p>
          </div>

          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <div className="max-h-72 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50">
                  <tr className="border-b border-slate-200">
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Nome</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="border-b border-slate-100 last:border-0">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${avatarColor(r.name)}`}>
                            {initials(r.name)}
                          </span>
                          <span className="font-medium">{r.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {r.birthday_day}/{MONTHS_SHORT[r.birthday_month - 1]}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-bold hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={() => save.mutate()}
              disabled={save.isPending}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50"
            >
              {save.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Importar {rows.length} registros
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Modal de cadastro / edição ─────────────────────────────────────────────── */

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
    photo_url: initial?.photo_url ?? null,
    role: initial?.role ?? "",
    unit: initial?.unit ?? "",
  });
  const [uploading, setUploading] = useState(false);

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
        onClick={e => e.stopPropagation()}
        className="w-full max-w-md bg-white rounded-t-3xl md:rounded-3xl shadow-elevated max-h-[92vh] overflow-y-auto"
      >
        <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between">
          <h2 className="font-bold">{initial ? `Editar — ${initial.name}` : "Novo aniversariante"}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-slate-100 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form className="p-6 space-y-4" onSubmit={e => { e.preventDefault(); save.mutate(); }}>
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Nome *</span>
            <input
              required
              value={form.name}
              onChange={e => setForm(s => ({ ...s, name: e.target.value }))}
              className="mt-1.5 w-full rounded-xl border border-input bg-surface px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Dia *</span>
              <select
                required
                value={form.birthday_day}
                onChange={e => setForm(s => ({ ...s, birthday_day: Number(e.target.value) }))}
                className="mt-1.5 w-full rounded-xl border border-input bg-surface px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
              >
                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Mês *</span>
              <select
                required
                value={form.birthday_month}
                onChange={e => setForm(s => ({ ...s, birthday_month: Number(e.target.value) }))}
                className="mt-1.5 w-full rounded-xl border border-input bg-surface px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
              >
                {MONTHS_FULL.map((m, i) => (
                  <option key={i + 1} value={i + 1}>{m}</option>
                ))}
              </select>
            </label>
          </div>
          {/* Foto */}
          <div>
            <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Foto</span>
            {form.photo_url && fileUrl(form.photo_url) && (
              <div className="mt-2 flex items-center gap-3">
                <img
                  src={fileUrl(form.photo_url)!}
                  alt="Foto atual"
                  className="h-14 w-14 rounded-full object-cover border border-border"
                />
                <button
                  type="button"
                  onClick={() => setForm(s => ({ ...s, photo_url: null }))}
                  className="text-xs font-semibold text-destructive hover:underline"
                >
                  Remover foto
                </button>
              </div>
            )}
            <label className="mt-2 inline-flex items-center gap-2 rounded-xl border border-dashed border-input px-4 py-2.5 text-sm font-semibold cursor-pointer hover:bg-secondary transition-colors">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {form.photo_url ? "Substituir foto" : "Fazer upload"}
              <input
                type="file"
                hidden
                accept="image/*"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  setUploading(true);
                  try {
                    const path = await uploadFile(f, "aniversariantes");
                    setForm(s => ({ ...s, photo_url: path }));
                  } catch (err) {
                    toast.error((err as Error).message);
                  } finally {
                    setUploading(false);
                    e.target.value = "";
                  }
                }}
              />
            </label>
          </div>

          {/* Cargo e Unidade */}
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Cargo</span>
              <input
                value={form.role}
                onChange={e => setForm(s => ({ ...s, role: e.target.value }))}
                placeholder="Analista, Vendedor…"
                className="mt-1.5 w-full rounded-xl border border-input bg-surface px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
              />
            </label>
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Unidade</span>
              <input
                value={form.unit}
                onChange={e => setForm(s => ({ ...s, unit: e.target.value }))}
                placeholder="Filial, Matriz…"
                className="mt-1.5 w-full rounded-xl border border-input bg-surface px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
              />
            </label>
          </div>

          <label className="flex items-center gap-3 text-sm font-semibold cursor-pointer">
            <input
              type="checkbox"
              checked={form.active}
              onChange={e => setForm(s => ({ ...s, active: e.target.checked }))}
              className="h-5 w-5 rounded accent-primary"
            />
            <span>Ativo</span>
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-input px-4 py-2 text-sm font-bold hover:bg-secondary transition-colors"
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
