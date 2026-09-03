import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Users } from "lucide-react";
import { Chip, IconBubble, InkButton, Kicker, PageHeading, PaperCard } from "@/components/paper";
import { UserAvatar } from "@/components/user-avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { ICON_MAP } from "@/lib/icon-map";
import { GG_LINKS } from "./_portal.gente-gestao";
import { benefitsQuery, contactsQuery, faqQuery } from "@/lib/portal-queries";
import { deadlinesInMonth, monthlyDeadlinesQuery } from "@/lib/gg-queries";
import { ownRequestsQuery, REQUEST_STATUS_LABEL, REQUEST_STATUS_TONE } from "@/lib/profile-queries";
import { formatDate } from "@/lib/tenure";

const PRIVACY_NOTE =
  "Uso interno. Não compartilhe CPF, documentos ou dados bancários por aqui — dados cadastrais só pelo canal de Atualização Cadastral.";

export const Route = createFileRoute("/_portal/gente-gestao/")({
  head: () => ({ meta: [{ title: "Gente & Gestão — Portal WG" }] }),
  component: GenteGestaoPage,
});

function GenteGestaoPage() {
  return (
    <div>
      <PageHeading
        kicker="Gente & Gestão"
        title="Tudo que você precisa da gente."
        subtitle="Benefícios, documentos, prazos e canais de contato. Benefício, férias, documento, dúvida boba — manda pra gente sem cerimônia."
      />

      <div className="mt-8 grid items-start gap-6 lg:grid-cols-[1fr_380px]">
        <ShortcutsSection />
        <div className="grid gap-6">
          <RequestsCard />
          <DeadlinesCard />
        </div>
      </div>

      <FeaturedBenefits />

      <div className="mt-12 grid items-start gap-6 lg:grid-cols-[1fr_380px]">
        <FaqSection />
        <ContactsSection />
      </div>
    </div>
  );
}

// ── Onde a gente resolve ──────────────────────────────────────────────

function ShortcutsSection() {
  return (
    <section>
      <Kicker>Onde a gente resolve</Kicker>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {GG_LINKS.map((l) => {
          const Icon = ICON_MAP[l.icon] ?? Users;
          return (
            <PaperCard key={l.to} hover asChild>
              <Link to={l.to} className="flex flex-col gap-[5px] p-5">
                <IconBubble size={44} className="mb-2">
                  <Icon />
                </IconBubble>
                <span className="text-[17px] font-extrabold tracking-[-0.02em]">{l.title}</span>
                <span className="text-[13px] leading-[1.45] text-muted-foreground">{l.desc}</span>
              </Link>
            </PaperCard>
          );
        })}
      </div>
    </section>
  );
}

// ── Suas solicitações ─────────────────────────────────────────────────

