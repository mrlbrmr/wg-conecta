import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Download, ExternalLink } from "lucide-react";
import { PortalLayout } from "@/components/portal-layout";
import { PageHeader, EmptyState } from "@/components/page-header";
import { onboardingQuery } from "@/lib/portal-queries";
import { fileUrl } from "@/lib/storage";

export const Route = createFileRoute("/integracao")({
  head: () => ({ meta: [{ title: "Integração — Portal WG" }] }),
  component: () => {
    const q = useQuery(onboardingQuery);
    const items = q.data ?? [];
    return (
      <PortalLayout>
        <PageHeader eyebrow="Boas-vindas" title="Integração" description="Materiais para novos colaboradores e para consulta geral." />
        {items.length === 0 ? <EmptyState title="Nenhum material publicado ainda." /> : (
          <div className="grid gap-4 md:grid-cols-2">
            {items.map(m => (
              <article key={m.id} className="card-soft overflow-hidden">
                {m.image_url && <img src={fileUrl(m.image_url) ?? ""} alt="" className="h-40 w-full object-cover" />}
                <div className="p-6">
                  {m.category && <span className="chip">{m.category}</span>}
                  <h2 className="mt-2 text-lg font-bold">{m.title}</h2>
                  {m.description && <p className="mt-1 text-sm text-muted-foreground">{m.description}</p>}
                  {m.content && <div className="mt-3 text-sm whitespace-pre-line">{m.content}</div>}
                  <div className="mt-4 flex flex-wrap gap-2">
                    {m.external_url && <a href={m.external_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:opacity-95">Acessar <ExternalLink className="h-3.5 w-3.5" /></a>}
                    {m.attachment_url && <a href={fileUrl(m.attachment_url) ?? "#"} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-input bg-surface px-4 py-2 text-sm font-bold hover:bg-secondary"><Download className="h-3.5 w-3.5" /> Baixar</a>}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </PortalLayout>
    );
  },
});
