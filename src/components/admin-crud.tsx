import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Search, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { FieldDef, ResourceDef } from "@/lib/admin-resources";
import { fileUrl, uploadFile } from "@/lib/storage";
import { ICON_MAP } from "@/lib/icon-map";
import { Chip, FilterPills, InkButton, Kicker, PaperCard } from "@/components/paper";
import { useAdminSearch } from "@/components/admin-search";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatDate } from "@/lib/tenure";
import { cn } from "@/lib/utils";

const ICON_OPTIONS = Object.entries(ICON_MAP).map(([name, Icon]) => ({ name, Icon }));

type Row = Record<string, unknown>;

const FILTERS = [
  { value: "todos", label: "Todos" },
  { value: "publicados", label: "Publicados" },
  { value: "rascunhos", label: "Rascunhos" },
  { value: "arquivados", label: "Arquivados" },
] as const;

type FilterId = (typeof FILTERS)[number]["value"];

function defaultFor(f: FieldDef): unknown {
  switch (f.type) {
    case "boolean":
      return false;
    case "number":
      return 0;
    case "tags":
      return [];
    default:
      return "";
  }
}

/** Tom do chip por status, seguindo o mapa do handoff. */
function statusTone(value: string): "success" | "accent" | "soft" | "ink" {
  const v = value.toLowerCase();
  if (["publicado", "ativo", "visivel", "aberta", "concluida"].includes(v)) return "success";
  if (["rascunho", "em_revisao", "em revisão", "ultimos dias", "em_analise"].includes(v))
    return "accent";
  if (["arquivado", "oculto", "inativo", "pausada", "encerrada"].includes(v)) return "soft";
  return "ink";
}

function matchesFilter(row: Row, filter: FilterId): boolean {
  if (filter === "todos") return true;
  const status = String(row.status ?? "");
  if (status) {
    if (filter === "publicados") return status === "publicado" || status === "aberta";
    if (filter === "rascunhos") return status === "rascunho";
    if (filter === "arquivados") return status === "arquivado" || status === "encerrada";
  }
  // Recursos sem `status` usam `active` como equivalente.
  if (typeof row.active === "boolean") {
    if (filter === "publicados") return row.active;
    if (filter === "arquivados") return !row.active;
    return false;
  }
  return filter === "publicados";
}

