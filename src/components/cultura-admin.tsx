import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link, useNavigate } from "@tanstack/react-router";
import { Award, Cake, Loader2, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { deleteEmployee, listEmployees, updateEmployee } from "@/lib/employee.functions";
import { MONTHS, formatDate, parseISODate, tenureFrom, tenureLabel } from "@/lib/tenure";
import { Chip, InkButton, Kicker, KpiCard } from "@/components/paper";
import { UserAvatar } from "@/components/user-avatar";
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
import { cn } from "@/lib/utils";

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
  roleLine: string;
  unit: string;
  admission: string;
  /** Dias até o próximo aniversário. */
  days: number;
  birthMonth: number;
  years: number;
  totalMonths: number;
  anniversaryMonth: boolean;
};

type Row = Person & { metric: string; badge: string; badgeTone: "accent" | "soft" };
type Group = { title: string; count: string; rows: Row[] };

const ALL_DEPTS = "Todos os departamentos";
const ALL_UNITS = "Todas as unidades";

const MONTHS_SHORT = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

/** Mesma trilha do resto do painel: registro largo, colunas fixas, ações à direita. */
const GRID = "grid grid-cols-[1fr_150px_120px_190px_150px] items-center gap-4";

const SELECT =
  "h-[38px] rounded-full border-[1.5px] border-ink bg-surface px-3.5 text-[13px] font-bold " +
  "outline-none transition-colors hover:bg-accent-soft focus-visible:ring-1 focus-visible:ring-ring";

const FIELD =
  "w-full rounded-lg border-[1.5px] border-ink/25 bg-surface px-3 py-2 text-sm outline-none " +
  "transition-colors focus:border-ink focus-visible:ring-1 focus-visible:ring-ring";

/* ─── Datas específicas desta tela ──────────────────────────────────────────── */

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Dias até a próxima ocorrência de dia/mês. 0 = hoje. */
function daysUntil(iso: string): number {
  const t = startOfToday();
  const d = parseISODate(iso);
  let next = new Date(t.getFullYear(), d.getMonth(), d.getDate());
  if (next < t) next = new Date(t.getFullYear() + 1, d.getMonth(), d.getDate());
  return Math.round((next.getTime() - t.getTime()) / 86400000);
}

/** "3 de set" — o ano do nascimento nunca aparece. */
function birthdayLabel(iso: string): string {
  const d = parseISODate(iso);
  return `${d.getDate()} de ${MONTHS_SHORT[d.getMonth()]}`;
}

function monthOf(iso: string): number {
  return parseISODate(iso).getMonth();
}

/* ─── Tela ──────────────────────────────────────────────────────────────────── */

