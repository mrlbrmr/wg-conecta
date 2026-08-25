import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import * as XLSX from "xlsx";
import {
  CheckCircle2, Loader2, MailCheck, MoreHorizontal, Pencil, RefreshCcw,
  Search, ShieldOff, Upload, UserPlus, X,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  addEmployee,
  bulkImportEmployees,
  inviteExistingEmployee,
  listEmployees,
  resendEmployeeInvite,
  triggerEmployeePasswordReset,
  updateEmployee,
} from "@/lib/employee.functions";
import { toast } from "sonner";

/* ─── Avatar ────────────────────────────────────────────────────────────────── */

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

type Employee = {
  id: string;
  auth_user_id: string | null;
  name: string;
  email: string | null;
  department: string | null;
  job_title: string | null;
  phone: string | null;
  birth_date: string | null;
  admission_date: string | null;
  active: boolean;
  invited_at: string | null;
  created_at: string;
};

type ImportRow = {
  name: string;
  email?: string;
  department?: string;
  job_title?: string;
  admission_date?: string;
  birth_date?: string;
};

type StatusFilter = "todos" | "ativos" | "inativos";

export const Route = createFileRoute("/_authenticated/admin/colaboradores")({
  head: () => ({ meta: [{ title: "Colaboradores — Portal WG" }] }),
  component: ColaboradoresPage,
});

// dd/mm/yyyy ou dd/mm para datas ISO
function fmtDate(iso: string | null, mode: "dd/mm" | "dd/mm/yyyy" = "dd/mm/yyyy") {
  if (!iso) return null;
  const [y, m, d] = iso.split("-");
  if (!d || !m) return null;
  return mode === "dd/mm" ? `${d}/${m}` : `${d}/${m}/${y}`;
}

// Título em português: mantém artigos/preposições minúsculas
function toTitleCase(str: string) {
  const lower = new Set(["da", "de", "do", "das", "dos", "e", "a", "o", "em", "di"]);
  return str
    .toLowerCase()
    .split(" ")
    .map((w, i) => (i === 0 || !lower.has(w)) ? w.charAt(0).toUpperCase() + w.slice(1) : w)
    .join(" ");
}

// Converte serial de data do Excel para ISO
function xlDateToISO(serial: unknown): string | undefined {
  if (!serial || typeof serial !== "number") return undefined;
  const d = new Date(Math.round((serial - 25569) * 86400 * 1000));
  return d.toISOString().split("T")[0];
}

