import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Briefcase, ExternalLink, MapPin } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/page-header";
import { jobsQuery } from "@/lib/portal-queries";

export const Route = createFileRoute("/_portal/vagas")({
  head: () => ({ meta: [{ title: "Vagas internas — Portal WG" }] }),
  component: VagasPage,
});

function VagasPage() {
  const q = useQuery(jobsQuery);
  const items = q.data ?? [];
  return (
    <>
      <PageHeader
        eyebrow="Oportunidades"
        title="Vagas internas"
        description="Confira as vagas abertas no Grupo WG e candidate-se pelo Portal de Carreiras."
      />
      {items.length === 0 ? (
        <EmptyState title="Nenhuma vaga aberta no momento." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((j) => (
            <article key={j.id} className="card-paper card-paper-hover p-5 md:p-6 flex flex-col">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`chip ${j.status === "pausada" ? "!bg-warning !text-warning-foreground" : ""}`}
                >
                  {j.status}
                </span>
                {j.job_type && (
                  <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                    {j.job_type}
                  </span>
                )}
              </div>
              <h2 className="mt-3 text-xl md:text-2xl font-black leading-tight tracking-tight">
                {j.title}
              </h2>
              {j.location && (
                <div className="mt-2 text-xs font-semibold text-muted-foreground inline-flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" />
                  {j.location}
                </div>
              )}
              {j.summary && (
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{j.summary}</p>
              )}
              {j.requirements && (
                <div className="mt-3 text-sm leading-relaxed">
                  <span className="font-bold">Requisitos:</span>{" "}
                  <span className="text-muted-foreground">{j.requirements}</span>
                </div>
              )}
              <a
                href={j.external_url || "https://carreiras.wgbaterias.com.br/"}
                target="_blank"
                rel="noreferrer"
                className="mt-5 inline-flex w-full sm:w-auto self-stretch sm:self-start items-center justify-center gap-2 rounded-full bg-primary text-primary-foreground px-5 py-3 text-xs font-black uppercase tracking-wider border-[1.5px] border-primary hover:bg-ink hover:border-ink transition"
              >
                <Briefcase className="h-3.5 w-3.5 shrink-0" />
                <span>Ver vaga no Portal</span>
                <ExternalLink className="h-3.5 w-3.5 shrink-0" />
              </a>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
