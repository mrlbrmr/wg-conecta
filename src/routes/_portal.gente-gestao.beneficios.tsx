import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Gift, Paperclip } from "lucide-react";
import { GGBackLink } from "@/components/gg-page-view";
import { Chip, IconBubble, InkButton, PageHeading, PaperCard } from "@/components/paper";
import { Skeleton } from "@/components/ui/skeleton";
import { ICON_MAP } from "@/lib/icon-map";
import { benefitsQuery } from "@/lib/portal-queries";
import { fileUrl } from "@/lib/storage";
import { formatDate } from "@/lib/tenure";

export const Route = createFileRoute("/_portal/gente-gestao/beneficios")({
  head: () => ({ meta: [{ title: "Benefícios — Portal WG" }] }),
  component: BeneficiosPage,
});

function BeneficiosPage() {
  const q = useQuery(benefitsQuery);
  const items = q.data ?? [];

  return (
    <div>
      <GGBackLink />
      <PageHeading
        kicker="Gente & Gestão"
        title="Benefícios."
        subtitle="O que o Grupo WG oferece para você — quem tem direito e como acessar."
      />

      {q.isLoading ? (
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <Skeleton className="h-52 w-full" />
          <Skeleton className="h-52 w-full" />
        </div>
      ) : items.length === 0 ? (
        <PaperCard tone="soft" className="mt-8 p-8">
          <p className="text-lg font-black tracking-tight">Nenhum benefício cadastrado ainda.</p>
        </PaperCard>
      ) : (
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {items.map((b) => {
            const Icon = ICON_MAP[b.icon ?? ""] ?? Gift;
            return (
              <PaperCard key={b.id} hover className="flex flex-col p-6 md:p-[26px]">
                <div className="flex items-start gap-4">
                  <IconBubble size={48}>
                    <Icon />
                  </IconBubble>
                  <div className="min-w-0 flex-1">
                    {(b.badge || b.featured) && (
                      <Chip tone="accent" className="mb-2">
                        {b.badge ?? "Destaque"}
                      </Chip>
                    )}
                    <h2 className="text-[22px] font-black leading-tight tracking-[-0.03em]">
                      {b.title}
                    </h2>
                    {b.description && (
                      <p className="mt-2 text-[15px] leading-[1.65] text-muted-foreground">
                        {b.description}
                      </p>
                    )}
                  </div>
                </div>

                {(b.eligibility || b.observation || b.next_date) && (
                  <dl className="mt-5 grid gap-2 border-t border-border pt-4 text-[14px] leading-[1.55]">
                    {b.eligibility && (
                      <div>
                        <dt className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground">
                          Quem tem direito
                        </dt>
                        <dd className="mt-0.5">{b.eligibility}</dd>
                      </div>
                    )}
                    {b.observation && (
                      <div>
                        <dt className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground">
                          Observação
                        </dt>
                        <dd className="mt-0.5">{b.observation}</dd>
                      </div>
                    )}
                    {b.next_date && (
                      <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] tabular-nums text-primary">
                        Próxima data: {formatDate(b.next_date)}
                      </p>
                    )}
                  </dl>
                )}

                {(b.external_url || b.attachment_url) && (
                  <div className="mt-auto flex flex-wrap gap-2 pt-5">
                    {b.external_url && (
                      <InkButton asChild>
                        <a href={b.external_url} target="_blank" rel="noopener noreferrer">
                          Acessar <ExternalLink className="h-4 w-4" />
                        </a>
                      </InkButton>
                    )}
                    {b.attachment_url && (
                      <InkButton variant="outline" asChild>
                        <a
                          href={fileUrl(b.attachment_url) ?? "#"}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Paperclip className="h-4 w-4" /> Anexo
                        </a>
                      </InkButton>
                    )}
                  </div>
                )}
              </PaperCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