export function CulturaAdmin({ tab }: { tab: CulturaTab }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { term: rawTerm } = useAdminSearch();
  const doList = useServerFn(listEmployees);
  const doUpdate = useServerFn(updateEmployee);
  const doDelete = useServerFn(deleteEmployee);

  const [dept, setDept] = useState(ALL_DEPTS);
  const [unit, setUnit] = useState(ALL_UNITS);
  const [sortKey, setSortKey] = useState<SortKey>("metric");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [editing, setEditing] = useState<Employee | null>(null);
  const [confirming, setConfirming] = useState<Employee | null>(null);

  // Trocar de aba reseta a ordenação para a métrica da aba, ascendente.
  useEffect(() => {
    setSortKey("metric");
    setSortDir("asc");
  }, [tab]);

  const q = useQuery({ queryKey: ["employees"], queryFn: () => doList() });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["employees"] });

  const mUpdate = useMutation({
    mutationFn: (p: Parameters<typeof doUpdate>[0]["data"]) => doUpdate({ data: p }),
    onSuccess: () => {
      toast.success("Cadastro atualizado.");
      invalidate();
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mDelete = useMutation({
    mutationFn: (id: string) => doDelete({ data: { id } }),
    onSuccess: () => {
      toast.success("Colaborador removido do diretório.");
      invalidate();
      setConfirming(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const employees = useMemo(() => (q.data ?? []) as Employee[], [q.data]);

  /* Base da aba: ativos com a data que a aba precisa. */
  const base = useMemo<Person[]>(() => {
    const dateKey = tab === "birth" ? "birth_date" : "admission_date";
    const month = new Date().getMonth();
    return employees
      .filter((e) => e.active && e[dateKey])
      .map((e) => {
        const adm = e.admission_date;
        const t = adm ? tenureFrom(adm) : { years: 0, months: 0 };
        return {
          emp: e,
          roleLine: [e.job_title, e.department].filter(Boolean).join(" · "),
          unit: e.unit ?? "—",
          admission: adm ? formatDate(adm) : "—",
          days: e.birth_date ? daysUntil(e.birth_date) : Number.MAX_SAFE_INTEGER,
          birthMonth: e.birth_date ? monthOf(e.birth_date) : 0,
          years: t.years,
          totalMonths: t.years * 12 + t.months,
          anniversaryMonth: adm ? monthOf(adm) === month : false,
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

  const term = rawTerm.trim().toLowerCase();
  // Trocar de aba muda as opções disponíveis; um filtro órfão volta para "todos".
  const activeDept = deptOptions.includes(dept) ? dept : ALL_DEPTS;
  const activeUnit = unitOptions.includes(unit) ? unit : ALL_UNITS;
  const hasFilters = activeDept !== ALL_DEPTS || activeUnit !== ALL_UNITS;

  const rows = useMemo(() => {
    const filtered = base.filter(
      (p) =>
        (!term || p.emp.name.toLowerCase().includes(term)) &&
        (activeDept === ALL_DEPTS || p.emp.department === activeDept) &&
        (activeUnit === ALL_UNITS || p.emp.unit === activeUnit),
    );
    const sign = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sortKey === "name") return sign * a.emp.name.localeCompare(b.emp.name, "pt-BR");
      // Aniversário: asc = mais próximo primeiro. Tempo de casa: asc = mais antigo primeiro.
      return tab === "birth" ? sign * (a.days - b.days) : -sign * (a.totalMonths - b.totalMonths);
    });
  }, [base, term, activeDept, activeUnit, sortKey, sortDir, tab]);

  const groups = useMemo(
    () => buildGroups(rows, tab, sortKey, sortDir),
    [rows, tab, sortKey, sortDir],
  );
  const stats = useMemo(() => buildStats(employees), [employees]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function goToTab(next: CulturaTab) {
    if (next === tab) return;
    navigate({
      to: "/admin/recurso/$key",
      params: { key: next === "birth" ? "aniversariantes" : "tempo-de-casa" },
    });
  }

  const metricHeader = tab === "birth" ? "Aniversário" : "Tempo de casa";
  const nameMark = sortKey === "name" ? (sortDir === "asc" ? "↑" : "↓") : "↕";
  const metricMark = sortKey === "metric" ? (sortDir === "asc" ? "↑" : "↓") : "↕";

  return (
    <div>
      <header className="flex flex-wrap items-end justify-between gap-4 border-b-[1.5px] border-ink pb-5">
        <div>
          <Kicker>Cultura</Kicker>
          <h1 className="mt-3 text-[28px] leading-[1.02] font-black tracking-[-0.045em] sm:text-[34px] lg:text-[42px]">
            Aniversários e tempo de casa.
          </h1>
          <p className="mt-3 max-w-[60ch] text-[15.5px] leading-[1.7] text-muted-foreground">
            Colaboradores ativos, com cargo, unidade e datas. Cadastro individual e importação
            continuam na tela de{" "}
            <Link to="/admin/colaboradores" className="font-bold text-primary hover:underline">
              Colaboradores
            </Link>
            .
          </p>
        </div>
        <InkButton asChild variant="outline">
          <Link to="/admin/colaboradores">
            <Upload className="h-4 w-4" /> Importar planilha
          </Link>
        </InkButton>
      </header>

      {/* Indicadores — sempre sobre todos os ativos, nunca sobre o filtro. */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <KpiCard key={s.label} size="sm" label={s.label} value={s.value} note={s.note} />
        ))}
      </div>

      {/* Abas */}
      <div className="relative z-[2] mt-7 -mb-[1.5px] flex gap-2">
        <TabButton
          active={tab === "birth"}
          onClick={() => goToTab("birth")}
          icon={Cake}
          label="Aniversariantes"
        />
        <TabButton
          active={tab === "tenure"}
          onClick={() => goToTab("tenure")}
          icon={Award}
          label="Tempo de casa"
        />
      </div>

      <div className="overflow-hidden rounded-tr-lg rounded-b-lg border-[1.5px] border-ink bg-surface shadow-paper">
        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-3 border-b-[1.5px] border-ink px-[22px] py-3.5">
          <select
            value={activeDept}
            onChange={(e) => setDept(e.target.value)}
            aria-label="Filtrar por departamento"
            className={SELECT}
          >
            {deptOptions.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <select
            value={activeUnit}
            onChange={(e) => setUnit(e.target.value)}
            aria-label="Filtrar por unidade"
            className={SELECT}
          >
            {unitOptions.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
          {hasFilters && (
            <button
              type="button"
              onClick={() => {
                setDept(ALL_DEPTS);
                setUnit(ALL_UNITS);
              }}
              className="text-[13px] font-extrabold text-primary underline underline-offset-[3px]"
            >
              Limpar filtros
            </button>
          )}
          <span className="ml-auto text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase tabular-nums">
            {rows.length} {rows.length === 1 ? "pessoa" : "pessoas"}
          </span>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[860px]">
            {/* Cabeçalho de colunas */}
            <div className={cn(GRID, "bg-ink px-[22px] py-[13px]")}>
              <button
                type="button"
                onClick={() => toggleSort("name")}
                className="inline-flex items-center gap-1.5 text-left text-[10px] font-extrabold tracking-[0.16em] text-paper/75 uppercase"
              >
                Pessoa <span className="text-accent">{nameMark}</span>
              </button>
              <span className="text-[10px] font-extrabold tracking-[0.16em] text-paper/75 uppercase">
                Unidade
              </span>
              <span className="text-[10px] font-extrabold tracking-[0.16em] text-paper/75 uppercase">
                Admissão
              </span>
              <button
                type="button"
                onClick={() => toggleSort("metric")}
                className="inline-flex items-center gap-1.5 text-left text-[10px] font-extrabold tracking-[0.16em] text-paper/75 uppercase"
              >
                {metricHeader} <span className="text-accent">{metricMark}</span>
              </button>
              <span className="text-right text-[10px] font-extrabold tracking-[0.16em] text-paper/75 uppercase">
                Ações
              </span>
            </div>

            {q.isLoading ? (
              <SkeletonRows />
            ) : rows.length === 0 ? (
              <div className="px-[22px] py-10">
                <p className="text-xl font-black tracking-tight">
                  {base.length === 0
                    ? tab === "birth"
                      ? "Nenhum colaborador ativo com data de nascimento."
                      : "Nenhum colaborador ativo com data de admissão."
                    : "Nenhum resultado para esses filtros."}
                </p>
                <p className="mt-2 text-[15px] leading-[1.65] text-muted-foreground">
                  {base.length === 0
                    ? "Cadastre ou importe as datas na tela de Colaboradores."
                    : "Tente outro nome, ou limpe os filtros para ver o time inteiro."}
                </p>
              </div>
            ) : (
              groups.map((g) => (
                <div key={g.title || "todos"}>
                  {g.title && (
                    <div className="flex items-center gap-2.5 border-t border-border bg-surface-muted px-[22px] py-2.5">
                      <span className="text-[10px] font-extrabold tracking-[0.18em] uppercase">
                        {g.title}
                      </span>
                      <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                      <span className="text-[11px] text-muted-foreground tabular-nums">{g.count}</span>
                    </div>
                  )}
                  {g.rows.map((r) => (
                    <div key={r.emp.id} className={cn(GRID, "border-t border-border px-[22px] py-4")}>
                      <div className="flex min-w-0 items-center gap-3">
                        <UserAvatar name={r.emp.name} photoUrl={r.emp.photo_url} size={40} />
                        <div className="min-w-0">
                          <p className="truncate text-[16.5px] font-extrabold tracking-[-0.02em]">
                            {r.emp.name}
                          </p>
                          {r.roleLine && (
                            <p className="truncate text-xs text-muted-foreground">{r.roleLine}</p>
                          )}
                        </div>
                      </div>
                      <span className="truncate text-[13px] font-bold text-muted-foreground">
                        {r.unit}
                      </span>
                      <span className="text-[13px] font-bold text-muted-foreground tabular-nums">
                        {r.admission}
                      </span>
                      <span className="flex min-w-0 flex-wrap items-center gap-2">
                        <span className="text-[13.5px] font-bold tabular-nums">{r.metric}</span>
                        {r.badge && <Chip tone={r.badgeTone}>{r.badge}</Chip>}
                      </span>
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setEditing(r.emp)}
                          className="text-[11px] font-extrabold tracking-[0.1em] text-ink uppercase hover:text-primary"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirming(r.emp)}
                          aria-label={`Excluir ${r.emp.name}`}
                          className="grid h-7 w-7 place-items-center rounded-lg border border-border text-destructive transition hover:bg-destructive/10"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 border-t-[1.5px] border-ink px-[22px] py-3">
          <span className="text-[11.5px] text-muted-foreground">
            Uso interno. Nada de CPF, telefone pessoal, endereço, documentos ou dados bancários por
            aqui.
          </span>
          <span className="text-[11.5px] font-bold text-muted-foreground tabular-nums">
            {rows.length} de {base.length} colaboradores ativos
          </span>
        </div>
      </div>

      {editing && (
        <EditDialog
          employee={editing}
          loading={mUpdate.isPending}
          onClose={() => setEditing(null)}
          onSubmit={(v) => mUpdate.mutate({ id: editing.id, ...v })}
        />
      )}

      <AlertDialog open={confirming !== null} onOpenChange={(v) => !v && setConfirming(null)}>
        <AlertDialogContent className="border-[1.5px] border-ink bg-paper shadow-elevated">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[22px] font-black tracking-[-0.03em]">
              Excluir “{confirming?.name}”?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[15px] leading-[1.65]">
              Sai do diretório junto com cargo, unidade e datas, e não dá pra desfazer. Para tirar
              alguém das listas sem apagar o cadastro, desative o colaborador em Colaboradores.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Manter</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirming && mDelete.mutate(confirming.id)}
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

/* ─── Agrupamento e indicadores ─────────────────────────────────────────────── */

function toRow(p: Person, tab: CulturaTab): Row {
  if (tab === "birth") {
    const badge = p.days === 0 ? "Hoje" : p.days <= 7 ? `em ${p.days} dias` : "";
    return {
      ...p,
      metric: p.emp.birth_date ? birthdayLabel(p.emp.birth_date) : "—",
      badge,
      badgeTone: p.days === 0 ? "accent" : "soft",
    };
  }
  const milestone = p.years >= 5 && p.years % 5 === 0 && p.anniversaryMonth;
  return {
    ...p,
    metric: p.emp.admission_date ? tenureLabel(p.emp.admission_date, "") : "—",
    badge: milestone ? `${p.years} anos este mês` : p.anniversaryMonth ? "aniversário WG" : "",
    badgeTone: milestone ? "accent" : "soft",
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

function plural(n: number) {
  return `${n} ${n === 1 ? "pessoa" : "pessoas"}`;
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
    const current = new Date().getMonth();
    return [...byMonth.entries()].map(([m, list]) => ({
      title: MONTHS[m] + (m === current ? " · este mês" : ""),
      count: plural(list.length),
      rows: list.map((p) => toRow(p, tab)),
    }));
  }

  // Ascendente = mais antigo primeiro, então as faixas começam em "20 anos ou mais".
  const order = sortDir === "asc" ? BUCKETS : [...BUCKETS].reverse();
  return order
    .map((b) => {
      const list = rows.filter((p) => bucketOf(p.years) === b);
      return { title: b.title, count: plural(list.length), rows: list.map((p) => toRow(p, tab)) };
    })
    .filter((g) => g.rows.length > 0);
}

type Stat = { label: string; value: string; note: string };

function buildStats(employees: Employee[]): Stat[] {
  const month = new Date().getMonth();
  const active = employees.filter((e) => e.active);
  const withBirth = active.filter((e) => e.birth_date);
  const withAdmission = active.filter((e) => e.admission_date);

  const birthThisMonth = withBirth.filter((e) => monthOf(e.birth_date!) === month);
  const next7 = withBirth.filter((e) => daysUntil(e.birth_date!) <= 7);

  const anniversaries = withAdmission.filter((e) => monthOf(e.admission_date!) === month);
  const milestones = anniversaries.filter((e) => {
    const y = tenureFrom(e.admission_date!).years;
    return y >= 5 && y % 5 === 0;
  });

  const avgYears = withAdmission.length
    ? withAdmission.reduce((s, e) => {
        const t = tenureFrom(e.admission_date!);
        return s + t.years * 12 + t.months;
      }, 0) /
      withAdmission.length /
      12
    : 0;

  return [
    {
      label: `Aniversariantes · ${MONTHS[month]}`,
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
      value: String(active.filter((e) => e.birth_date || e.admission_date).length),
      note: "com datas cadastradas",
    },
  ];
}

/* ─── Peças da interface ────────────────────────────────────────────────────── */

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
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
      className={cn(
        "inline-flex items-center gap-2 rounded-t-lg border-[1.5px] border-ink px-5 pt-[11px] pb-[13px] text-[13px] font-extrabold tracking-[-0.01em]",
        active ? "border-b-surface bg-surface" : "bg-ink/[0.06] hover:bg-accent-soft",
      )}
    >
      <Icon className="h-4 w-4" /> {label}
    </button>
  );
}

function SkeletonRows() {
  return (
    <div aria-busy="true" aria-label="Carregando colaboradores">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className={cn(GRID, "border-t border-border px-[22px] py-4")}>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 shrink-0 rounded-full bg-ink/10" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="h-4 w-44 max-w-full rounded bg-ink/10" />
              <div className="h-3 w-28 max-w-full rounded bg-ink/[0.07]" />
            </div>
          </div>
          <div className="h-3 w-24 rounded bg-ink/[0.07]" />
          <div className="h-3 w-20 rounded bg-ink/[0.07]" />
          <div className="h-4 w-28 rounded bg-ink/10" />
          <div className="h-7 w-20 justify-self-end rounded-lg bg-ink/[0.07]" />
        </div>
      ))}
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

function EditDialog({
  employee,
  loading,
  onClose,
  onSubmit,
}: {
  employee: Employee;
  loading: boolean;
  onClose: () => void;
  onSubmit: (v: EditValues) => void;
}) {
  const [name, setName] = useState(employee.name);
  const [jobTitle, setJobTitle] = useState(employee.job_title ?? "");
  const [department, setDepartment] = useState(employee.department ?? "");
  const [unit, setUnit] = useState(employee.unit ?? "");
  const [birthDate, setBirthDate] = useState(employee.birth_date ?? "");
  const [admissionDate, setAdmissionDate] = useState(employee.admission_date ?? "");

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
            <p className="text-[10px] font-extrabold tracking-[0.18em] text-primary uppercase">
              Cultura
            </p>
            <h2 className="mt-1 text-[22px] font-black tracking-[-0.03em]">Editar colaborador</h2>
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
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={FIELD}
              />
            </Field>
            <Field label="Cargo">
              <input
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                className={FIELD}
              />
            </Field>
            <Field label="Departamento">
              <input
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className={FIELD}
              />
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
              <input
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                className={FIELD}
              />
            </Field>
            <Field label="Data de admissão">
              <input
                type="date"
                value={admissionDate}
                onChange={(e) => setAdmissionDate(e.target.value)}
                className={FIELD}
              />
            </Field>
          </div>
          <p className="px-6 pb-4 text-xs text-muted-foreground">
            E-mail, telefone e acesso ao portal continuam em Colaboradores.
          </p>
          <div className="flex justify-end gap-2 border-t-[1.5px] border-ink px-6 py-4">
            <InkButton variant="outline" onClick={onClose}>
              Cancelar
            </InkButton>
            <InkButton type="submit" disabled={loading}>
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Salvar
            </InkButton>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 block text-[11px] font-extrabold tracking-[0.1em] text-muted-foreground uppercase">
        {label}
      </span>
      {children}
    </label>
  );
}
