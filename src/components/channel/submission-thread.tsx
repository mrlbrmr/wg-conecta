import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Chip, FormSection, InkButton, Kicker, PaperCard, TextArea } from "@/components/paper";
import {
  CHANNEL_META,
  SUBMISSION_STATUS_LABEL,
  SUBMISSION_STATUS_TONE,
  renderSubmission,
  type Channel,
} from "@/lib/channel-defs";
import type { SubmissionDetail } from "@/lib/channel.functions";
import { formatDate } from "@/lib/tenure";
import { cn } from "@/lib/utils";

/**
 * Peças do envio que se repetem em três telas: "Acompanhar" (protocolo + chave), o SIM
 * identificado (`/sim/$id`) e o painel do G&G.
 */

/** O envio como quem enviou vê: cabeçalho, o que escreveu e a conversa com o G&G. */
export function AuthorSubmissionCard({
  submission: s,
  onSend,
}: {
  submission: SubmissionDetail;
  onSend: (body: string) => Promise<unknown>;
}) {
  const closed = s.status === "concluido";
  return (
    <PaperCard className="overflow-hidden">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b-[1.5px] border-ink px-6 py-6 md:px-8">
        <div>
          <Kicker>{CHANNEL_META[s.channel].title}</Kicker>
          <p className="mt-2 font-mono text-[22px] font-black tracking-[0.03em]">{s.protocol}</p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Enviado em {formatDate(s.received_on)}
          </p>
        </div>
        <Chip tone={SUBMISSION_STATUS_TONE[s.status]}>{SUBMISSION_STATUS_LABEL[s.status]}</Chip>
      </header>

      <FormSection title="O que você enviou" divider={false}>
        <SubmissionFields channel={s.channel} payload={s.payload} />
      </FormSection>

      <FormSection title="Conversa">
        <div className="pb-7">
          <SubmissionConversation
            messages={s.messages}
            viewer="author"
            closed={closed}
            emptyText="O G&G ainda não respondeu. Volte aqui daqui a alguns dias."
            replyLabel="Escrever ao G&G"
            placeholder="Complementar o que você enviou, responder uma pergunta…"
            onSend={onSend}
          />
        </div>
      </FormSection>
    </PaperCard>
  );
}

/** Os campos preenchidos, com rótulo, na ordem do formulário. */
export function SubmissionFields({
  channel,
  payload,
  className,
}: {
  channel: Channel;
  payload: Record<string, string>;
  className?: string;
}) {
  return (
    <dl className={cn("grid gap-3", className)}>
      {renderSubmission(channel, payload).map((e) => (
        <div key={e.key}>
          <dt className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground">
            {e.label}
          </dt>
          <dd className="mt-0.5 whitespace-pre-wrap text-[14.5px] leading-[1.6]">{e.value}</dd>
        </div>
      ))}
    </dl>
  );
}

interface Message {
  id: string;
  from_gg: boolean;
  body: string;
  sent_on: string;
}

/**
 * A conversa e o campo de resposta. `viewer` decide de que lado fica cada mensagem: a de quem
 * está lendo vai à direita.
 */
export function SubmissionConversation({
  messages,
  viewer,
  authorLabel = "Quem enviou",
  closed = false,
  emptyText,
  replyLabel,
  placeholder,
  onSend,
}: {
  messages: Message[];
  viewer: "author" | "gg";
  authorLabel?: string;
  /** Concluído: some o campo de resposta. */
  closed?: boolean;
  emptyText: string;
  replyLabel: string;
  placeholder: string;
  onSend: (body: string) => Promise<unknown>;
}) {
  const [text, setText] = useState("");
  const send = useMutation({
    mutationFn: (body: string) => onSend(body),
    onSuccess: () => setText(""),
  });

  return (
    <div>
      {messages.length === 0 ? (
        <p className="text-[14.5px] text-muted-foreground">{emptyText}</p>
      ) : (
        <ol className="flex flex-col gap-3">
          {messages.map((m) => {
            const mine = viewer === "gg" ? m.from_gg : !m.from_gg;
            const who = m.from_gg
              ? viewer === "gg"
                ? "G&G"
                : "Gente & Gestão"
              : viewer === "gg"
                ? authorLabel
                : "Você";
            return (
              <li
                key={m.id}
                className={cn(
                  "rounded-lg border-[1.5px] p-4",
                  mine ? "ml-8" : "mr-8",
                  m.from_gg ? "border-ink bg-accent-soft" : "border-ink/30 bg-surface",
                )}
              >
                <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground">
                  {who} · {formatDate(m.sent_on)}
                </p>
                <p className="mt-1.5 whitespace-pre-wrap text-[14.5px] leading-[1.6]">{m.body}</p>
              </li>
            );
          })}
        </ol>
      )}

      {!closed && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim()) send.mutate(text);
          }}
          className="mt-5 flex flex-col gap-3"
        >
          <TextArea
            label={replyLabel}
            rows={3}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={placeholder}
          />
          <div>
            <InkButton type="submit" disabled={send.isPending || !text.trim()}>
              {send.isPending ? "Enviando…" : "Enviar mensagem"}
            </InkButton>
          </div>
          {send.isError && (
            <p className="text-sm font-semibold text-destructive">{(send.error as Error).message}</p>
          )}
        </form>
      )}
    </div>
  );
}
