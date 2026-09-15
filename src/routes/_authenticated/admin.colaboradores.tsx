import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  IdCard,
  ImagePlus,
  KeyRound,
  Loader2,
  MailCheck,
  MoreHorizontal,
  Pencil,
  RefreshCcw,
  ShieldOff,
  Trash2,
  Upload,
  UserPlus,
  X,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  addEmployee,
  bulkDeleteEmployees,
  bulkImportEmployees,
  deleteEmployee,
  inviteExistingEmployee,
  listEmployees,
  resendEmployeeInvite,
  triggerEmployeePasswordReset,
  updateEmployee,
  updateEmployeePhotoUrl,
} from "@/lib/employee.functions";
import { listCpfLogins, resetCpfPassword, setCpfAccess } from "@/lib/cpf-access.functions";
import { hiddenCpf, isValidCpf, maskCpf } from "@/lib/cpf";
import { supabase } from "@/integrations/supabase/client";
import { fmtDate } from "@/lib/employee-ui";
import { formatDate } from "@/lib/tenure";
import { fieldLabel, fieldsToFill, matchByName } from "@/lib/employee-match";
import { DEPARTMENTS, UNITS, normalizeDepartment, normalizeUnit } from "@/lib/org";
import { parseEmployeeWorkbook, type ImportRow } from "@/lib/employee-import";
import { Chip, InkButton, Kicker, KpiCard } from "@/components/paper";
import { UserAvatar } from "@/components/user-avatar";
import { useAdminSearch } from "@/components/admin-search";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Employee = {
  id: string;
  auth_user_id: string | null;
  name: string;
  email: string | null;
  department: string | null;
  job_title: string | null;
  unit: string | null;
  phone: string | null;
  birth_date: string | null;
  hide_birthday: boolean;
  admission_date: string | null;
  manager_id: string | null;
  co_manager_id: string | null;
  active: boolean;
  invited_at: string | null;
  created_at: string;
  photo_url: string | null;
};


type StatusFilter = "todos" | "ativos" | "inativos";
type SortKey = "name" | "manager" | "admission";
type SortDir = "asc" | "desc";

/** Linha da tabela já resolvida: o gestor vem por id e precisa virar nome. */
type Row = Employee & { managerName: string; coManagerName: string };

const ALL_DEPTS = "Todos os departamentos";
const ALL_UNITS = "Todas as unidades";
const ALL_MANAGERS = "Todos os gestores";
const NO_MANAGER = "__sem_gestor__";

/** Mesma trilha da tela de Cultura: registro largo, colunas fixas, ações à direita. */
const GRID =
  "grid grid-cols-[26px_1fr_180px_170px_105px_112px_96px_104px] items-center gap-x-4 gap-y-0";

const SELECT =
  "h-[38px] rounded-full border-[1.5px] border-ink bg-surface px-3.5 text-[13px] font-bold " +
  "outline-none transition-colors hover:bg-accent-soft focus-visible:ring-1 focus-visible:ring-ring";

const COL_HEAD = "text-[10px] font-extrabold tracking-[0.16em] text-paper/75 uppercase";

/** Caixa de seleção no traço da casa: borda de tinta, marcado em verde elétrico. */
const CHECKBOX =
  "h-[17px] w-[17px] rounded-[5px] border-[1.5px] border-ink data-[state=checked]:border-ink " +
  "data-[state=checked]:bg-accent data-[state=checked]:text-ink " +
  "data-[state=indeterminate]:bg-accent data-[state=indeterminate]:text-ink";

export const Route = createFileRoute("/_authenticated/admin/colaboradores")({
  head: () => ({ meta: [{ title: "Colaboradores — Portal WG" }] }),
  component: ColaboradoresPage,
});

