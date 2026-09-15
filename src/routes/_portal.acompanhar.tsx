import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { InkButton, PageHeading, PaperCard, TextInput } from "@/components/paper";
import { AuthorSubmissionCard } from "@/components/channel/submission-thread";
import { normalizeAccessKey, normalizeProtocol } from "@/lib/channel-defs";
import { followUpByKey, replyByKey } from "@/lib/channel.functions";

/**
 * Acompanhar um envio feito sem identificação, pelo protocolo + chave.
 * Os dois ficam só no estado da tela — nunca na URL, que vai para histórico e logs.
 */
export const Route = createFileRoute("/_portal/acompanhar")({
  head: () => ({ meta: [{ title: "Acompanhar — Portal WG" }] }),
  component: AcompanharPage,
});

function AcompanharPage() {
  const followUp = useServerFn(followUpByKey);
  const reply = useServerFn(replyByKey);
  const [protocol, setProtocol] = useState("");
  const [key, setKey] = useState("");

  const lookup = useMutation({
    mutationFn: () => followUp({ data: { protocol, key } }),
  });

  return (
    <div>
      <PageHeading
        kicker="SIM · Acompanhar"
        title="Acompanhar."
        subtitle="Com o protocolo e a chave que você recebeu ao enviar, veja a resposta do G&G e continue a conversa — sem se identificar."
      />

      <div className="mt-8 grid items-start gap-7 lg:grid-cols-[340px_minmax(0,1fr)]">
        <PaperCard asChild className="p-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              lookup.mutate();
            }}
            className="flex flex-col gap-4"
          >
            <TextInput
              label="Protocolo"
              value={protocol}
              onChange={(e) => setProtocol(normalizeProtocol(e.target.value))}
              placeholder="SIM-XXXXXX"
              autoComplete="off"
              className="font-mono uppercase"
            />
            <TextInput
              label="Chave"
              value={key}
              onChange={(e) => setKey(normalizeAccessKey(e.target.value))}
              placeholder="XXXX-XXXX"
              autoComplete="off"
              className="font-mono uppercase"
            />
            <InkButton type="submit" disabled={lookup.isPending || !protocol || !key}>
              {lookup.isPending ? "Buscando…" : "Ver andamento"}
            </InkButton>
            {lookup.isError && (
              <p className="text-sm font-semibold text-destructive">
                {(lookup.error as Error).message}
              </p>
            )}
            <p className="text-xs leading-[1.6] text-muted-foreground">
              Perdeu a chave? Não há como recuperar. Se precisar,{" "}
              <Link to="/sim" className="font-bold text-primary hover:underline">
                envie de novo
              </Link>
              . Enviou com seu nome? Está em{" "}
              <Link
                to="/perfil"
                search={{ aba: "solicitacoes" }}
                className="font-bold text-primary hover:underline"
              >
                Meu perfil
              </Link>
              .
            </p>
          </form>
        </PaperCard>

        {lookup.data ? (
          <AuthorSubmissionCard
            submission={lookup.data}
            onSend={async (body) => {
              await reply({ data: { protocol, key, body } });
              await lookup.mutateAsync();
            }}
          />
        ) : (
          <PaperCard tone="soft" className="p-8">
            <p className="text-xl font-black tracking-tight">
              Digite o protocolo e a chave para ver o andamento.
            </p>
            <p className="mt-2 text-[15px] leading-[1.65] text-muted-foreground">
              Eles aparecem na tela logo depois do envio — o protocolo começa com SIM-.
            </p>
          </PaperCard>
        )}
      </div>
    </div>
  );
}
