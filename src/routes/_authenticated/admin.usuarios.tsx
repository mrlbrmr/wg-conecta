import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { KeyRound, Loader2, Plus, Trash2, UserPlus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { createAdminUser, updateAdminUser, deleteAdminUser, resetAdminPassword } from "@/lib/admin.functions";
import { toast } from "sonner";

interface AdminUser { id: string; name: string; email: string; active: boolean }

export const Route = createFileRoute("/_authenticated/admin/usuarios")({
  head: () => ({ meta: [{ title: "Usuários admin — Portal WG" }] }),
  component: UsersPage,
});

function UsersPage() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["admin_users"],
    queryFn: async (): Promise<AdminUser[]> => {
      const { data, error } = await supabase.from("admin_users").select("*").order("name");
      if (error) throw new Error(error.message);
      return (data ?? []) as AdminUser[];
    },
  });
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [resetting, setResetting] = useState<AdminUser | null>(null);

  const create = useServerFn(createAdminUser);
  const update = useServerFn(updateAdminUser);
  const del = useServerFn(deleteAdminUser);
  const reset = useServerFn(resetAdminPassword);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin_users"] });

  const mCreate = useMutation({
    mutationFn: (p: { name: string; email: string; password: string }) => create({ data: p }),
    onSuccess: () => { toast.success("Usuário criado."); invalidate(); setCreating(false); },
    onError: (e: Error) => toast.error(e.message),
  });
  const mUpdate = useMutation({
    mutationFn: (p: { id: string; name?: string; email?: string; active?: boolean }) => update({ data: p }),
    onSuccess: () => { toast.success("Atualizado."); invalidate(); setEditing(null); },
    onError: (e: Error) => toast.error(e.message),
  });
  const mDelete = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("Removido."); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const mReset = useMutation({
    mutationFn: (p: { id: string; password: string }) => reset({ data: p }),
    onSuccess: () => { toast.success("Senha atualizada."); setResetting(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Usuários administrativos</h1>
          <p className="text-sm text-muted-foreground">Equipe do Gente &amp; Gestão que acessa o painel.</p>
        </div>
        <button onClick={() => setCreating(true)} className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:opacity-95">
          <UserPlus className="h-4 w-4" /> Novo admin
        </button>
      </div>

      <div className="card-soft overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface-muted text-left text-xs font-bold uppercase text-muted-foreground">
            <tr><th className="px-4 py-3">Nome</th><th className="px-4 py-3">E-mail</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Ações</th></tr>
          </thead>
          <tbody>
            {(q.data ?? []).map(u => (
              <tr key={u.id} className="border-t border-border">
                <td className="px-4 py-3 font-semibold">{u.name}</td>
                <td className="px-4 py-3">{u.email}</td>
                <td className="px-4 py-3">{u.active ? <span className="chip">Ativo</span> : <span className="text-muted-foreground">Inativo</span>}</td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex gap-1">
                    <button onClick={() => setEditing(u)} className="rounded-lg px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary-softer">Editar</button>
                    <button onClick={() => mUpdate.mutate({ id: u.id, active: !u.active })} className="rounded-lg px-3 py-1.5 text-xs font-bold hover:bg-secondary">
                      {u.active ? "Desativar" : "Ativar"}
                    </button>
                    <button onClick={() => setResetting(u)} className="rounded-lg px-3 py-1.5 text-xs font-bold hover:bg-secondary inline-flex items-center gap-1"><KeyRound className="h-3 w-3" /> Senha</button>
                    <button onClick={() => { if (confirm(`Remover ${u.name}?`)) mDelete.mutate(u.id); }} className="rounded-lg p-2 text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {creating && (
        <Modal title="Novo administrador" onClose={() => setCreating(false)}>
          <UserForm onSubmit={(v) => mCreate.mutate(v)} loading={mCreate.isPending} withPassword />
        </Modal>
      )}
      {editing && (
        <Modal title="Editar administrador" onClose={() => setEditing(null)}>
          <UserForm initial={editing} onSubmit={(v) => mUpdate.mutate({ id: editing.id, name: v.name, email: v.email })} loading={mUpdate.isPending} />
        </Modal>
      )}
      {resetting && (
        <Modal title={`Nova senha — ${resetting.name}`} onClose={() => setResetting(null)}>
          <PasswordForm onSubmit={(pw) => mReset.mutate({ id: resetting.id, password: pw })} loading={mReset.isPending} />
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-6" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md bg-background rounded-t-3xl md:rounded-3xl shadow-elevated">
        <div className="border-b border-border px-6 py-4 flex items-center justify-between">
          <h2 className="font-bold">{title}</h2>
          <button onClick={onClose}><X className="h-4 w-4" /></button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

function UserForm({ initial, onSubmit, loading, withPassword }: { initial?: { name: string; email: string }; onSubmit: (v: { name: string; email: string; password: string }) => void; loading: boolean; withPassword?: boolean }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [password, setPassword] = useState("");
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit({ name, email, password }); }} className="space-y-3">
      <Field label="Nome"><input required value={name} onChange={(e) => setName(e.target.value)} className={inp} /></Field>
      <Field label="E-mail"><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inp} /></Field>
      {withPassword && <Field label="Senha inicial (mín. 8 caracteres)"><input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className={inp} /></Field>}
      <button type="submit" disabled={loading} className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50">
        {loading && <Loader2 className="h-4 w-4 animate-spin" />} Salvar
      </button>
    </form>
  );
}

function PasswordForm({ onSubmit, loading }: { onSubmit: (p: string) => void; loading: boolean }) {
  const [pw, setPw] = useState("");
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(pw); }} className="space-y-3">
      <Field label="Nova senha (mín. 8 caracteres)"><input type="password" required minLength={8} value={pw} onChange={(e) => setPw(e.target.value)} className={inp} /></Field>
      <button type="submit" disabled={loading} className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50">
        {loading && <Loader2 className="h-4 w-4 animate-spin" />} Atualizar senha
      </button>
    </form>
  );
}

const inp = "w-full rounded-xl border border-input bg-surface px-4 py-2.5 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10";
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</span><div className="mt-1.5">{children}</div></label>;
}