export function AdminCrud({ resource }: { resource: ResourceDef }) {
  const qc = useQueryClient();
  const { term } = useAdminSearch();
  const [editing, setEditing] = useState<Row | null>(null);
  const [confirming, setConfirming] = useState<Row | null>(null);
  const [filter, setFilter] = useState<FilterId>("todos");

  // Trocar de recurso reseta filtro e formulário.
  useEffect(() => {
    setFilter("todos");
    setEditing(null);
    setConfirming(null);
  }, [resource.key]);

  const listQ = useQuery({
    queryKey: ["admin-list", resource.table],
    queryFn: async () => {
      let query = supabase.from(resource.table as never).select("*");
      if (resource.orderBy) {
        query = query.order(resource.orderBy.column, {
          ascending: resource.orderBy.ascending ?? true,
        });
      }
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return (data ?? []) as Row[];
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from(resource.table as never)
        .delete()
        .eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Registro excluído.");
      qc.invalidateQueries({ queryKey: ["admin-list", resource.table] });
      setConfirming(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [titleCol, ...restCols] = resource.displayColumns;

  const rows = useMemo(() => {
    const q = term.trim().toLowerCase();
    return (listQ.data ?? []).filter((row) => {
      if (!matchesFilter(row, filter)) return false;
      if (!q) return true;
      return resource.displayColumns.some((c) =>
        String(row[c.key] ?? "")
          .toLowerCase()
          .includes(q),
      );
    });
  }, [listQ.data, filter, term, resource.displayColumns]);

  const openNew = () => {
    const empty: Row = {};
    resource.fields.forEach((f) => {
      empty[f.key] = defaultFor(f);
    });
    setEditing(empty);
  };

  return (
    <div>
      <header className="flex flex-wrap items-end justify-between gap-4 border-b-[1.5px] border-ink pb-5">
        <div>
          <Kicker>{resource.section ?? "Painel"}</Kicker>
          <h1 className="mt-3 text-[28px] font-black leading-[1.02] tracking-[-0.045em] sm:text-[34px] lg:text-[42px]">
            {resource.label}
          </h1>
          <p className="mt-3 max-w-[60ch] text-[15.5px] leading-[1.7] text-muted-foreground">
            {resource.note ??
              `Publicado aqui aparece no portal na hora. Ordene, edite ou arquive ${resource.label.toLowerCase()}.`}
          </p>
        </div>
        <InkButton onClick={openNew}>
          {resource.actionLabel ?? `Novo ${resource.labelSingular.toLowerCase()} ↗`}
        </InkButton>
      </header>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <FilterPills options={FILTERS} value={filter} onChange={(v) => setFilter(v)} />
        <span className="text-xs font-bold uppercase tracking-[0.14em] tabular-nums text-muted-foreground">
          {rows.length} {rows.length === 1 ? "registro" : "registros"}
        </span>
      </div>

      <div className="mt-5 overflow-hidden rounded-lg border-[1.5px] border-ink bg-surface shadow-paper">
        <div className="overflow-x-auto">
          <div className="min-w-[860px]">
            <div className="grid grid-cols-[1fr_150px_160px_120px_210px] items-center gap-4 bg-ink px-[22px] py-[13px]">
              <span className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-paper/75">
                {titleCol?.label ?? "Registro"}
              </span>
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-paper/75"
                >
                  {restCols[i]?.label ?? ""}
                </span>
              ))}
              <span className="text-right text-[10px] font-extrabold uppercase tracking-[0.16em] text-paper/75">
                Ações
              </span>
            </div>

            {listQ.isLoading ? (
              <div className="px-[22px] py-10 text-[15px] text-muted-foreground">Carregando…</div>
            ) : rows.length === 0 ? (
              <div className="px-[22px] py-10">
                <p className="text-xl font-black tracking-tight">
                  {filter === "todos" && term.trim() === ""
                    ? "Nenhum registro nesta seção ainda."
                    : "Nenhum registro com esse filtro."}
                </p>
                <p className="mt-2 text-[15px] leading-[1.65] text-muted-foreground">
                  Crie o primeiro registro — ele aparece no portal assim que for publicado.
                </p>
              </div>
            ) : (
              rows.map((row) => (
                <div
                  key={String(row.id)}
                  className="grid grid-cols-[1fr_150px_160px_120px_210px] items-center gap-4 border-t border-border px-[22px] py-4"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[16.5px] font-extrabold tracking-[-0.02em]">
                      {String(row[titleCol?.key ?? "title"] ?? "—")}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {subtitleFor(row, resource)}
                    </p>
                  </div>

                  {[0, 1, 2].map((i) => (
                    <div key={i} className="min-w-0">
                      {restCols[i] ? <Cell value={row[restCols[i].key]} /> : null}
                    </div>
                  ))}

                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setEditing(row)}
                      className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-ink hover:text-primary"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirming(row)}
                      aria-label="Excluir"
                      className="grid h-7 w-7 place-items-center rounded-lg border border-border text-destructive transition hover:bg-destructive/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {resource.rule && (
        <p className="mt-4 text-[13px] leading-[1.6] text-muted-foreground">{resource.rule}</p>
      )}

      {editing && (
        <EditDialog resource={resource} initial={editing} onClose={() => setEditing(null)} />
      )}

      <AlertDialog open={confirming !== null} onOpenChange={(v) => !v && setConfirming(null)}>
        <AlertDialogContent className="border-[1.5px] border-ink bg-paper shadow-elevated">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[22px] font-black tracking-[-0.03em]">
              Excluir “{String(confirming?.[titleCol?.key ?? "title"] ?? "este registro")}”?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[15px] leading-[1.65]">
              O registro sai do portal na hora e não dá pra desfazer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Manter</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirming && del.mutate(String(confirming.id))}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** Segunda linha do título: o primeiro campo de texto com conteúdo. */
function subtitleFor(row: Row, resource: ResourceDef): string {
  for (const key of ["summary", "description", "detail", "question", "label", "url", "email"]) {
    const v = row[key];
    if (typeof v === "string" && v.trim()) {
      return v.length > 80 ? `${v.slice(0, 80)}…` : v;
    }
  }
  return resource.labelSingular;
}

function Cell({ value }: { value: unknown }) {
  if (value === null || value === undefined || value === "") {
    return <span className="text-[13px] text-muted-foreground">—</span>;
  }
  if (typeof value === "boolean") {
    return <Chip tone={value ? "success" : "soft"}>{value ? "Ativo" : "Inativo"}</Chip>;
  }
  if (Array.isArray(value)) {
    return <span className="truncate text-[13px] font-bold">{value.join(", ")}</span>;
  }
  const s = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    return (
      <span className="text-[13px] font-bold tabular-nums text-muted-foreground">
        {formatDate(s)}
      </span>
    );
  }
  if (["publicado", "rascunho", "arquivado", "aberta", "pausada", "encerrada"].includes(s)) {
    return <Chip tone={statusTone(s)}>{s[0].toUpperCase() + s.slice(1)}</Chip>;
  }
  return (
    <span className="block truncate text-[13px] font-bold text-muted-foreground">
      {s.length > 40 ? `${s.slice(0, 40)}…` : s}
    </span>
  );
}

// ── Modal de criar/editar ─────────────────────────────────────────────

/** Marcadores em pílula, no lugar dos checkboxes. */
const MARKERS: { key: string; label: string }[] = [
  { key: "headline", label: "Manchete" },
  { key: "pinned", label: "Fixado" },
  { key: "important", label: "Importante" },
];

function EditDialog({
  resource,
  initial,
  onClose,
}: {
  resource: ResourceDef;
  initial: Row;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<Row>({ ...initial });
  useEffect(() => setForm({ ...initial }), [initial]);

  const markerFields = MARKERS.filter((m) => resource.fields.some((f) => f.key === m.key));
  const inputFields = resource.fields.filter((f) => !markerFields.some((m) => m.key === f.key));

  const save = useMutation({
    mutationFn: async (status?: string) => {
      const payload: Row = { ...form };
      if (status && resource.fields.some((f) => f.key === "status")) payload.status = status;
      resource.fields.forEach((f) => {
        if (payload[f.key] === "" && (f.type === "date" || f.type === "number"))
          payload[f.key] = null;
      });

      if (payload.id) {
        const id = payload.id as string;
        const patch = { ...payload };
        delete (patch as { id?: unknown }).id;
        const { error } = await supabase
          .from(resource.table as never)
          .update(patch as never)
          .eq("id", id);
        if (error) throw new Error(error.message);
      } else {
        delete (payload as { id?: unknown }).id;
        const { error } = await supabase.from(resource.table as never).insert(payload as never);
        if (error) throw new Error(error.message);
      }
    },
    onSuccess: (_d, status) => {
      toast.success(status === "rascunho" ? "Salvo como rascunho." : "Publicado!");
      qc.invalidateQueries({ queryKey: ["admin-list", resource.table] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-[3px] md:items-center md:p-6"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-content-in max-h-[92vh] w-full max-w-[520px] overflow-y-auto rounded-t-lg border-[1.5px] border-ink bg-paper shadow-elevated md:rounded-lg"
      >
        <div className="flex items-start justify-between gap-4 border-b-[1.5px] border-ink px-6 py-5">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-primary">
              {resource.label}
            </p>
            <h2 className="mt-1 text-[22px] font-black tracking-[-0.03em]">
              {form.id ? "Editar" : "Novo"} {resource.labelSingular.toLowerCase()}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[9px] border-[1.5px] border-ink bg-surface transition hover:bg-accent"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form
          className="flex flex-col gap-4 px-6 py-6"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate(undefined);
          }}
        >
          {inputFields.map((f) => (
            <FieldInput
              key={f.key}
              field={f}
              value={form[f.key]}
              onChange={(v) => setForm((s) => ({ ...s, [f.key]: v }))}
              folder={resource.key}
            />
          ))}

          {markerFields.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {markerFields.map((m) => {
                const on = Boolean(form[m.key]);
                return (
                  <button
                    key={m.key}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setForm((s) => ({ ...s, [m.key]: !on }))}
                    className={cn(
                      "rounded-full border-[1.5px] border-ink px-3.5 py-2 text-xs font-extrabold uppercase tracking-[0.04em] transition-colors",
                      on ? "bg-accent text-ink" : "bg-surface text-ink hover:bg-accent-soft",
                    )}
                  >
                    {on ? "✓" : "+"} {m.label}
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-4 pt-1">
            <InkButton type="submit" disabled={save.isPending}>
              {save.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Salvar e publicar
            </InkButton>
            {resource.fields.some((f) => f.key === "status") && (
              <button
                type="button"
                disabled={save.isPending}
                onClick={() => save.mutate("rascunho")}
                className="text-[13px] font-bold text-muted-foreground hover:text-ink"
              >
                Salvar como rascunho
              </button>
            )}
            <span className="ml-auto text-xs text-muted-foreground">
              Publicado agora aparece no portal na hora.
            </span>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Campos ────────────────────────────────────────────────────────────

const INPUT =
  "w-full rounded-lg border-[1.5px] border-ink bg-surface px-3.5 py-3 text-[15px] outline-none";

function FieldInput({
  field,
  value,
  onChange,
  folder,
}: {
  field: FieldDef;
  value: unknown;
  onChange: (v: unknown) => void;
  folder: string;
}) {
  const [uploading, setUploading] = useState(false);

  if (field.type === "boolean") {
    return (
      <label className="flex cursor-pointer items-center gap-3 text-sm font-bold">
        <input
          type="checkbox"
          checked={!!value}
          onChange={(e) => onChange(e.target.checked)}
          className="h-5 w-5 accent-primary"
        />
        <span>{field.label}</span>
      </label>
    );
  }

  return (
    <label className="block">
      <span className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted-foreground">
        {field.label}
        {field.required && " *"}
      </span>
      {field.help && (
        <span className="mt-0.5 block text-[11px] text-muted-foreground">{field.help}</span>
      )}
      <div className="mt-2">
        {field.type === "textarea" || field.type === "richtext" ? (
          <textarea
            rows={field.type === "richtext" ? 6 : 3}
            value={String(value ?? "")}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            required={field.required}
            className={cn(INPUT, "resize-y leading-[1.6]")}
          />
        ) : field.type === "select" ? (
          <select
            value={String(value ?? "")}
            onChange={(e) => onChange(e.target.value)}
            required={field.required}
            className={INPUT}
          >
            <option value="">—</option>
            {field.options?.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        ) : field.type === "icon" ? (
          <IconPicker value={String(value ?? "")} onChange={onChange} />
        ) : field.type === "tags" ? (
          <input
            type="text"
            value={Array.isArray(value) ? (value as string[]).join(", ") : ""}
            onChange={(e) =>
              onChange(
                e.target.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              )
            }
            placeholder="tag1, tag2, tag3"
            className={INPUT}
          />
        ) : field.type === "number" ? (
          <input
            type="number"
            value={value === null || value === undefined ? "" : String(value)}
            onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
            required={field.required}
            className={INPUT}
          />
        ) : field.type === "date" ? (
          <input
            type="date"
            value={value ? String(value).slice(0, 10) : ""}
            onChange={(e) => onChange(e.target.value || null)}
            required={field.required}
            className={INPUT}
          />
        ) : field.type === "file" || field.type === "image" ? (
          <div>
            {value ? (
              <div className="mb-2 flex items-center gap-3">
                {field.type === "image" && fileUrl(String(value)) && (
                  <img
                    src={fileUrl(String(value))!}
                    alt=""
                    className="h-16 w-16 rounded-lg border-[1.5px] border-ink object-cover"
                  />
                )}
                <a
                  href={fileUrl(String(value)) ?? "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="truncate text-xs font-bold text-primary underline"
                >
                  {String(value)}
                </a>
                <button
                  type="button"
                  onClick={() => onChange("")}
                  className="text-xs font-bold text-destructive"
                >
                  Remover
                </button>
              </div>
            ) : null}
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border-[1.5px] border-dashed border-ink px-4 py-2.5 text-sm font-bold hover:bg-accent-soft">
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {value ? "Substituir" : "Fazer upload"}
              <input
                type="file"
                hidden
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  setUploading(true);
                  try {
                    onChange(await uploadFile(f, folder));
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
        ) : (
          <input
            type={field.type === "email" ? "email" : field.type === "url" ? "url" : "text"}
            value={String(value ?? "")}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            required={field.required}
            className={INPUT}
          />
        )}
      </div>
    </label>
  );
}

function IconPicker({ value, onChange }: { value: string; onChange: (v: unknown) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const CurrentIcon = value ? ICON_MAP[value] : null;
  const filtered = ICON_OPTIONS.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()));

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(INPUT, "flex items-center gap-3 text-left")}
      >
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-ink text-accent">
          {CurrentIcon ? (
            <CurrentIcon className="h-4 w-4" />
          ) : (
            <span className="text-xs text-paper/60">—</span>
          )}
        </span>
        <span className="flex-1 text-sm">
          {value || <span className="text-muted-foreground">Selecionar ícone…</span>}
        </span>
        {value && (
          <span
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
            }}
            className="rounded p-1 text-muted-foreground hover:text-destructive"
          >
            <X className="h-3.5 w-3.5" />
          </span>
        )}
      </button>

      {open && (
        <PaperCard className="absolute z-50 mt-1 w-full space-y-2 p-3">
          <div className="flex items-center border-[1.5px] border-ink bg-surface">
            <Search className="ml-2.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar ícone…"
              className="w-full bg-transparent px-2 py-2 text-sm outline-none"
            />
          </div>
          <div className="grid max-h-52 grid-cols-8 gap-1 overflow-y-auto">
            {filtered.map(({ name, Icon }) => (
              <button
                key={name}
                type="button"
                title={name}
                onClick={() => {
                  onChange(name);
                  setOpen(false);
                  setSearch("");
                }}
                className={cn(
                  "grid h-9 w-full place-items-center rounded-lg transition-colors",
                  value === name ? "bg-ink text-accent" : "hover:bg-accent-soft",
                )}
              >
                <Icon className="h-4 w-4" />
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="col-span-8 py-4 text-center text-xs text-muted-foreground">
                Nenhum ícone encontrado.
              </p>
            )}
          </div>
        </PaperCard>
      )}
    </div>
  );
}
