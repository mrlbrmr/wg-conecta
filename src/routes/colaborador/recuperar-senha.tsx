import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Loader2, Mail, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { WGLogo } from "@/components/wg-logo";
import { normalizeSiteUrl } from "@/lib/site-url";
import { toast } from "sonner";

// O fallback precisa da guarda de `window`: como ele é argumento, e não mais o
// lado direito de um `??`, é avaliado mesmo quando VITE_SITE_URL está definida —
// e este módulo também roda no servidor.
const SITE_URL = normalizeSiteUrl(
  import.meta.env.VITE_SITE_URL,
  typeof window !== "undefined" ? window.location.origin : undefined,
);

export const Route = createFileRoute("/colaborador/recuperar-senha")({
  head: () => ({ meta: [{ title: "Recuperar senha — Portal WG" }] }),
  component: RecuperarSenhaPage,
});

function RecuperarSenhaPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${SITE_URL}/colaborador/confirmar`,
    });
    setLoading(false);
    // Sem isto, uma recusa do Supabase (limite de envio, SMTP, redirect não
    // autorizado) aparecia como sucesso e o e-mail simplesmente nunca chegava.
    if (error) return toast.error(error.message);
    setSent(true);
    toast.success("E-mail enviado! Verifique sua caixa de entrada.");
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="flex justify-center">
            <WGLogo className="h-16 w-16" />
          </div>
          <h1 className="mt-5 text-2xl font-black tracking-tight">Recuperar senha</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Informe seu e-mail e enviaremos um link para criar uma nova senha.
          </p>
        </div>

        <div className="card-paper p-6 md:p-8 bg-surface">
          {sent ? (
            <div className="text-center space-y-4">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                <Mail className="h-6 w-6 text-primary" />
              </div>
              <p className="text-sm font-semibold">Verifique seu e-mail</p>
              <p className="text-xs text-muted-foreground">
                Se o endereço <strong>{email}</strong> estiver cadastrado, você receberá o link em
                breve.
              </p>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <label className="block">
                <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">
                  E-mail
                </span>
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
              <button
                type="submit"
                disabled={loading || !email.trim()}
                className="w-full btn-ink py-3.5 disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Enviar link de recuperação
              </button>
            </form>
          )}
        </div>

        <div className="mt-5 text-center">
          <Link
            to="/gate"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-ink"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Voltar ao login
          </Link>
        </div>
      </div>
    </div>
  );
}
