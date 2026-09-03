import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { ggPageQuery } from "@/lib/portal-queries";
import { fileUrl } from "@/lib/storage";
import { ExternalLink, Download } from "lucide-react";
import type { ReactNode } from "react";

/** `action`: chamada para o formulário da página, quando houver um. */
export function GGPageView({
  pageKey,
  defaultTitle,
  action,
}: {
  pageKey: string;
  defaultTitle: string;
  action?: ReactNode;
}) {
  const q = useQuery(ggPageQuery(pageKey));
  const p = q.data;
  return (
    <>
      <PageHeader eyebrow="Gente & Gestão" title={p?.title ?? defaultTitle} backTo="/gente-gestao" />
      <div className="card-soft p-6 md:p-8">
        {p?.body ? (
          <div className="whitespace-pre-line text-sm md:text-base leading-relaxed">{p.body}</div>
        ) : (
          <p className="text-sm text-muted-foreground">Conteúdo em preparação. Fale com Gente &amp; Gestão em caso de dúvidas.</p>
        )}
        <div className="mt-6 flex flex-wrap items-center gap-2">
          {action}
          {p?.external_url && (
            <a href={p.external_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:opacity-95">
              Acessar <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
          {p?.attachment_url && (
            <a href={fileUrl(p.attachment_url) ?? "#"} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-input bg-surface px-4 py-2 text-sm font-bold hover:bg-secondary">
              <Download className="h-3.5 w-3.5" /> Baixar
            </a>
          )}
        </div>
      </div>
    </>
  );
}
