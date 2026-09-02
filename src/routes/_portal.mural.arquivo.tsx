import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { InkButton, Kicker, PaperCard } from "@/components/paper";
import { Skeleton } from "@/components/ui/skeleton";
import { archivedAnnouncementsQuery } from "@/lib/portal-queries";
import { formatDate, parseISODate } from "@/lib/tenure";

export const Route = createFileRoute("/_portal/mural/arquivo")({
  head: () => ({ meta: [{ title: "Arquivo do mural — Portal WG" }] }),
  component: MuralArquivo,
});

function MuralArquivo() {
  const q = useQuery(archivedAnnouncementsQuery);
  const now = Date.now();

  // O arquivo guarda o que já venceu — o que ainda vale continua no feed.
  const expired = (q.data ?? []).filter(
    (a) =>
      a.status === "arquivado" ||
      (a.expires_at != null && parseISODate(a.expires_at).getTime() < now),
  );

  const years = Array.from(
    new Set(expired.map((a) => (a.published_at ? a.published_at.slice(0, 4) : "—"))),
  );

  return (
    <div>
      <Link
        to="/mural"
        className="inline-flex text-xs font-extrabold uppercase tracking-[0.14em] text-muted-foreground transition hover:text-primary"
      >
        ← Voltar ao mural
      </Link>

      <div className="mt-6 flex flex-wrap items-end justify-between gap-4 border-b-[1.5px] border-ink pb-3.5">
        <div>
          <Kicker>Arquivo</Kicker>
          <h1 className="mt-2 text-2xl font-black tracking-[-0.03em] sm:text-3xl">
            Comunicados que já venceram
          </h1>
        </div>
        <span className="text-xs font-bold uppercase tracking-[0.14em] tabular-nums text-muted-foreground">
          {years.join(" · ")}
        </span>
      </div>

      {q.isLoading ? (
        <Skeleton className="mt-8 h-64 w-full" />
      ) : expired.length === 0 ? (
        <PaperCard tone="soft" className="mt-8 p-8">
          <p className="text-xl font-black tracking-tight">Nada no arquivo ainda.</p>
          <p className="mt-2 text-[15px] leading-[1.65] text-muted-foreground">
            Quando um comunicado vencer, ele vem parar aqui — sem sumir de vez.
          </p>
          <InkButton variant="outline" className="mt-5" asChild>
            <Link to="/mural">Voltar ao mural</Link>
          </InkButton>
        </PaperCard>
      ) : (
        <div className="mt-8 border-t-[1.5px] border-ink">
          {expired.map((a) => (
            <div
              key={a.id}
              className="grid grid-cols-[92px_1fr] items-baseline gap-5 border-b border-border py-4 sm:grid-cols-[110px_1fr_160px]"
            >
              <span className="text-xs font-extrabold uppercase tracking-[0.12em] tabular-nums text-muted-foreground">
                {formatDate(a.published_at)}
              </span>
              <Link
                to="/mural/$id"
                params={{ id: a.id }}
                className="text-[17px] font-extrabold leading-tight tracking-[-0.02em] hover:text-primary sm:text-[19px]"
              >
                {a.title}
              </Link>
              <span className="col-start-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-primary sm:col-start-3 sm:text-right">
                {a.category ?? "Comunicado"}
              </span>
            </div>
          ))}
        </div>
      )}

      <p className="mt-6 text-[13px] leading-[1.6] text-muted-foreground">
        Nada aqui expira de vez — se precisar de um comunicado antigo que não está na lista, fala
        com a gente.
      </p>
    </div>
  );
}
