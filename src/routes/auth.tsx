import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { KeyRound, Loader2, LogIn, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { WGLogo } from "@/components/wg-logo";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Área administrativa — Portal WG" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/admin" });
    });
  }, [navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Bem-vindo(a)!");
    navigate({ to: "/admin" });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-softer via-background to-accent-soft flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center gap-3 mb-6">
          <WGLogo className="h-16 w-16" />
          <h1 className="text-2xl font-black text-center">Painel Administrativo</h1>
          <p className="text-sm text-muted-foreground text-center">Acesso restrito à equipe de Gente &amp; Gestão.</p>
        </div>
        <div className="card-soft p-6 md:p-8">
          <form onSubmit={onSubmit} className="space-y-4">
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">E-mail</span>
              <div className="relative mt-2">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-2xl border border-input bg-surface pl-11 pr-4 py-3 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10" />
              </div>
            </label>
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Senha</span>
              <div className="relative mt-2">
                <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-2xl border border-input bg-surface pl-11 pr-4 py-3 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10" />
              </div>
            </label>
            <button type="submit" disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3.5 text-base font-bold text-primary-foreground transition hover:opacity-95 disabled:opacity-50">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
              Entrar
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
