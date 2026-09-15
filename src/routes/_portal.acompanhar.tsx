import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  Chip,
  FormSection,
  InkButton,
  Kicker,
  PageHeading,
  PaperCard,
  TextArea,
  TextInput,
} from "@/components/paper";
import {
  CHANNEL_META,
  SUBMISSION_STATUS_LABEL,
  normalizeAccessKey,
  normalizeProtocol,
  renderSubmission,
} from "@/lib/anonymous-defs";
import { followUpAnonymous, replyAnonymous } from "@/lib/anonymous.functions";
import { formatDate } from "@/lib/tenure";

/**
 * Acompanhar um envio do Canal de Escuta ou do SIM pelo protocolo + chave.
 * Os dois ficam só no estado da tela — nunca na URL, que vai para histórico e logs.
 */
export const Route = createFileRoute("/_portal/acompanhar")({
  head: () => ({ meta: [{ title: "Acompanhar — Portal WG" }] }),
  component: AcompanharPage,
});

function AcompanharPage() {
  const followUp = useServerFn(followUpAnonymous);
  const reply = useServerFn(replyAnonymous);
  const [protocol, setProtocol] = useState("");
  const [key, setKey] = useState("");
  const [message, setMessage] = useState("");

  const lookup = useMutation({
    mutationFn: () => followUp({ data: { protocol, key } }),
  });

  const send = useMutation({
    mutationFn: () => reply({ data: { protocol, key, body: message } }),
    onSuccess: () => {
      setMessage("");
      lookup.mutate();
    },
  });

  const found = lookup.data;

  return (
    <div>
      <PageHeading
        kicker="Canal de Escuta · SIM"
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
              placeholder="ESC-XXXXXX"
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
              Perdeu a chave? Não há como recuperar. Se precisar, envie de novo pelo{" "}
              <Link to="/canal-de-escuta" className="font-bold text-primary hover:underline">
                Canal de Escuta
              </Link>{" "}
              ou pelo{" "}
              <Link to="/sim" className="font-bold text-primary hover:underline">
                SIM
              </Link>
              .
            </p>
          </form>
        </PaperCard>

        {found ? (
          <PaperCard className="overflow-hidden">
            <header className="flex flex-wrap items-start justify-between gap-3 border-b-[1.5px] border-ink px-6 py-6 md:px-8">
              <div>
                <Kicker>{CHANNEL_META[found.channel].title}</Kicker>
                <p className="mt-2 font-mono text-[22px] font-black tracking-[0.03em]">
                  {found.protocol}
                </p>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  Enviado em {formatDate(found.received_on)}
                </p>
              </div>
              <Chip tone={found.status === "concluido" ? "success" : "accent"}>
                {SUBMISSION_STATUS_LABEL[found.status]}
              </Chip>
            </header>

            <FormSection title="O que você enviou" divider={false}>
              <dl className="grid gap-3">
                {renderSubmission(found.channel, found.payload).map((e) => (
                  <div key={e.key}>
                    <dt className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground">
                      {e.label}
                    </dt>
                    <dd className="mt-0.5 whitespace-pre-wrap text-[14.5px] leading-[1.6]">
                      {e.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </FormSection>

            <FormSection title="Conversa">
              {found.messages.length === 0 ? (
                <p className="text-[14.5px] text-muted-foreground">
                  O G&amp;G ainda não respondeu. Volte aqui daqui a alguns dias.
                </p>
              ) : (
                <ol className="flex flex-col gap-3">
                  {found.messages.map((m) => (
                    <li
                      key={m.id}
                      className={
                        m.from_gg
                          ? "mr-8 rounded-lg border-[1.5px] border-ink bg-accent-soft p-4"
                          : "ml-8 rounded-lg border-[1.5px] border-ink/30 bg-surface p-4"
                      }
                    >
                      <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground">
                        {m.from_gg ? "Gente & Gestão" : "Você"} · {formatDate(m.sent_on)}
                      </p>
                      <p className="mt-1.5 whitespace-pre-wrap text-[14.5px] leading-[1.6]">
                        {m.body}
                      </p>
                    </li>
                  ))}
                </ol>
              )}

              {found.status !== "concluido" && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (message.trim()) send.mutate();
                  }}
                  className="mt-5 flex flex-col gap-3 pb-7"
                >
                  <TextArea
                    label="Escrever ao G&G"
                    rows={3}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Complementar o relato, responder uma pergunta…"
                  />
                  <div>
                    <InkButton type="submit" disabled={send.isPending || !message.trim()}>
                      {send.isPending ? "Enviando…" : "Enviar mensagem"}
                    </InkButton>
                  </div>
                  {send.isError && (
                    <p className="text-sm font-semibold text-destructive">
                      {(send.error as Error).message}
                    </p>
                  )}
                </form>
              )}
              {found.status === "concluido" && <div className="pb-7" />}
            </FormSection>
          </PaperCard>
        ) : (
          <PaperCard tone="soft" className="p-8">
            <p className="text-xl font-black tracking-tight">
              Digite o protocolo e a chave para ver o andamento.
            </p>
            <p className="mt-2 text-[15px] leading-[1.65] text-muted-foreground">
              Eles aparecem na tela logo depois do envio — ESC-… para o Canal de Escuta, SIM-…
              para sugestões de melhoria.
            </p>
          </PaperCard>
        )}
      </div>
    </div>
  );
}