function ColaboradoresPage() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["employees"] });
  const { term: rawTerm } = useAdminSearch();

  const doList = useServerFn(listEmployees);
  const doAdd = useServerFn(addEmployee);
  const doInviteExisting = useServerFn(inviteExistingEmployee);
  const doResend = useServerFn(resendEmployeeInvite);
  const doReset = useServerFn(triggerEmployeePasswordReset);
  const doUpdate = useServerFn(updateEmployee);
  const doBulk = useServerFn(bulkImportEmployees);
  const doUpdatePhoto = useServerFn(updateEmployeePhotoUrl);
  const doDelete = useServerFn(deleteEmployee);
  const doBulkDelete = useServerFn(bulkDeleteEmployees);

  const doListCpf = useServerFn(listCpfLogins);
  const doSetCpf = useServerFn(setCpfAccess);
  const doResetCpf = useServerFn(resetCpfPassword);

  const q = useQuery({ queryKey: ["employees"], queryFn: () => doList() });
  /** Quem entra por CPF → dois últimos dígitos. */
  const cpfQ = useQuery({ queryKey: ["employee-cpf-logins"], queryFn: () => doListCpf() });
  const cpfLast2 = useMemo(
    () => new Map((cpfQ.data ?? []).map((l) => [l.employee_id, l.cpf_last2])),
    [cpfQ.data],
  );

  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [invitingExisting, setInvitingExisting] = useState<Employee | null>(null);
  /** Colaborador cujo CPF de acesso está sendo corrigido. */
  const [changingCpf, setChangingCpf] = useState<Employee | null>(null);
  /** Senha provisória recém-gerada — aparece uma vez, para o G&G entregar. */
  const [issued, setIssued] = useState<{ name: string; cpfLast2: string; password: string } | null>(
    null,
  );
  const [importing, setImporting] = useState(false);
  const [importingPhotos, setImportingPhotos] = useState(false);
  /** Ids marcados na tabela. Sobrevive à troca de filtro; some ao excluir. */
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmingOne, setConfirmingOne] = useState<Employee | null>(null);
  const [confirmingMany, setConfirmingMany] = useState(false);

  const [dept, setDept] = useState(ALL_DEPTS);
  const [unit, setUnit] = useState(ALL_UNITS);
  const [manager, setManager] = useState(ALL_MANAGERS);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todos");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const mAdd = useMutation({
    mutationFn: (p: Parameters<typeof doAdd>[0]["data"]) => doAdd({ data: p }),
    onSuccess: () => { toast.success("Colaborador cadastrado."); invalidate(); setAdding(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  const mInviteExisting = useMutation({
    mutationFn: (p: { employeeId: string; email: string }) => doInviteExisting({ data: p }),
    onSuccess: (res) => {
      const r = res as { linked?: boolean };
      toast.success(r?.linked ? "Conta vinculada ao portal." : "Convite enviado.");
      invalidate();
      setInvitingExisting(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mSetCpf = useMutation({
    mutationFn: (p: { employee: Employee; cpf: string }) =>
      doSetCpf({ data: { employeeId: p.employee.id, cpf: p.cpf } }),
    onSuccess: (res, p) => {
      setIssued({ name: p.employee.name, cpfLast2: res.cpfLast2, password: res.password });
      setInvitingExisting(null);
      setChangingCpf(null);
      invalidate();
      qc.invalidateQueries({ queryKey: ["employee-cpf-logins"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mResetCpf = useMutation({
    mutationFn: (employee: Employee) => doResetCpf({ data: { employeeId: employee.id } }),
    onSuccess: (res, employee) =>
      setIssued({ name: employee.name, cpfLast2: res.cpfLast2, password: res.password }),
    onError: (e: Error) => toast.error(e.message),
  });

  const mResend = useMutation({
    mutationFn: (employeeId: string) => doResend({ data: { employeeId } }),
    onSuccess: () => toast.success("Convite reenviado."),
    onError: (e: Error) => toast.error(e.message),
  });

  const mReset = useMutation({
    mutationFn: (email: string) => doReset({ data: { email } }),
    onSuccess: () => toast.success("E-mail de redefinição de senha enviado."),
    onError: (e: Error) => toast.error(e.message),
  });

  const mUpdate = useMutation({
    mutationFn: (p: Parameters<typeof doUpdate>[0]["data"]) => doUpdate({ data: p }),
    onSuccess: () => { toast.success("Atualizado."); invalidate(); setEditing(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  const mToggle = useMutation({
    mutationFn: (emp: Employee) => doUpdate({ data: { id: emp.id, active: !emp.active } }),
    onSuccess: () => { toast.success("Status atualizado."); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const mBulk = useMutation({
    mutationFn: (rows: ImportRow[]) => doBulk({ data: { employees: rows } }),
    onSuccess: (res) => {
      const r = res as { completed: number; inserted: number; skipped: number };
      const parts: string[] = [];
      if (r.inserted > 0) parts.push(`${r.inserted} cadastrado${r.inserted !== 1 ? "s" : ""}`);
      if (r.completed > 0) parts.push(`${r.completed} completado${r.completed !== 1 ? "s" : ""}`);
      if (r.skipped > 0) parts.push(`${r.skipped} sem nada a completar`);
      toast.success(parts.length > 0 ? parts.join(" · ") + "." : "Nenhum registro processado.");
      invalidate();
      setImporting(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mDelete = useMutation({
    mutationFn: (id: string) => doDelete({ data: { id } }),
    onSuccess: (_res, id) => {
      toast.success("Colaborador removido do diretório.");
      deselect([id]);
      invalidate();
      setConfirmingOne(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mBulkDelete = useMutation({
    mutationFn: (ids: string[]) => doBulkDelete({ data: { ids } }),
    onSuccess: (res, ids) => {
      const n = (res as { deleted: number }).deleted;
      toast.success(
        `${n} colaborador${n !== 1 ? "es" : ""} removido${n !== 1 ? "s" : ""} do diretório.`,
      );
      deselect(ids);
      invalidate();
      setConfirmingMany(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const employees = useMemo(() => (q.data ?? []) as Employee[], [q.data]);

  const nameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of employees) m.set(e.id, e.name);
    return m;
  }, [employees]);

  /** Base da tela: todo mundo, com o gestor já resolvido em nome. */
  const base = useMemo<Row[]>(
    () =>
      employees.map((e) => ({
        ...e,
        managerName: (e.manager_id && nameById.get(e.manager_id)) || "",
        coManagerName: (e.co_manager_id && nameById.get(e.co_manager_id)) || "",
      })),
    [employees, nameById],
  );

  const deptOptions = useMemo(() => {
    const set = new Set(employees.map((e) => e.department).filter(Boolean) as string[]);
    return [ALL_DEPTS, ...[...set].sort((a, b) => a.localeCompare(b, "pt-BR"))];
  }, [employees]);

  const unitOptions = useMemo(() => {
    const set = new Set(employees.map((e) => e.unit).filter(Boolean) as string[]);
    return [ALL_UNITS, ...[...set].sort((a, b) => a.localeCompare(b, "pt-BR"))];
  }, [employees]);

  /** Só quem de fato lidera alguém entra no filtro, mais a opção "sem gestor". */
  const managerOptions = useMemo(() => {
    const ids = new Set<string>();
    for (const e of employees) {
      if (e.manager_id) ids.add(e.manager_id);
      if (e.co_manager_id) ids.add(e.co_manager_id);
    }
    const named = [...ids]
      .map((id) => ({ id, name: nameById.get(id) ?? "—" }))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    return [
      { id: ALL_MANAGERS, name: ALL_MANAGERS },
      { id: NO_MANAGER, name: "Sem gestor definido" },
      ...named,
    ];
  }, [employees, nameById]);

  const term = rawTerm.trim().toLowerCase();
  // A base muda com a importação; um filtro órfão volta para "todos".
  const activeDept = deptOptions.includes(dept) ? dept : ALL_DEPTS;
  const activeUnit = unitOptions.includes(unit) ? unit : ALL_UNITS;
  const activeManager = managerOptions.some((m) => m.id === manager) ? manager : ALL_MANAGERS;
  const hasFilters =
    activeDept !== ALL_DEPTS ||
    activeUnit !== ALL_UNITS ||
    activeManager !== ALL_MANAGERS ||
    statusFilter !== "todos";

  const rows = useMemo(() => {
    const filtered = base.filter((e) => {
      if (statusFilter === "ativos" && !e.active) return false;
      if (statusFilter === "inativos" && e.active) return false;
      if (activeDept !== ALL_DEPTS && e.department !== activeDept) return false;
      if (activeUnit !== ALL_UNITS && e.unit !== activeUnit) return false;
      if (activeManager === NO_MANAGER && (e.manager_id || e.co_manager_id)) return false;
      if (
        activeManager !== ALL_MANAGERS &&
        activeManager !== NO_MANAGER &&
        e.manager_id !== activeManager &&
        e.co_manager_id !== activeManager
      ) {
        return false;
      }
      if (!term) return true;
      return (
        e.name.toLowerCase().includes(term) ||
        (e.email?.toLowerCase().includes(term) ?? false) ||
        (e.department?.toLowerCase().includes(term) ?? false) ||
        (e.unit?.toLowerCase().includes(term) ?? false) ||
        (e.job_title?.toLowerCase().includes(term) ?? false) ||
        e.managerName.toLowerCase().includes(term)
      );
    });

    const sign = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sortKey === "manager") {
        // Quem não tem gestor fica no fim nos dois sentidos.
        if (!a.managerName !== !b.managerName) return a.managerName ? -1 : 1;
        const byManager = a.managerName.localeCompare(b.managerName, "pt-BR");
        if (byManager !== 0) return sign * byManager;
        return a.name.localeCompare(b.name, "pt-BR");
      }
      if (sortKey === "admission") {
        // Sem admissão também vai para o fim. Ascendente = mais antigo primeiro.
        if (!a.admission_date !== !b.admission_date) return a.admission_date ? -1 : 1;
        const byDate = (a.admission_date ?? "").localeCompare(b.admission_date ?? "");
        if (byDate !== 0) return sign * byDate;
        return a.name.localeCompare(b.name, "pt-BR");
      }
      return sign * a.name.localeCompare(b.name, "pt-BR");
    });
  }, [base, term, activeDept, activeUnit, activeManager, statusFilter, sortKey, sortDir]);

  const counts = useMemo(() => {
    const active = employees.filter((e) => e.active);
    return {
      todos: employees.length,
      ativos: active.length,
      inativos: employees.length - active.length,
      comAcesso: active.filter((e) => e.auth_user_id).length,
      semGestor: active.filter((e) => !e.manager_id && !e.co_manager_id).length,
    };
  }, [employees]);

  function deselect(ids: string[]) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.delete(id);
      return next;
    });
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  /** O "marcar tudo" do cabeçalho vale só para o que o filtro está mostrando. */
  function toggleVisible(check: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const r of rows) {
        if (check) next.add(r.id);
        else next.delete(r.id);
      }
      return next;
    });
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function clearFilters() {
    setDept(ALL_DEPTS);
    setUnit(ALL_UNITS);
    setManager(ALL_MANAGERS);
    setStatusFilter("todos");
  }

  const mark = (key: SortKey) => (sortKey === key ? (sortDir === "asc" ? "↑" : "↓") : "↕");

  // A seleção pode conter gente escondida pelo filtro; o cabeçalho fala só do visível.
  const visibleSelected = rows.filter((r) => selected.has(r.id)).length;
  const allVisibleChecked = rows.length > 0 && visibleSelected === rows.length;
  const headerState = allVisibleChecked ? true : visibleSelected > 0 ? "indeterminate" : false;
  const selectedList = base.filter((e) => selected.has(e.id));

  return (
    <div>
      <header className="flex flex-wrap items-end justify-between gap-4 border-b-[1.5px] border-ink pb-5">
        <div>
          <Kicker>Gente &amp; Gestão</Kicker>
          <h1 className="mt-3 text-[28px] leading-[1.02] font-black tracking-[-0.045em] sm:text-[34px] lg:text-[42px]">
            Colaboradores.
          </h1>
          <p className="mt-3 max-w-[60ch] text-[15.5px] leading-[1.7] text-muted-foreground">
            Diretório completo, gestão direta e acesso ao Portal do Colaborador. As datas
            cadastradas aqui alimentam{" "}
            <Link
              to="/admin/recurso/$key"
              params={{ key: "aniversariantes" }}
              className="font-bold text-primary hover:underline"
            >
              Aniversariantes e tempo de casa
            </Link>
            .
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <InkButton variant="outline" onClick={() => setImporting(true)}>
            <Upload className="h-4 w-4" /> Importar XLSX
          </InkButton>
          <InkButton variant="outline" onClick={() => setImportingPhotos(true)}>
            <ImagePlus className="h-4 w-4" /> Importar fotos
          </InkButton>
          <InkButton onClick={() => setAdding(true)}>
            <UserPlus className="h-4 w-4" /> Cadastrar colaborador
          </InkButton>
        </div>
      </header>

      {/* Indicadores — sempre sobre a base inteira, nunca sobre o filtro. */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          size="sm"
          label="Colaboradores ativos"
          value={String(counts.ativos)}
          note={`${counts.inativos} inativo(s) no cadastro`}
        />
        <KpiCard
          size="sm"
          label="Com acesso ao portal"
          value={String(counts.comAcesso)}
          note={`${counts.ativos - counts.comAcesso} ainda sem acesso`}
        />
        <KpiCard
          size="sm"
          label="Sem gestor definido"
          value={String(counts.semGestor)}
          note="entre os ativos"
        />
        <KpiCard
          size="sm"
          label="Gestores no cadastro"
          value={String(Math.max(0, managerOptions.length - 2))}
          note="pessoas que lideram alguém"
        />
      </div>

      <div className="mt-7 overflow-hidden rounded-lg border-[1.5px] border-ink bg-surface shadow-paper">
        {/* Barra de seleção — só aparece com alguém marcado */}
        {selectedList.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 border-b-[1.5px] border-ink bg-ink px-[22px] py-3">
            <span className="text-[13px] font-extrabold text-paper tabular-nums">
              {selectedList.length} {selectedList.length === 1 ? "selecionado" : "selecionados"}
            </span>
            {visibleSelected !== selectedList.length && (
              <span className="text-[11.5px] text-paper/60">
                {selectedList.length - visibleSelected} fora do filtro atual
              </span>
            )}
            <button
              type="button"
              onClick={() => setConfirmingMany(true)}
              className="inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-paper/40 px-3.5 py-1.5 text-[11px] font-extrabold tracking-[0.1em] text-paper uppercase transition hover:border-destructive hover:bg-destructive hover:text-destructive-foreground"
            >
              <Trash2 className="h-3.5 w-3.5" /> Excluir
            </button>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="ml-auto text-[12px] font-extrabold text-accent underline underline-offset-[3px]"
            >
              Limpar seleção
            </button>
          </div>
        )}

        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-3 border-b-[1.5px] border-ink px-[22px] py-3.5">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            aria-label="Filtrar por status"
            className={SELECT}
          >
            <option value="todos">Todos ({counts.todos})</option>
            <option value="ativos">Ativos ({counts.ativos})</option>
            <option value="inativos">Inativos ({counts.inativos})</option>
          </select>
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
          <select
            value={activeManager}
            onChange={(e) => setManager(e.target.value)}
            aria-label="Filtrar por gestor"
            className={SELECT}
          >
            {managerOptions.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
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
          <div className="min-w-[1120px]">
            {/* Cabeçalho de colunas */}
            <div className={cn(GRID, "bg-ink px-[22px] py-[13px]")}>
              <Checkbox
                checked={headerState}
                onCheckedChange={(v) => toggleVisible(v === true)}
                disabled={rows.length === 0}
                aria-label="Selecionar todos os colaboradores desta lista"
                className={cn(CHECKBOX, "border-paper/70")}
              />
              <button
                type="button"
                onClick={() => toggleSort("name")}
                className={cn(COL_HEAD, "inline-flex items-center gap-1.5 text-left")}
              >
                Pessoa <span className="text-accent">{mark("name")}</span>
              </button>
              <span className={COL_HEAD}>Cargo e área</span>
              <button
                type="button"
                onClick={() => toggleSort("manager")}
                className={cn(COL_HEAD, "inline-flex items-center gap-1.5 text-left")}
              >
                Gestor <span className="text-accent">{mark("manager")}</span>
              </button>
              <button
                type="button"
                onClick={() => toggleSort("admission")}
                className={cn(COL_HEAD, "inline-flex items-center gap-1.5 text-left")}
              >
                Admissão <span className="text-accent">{mark("admission")}</span>
              </button>
              <span className={COL_HEAD}>Acesso</span>
              <span className={COL_HEAD}>Status</span>
              <span className={cn(COL_HEAD, "text-right")}>Ações</span>
            </div>

            {q.isLoading ? (
              <SkeletonRows />
            ) : rows.length === 0 ? (
              <div className="px-[22px] py-10">
                <p className="text-xl font-black tracking-tight">
                  {employees.length === 0
                    ? "Nenhum colaborador cadastrado."
                    : "Nenhum resultado para esses filtros."}
                </p>
                <p className="mt-2 text-[15px] leading-[1.65] text-muted-foreground">
                  {employees.length === 0
                    ? "Cadastre a primeira pessoa ou importe a planilha do DP."
                    : "Tente outro nome, ou limpe os filtros para ver o diretório inteiro."}
                </p>
              </div>
            ) : (
              rows.map((emp) => (
                <div
                  key={emp.id}
                  className={cn(
                    GRID,
                    "border-t border-border px-[22px] py-4 transition-colors hover:bg-accent-soft/40",
                    !emp.active && "opacity-70",
                    selected.has(emp.id) && "bg-accent-soft/60",
                  )}
                >
                  <Checkbox
                    checked={selected.has(emp.id)}
                    onCheckedChange={() => toggleOne(emp.id)}
                    aria-label={`Selecionar ${emp.name}`}
                    className={CHECKBOX}
                  />

                  {/* Pessoa */}
                  <div className="flex min-w-0 items-center gap-3">
                    <UserAvatar name={emp.name} photoUrl={emp.photo_url} size={40} />
                    <div className="min-w-0">
                      <p className="truncate text-[16.5px] font-extrabold tracking-[-0.02em]">
                        {emp.name}
                      </p>
                      {emp.email && (
                        <p className="truncate text-xs text-muted-foreground">{emp.email}</p>
                      )}
                    </div>
                  </div>

                  {/* Cargo e área */}
                  <div className="min-w-0">
                    {emp.job_title && (
                      <p className="truncate text-[13px] font-bold">{emp.job_title}</p>
                    )}
                    {emp.department && (
                      <p className="truncate text-xs text-muted-foreground">{emp.department}</p>
                    )}
                    {!emp.job_title && !emp.department && (
                      <span className="text-[13px] text-muted-foreground">—</span>
                    )}
                  </div>

                  {/* Gestor */}
                  <div className="min-w-0">
                    {emp.managerName ? (
                      <>
                        <p className="truncate text-[13px] font-bold text-muted-foreground">
                          {emp.managerName}
                        </p>
                        {emp.coManagerName && (
                          <p className="truncate text-[11.5px] text-muted-foreground">
                            e {emp.coManagerName}
                          </p>
                        )}
                      </>
                    ) : (
                      <span className="text-[13px] text-muted-foreground">—</span>
                    )}
                  </div>

                  {/* Admissão */}
                  <span className="text-[13px] font-bold text-muted-foreground tabular-nums">
                    {formatDate(emp.admission_date)}
                  </span>

                  {/* Acesso */}
                  <span>
                    {emp.auth_user_id ? (
                      cpfLast2.has(emp.id) ? (
                        <Chip tone="accent" className="gap-1" title="Entra com CPF e senha">
                          <IdCard className="h-3 w-3" /> CPF
                        </Chip>
                      ) : (
                        <Chip tone="accent">Portal</Chip>
                      )
                    ) : (
                      <Chip tone="soft" className="gap-1">
                        <ShieldOff className="h-3 w-3" /> Sem acesso
                      </Chip>
                    )}
                  </span>

                  {/* Status */}
                  <span>
                    {emp.active ? (
                      <Chip tone="success">Ativo</Chip>
                    ) : (
                      <Chip tone="soft">Inativo</Chip>
                    )}
                  </span>

                  {/* Ações */}
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setEditing(emp)}
                      className="text-[11px] font-extrabold tracking-[0.1em] text-ink uppercase hover:text-primary"
                    >
                      Editar
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          aria-label={`Mais ações para ${emp.name}`}
                          className="grid h-7 w-7 place-items-center rounded-lg border border-border transition hover:bg-accent-soft"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-52">
                        <DropdownMenuItem onClick={() => setEditing(emp)}>
                          <Pencil className="mr-2 h-3.5 w-3.5" /> Editar cadastro
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {emp.auth_user_id && cpfLast2.has(emp.id) ? (
                          <>
                            <DropdownMenuItem
                              onClick={() => mResetCpf.mutate(emp)}
                              disabled={mResetCpf.isPending}
                            >
                              <KeyRound className="mr-2 h-3.5 w-3.5" /> Gerar nova senha
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setChangingCpf(emp)}>
                              <IdCard className="mr-2 h-3.5 w-3.5" /> Corrigir CPF
                            </DropdownMenuItem>
                          </>
                        ) : emp.auth_user_id ? (
                          <>
                            <DropdownMenuItem onClick={() => mResend.mutate(emp.id)} disabled={mResend.isPending}>
                              <MailCheck className="mr-2 h-3.5 w-3.5" /> Reenviar convite
                            </DropdownMenuItem>
                            {emp.email && (
                              <DropdownMenuItem onClick={() => mReset.mutate(emp.email!)} disabled={mReset.isPending}>
                                <RefreshCcw className="mr-2 h-3.5 w-3.5" /> Resetar senha
                              </DropdownMenuItem>
                            )}
                          </>
                        ) : (
                          <DropdownMenuItem onClick={() => setInvitingExisting(emp)}>
                            <MailCheck className="mr-2 h-3.5 w-3.5" /> Dar acesso
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => mToggle.mutate(emp)}
                          disabled={mToggle.isPending}
                        >
                          {emp.active ? "Desativar colaborador" : "Reativar colaborador"}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setConfirmingOne(emp)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="mr-2 h-3.5 w-3.5" /> Excluir do diretório
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 border-t-[1.5px] border-ink px-[22px] py-3">
          <span className="text-[11.5px] text-muted-foreground">
            Uso interno. Nada de endereço, documentos ou dados bancários por aqui — e do CPF de
            acesso, só os dois últimos dígitos.
          </span>
          <span className="text-[11.5px] font-bold text-muted-foreground tabular-nums">
            {rows.length} de {employees.length} colaboradores
          </span>
        </div>
      </div>

      {/* Modal: cadastrar colaborador no diretório (sem convite) */}
      {adding && (
        <Modal title="Cadastrar colaborador" onClose={() => setAdding(false)}>
          <p className="px-6 pt-4 text-xs text-muted-foreground">
            O colaborador é adicionado ao diretório. Para dar acesso ao portal, use “Dar acesso”
            depois.
          </p>
          <EmployeeForm
            employees={employees}
            onSubmit={(v) => mAdd.mutate(v)}
            onCancel={() => setAdding(false)}
            loading={mAdd.isPending}
          />
        </Modal>
      )}

      {/* Modal: editar colaborador existente */}
      {editing && (
        <Modal title={`Editar — ${editing.name}`} onClose={() => setEditing(null)}>
          <EmployeeForm
            initial={editing}
            employees={employees}
            onSubmit={(v) => mUpdate.mutate({ id: editing.id, ...v })}
            onCancel={() => setEditing(null)}
            loading={mUpdate.isPending}
          />
        </Modal>
      )}

      {/* Modal: dar acesso ao portal para colaborador do diretório */}
      {invitingExisting && (
        <Modal
          title={`Dar acesso — ${invitingExisting.name}`}
          onClose={() => setInvitingExisting(null)}
        >
          <GrantAccess
            onInvite={(email) => mInviteExisting.mutate({ employeeId: invitingExisting.id, email })}
            inviting={mInviteExisting.isPending}
            onCpf={(cpf) => mSetCpf.mutate({ employee: invitingExisting, cpf })}
            creatingCpf={mSetCpf.isPending}
          />
        </Modal>
      )}

      {/* Modal: corrigir o CPF de quem entra por CPF */}
      {changingCpf && (
        <Modal title={`Corrigir CPF — ${changingCpf.name}`} onClose={() => setChangingCpf(null)}>
          <div className="px-6 py-5">
            <p className="mb-4 text-sm text-muted-foreground">
              O CPF cadastrado termina em {hiddenCpf(cpfLast2.get(changingCpf.id) ?? "??")}.
              Informe o CPF certo: o acesso passa a ser por ele, e uma senha provisória nova é
              gerada.
            </p>
            <CpfAccessForm
              onSubmit={(cpf) => mSetCpf.mutate({ employee: changingCpf, cpf })}
              loading={mSetCpf.isPending}
              submitLabel="Corrigir e gerar senha"
            />
          </div>
        </Modal>
      )}

      {/* Modal: senha provisória recém-gerada */}
      {issued && (
        <Modal title={`Acesso por CPF — ${issued.name}`} onClose={() => setIssued(null)}>
          <IssuedPassword {...issued} onDone={() => setIssued(null)} />
        </Modal>
      )}

      {/* Modal: importação em massa via XLSX */}
      {importing && (
        <ImportModal
          employees={employees}
          onImport={(rows) => mBulk.mutate(rows)}
          loading={mBulk.isPending}
          onClose={() => setImporting(false)}
        />
      )}

      {/* Modal: importação em lote de fotos */}
      {importingPhotos && (
        <PhotoImportModal
          employees={employees}
          onSaveUrl={(id, url) => doUpdatePhoto({ data: { id, photo_url: url } })}
          onClose={() => { setImportingPhotos(false); invalidate(); }}
        />
      )}

      {/* Excluir um */}
      <AlertDialog open={confirmingOne !== null} onOpenChange={(v) => !v && setConfirmingOne(null)}>
        <AlertDialogContent className="border-[1.5px] border-ink bg-paper shadow-elevated">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[22px] font-black tracking-[-0.03em]">
              Excluir “{confirmingOne?.name}”?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[15px] leading-[1.65]">
              Sai do diretório junto com cargo, área, unidade, gestor e datas, e não dá pra
              desfazer. Para tirar alguém das listas sem apagar o cadastro, use “Desativar
              colaborador”. A conta de acesso, quando existe, continua em Usuários admin.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Manter</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmingOne && mDelete.mutate(confirmingOne.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Excluir a seleção */}
      <AlertDialog open={confirmingMany} onOpenChange={(v) => !v && setConfirmingMany(false)}>
        <AlertDialogContent className="border-[1.5px] border-ink bg-paper shadow-elevated">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[22px] font-black tracking-[-0.03em]">
              Excluir {selectedList.length}{" "}
              {selectedList.length === 1 ? "colaborador" : "colaboradores"}?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[15px] leading-[1.65]">
              Saem do diretório junto com cargo, área, unidade, gestor e datas, e não dá pra
              desfazer. Quem for gestor de alguém deixa esse campo em branco nos liderados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <ul className="max-h-40 overflow-y-auto rounded-lg border border-border bg-surface-muted px-4 py-3 text-[13px] leading-[1.7]">
            {selectedList.slice(0, 12).map((e) => (
              <li key={e.id} className="truncate font-bold">
                {e.name}
              </li>
            ))}
            {selectedList.length > 12 && (
              <li className="text-muted-foreground">e mais {selectedList.length - 12}…</li>
            )}
          </ul>
          <AlertDialogFooter>
            <AlertDialogCancel>Manter</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => mBulkDelete.mutate(selectedList.map((e) => e.id))}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir {selectedList.length}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ─── Peças da tabela ──────────────────────────────────────────────────────── */

function SkeletonRows() {
  return (
    <div aria-busy="true" aria-label="Carregando colaboradores">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className={cn(GRID, "border-t border-border px-[22px] py-4")}>
          <div className="h-[17px] w-[17px] rounded-[5px] bg-ink/10" />
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 shrink-0 rounded-full bg-ink/10" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="h-4 w-44 max-w-full rounded bg-ink/10" />
              <div className="h-3 w-28 max-w-full rounded bg-ink/[0.07]" />
            </div>
          </div>
          <div className="h-3 w-24 rounded bg-ink/[0.07]" />
          <div className="h-3 w-28 rounded bg-ink/[0.07]" />
          <div className="h-3 w-16 rounded bg-ink/[0.07]" />
          <div className="h-5 w-16 rounded-full bg-ink/10" />
          <div className="h-5 w-14 rounded-full bg-ink/10" />
          <div className="h-7 w-20 justify-self-end rounded-lg bg-ink/[0.07]" />
        </div>
      ))}
    </div>
  );
}

/* ─── Modais e formulários ─────────────────────────────────────────────────── */

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-[3px] md:items-center md:p-6"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-content-in flex max-h-[92vh] w-full max-w-[560px] flex-col rounded-t-lg border-[1.5px] border-ink bg-paper shadow-elevated md:rounded-lg"
      >
        <div className="flex items-start justify-between gap-4 border-b-[1.5px] border-ink px-6 py-5">
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold tracking-[0.18em] text-primary uppercase">
              Gente &amp; Gestão
            </p>
            <h2 className="mt-1 truncate text-[22px] font-black tracking-[-0.03em]">{title}</h2>
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
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

// Campo vazio vai como `null`, e não `undefined`: para `updateEmployee`, `undefined` é
// "não mexer", e apagar a data de nascimento e salvar deixava a data antiga no banco.
// O e-mail é a exceção — ele é o login da conta, e não se apaga por aqui.
type EmployeeFormValues = {
  name: string;
  email?: string;
  department: string | null;
  job_title: string | null;
  unit: string | null;
  phone: string | null;
  birth_date: string | null;
  admission_date: string | null;
  manager_id: string | null;
  co_manager_id: string | null;
  hide_birthday: boolean;
};

function EmployeeForm({
  initial,
  employees,
  onSubmit,
  onCancel,
  loading,
}: {
  initial?: Partial<Employee>;
  employees: Employee[];
  onSubmit: (v: EmployeeFormValues) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [department, setDepartment] = useState(initial?.department ?? "");
  const [jobTitle, setJobTitle] = useState(initial?.job_title ?? "");
  const [unit, setUnit] = useState(initial?.unit ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [birthDate, setBirthDate] = useState(initial?.birth_date ?? "");
  const [admissionDate, setAdmissionDate] = useState(initial?.admission_date ?? "");
  const [managerId, setManagerId] = useState(initial?.manager_id ?? "");
  const [coManagerId, setCoManagerId] = useState(initial?.co_manager_id ?? "");
  const [hideBirthday, setHideBirthday] = useState(initial?.hide_birthday ?? false);

  // Ninguém é gestor de si mesmo. Inativo só aparece se já estiver gravado.
  const candidates = useMemo(
    () =>
      employees
        .filter(
          (e) =>
            e.id !== initial?.id &&
            (e.active || e.id === initial?.manager_id || e.id === initial?.co_manager_id),
        )
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    [employees, initial?.id, initial?.manager_id, initial?.co_manager_id],
  );

  return (
    <form
      id="employee-form"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          name,
          email: email || undefined,
          department: normalizeDepartment(department) ?? null,
          job_title: jobTitle.trim() || null,
          unit: normalizeUnit(unit) ?? null,
          phone: phone.trim() || null,
          birth_date: birthDate || null,
          admission_date: admissionDate || null,
          manager_id: managerId || null,
          // Segundo gestor sem o primeiro não faz sentido.
          co_manager_id: (managerId && coManagerId) || null,
          hide_birthday: hideBirthday,
        });
      }}
    >
      <div className="px-6 pt-5 pb-2">
        {/* Identificação */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Field label="Nome completo">
              <input required value={name} onChange={(e) => setName(e.target.value)} className={inp} />
            </Field>
          </div>
          <div className="md:col-span-2">
            <Field label="E-mail">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nome@wgbaterias.com.br"
                className={inp}
              />
            </Field>
          </div>
        </div>

        {/* Dados profissionais */}
        <FormDivider>Dados profissionais</FormDivider>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Sugestões da lista oficial, sem travar: setor fora da lista ainda pode ser digitado. */}
          <Field label="Setor / Departamento">
            <input
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              list="org-departments"
              placeholder="Logística, Comercial…"
              className={inp}
            />
            <datalist id="org-departments">
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d} />
              ))}
            </datalist>
          </Field>
          <Field label="Cargo">
            <input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} className={inp} />
          </Field>
          <Field label="Filial">
            <input
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              list="org-units"
              placeholder="São José dos Pinhais/PR…"
              className={inp}
            />
            <datalist id="org-units">
              {UNITS.map((u) => (
                <option key={u} value={u} />
              ))}
            </datalist>
          </Field>
          <Field label="Data de admissão">
            <input
              type="date"
              value={admissionDate}
              onChange={(e) => setAdmissionDate(e.target.value)}
              className={inp}
            />
          </Field>
        </div>

        {/* Gestão direta */}
        <FormDivider>Gestão direta</FormDivider>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Gestor imediato">
            <select
              value={managerId}
              onChange={(e) => {
                const v = e.target.value;
                setManagerId(v);
                // Sem gestor, ou gestor igual ao segundo: o segundo cai fora.
                if (!v || v === coManagerId) setCoManagerId("");
              }}
              className={inp}
            >
              <option value="">Sem gestor definido</option>
              {candidates.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                  {e.active ? "" : " (inativo)"}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Segundo gestor (opcional)">
            <select
              value={coManagerId}
              disabled={!managerId}
              onChange={(e) => setCoManagerId(e.target.value)}
              className={cn(inp, "disabled:opacity-50")}
            >
              <option value="">Nenhum</option>
              {candidates
                .filter((e) => e.id !== managerId)
                .map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                    {e.active ? "" : " (inativo)"}
                  </option>
                ))}
            </select>
          </Field>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          O gestor aparece em “Meu time” no portal e preenche o campo “Gestor imediato” dos
          formulários de G&amp;G. O segundo gestor é para as áreas divididas entre duas pessoas.
        </p>

        {/* Dados pessoais */}
        <FormDivider>Dados pessoais</FormDivider>
        <div className="grid grid-cols-1 gap-4 pb-4 md:grid-cols-2">
          <Field label="Telefone / WhatsApp">
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(00) 00000-0000"
              className={inp}
            />
          </Field>
          <Field label="Data de nascimento">
            <input
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              className={inp}
            />
          </Field>
          <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border-[1.5px] border-ink/25 bg-surface px-4 py-3 md:col-span-2">
            <Checkbox
              checked={hideBirthday}
              onCheckedChange={(v) => setHideBirthday(v === true)}
              className={cn(CHECKBOX, "mt-[1px]")}
            />
            <span className="text-sm leading-[1.5]">
              <span className="font-bold">Não exibir aniversário no portal</span>
              <span className="block text-xs text-muted-foreground">
                Para quem não comemora. Some dos aniversariantes da home, da Cultura e do
                assistente. A data continua guardada e o tempo de casa segue aparecendo.
              </span>
            </span>
          </label>
        </div>
      </div>

      {/* Rodapé fixo */}
      <div className="sticky bottom-0 flex justify-end gap-2 border-t-[1.5px] border-ink bg-paper px-6 py-4">
        <InkButton variant="outline" onClick={onCancel}>
          Cancelar
        </InkButton>
        <InkButton type="submit" disabled={loading || !name.trim()}>
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Salvar
        </InkButton>
      </div>
    </form>
  );
}

function FormDivider({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-6 mb-4 border-b border-border pb-2">
      <h3 className="text-[11px] font-extrabold tracking-[0.14em] text-muted-foreground uppercase">
        {children}
      </h3>
    </div>
  );
}

function InviteExistingForm({
  onSubmit,
  loading,
}: {
  onSubmit: (email: string) => void;
  loading: boolean;
}) {
  const [email, setEmail] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(email);
      }}
      className="space-y-3"
    >
      <Field label="E-mail corporativo">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="nome@wgbaterias.com.br"
          className={inp}
        />
      </Field>
      <InkButton
        type="submit"
        disabled={loading || !email.trim()}
        className="w-full justify-center"
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        <MailCheck className="h-4 w-4" /> Enviar convite
      </InkButton>
    </form>
  );
}

/**
 * "Dar acesso": convite por e-mail, ou CPF + senha provisória para quem não tem e-mail
 * corporativo (motoristas, logística, operação).
 */
function GrantAccess({
  onInvite,
  inviting,
  onCpf,
  creatingCpf,
}: {
  onInvite: (email: string) => void;
  inviting: boolean;
  onCpf: (cpf: string) => void;
  creatingCpf: boolean;
}) {
  const [mode, setMode] = useState<"email" | "cpf">("email");
  const tab = (id: "email" | "cpf", label: string, Icon: typeof MailCheck) => (
    <button
      type="button"
      onClick={() => setMode(id)}
      aria-pressed={mode === id}
      className={cn(
        "inline-flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs font-extrabold uppercase tracking-[0.08em] transition-colors",
        mode === id ? "bg-ink text-paper" : "text-muted-foreground hover:text-ink",
      )}
    >
      <Icon className="h-3.5 w-3.5" /> {label}
    </button>
  );

  return (
    <div className="px-6 py-5">
      <div className="mb-5 flex gap-1 rounded-full border-[1.5px] border-ink bg-surface p-1">
        {tab("email", "Por e-mail", MailCheck)}
        {tab("cpf", "Por CPF", IdCard)}
      </div>
      {mode === "email" ? (
        <>
          <p className="mb-4 text-sm text-muted-foreground">
            Informe o e-mail deste colaborador para enviar o convite de acesso ao Portal.
          </p>
          <InviteExistingForm onSubmit={onInvite} loading={inviting} />
        </>
      ) : (
        <>
          <p className="mb-4 text-sm text-muted-foreground">
            Para quem não tem e-mail corporativo. A pessoa entra com o CPF e uma senha provisória,
            que você entrega pessoalmente; no primeiro acesso ela cria a própria senha. O CPF não
            fica guardado — só os dois últimos dígitos, para conferência.
          </p>
          <CpfAccessForm onSubmit={onCpf} loading={creatingCpf} submitLabel="Criar acesso" />
        </>
      )}
    </div>
  );
}

function CpfAccessForm({
  onSubmit,
  loading,
  submitLabel,
}: {
  onSubmit: (cpf: string) => void;
  loading: boolean;
  submitLabel: string;
}) {
  const [cpf, setCpf] = useState("");
  const valid = isValidCpf(cpf);
  const complete = cpf.replace(/\D/g, "").length === 11;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onSubmit(cpf);
      }}
      className="space-y-3"
    >
      <Field label="CPF">
        <input
          inputMode="numeric"
          autoComplete="off"
          required
          value={cpf}
          onChange={(e) => setCpf(maskCpf(e.target.value))}
          placeholder="000.000.000-00"
          className={inp}
        />
      </Field>
      {complete && !valid && (
        <p className="text-xs font-bold text-destructive">CPF inválido. Confira os 11 dígitos.</p>
      )}
      <InkButton type="submit" disabled={loading || !valid} className="w-full justify-center">
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        <KeyRound className="h-4 w-4" /> {submitLabel}
      </InkButton>
    </form>
  );
}

/** A senha provisória aparece só aqui, uma vez. Fechou, só gerando outra. */
function IssuedPassword({
  name,
  cpfLast2,
  password,
  onDone,
}: {
  name: string;
  cpfLast2: string;
  password: string;
  onDone: () => void;
}) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(password);
      toast.success("Senha copiada.");
    } catch {
      toast.error("Não deu para copiar. Anote a senha.");
    }
  };
  return (
    <div className="space-y-5 px-6 py-5">
      <div className="rounded-lg border-[1.5px] border-ink bg-accent p-5 text-center">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.18em]">Senha provisória</p>
        <p className="mt-2 select-all font-mono text-[28px] font-black tracking-[0.02em]">
          {password}
        </p>
        <button
          type="button"
          onClick={copy}
          className="mt-3 inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-[0.1em] underline-offset-2 hover:underline"
        >
          <Copy className="h-3.5 w-3.5" /> Copiar
        </button>
      </div>
      <ol className="list-decimal space-y-1.5 pl-5 text-sm leading-[1.6]">
        <li>
          Entregue a senha a <strong>{name.split(" ")[0]}</strong> pessoalmente ou por mensagem
          direta.
        </li>
        <li>
          No portal, a pessoa entra com o <strong>CPF</strong> (final {cpfLast2}) e esta senha.
        </li>
        <li>No primeiro acesso, o portal pede para criar a senha definitiva.</li>
      </ol>
      <p className="text-xs text-muted-foreground">
        Esta senha não aparece de novo. Se ela se perder, use “Gerar nova senha”.
      </p>
      <InkButton type="button" onClick={onDone} className="w-full justify-center">
        Pronto
      </InkButton>
    </div>
  );
}

/** Molde do cadastro que a planilha ainda vai criar — só a prévia usa. */
const EMPTY_EMPLOYEE: Employee = {
  id: "",
  auth_user_id: null,
  name: "",
  email: null,
  department: null,
  job_title: null,
  unit: null,
  phone: null,
  birth_date: null,
  hide_birthday: false,
  admission_date: null,
  manager_id: null,
  co_manager_id: null,
  active: true,
  invited_at: null,
  created_at: "",
  photo_url: null,
};

/** Uma linha da planilha já confrontada com o diretório. */
type ImportPlan = {
  row: ImportRow;
  /** Quem essa linha já é no cadastro, quando o nome casa. */
  match: Employee | null;
  /** Campos vazios no cadastro que esta linha preencheria. */
  fills: ReturnType<typeof fieldsToFill>;
};

function ImportModal({
  employees,
  onImport,
  loading,
  onClose,
}: {
  employees: Employee[];
  onImport: (rows: ImportRow[]) => void;
  loading: boolean;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<ImportRow[]>([]);
  /** Linhas com Situação de desligado — ficam de fora da importação. */
  const [inactive, setInactive] = useState(0);
  const [fileName, setFileName] = useState("");
  const [parsing, setParsing] = useState(false);
  /**
   * Planilha de cadastro traz gente nova; planilha de e-mails traz caixa de setor
   * ("Financeiro", "NF-e"), que não é pessoa nenhuma. Quem decide é quem importa.
   */
  const [createNew, setCreateNew] = useState(true);

  /**
   * Mesma conta que o servidor faz na hora de gravar: quem casa por nome não é
   * duplicado, só tem os campos vazios completados. Cada pessoa é tocada uma vez
   * só, e um cadastro novo entra na lista para a linha seguinte não duplicar.
   */
  const plans = useMemo<ImportPlan[]>(() => {
    const pool: Employee[] = [...employees];
    const touched = new Set<string>();
    return rows.map((row, i) => {
      const match = matchByName(row.name, pool);
      if (!match) {
        // O cadastro novo entra na lista: uma segunda linha parecida não duplica.
        // Se ninguém vai ser cadastrado, ele não existe e a linha seguinte também fica de fora.
        if (createNew) {
          const novo = { ...EMPTY_EMPLOYEE, ...row, id: `novo:${i}` };
          pool.push(novo);
          touched.add(novo.id);
        }
        return { row, match: null, fills: [] };
      }
      if (touched.has(match.id)) return { row, match, fills: [] };
      touched.add(match.id);
      return { row, match, fills: fieldsToFill(row, match) };
    });
  }, [rows, employees, createNew]);

  const novos = plans.filter((p) => !p.match).length;
  const completa = plans.filter((p) => p.match && p.fills.length > 0).length;
  const iguais = plans.length - novos - completa;
  // Só sobe o que muda alguma coisa — o resto nem sai do navegador.
  const toImport = plans
    .filter((pl) => (pl.match ? pl.fills.length > 0 : createNew))
    .map((pl) => pl.row);

  const handleFile = async (file: File) => {
    setParsing(true);
    setFileName(file.name);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const parsedSheet = parseEmployeeWorkbook(wb);
      setRows(parsedSheet.rows);
      setInactive(parsedSheet.inactive);
      if (!parsedSheet.sheet) {
        alert(
          "Não achei a linha de títulos. Ela precisa ter uma coluna Nome (ou Nome completo) nas 20 primeiras linhas de alguma aba.",
        );
      } else if (parsedSheet.rows.length === 0) {
        alert(
          `A linha de títulos está na linha ${parsedSheet.headerRow} da aba “${parsedSheet.sheet}”, mas nenhuma linha abaixo dela tem nome preenchido.`,
        );
      }
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setParsing(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-6"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl bg-background rounded-t-3xl md:rounded-3xl shadow-elevated max-h-[95vh] overflow-y-auto"
      >
        <div className="sticky top-0 bg-background border-b border-border px-6 py-4 flex items-center justify-between">
          <h2 className="font-bold">Importar colaboradores via planilha</h2>
          <button onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="rounded-xl bg-surface-muted p-4 text-sm space-y-1">
            <p className="font-semibold">Colunas reconhecidas automaticamente:</p>
            <p className="text-muted-foreground text-xs font-mono">
              Nome completo / Nome / Quem usa, E-mail, Telefone / Celular, Cargo, Filial /
              Unidade, Setor / Departamento / Área, Admissão / Data_admissão, Data Nasc. /
              Data_nascimento
            </p>
            <p className="text-muted-foreground text-xs mt-2">
              <strong>Filial</strong> (onde a pessoa trabalha) e <strong>setor</strong> (o que ela
              faz) são colunas diferentes. A filial é gravada no nome oficial (“SJP” vira “São José
              dos Pinhais/PR”).
            </p>
            <p className="text-muted-foreground text-xs mt-2">
              A linha de títulos pode estar em qualquer uma das 20 primeiras linhas, em qualquer
              aba. Quem está com <strong>Situação</strong> de desligado fica de fora. Colunas que o
              portal não usa — como Salário — não são lidas e não saem do seu computador.
            </p>
            <p className="text-muted-foreground text-xs mt-2">
              Quando existe uma coluna <strong>Nome completo</strong>, é ela que vale — “Quem usa”
              costuma trazer apelido ou caixa de setor.
            </p>
            <p className="text-muted-foreground text-xs mt-2">
              Quem já está no diretório <strong>não é cadastrado de novo</strong>: a planilha só
              completa os campos que estão vazios no cadastro. Dado já preenchido nunca é
              sobrescrito. Quem não casa com ninguém entra como colaborador novo, sem acesso ao
              portal.
            </p>
          </div>

          <label className="inline-flex items-center gap-2 rounded-xl border border-dashed border-input px-4 py-3 text-sm font-semibold cursor-pointer hover:bg-secondary">
            {parsing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            Selecionar CSV ou XLSX
            <input
              type="file"
              hidden
              accept=".csv,.xlsx,.xls"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
          </label>

          {fileName && (
            <p className="text-xs text-muted-foreground">Arquivo: {fileName}</p>
          )}

          {rows.length > 0 && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Chip tone={createNew ? "accent" : "soft"} className="gap-1.5">
                  <UserPlus className="h-3.5 w-3.5" /> {novos} fora do diretório
                </Chip>
                <Chip tone="success" className="gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5" /> {completa} a completar
                </Chip>
                {iguais > 0 && (
                  <Chip tone="soft" className="gap-1.5">{iguais} sem nada a completar</Chip>
                )}
                {inactive > 0 && (
                  <Chip tone="soft" className="gap-1.5" title="Situação: desligado">
                    {inactive} {inactive === 1 ? "desligado ignorado" : "desligados ignorados"}
                  </Chip>
                )}
              </div>

              <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border-[1.5px] border-ink/25 bg-surface px-4 py-3">
                <Checkbox
                  checked={createNew}
                  onCheckedChange={(v) => setCreateNew(v === true)}
                  className={cn(CHECKBOX, "mt-[1px]")}
                />
                <span className="text-sm leading-[1.5]">
                  <span className="font-bold">Cadastrar quem não está no diretório</span>
                  <span className="block text-xs text-muted-foreground">
                    Desmarque em planilha que só traz contato — as {novos} linhas sem
                    correspondência ficam de fora em vez de virar colaborador novo.
                  </span>
                </span>
              </label>

              <div className="card-soft overflow-hidden">
                <div className="max-h-72 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-surface-muted text-left font-bold uppercase text-muted-foreground sticky top-0">
                      <tr>
                        <th className="px-3 py-2">Nome</th>
                        <th className="px-3 py-2">E-mail</th>
                        <th className="px-3 py-2">Telefone</th>
                        <th className="px-3 py-2">Filial</th>
                        <th className="px-3 py-2">Setor</th>
                        <th className="px-3 py-2">Cargo</th>
                        <th className="px-3 py-2">Admissão</th>
                        <th className="px-3 py-2">Nasc.</th>
                        <th className="px-3 py-2">O que acontece</th>
                      </tr>
                    </thead>
                    <tbody>
                      {plans.slice(0, 100).map(({ row: r, match, fills }, i) => (
                        <tr key={i} className="border-t border-border">
                          <td className="px-3 py-1.5 font-semibold">{r.name}</td>
                          <td className="px-3 py-1.5 text-muted-foreground">{r.email ?? "—"}</td>
                          <td className="px-3 py-1.5 text-muted-foreground">{r.phone ?? "—"}</td>
                          <td className="px-3 py-1.5 text-muted-foreground">{r.unit ?? "—"}</td>
                          <td className="px-3 py-1.5 text-muted-foreground">{r.department ?? "—"}</td>
                          <td className="px-3 py-1.5 text-muted-foreground">{r.job_title ?? "—"}</td>
                          <td className="px-3 py-1.5 text-muted-foreground">
                            {r.admission_date ? fmtDate(r.admission_date) : "—"}
                          </td>
                          <td className="px-3 py-1.5 text-muted-foreground">
                            {r.birth_date ? fmtDate(r.birth_date, "dd/mm") : "—"}
                          </td>
                          <td className="px-3 py-1.5">
                            {!match ? (
                              createNew ? (
                                <span className="font-bold text-primary">Cadastra</span>
                              ) : (
                                <span className="text-muted-foreground opacity-70">
                                  Deixa de fora
                                  <span className="block text-[10px]">não está no diretório</span>
                                </span>
                              )
                            ) : fills.length > 0 ? (
                              <span className="text-muted-foreground">
                                Completa {fills.map(fieldLabel).join(", ")}
                                <span className="block text-[10px] opacity-70">
                                  já existe como {match.name}
                                </span>
                              </span>
                            ) : (
                              <span className="text-muted-foreground opacity-70">
                                Ignora
                                <span className="block text-[10px]">já existe como {match.name}</span>
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {plans.length > 100 && (
                <p className="text-xs text-muted-foreground">
                  A prévia mostra as 100 primeiras linhas; os números acima valem para a planilha
                  inteira ({plans.length} linhas).
                </p>
              )}

              <InkButton
                onClick={() => onImport(toImport)}
                disabled={loading || toImport.length === 0}
                className="w-full justify-center"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {toImport.length === 0
                  ? "Nada a importar"
                  : createNew
                    ? `Cadastrar ${novos} e completar ${completa}`
                    : `Completar ${completa} cadastro${completa !== 1 ? "s" : ""}`}
              </InkButton>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Modal de importação de fotos ─────────────────────────────────────────── */

type PhotoMatch = {
  file: File;
  preview: string;
  employee: Employee | null;
  status: "idle" | "uploading" | "done" | "error";
  error?: string;
};

function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function nameFromFilename(filename: string): string {
  const noExt = filename.replace(/\.[^.]+$/, "");
  // Estratégia 1: último " - " (cobre "Nome - SP", "Nome - MGÁ", "Nome - SJP CWG")
  const lastDash = noExt.lastIndexOf(" - ");
  if (lastDash > 0) return noExt.slice(0, lastDash).trim();
  // Estratégia 2: " -SUFIXO" sem espaço após o traço (ex: "Nome -SJP")
  const m = noExt.match(/^(.*?)\s+-\S/);
  if (m) return m[1].trim();
  return noExt.trim();
}

// Palavras funcionais ignoradas no matching por tokens
const STOP_WORDS = new Set(["da", "de", "do", "das", "dos", "e", "a", "o", "em", "di"]);

function contentWords(norm: string): string[] {
  return norm.split(" ").filter((w) => w.length > 1 && !STOP_WORDS.has(w));
}

function findEmployee(name: string, employees: Employee[]): Employee | null {
  const norm = normalizeForMatch(name);
  const fileWords = contentWords(norm);

  // 1) Exato normalizado
  for (const e of employees) {
    if (normalizeForMatch(e.name) === norm) return e;
  }

  if (fileWords.length === 0) return null;

  // 2) Todas as palavras do arquivo ⊆ palavras do colaborador
  //    "Jose Mendes" → "Jose Luiz Mendes"
  for (const e of employees) {
    const empWords = normalizeForMatch(e.name).split(" ");
    if (fileWords.every((w) => empWords.includes(w))) return e;
  }

  // 3) Todas as palavras do colaborador ⊆ palavras do arquivo (nome mais curto no banco)
  //    DB: "Priscila Dutra" → arquivo: "Priscila Amorim Dutra"
  for (const e of employees) {
    const empContent = contentWords(normalizeForMatch(e.name));
    if (empContent.length >= 2 && empContent.every((w) => fileWords.includes(w))) return e;
  }

  // 4) Primeiro + último token coincidem
  //    "Jose Benvindo" → "Jose Willian da Silva Benvindo"
  if (fileWords.length >= 2) {
    const first = fileWords[0];
    const last = fileWords[fileWords.length - 1];
    for (const e of employees) {
      const empWords = normalizeForMatch(e.name).split(" ");
      if (empWords[0] === first && empWords[empWords.length - 1] === last) return e;
    }
  }

  // 5) Pelo menos 3 palavras de conteúdo em comum (sem ambiguidade)
  if (fileWords.length >= 3) {
    const candidates = employees.filter((e) => {
      const empWords = normalizeForMatch(e.name).split(" ");
      return fileWords.filter((w) => empWords.includes(w)).length >= 3;
    });
    if (candidates.length === 1) return candidates[0];
  }

  // 6) Nome único no arquivo → único colaborador com esse primeiro nome
  if (fileWords.length === 1) {
    const candidates = employees.filter(
      (e) => normalizeForMatch(e.name).split(" ")[0] === fileWords[0],
    );
    if (candidates.length === 1) return candidates[0];
  }

  return null;
}

function PhotoImportModal({
  employees,
  onSaveUrl,
  onClose,
}: {
  employees: Employee[];
  onSaveUrl: (id: string, url: string) => Promise<unknown>;
  onClose: () => void;
}) {
  const [matches, setMatches] = useState<PhotoMatch[]>([]);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);

  function handleFiles(files: FileList | null) {
    if (!files) return;
    const list: PhotoMatch[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      const name = nameFromFilename(file.name);
      const employee = findEmployee(name, employees);
      list.push({ file, preview: URL.createObjectURL(file), employee, status: "idle" });
    }
    list.sort((a, b) => {
      if (a.employee && !b.employee) return -1;
      if (!a.employee && b.employee) return 1;
      return a.file.name.localeCompare(b.file.name);
    });
    setMatches(list);
    setDone(false);
  }

  async function handleUpload() {
    setRunning(true);
    const updated = [...matches];

    for (let i = 0; i < updated.length; i++) {
      const m = updated[i];
      if (!m.employee) continue;
      updated[i] = { ...m, status: "uploading" };
      setMatches([...updated]);

      try {
        const ext = m.file.name.split(".").pop() ?? "jpg";
        const path = `employee-photos/${m.employee.id}.${ext}`;
        const { error: storageErr } = await supabase.storage
          .from("portal-public")
          .upload(path, m.file, { upsert: true, contentType: m.file.type });
        if (storageErr) throw new Error(storageErr.message);

        const { data: urlData } = supabase.storage.from("portal-public").getPublicUrl(path);
        await onSaveUrl(m.employee.id, urlData.publicUrl);

        updated[i] = { ...updated[i], status: "done" };
      } catch (e) {
        updated[i] = { ...updated[i], status: "error", error: (e as Error).message };
      }
      setMatches([...updated]);
    }

    setRunning(false);
    setDone(true);
    const successes = updated.filter((m) => m.status === "done").length;
    const errors = updated.filter((m) => m.status === "error").length;
    if (successes > 0) toast.success(`${successes} foto${successes !== 1 ? "s" : ""} importada${successes !== 1 ? "s" : ""}.`);
    if (errors > 0) toast.error(`${errors} foto${errors !== 1 ? "s" : ""} com erro.`);
  }

  const matched = matches.filter((m) => m.employee).length;
  const unmatched = matches.filter((m) => !m.employee).length;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-6"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl bg-white rounded-t-2xl md:rounded-2xl shadow-2xl max-h-[95vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Importar fotos em lote</h2>
            <p className="text-xs text-slate-500 mt-0.5">Selecione os arquivos — o nome do arquivo deve conter o nome do colaborador.</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Corpo */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
          {/* Dropzone */}
          {!running && (
            <label className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 px-6 py-8 text-sm text-slate-500 cursor-pointer hover:border-green-400 hover:bg-green-50 transition-colors">
              <ImagePlus className="h-8 w-8 text-slate-300" />
              <span className="font-medium text-slate-600">Clique para selecionar as fotos</span>
              <span className="text-xs">PNG, JPG, WEBP — múltiplos arquivos permitidos</span>
              <input
                type="file"
                hidden
                multiple
                accept="image/*"
                onChange={(e) => handleFiles(e.target.files)}
              />
            </label>
          )}

          {/* Resumo */}
          {matches.length > 0 && (
            <div className="flex gap-3 text-xs">
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 font-medium text-emerald-700">
                <CheckCircle2 className="h-3.5 w-3.5" /> {matched} com match
              </span>
              {unmatched > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 font-medium text-amber-700">
                  <AlertCircle className="h-3.5 w-3.5" /> {unmatched} sem match
                </span>
              )}
            </div>
          )}

          {/* Lista de fotos */}
          {matches.length > 0 && (
            <div className="rounded-xl border border-slate-100 divide-y divide-slate-100 overflow-hidden">
              {matches.map((m, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                  <img
                    src={m.preview}
                    alt=""
                    className="h-9 w-9 rounded-full object-cover object-top shrink-0 bg-slate-100"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-800 truncate">
                      {nameFromFilename(m.file.name)}
                    </div>
                    {m.employee ? (
                      <div className="text-xs text-slate-400 truncate">→ {m.employee.name}</div>
                    ) : (
                      <div className="text-xs text-amber-600">Sem match no cadastro</div>
                    )}
                  </div>
                  <div className="shrink-0">
                    {m.status === "idle" && m.employee && (
                      <span className="h-2 w-2 rounded-full bg-slate-300 inline-block" />
                    )}
                    {m.status === "uploading" && (
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    )}
                    {m.status === "done" && (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    )}
                    {m.status === "error" && (
                      <span title={m.error}>
                        <AlertCircle className="h-4 w-4 text-red-500" />
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-slate-100 px-6 py-4 flex items-center justify-between gap-2 rounded-b-2xl">
          <span className="text-xs text-slate-400">
            {matches.length > 0
              ? `${matches.length} arquivo${matches.length !== 1 ? "s" : ""} selecionado${matches.length !== 1 ? "s" : ""}`
              : "Nenhum arquivo selecionado"}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              {done ? "Fechar" : "Cancelar"}
            </button>
            {!done && matched > 0 && (
              <button
                onClick={handleUpload}
                disabled={running}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {running && <Loader2 className="h-4 w-4 animate-spin" />}
                Importar {matched} foto{matched !== 1 ? "s" : ""}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Utilitários de UI ────────────────────────────────────────────────────── */

const inp =
  "w-full rounded-lg border-[1.5px] border-ink/25 bg-surface px-3 py-2 text-sm outline-none " +
  "transition-colors focus:border-ink focus-visible:ring-1 focus-visible:ring-ring";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-extrabold tracking-[0.1em] text-muted-foreground uppercase">
        {label}
      </span>
      {children}
    </label>
  );
}
