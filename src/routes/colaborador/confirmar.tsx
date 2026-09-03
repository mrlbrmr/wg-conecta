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

const INVALID_LINK = "Link inválido ou expirado. Solicite um novo acesso ao Gente & Gestão.";

const parseHash = (hash: string) => new URLSearchParams(hash.replace(/^#/, ""));

// Capturado na carga do módulo porque o supabase-js apaga o fragmento ao criar
// o client (detectSessionInUrl) — numa entrada direta pelo link do e-mail, a
// informação já teria sumido quando o efeito rodasse.
const INITIAL_HASH = parseHash(typeof window !== "undefined" ? window.location.hash : "");

const HASH_KEYS = ["access_token", "error", "error_description"] as const;

/**
 * O fragmento vale pelo que estiver disponível: numa navegação client-side o
 * capturado na carga do módulo está obsoleto, e o vivo é quem tem a resposta.
 */
function readHash(): URLSearchParams {
  const live = parseHash(typeof window !== "undefined" ? window.location.hash : "");
  return HASH_KEYS.some((k) => live.get(k)) ? live : INITIAL_HASH;
}

function ConfirmarPage() {
  const { code } = Route.useSearch();
  const navigate = useNavigate();
  const [exchanged, setExchanged] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let settled = false;
    const finish = (ok: boolean, message?: string) => {
      if (settled) return;
      settled = true;
      if (ok) setExchanged(true);
      else setError(message ?? INVALID_LINK);
    };

    const hash = readHash();

    // O GoTrue devolve o erro no fragmento quando o link já foi usado ou venceu.
    const hashError = hash.get("error_description") ?? hash.get("error");
    if (hashError) {
      finish(false, `${INVALID_LINK} (${hashError})`);
      return;
    }

    // Nem código (PKCE) nem token no fragmento (implícito): não há o que validar.
    if (!code && !hash.get("access_token")) {
      finish(false);
      return;
    }

    // Fluxo implícito: o supabase-js consome o #access_token sozinho
    // (detectSessionInUrl) de forma assíncrona — a sessão chega por aqui.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) finish(true);
    });

    void (async () => {
      // Fluxo PKCE: só quando o link traz ?code= (exige que o pedido tenha
      // partido deste mesmo navegador, o que não vale para convite nem para
      // reset disparado pelo painel admin).
      if (code) {
        const { error: e } = await supabase.auth.exchangeCodeForSession(code);
        finish(!e);
        return;
      }
      const { data } = await supabase.auth.getSession();
      if (data.session) finish(true);
    })();

    const timeout = setTimeout(() => finish(false), 8000);
    return () => {
      settled = true;
      clearTimeout(timeout);
      sub.subscription.unsubscribe();
    };
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
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    className="w-full border-[1.5px] border-ink bg-paper pl-11 pr-4 py-3.5 text-base outline-none transition focus:bg-accent-soft"
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
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ShieldCheck className="h-4 w-4" />
                )}
                Salvar e entrar
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
