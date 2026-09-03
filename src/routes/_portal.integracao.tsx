import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BookOpen, Check, FileText, Play, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import {
  IconBubble,
  InkButton,
  Kicker,
  PageHeading,
  PaperCard,
  ProgressBar,
  Signature,
} from "@/components/paper";
import { UserAvatar } from "@/components/user-avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { currentEmployeeQuery } from "@/hooks/use-current-employee";
import { directoryQuery, type DirectoryEntry } from "@/lib/directory-queries";
import { onboardingQuery, type OnboardingMaterial } from "@/lib/portal-queries";
import {
  checklistItemsQuery,
  ownMaterialViewsQuery,
  ownProgressQuery,
  trackProgress,
  type ChecklistItem,
} from "@/lib/profile-queries";
import { setChecklistItemDone, setMaterialViewed } from "@/lib/portal-write.functions";
import { cn } from "@/lib/utils";

/** As cinco etapas da linha do tempo, na ordem do handoff. */
const STAGES = [
  { id: "primeiro_dia", label: "1º dia", tone: "ink" as const },
  { id: "primeira_semana", label: "1ª semana", tone: "paper" as const },
  { id: "trinta_dias", label: "30 dias", tone: "paper" as const },
  { id: "sessenta_dias", label: "60 dias", tone: "paper" as const },
  { id: "noventa_dias", label: "90 dias", tone: "accent" as const },
];

const MATERIAL_ICON: Record<string, typeof Play> = {
  video: Play,
  politica: ShieldCheck,
  pdf: FileText,
  livro: BookOpen,
};

export const Route = createFileRoute("/_portal/integracao")({
  head: () => ({ meta: [{ title: "Integração — Portal WG" }] }),
  component: IntegracaoPage,
});

function IntegracaoPage() {
  const items = useQuery(checklistItemsQuery);
  const progress = useQuery(ownProgressQuery);

  const list = items.data ?? [];
  const { completed, total, percent, doneIds } = trackProgress(list, progress.data ?? []);

  return (
    <div>
      <PageHeading
        kicker="Integração"
        title={
          <>
            Bem-vindo(a). <Signature>Aqui é WG</Signature>.
          </>
        }
        subtitle="Seus primeiros 90 dias, sem mistério: o que fazer, com quem falar e o que assistir. Dúvida boba também vale — manda pra gente sem cerimônia."
      />

      {items.isLoading || progress.isLoading ? (
        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_380px]">
          <Skeleton className="h-80 w-full" />
          <Skeleton className="h-80 w-full" />
        </div>
      ) : (
        <div className="mt-8 grid items-start gap-6 lg:grid-cols-[1fr_380px]">
          <ChecklistSection items={list} doneIds={doneIds} completed={completed} total={total} />
          <div className="grid gap-6">
            <TrackCard percent={percent} completed={completed} total={total} />
            <WhoIsWhoCard />
          </div>
        </div>
      )}

      <TimelineSection items={list} doneIds={doneIds} />
      <MaterialsSection />
    </div>
  );
}

// ── Checklist ─────────────────────────────────────────────────────────

function ChecklistSection({
  items,
  doneIds,
  completed,
  total,
}: {
  items: ChecklistItem[];
  doneIds: Set<string>;
  completed: number;
  total: number;
}) {
  return (
    <section>
      <div className="flex items-baseline justify-between gap-4">
        <Kicker>Checklist dos primeiros dias</Kicker>
        <span className="text-xs font-bold tabular-nums text-muted-foreground">
          {completed} de {total} concluídos
        </span>
      </div>

      {items.length === 0 ? (
        <PaperCard tone="soft" className="mt-4 p-8">
          <p className="text-xl font-black tracking-tight">
            Sua trilha ainda não tem itens atribuídos.
          </p>
          <p className="mt-2 text-[15px] leading-[1.65] text-muted-foreground">
            Assim que Gente &amp; Gestão montar a trilha da sua área, ela aparece aqui.
          </p>
        </PaperCard>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          {items.map((item) => (
            <ChecklistRow key={item.id} item={item} done={doneIds.has(item.id)} />
          ))}
        </div>
      )}
    </section>
  );
}

