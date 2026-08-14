import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { z } from "zod";
import { KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { verifyAccessCode } from "@/lib/access.functions";
import { grantAccess } from "@/lib/access";
import { WGLogo } from "@/components/wg-logo";
import { toast } from "sonner";

const searchSchema = z.object({ next: z.string().optional() });

export const Route = createFileRoute("/gate")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({ meta: [{ title: "Acesso — Portal do Colaborador WG" }] }),
  component: GatePage,
});

function GatePage() {
  const { next } = Route.useSearch();
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const verify = useServerFn(verifyAccessCode);
  const mutation = useMutation({
    mutationFn: async (c: string) => verify({ data: { code: c } }),
    onSuccess: (r) => {
      if (r.ok) {
        grantAccess();
        toast.success("Acesso liberado. Seja bem-vindo(a)!");
        navigate({ to: (next ?? "/") as "/" });
      } else {
        toast.error("Código incorreto. Fale com Gente & Gestão.");
      }
    },
    onError: () => toast.error("Não foi possível validar o código."),
  });

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
            Digite o código combinado com o time de Gente &amp; Gestão pra entrar.
          </p>
        </div>

        <div className="card-paper p-6 md:p-8 bg-surface">
          <form
            onSubmit={(e) => { e.preventDefault(); if (code.trim()) mutation.mutate(code); }}
            className="space-y-4"
          >
            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">Código de acesso</span>
              <div className="mt-2 relative">
                <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-ink" />
                <input
                  autoFocus
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Digite o código WG"
                  className="w-full border-[1.5px] border-ink bg-paper pl-11 pr-4 py-3.5 text-base font-semibold outline-none transition focus:bg-accent-soft"
                />
              </div>
            </label>
            <button
              type="submit"
              disabled={mutation.isPending || !code.trim()}
              className="w-full btn-ink py-3.5 disabled:opacity-50"
            >
              {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              Entrar no portal
            </button>
          </form>

          <p className="mt-5 text-xs text-muted-foreground text-center">
            Não tem o código? Chama o <span className="font-bold text-ink">Gente &amp; Gestão</span>.
          </p>
        </div>

        <p className="mt-6 text-center text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
          Grupo WG · WG Baterias · Uso interno
        </p>
      </div>
    </div>
  );
}