function RequestsCard() {
  const requests = useQuery(ownRequestsQuery);
  const list = requests.data ?? [];
  const open = list.filter((r) => r.status !== "concluida");

  return (
    <PaperCard className="p-6">
      <div className="flex items-baseline justify-between gap-4">
        <Kicker>Suas solicitações</Kicker>
        <span className="text-xs font-bold tabular-nums text-muted-foreground">
          {open.length} {open.length === 1 ? "aberta" : "abertas"}
        </span>
      </div>

      {requests.isLoading ? (
        <Skeleton className="mt-4 h-24 w-full" />
      ) : list.length === 0 ? (
        <p className="mt-4 text-[15px] leading-[1.65] text-muted-foreground">
          Nenhuma solicitação aberta. Quando você pedir alguma coisa, o protocolo aparece aqui.
        </p>
      ) : (
        <ul className="mt-2">
          {list.slice(0, 4).map((r) => (
            <li key={r.id} className="border-b border-border py-[13px] last:border-b-0">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[10px] font-extrabold uppercase tracking-[0.14em] tabular-nums text-primary">
                  Protocolo {r.protocol}
                </span>
                <Chip tone={REQUEST_STATUS_TONE[r.status] ?? "soft"}>
                  {REQUEST_STATUS_LABEL[r.status] ?? r.status}
                </Chip>
              </div>
              <p className="mt-1 text-base font-extrabold">{r.title}</p>
              <p className="text-xs tabular-nums text-muted-foreground">
                Aberta em {formatDate(r.created_at)}
                {r.due_date ? ` · prazo até ${formatDate(r.due_date)}` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}

      <InkButton className="mt-5 w-full" asChild>
        <Link to="/formularios">Abrir solicitação ↗</Link>
      </InkButton>
    </PaperCard>
  );
}

// ── Prazos do mês ─────────────────────────────────────────────────────

function DeadlinesCard() {
  const deadlines = useQuery(monthlyDeadlinesQuery);
  const list = deadlinesInMonth(deadlines.data ?? []);

  if (deadlines.isLoading) return <Skeleton className="h-48 w-full" />;

  return (
    <PaperCard tone="ink" className="p-6">
      <Kicker color="var(--color-accent)">Prazos do mês</Kicker>

      {list.length === 0 ? (
        <p className="mt-4 text-[15px] leading-[1.65] text-paper/70">
          Nenhum prazo combinado para este mês.
        </p>
      ) : (
        <ul className="mt-3">
          {list.map((d) => (
            <li
              key={d.id}
              className="flex items-center justify-between gap-4 border-b border-paper/15 py-[11px] last:border-b-0"
            >
              <span className="min-w-0 text-sm font-bold">{d.label}</span>
              <span className="shrink-0 whitespace-nowrap text-[13px] font-black tabular-nums text-accent">
                {formatDate(d.due_date)}
              </span>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-4 text-xs leading-[1.6] text-paper/70">
        Contamos em dias úteis. Passou do prazo? Cobra a gente sem cerimônia.
      </p>
    </PaperCard>
  );
}

// ── Benefícios em destaque ────────────────────────────────────────────

function FeaturedBenefits() {
  const benefits = useQuery(benefitsQuery);
  const all = benefits.data ?? [];
  const featured = all.filter((b) => b.featured);
  const list = featured.length > 0 ? featured : all.slice(0, 3);

  if (benefits.isLoading) return <Skeleton className="mt-12 h-48 w-full" />;
  if (list.length === 0) return null;

  return (
    <section className="mt-12">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b-[1.5px] border-ink pb-3.5">
        <div>
          <Kicker>Benefícios</Kicker>
          <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] sm:text-3xl">
            O que está valendo agora
          </h2>
        </div>
        <Link
          to="/gente-gestao/beneficios"
          className="text-xs font-extrabold uppercase tracking-[0.12em] text-ink hover:text-primary"
        >
          Todos os benefícios ↗
        </Link>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {list.map((b) => (
          <PaperCard key={b.id} hover className="p-6 md:p-[26px]">
            <Chip tone={b.badge ? "accent" : "soft"}>{b.badge ?? "Ativo"}</Chip>
            <h3 className="mt-3 text-[22px] font-black tracking-[-0.03em] sm:text-2xl">
              {b.title}
            </h3>
            {b.description && (
              <p className="mt-2 text-[15px] leading-[1.65] text-muted-foreground">
                {b.description}
              </p>
            )}
            {(b.next_date || b.eligibility) && (
              <p className="mt-4 text-[11px] font-extrabold uppercase tracking-[0.12em] tabular-nums text-primary">
                {b.next_date ? `Próxima data: ${formatDate(b.next_date)}` : b.eligibility}
              </p>
            )}
          </PaperCard>
        ))}
      </div>
    </section>
  );
}

// ── Perguntas frequentes ──────────────────────────────────────────────

function FaqSection() {
  const faq = useQuery(faqQuery);
  const items = (faq.data ?? []).slice(0, 5);
  // O primeiro abre por padrão; -1 fecha todos.
  const [open, setOpen] = useState(0);

  if (faq.isLoading) return <Skeleton className="h-64 w-full" />;

  return (
    <section>
      <Kicker>Perguntas frequentes</Kicker>
      <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] sm:text-3xl">
        As dúvidas que mais chegam
      </h2>

      {items.length === 0 ? (
        <PaperCard tone="soft" className="mt-5 p-6">
          <p className="text-[15px] leading-[1.65] text-muted-foreground">
            Nenhuma dúvida cadastrada ainda.
          </p>
        </PaperCard>
      ) : (
        <div className="mt-5 border-t-[1.5px] border-ink">
          {items.map((item, i) => {
            const expanded = open === i;
            return (
              <div key={item.id} className="border-b border-border">
                <button
                  type="button"
                  aria-expanded={expanded}
                  onClick={() => setOpen(expanded ? -1 : i)}
                  className="flex w-full items-center justify-between gap-4 py-[18px] text-left"
                >
                  <span className="text-[17px] font-extrabold sm:text-[19px]">{item.question}</span>
                  <span className="shrink-0 text-xl font-black leading-none text-primary">
                    {expanded ? "−" : "+"}
                  </span>
                </button>
                {expanded && (
                  <p className="max-w-[62ch] pb-5 text-base leading-[1.7] text-muted-foreground text-pretty">
                    {item.answer}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ── Contatos ──────────────────────────────────────────────────────────

function ContactsSection() {
  const contacts = useQuery(contactsQuery);
  const list = contacts.data ?? [];

  return (
    <div className="grid gap-4">
      <Kicker>Quem responde</Kicker>

      {contacts.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        list.map((c) => (
          <PaperCard key={c.id} tone="soft" className="flex items-center gap-4 p-[18px]">
            <UserAvatar name={c.name} photoUrl={c.photo_url} size={44} tone="muted" />
            <div className="min-w-0">
              <p className="truncate text-base font-extrabold">{c.name}</p>
              {c.description && (
                <p className="truncate text-[12.5px] text-muted-foreground">{c.description}</p>
              )}
              {c.email && (
                <a
                  href={`mailto:${c.email}`}
                  className="mt-0.5 inline-block truncate text-[11px] font-extrabold uppercase tracking-[0.1em] text-primary hover:text-ink"
                >
                  {c.email} ↗
                </a>
              )}
            </div>
          </PaperCard>
        ))
      )}

      <PaperCard tone="accent" className="p-6">
        <p className="text-[19px] font-black leading-tight tracking-[-0.03em]">
          A gente responde o mais rápido possível.
        </p>
        <p className="mt-3 text-xs leading-[1.6] text-ink/75">{PRIVACY_NOTE}</p>
      </PaperCard>
    </div>
  );
}