function ColaboradoresPage() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["employees"] });

  const doList = useServerFn(listEmployees);
  const doAdd = useServerFn(addEmployee);
  const doInviteExisting = useServerFn(inviteExistingEmployee);
  const doResend = useServerFn(resendEmployeeInvite);
  const doReset = useServerFn(triggerEmployeePasswordReset);
  const doUpdate = useServerFn(updateEmployee);
  const doBulk = useServerFn(bulkImportEmployees);

  const q = useQuery({ queryKey: ["employees"], queryFn: () => doList() });

  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [invitingExisting, setInvitingExisting] = useState<Employee | null>(null);
  const [importing, setImporting] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todos");

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
      const r = res as { updated: number; inserted: number; skipped: number };
      const parts: string[] = [];
      if (r.inserted > 0) parts.push(`${r.inserted} inserido${r.inserted !== 1 ? "s" : ""}`);
      if (r.updated > 0) parts.push(`${r.updated} atualizado${r.updated !== 1 ? "s" : ""}`);
      if (r.skipped > 0) parts.push(`${r.skipped} sem alteração`);
      toast.success(parts.length > 0 ? parts.join(" · ") + "." : "Nenhum registro processado.");
      invalidate();
      setImporting(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const employees = (q.data ?? []) as Employee[];
  const term = search.trim().toLowerCase();
  const filtered = employees.filter((e) => {
    if (statusFilter === "ativos" && !e.active) return false;
    if (statusFilter === "inativos" && e.active) return false;
    if (!term) return true;
    return (
      e.name.toLowerCase().includes(term) ||
      (e.email?.toLowerCase().includes(term) ?? false) ||
      (e.department?.toLowerCase().includes(term) ?? false) ||
      (e.job_title?.toLowerCase().includes(term) ?? false)
    );
  });

  const counts = {
    todos: employees.length,
    ativos: employees.filter((e) => e.active).length,
    inativos: employees.filter((e) => !e.active).length,
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background -m-6 p-6">
      <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Colaboradores</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie o diretório e os acessos ao Portal do Colaborador.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setImporting(true)}
            className="inline-flex items-center gap-1.5 rounded-full border border-input px-4 py-2 text-sm font-bold hover:bg-secondary"
          >
            <Upload className="h-4 w-4" /> Importar XLSX
          </button>
          <button
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:opacity-95"
          >
            <UserPlus className="h-4 w-4" /> Cadastrar colaborador
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Toolbar: busca e filtros */}
        <div className="flex flex-col sm:flex-row items-center gap-4 px-4 py-3 border-b border-slate-100">
          {/* Busca */}
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, e-mail, filial ou cargo…"
              className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-4 py-2 text-sm outline-none transition focus:border-green-500 focus:ring-1 focus:ring-green-500"
            />
          </div>
          {/* Tabs de filtro */}
          <div className="inline-flex items-center gap-1 rounded-lg bg-slate-100 p-1">
            {(["todos", "ativos", "inativos"] as StatusFilter[]).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`rounded-md px-3 py-1 text-sm transition-all ${
                  statusFilter === s
                    ? "bg-white shadow-sm text-slate-900 font-medium"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <span className="capitalize">{s}</span>
                <span className={`ml-1.5 text-xs ${statusFilter === s ? "text-slate-500" : "text-slate-400"}`}>
                  {counts[s]}
                </span>
              </button>
            ))}
          </div>
          {/* Contador */}
          {employees.length > 0 && (
            <span className="text-xs text-slate-400 sm:ml-auto whitespace-nowrap">
              {filtered.length} de {employees.length} colaboradores
            </span>
          )}
        </div>

        {/* Tabela */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Colaborador</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Filial / Cargo</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Admissão</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Acesso</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Ações</th>
              </tr>
            </thead>
            <tbody>
              {q.isLoading && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto text-primary" />
                  </td>
                </tr>
              )}
              {!q.isLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-muted-foreground text-sm">
                    {employees.length === 0
                      ? "Nenhum colaborador cadastrado."
                      : "Nenhum resultado para os filtros aplicados."}
                  </td>
                </tr>
              )}
              {filtered.map((emp) => (
                <tr key={emp.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors">
                  {/* Colaborador: avatar + nome + email */}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${avatarColor(emp.name)}`}>
                        {initials(emp.name)}
                      </span>
                      <div>
                        <div className="font-medium text-slate-800">{emp.name}</div>
                        {emp.email && (
                          <div className="text-xs text-slate-500">{emp.email}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  {/* Filial / Cargo */}
                  <td className="px-6 py-4">
                    {emp.department && <div className="text-sm font-medium text-slate-700">{emp.department}</div>}
                    {emp.job_title && <div className="text-xs text-slate-500">{emp.job_title}</div>}
                    {!emp.department && !emp.job_title && <span className="text-slate-400">—</span>}
                  </td>
                  {/* Admissão */}
                  <td className="px-6 py-4 text-sm text-slate-500">
                    {fmtDate(emp.admission_date) ?? <span className="text-slate-400">—</span>}
                  </td>
                  {/* Acesso */}
                  <td className="px-6 py-4">
                    {emp.auth_user_id ? (
                      <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">Portal</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">
                        <ShieldOff className="h-3 w-3" /> Sem acesso
                      </span>
                    )}
                  </td>
                  {/* Status */}
                  <td className="px-6 py-4">
                    {emp.active ? (
                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">Ativo</span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">Inativo</span>
                    )}
                  </td>
                  {/* Ações */}
                  <td className="px-6 py-4 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="rounded-lg p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={() => setEditing(emp)}>
                          <Pencil className="mr-2 h-3.5 w-3.5" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {emp.auth_user_id ? (
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
                          className={emp.active ? "text-red-600 focus:text-red-600" : ""}
                        >
                          {emp.active ? "Desativar colaborador" : "Reativar colaborador"}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: cadastrar colaborador no diretório (sem convite) */}
      {adding && (
        <Modal title="Cadastrar colaborador" onClose={() => setAdding(false)}>
          <p className="px-6 pt-4 text-xs text-slate-500">
            O colaborador é adicionado ao diretório. Para dar acesso ao portal, use "Dar acesso" depois.
          </p>
          <EmployeeForm
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
          <div className="px-6 py-5">
            <p className="text-sm text-slate-500 mb-4">
              Informe o e-mail deste colaborador para enviar o convite de acesso ao Portal.
            </p>
            <InviteExistingForm
              onSubmit={(email) =>
                mInviteExisting.mutate({ employeeId: invitingExisting.id, email })
              }
              loading={mInviteExisting.isPending}
            />
          </div>
        </Modal>
      )}

      {/* Modal: importação em massa via XLSX */}
      {importing && (
        <ImportModal
          onImport={(rows) => mBulk.mutate(rows)}
          loading={mBulk.isPending}
          onClose={() => setImporting(false)}
        />
      )}
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
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-6"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-white rounded-t-2xl md:rounded-2xl shadow-2xl max-h-[95vh] flex flex-col"
      >
        <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
}

type EmployeeFormValues = {
  name: string;
  email?: string;
  department?: string;
  job_title?: string;
  phone?: string;
  birth_date?: string;
  admission_date?: string;
};

function EmployeeForm({
  initial,
  onSubmit,
  onCancel,
  loading,
}: {
  initial?: Partial<Employee>;
  onSubmit: (v: EmployeeFormValues) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [department, setDepartment] = useState(initial?.department ?? "");
  const [jobTitle, setJobTitle] = useState(initial?.job_title ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [birthDate, setBirthDate] = useState(initial?.birth_date ?? "");
  const [admissionDate, setAdmissionDate] = useState(initial?.admission_date ?? "");

  return (
    <form
      id="employee-form"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          name,
          email: email || undefined,
          department: department || undefined,
          job_title: jobTitle || undefined,
          phone: phone || undefined,
          birth_date: birthDate || undefined,
          admission_date: admissionDate || undefined,
        });
      }}
    >
      {/* Corpo do formulário */}
      <div className="px-6 pt-5 pb-2">
        {/* Identificação */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
        <div className="mt-6 mb-4 border-b border-slate-100 pb-2">
          <h3 className="text-base font-semibold text-slate-800">Dados profissionais</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Filial / Departamento">
            <input value={department} onChange={(e) => setDepartment(e.target.value)} className={inp} />
          </Field>
          <Field label="Cargo">
            <input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} className={inp} />
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

        {/* Dados pessoais */}
        <div className="mt-6 mb-4 border-b border-slate-100 pb-2">
          <h3 className="text-base font-semibold text-slate-800">Dados pessoais</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4">
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
        </div>
      </div>

      {/* Rodapé fixo */}
      <div className="sticky bottom-0 bg-white border-t border-slate-100 px-6 py-4 flex justify-end gap-2 rounded-b-2xl">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={loading || !name.trim()}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />} Salvar
        </button>
      </div>
    </form>
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
      <button
        type="submit"
        disabled={loading || !email.trim()}
        className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50"
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        <MailCheck className="h-4 w-4" /> Enviar convite
      </button>
    </form>
  );
}

