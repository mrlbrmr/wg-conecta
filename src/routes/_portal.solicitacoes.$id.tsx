import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Paperclip } from "lucide-react";
import { toast } from "sonner";
import { Chip, InkButton, Kicker, PaperCard, TextArea } from "@/components/paper";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ownRequestsQuery,
  requestMessagesQuery,
  REQUEST_STATUS_LABEL,
  REQUEST_STATUS_TONE,
} from "@/lib/profile-queries";
import { getRequestAttachmentUrl, postRequestMessage } from "@/lib/portal-write.functions";
import { renderPayload } from "@/lib/form-defs";
import { directoryQuery } from "@/lib/directory-queries";
import { formatDate } from "@/lib/tenure";
import { fmtDateTime } from "@/lib/employee-ui";

/**
 * Acompanhamento de uma solicitação.
 *
 * `request_messages` e `postRequestMessage` já existiam, mas não havia tela: o
 * "Ver conversa ↗" do catálogo e do perfil davam a volta e voltavam ao começo.
 * É aqui que a resposta do G&G aparece e o colaborador responde de volta.
 */
export const Route = createFileRoute("/_portal/solicitacoes/$id")({
  head: () => ({ meta: [{ title: "Solicitação — Portal WG" }] }),
  component: RequestDetailPage,
});

function RequestDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  // O RLS já limita a lista às próprias solicitações, então buscar na lista
  // evita uma query nova e mantém o cache compartilhado com "Meus envios".
  const requests = useQuery(ownRequestsQuery);
  const messages = useQuery(requestMessagesQuery(id));
  const directory = useQuery(directoryQuery);

  const send = useServerFn(postRequestMessage);
  const doAttachment = useServerFn(getRequestAttachmentUrl);
  const [body, setBody] = useState("");

  const request = (requests.data ?? []).find((r) => r.id === id) ?? null;

  const mutation = useMutation({
    mutationFn: () => send({ data: { request_id: id, body: body.trim() } }),
    onSuccess: () => {
      setBody("");
      qc.invalidateQueries({ queryKey: ["request_messages", id] });
      toast.success("Mensagem enviada.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openAttachment = async () => {
    try {
      const { url } = await doAttachment({ data: { request_id: id } });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  if (requests.isLoading) return <Skeleton className="h-96 w-full" />;

  if (!request) {
    return (
      <PaperCard tone="soft" className="p-8">
        <p className="text-xl font-black tracking-tight">Solicitação não encontrada.</p>
        <p className="mt-2 text-[15px] leading-[1.65] text-muted-foreground">
          Ou ela não é sua, ou o link está velho.
        </p>
        <InkButton className="mt-5" asChild>
          <Link to="/formularios">Voltar ao catálogo</Link>
        </InkButton>
      </PaperCard>
    );
  }

  const entries = renderPayload(request.subject ?? "", request.payload);
  const nameOf = (employeeId: string | null) =>
    employeeId ? ((directory.data ?? []).find((d) => d.id === employeeId)?.name ?? null) : null;

  return (
    <div>
      <button
        type="button"
        onClick={() => navigate({ to: "/formularios" })}
        className="mb-6 text-xs font-extrabold uppercase tracking-[0.12em] text-muted-foreground hover:text-ink"
      >
        ← Voltar ao catálogo
      </button>

      <PaperCard className="overflow-hidden">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b-[1.5px] border-ink px-6 py-7 md:px-8">
          <div className="min-w-0">
            <p className="text-[11.5px] font-extrabold uppercase tracking-[0.14em] tabular-nums text-primary">
              Protocolo {request.protocol}
              {request.subject ? ` · ${request.subject}` : ""}
            </p>
            <h1 className="mt-1.5 text-[24px] font-black leading-[1.15] tracking-[-0.035em] sm:text-[28px]">
              {request.title}
            </h1>
            <p className="mt-1.5 text-[13.5px] tabular-nums text-muted-foreground">
              Enviada em {formatDate(request.created_at)}
              {request.due_date ? ` · prazo até ${formatDate(request.due_date)}` : ""}
            </p>
          </div>
          <Chip tone={REQUEST_STATUS_TONE[request.status] ?? "soft"}>
            {REQUEST_STATUS_LABEL[request.status] ?? request.status}
          </Chip>
        </header>

        {entries.length > 0 && (
          <section className="px-6 pt-7 md:px-8">
            <Kicker>O que você enviou</Kicker>
            <dl className="mt-4">
              {entries.map((e) => (
                <div
                  key={e.label}
                  className="grid gap-1 border-b border-border py-3 last:border-b-0 sm:grid-cols-[200px_1fr] sm:gap-4"
                >
                  <dt className="text-[13px] font-bold text-muted-foreground">{e.label}</dt>
                  <dd className="whitespace-pre-line text-[14.5px]">{e.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        {request.attachment_path && (
          <div className="px-6 pt-5 md:px-8">
            <InkButton variant="outline" onClick={openAttachment} className="gap-2">
              <Paperclip className="h-3.5 w-3.5" /> Abrir anexo
            </InkButton>
          </div>
        )}

        <section className="px-6 py-7 md:px-8">
          <Kicker>Conversa</Kicker>

          {messages.isLoading ? (
            <Skeleton className="mt-4 h-24 w-full" />
          ) : (messages.data ?? []).length === 0 ? (
            <p className="mt-3 text-[14.5px] leading-[1.6] text-muted-foreground">
              Ainda não há mensagens. Quando o time responder, aparece aqui — e você recebe por
              e-mail.
            </p>
          ) : (
            <ul className="mt-4 flex flex-col gap-3">
              {(messages.data ?? []).map((m) => (
                <li key={m.id} className="rounded-lg border border-border bg-surface p-4">
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground">
                    {nameOf(m.author_id) ?? "Gente & Gestão"} · {fmtDateTime(m.created_at)}
                  </p>
                  <p className="mt-1.5 whitespace-pre-line text-[14.5px] leading-[1.6]">{m.body}</p>
                </li>
              ))}
            </ul>
          )}

          {request.status !== "concluida" ? (
            <div className="mt-5">
              <TextArea
                label="Responder"
                rows={3}
                placeholder="Alguma informação a mais? Manda aqui."
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
              <InkButton
                className="mt-3"
                disabled={body.trim().length < 2 || mutation.isPending}
                onClick={() => mutation.mutate()}
              >
                {mutation.isPending ? "Enviando…" : "Enviar mensagem ↗"}
              </InkButton>
            </div>
          ) : (
            <p className="mt-5 text-[13.5px] leading-[1.6] text-muted-foreground">
              Esta solicitação foi concluída. Se precisar retomar o assunto, abra uma nova pelo
              catálogo.
            </p>
          )}
        </section>
      </PaperCard>
    </div>
  );
}
