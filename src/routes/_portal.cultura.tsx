import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { z } from "zod";
import { Award, Cake } from "lucide-react";
import { toast } from "sonner";
import {
  Chip,
  IconBubble,
  InkButton,
  Kicker,
  PageHeading,
  PaperCard,
  Signature,
} from "@/components/paper";
import { RecognizeColleagueForm } from "@/components/recognize-colleague";
import { UserAvatar } from "@/components/user-avatar";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { currentEmployeeQuery } from "@/hooks/use-current-employee";
import { directoryQuery, type DirectoryEntry } from "@/lib/directory-queries";
import { peerRecognitionsQuery } from "@/lib/profile-queries";
import { recognitionsQuery } from "@/lib/portal-queries";
import {
  EVENT_TYPE_LABEL,
  anniversariesInMonth,
  birthdaysInMonth,
  congratsQuery,
  cultureEventsQuery,
  culturePhotosQuery,
  eventTone,
  newcomers,
  upcomingEvents,
} from "@/lib/culture-queries";
import { toggleCongrats } from "@/lib/portal-write.functions";
import { fileUrl } from "@/lib/storage";
import { MONTHS, formatDate, monthLabel, parseISODate, yearsSince } from "@/lib/tenure";

type Anniversary = DirectoryEntry & { admission_date: string };

export const Route = createFileRoute("/_portal/cultura")({
  head: () => ({ meta: [{ title: "Cultura WG — Portal WG" }] }),
  validateSearch: z.object({ mes: z.coerce.number().int().min(1).max(12).optional() }),
  component: CulturaPage,
});

function CulturaPage() {
  const { mes } = Route.useSearch();
  const month = mes ?? new Date().getMonth() + 1;
  const monthName = MONTHS[month - 1];

  const [formOpen, setFormOpen] = useState(false);
  const me = useQuery(currentEmployeeQuery);
  const directory = useQuery(directoryQuery);

  const entries = directory.data ?? [];
  const birthdays = birthdaysInMonth(entries, month);
  const anniversaries = anniversariesInMonth(entries, month);
  const arrivals = newcomers(entries);

  return (
    <div>
      <PageHeading
        kicker={`Cultura WG · ${monthLabel()}`}
        title={
          <>
            Nossa gente, <Signature>nossa cultura</Signature>.
          </>
        }
        subtitle="Quem faz aniversário, quem está completando tempo de casa, quem chegou agora e o que o time andou reconhecendo por aí."
        action={
          <InkButton onClick={() => setFormOpen((v) => !v)}>
            {formOpen ? "Fechar" : "Reconhecer um colega ↗"}
          </InkButton>
        }
      />

      {formOpen && (
        <div className="mt-6 animate-content-in">
          <RecognizeColleagueForm selfId={me.data?.id} onPublished={() => setFormOpen(false)} />
        </div>
      )}

      {directory.isLoading ? (
        <div className="mt-9 grid gap-4 lg:grid-cols-12">
          <Skeleton className="h-80 w-full lg:col-span-5" />
          <Skeleton className="h-80 w-full lg:col-span-7" />
        </div>
      ) : (
        <div className="mt-9 grid gap-4 lg:grid-cols-12">
          <BirthdaysCard
            people={birthdays}
            monthName={monthName}
            className="lg:col-span-5 lg:row-span-2"
          />
          <TenureSection people={anniversaries} monthName={monthName} className="lg:col-span-7" />
          <NewcomersSection people={arrivals} className="lg:col-span-7" />
        </div>
      )}

      <RecognitionsSection />
      <PhotosSection />
      <CalendarSection />
    </div>
  );
}

// ── Aniversariantes ───────────────────────────────────────────────────

