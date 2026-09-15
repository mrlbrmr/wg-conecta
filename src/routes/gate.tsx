import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { KeyRound, Loader2, LogIn, UserRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { signOut } from "@/lib/session";
import { isCpfLoginEmail, isValidCpf, maskCpf } from "@/lib/cpf";
import { resolveCpfLogin } from "@/lib/cpf-access.functions";
import { WGLogo } from "@/components/wg-logo";
import { toast } from "sonner";

export const Route = createFileRoute("/gate")({
  head: () => ({ meta: [{ title: "Acesso — Portal do Colaborador WG" }] }),
  component: GatePage,
});

function GatePage() {
  const navigate = useNavigate();
  const resolveCpf = useServerFn(resolveCpfLogin);
  /** E-mail ou CPF: quem não tem e-mail corporativo entra com o CPF. */
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  /** Quem já está conectado neste navegador, se houver. */
  const [signedInAs, setSignedInAs] = useState<string | null>(null);

  // Logar por cima de uma sessão aberta misturava as duas contas na mesma aba.
  // Quem já está conectado escolhe: continua ou sai antes.
  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      const user = data.session?.user;
      // Conta de CPF tem e-mail sintético — mostrar o nome em vez dele.
      const name = user?.user_metadata?.name as string | undefined;
      setSignedInAs(user ? (isCpfLoginEmail(user.email) ? (name ?? "seu CPF") : (user.email ?? null)) : null);
    });
  }, []);

  const switchAccount = async () => {
    setLoading(true);
    await signOut();
    setLoading(false);
    setSignedInAs(null);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = identifier.trim();
    const byCpf = !value.includes("@");
    if (byCpf && !isValidCpf(value)) return toast.error("CPF inválido. Confira os 11 dígitos.");

    setLoading(true);
    try {
      const email = byCpf ? (await resolveCpf({ data: { cpf: value } })).email : value;
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        const wrong =
          error.message.includes("Invalid login") || error.message.includes("invalid_credentials");
        return toast.error(
          wrong ? (byCpf ? "CPF ou senha incorretos." : "E-mail ou senha incorretos.") : error.message,
        );
      }
      // Senha provisória do G&G: primeiro cria a própria.
      if (data.user?.app_metadata?.must_change_password) {
        return navigate({ to: "/colaborador/nova-senha" });
      }
      toast.success("Bem-vindo(a)!");
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
          <div className="inline-flex items-center gap-2 bg-ink text-paper px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em]">
            Comunicação Interna · Grupo WG
          </div>
          <div className="mt-6 flex justify-center">
            <WGLogo className="h-20 w-20" />
          </div>
          <h1 className="mt-5 text-3xl font-black tracking-tighter leading-none">
            Aqui é <span className="italic text-primary">WG</span>.
          </h1>
          <p className="mt-3 text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
            Entre com seu e-mail ou CPF e a senha enviada pelo time de Gente &amp; Gestão.
          </p>
        </div>

        <div className="card-paper p-6 md:p-8 bg-surface">
          {signedInAs ? (
            <div className="space-y-4 text-center">
              <p className="text-sm leading-relaxed">
                Você já está conectado como <strong className="break-all">{signedInAs}</strong>.
              </p>
              <button
                type="button"
                onClick={() => navigate({ to: "/" })}
                className="w-full btn-ink py-3.5"
              >
                <LogIn className="h-4 w-4" />
                Continuar no portal
              </button>
              <button
                type="button"
                onClick={switchAccount}
                disabled={loading}
                className="w-full text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground underline-offset-2 hover:text-ink hover:underline disabled:opacity-50"
              >
                Não é você? Sair e entrar com outra conta
              </button>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <label className="block">
                <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">
                  E-mail ou CPF
                </span>
                <div className="mt-2 relative">
                  <UserRound className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-ink" />
                  <input
                    autoFocus
                    type="text"
                    required
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    value={identifier}
                    onChange={(e) => {
                      const v = e.target.value;
                      // Só dígitos e pontuação de CPF: aplica a máscara enquanto digita.
                      setIdentifier(/^[\d.\-\s]*$/.test(v) ? maskCpf(v) : v);
                    }}
                    placeholder="seu@email.com ou 000.000.000-00"
                    className="w-full border-[1.5px] border-ink bg-paper pl-11 pr-4 py-3.5 text-base outline-none transition focus:bg-accent-soft"
                  />
                </div>
              </label>
              <label className="block">
                <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">
                  Senha
                </span>
                <div className="mt-2 relative">
                  <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-ink" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full border-[1.5px] border-ink bg-paper pl-11 pr-4 py-3.5 text-base outline-none transition focus:bg-accent-soft"
                  />
                </div>
              </label>
              <button
                type="submit"
                disabled={loading || !identifier.trim() || !password}
                className="w-full btn-ink py-3.5 disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <LogIn className="h-4 w-4" />
                )}
                Entrar no portal
              </button>
            </form>
          )}

          <p className="mt-5 text-xs text-muted-foreground text-center">
            <Link
              to="/colaborador/recuperar-senha"
              className="font-bold text-ink underline-offset-2 hover:underline"
            >
              Esqueci minha senha
            </Link>
            <span className="mt-1.5 block">Entra com CPF? Peça uma senha nova ao G&amp;G.</span>
          </p>
        </div>

        <p className="mt-6 text-center text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
          Grupo WG · WG Baterias · Uso interno
        </p>
      </div>
    </div>
  );
}
