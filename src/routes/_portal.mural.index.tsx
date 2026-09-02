import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { z } from "zod";
import { Pin, Search } from "lucide-react";
import { Chip, IconBubble, InkButton, Kicker, PageHeading, PaperCard } from "@/components/paper";
import { ReadToggle } from "@/components/read-toggle";
import { Skeleton } from "@/components/ui/skeleton";
import { activeAnnouncementsQuery, type Announcement } from "@/lib/portal-queries";
import { commentCountsQuery, countBy, ownReadsQuery, reactionsQuery } from "@/lib/mural-queries";
import { formatDate } from "@/lib/tenure";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_portal/mural/")({
  head: () => ({ meta: [{ title: "Mural — Portal WG" }] }),
  validateSearch: z.object({
    q: z.string().optional(),
    cat: z.string().optional(),
  }),
  component: MuralFeed,
});

const TODOS = "Todos";

function MuralFeed() {
  const { q = "", cat = TODOS } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  const announcements = useQuery(activeAnnouncementsQuery);
  const reads = useQuery(ownReadsQuery);
  const reactions = useQuery(reactionsQuery);
  const comments = useQuery(commentCountsQuery);

  const items = useMemo(() => announcements.data ?? [], [announcements.data]);
  const readIds = useMemo(
    () => new Set((reads.data ?? []).map((r) => r.announcement_id)),
    [reads.data],
  );
  const reactionCounts = countBy(reactions.data ?? [], (r) => r.announcement_id);
  const commentCounts = countBy(comments.data ?? [], (c) => c.announcement_id);

  const categories = useMemo(() => {
    const found = Array.from(new Set(items.map((a) => a.category).filter(Boolean) as string[]));
    return [TODOS, ...found.sort((a, b) => a.localeCompare(b, "pt-BR"))];
  }, [items]);

  const filtering = q.trim() !== "" || cat !== TODOS;

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return items.filter((a) => {
      if (cat !== TODOS && a.category !== cat) return false;
      if (!term) return true;
      return [a.title, a.summary, a.category]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(term));
    });
  }, [items, q, cat]);

  const headline = !filtering ? (items.find((a) => a.headline) ?? items[0]) : undefined;
  const pinned = !filtering
    ? items.filter((a) => a.pinned && a.id !== headline?.id).slice(0, 5)
    : [];
  const listed = filtering ? filtered : items.filter((a) => a.id !== headline?.id);
  const unread = items.filter((a) => !readIds.has(a.id)).length;

  const setSearch = (next: { q?: string; cat?: string }) =>
    navigate({
      search: (prev) => {
        const merged = { ...prev, ...next };
        return {
          q: merged.q?.trim() ? merged.q : undefined,
          cat: merged.cat && merged.cat !== TODOS ? merged.cat : undefined,
        };
      },
      replace: true,
    });

  return (
    <div>
      <PageHeading
        kicker={`Mural · edição de ${formatDate(new Date().toISOString())}`}
        title="O que tá no ar hoje."
        subtitle="Comunicados oficiais do Grupo WG, em ordem de importância. O que você já leu sai do contador — o resto fica esperando por você."
        action={
          <>
            <span className="text-xs font-bold uppercase tracking-[0.16em] tabular-nums text-muted-foreground">
              {unread > 0 ? `${unread} não lidos` : "Tudo lido por aqui"}
            </span>
            <InkButton variant="outline" asChild>
              <Link to="/mural/arquivo">Arquivo</Link>
            </InkButton>
          </>
        }
      />

      {/* Busca e categorias */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <form
          onSubmit={(e) => e.preventDefault()}
          role="search"
          className="flex min-w-[280px] max-w-[560px] flex-1 items-center border-[1.5px] border-ink bg-surface"
        >
          <Search className="ml-3.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <label className="sr-only" htmlFor="busca-mural">
            Buscar no mural
          </label>
          <input
            id="busca-mural"
            value={q}
            onChange={(e) => setSearch({ q: e.target.value })}
            placeholder="Buscar por título, resumo ou categoria"
            className="w-full bg-transparent px-3 py-3 text-sm outline-none"
          />
          {q.trim() !== "" && (
            <button
              type="button"
              onClick={() => setSearch({ q: "" })}
              className="mr-3 shrink-0 text-[11px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground hover:text-ink"
            >
              Limpar
            </button>
          )}
        </form>

        <div className="flex flex-wrap gap-2">
          {categories.map((c) => {
            const active = c === cat;
            return (
              <button
                key={c}
                type="button"
                aria-pressed={active}
                onClick={() => setSearch({ cat: c })}
                className={cn(
                  "rounded-full border-[1.5px] border-ink px-3.5 py-2 text-xs font-extrabold uppercase tracking-[0.04em] transition-colors duration-[120ms] ease-standard",
                  active ? "bg-ink text-accent" : "bg-surface text-ink hover:bg-accent-soft",
                )}
              >
                {c}
              </button>
            );
          })}
        </div>
      </div>

      {announcements.isLoading ? (
        <div className="mt-10 grid gap-4">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : announcements.isError ? (
        <PaperCard tone="soft" className="mt-10 p-8">
          <p className="text-xl font-black tracking-tight">
            Não conseguimos carregar o mural agora.
          </p>
          <p className="mt-2 text-[15px] leading-[1.65] text-muted-foreground">
            Tenta de novo em instantes?
          </p>
        </PaperCard>
      ) : (
        <>
          {headline && (
            <div className="mt-9 grid gap-4 lg:grid-cols-12">
              <HeadlineCard announcement={headline} className="lg:col-span-8" />
              <PinnedCard items={pinned} readIds={readIds} className="lg:col-span-4" />
            </div>
          )}

          <section className="mt-10">
            <div className="flex flex-wrap items-end justify-between gap-4 border-b-[1.5px] border-ink pb-3.5">
              <div>
                <Kicker>{filtering ? "Resultado" : "Também no ar"}</Kicker>
                <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] sm:text-3xl">
                  {filtering ? "Comunicados filtrados" : "O resto do mural"}
                </h2>
              </div>
              <span className="text-xs font-bold uppercase tracking-[0.14em] tabular-nums text-muted-foreground">
                {listed.length} {listed.length === 1 ? "comunicado" : "comunicados"}
              </span>
            </div>

            {listed.length === 0 ? (
              <PaperCard tone="soft" className="mt-6 p-8">
                <p className="text-xl font-black tracking-tight">
                  Nenhum comunicado com esse filtro.
                </p>
                <p className="mt-2 max-w-[56ch] text-[15px] leading-[1.65] text-muted-foreground">
                  Tenta outra categoria ou limpa a busca — o arquivo também guarda os que já
                  venceram.
                </p>
                <InkButton
                  variant="outline"
                  className="mt-5"
                  onClick={() => navigate({ search: {}, replace: true })}
                >
                  Limpar filtros
                </InkButton>
              </PaperCard>
            ) : (
              <div className="mt-6 flex flex-col gap-4">
                {listed.map((a) => (
                  <FeedCard
                    key={a.id}
                    announcement={a}
                    read={readIds.has(a.id)}
                    reactionCount={reactionCounts[a.id] ?? 0}
                    commentCount={commentCounts[a.id] ?? 0}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

// ── Manchete ──────────────────────────────────────────────────────────

function HeadlineCard({
  announcement: a,
  className,
}: {
  announcement: Announcement;
  className?: string;
}) {
  return (
    <PaperCard tone="ink" className={cn("flex flex-col p-7 md:p-9", className)}>
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-accent">
          Manchete
        </span>
        <span className="h-1 w-1 rounded-full bg-paper/40" />
        {a.important && <Chip tone="accent">Importante</Chip>}
        {a.pinned && <Chip>Fixado</Chip>}
        {a.category && (
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-paper/70">
            {a.category}
          </span>
        )}
      </div>

      <h2 className="mt-5 text-[30px] font-black leading-[0.98] tracking-[-0.045em] text-balance sm:text-[38px] lg:text-[48px]">
        {a.title}
      </h2>

      {a.summary && (
        <p className="mt-4 max-w-[44ch] text-[17px] leading-[1.6] text-paper/[0.78] lg:text-[19px]">
          {a.summary}
        </p>
      )}

      <div className="mt-7 flex flex-wrap items-center justify-between gap-4">
        <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-paper/60">
          {formatDate(a.published_at)}
          {a.author_name ? ` · ${a.author_name}` : ""}
        </span>
        <InkButton variant="accent" asChild>
          <Link to="/mural/$id" params={{ id: a.id }}>
            Ler comunicado ↗
          </Link>
        </InkButton>
      </div>
    </PaperCard>
  );
}

// ── Fixados ───────────────────────────────────────────────────────────

function PinnedCard({
  items,
  readIds,
  className,
}: {
  items: Announcement[];
  readIds: Set<string>;
  className?: string;
}) {
  return (
    <PaperCard className={cn("p-6", className)}>
      <div className="flex items-center justify-between gap-3">
        <Kicker>Fixados</Kicker>
        <IconBubble size={32}>
          <Pin />
        </IconBubble>
      </div>

      {items.length === 0 ? (
        <p className="mt-4 text-sm leading-[1.6] text-muted-foreground">
          Nada fixado agora. Quando algo não puder passar batido, aparece aqui.
        </p>
      ) : (
        <ul className="mt-2">
          {items.map((a) => (
            <li key={a.id} className="border-b border-border py-3.5 last:border-b-0">
              <div className="flex items-center gap-2">
                {a.category && (
                  <span className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-primary">
                    {a.category}
                  </span>
                )}
                <span className="text-[10px] font-bold tabular-nums text-muted-foreground">
                  {formatDate(a.published_at)}
                </span>
              </div>
              <Link
                to="/mural/$id"
                params={{ id: a.id }}
                className="mt-1 block text-[17px] font-extrabold leading-tight tracking-[-0.02em] hover:text-primary"
              >
                {a.title}
              </Link>
              <ReadToggle announcementId={a.id} read={readIds.has(a.id)} className="mt-1.5" />
            </li>
          ))}
        </ul>
      )}
    </PaperCard>
  );
}

// ── Cartão do feed ────────────────────────────────────────────────────

function FeedCard({
  announcement: a,
  read,
  reactionCount,
  commentCount,
}: {
  announcement: Announcement;
  read: boolean;
  reactionCount: number;
  commentCount: number;
}) {
  return (
    <PaperCard hover className="grid gap-7 p-6 md:p-[26px] lg:grid-cols-[1fr_220px]">
      <div className="min-w-0">
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

        <h3 className="mt-3 text-[22px] font-black leading-[1.08] tracking-[-0.035em] text-balance sm:text-[28px]">
          <Link to="/mural/$id" params={{ id: a.id }} className="hover:text-primary">
            {a.title}
          </Link>
        </h3>

        {a.summary && (
          <p className="mt-3 max-w-[60ch] text-base leading-[1.7] text-muted-foreground text-pretty">
            {a.summary}
          </p>
        )}

        <p className="mt-4 text-xs font-bold uppercase tracking-[0.1em] tabular-nums text-muted-foreground">
          {reactionCount} {reactionCount === 1 ? "reação" : "reações"} · {commentCount}{" "}
          {commentCount === 1 ? "comentário" : "comentários"}
        </p>
      </div>

      <div className="flex flex-col justify-center gap-2.5">
        <InkButton asChild className="w-full">
          <Link to="/mural/$id" params={{ id: a.id }}>
            Ler comunicado ↗
          </Link>
        </InkButton>
        <ReadToggle announcementId={a.id} read={read} className="text-center" />
      </div>
    </PaperCard>
  );
}
