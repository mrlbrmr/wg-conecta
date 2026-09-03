import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { Check } from "lucide-react";
import { InkButton } from "@/components/paper";

export const Route = createFileRoute("/_portal/formularios/enviado")({
  head: () => ({ meta: [{ title: "Solicitação enviada — Portal WG" }] }),
  validateSearch: z.object({ protocolo: z.coerce.number().int().optional() }),
  component: SentPage,
});

function SentPage() {
  const { protocolo } = Route.useSearch();

  return (
    <div className="mx-auto my-14 max-w-[560px] text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-[14px] bg-ink text-accent">
        <Check className="h-[26px] w-[26px]" />
      </div>

      <h1 className="mt-5 text-[30px] font-black tracking-[-0.04em] sm:text-[34px]">
        Solicitação enviada!
      </h1>

      {protocolo && (
        <p className="mt-4 inline-block rounded-full border-[1.5px] border-ink bg-accent-soft px-4 py-2 text-[13px] font-extrabold uppercase tracking-[0.12em] tabular-nums">
          Protocolo {protocolo}
        </p>
      )}

      <p className="mt-4 text-[15px] leading-[1.6] text-muted-foreground">
        A gente responde o mais rápido possível. Resposta em até 3 dias úteis — e o andamento fica
        guardado no seu perfil.
      </p>

      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <InkButton variant="accent" asChild>
          <Link to="/formularios">Voltar ao catálogo</Link>
        </InkButton>
        <InkButton variant="outline" asChild>
          <Link to="/perfil" search={{ aba: "solicitacoes" }}>
            Acompanhar solicitação
          </Link>
        </InkButton>
      </div>
    </div>
  );
}
