import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import * as XLSX from "xlsx";
import {
  AlertCircle, CheckCircle2, ImagePlus, Loader2, MailCheck, MoreHorizontal,
  Pencil, RefreshCcw, Search, ShieldOff, Upload, UserPlus, X,
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
  updateEmployeePhotoUrl,
} from "@/lib/employee.functions";
import { supabase } from "@/integrations/supabase/client";
import { avatarColor, fmtDate, initials } from "@/lib/employee-ui";
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
  admission_date: string | null;
  active: boolean;
  invited_at: string | null;
  created_at: string;
  photo_url: string | null;
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
  const doUpdatePhoto = useServerFn(updateEmployeePhotoUrl);

  const q = useQuery({ queryKey: ["employees"], queryFn: () => doList() });

  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [invitingExisting, setInvitingExisting] = useState<Employee | null>(null);
  const [importing, setImporting] = useState(false);
  const [importingPhotos, setImportingPhotos] = useState(false);
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
    <div>
      <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-black">Colaboradores</h1>
          <p className="text-sm text-gray-700">
            Gerencie o diretório e os acessos ao Portal do Colaborador.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setImporting(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border-2 border-black bg-white px-4 py-2 text-sm font-bold text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-y-[2px] hover:translate-x-[2px] transition-all"
          >
            <Upload className="h-4 w-4" /> Importar XLSX
          </button>
          <button
            onClick={() => setImportingPhotos(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border-2 border-black bg-white px-4 py-2 text-sm font-bold text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-y-[2px] hover:translate-x-[2px] transition-all"
          >
            <ImagePlus className="h-4 w-4" /> Importar fotos
          </button>
          <button
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#8FD152] px-4 py-2 text-sm font-bold text-black border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-y-[2px] hover:translate-x-[2px] transition-all"
          >
            <UserPlus className="h-4 w-4" /> Cadastrar colaborador
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
        {/* Toolbar: busca e filtros */}
        <div className="flex flex-col sm:flex-row items-center gap-4 px-4 py-3 border-b border-black/20">
          {/* Busca */}
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-black/40 pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, e-mail, filial ou cargo…"
              className="w-full rounded-lg border-2 border-black/20 bg-white pl-9 pr-4 py-2 text-sm text-black outline-none transition focus:border-black focus:ring-2 focus:ring-black/10"
            />
          </div>
          {/* Tabs de filtro */}
          <div className="inline-flex items-center gap-1 rounded-lg bg-black/5 p-1 border border-black/20">
            {(["todos", "ativos", "inativos"] as StatusFilter[]).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`rounded px-3 py-1 text-sm transition-all ${
                  statusFilter === s
                    ? "bg-white border border-black text-black font-bold"
                    : "text-gray-700 hover:text-black"
                }`}
              >
                <span className="capitalize">{s}</span>
                <span className={`ml-1.5 text-xs ${statusFilter === s ? "text-black/60" : "text-gray-500"}`}>
                  {counts[s]}
                </span>
              </button>
            ))}
          </div>
          {/* Contador */}
          {employees.length > 0 && (
            <span className="text-xs text-gray-700 sm:ml-auto whitespace-nowrap">
              {filtered.length} de {employees.length} colaboradores
            </span>
          )}
        </div>

        {/* Tabela */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/20 bg-black/5">
                <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-black">Colaborador</th>
                <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-black">Filial / Cargo</th>
                <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-black">Admissão</th>
                <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-black">Acesso</th>
                <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-black">Status</th>
                <th className="px-6 py-3 text-right text-xs font-bold uppercase tracking-wider text-black">Ações</th>
              </tr>
            </thead>
            <tbody>
              {q.isLoading && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto text-[#2F8F4A]" />
                  </td>
                </tr>
              )}
              {!q.isLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-gray-700 text-sm">
                    {employees.length === 0
                      ? "Nenhum colaborador cadastrado."
                      : "Nenhum resultado para os filtros aplicados."}
                  </td>
                </tr>
              )}
              {filtered.map((emp) => (
                <tr key={emp.id} className="border-b border-black/20 last:border-0 hover:bg-[#F5F2E9]/50 transition-colors">
                  {/* Colaborador: avatar + nome + email */}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {emp.photo_url ? (
                        <img
                          src={emp.photo_url}
                          alt={emp.name}
                          className="h-9 w-9 shrink-0 rounded-full object-cover object-top"
                        />
                      ) : (
                        <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${avatarColor(emp.name)}`}>
                          {initials(emp.name)}
                        </span>
                      )}
                      <div>
                        <div className="font-medium text-black">{emp.name}</div>
                        {emp.email && (
                          <div className="text-xs text-gray-700">{emp.email}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  {/* Filial / Cargo */}
                  <td className="px-6 py-4">
                    {emp.department && <div className="text-sm font-medium text-black">{emp.department}</div>}
                    {emp.job_title && <div className="text-xs text-gray-700">{emp.job_title}</div>}
                    {!emp.department && !emp.job_title && <span className="text-gray-500">—</span>}
                  </td>
                  {/* Admissão */}
                  <td className="px-6 py-4 text-sm text-gray-700">
                    {fmtDate(emp.admission_date) ?? <span className="text-gray-500">—</span>}
                  </td>
                  {/* Acesso */}
                  <td className="px-6 py-4">
                    {emp.auth_user_id ? (
                      <span className="inline-flex items-center rounded px-2.5 py-0.5 text-xs font-bold text-black bg-blue-100 border border-black/30">Portal</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded px-2.5 py-0.5 text-xs font-bold text-black border border-black/20 bg-white">
                        <ShieldOff className="h-3 w-3" /> Sem acesso
                      </span>
                    )}
                  </td>
                  {/* Status */}
                  <td className="px-6 py-4">
                    {emp.active ? (
                      <span className="inline-flex items-center rounded px-2.5 py-0.5 text-xs font-bold text-black bg-[#8FD152]/30 border border-black/40">Ativo</span>
                    ) : (
                      <span className="inline-flex items-center rounded px-2.5 py-0.5 text-xs font-bold text-black bg-white border border-black/30">Inativo</span>
                    )}
                  </td>
                  {/* Ações */}
                  <td className="px-6 py-4 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="rounded-lg p-1.5 text-gray-500 hover:text-black hover:bg-black/5 transition-colors">
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

      {/* Modal: importação em lote de fotos */}
      {importingPhotos && (
        <PhotoImportModal
          employees={employees}
          onSaveUrl={(id, url) => doUpdatePhoto({ data: { id, photo_url: url } })}
          onClose={() => { setImportingPhotos(false); invalidate(); }}
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
  unit?: string;
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
  const [unit, setUnit] = useState(initial?.unit ?? "");
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
          unit: unit || undefined,
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
          <Field label="Unidade">
            <input
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="Matriz SJP, CD Sorocaba…"
              className={inp}
            />
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
  "w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-green-500 focus:ring-1 focus:ring-green-500";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
