import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { Paperclip } from "lucide-react";
import { toast } from "sonner";
import { Chip, InkButton, Kicker, PaperCard } from "@/components/paper";
import { UserAvatar } from "@/components/user-avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  activeAnnouncementsQuery,
  announcementByIdQuery,
  type Announcement,
} from "@/lib/portal-queries";
import {
  REACTIONS,
  commentsQuery,
  ownReadsQuery,
  reactionsQuery,
  type ReactionId,
} from "@/lib/mural-queries";
import { currentEmployeeQuery } from "@/hooks/use-current-employee";
import { directoryQuery } from "@/lib/directory-queries";
import {
  postComment,
  setAnnouncementReaction,
  setAnnouncementRead,
} from "@/lib/portal-write.functions";
import { fileUrl } from "@/lib/storage";
import { formatDate } from "@/lib/tenure";
import { cn } from "@/lib/utils";

const PRIVACY_NOTE =
  "Uso interno. Nada de CPF, telefone pessoal, endereço, documentos ou dados bancários por aqui.";

export const Route = createFileRoute("/_portal/mural/$id")({
  head: () => ({ meta: [{ title: "Comunicado — Portal WG" }] }),
  component: AnnouncementDetail,
});

function AnnouncementDetail() {
  const { id } = Route.useParams();
  const announcement = useQuery(announcementByIdQuery(id));
  const reads = useQuery(ownReadsQuery);
  const me = useQuery(currentEmployeeQuery);

  const qc = useQueryClient();
  const markRead = useServerFn(setAnnouncementRead);
  const autoMarked = useRef(false);

  const read = (reads.data ?? []).some((r) => r.announcement_id === id);

  // Abrir o comunicado já conta como leitura; o toggle manual continua valendo.
  useEffect(() => {
    if (autoMarked.current || reads.isLoading || read || !me.data) return;
    autoMarked.current = true;
    markRead({ data: { announcement_id: id, read: true } })
      .then(() => qc.invalidateQueries({ queryKey: ["announcement_reads"] }))
      .catch(() => {
        autoMarked.current = false;
      });
  }, [id, read, reads.isLoading, me.data, markRead, qc]);

  if (announcement.isLoading) {
    return (
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Skeleton className="h-[28rem] w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const a = announcement.data;
  if (!a) {
    return (
      <PaperCard tone="soft" className="p-8">
        <p className="text-xl font-black tracking-tight">Comunicado não encontrado.</p>
        <p className="mt-2 text-[15px] leading-[1.65] text-muted-foreground">
          Ele pode ter ido para o arquivo. Dá uma olhada por lá.
        </p>
        <InkButton variant="outline" className="mt-5" asChild>
          <Link to="/mural">← Voltar ao mural</Link>
        </InkButton>
      </PaperCard>
    );
  }

  const paragraphs = (a.content ?? "")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <div>
      <Link
        to="/mural"
        className="inline-flex text-xs font-extrabold uppercase tracking-[0.14em] text-muted-foreground transition hover:text-primary"
      >
        ← Voltar ao mural
      </Link>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[1fr_340px]">
        <div className="grid gap-6">
          <PaperCard className="p-6 md:p-9">
            <div className="flex flex-wrap items-center gap-2.5">
              {a.category && (
                <span className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-primary">
                  {a.category}
                </span>
              )}
              <span className="h-1 w-1 rounded-full bg-border" />
              <span className="text-[11px] font-bold uppercase tracking-[0.14em] tabular-nums text-muted-foreground">
                {formatDate(a.published_at)}
              </span>
              {a.important && <Chip tone="accent">Importante</Chip>}
              {a.pinned && <Chip>Fixado</Chip>}
            </div>

            <h1 className="mt-4 text-[28px] font-black leading-[1.02] tracking-[-0.04em] text-balance sm:text-[34px] lg:text-[40px]">
              {a.title}
            </h1>

            {(a.lead ?? a.summary) && (
              <p className="mt-4 max-w-[58ch] text-lg font-semibold leading-[1.6] text-pretty">
                {a.lead ?? a.summary}
              </p>
            )}

            {a.image_url && (
              <img
                src={fileUrl(a.image_url) ?? ""}
                alt=""
                className="mt-6 max-h-80 w-full rounded-lg border-[1.5px] border-ink object-cover"
              />
            )}

            {paragraphs.length > 0 && (
              <div className="mt-6 flex max-w-[62ch] flex-col gap-4">
                {paragraphs.map((p, i) => (
                  <p key={i} className="text-[17px] leading-[1.75] text-pretty">
                    {p}
                  </p>
                ))}
              </div>
            )}

            {a.attachment_url && (
              <a
                href={fileUrl(a.attachment_url) ?? "#"}
                target="_blank"
                rel="noreferrer"
                className="mt-6 inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.12em] text-primary hover:text-ink"
              >
                <Paperclip className="h-3.5 w-3.5" /> Abrir o anexo ↗
              </a>
            )}

            <Reactions announcementId={a.id} read={read} />
          </PaperCard>

          <Comments announcementId={a.id} canComment={Boolean(me.data)} />
        </div>

        <div className="grid gap-6">
          <PublisherCard announcement={a} />
          <AlsoRead currentId={a.id} />
        </div>
      </div>
    </div>
  );
}

// ── Reações ───────────────────────────────────────────────────────────

function Reactions({ announcementId, read }: { announcementId: string; read: boolean }) {
  const qc = useQueryClient();
  const me = useQuery(currentEmployeeQuery);
  const all = useQuery(reactionsQuery);
  const react = useServerFn(setAnnouncementReaction);
  const markRead = useServerFn(setAnnouncementRead);

  const forThis = (all.data ?? []).filter((r) => r.announcement_id === announcementId);
  const mine = forThis.find((r) => r.employee_id === me.data?.id)?.reaction as
    | ReactionId
    | undefined;

  const mutation = useMutation({
    mutationFn: (reaction: ReactionId) =>
      react({
        data: { announcement_id: announcementId, reaction: mine === reaction ? null : reaction },
      }),
    onSettled: () => qc.invalidateQueries({ queryKey: ["announcement_reactions"] }),
    onError: () => toast.error("Não conseguimos salvar agora. Tenta de novo em instantes?"),
  });

  const readMutation = useMutation({
    mutationFn: () => markRead({ data: { announcement_id: announcementId, read: !read } }),
    onSettled: () => qc.invalidateQueries({ queryKey: ["announcement_reads"] }),
  });

  return (
    <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t-[1.5px] border-ink pt-5">
      <div className="flex flex-wrap gap-2">
        {REACTIONS.map((r) => {
          const count = forThis.filter((x) => x.reaction === r.id).length;
          const active = mine === r.id;
          return (
            <button
              key={r.id}
              type="button"
              aria-pressed={active}
              disabled={mutation.isPending}
              onClick={() => mutation.mutate(r.id)}
              className={cn(
                "rounded-full border-[1.5px] border-ink px-3.5 py-2 text-xs font-extrabold uppercase tracking-[0.04em] transition-colors duration-[120ms] ease-standard disabled:opacity-50",
                active ? "bg-accent text-ink" : "bg-surface text-ink hover:bg-accent-soft",
              )}
            >
              {r.label} <span className="tabular-nums">{count}</span>
            </button>
          );
        })}
      </div>

      <InkButton
        variant={read ? "outline" : "ink"}
        disabled={readMutation.isPending}
        onClick={() => readMutation.mutate()}
      >
        {read ? "Lido ✓" : "Marcar como lido"}
      </InkButton>
    </div>
  );
}

// ── Comentários ───────────────────────────────────────────────────────

function Comments({ announcementId, canComment }: { announcementId: string; canComment: boolean }) {
  const qc = useQueryClient();
  const comments = useQuery(commentsQuery(announcementId));
  const directory = useQuery(directoryQuery);
  const send = useServerFn(postComment);
  const [draft, setDraft] = useState("");

  const byId = new Map((directory.data ?? []).map((e) => [e.id, e]));

  const mutation = useMutation({
    mutationFn: () => send({ data: { announcement_id: announcementId, body: draft.trim() } }),
    onSuccess: () => {
      toast.success("Comentário publicado!");
      setDraft("");
      qc.invalidateQueries({ queryKey: ["announcement_comments"] });
    },
    onError: () => toast.error("Não conseguimos salvar agora. Tenta de novo em instantes?"),
  });

  return (
    <section>
      <Kicker>Comentários</Kicker>

      <div className="mt-4 flex flex-col gap-3">
        {(comments.data ?? []).map((c) => {
          const author = c.author_id ? byId.get(c.author_id) : null;
          return (
            <PaperCard key={c.id} tone="soft" className="grid grid-cols-[40px_1fr] gap-4 p-[18px]">
              <UserAvatar name={author?.name} photoUrl={author?.photo_url} size={40} tone="muted" />
              <div className="min-w-0">
                <p className="text-xs font-extrabold uppercase tracking-[0.1em] text-muted-foreground">
                  {author?.name ?? "Time WG"} · {formatDate(c.created_at)}
                  {c.official ? " · G&G" : ""}
                </p>
                <p className="mt-1.5 text-[15px] leading-[1.65] text-pretty">{c.body}</p>
              </div>
            </PaperCard>
          );
        })}

        {(comments.data ?? []).length === 0 && !comments.isLoading && (
          <p className="text-[15px] leading-[1.65] text-muted-foreground">
            Ninguém comentou ainda. Pode ser você o primeiro.
          </p>
        )}
      </div>

      {canComment && (
        <PaperCard className="mt-4 p-5">
          <label className="sr-only" htmlFor="novo-comentario">
            Seu comentário
          </label>
          <textarea
            id="novo-comentario"
            rows={2}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ficou com dúvida ou quer somar alguma coisa?"
            className="w-full resize-y rounded-lg border-[1.5px] border-ink bg-surface px-3.5 py-3 text-[15px] leading-[1.6] outline-none"
          />
          <div className="mt-3 flex flex-wrap items-center gap-4">
            <InkButton
              disabled={draft.trim() === "" || mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? "Publicando…" : "Comentar"}
            </InkButton>
            <p className="text-xs leading-[1.6] text-muted-foreground">{PRIVACY_NOTE}</p>
          </div>
        </PaperCard>
      )}
    </section>
  );
}

// ── Lateral ───────────────────────────────────────────────────────────

function PublisherCard({ announcement: a }: { announcement: Announcement }) {
  return (
    <PaperCard tone="accent" className="p-6">
      <Kicker>Quem publicou</Kicker>
      <p className="mt-4 text-[22px] font-black tracking-[-0.03em]">
        {a.author_name ?? "Gente & Gestão"}
      </p>
      <p className="mt-1 text-sm">{a.author_role ?? "Comunicação interna"}</p>
      <p className="mt-4 text-sm leading-[1.6] text-ink/75">
        Dúvida sobre esse comunicado? Manda pra gente sem cerimônia.
      </p>
      <InkButton variant="ink" className="mt-5" asChild>
        <Link to="/gente-gestao/contatos">Falar com o G&amp;G ↗</Link>
      </InkButton>
    </PaperCard>
  );
}

function AlsoRead({ currentId }: { currentId: string }) {
  const all = useQuery(activeAnnouncementsQuery);
  const others = (all.data ?? []).filter((a) => a.id !== currentId).slice(0, 3);
  if (others.length === 0) return null;

  return (
    <PaperCard tone="soft" className="p-6">
      <Kicker>Leia também</Kicker>
      <ul className="mt-3">
        {others.map((a) => (
          <li key={a.id} className="border-b border-border py-3 last:border-b-0">
            {a.category && (
              <span className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-primary">
                {a.category}
              </span>
            )}
            <Link
              to="/mural/$id"
              params={{ id: a.id }}
              className="mt-0.5 block text-[15px] font-extrabold leading-tight hover:text-primary"
            >
              {a.title}
            </Link>
          </li>
        ))}
      </ul>
    </PaperCard>
  );
}