function ChecklistRow({ item, done }: { item: ChecklistItem; done: boolean }) {
  const qc = useQueryClient();
  const toggle = useServerFn(setChecklistItemDone);

  const mutation = useMutation({
    mutationFn: () => toggle({ data: { item_id: item.id, done: !done } }),
    onSettled: () => qc.invalidateQueries({ queryKey: ["onboarding_progress"] }),
    onError: () => toast.error("Não conseguimos salvar agora. Tenta de novo em instantes?"),
  });

  return (
    <PaperCard tone="soft" asChild>
      <button
        type="button"
        disabled={mutation.isPending}
        onClick={() => mutation.mutate()}
        aria-pressed={done}
        className="grid w-full grid-cols-[32px_1fr_auto] items-center gap-4 p-4 text-left disabled:opacity-50"
      >
        <span
          className={cn(
            "grid h-8 w-8 place-items-center rounded-[9px] border-[1.5px] border-ink",
            done ? "bg-accent text-ink" : "bg-surface text-border",
          )}
        >
          <Check className="h-4 w-4" />
        </span>

        <span className="min-w-0">
          <span
            className={cn(
              "block text-[16.5px] font-extrabold",
              done && "text-muted-foreground line-through",
            )}
          >
            {item.title}
          </span>
          {item.detail && (
            <span className="block text-[12.5px] text-muted-foreground">{item.detail}</span>
          )}
        </span>

        {item.deadline_label && (
          <span
            className={cn(
              "shrink-0 whitespace-nowrap text-[10px] font-extrabold uppercase tracking-[0.14em]",
              done ? "text-primary" : "text-muted-foreground",
            )}
          >
            {item.deadline_label}
          </span>
        )}
      </button>
    </PaperCard>
  );
}

// ── Trilha ────────────────────────────────────────────────────────────

function TrackCard({
  percent,
  completed,
  total,
}: {
  percent: number;
  completed: number;
  total: number;
}) {
  return (
    <PaperCard tone="accent" className="p-7">
      <span className="block text-[52px] font-black leading-none tracking-[-0.05em] tabular-nums lg:text-[64px]">
        {percent}%
      </span>
      <p className="mt-2 text-[15px] font-bold">da sua trilha concluída</p>
      <ProgressBar className="mt-5" value={percent} fill="ink" label="Progresso da integração" />
      <p className="mt-4 text-[13.5px] leading-[1.6] text-ink/75">
        {total === 0
          ? "A trilha aparece aqui assim que o G&G montar a da sua área."
          : completed === total
            ? "Trilha completa. Bem-vindo(a) de vez."
            : `Faltam ${total - completed} ${total - completed === 1 ? "item" : "itens"} — dá pra marcar clicando no card.`}
      </p>
    </PaperCard>
  );
}

// ── Quem é quem ───────────────────────────────────────────────────────

