import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Paperclip, Gift } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/page-header";
import { benefitsQuery } from "@/lib/portal-queries";
import { fileUrl } from "@/lib/storage";

export const Route = createFileRoute("/gente-gestao/beneficios")({
  head: () => ({ meta: [{ title: "Benefícios — Portal WG" }] }),
  component: () => {
    const q = useQuery(benefitsQuery);
    const items = q.data ?? [];
    return (
      <>
        <PageHeader eyebrow="Gente & Gestão" title="Benefícios disponíveis" description="Aproveite os benefícios oferecidos pelo Grupo WG." backTo="/gente-gestao" />
        {items.length === 0 ? <EmptyState title="Nenhum benefício cadastrado ainda." /> : (
          <div className="grid gap-4 md:grid-cols-2">
            {items.map(b => (
              <article key={b.id} className="card-soft p-6 flex flex-col">
                <div className="flex items-start gap-3">
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary-softer text-primary">
                    <Gift className="h-6 w-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg font-bold">{b.title}</h2>
                    {b.description && <p className="text-sm text-muted-foreground mt-1">{b.description}</p>}
                  </div>
                </div>
                {(b.eligibility || b.observation) && (
                  <div className="mt-4 space-y-2 text-sm">
                    {b.eligibility && <div><span className="font-bold">Elegibilidade:</span> <span className="text-muted-foreground">{b.eligibility}</span></div>}
                    {b.observation && <div><span className="font-bold">Observação:</span> <span className="text-muted-foreground">{b.observation}</span></div>}
                  </div>
                )}
                <div className="mt-auto pt-4 flex flex-wrap gap-2">
                  {b.external_url && (
                    <a href={b.external_url} target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:opacity-95">
                      Acessar <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                  {b.attachment_url && (
                    <a href={fileUrl(b.attachment_url) ?? "#"} target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-full border border-input bg-surface px-4 py-2 text-sm font-bold hover:bg-secondary">
                      <Paperclip className="h-3.5 w-3.5" /> Anexo
                    </a>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </>
    );
  },
});
