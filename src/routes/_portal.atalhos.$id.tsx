import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight } from "lucide-react";
import { InkButton, PageHeading, PaperCard } from "@/components/paper";
import { RichText } from "@/components/rich-text";
import { Skeleton } from "@/components/ui/skeleton";
import { quickLinkByIdQuery } from "@/lib/portal-queries";

/**
 * Página de um atalho da home ("Onde a gente vai agora") com conteúdo próprio — em geral um
 * tutorial com texto e vídeo. O link do próprio atalho (`/atalhos/<id>`) não vira botão.
 */
export const Route = createFileRoute("/_portal/atalhos/$id")({
  head: () => ({ meta: [{ title: "Atalho — Portal WG" }] }),
  component: AtalhoPage,
});

function AtalhoPage() {
  const { id } = Route.useParams();
  const q = useQuery(quickLinkByIdQuery(id));
  const link = q.data;

  if (q.isLoading) {
    return (
      <div className="grid gap-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-14 w-2/3" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!link) {
    return (
      <PaperCard tone="soft" className="p-8">
        <p className="text-lg font-black tracking-tight">Esse atalho não está mais disponível.</p>
        <InkButton variant="outline" className="mt-5" asChild>
          <Link to="/">← Voltar para o início</Link>
        </InkButton>
      </PaperCard>
    );
  }

  const url = link.url?.trim() ?? "";
  const ownPage = url === `/atalhos/${link.id}`;
  const target = url && !ownPage ? url : null;
  const internal = target?.startsWith("/") && !target.startsWith("//");

  return (
    <div>
      <Link
        to="/"
        className="inline-flex text-xs font-extrabold uppercase tracking-[0.14em] text-muted-foreground transition hover:text-primary"
      >
        ← Início
      </Link>

      <PageHeading
        className="mt-4"
        kicker={link.category || "Onde a gente vai agora"}
        title={link.title}
        subtitle={link.description || undefined}
        action={
          target && (
            <InkButton asChild>
              {internal ? (
                <Link to={target as "/"}>
                  Abrir <ArrowUpRight className="h-4 w-4" />
                </Link>
              ) : (
                <a href={target} target="_blank" rel="noopener noreferrer">
                  Abrir <ArrowUpRight className="h-4 w-4" />
                </a>
              )}
            </InkButton>
          )
        }
      />

      {link.content?.trim() ? (
        <PaperCard className="mt-8 p-6 md:p-8">
          <RichText value={link.content} className="max-w-[72ch] text-[16px]" />
        </PaperCard>
      ) : (
        <PaperCard tone="soft" className="mt-8 p-8">
          <p className="text-[15px] text-muted-foreground">Este atalho ainda não tem conteúdo.</p>
        </PaperCard>
      )}
    </div>
  );
}
