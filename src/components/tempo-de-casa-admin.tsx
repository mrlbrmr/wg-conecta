import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listEmployees } from "@/lib/employee.functions";
import { ArrowDown, ArrowUp, Loader2, Search } from "lucide-react";

type Employee = {
  id: string;
  name: string;
  job_title: string | null;
  department: string | null;
  admission_date: string | null;
  active: boolean;
  photo_url: string | null;
};

type Tenure = { years: number; months: number; totalMonths: number; label: string };

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
  const base = "inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold";
  if (years < 1) return <span className={`${base} bg-white text-gray-700 border border-black/20`}>Menos de 1 ano</span>;
  const isMilestone = years > 0 && years % 5 === 0;
  const label = `${years} ano${years !== 1 ? "s" : ""}`;
  if (isMilestone) return <span className={`${base} bg-[#8FD152] text-black border border-black`}>{label}</span>;
  return <span className={`${base} bg-black/5 text-black border border-black/20`}>{label}</span>;
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

export function TempoDeCasaAdmin() {
  const doList = useServerFn(listEmployees);
  const [search, setSearch] = useState("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const q = useQuery({ queryKey: ["employees"], queryFn: () => doList() });

  const all = ((q.data ?? []) as Employee[]).filter(e => e.active && e.admission_date);
  const term = search.trim().toLowerCase();
  const filtered = term ? all.filter(e => e.name.toLowerCase().includes(term)) : all;

  const sorted = [...filtered].sort((a, b) => {
    const diff = calcTenure(a.admission_date!).totalMonths - calcTenure(b.admission_date!).totalMonths;
    return sortDir === "desc" ? -diff : diff;
  });

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#F5F2E9] -m-6 p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-black tracking-tight text-black">Tempo de Casa</h1>
        <p className="text-sm text-gray-700">
          Colaboradores ativos ordenados pelo tempo de empresa.
          Cadastros e importações são feitos na tela de{" "}
          <a href="/admin/colaboradores" className="text-black font-bold underline underline-offset-2">Colaboradores</a>.
        </p>
      </div>

      <div className="bg-white rounded-xl border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-black/20">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-black/40 pointer-events-none" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nome…"
              className="w-full rounded-lg border-2 border-black/20 bg-white pl-9 pr-4 py-2 text-sm text-black outline-none focus:border-black focus:ring-2 focus:ring-black/10"
            />
          </div>
          {all.length > 0 && (
            <span className="text-xs text-gray-700 ml-auto">
              {filtered.length} colaborador{filtered.length !== 1 ? "es" : ""}
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/20 bg-black/5">
                <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-black">
                  Nome
                </th>
                <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-black">
                  Admissão
                </th>
                <th className="px-6 py-3 text-left">
                  <button
                    onClick={() => setSortDir(d => d === "asc" ? "desc" : "asc")}
                    className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-black hover:text-black/70 transition-colors"
                  >
                    Tempo
                    {sortDir === "desc"
                      ? <ArrowDown className="h-3.5 w-3.5 text-[#2F8F4A]" />
                      : <ArrowUp className="h-3.5 w-3.5 text-[#2F8F4A]" />}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {q.isLoading && (
                <tr>
                  <td colSpan={3} className="px-6 py-10 text-center">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto text-[#2F8F4A]" />
                  </td>
                </tr>
              )}
              {!q.isLoading && sorted.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-6 py-10 text-center text-gray-700 text-sm">
                    {all.length === 0
                      ? "Nenhum colaborador ativo com data de admissão cadastrada."
                      : "Nenhum resultado para a busca."}
                  </td>
                </tr>
              )}
              {sorted.map(emp => {
                const tenure = calcTenure(emp.admission_date!);
                return (
                  <tr key={emp.id} className="border-b border-black/20 last:border-0 hover:bg-[#F5F2E9]/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {emp.photo_url ? (
                          <img src={emp.photo_url} alt={emp.name} className="h-8 w-8 shrink-0 rounded-full object-cover object-top" />
                        ) : (
                          <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${avatarColor(emp.name)}`}>
                            {initials(emp.name)}
                          </span>
                        )}
                        <div>
                          <div className="font-medium text-black">{emp.name}</div>
                          {(emp.job_title || emp.department) && (
                            <div className="text-xs text-gray-700">
                              {[emp.job_title, emp.department].filter(Boolean).join(" · ")}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {formatAdmissionDate(emp.admission_date!)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <TenureBadge years={tenure.years} />
                        {tenure.months > 0 && tenure.years > 0 && (
                          <span className="text-xs text-gray-700">e {tenure.months} {tenure.months !== 1 ? "meses" : "mês"}</span>
                        )}
                        {tenure.years === 0 && (
                          <span className="text-xs text-gray-700">{tenure.label}</span>
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
