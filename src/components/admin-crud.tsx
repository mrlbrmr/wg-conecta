import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ResourceDef, FieldDef } from "@/lib/admin-resources";
import { uploadFile, fileUrl } from "@/lib/storage";
import { Plus, Pencil, Trash2, Upload, Loader2, X, Search } from "lucide-react";
import { toast } from "sonner";
import { ICON_MAP } from "@/lib/icon-map";

const ICON_OPTIONS = Object.entries(ICON_MAP).map(([name, Icon]) => ({ name, Icon }));

type Row = Record<string, unknown>;

function defaultFor(f: FieldDef): unknown {
  switch (f.type) {
    case "boolean": return false;
    case "number": return 0;
    case "tags": return [];
    default: return "";
  }
}

export function AdminCrud({ resource }: { resource: ResourceDef }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Row | null>(null);
  const listQ = useQuery({
    queryKey: ["admin-list", resource.table],
    queryFn: async () => {
      let query = supabase.from(resource.table as never).select("*");
      if (resource.orderBy) {
        query = query.order(resource.orderBy.column, { ascending: resource.orderBy.ascending ?? true });
      }
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return (data ?? []) as Row[];
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(resource.table as never).delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { toast.success("Removido."); qc.invalidateQueries({ queryKey: ["admin-list", resource.table] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const openNew = () => {
    const empty: Row = {};
    resource.fields.forEach(f => { empty[f.key] = defaultFor(f); });
    setEditing(empty);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight">{resource.label}</h1>
          <p className="text-sm text-muted-foreground">Gerencie os itens desta seção.</p>
        </div>
        <button onClick={openNew} className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:opacity-95">
          <Plus className="h-4 w-4" /> Novo
        </button>
      </div>

      <div className="card-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-muted text-left text-xs font-semibold uppercase text-muted-foreground tracking-wider">
              <tr>
                {resource.displayColumns.map(c => <th key={c.key} className="px-6 py-4">{c.label}</th>)}
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {listQ.isLoading && <tr><td colSpan={99} className="p-6 text-center text-muted-foreground">Carregando...</td></tr>}
              {!listQ.isLoading && (listQ.data ?? []).length === 0 && <tr><td colSpan={99} className="p-6 text-center text-muted-foreground">Nenhum registro. Clique em "Novo" para adicionar.</td></tr>}
              {(listQ.data ?? []).map(row => (
                <tr key={String(row.id)} className="border-t border-border hover:bg-surface-muted/50">
                  {resource.displayColumns.map(c => (
                    <td key={c.key} className="px-6 py-4">{formatCell(row[c.key])}</td>
                  ))}
                  <td className="px-6 py-4 text-right">
                    <div className="inline-flex gap-1">
                      <button onClick={() => setEditing(row)} className="rounded-lg p-2 text-muted-foreground hover:text-primary hover:bg-primary-softer transition-colors" aria-label="Editar"><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => { if (confirm("Remover este item?")) del.mutate(String(row.id)); }} className="rounded-lg p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors" aria-label="Remover"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editing && <FormDrawer resource={resource} initial={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function formatCell(v: unknown) {
  if (v === null || v === undefined || v === "") return <span className="text-muted-foreground">—</span>;
  if (typeof v === "boolean") return v ? <span className="chip-success">Ativo</span> : <span className="text-muted-foreground">Inativo</span>;
  if (Array.isArray(v)) return v.join(", ");
  if (typeof v === "string" && v.length > 60) return v.slice(0, 60) + "…";
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) {
    try { return new Date(v).toLocaleDateString("pt-BR"); } catch { return v; }
  }
  return String(v);
}

function FormDrawer({ resource, initial, onClose }: { resource: ResourceDef; initial: Row; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<Row>({ ...initial });
  useEffect(() => { setForm({ ...initial }); }, [initial]);

  const save = useMutation({
    mutationFn: async () => {
      const payload: Row = { ...form };
      // clean empty date/string values
      resource.fields.forEach(f => {
        if (payload[f.key] === "" && (f.type === "date" || f.type === "number")) payload[f.key] = null;
      });
      if (payload.id) {
        const id = payload.id as string;
        const patch = { ...payload }; delete (patch as { id?: unknown }).id;
        const { error } = await supabase.from(resource.table as never).update(patch as never).eq("id", id);
        if (error) throw new Error(error.message);
      } else {
        delete (payload as { id?: unknown }).id;
        const { error } = await supabase.from(resource.table as never).insert(payload as never);
        if (error) throw new Error(error.message);
      }
    },
    onSuccess: () => { toast.success("Salvo!"); qc.invalidateQueries({ queryKey: ["admin-list", resource.table] }); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-6" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-2xl bg-background rounded-t-3xl md:rounded-3xl max-h-[92vh] overflow-y-auto shadow-elevated">
        <div className="sticky top-0 bg-background border-b border-border px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{form.id ? "Editar" : "Novo"} {resource.labelSingular.toLowerCase()}</h2>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-secondary"><X className="h-4 w-4" /></button>
        </div>
        <form className="p-6 space-y-4" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          {resource.fields.map(f => (
            <FieldInput key={f.key} field={f} value={form[f.key]} onChange={(v) => setForm(s => ({ ...s, [f.key]: v }))} folder={resource.key} />
          ))}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-full border border-input px-4 py-2 text-sm font-bold hover:bg-secondary">Cancelar</button>
            <button type="submit" disabled={save.isPending} className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50">
              {save.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function IconPicker({ value, onChange }: { value: string; onChange: (v: unknown) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const CurrentIcon = value ? ICON_MAP[value] : null;
  const filtered = ICON_OPTIONS.filter(i => i.name.toLowerCase().includes(search.toLowerCase()));

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="flex items-center gap-3 w-full rounded-xl border border-input bg-surface px-4 py-2.5 hover:border-primary focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 text-left">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary-softer text-primary">
          {CurrentIcon ? <CurrentIcon className="h-4 w-4" /> : <span className="text-muted-foreground text-xs">—</span>}
        </span>
        <span className="flex-1 text-sm">{value || <span className="text-muted-foreground">Selecionar ícone…</span>}</span>
        {value && (
          <span onClick={(e) => { e.stopPropagation(); onChange(""); }} className="text-muted-foreground hover:text-destructive p-1 rounded">
            <X className="h-3.5 w-3.5" />
          </span>
        )}
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-2xl border border-border bg-background shadow-elevated p-3 space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <input autoFocus value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar ícone…"
              className="w-full rounded-lg border border-input bg-surface pl-8 pr-3 py-1.5 text-sm outline-none focus:border-primary" />
          </div>
          <div className="grid grid-cols-8 gap-1 max-h-52 overflow-y-auto">
            {filtered.map(({ name, Icon }) => (
              <button key={name} type="button" title={name}
                onClick={() => { onChange(name); setOpen(false); setSearch(""); }}
                className={`grid place-items-center h-9 w-full rounded-lg transition-colors ${value === name ? "bg-primary text-primary-foreground" : "hover:bg-primary-softer text-foreground"}`}>
                <Icon className="h-4 w-4" />
              </button>
            ))}
            {filtered.length === 0 && <p className="col-span-8 py-4 text-center text-xs text-muted-foreground">Nenhum ícone encontrado.</p>}
          </div>
        </div>
      )}
    </div>
  );
}

function FieldInput({ field, value, onChange, folder }: { field: FieldDef; value: unknown; onChange: (v: unknown) => void; folder: string }) {
  const [uploading, setUploading] = useState(false);
  const commonInput = "w-full rounded-xl border border-input bg-surface px-4 py-2.5 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10";

  if (field.type === "boolean") {
    return (
      <label className="flex items-center gap-3 text-sm font-semibold cursor-pointer">
        <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} className="h-5 w-5 rounded accent-primary" />
        <span>{field.label}</span>
      </label>
    );
  }

  return (
    <label className="block">
      <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{field.label}{field.required && " *"}</span>
      {field.help && <span className="block text-[11px] text-muted-foreground mt-0.5">{field.help}</span>}
      <div className="mt-1.5">
        {field.type === "textarea" || field.type === "richtext" ? (
          <textarea rows={field.type === "richtext" ? 6 : 3} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder} required={field.required} className={commonInput} />
        ) : field.type === "select" ? (
          <select value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} required={field.required} className={commonInput}>
            <option value="">—</option>
            {field.options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        ) : field.type === "icon" ? (
          <IconPicker value={String(value ?? "")} onChange={onChange} />
        ) : field.type === "tags" ? (
          <input type="text" value={Array.isArray(value) ? (value as string[]).join(", ") : ""} onChange={(e) => onChange(e.target.value.split(",").map(s => s.trim()).filter(Boolean))}
            placeholder="tag1, tag2, tag3" className={commonInput} />
        ) : field.type === "number" ? (
          <input type="number" value={value === null || value === undefined ? "" : String(value)} onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
            required={field.required} className={commonInput} />
        ) : field.type === "date" ? (
          <input type="date" value={value ? String(value).slice(0, 10) : ""} onChange={(e) => onChange(e.target.value || null)}
            required={field.required} className={commonInput} />
        ) : field.type === "file" || field.type === "image" ? (
          <div>
            {value ? (
              <div className="mb-2 flex items-center gap-3">
                {field.type === "image" && fileUrl(String(value)) && (
                  <img src={fileUrl(String(value))!} alt="" className="h-16 w-16 rounded-lg object-cover border border-border" />
                )}
                <a href={fileUrl(String(value)) ?? "#"} target="_blank" rel="noreferrer" className="text-xs font-semibold text-primary underline truncate">
                  {String(value)}
                </a>
                <button type="button" onClick={() => onChange("")} className="text-xs text-destructive font-semibold">Remover</button>
              </div>
            ) : null}
            <label className="inline-flex items-center gap-2 rounded-xl border border-dashed border-input px-4 py-2.5 text-sm font-semibold cursor-pointer hover:bg-secondary">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {value ? "Substituir" : "Fazer upload"}
              <input type="file" hidden onChange={async (e) => {
                const f = e.target.files?.[0]; if (!f) return;
                setUploading(true);
                try { const path = await uploadFile(f, folder); onChange(path); }
                catch (err) { toast.error((err as Error).message); }
                finally { setUploading(false); e.target.value = ""; }
              }} />
            </label>
          </div>
        ) : (
          <input type={field.type === "email" ? "email" : field.type === "url" ? "url" : "text"}
            value={String(value ?? "")} onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder} required={field.required} className={commonInput} />
        )}
      </div>
    </label>
  );
}