function ImportModal({
  onImport,
  loading,
  onClose,
}: {
  onImport: (rows: ImportRow[]) => void;
  loading: boolean;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [parsing, setParsing] = useState(false);

  const handleFile = async (file: File) => {
    setParsing(true);
    setFileName(file.name);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });

      // Normaliza chave de coluna: minúsculo, sem acentos, sem qualquer pontuação/espaço.
      // "Data Nasc." → "datanasc", "Dt. Admissão" → "dtadmissao", "E-mail" → "email"
      const nk = (k: string) =>
        k.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[^a-z0-9]/g, "");

      // Converte string DD/MM/YYYY, YYYY-MM-DD ou serial Excel → ISO YYYY-MM-DD
      const parseDateISO = (val: unknown): string | undefined => {
        if (!val) return undefined;
        const s = String(val).trim();
        const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
        if (typeof val === "number") return xlDateToISO(val);
        return undefined;
      };

      const parsed: ImportRow[] = [];
      for (const r of raw) {
        const norm: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(r)) {
          norm[nk(k)] = v;
        }

        const nome =
          norm["nome"] || norm["name"] || norm["colaborador"] || norm["quemusai"] || norm["quemusao"] || norm["quemusa"];
        if (!nome || typeof nome !== "string" || nome.trim().length < 2) continue;

        const emailRaw =
          norm["email"] || norm["email1"] || norm["corretoeletronico"];

        const cargo =
          norm["cargo"] || norm["jobtitle"] || norm["funcao"] || norm["funcaocargo"] || norm["ocupacao"];

        const filial =
          norm["filial"] || norm["filiais"] || norm["unidade"] || norm["department"] || norm["empresa"] || norm["estabelecimento"];

        const admissao =
          norm["admissao"] || norm["dtadmissao"] || norm["dataadmissao"] ||
          norm["admissaodaempresa"] || norm["dataadmissaodaempresa"] || norm["admissiondate"];

        const dataNasc =
          norm["datanasc"] || norm["dtnasc"] || norm["dtnac"] ||
          norm["datanascimento"] || norm["datadenascimento"] ||
          norm["nascimento"] || norm["birthdate"] || norm["datanascimentocompleta"];

        const emailStr = emailRaw
          ? String(emailRaw).trim().toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "")
          : undefined;

        parsed.push({
          name: toTitleCase(String(nome).trim()),
          email: emailStr && emailStr.includes("@") ? emailStr : undefined,
          department: filial ? String(filial).trim() : undefined,
          job_title: cargo ? toTitleCase(String(cargo).trim()) : undefined,
          admission_date: parseDateISO(admissao),
          birth_date: parseDateISO(dataNasc),
        });
      }

      // Dedupe por nome dentro do arquivo
      const seen = new Set<string>();
      const unique = parsed.filter((r) => {
        const key = r.name.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      setRows(unique);
      if (unique.length === 0) {
        alert("Nenhuma linha válida encontrada. Verifique se o arquivo tem as colunas Nome, Cargo e Filial.");
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
              Nome / Quem usa, E-mail, Cargo, Filial / Unidade, Admissão / Data_admissão, Data Nasc. / Data_nascimento
            </p>
            <p className="text-muted-foreground text-xs mt-2">
              Insere novos colaboradores e atualiza os já cadastrados (por nome). Datas de admissão e nascimento são importadas automaticamente.
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
              <div className="inline-flex items-center gap-1.5 chip-accent">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {rows.length} colaboradores prontos para importação
              </div>

              <div className="card-soft overflow-hidden">
                <div className="max-h-72 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-surface-muted text-left font-bold uppercase text-muted-foreground sticky top-0">
                      <tr>
                        <th className="px-3 py-2">Nome</th>
                        <th className="px-3 py-2">E-mail</th>
                        <th className="px-3 py-2">Filial</th>
                        <th className="px-3 py-2">Cargo</th>
                        <th className="px-3 py-2">Admissão</th>
                        <th className="px-3 py-2">Nasc.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.slice(0, 100).map((r, i) => (
                        <tr key={i} className="border-t border-border">
                          <td className="px-3 py-1.5 font-semibold">{r.name}</td>
                          <td className="px-3 py-1.5 text-muted-foreground">{r.email ?? "—"}</td>
                          <td className="px-3 py-1.5 text-muted-foreground">{r.department ?? "—"}</td>
                          <td className="px-3 py-1.5 text-muted-foreground">{r.job_title ?? "—"}</td>
                          <td className="px-3 py-1.5 text-muted-foreground">
                            {r.admission_date ? fmtDate(r.admission_date) : "—"}
                          </td>
                          <td className="px-3 py-1.5 text-muted-foreground">
                            {r.birth_date ? fmtDate(r.birth_date, "dd/mm") : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <button
                onClick={() => onImport(rows)}
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-primary-foreground disabled:opacity-50"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Importar {rows.length} colaboradores
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Utilitários de UI ────────────────────────────────────────────────────── */

const inp =
  "w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-green-500 focus:ring-1 focus:ring-green-500";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
