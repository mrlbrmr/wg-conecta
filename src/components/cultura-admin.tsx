import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link, useNavigate } from "@tanstack/react-router";
import { Award, Cake, Loader2, Pencil, Search, Trash2, Upload, Users, X } from "lucide-react";
import { toast } from "sonner";
import { deleteEmployee, listEmployees, updateEmployee } from "@/lib/employee.functions";
import {
  MONTHS,
  birthdayLabel,
  calcTenure,
  daysUntilBirthday,
  formatDateBR,
  initials,
  isAnniversaryMonth,
  monthOf,
  tenureLabel,
  today,
  type Tenure,
} from "@/lib/tenure";

/* ─── Tipos ─────────────────────────────────────────────────────────────────── */

export type CulturaTab = "birth" | "tenure";
type SortKey = "name" | "metric";
type SortDir = "asc" | "desc";

type Employee = {
  id: string;
  name: string;
  job_title: string | null;
  department: string | null;
  unit: string | null;
  birth_date: string | null;
  admission_date: string | null;
  photo_url: string | null;
  active: boolean;
};

type Person = {
  emp: Employee;
  name: string;
  roleLine: string;
  unit: string;
  admission: string;
  /** Dias até o próximo aniversário — usado na aba de aniversários. */
  days: number;
  birthMonth: number;
  tenure: Tenure;
  anniversaryMonth: boolean;
};

type Row = Person & {
  metric: string;
  badge: string;
  badgeClass: string;
};

type Group = { title: string; count: string; rows: Row[] };

const ALL_DEPTS = "Todos os departamentos";
const ALL_UNITS = "Todas as unidades";

/* ─── Classes compartilhadas ────────────────────────────────────────────────── */

// Pessoa | Unidade | Admissão | Métrica | Ações — Unidade e Admissão colapsam
// para dentro da célula Pessoa abaixo de lg.
const GRID =
  "grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3 lg:gap-x-0 " +
  "lg:grid-cols-[minmax(240px,1fr)_168px_132px_200px_84px]";

const PILL =
  "h-[38px] rounded-full border-[1.5px] border-ink/25 bg-white text-[13px] text-ink " +
  "outline-none transition-colors focus:border-ink focus-visible:ring-1 focus-visible:ring-ring";

const FIELD =
  "w-full rounded-lg border-[1.5px] border-ink/25 bg-white px-3 py-2 text-sm text-ink " +
  "outline-none transition-colors focus:border-ink focus-visible:ring-1 focus-visible:ring-ring";

/* ─── Tela ──────────────────────────────────────────────────────────────────── */

