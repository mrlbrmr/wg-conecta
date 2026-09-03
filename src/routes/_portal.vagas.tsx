import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { z } from "zod";
import { MapPin } from "lucide-react";
import { Chip, FilterPills, InkButton, Kicker, PageHeading, PaperCard } from "@/components/paper";
import { Skeleton } from "@/components/ui/skeleton";
import { jobsQuery, type InternalJob } from "@/lib/portal-queries";
import { formatDate } from "@/lib/tenure";

const TODAS = "Todas";
const TODOS = "Todos";

const STATUS_LABEL: Record<string, string> = {
  aberta: "Aberta",
  pausada: "Pausada",
  encerrada: "Encerrada",
};

const STATUS_TONE: Record<string, "ink" | "accent" | "soft"> = {
  aberta: "ink",
  pausada: "soft",
  encerrada: "soft",
};

export const Route = createFileRoute("/_portal/vagas")({
  head: () => ({ meta: [{ title: "Vagas internas — Portal WG" }] }),
  validateSearch: z.object({
    unidade: z.string().optional(),
    tipo: z.string().optional(),
  }),
  component: VagasPage,
});

function VagasPage() {
  const { unidade = TODAS, tipo = TODOS } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const jobs = useQuery(jobsQuery);

  const items = useMemo(() => jobs.data ?? [], [jobs.data]);

  const units = useMemo(() => {
    const found = Array.from(
      new Set(items.map((j) => j.unit ?? j.location).filter(Boolean) as string[]),
    ).sort((a, b) => a.localeCompare(b, "pt-BR"));
    return [TODAS, ...found].map((v) => ({ value: v, label: v }));
  }, [items]);

  const types = useMemo(() => {
    const found = Array.from(
      new Set(items.map((j) => j.job_type).filter(Boolean) as string[]),
    ).sort((a, b) => a.localeCompare(b, "pt-BR"));
    return [TODOS, ...found].map((v) => ({ value: v, label: v }));
  }, [items]);

  // Os dois filtros combinam com E.
  const filtered = items.filter((j) => {
    if (unidade !== TODAS && (j.unit ?? j.location) !== unidade) return false;
    if (tipo !== TODOS && j.job_type !== tipo) return false;
    return true;
  });

  const filtering = unidade !== TODAS || tipo !== TODOS;

  const setFilter = (next: { unidade?: string; tipo?: string }) =>
    navigate({
      search: (prev) => {
        const merged = { ...prev, ...next };
        return {
          unidade: merged.unidade && merged.unidade !== TODAS ? merged.unidade : undefined,
          tipo: merged.tipo && merged.tipo !== TODOS ? merged.tipo : undefined,
        };
      },
      replace: true,
    });

  return (
    <div>
      <PageHeading
        kicker="Oportunidades"
        title="Vagas internas."
        subtitle="Quem já é de casa se candidata primeiro. Confira as vagas abertas no Grupo WG e siga pelo Portal de Carreiras."
      />

      <div className="mt-6 flex flex-col gap-3.5">
        <FilterPills
          label="Unidade"
          options={units}
          value={unidade}
          onChange={(v) => setFilter({ unidade: v })}
        />
        <FilterPills
          label="Tipo"
          options={types}
          value={tipo}
          onChange={(v) => setFilter({ tipo: v })}
        />
      </div>

      <section className="mt-10">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b-[1.5px] border-ink pb-3.5">
          <div>
            <Kicker>No ar agora</Kicker>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] sm:text-3xl">
              {filtering ? "Vagas filtradas" : "Todas as vagas abertas"}
            </h2>
          </div>
          <span className="text-xs font-bold uppercase tracking-[0.14em] tabular-nums text-muted-foreground">
            {filtered.length} {filtered.length === 1 ? "vaga" : "vagas"}
          </span>
        </div>

        {jobs.isLoading ? (
          <Skeleton className="mt-6 h-56 w-full" />
        ) : filtered.length === 0 ? (
          <PaperCard tone="soft" className="mt-6 p-8">
            <p className="text-xl font-black tracking-tight">
              No momento, não temos vagas abertas com esses filtros.
            </p>
            <p className="mt-2 max-w-[56ch] text-[15px] leading-[1.65] text-muted-foreground">
              Continue acompanhando o portal — as vagas internas saem aqui primeiro.
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
            {filtered.map((j) => (
              <JobCard key={j.id} job={j} />
            ))}
          </div>
        )}
      </section>

      <HowItWorks />
    </div>
  );
}

function JobCard({ job: j }: { job: InternalJob }) {
  const paused = j.status === "pausada";

  return (
    <PaperCard hover className="grid gap-7 p-6 md:p-7 lg:grid-cols-[1fr_240px]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2.5">
          <Chip tone={STATUS_TONE[j.status] ?? "soft"}>{STATUS_LABEL[j.status] ?? j.status}</Chip>
          {j.job_type && (
            <span className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-muted-foreground">
              {j.job_type}
            </span>
          )}
          <span className="h-1 w-1 rounded-full bg-border" />
          <span className="text-[11px] font-bold uppercase tracking-[0.14em] tabular-nums text-muted-foreground">
            Publicada em {formatDate(j.published_at)}
          </span>
        </div>

        <h3 className="mt-3 text-[24px] font-black leading-tight tracking-[-0.035em] text-balance sm:text-[30px]">
          {j.title}
        </h3>

        {(j.unit || j.location) && (
          <p className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-bold text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            {[j.unit, j.location].filter(Boolean).join(" · ")}
          </p>
        )}

        {j.summary && (
          <p className="mt-3 max-w-[62ch] text-base leading-[1.7] text-muted-foreground text-pretty">
            {j.summary}
          </p>
        )}

        {j.requirements && (
          <p className="mt-3 max-w-[62ch] text-[15px] leading-[1.7]">
            <strong className="font-extrabold">Requisitos:</strong>{" "}
            <span className="text-muted-foreground">{j.requirements}</span>
          </p>
        )}
      </div>

      <div className="flex flex-col gap-4">
        <InkButton asChild className="w-full">
          <a
            href={j.external_url || "https://carreiras.wgbaterias.com.br/"}
            target="_blank"
            rel="noreferrer"
          >
            Ver vaga no Portal ↗
          </a>
        </InkButton>
        <div className="text-right">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground">
            Inscrições até
          </p>
          <p className="text-[17px] font-black tabular-nums">
            {paused || !j.applications_deadline ? "—" : formatDate(j.applications_deadline)}
          </p>
        </div>
      </div>
    </PaperCard>
  );
}

function HowItWorks() {
  return (
    <PaperCard tone="ink" className="mt-12 p-7 md:p-8">
      <Kicker color="var(--color-accent)">Como funciona</Kicker>
      <p className="mt-4 max-w-[40ch] text-[22px] font-black leading-tight tracking-[-0.03em] sm:text-[26px]">
        Candidatura interna é confidencial até a primeira conversa.
      </p>
      <p className="mt-4 max-w-[62ch] text-[15px] leading-[1.7] text-paper/[0.78]">
        Você pode se candidatar depois de seis meses na função. Sua gestão só é comunicada na etapa
        de entrevista, e a gente dá retorno em até dez dias — mesmo quando a resposta é não.
      </p>
      <InkButton variant="accent" className="mt-6" asChild>
        <Link to="/gente-gestao/contatos">Falar com o G&amp;G ↗</Link>
      </InkButton>
    </PaperCard>
  );
}
