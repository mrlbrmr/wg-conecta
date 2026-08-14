import { useState } from "react";
import * as XLSX from "xlsx";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Upload, X, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

type ResourceKey = "birthdays" | "work_anniversaries";

const CONFIGS: Record<ResourceKey, {
  title: string;
  headers: string[];
  mapRow: (row: Record<string, string>) => Record<string, unknown> | null;
  dupe: (row: Record<string, unknown>) => string;
}> = {
  birthdays: {
    title: "aniversariantes",
    headers: ["nome", "cargo", "unidade", "dia", "mes", "foto_url"],
    mapRow: (r) => {
      const day = Number(r.dia); const month = Number(r.mes);
      if (!r.nome || !day || !month) return null;
      return { name: r.nome, role: r.cargo || null, unit: r.unidade || null,
        birthday_day: day, birthday_month: month, photo_url: r.foto_url || null, active: true };
    },
    dupe: (r) => `${r.name}|${r.birthday_day}|${r.birthday_month}`,
  },
  work_anniversaries: {
    title: "tempo de casa",
    headers: ["nome", "cargo", "unidade", "data_admissao", "foto_url", "mensagem"],
    mapRow: (r) => {
      if (!r.nome || !r.data_admissao) return null;
      // accept dd/mm/yyyy or yyyy-mm-dd
      let iso = r.data_admissao.trim();
      const brm = iso.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (brm) iso = `${brm[3]}-${brm[2]}-${brm[1]}`;
      return { name: r.nome, role: r.cargo || null, unit: r.unidade || null,
        admission_date: iso, photo_url: r.foto_url || null, message: r.mensagem || null, active: true };
    },
    dupe: (r) => `${r.name}|${r.admission_date}`,
  },
};

export function ImportSpreadsheet({ table, onClose }: { table: ResourceKey; onClose: () => void }) {
  const cfg = CONFIGS[table];
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [fileName, setFileName] = useState("");
  const [parsing, setParsing] = useState(false);
  const qc = useQueryClient();

  const insert = useMutation({
    mutationFn: async () => {
      // Dedupe: fetch existing keys
      const { data: existing } = await supabase.from(table as never).select("*") as unknown as { data: Record<string, unknown>[] };
      const set = new Set((existing ?? []).map(cfg.dupe));
      const toInsert = rows.filter(r => !set.has(cfg.dupe(r)));
      if (toInsert.length === 0) throw new Error("Nenhum registro novo (todos já existem).");
      const { error } = await supabase.from(table as never).insert(toInsert as never);
      if (error) throw new Error(error.message);
      return toInsert.length;
    },
    onSuccess: (n) => { toast.success(`${n} registros importados.`); qc.invalidateQueries({ queryKey: ["admin-list", table] }); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleFile = async (file: File) => {
    setParsing(true); setFileName(file.name);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: "" });
      const mapped = raw.map(r => {
        const norm: Record<string, string> = {};
        Object.entries(r).forEach(([k, v]) => { norm[k.toLowerCase().trim()] = String(v ?? "").trim(); });
        return cfg.mapRow(norm);
      }).filter(Boolean) as Record<string, unknown>[];
      setRows(mapped);
      if (mapped.length === 0) toast.error("Nenhuma linha válida encontrada.");
    } catch (e) { toast.error((e as Error).message); }
    finally { setParsing(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-6" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-3xl bg-background rounded-t-3xl md:rounded-3xl max-h-[92vh] overflow-y-auto shadow-elevated">
        <div className="sticky top-0 bg-background border-b border-border px-6 py-4 flex items-center justify-between">
          <h2 className="font-bold">Importar {cfg.title}</h2>
          <button onClick={onClose}><X className="h-4 w-4" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="text-sm text-muted-foreground">
            Colunas aceitas (cabeçalhos na 1ª linha): <span className="font-mono text-xs">{cfg.headers.join(", ")}</span>
          </div>
          <label className="inline-flex items-center gap-2 rounded-xl border border-dashed border-input px-4 py-3 text-sm font-semibold cursor-pointer hover:bg-secondary">
            {parsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Selecionar CSV ou XLSX
            <input type="file" hidden accept=".csv,.xlsx,.xls" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          </label>
          {fileName && <div className="text-xs text-muted-foreground">Arquivo: {fileName}</div>}
          {rows.length > 0 && (
            <>
              <div className="chip-accent inline-flex"><CheckCircle2 className="h-3.5 w-3.5" /> {rows.length} registros prontos</div>
              <div className="card-soft overflow-hidden">
                <div className="max-h-80 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-surface-muted text-left font-bold uppercase text-muted-foreground sticky top-0">
                      <tr>{Object.keys(rows[0]).map(k => <th key={k} className="px-3 py-2">{k}</th>)}</tr>
                    </thead>
                    <tbody>
                      {rows.slice(0, 50).map((r, i) => (
                        <tr key={i} className="border-t border-border">
                          {Object.values(r).map((v, j) => <td key={j} className="px-3 py-1.5">{String(v ?? "")}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <button onClick={() => insert.mutate()} disabled={insert.isPending}
                className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-primary-foreground disabled:opacity-50">
                {insert.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Importar {rows.length} registros
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
