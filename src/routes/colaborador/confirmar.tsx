import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { WGLogo } from "@/components/wg-logo";
import { toast } from "sonner";

export const Route = createFileRoute("/colaborador/confirmar")({
  validateSearch: z.object({ code: z.string().optional() }).parse,
  head: () => ({ meta: [{ title: "Defina sua senha — Portal WG" }] }),
  component: ConfirmarPage,
});

function ConfirmarPage() {
  const { code } = Route.useSearch();
  const navigate = useNavigate();
  const [exchanged, setExchanged] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!code) {
      setError("Link inválido ou expirado. Solicite um novo acesso ao Gente & Gestão.");
      return;
    }
    supabase.auth.exchangeCodeForSession(code).then(({ error: e }) => {
      if (e) setError("Link inválido ou expirado. Solicite um novo acesso ao Gente & Gestão.");
      else setExchanged(true);
    });
  }, [code]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return toast.error("A senha deve ter pelo menos 8 caracteres.");
    if (password !== confirm) return toast.error("As senhas não conferem.");
    setLoading(true);
    const { error: updateErr } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updateErr) return toast.error(updateErr.message);
    toast.success("Senha definida com sucesso! Bem-vindo(a).");
    navigate({ to: "/" });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mt-6 flex justify-center">
            <WGLogo className="h-20 w-20" />
          </div>
          <h1 className="mt-5 text-2xl font-black tracking-tight">
            {exchanged ? "Defina sua senha" : "Verificando link…"}
          </h1>
        </div>

        <div className="card-paper p-6 md:p-8 bg-surface">
          {error ? (
            <div className="text-center space-y-3">
              <p className="text-sm text-destructive font-semibold">{error}</p>
              <a href="/gate" className="text-xs underline text-muted-foreground">
                Voltar ao login
              </a>
            </div>
          ) : !exchanged ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Crie uma senha segura (mínimo 8 caracteres) para acessar o portal.
              </p>
              <label className="block">
                <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">Nova senha</span>
                <div className="mt-2 relative">
                  <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-ink" />
                  <input
                    autoFocus
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    className="w-full border-[1.5px] border-ink bg-paper pl-11 pr-4 py-3.5 text-base outline-none transition focus:bg-accent-soft"
                  />
                </div>
              </label>
              <label className="block">
                <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">Confirmar senha</span>
                <div className="mt-2 relative">
                  <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-ink" />
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Repita a senha"
                    className="w-full border-[1.5px] border-ink bg-paper pl-11 pr-4 py-3.5 text-base outline-none transition focus:bg-accent-soft"
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
          )}
        </div>
      </div>
    </div>
  );
}