function WhoIsWhoCard() {
  const me = useQuery(currentEmployeeQuery);
  const directory = useQuery(directoryQuery);
  const byId = new Map((directory.data ?? []).map((e) => [e.id, e]));

  const people: { role: string; person: DirectoryEntry | undefined }[] = [
    { role: "Gestora", person: me.data?.manager_id ? byId.get(me.data.manager_id) : undefined },
    {
      role: "Padrinho de integração",
      person: me.data?.buddy_id ? byId.get(me.data.buddy_id) : undefined,
    },
  ];

  const known = people.filter((p) => p.person);

  return (
    <PaperCard className="p-6">
      <Kicker>Quem é quem</Kicker>

      {known.length === 0 ? (
        <p className="mt-4 text-[15px] leading-[1.65] text-muted-foreground">
          Sua gestão e seu padrinho ainda não estão registrados no portal. G&amp;G resolve isso
          rapidinho.
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-4">
          {known.map(({ role, person }) => (
            <li key={role} className="flex items-center gap-4">
              <UserAvatar name={person!.name} photoUrl={person!.photo_url} size={46} tone="muted" />
              <span className="min-w-0">
                <span className="block text-[10px] font-extrabold uppercase tracking-[0.16em] text-primary">
                  {role}
                </span>
                <span className="block truncate text-base font-extrabold">{person!.name}</span>
                <span className="block truncate text-[12.5px] text-muted-foreground">
                  {person!.job_title ?? "Grupo WG"}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}

      <InkButton variant="outline" className="mt-5 w-full" asChild>
        <a href="/gente-gestao/contatos">Falar com o G&amp;G ↗</a>
      </InkButton>
    </PaperCard>
  );
}

// ── Linha do tempo ────────────────────────────────────────────────────

function TimelineSection({ items, doneIds }: { items: ChecklistItem[]; doneIds: Set<string> }) {
  if (items.length === 0) return null;

  return (
    <section className="mt-12">
      <Kicker>Linha do tempo</Kicker>
      <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] sm:text-3xl">
        Do primeiro dia aos 90
      </h2>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {STAGES.map((stage) => {
          const stageItems = items.filter((i) => i.stage === stage.id);
          const done = stageItems.filter((i) => doneIds.has(i.id)).length;
          const ink = stage.tone === "ink";
          const accent = stage.tone === "accent";

          const milestone =
            stageItems.length === 0
              ? "Sem itens"
              : done === stageItems.length
                ? "Concluída"
                : done > 0
                  ? "Em andamento"
                  : "Sem data";

          return (
            <PaperCard key={stage.id} tone={stage.tone} className="flex flex-col p-5">
              <span
                className={cn(
                  "self-start rounded-full border-[1.5px] px-3 py-[5px] text-[10px] font-extrabold uppercase tracking-[0.14em]",
                  ink
                    ? "border-accent text-accent"
                    : accent
                      ? "border-ink text-ink"
                      : "border-primary text-primary",
                )}
              >
                {stage.label}
              </span>

              <span className="mt-4 text-[19px] font-black leading-tight tracking-[-0.02em] sm:text-[21px]">
                {stageItems.length} {stageItems.length === 1 ? "item" : "itens"}
              </span>

              <ul className="mt-3 flex flex-1 flex-col gap-1.5">
                {stageItems.slice(0, 3).map((i) => (
                  <li
                    key={i.id}
                    className={cn(
                      "text-[13.5px] leading-[1.5]",
                      ink ? "text-paper/[0.78]" : accent ? "text-ink/75" : "text-muted-foreground",
                    )}
                  >
                    {i.title}
                  </li>
                ))}
              </ul>

              <span
                className={cn(
                  "mt-4 text-[10px] font-extrabold uppercase tracking-[0.14em]",
                  ink ? "text-accent" : accent ? "text-ink" : "text-primary",
                )}
              >
                {milestone}
              </span>
            </PaperCard>
          );
        })}
      </div>
    </section>
  );
}

// ── Vídeos e materiais ────────────────────────────────────────────────

function MaterialsSection() {
  const materials = useQuery(onboardingQuery);
  const views = useQuery(ownMaterialViewsQuery);
  const list = materials.data ?? [];
  const seen = new Set((views.data ?? []).map((v) => v.material_id));

  if (materials.isLoading) return <Skeleton className="mt-12 h-48 w-full" />;
  if (list.length === 0) return null;

  return (
    <section className="mt-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Kicker>Para assistir e ler</Kicker>
          <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] sm:text-3xl">
            Vídeos e materiais
          </h2>
        </div>
        <span className="text-xs font-bold uppercase tracking-[0.14em] tabular-nums text-muted-foreground">
          {list.filter((m) => seen.has(m.id)).length} de {list.length} vistos
        </span>
      </div>

      <div className="mt-6 grid gap-3.5 lg:grid-cols-2">
        {list.map((m) => (
          <MaterialCard key={m.id} material={m} seen={seen.has(m.id)} />
        ))}
      </div>
    </section>
  );
}

function MaterialCard({ material: m, seen }: { material: OnboardingMaterial; seen: boolean }) {
  const qc = useQueryClient();
  const markSeen = useServerFn(setMaterialViewed);
  const Icon = MATERIAL_ICON[m.material_type ?? ""] ?? FileText;

  const mutation = useMutation({
    mutationFn: () => markSeen({ data: { material_id: m.id } }),
    onSettled: () => qc.invalidateQueries({ queryKey: ["material_views"] }),
  });

  const href = m.external_url ?? undefined;

  return (
    <PaperCard hover className="grid grid-cols-[48px_1fr_auto] items-center gap-4 p-[22px]">
      <IconBubble size={48}>
        <Icon />
      </IconBubble>

      <div className="min-w-0">
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            onClick={() => !seen && mutation.mutate()}
            className="block truncate text-lg font-extrabold hover:text-primary"
          >
            {m.title}
          </a>
        ) : (
          <span className="block truncate text-lg font-extrabold">{m.title}</span>
        )}
        {m.description && (
          <span className="block truncate text-[13px] text-muted-foreground">{m.description}</span>
        )}
      </div>

      <div className="shrink-0 text-right">
        {m.duration_label && (
          <span className="block text-[13px] font-bold tabular-nums">{m.duration_label}</span>
        )}
        <span
          className={cn(
            "block text-[10px] font-extrabold uppercase tracking-[0.14em]",
            seen || m.required ? "text-primary" : "text-muted-foreground",
          )}
        >
          {seen ? "Visto" : m.required ? "Obrigatório" : "Não visto"}
        </span>
      </div>
    </PaperCard>
  );
}
