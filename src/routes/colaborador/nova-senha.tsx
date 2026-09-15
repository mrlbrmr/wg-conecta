import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { WGLogo } from "@/components/wg-logo";
import { finishPasswordChange } from "@/lib/cpf-access.functions";
import { signOut } from "@/lib/session";
import { toast } from "sonner";

/**
 * Primeiro acesso de quem entra por CPF: a senha provisória que o G&G entregou só serve para
 * chegar aqui. A pessoa cria a própria senha e só então entra no portal.
 */
export const Route = createFileRoute("/colaborador/nova-senha")({
  ssr: false,
  head: () => ({ meta: [{ title: "Crie sua senha — Portal WG" }] }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/gate" });
    return { name: (data.user.user_metadata?.name as string | undefined) ?? null };
  },
  component: NovaSenhaPage,
});

const INPUT =
  "w-full border-[1.5px] border-ink bg-paper pl-11 pr-4 py-3.5 text-base outline-none transition focus:bg-accent-soft";

function NovaSenhaPage() {
  const { name } = Route.useRouteContext();
  const navigate = useNavigate();
  const finish = useServerFn(finishPasswordChange);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return toast.error("A senha deve ter pelo menos 8 caracteres.");
    if (password !== confirm) return toast.error("As senhas não conferem.");
    setLoading(true);
    try {
      await finish({ data: { password } });
      // A sessão precisa da flag nova; se não der para renovar, entra de novo com a senha nova.
      const { error } = await supabase.auth.refreshSession();
      if (error) {
        await signOut();
        toast.success("Senha criada. Entre de novo com seu CPF e a senha nova.");
        return navigate({ to: "/gate" });
      }
      toast.success("Senha criada. Bem-vindo(a)!");
      navigate({ to: "/" });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="flex justify-center">
            <WGLogo className="h-16 w-16" />
          </div>
          <h1 className="mt-5 text-2xl font-black tracking-tight">
            {name ? `Olá, ${name.split(" ")[0]}!` : "Crie sua senha"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
            A senha que o G&amp;G entregou vale só para este primeiro acesso. Crie agora a sua — é
            ela que você vai usar daqui pra frente, junto com o CPF.
          </p>
        </div>

        <div className="card-paper p-6 md:p-8 bg-surface">
          <form onSubmit={onSubmit} className="space-y-4">
            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">
                Nova senha
              </span>
              <div className="mt-2 relative">
                <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-ink" />
                <input
                  autoFocus
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  className={INPUT}
                />
              </div>
            </label>
            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">
                Confirmar senha
              </span>
              <div className="mt-2 relative">
                <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-ink" />
                <input
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Repita a senha"
                  className={INPUT}
                />
              </div>
            </label>
            <button
              type="submit"
              disabled={loading || !password || !confirm}
              className="w-full btn-ink py-3.5 disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              Salvar e entrar
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