export function CulturaAdmin({ tab }: { tab: CulturaTab }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const doList = useServerFn(listEmployees);
  const doUpdate = useServerFn(updateEmployee);
  const doDelete = useServerFn(deleteEmployee);

  const [search, setSearch] = useState("");
  const [dept, setDept] = useState(ALL_DEPTS);
  const [unit, setUnit] = useState(ALL_UNITS);
  const [sortKey, setSortKey] = useState<SortKey>("metric");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [editing, setEditing] = useState<Employee | null>(null);
  const [removing, setRemoving] = useState<Employee | null>(null);

  // Trocar de aba reseta a ordenação para a métrica da aba, ascendente.
  useEffect(() => {
    setSortKey("metric");
    setSortDir("asc");
  }, [tab]);

  const q = useQuery({ queryKey: ["employees"], queryFn: () => doList() });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["employees"] });

  const mUpdate = useMutation({
    mutationFn: (p: Parameters<typeof doUpdate>[0]["data"]) => doUpdate({ data: p }),
    onSuccess: () => { toast.success("Cadastro atualizado."); invalidate(); setEditing(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  const mDelete = useMutation({
    mutationFn: (id: string) => doDelete({ data: { id } }),
    onSuccess: () => { toast.success("Colaborador removido do diretório."); invalidate(); setRemoving(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  const employees = useMemo(() => (q.data ?? []) as Employee[], [q.data]);

  /* ── Base da aba: ativos com a data que a aba precisa ── */
  const base = useMemo<Person[]>(() => {
    const dateKey = tab === "birth" ? "birth_date" : "admission_date";
    return employees
      .filter((e) => e.active && e[dateKey])
      .map((e) => {
        const admission = e.admission_date;
        return {
          emp: e,
          name: e.name,
          roleLine: [e.job_title, e.department].filter(Boolean).join(" · "),
          unit: e.unit ?? "—",
          admission: admission ? formatDateBR(admission) : "—",
          days: e.birth_date ? daysUntilBirthday(e.birth_date) : Number.MAX_SAFE_INTEGER,
          birthMonth: e.birth_date ? monthOf(e.birth_date) : 0,
          tenure: admission ? calcTenure(admission) : { years: 0, months: 0, total: 0 },
          anniversaryMonth: admission ? isAnniversaryMonth(admission) : false,
        };
      });
  }, [employees, tab]);

  const deptOptions = useMemo(() => {
    const set = new Set(base.map((p) => p.emp.department).filter(Boolean) as string[]);
    return [ALL_DEPTS, ...[...set].sort((a, b) => a.localeCompare(b, "pt-BR"))];
  }, [base]);

  const unitOptions = useMemo(() => {
    const set = new Set(base.map((p) => p.emp.unit).filter(Boolean) as string[]);
    return [ALL_UNITS, ...[...set].sort((a, b) => a.localeCompare(b, "pt-BR"))];
  }, [base]);

  const term = search.trim().toLowerCase();
  // Trocar de aba muda as opções disponíveis; um filtro órfão volta para "todos".
  const activeDept = deptOptions.includes(dept) ? dept : ALL_DEPTS;
  const activeUnit = unitOptions.includes(unit) ? unit : ALL_UNITS;
  const hasFilters = term !== "" || activeDept !== ALL_DEPTS || activeUnit !== ALL_UNITS;

  const rows = useMemo(() => {
    const filtered = base.filter(
      (p) =>
        (!term || p.name.toLowerCase().includes(term)) &&
        (activeDept === ALL_DEPTS || p.emp.department === activeDept) &&
        (activeUnit === ALL_UNITS || p.emp.unit === activeUnit),
    );
    const sign = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sortKey === "name") return sign * a.name.localeCompare(b.name, "pt-BR");
      // Aniversário: asc = mais próximo primeiro. Tempo de casa: asc = mais antigo primeiro.
      return tab === "birth" ? sign * (a.days - b.days) : -sign * (a.tenure.total - b.tenure.total);
    });
  }, [base, term, activeDept, activeUnit, sortKey, sortDir, tab]);

  const groups = useMemo(() => buildGroups(rows, tab, sortKey, sortDir), [rows, tab, sortKey, sortDir]);
  const stats = useMemo(() => buildStats(employees), [employees]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }

  function goToTab(next: CulturaTab) {
    if (next === tab) return;
    navigate({
      to: "/admin/recurso/$key",
      params: { key: next === "birth" ? "aniversariantes" : "tempo-de-casa" },
    });
  }

  function clearFilters() {
    setSearch("");
    setDept(ALL_DEPTS);
    setUnit(ALL_UNITS);
  }

  const metricHeader = tab === "birth" ? "Aniversário" : "Tempo de casa";
  const nameMark = sortKey === "name" ? (sortDir === "asc" ? "↑" : "↓") : "↕";
  const metricMark = sortKey === "metric" ? (sortDir === "asc" ? "↑" : "↓") : "↕";

  return (
    <div
      className="-m-4 min-h-[calc(100vh-4rem)] bg-paper px-6 pt-10 pb-[72px] md:-m-8"
      style={{
        backgroundImage: "radial-gradient(oklch(0.18 0 0 / 0.035) 1px, transparent 1px)",
        backgroundSize: "22px 22px",
      }}
    >
      <div className="mx-auto max-w-6xl">
        {/* ── Cabeçalho ── */}
        <div className="mb-[22px] flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-[620px]">
            <div className="mb-2 text-[11px] font-extrabold tracking-[0.18em] text-primary uppercase">
              Painel · Cultura
            </div>
            <h1 className="mb-2 text-[40px] leading-[1.02] font-black tracking-[-0.04em] text-ink">
              Aniversários e tempo de casa.
            </h1>
            <p className="text-sm leading-relaxed text-pretty text-muted-foreground">
              Colaboradores ativos, com cargo, unidade e datas. Cadastro individual e importação
              continuam na tela de{" "}
              <Link to="/admin/colaboradores" className="font-bold text-primary hover:text-primary/80">
                Colaboradores
              </Link>
              .
            </p>
          </div>
          <Link
            to="/admin/colaboradores"
            className="inline-flex h-[42px] items-center gap-2 rounded-full border-[1.5px] border-ink bg-white px-[18px] text-[13px] font-extrabold text-ink shadow-paper transition-[transform,box-shadow] duration-[120ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-x-px hover:-translate-y-px hover:shadow-elevated"
          >
            <Upload className="h-4 w-4" /> Importar planilha
          </Link>
        </div>

        {/* ── Faixa de indicadores ── */}
        <div className="mb-[22px] grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3">
          {stats.map((s) => (
            <div key={s.label} className="rounded-lg border-[1.5px] border-ink bg-surface px-4 py-3.5 shadow-paper">
              <div className="text-[10px] font-extrabold tracking-[0.16em] text-muted-foreground uppercase">
                {s.label}
              </div>
              <div className="mt-1.5 flex items-baseline gap-2">
                <span className="text-[30px] font-black tracking-[-0.04em] text-ink tabular-nums">{s.value}</span>
                <span className="text-xs text-muted-foreground">{s.note}</span>
              </div>
            </div>
          ))}
        </div>

        {/* ── Abas ── */}
        <div className="relative z-[2] -mb-[1.5px] flex gap-2">
          <TabButton active={tab === "birth"} onClick={() => goToTab("birth")} icon={Cake} label="Aniversariantes" />
          <TabButton active={tab === "tenure"} onClick={() => goToTab("tenure")} icon={Award} label="Tempo de casa" />
        </div>

        {/* ── Cartão da tabela ── */}
        <div className="overflow-hidden rounded-tr-lg rounded-b-lg border-[1.5px] border-ink bg-surface shadow-paper">
          {/* Barra de filtros */}
          <div className="flex flex-wrap items-center gap-2.5 border-b-[1.5px] border-ink bg-white px-4 py-3.5">
            <div className="relative max-w-[340px] flex-[1_1_260px]">
              <Search className="pointer-events-none absolute top-[11px] left-3 h-4 w-4 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nome…"
                aria-label="Buscar por nome"
                className={`${PILL} w-full pr-3 pl-9`}
              />
            </div>
            <select
              value={activeDept}
              onChange={(e) => setDept(e.target.value)}
              aria-label="Filtrar por departamento"
              className={`${PILL} cursor-pointer px-3.5 font-semibold`}
            >
              {deptOptions.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            <select
              value={activeUnit}
              onChange={(e) => setUnit(e.target.value)}
              aria-label="Filtrar por unidade"
              className={`${PILL} cursor-pointer px-3.5 font-semibold`}
            >
              {unitOptions.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
            {hasFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="h-[38px] px-3.5 text-[13px] font-extrabold text-primary underline underline-offset-[3px]"
              >
                Limpar filtros
              </button>
            )}
            <span className="ml-auto text-xs font-bold text-muted-foreground tabular-nums">
              {plural(rows.length, "pessoa", "pessoas")}
            </span>
          </div>

          {/* Cabeçalho de colunas */}
          <div className={`${GRID} border-b-[1.5px] border-ink/20 bg-ink/5 px-[18px] py-2.5 text-[10px] font-extrabold tracking-[0.14em] text-muted-foreground uppercase`}>
            <button type="button" onClick={() => toggleSort("name")} className="inline-flex items-center gap-1.5 text-left">
              Pessoa <span className="text-primary">{nameMark}</span>
            </button>
            <span className="hidden lg:block">Unidade</span>
            <span className="hidden lg:block">Admissão</span>
            <button type="button" onClick={() => toggleSort("metric")} className="inline-flex items-center gap-1.5 text-left">
              {metricHeader} <span className="text-primary">{metricMark}</span>
            </button>
            <span className="text-right">Ações</span>
          </div>

          {/* Corpo */}
          {q.isLoading && <SkeletonRows />}

          {!q.isLoading && groups.map((g, gi) => (
            <div
              key={g.title || "todos"}
              className="animate-slide-up motion-reduce:animate-none"
              style={{ animationDelay: `${gi * 45}ms` }}
            >
              {g.title && (
                <div className="flex items-center gap-2.5 bg-ink px-[18px] py-2.5 text-paper">
                  <span className="text-[10px] font-extrabold tracking-[0.18em] uppercase">{g.title}</span>
                  <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                  <span className="text-[11px] text-paper/70 tabular-nums">{g.count}</span>
                </div>
              )}
              {g.rows.map((r) => (
                <div
                  key={r.emp.id}
                  className={`${GRID} border-b border-ink/[0.14] px-[18px] py-[11px] transition-colors duration-[120ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-[#F5F2E9]`}
                >
                  {/* Pessoa */}
                  <div className="flex min-w-0 items-center gap-3">
                    {r.emp.photo_url ? (
                      <img src={r.emp.photo_url} alt="" className="h-[38px] w-[38px] shrink-0 rounded-full object-cover object-top" />
                    ) : (
                      <span className="inline-flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full bg-ink text-xs font-black text-accent">
                        {initials(r.name)}
                      </span>
                    )}
                    <div className="min-w-0">
                      <div className="truncate text-sm font-extrabold tracking-[-0.015em] text-ink">{r.name}</div>
                      {r.roleLine && <div className="truncate text-xs text-muted-foreground">{r.roleLine}</div>}
                      <div className="truncate text-xs text-muted-foreground lg:hidden">
                        {r.unit} · admissão {r.admission}
                      </div>
                    </div>
                  </div>
                  <span className="hidden truncate text-[12.5px] text-muted-foreground lg:block">{r.unit}</span>
                  <span className="hidden text-[12.5px] text-muted-foreground tabular-nums lg:block">{r.admission}</span>
                  {/* Métrica */}
                  <span className="flex items-center gap-2">
                    <span className="text-[13.5px] font-bold text-ink tabular-nums">{r.metric}</span>
                    {r.badge && (
                      <span className={`inline-flex items-center rounded-full px-2 pt-0.5 pb-[3px] text-[10.5px] font-extrabold whitespace-nowrap text-ink ${r.badgeClass}`}>
                        {r.badge}
                      </span>
                    )}
                  </span>
                  {/* Ações */}
                  <span className="flex justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => setEditing(r.emp)}
                      title={`Editar ${r.name}`}
                      aria-label={`Editar ${r.name}`}
                      className="inline-flex h-[30px] w-[30px] items-center justify-center rounded-lg border-[1.5px] border-ink/25 bg-white text-ink transition-colors hover:border-ink hover:bg-accent"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setRemoving(r.emp)}
                      title={`Excluir ${r.name}`}
                      aria-label={`Excluir ${r.name}`}
                      className="inline-flex h-[30px] w-[30px] items-center justify-center rounded-lg border-[1.5px] border-ink/25 bg-white text-ink transition-colors hover:border-ink hover:bg-ink hover:text-paper"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </span>
                </div>
              ))}
            </div>
          ))}

          {!q.isLoading && rows.length === 0 && (
            <div className="px-6 py-14 text-center">
              <span className="mb-3.5 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-ink text-accent">
                <Users className="h-5 w-5" />
              </span>
              <div className="text-base font-black tracking-[-0.02em] text-ink">
                {base.length === 0
                  ? tab === "birth"
                    ? "Nenhum colaborador ativo com data de nascimento."
                    : "Nenhum colaborador ativo com data de admissão."
                  : "Nenhum resultado para esses filtros."}
              </div>
              <div className="mt-1 text-[13px] text-muted-foreground">
                {base.length === 0
                  ? "Cadastre ou importe as datas na tela de Colaboradores."
                  : "Tente outro nome, ou limpe os filtros para ver o time inteiro."}
              </div>
            </div>
          )}

          {/* Rodapé */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-t-[1.5px] border-ink bg-white px-[18px] py-3">
            <span className="text-[11.5px] text-muted-foreground">
              Uso interno. Nada de CPF, telefone pessoal, endereço, documentos ou dados bancários por aqui.
            </span>
            <span className="text-[11.5px] font-bold text-muted-foreground tabular-nums">
              {rows.length} de {base.length} colaboradores ativos
            </span>
          </div>
        </div>
      </div>

      {editing && (
        <EditModal
          employee={editing}
          loading={mUpdate.isPending}
          onCancel={() => setEditing(null)}
          onSubmit={(v) => mUpdate.mutate({ id: editing.id, ...v })}
        />
      )}

      {removing && (
        <ConfirmModal
          title="Excluir colaborador"
          loading={mDelete.isPending}
          onCancel={() => setRemoving(null)}
          onConfirm={() => mDelete.mutate(removing.id)}
        >
          <p className="text-sm text-muted-foreground">
            <strong className="font-bold text-ink">{removing.name}</strong> sai do diretório junto com
            cargo, unidade e datas. A ação não tem volta — para tirar alguém das listas sem apagar o
            cadastro, desative o colaborador em Colaboradores.
          </p>
        </ConfirmModal>
      )}
    </div>
  );
}

/* ─── Agrupamento e indicadores ─────────────────────────────────────────────── */

const BADGE_STRONG = "bg-accent border border-ink";
const BADGE_SOFT = "bg-accent/25 border border-primary/45";

function toRow(p: Person, tab: CulturaTab): Row {
  if (tab === "birth") {
    const badge = p.days === 0 ? "Hoje" : p.days <= 7 ? `em ${p.days} dias` : "";
    return {
      ...p,
      metric: p.emp.birth_date ? birthdayLabel(p.emp.birth_date) : "—",
      badge,
      badgeClass: p.days === 0 ? BADGE_STRONG : BADGE_SOFT,
    };
  }
  const milestone = p.tenure.years >= 5 && p.tenure.years % 5 === 0 && p.anniversaryMonth;
  return {
    ...p,
    metric: tenureLabel(p.tenure),
    badge: milestone ? `${p.tenure.years} anos este mês` : p.anniversaryMonth ? "aniversário WG" : "",
    badgeClass: milestone ? BADGE_STRONG : BADGE_SOFT,
  };
}

const BUCKETS: { title: string; min: number }[] = [
  { title: "20 anos ou mais", min: 20 },
  { title: "de 10 a 19 anos", min: 10 },
  { title: "de 5 a 9 anos", min: 5 },
  { title: "de 1 a 4 anos", min: 1 },
  { title: "menos de 1 ano", min: 0 },
];

function bucketOf(years: number) {
  return BUCKETS.find((b) => years >= b.min)!;
}

function buildGroups(rows: Person[], tab: CulturaTab, sortKey: SortKey, sortDir: SortDir): Group[] {
  // Ordenar por nome desliga o agrupamento e mostra uma lista contínua.
  if (sortKey !== "metric") {
    return [{ title: "", count: "", rows: rows.map((p) => toRow(p, tab)) }];
  }

  if (tab === "birth") {
    const byMonth = new Map<number, Person[]>();
    for (const p of rows) {
      const list = byMonth.get(p.birthMonth) ?? [];
      list.push(p);
      byMonth.set(p.birthMonth, list);
    }
    const current = today().getMonth();
    return [...byMonth.entries()].map(([m, list]) => ({
      title: MONTHS[m] + (m === current ? " · este mês" : ""),
      count: plural(list.length, "pessoa", "pessoas"),
      rows: list.map((p) => toRow(p, tab)),
    }));
  }

  const order = sortDir === "asc" ? BUCKETS : [...BUCKETS].reverse();
  return order
    .map((b) => {
      const list = rows.filter((p) => bucketOf(p.tenure.years) === b);
      return {
        title: b.title,
        count: plural(list.length, "pessoa", "pessoas"),
        rows: list.map((p) => toRow(p, tab)),
      };
    })
    .filter((g) => g.rows.length > 0);
}

type Stat = { label: string; value: string; note: string };

function buildStats(employees: Employee[]): Stat[] {
  const t = today();
  const active = employees.filter((e) => e.active);
  const withBirth = active.filter((e) => e.birth_date);
  const withAdmission = active.filter((e) => e.admission_date);

  const birthThisMonth = withBirth.filter((e) => monthOf(e.birth_date!) === t.getMonth());
  const next7 = withBirth.filter((e) => daysUntilBirthday(e.birth_date!) <= 7);

  const anniversaries = withAdmission.filter((e) => isAnniversaryMonth(e.admission_date!));
  const milestones = anniversaries.filter((e) => {
    const y = calcTenure(e.admission_date!).years;
    return y >= 5 && y % 5 === 0;
  });

  const avgYears = withAdmission.length
    ? withAdmission.reduce((s, e) => s + calcTenure(e.admission_date!).total, 0) / withAdmission.length / 12
    : 0;

  const withAnyDate = active.filter((e) => e.birth_date || e.admission_date);

  return [
    {
      label: `Aniversariantes · ${MONTHS[t.getMonth()]}`,
      value: String(birthThisMonth.length),
      note: `${next7.length} nos próximos 7 dias`,
    },
    {
      label: "Aniversários de casa",
      value: String(anniversaries.length),
      note: `${milestones.length} marco(s) de 5 anos`,
    },
    {
      label: "Tempo médio de casa",
      value: `${avgYears.toFixed(1).replace(".", ",")} anos`,
      note: `entre ${withAdmission.length} ativos`,
    },
    {
      label: "Colaboradores ativos",
      value: String(withAnyDate.length),
      note: "com datas cadastradas",
    },
  ];
}

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

/* ─── Peças da interface ────────────────────────────────────────────────────── */

function TabButton({
  active, onClick, icon: Icon, label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Cake;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`inline-flex items-center gap-2 rounded-t-lg border-[1.5px] border-ink px-5 pt-[11px] pb-[13px] text-[13px] font-extrabold tracking-[-0.01em] text-ink ${
        active ? "border-b-surface bg-surface" : "bg-ink/[0.06]"
      }`}
    >
      <Icon className="h-4 w-4" /> {label}
    </button>
  );
}

function SkeletonRows() {
  return (
    <div aria-busy="true" aria-label="Carregando colaboradores">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className={`${GRID} border-b border-ink/[0.14] px-[18px] py-[11px]`}>
          <div className="flex items-center gap-3">
            <div className="h-[38px] w-[38px] shrink-0 rounded-full bg-ink/10" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="h-3.5 w-40 max-w-full rounded bg-ink/10" />
              <div className="h-3 w-28 max-w-full rounded bg-ink/[0.07]" />
            </div>
          </div>
          <div className="hidden h-3 w-24 rounded bg-ink/[0.07] lg:block" />
          <div className="hidden h-3 w-20 rounded bg-ink/[0.07] lg:block" />
          <div className="h-3.5 w-24 rounded bg-ink/10" />
          <div className="h-[30px] w-[66px] justify-self-end rounded-lg bg-ink/[0.07]" />
        </div>
      ))}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 backdrop-blur-sm md:items-center md:p-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[95vh] w-full max-w-lg flex-col rounded-t-2xl border-[1.5px] border-ink bg-surface shadow-elevated md:rounded-2xl"
      >
        <div className="flex items-center justify-between border-b-[1.5px] border-ink px-6 py-4">
          <h2 className="text-base font-black tracking-[-0.02em] text-ink">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-ink/5 hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

type EditValues = {
  name: string;
  job_title: string | null;
  department: string | null;
  unit: string | null;
  birth_date: string | null;
  admission_date: string | null;
};

function EditModal({
  employee, loading, onCancel, onSubmit,
}: {
  employee: Employee;
  loading: boolean;
  onCancel: () => void;
  onSubmit: (v: EditValues) => void;
}) {
  const [name, setName] = useState(employee.name);
  const [jobTitle, setJobTitle] = useState(employee.job_title ?? "");
  const [department, setDepartment] = useState(employee.department ?? "");
  const [unit, setUnit] = useState(employee.unit ?? "");
  const [birthDate, setBirthDate] = useState(employee.birth_date ?? "");
  const [admissionDate, setAdmissionDate] = useState(employee.admission_date ?? "");

  return (
    <Modal title={`Editar — ${employee.name}`} onClose={onCancel}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({
            name,
            job_title: jobTitle || null,
            department: department || null,
            unit: unit || null,
            birth_date: birthDate || null,
            admission_date: admissionDate || null,
          });
        }}
      >
        <div className="grid grid-cols-1 gap-4 px-6 pt-5 pb-2 md:grid-cols-2">
          <Field label="Nome completo" className="md:col-span-2">
            <input required value={name} onChange={(e) => setName(e.target.value)} className={FIELD} />
          </Field>
          <Field label="Cargo">
            <input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} className={FIELD} />
          </Field>
          <Field label="Departamento">
            <input value={department} onChange={(e) => setDepartment(e.target.value)} className={FIELD} />
          </Field>
          <Field label="Unidade">
            <input
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="Matriz SJP, CD Sorocaba…"
              className={FIELD}
            />
          </Field>
          <Field label="Data de nascimento">
            <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className={FIELD} />
          </Field>
          <Field label="Data de admissão">
            <input type="date" value={admissionDate} onChange={(e) => setAdmissionDate(e.target.value)} className={FIELD} />
          </Field>
        </div>
        <p className="px-6 pb-4 text-xs text-muted-foreground">
          E-mail, telefone e acesso ao portal continuam em Colaboradores.
        </p>
        <div className="flex justify-end gap-2 border-t-[1.5px] border-ink px-6 py-4">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border-[1.5px] border-ink/25 bg-white px-4 py-2 text-[13px] font-extrabold text-ink hover:border-ink"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-full border-[1.5px] border-ink bg-accent px-4 py-2 text-[13px] font-extrabold text-ink shadow-paper disabled:opacity-60"
          >
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Salvar
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ConfirmModal({
  title, children, loading, onCancel, onConfirm,
}: {
  title: string;
  children: React.ReactNode;
  loading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal title={title} onClose={onCancel}>
      <div className="px-6 py-5">{children}</div>
      <div className="flex justify-end gap-2 border-t-[1.5px] border-ink px-6 py-4">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border-[1.5px] border-ink/25 bg-white px-4 py-2 text-[13px] font-extrabold text-ink hover:border-ink"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-full border-[1.5px] border-ink bg-destructive px-4 py-2 text-[13px] font-extrabold text-destructive-foreground shadow-paper disabled:opacity-60"
        >
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Excluir
        </button>
      </div>
    </Modal>
  );
}

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className="mb-1.5 block text-[11px] font-extrabold tracking-[0.1em] text-muted-foreground uppercase">
        {label}
      </span>
      {children}
    </label>
  );
}
