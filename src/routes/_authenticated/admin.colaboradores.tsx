import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import * as XLSX from "xlsx";
import {
  CheckCircle2, Loader2, MailCheck, RefreshCcw, Search,
  ShieldOff, Upload, UserPlus, X,
} from "lucide-react";
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
      const r = res as { inserted: number; skipped: number };
      toast.success(`${r.inserted} colaboradores importados${r.skipped > 0 ? ` · ${r.skipped} ignorados (já existiam)` : ""}.`);
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
      <div className="mb-4 flex items-center justify-between gap-4 flex-wrap">
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

      {/* Busca e filtros */}
      <div className="mb-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, e-mail, filial ou cargo…"
            className="w-full rounded-xl border border-input bg-surface pl-9 pr-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
          />
        </div>
        <div className="inline-flex rounded-xl border border-input overflow-hidden bg-surface text-sm font-semibold">
          {(["todos", "ativos", "inativos"] as StatusFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-4 py-2 capitalize transition ${statusFilter === s ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}
            >
              {s} <span className="ml-1 text-xs opacity-70">({counts[s]})</span>
            </button>
          ))}
        </div>
      </div>

      <div className="card-soft overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-muted text-left text-xs font-bold uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">E-mail</th>
              <th className="px-4 py-3">Filial / Cargo</th>
              <th className="px-4 py-3">Admissão</th>
              <th className="px-4 py-3">Acesso</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {q.isLoading && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto text-primary" />
                </td>
              </tr>
            )}
            {!q.isLoading && filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-muted-foreground text-xs">
                  {employees.length === 0
                    ? "Nenhum colaborador cadastrado."
                    : "Nenhum resultado para os filtros aplicados."}
                </td>
              </tr>
            )}
            {filtered.map((emp) => (
              <tr key={emp.id} className="border-t border-border">
                <td className="px-4 py-3 font-semibold">{emp.name}</td>
                <td className="px-4 py-3 text-muted-foreground text-xs">{emp.email ?? <span className="italic">—</span>}</td>
                <td className="px-4 py-3">
                  {emp.department && <div className="text-xs font-bold">{emp.department}</div>}
                  {emp.job_title && <div className="text-xs text-muted-foreground">{emp.job_title}</div>}
                  {!emp.department && !emp.job_title && <span className="text-muted-foreground">—</span>}
                </td>
                <td className="px-4 py-3 text-muted-foreground text-xs">{fmtDate(emp.admission_date) ?? "—"}</td>
                <td className="px-4 py-3">
                  {emp.auth_user_id
                    ? <span className="chip">Portal</span>
                    : <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground"><ShieldOff className="h-3 w-3" /> Sem acesso</span>
                  }
                </td>
                <td className="px-4 py-3">
                  {emp.active
                    ? <span className="chip">Ativo</span>
                    : <span className="text-xs font-semibold text-muted-foreground">Inativo</span>
                  }
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex flex-wrap gap-1 justify-end">
                    <button
                      onClick={() => setEditing(emp)}
                      className="rounded-lg px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary-softer"
                    >
                      Editar
                    </button>
                    {emp.auth_user_id ? (
                      <>
                        <button
                          onClick={() => mResend.mutate(emp.id)}
                          disabled={mResend.isPending}
                          title="Reenviar convite"
                          className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold hover:bg-secondary"
                        >
                          <MailCheck className="h-3 w-3" /> Convite
                        </button>
                        {emp.email && (
                          <button
                            onClick={() => mReset.mutate(emp.email!)}
                            disabled={mReset.isPending}
                            title="Enviar link de reset de senha"
                            className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold hover:bg-secondary"
                          >
                            <RefreshCcw className="h-3 w-3" /> Senha
                          </button>
                        )}
                      </>
                    ) : (
                      <button
                        onClick={() => setInvitingExisting(emp)}
                        className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary-softer"
                      >
                        <MailCheck className="h-3 w-3" /> Dar acesso
                      </button>
                    )}
                    <button
                      onClick={() => mToggle.mutate(emp)}
                      disabled={mToggle.isPending}
                      className="rounded-lg px-3 py-1.5 text-xs font-bold hover:bg-secondary"
                    >
                      {emp.active ? "Desativar" : "Reativar"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length > 0 && (
        <p className="mt-2 text-xs text-muted-foreground text-right">
          {filtered.length} de {employees.length} colaboradores
        </p>
      )}

      {/* Modal: cadastrar colaborador no diretório (sem convite) */}
      {adding && (
        <Modal title="Cadastrar colaborador" onClose={() => setAdding(false)}>
          <p className="text-xs text-muted-foreground mb-4">
            O colaborador é adicionado ao diretório. Para dar acesso ao portal, use "Dar acesso" depois.
          </p>
          <EmployeeForm onSubmit={(v) => mAdd.mutate(v)} loading={mAdd.isPending} />
        </Modal>
      )}

      {/* Modal: editar colaborador existente */}
      {editing && (
        <Modal title={`Editar — ${editing.name}`} onClose={() => setEditing(null)}>
          <EmployeeForm
            initial={editing}
            onSubmit={(v) => mUpdate.mutate({ id: editing.id, ...v })}
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
          <p className="text-sm text-muted-foreground mb-4">
            Informe o e-mail deste colaborador para enviar o convite de acesso ao Portal.
          </p>
          <InviteExistingForm
            onSubmit={(email) =>
              mInviteExisting.mutate({ employeeId: invitingExisting.id, email })
            }
            loading={mInviteExisting.isPending}
          />
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
      className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-6"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-background rounded-t-3xl md:rounded-3xl shadow-elevated max-h-[95vh] overflow-y-auto"
      >
        <div className="sticky top-0 bg-background border-b border-border px-6 py-4 flex items-center justify-between">
          <h2 className="font-bold">{title}</h2>
          <button onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-6">{children}</div>
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
  loading,
}: {
  initial?: Partial<Employee>;
  onSubmit: (v: EmployeeFormValues) => void;
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
      className="space-y-3"
    >
      <Field label="Nome completo">
        <input required value={name} onChange={(e) => setName(e.target.value)} className={inp} />
      </Field>
      <Field label="E-mail (opcional)">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="nome@wgbaterias.com.br"
          className={inp}
        />
      </Field>

      <div className="pt-1 pb-0.5">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Dados profissionais
        </span>
      </div>

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

      <div className="pt-1 pb-0.5">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Dados pessoais
        </span>
      </div>

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

      <button
        type="submit"
        disabled={loading || !name.trim()}
        className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50 mt-2"
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />} Salvar
      </button>
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

      const parsed: ImportRow[] = [];
      for (const r of raw) {
        // normaliza chaves
        const norm: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(r)) {
          norm[k.toLowerCase().trim().replace(/\s+/g, "_")] = v;
        }

        const nome =
          norm["nome"] || norm["name"] || norm["colaborador"] || norm["quem_usa"];
        if (!nome || typeof nome !== "string" || nome.trim().length < 2) continue;

        const emailRaw =
          norm["e-mail"] || norm["email"] || norm["e_mail"];

        const cargo =
          norm["cargo"] || norm["job_title"] || norm["função"] || norm["funcao"];

        const filial =
          norm["filial"] || norm["filiais"] || norm["unidade"] || norm["department"];

        const admissao =
          norm["admissão"] || norm["admissao"] || norm["admission_date"] || norm["data_admissão"] || norm["data_admissao"];

        const emailStr = emailRaw ? String(emailRaw).trim().toLowerCase() : undefined;

        parsed.push({
          name: toTitleCase(String(nome).trim()),
          email: emailStr && emailStr.includes("@") ? emailStr : undefined,
          department: filial ? String(filial).trim() : undefined,
          job_title: cargo ? toTitleCase(String(cargo).trim()) : undefined,
          admission_date: xlDateToISO(admissao),
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
              Nome / Quem usa, E-mail, Cargo, Filial / Filiais / Unidade, Admissão / Data_admissão
            </p>
            <p className="text-muted-foreground text-xs mt-2">
              Colaboradores já existentes (pelo nome ou e-mail) serão ignorados.
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
  "w-full rounded-xl border border-input bg-surface px-4 py-2.5 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
