import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Download, ExternalLink } from "lucide-react";
import type { ReactNode } from "react";
import { InkButton, PageHeading, PaperCard } from "@/components/paper";
import { RichText } from "@/components/rich-text";
import { Skeleton } from "@/components/ui/skeleton";
import { ggPageQuery } from "@/lib/portal-queries";
import { fileUrl } from "@/lib/storage";

/** "← Gente & Gestão" — volta das páginas internas da área. */
export function GGBackLink() {
  return (
    <Link
      to="/gente-gestao"
      className="mb-4 inline-flex text-xs font-extrabold uppercase tracking-[0.14em] text-muted-foreground transition hover:text-primary"
    >
      ← Gente &amp; Gestão
    </Link>
  );
}

/**
 * Páginas de conteúdo do G&G (férias, atestados, holerite, políticas, cadastro), editadas em
 * Painel › Páginas G&G. `action`: chamada para o formulário da página, quando houver um.
 */
export function GGPageView({
  pageKey,
  defaultTitle,
  subtitle,
  action,
}: {
  pageKey: string;
  defaultTitle: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  const q = useQuery(ggPageQuery(pageKey));
  const p = q.data;
  const hasLinks = Boolean(action || p?.external_url || p?.attachment_url);

  return (
    <div>
      <GGBackLink />
      <PageHeading kicker="Gente & Gestão" title={p?.title ?? defaultTitle} subtitle={subtitle} />

      <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <PaperCard className="p-6 md:p-8">
          {q.isLoading ? (
            <div className="grid gap-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ) : p?.body?.trim() ? (
            <RichText value={p.body} className="max-w-[70ch] text-[16px]" />
          ) : (
            <p className="text-[15px] leading-[1.65] text-muted-foreground">
              Conteúdo em preparação. Fale com Gente &amp; Gestão em caso de dúvidas.
            </p>
          )}
        </PaperCard>

        {hasLinks && (
          <PaperCard tone="accent" className="flex flex-col gap-3 p-6 lg:sticky lg:top-24">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.14em]">Próximo passo</p>
            {action}
            {p?.external_url && (
              <InkButton asChild>
                <a href={p.external_url} target="_blank" rel="noopener noreferrer">
                  Acessar <ExternalLink className="h-4 w-4" />
                </a>
              </InkButton>
            )}
            {p?.attachment_url && (
              <InkButton variant="outline" asChild>
                <a
                  href={fileUrl(p.attachment_url) ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Download className="h-4 w-4" /> Baixar arquivo
                </a>
              </InkButton>
            )}
          </PaperCard>
        )}
      </div>
    </div>
  );
}
