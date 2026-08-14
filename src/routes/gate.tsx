import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { KeyRound, Loader2, LogIn, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { WGLogo } from "@/components/wg-logo";
import { toast } from "sonner";

export const Route = createFileRoute("/gate")({
  head: () => ({ meta: [{ title: "Acesso — Portal do Colaborador WG" }] }),
  component: GatePage,
});

function GatePage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      const msg =
        error.message.includes("Invalid login") || error.message.includes("invalid_credentials")
          ? "E-mail ou senha incorretos."
          : error.message;
      return toast.error(msg);
    }
    toast.success("Bem-vindo(a)!");
    navigate({ to: "/" });
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
            Entre com o e-mail e a senha enviados pelo time de Gente &amp; Gestão.
          </p>
        </div>

        <div className="card-paper p-6 md:p-8 bg-surface">
          <form onSubmit={onSubmit} className="space-y-4">
            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">E-mail</span>
              <div className="mt-2 relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-ink" />
                <input
                  autoFocus
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="w-full border-[1.5px] border-ink bg-paper pl-11 pr-4 py-3.5 text-base outline-none transition focus:bg-accent-soft"
                />
              </div>
            </label>
            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">Senha</span>
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
              disabled={loading || !email.trim() || !password}
              className="w-full btn-ink py-3.5 disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
              Entrar no portal
            </button>
          </form>

          <p className="mt-5 text-xs text-muted-foreground text-center">
            <Link
              to="/colaborador/recuperar-senha"
              className="font-bold text-ink underline-offset-2 hover:underline"
            >
              Esqueci minha senha
            </Link>
          </p>
        </div>

        <p className="mt-6 text-center text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
          Grupo WG · WG Baterias · Uso interno
        </p>
      </div>
    </div>
  );
}
