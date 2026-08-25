import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listEmployees } from "@/lib/employee.functions";
import { ArrowDown, ArrowUp, ArrowUpDown, Loader2, Search } from "lucide-react";

type Employee = {
  id: string;
  name: string;
  job_title: string | null;
  department: string | null;
  birth_date: string | null;
  active: boolean;
  photo_url: string | null;
};

type SortKey = "name" | "date";
type SortDir = "asc" | "desc";

const MONTHS_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

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

function daysUntilBirthday(birthDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [, m, d] = birthDate.split("-");
  const month = parseInt(m, 10) - 1;
  const day = parseInt(d, 10);
  const thisYear = new Date(today.getFullYear(), month, day);
  if (thisYear >= today) return Math.floor((thisYear.getTime() - today.getTime()) / 86400000);
  const nextYear = new Date(today.getFullYear() + 1, month, day);
  return Math.floor((nextYear.getTime() - today.getTime()) / 86400000);
}

function formatBirthDate(birthDate: string): string {
  const [, m, d] = birthDate.split("-");
  return `${parseInt(d, 10)}/${MONTHS_SHORT[parseInt(m, 10) - 1]}`;
}

function CountdownBadge({ days }: { days: number }) {
  if (days === 0) return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-[#8FD152] text-black border border-black">Hoje</span>;
  if (days <= 7) return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-[#8FD152]/20 text-black border border-black/40">em {days}d</span>;
  if (days <= 30) return <span className="text-[11px] text-gray-700">em {days}d</span>;
  return null;
}

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (sortKey !== col) return <ArrowUpDown className="h-3.5 w-3.5 text-black/40" />;
  return sortDir === "asc"
    ? <ArrowUp className="h-3.5 w-3.5 text-[#2F8F4A]" />
    : <ArrowDown className="h-3.5 w-3.5 text-[#2F8F4A]" />;
}

export function AniversariantesAdmin() {
  const doList = useServerFn(listEmployees);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const q = useQuery({ queryKey: ["employees"], queryFn: () => doList() });

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  }

  const all = ((q.data ?? []) as Employee[]).filter(e => e.active && e.birth_date);
  const term = search.trim().toLowerCase();
  const filtered = term ? all.filter(e => e.name.toLowerCase().includes(term)) : all;

  const sorted = [...filtered].sort((a, b) => {
    const cmp = sortKey === "name"
      ? a.name.localeCompare(b.name, "pt-BR")
      : daysUntilBirthday(a.birth_date!) - daysUntilBirthday(b.birth_date!);
    return sortDir === "asc" ? cmp : -cmp;
  });

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#F5F2E9] -m-6 p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-black tracking-tight text-black">Aniversariantes</h1>
        <p className="text-sm text-gray-700">
          Colaboradores ativos ordenados pelo próximo aniversário.
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
                <th className="px-6 py-3 text-left">
                  <button
                    onClick={() => toggleSort("name")}
                    className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-black hover:text-black/70 transition-colors"
                  >
                    Nome <SortIcon col="name" sortKey={sortKey} sortDir={sortDir} />
                  </button>
                </th>
                <th className="px-6 py-3 text-left">
                  <button
                    onClick={() => toggleSort("date")}
                    className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-black hover:text-black/70 transition-colors"
                  >
                    Aniversário <SortIcon col="date" sortKey={sortKey} sortDir={sortDir} />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {q.isLoading && (
                <tr>
                  <td colSpan={2} className="px-6 py-10 text-center">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto text-[#2F8F4A]" />
                  </td>
                </tr>
              )}
              {!q.isLoading && sorted.length === 0 && (
                <tr>
                  <td colSpan={2} className="px-6 py-10 text-center text-gray-700 text-sm">
                    {all.length === 0
                      ? "Nenhum colaborador ativo com data de nascimento cadastrada."
                      : "Nenhum resultado para a busca."}
                  </td>
                </tr>
              )}
              {sorted.map(emp => {
                const days = daysUntilBirthday(emp.birth_date!);
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
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-black">{formatBirthDate(emp.birth_date!)}</span>
                        <CountdownBadge days={days} />
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
