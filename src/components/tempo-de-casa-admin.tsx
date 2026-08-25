import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listEmployees } from "@/lib/employee.functions";
import { ArrowDown, ArrowUp, Loader2, Search } from "lucide-react";

/* ─── Tipos ──────────────────────────────────────────────────────────────────── */

type Employee = {
  id: string;
  name: string;
  job_title: string | null;
  department: string | null;
  admission_date: string | null;
  active: boolean;
};

type Tenure = { years: number; months: number; totalMonths: number; label: string };

/* ─── Utilitários ────────────────────────────────────────────────────────────── */

function calcTenure(admissionDate: string): Tenure {
  const start = new Date(admissionDate + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let years = today.getFullYear() - start.getFullYear();
  let months = today.getMonth() - start.getMonth();
  if (today.getDate() < start.getDate()) months--;
  if (months < 0) { years--; months += 12; }

  const totalMonths = years * 12 + months;
  const parts: string[] = [];
  if (years > 0) parts.push(`${years} ano${years !== 1 ? "s" : ""}`);
  if (months > 0) parts.push(`${months} ${months !== 1 ? "meses" : "mês"}`);

  return {
    years,
    months,
    totalMonths,
    label: parts.length > 0 ? parts.join(" e ") : "Menos de 1 mês",
  };
}

function TenureBadge({ years }: { years: number }) {
  if (years < 1) return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-500">Menos de 1 ano</span>;
  if (years < 5) return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-100 text-blue-700">{years} ano{years !== 1 ? "s" : ""}</span>;
  if (years < 10) return <span className="chip-success text-[11px]">{years} anos</span>;
  if (years < 20) return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-purple-100 text-purple-700">{years} anos</span>;
  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-700">{years} anos</span>;
}

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

function formatAdmissionDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  return `${parseInt(d, 10).toString().padStart(2, "0")}/${parseInt(m, 10).toString().padStart(2, "0")}/${y}`;
}

/* ─── Componente (somente leitura) ───────────────────────────────────────────── */

export function TempoDeCasaAdmin() {
  const doList = useServerFn(listEmployees);

  const [search, setSearch] = useState("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const q = useQuery({
    queryKey: ["employees"],
    queryFn: () => doList(),
  });

  const all = ((q.data ?? []) as Employee[]).filter(e => e.active && e.admission_date);
  const term = search.trim().toLowerCase();
  const filtered = term ? all.filter(e => e.name.toLowerCase().includes(term)) : all;

  const sorted = [...filtered].sort((a, b) => {
    const diff = calcTenure(a.admission_date!).totalMonths - calcTenure(b.admission_date!).totalMonths;
    return sortDir === "desc" ? -diff : diff;
  });

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background -m-6 p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-black tracking-tight">Tempo de Casa</h1>
        <p className="text-sm text-muted-foreground">
          Colaboradores ativos ordenados pelo tempo de empresa.
          Cadastros e importações são feitos na tela de{" "}
          <a href="/admin/colaboradores" className="text-primary underline underline-offset-2">Colaboradores</a>.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Toolbar somente busca */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nome…"
              className="w-full rounded-lg border border-border bg-surface pl-9 pr-4 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
            />
          </div>
          {all.length > 0 && (
            <span className="text-xs text-muted-foreground ml-auto">
              {filtered.length} colaborador{filtered.length !== 1 ? "es" : ""}
            </span>
          )}
        </div>

        {/* Tabela somente leitura */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Nome
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Admissão
                </th>
                <th className="px-6 py-3 text-left">
                  <button
                    onClick={() => setSortDir(d => d === "asc" ? "desc" : "asc")}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-700 transition-colors"
                  >
                    Tempo
                    {sortDir === "desc"
                      ? <ArrowDown className="h-3.5 w-3.5 text-primary" />
                      : <ArrowUp className="h-3.5 w-3.5 text-primary" />}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {q.isLoading && (
                <tr>
                  <td colSpan={3} className="px-6 py-10 text-center">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto text-primary" />
                  </td>
                </tr>
              )}
              {!q.isLoading && sorted.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-6 py-10 text-center text-muted-foreground text-sm">
                    {all.length === 0
                      ? "Nenhum colaborador ativo com data de admissão cadastrada."
                      : "Nenhum resultado para a busca."}
                  </td>
                </tr>
              )}
              {sorted.map(emp => {
                const tenure = calcTenure(emp.admission_date!);
                return (
                  <tr key={emp.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${avatarColor(emp.name)}`}>
                          {initials(emp.name)}
                        </span>
                        <div>
                          <div className="font-medium text-slate-900">{emp.name}</div>
                          {(emp.job_title || emp.department) && (
                            <div className="text-xs text-muted-foreground">
                              {[emp.job_title, emp.department].filter(Boolean).join(" · ")}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500">
                      {formatAdmissionDate(emp.admission_date!)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <TenureBadge years={tenure.years} />
                        {tenure.months > 0 && tenure.years > 0 && (
                          <span className="text-xs text-muted-foreground">e {tenure.months} {tenure.months !== 1 ? "meses" : "mês"}</span>
                        )}
                        {tenure.years === 0 && (
                          <span className="text-xs text-muted-foreground">{tenure.label}</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