function BirthdaysCard({
  people,
  monthName,
  className,
}: {
  people: DirectoryEntry[];
  monthName: string;
  className?: string;
}) {
  return (
    <PaperCard tone="accent" className={`p-7 md:p-8 ${className ?? ""}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-[10px] font-extrabold uppercase tracking-[0.22em]">
          Aniversariantes · este mês
        </span>
        <Cake className="h-5 w-5" />
      </div>

      <div className="mt-5 flex flex-wrap items-baseline gap-3">
        <span className="text-[58px] font-black leading-none tracking-[-0.06em] tabular-nums lg:text-[76px]">
          {people.length}
        </span>
        <span className="text-lg font-black leading-tight lg:text-xl">
          {people.length === 1 ? "colega pra celebrar" : "colegas pra celebrar"} em {monthName}
        </span>
      </div>

      <p className="mt-3 text-[15px] leading-[1.7] text-ink/[0.72]">
        Nada como um bolo, um abraço e um &quot;parabéns&quot; de corredor.
      </p>

      <div className="mt-6 border-t-[1.5px] border-ink/20 pt-5">
        {people.length === 0 ? (
          <p className="text-[15px] leading-[1.65] text-ink/[0.72]">
            Ninguém faz aniversário neste mês.
          </p>
        ) : (
          <ul className="flex flex-col gap-4">
            {people.map((p) => (
              <li key={p.id} className="flex items-center gap-4">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-ink text-accent">
                  <span className="text-[8px] font-bold uppercase leading-none">dia</span>
                  <span className="text-[15px] font-black leading-none tabular-nums">
                    {p.birthday_day}
                  </span>
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-base font-extrabold">{p.name}</span>
                  {p.department && (
                    <span className="block truncate text-xs font-bold uppercase tracking-[0.1em] text-ink/60">
                      {p.department}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </PaperCard>
  );
}

// ── Tempo de casa ─────────────────────────────────────────────────────

function TenureSection({
  people,
  monthName,
  className,
}: {
  people: Anniversary[];
  monthName: string;
  className?: string;
}) {
  return (
    <section className={className}>
      <div className="flex items-baseline justify-between gap-4">
        <Kicker>Tempo de casa · {monthName}</Kicker>
        <span className="text-xs font-bold tabular-nums text-muted-foreground">
          {people.length} {people.length === 1 ? "pessoa" : "pessoas"}
        </span>
      </div>

      {people.length === 0 ? (
        <PaperCard tone="soft" className="mt-4 p-6">
          <p className="text-[15px] leading-[1.65] text-muted-foreground">
            Ninguém completa tempo de casa neste mês.
          </p>
        </PaperCard>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          {people.map((p) => (
            <TenureRow key={p.id} person={p} />
          ))}
        </div>
      )}
    </section>
  );
}

function TenureRow({ person }: { person: Anniversary }) {
  const qc = useQueryClient();
  const congrats = useQuery(congratsQuery);
  const me = useQuery(currentEmployeeQuery);
  const send = useServerFn(toggleCongrats);

  const years = yearsSince(person.admission_date);
  const thisYear = new Date().getFullYear();
  const sent = (congrats.data ?? []).some(
    (c) =>
      c.to_employee_id === person.id && c.year === thisYear && c.from_employee_id === me.data?.id,
  );

  const mutation = useMutation({
    mutationFn: () => send({ data: { to_employee_id: person.id, year: thisYear } }),
    onSettled: () => qc.invalidateQueries({ queryKey: ["anniversary_congrats"] }),
    onError: () => toast.error("Não conseguimos salvar agora. Tenta de novo em instantes?"),
  });

  return (
    <PaperCard hover className="flex flex-wrap items-center gap-4 p-5 sm:gap-[18px]">
      <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full border-[1.5px] border-ink bg-primary text-primary-foreground">
        <span className="text-xl font-black leading-none tabular-nums">{years}</span>
        <span className="text-[8px] font-extrabold uppercase leading-none tracking-[0.1em]">
          {years === 1 ? "ano" : "anos"}
        </span>
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-[19px] font-black tracking-[-0.03em]">
          {person.name}
        </span>
        <span className="block truncate text-[13px] text-muted-foreground">
          {[person.department, `desde ${formatDate(person.admission_date)}`]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </span>

      <button
        type="button"
        disabled={mutation.isPending || person.id === me.data?.id}
        onClick={() => mutation.mutate()}
        className={`shrink-0 whitespace-nowrap text-[11px] font-extrabold uppercase tracking-[0.12em] transition-colors disabled:opacity-50 ${
          sent ? "text-primary" : "text-muted-foreground hover:text-ink"
        }`}
      >
        {sent ? "Parabéns enviado ✓" : "Dar parabéns"}
      </button>
    </PaperCard>
  );
}

// ── Quem chegou agora ─────────────────────────────────────────────────

function NewcomersSection({ people, className }: { people: Anniversary[]; className?: string }) {
  return (
    <section className={className}>
      <Kicker>Quem chegou agora</Kicker>
      {people.length === 0 ? (
        <PaperCard tone="soft" className="mt-4 p-6">
          <p className="text-[15px] leading-[1.65] text-muted-foreground">
            Ninguém novo nos últimos 90 dias.
          </p>
        </PaperCard>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {people.map((p) => (
            <PaperCard key={p.id} tone="soft" className="flex items-center gap-4 p-[18px]">
              <UserAvatar name={p.name} photoUrl={p.photo_url} size={44} tone="muted" />
              <span className="min-w-0">
                <span className="block truncate text-base font-extrabold">{p.name}</span>
                <span className="block truncate text-[12.5px] text-muted-foreground">
                  {p.job_title ?? "Colaborador"}
                </span>
                <span className="mt-0.5 block text-[10px] font-extrabold uppercase tracking-[0.14em] tabular-nums text-primary">
                  Desde {formatDate(p.admission_date)}
                </span>
              </span>
            </PaperCard>
          ))}
        </div>
      )}
    </section>
  );
}

// ── Reconhecimentos ───────────────────────────────────────────────────

function RecognitionsSection() {
  const peer = useQuery(peerRecognitionsQuery);
  const curated = useQuery(recognitionsQuery);
  const directory = useQuery(directoryQuery);
  const byId = new Map((directory.data ?? []).map((e) => [e.id, e]));

  const list = peer.data ?? [];
  const featured = list.find((r) => r.highlight) ?? list[0];
  const rest = list.filter((r) => r.id !== featured?.id);
  const total = list.length + (curated.data ?? []).length;

  return (
    <section className="mt-12">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b-[1.5px] border-ink pb-3.5">
        <div>
          <Kicker>Reconhecimentos</Kicker>
          <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] sm:text-3xl">
            O que o time andou reconhecendo
          </h2>
        </div>
        <span className="text-xs font-bold uppercase tracking-[0.14em] tabular-nums text-muted-foreground">
          {total} {total === 1 ? "registro" : "registros"}
        </span>
      </div>

      {total === 0 ? (
        <PaperCard tone="soft" className="mt-6 p-8">
          <p className="text-xl font-black tracking-tight">
            Nenhum reconhecimento publicado ainda — pode ser você o primeiro.
          </p>
        </PaperCard>
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-12">
          {featured && (
            <PaperCard tone="ink" className="p-7 md:p-8 lg:col-span-7">
              <Kicker color="var(--color-accent)">Destaque do mês</Kicker>
              <h3 className="mt-4 text-[26px] font-black leading-[1.05] tracking-[-0.04em] sm:text-[32px] lg:text-[36px]">
                {byId.get(featured.to_employee_id)?.name ?? "Nosso time"}
              </h3>
              <p className="mt-4 max-w-[52ch] text-[17px] leading-[1.65] text-paper/[0.78]">
                {featured.message}
              </p>
              <p className="mt-6 text-[11px] font-extrabold uppercase tracking-[0.18em] text-paper/60">
                Indicado por{" "}
                {featured.from_employee_id
                  ? (byId.get(featured.from_employee_id)?.name ?? "um colega")
                  : "um colega"}{" "}
                · {formatDate(featured.created_at)}
              </p>
            </PaperCard>
          )}

          <div className="flex flex-col gap-3 lg:col-span-5">
            {rest.map((r) => (
              <PaperCard key={r.id} tone="soft" className="grid grid-cols-[36px_1fr] gap-4 p-5">
                <IconBubble size={36}>
                  <Award />
                </IconBubble>
                <div className="min-w-0">
                  <p className="text-[17px] font-black">
                    {byId.get(r.to_employee_id)?.name ?? "Colega WG"}
                  </p>
                  <p className="mt-1 text-[14.5px] leading-[1.65] text-pretty">{r.message}</p>
                  <p className="mt-2 text-[11px] font-extrabold uppercase tracking-[0.12em] tabular-nums text-muted-foreground">
                    {r.from_employee_id
                      ? (byId.get(r.from_employee_id)?.name ?? "Um colega")
                      : "Um colega"}{" "}
                    · {formatDate(r.created_at)}
                  </p>
                </div>
              </PaperCard>
            ))}

            {(curated.data ?? []).map((r) => (
              <PaperCard key={r.id} tone="soft" className="grid grid-cols-[36px_1fr] gap-4 p-5">
                <IconBubble size={36}>
                  <Award />
                </IconBubble>
                <div className="min-w-0">
                  <p className="text-[17px] font-black">{r.person_or_team}</p>
                  <p className="mt-1 text-[14.5px] leading-[1.65] text-pretty">
                    {r.description ?? r.title}
                  </p>
                  <p className="mt-2 text-[11px] font-extrabold uppercase tracking-[0.12em] tabular-nums text-muted-foreground">
                    Gente &amp; Gestão · {formatDate(r.recognition_date)}
                  </p>
                </div>
              </PaperCard>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

// ── O mês em fotos ────────────────────────────────────────────────────

function PhotosSection() {
  const photos = useQuery(culturePhotosQuery);
  const [open, setOpen] = useState<string | null>(null);
  const list = photos.data ?? [];
  const current = list.find((p) => p.id === open);

  if (photos.isLoading) return <Skeleton className="mt-12 h-56 w-full" />;
  if (list.length === 0) return null;

  return (
    <section className="mt-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Kicker>Eventos e campanhas</Kicker>
          <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] sm:text-3xl">
            O mês em fotos
          </h2>
        </div>
        <span className="text-[13px] text-muted-foreground">
          As fotos são publicadas por Gente &amp; Gestão.
        </span>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {list.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setOpen(p.id)}
            className="overflow-hidden rounded-lg border-[1.5px] border-ink text-left shadow-paper transition-[transform,box-shadow] duration-[120ms] ease-standard hover:-translate-x-px hover:-translate-y-px hover:shadow-elevated"
          >
            <img
              src={fileUrl(p.image_url) ?? ""}
              alt={p.title}
              className="h-[180px] w-full object-cover"
              loading="lazy"
            />
            <span className="block border-t-[1.5px] border-ink bg-surface px-4 py-3.5">
              <span className="block text-[15px] font-extrabold">{p.title}</span>
              <span className="block text-xs tabular-nums text-muted-foreground">
                {[p.event_date ? formatDate(p.event_date) : null, p.unit]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </span>
          </button>
        ))}
      </div>

      <Dialog open={open !== null} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent className="max-w-3xl border-[1.5px] border-ink bg-paper p-3 shadow-elevated">
          <DialogTitle className="sr-only">{current?.title ?? "Foto"}</DialogTitle>
          {current && (
            <>
              <img
                src={fileUrl(current.image_url) ?? ""}
                alt={current.title}
                className="max-h-[70vh] w-full rounded-md object-contain"
              />
              <p className="px-1 pb-1 text-sm font-bold">{current.title}</p>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

// ── Calendário interno + Jeito WG ─────────────────────────────────────

function CalendarSection() {
  const events = useQuery(cultureEventsQuery);
  const upcoming = upcomingEvents(events.data ?? []);

  return (
    <div className="mt-12 grid items-start gap-6 lg:grid-cols-[1fr_380px]">
      <section>
        <Kicker>Calendário interno</Kicker>
        <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] sm:text-3xl">
          O que vem por aí
        </h2>

        {upcoming.length === 0 ? (
          <PaperCard tone="soft" className="mt-5 p-6">
            <p className="text-[15px] leading-[1.65] text-muted-foreground">
              Sem eventos no calendário por enquanto.
            </p>
          </PaperCard>
        ) : (
          <div className="mt-5 border-t-[1.5px] border-ink">
            {upcoming.map((e) => {
              const d = parseISODate(e.event_date);
              return (
                <div
                  key={e.id}
                  className="grid grid-cols-[60px_1fr_auto] items-center gap-5 border-b border-border py-4"
                >
                  <span className="grid h-[60px] w-[60px] place-items-center rounded-lg border-[1.5px] border-ink bg-surface">
                    <span className="text-xl font-black leading-none tabular-nums">
                      {d.getDate()}
                    </span>
                    <span className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground">
                      {MONTHS[d.getMonth()].slice(0, 3)}
                    </span>
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[19px] font-black tracking-[-0.03em]">
                      {e.title}
                    </span>
                    {e.detail && (
                      <span className="block text-[13px] text-muted-foreground">{e.detail}</span>
                    )}
                  </span>
                  <Chip tone={eventTone(e.event_type)}>
                    {EVENT_TYPE_LABEL[e.event_type] ?? e.event_type}
                  </Chip>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <PaperCard tone="primary" className="p-7">
        <span className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-accent">
          Jeito WG de ser
        </span>
        <p className="mt-4 text-[24px] font-black leading-tight tracking-[-0.03em]">
          A gente move baterias — e move gente também.
        </p>
        <p className="mt-3 text-[15px] leading-[1.7] text-primary-foreground/85">
          Cultura aqui não é quadro na parede: é o jeito de tratar colega, cliente e prazo. Se
          alguma coisa não está batendo com isso, a gente quer saber.
        </p>
        <InkButton variant="accent" className="mt-6" asChild>
          <Link to="/gente-gestao/contatos">Falar com o G&amp;G ↗</Link>
        </InkButton>
      </PaperCard>
    </div>
  );
}
