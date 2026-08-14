import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Loader2, MailCheck, RefreshCcw, UserPlus, X } from "lucide-react";
import {
  inviteEmployee,
  listEmployees,
  resendEmployeeInvite,
  triggerEmployeePasswordReset,
  updateEmployee,
} from "@/lib/employee.functions";
import { toast } from "sonner";

type Employee = {
  id: string;
  name: string;
  email: string;
  department: string | null;
  job_title: string | null;
  active: boolean;
  invited_at: string | null;
  created_at: string;
};

export const Route = createFileRoute("/_authenticated/admin/colaboradores")({
  head: () => ({ meta: [{ title: "Colaboradores — Portal WG" }] }),
  component: ColaboradoresPage,
});

function ColaboradoresPage() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["employees"] });

  const doList = useServerFn(listEmployees);
  const doInvite = useServerFn(inviteEmployee);
  const doResend = useServerFn(resendEmployeeInvite);
  const doReset = useServerFn(triggerEmployeePasswordReset);
  const doUpdate = useServerFn(updateEmployee);

  const q = useQuery({
    queryKey: ["employees"],
    queryFn: () => doList(),
  });

  const [inviting, setInviting] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);

  const mInvite = useMutation({
    mutationFn: (p: { name: string; email: string; department?: string; job_title?: string }) =>
      doInvite({ data: p }),
    onSuccess: () => { toast.success("Convite enviado."); invalidate(); setInviting(false); },
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

  const employees = (q.data ?? []) as Employee[];

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Colaboradores</h1>
          <p className="text-sm text-muted-foreground">Gerencie os acessos ao Portal do Colaborador.</p>
        </div>
        <button
          onClick={() => setInviting(true)}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:opacity-95"
        >
          <UserPlus className="h-4 w-4" /> Convidar colaborador
        </button>
      </div>

      <div className="card-soft overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-muted text-left text-xs font-bold uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">E-mail</th>
              <th className="px-4 py-3">Departamento</th>
              <th className="px-4 py-3">Cargo</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {q.isLoading && (
              <tr><td colSpan={6} className="px-4 py-6 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-primary" /></td></tr>
            )}
            {!q.isLoading && employees.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground text-xs">Nenhum colaborador cadastrado.</td></tr>
            )}
            {employees.map((emp) => (
              <tr key={emp.id} className="border-t border-border">
                <td className="px-4 py-3 font-semibold">{emp.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{emp.email}</td>
                <td className="px-4 py-3">{emp.department ?? <span className="text-muted-foreground">—</span>}</td>
                <td className="px-4 py-3">{emp.job_title ?? <span className="text-muted-foreground">—</span>}</td>
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
                    >Editar</button>
                    <button
                      onClick={() => mResend.mutate(emp.id)}
                      disabled={mResend.isPending}
                      title="Reenviar convite"
                      className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold hover:bg-secondary"
                    ><MailCheck className="h-3 w-3" /> Reenviar</button>
                    <button
                      onClick={() => mReset.mutate(emp.email)}
                      disabled={mReset.isPending}
                      title="Enviar link de reset de senha"
                      className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold hover:bg-secondary"
                    ><RefreshCcw className="h-3 w-3" /> Senha</button>
                    <button
                      onClick={() => mToggle.mutate(emp)}
                      disabled={mToggle.isPending}
                      className="rounded-lg px-3 py-1.5 text-xs font-bold hover:bg-secondary"
                    >{emp.active ? "Desativar" : "Reativar"}</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {inviting && (
        <Modal title="Convidar colaborador" onClose={() => setInviting(false)}>
          <EmployeeForm
            onSubmit={(v) => mInvite.mutate(v)}
            loading={mInvite.isPending}
          />
        </Modal>
      )}

      {editing && (
        <Modal title={`Editar — ${editing.name}`} onClose={() => setEditing(null)}>
          <EmployeeForm
            initial={editing}
            onSubmit={(v) => mUpdate.mutate({ id: editing.id, ...v })}
            loading={mUpdate.isPending}
          />
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-6"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-background rounded-t-3xl md:rounded-3xl shadow-elevated"
      >
        <div className="border-b border-border px-6 py-4 flex items-center justify-between">
          <h2 className="font-bold">{title}</h2>
          <button onClick={onClose}><X className="h-4 w-4" /></button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

function EmployeeForm({
  initial,
  onSubmit,
  loading,
}: {
  initial?: Partial<Employee>;
  onSubmit: (v: { name: string; email: string; department?: string; job_title?: string }) => void;
  loading: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [department, setDepartment] = useState(initial?.department ?? "");
  const [jobTitle, setJobTitle] = useState(initial?.job_title ?? "");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ name, email, department: department || undefined, job_title: jobTitle || undefined });
      }}
      className="space-y-3"
    >
      <Field label="Nome completo">
        <input required value={name} onChange={(e) => setName(e.target.value)} className={inp} />
      </Field>
      <Field label="E-mail">
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inp} />
      </Field>
      <Field label="Departamento">
        <input value={department} onChange={(e) => setDepartment(e.target.value)} className={inp} />
      </Field>
      <Field label="Cargo">
        <input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} className={inp} />
      </Field>
      <button
        type="submit"
        disabled={loading || !name.trim() || !email.trim()}
        className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50"
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />} Salvar
      </button>
    </form>
  );
}

const inp = "w-full rounded-xl border border-input bg-surface px-4 py-2.5 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10";
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
