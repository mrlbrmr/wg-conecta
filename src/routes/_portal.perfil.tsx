import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { z } from "zod";
import { Award, Calendar, CircleCheck } from "lucide-react";
import { toast } from "sonner";
import { Chip, IconBubble, InkButton, Kicker, PaperCard, ProgressBar } from "@/components/paper";
import { UserAvatar } from "@/components/user-avatar";
import { RecognizeColleagueForm } from "@/components/recognize-colleague";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { currentEmployeeQuery } from "@/hooks/use-current-employee";
import type { OwnEmployee } from "@/lib/employee.functions";
import { directoryQuery } from "@/lib/directory-queries";
import {
  checklistItemsQuery,
  ownProgressQuery,
  ownRequestsQuery,
  recognitionsForQuery,
  trackProgress,
  REQUEST_STATUS_LABEL,
  REQUEST_STATUS_TONE,
} from "@/lib/profile-queries";
import { updateOwnBio, updateOwnPhoto } from "@/lib/portal-write.functions";
import { uploadEmployeePhoto } from "@/lib/storage";
import { formatDate, formatDayMonth, tenureLabel, MONTHS } from "@/lib/tenure";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "visao-geral", label: "Visão geral", short: "Visão geral" },
  { id: "time", label: "Meu time", short: "Time" },
  { id: "trilha", label: "Trilha", short: "Trilha" },
  { id: "solicitacoes", label: "Solicitações", short: "Pedidos" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const PRIVACY_NOTE =
  "Uso interno. Nada de CPF, telefone pessoal, endereço, documentos ou dados bancários por aqui.";

export const Route = createFileRoute("/_portal/perfil")({
  head: () => ({ meta: [{ title: "Meu perfil — Portal WG" }] }),
  validateSearch: z.object({
    aba: z.enum(["visao-geral", "time", "trilha", "solicitacoes"]).optional(),
  }),
  component: PerfilPage,
});

function PerfilPage() {
  const { aba } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const tab: TabId = aba ?? "visao-geral";

  const me = useQuery(currentEmployeeQuery);
  const [editing, setEditing] = useState(false);
  const [recognizing, setRecognizing] = useState(false);

  const setTab = (next: TabId) =>
    navigate({ search: next === "visao-geral" ? {} : { aba: next }, replace: true });

  if (me.isLoading) return <ProfileSkeleton />;

  if (!me.data) {
    return (
      <PaperCard tone="soft" className="p-8">
        <h1 className="text-2xl font-black tracking-tight">
          Não encontramos seu cadastro de colaborador.
        </h1>
        <p className="mt-2 max-w-[56ch] text-[15px] leading-[1.7] text-muted-foreground">
          Sua conta existe, mas ainda não está ligada a um registro de colaborador. Fala com Gente
          &amp; Gestão que a gente resolve.
        </p>
      </PaperCard>
    );
  }

  const employee = me.data;

  return (
    <div>
      <ProfileHeader
        employee={employee}
        editing={editing}
        onToggleEdit={() => {
          setEditing((v) => !v);
          setTab("visao-geral");
        }}
        onRecognize={() => setRecognizing(true)}
      />

      <Dialog open={recognizing} onOpenChange={setRecognizing}>
        <DialogContent className="max-w-[560px] border-[1.5px] border-ink bg-paper p-0 shadow-elevated sm:rounded-lg">
          <DialogTitle className="sr-only">Dar reconhecimento a um colega</DialogTitle>
          <DialogDescription className="sr-only">
            Escolha o colega e escreva o que ele fez.
          </DialogDescription>
          <RecognizeColleagueForm
            selfId={employee.id}
            onPublished={() => setRecognizing(false)}
            className="border-0 shadow-none"
          />
        </DialogContent>
      </Dialog>

      <nav
        className="mt-8 flex gap-1 overflow-x-auto border-b-[1.5px] border-ink"
        aria-label="Seções do perfil"
      >
        {TABS.map((t) => {
          const active = t.id === tab;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative whitespace-nowrap px-4 py-3 text-xs font-extrabold uppercase tracking-[0.08em] transition-colors",
                active ? "text-ink" : "text-muted-foreground hover:text-ink",
              )}
            >
              <span className="hidden sm:inline">{t.label}</span>
              <span className="sm:hidden">{t.short}</span>
              <span
                className={cn(
                  "absolute -bottom-[1.5px] left-3 right-3 h-[3px]",
                  active ? "bg-primary" : "bg-transparent",
                )}
              />
            </button>
          );
        })}
      </nav>

      <div key={tab} className="animate-content-in">
        {tab === "visao-geral" && (
          <OverviewTab
            employee={employee}
            editing={editing}
            onDoneEditing={() => setEditing(false)}
          />
        )}
        {tab === "time" && <TeamTab employee={employee} />}
        {tab === "trilha" && <TrackTab />}
        {tab === "solicitacoes" && <RequestsTab />}
      </div>
    </div>
  );
}

type Employee = NonNullable<OwnEmployee>;

// ── Cabeçalho ─────────────────────────────────────────────────────────

function ProfileHeader({
  employee,
  editing,
  onToggleEdit,
  onRecognize,
}: {
  employee: Employee;
  editing: boolean;
  onToggleEdit: () => void;
  onRecognize: () => void;
}) {
  const qc = useQueryClient();
  const savePhoto = useServerFn(updateOwnPhoto);
  const fileRef = useRef<HTMLInputElement>(null);

  const photo = useMutation({
    mutationFn: async (file: File) => {
      const path = await uploadEmployeePhoto(file, employee.id);
      await savePhoto({ data: { photo_url: path } });
    },
    onSuccess: () => {
      toast.success("Foto atualizada!");
      qc.invalidateQueries({ queryKey: ["current-employee"] });
      qc.invalidateQueries({ queryKey: ["employee_directory"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <PaperCard className="p-6 md:p-8">
      <div className="grid gap-7 md:grid-cols-[128px_1fr] lg:grid-cols-[128px_1fr_auto] md:items-start">
        <div className="flex flex-col items-center gap-3 md:items-start">
          <span className="relative">
            <UserAvatar
              name={employee.name}
              photoUrl={employee.photo_url}
              size={128}
              tone="accent"
              className="shadow-[3px_4px_0_var(--color-ink)]"
            />
          </span>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/avif"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) photo.mutate(file);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            disabled={photo.isPending}
            onClick={() => fileRef.current?.click()}
            className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-primary disabled:opacity-50"
          >
            {photo.isPending ? "Enviando…" : "Trocar foto"}
          </button>
        </div>

        <div className="min-w-0">
          <Kicker>Meu perfil</Kicker>
          <h1 className="mt-3 text-[26px] font-black leading-[1.02] tracking-[-0.045em] sm:text-[34px] lg:text-[42px]">
            {employee.name}
          </h1>
          <p className="mt-2 text-[15px] font-semibold text-muted-foreground lg:text-[17px]">
            {[employee.job_title, employee.unit].filter(Boolean).join(" · ") || "Colaborador"}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {employee.admission_date && (
              <Chip tone="accent">{tenureLabel(employee.admission_date)}</Chip>
            )}
            {employee.birthday_day && (
              <Chip tone="soft">
                Aniversário {formatDayMonth(employee.birthday_day, employee.birthday_month)}
              </Chip>
            )}
            {employee.department && <Chip tone="soft">{employee.department}</Chip>}
          </div>
        </div>

        <div className="flex flex-col gap-2.5 lg:min-w-[236px]">
          <InkButton onClick={onToggleEdit}>
            {editing ? "Sair da edição" : "Editar foto e bio"}
          </InkButton>
          <InkButton variant="outline" onClick={onRecognize}>
            Dar reconhecimento a um colega
          </InkButton>
          <InkButton variant="outline" asChild>
            <Link to="/formularios">Abrir solicitação para G&amp;G ↗</Link>
          </InkButton>
        </div>
      </div>
    </PaperCard>
  );
}

// ── Visão geral ───────────────────────────────────────────────────────

function OverviewTab({
  employee,
  editing,
  onDoneEditing,
}: {
  employee: Employee;
  editing: boolean;
  onDoneEditing: () => void;
}) {
  const recognitions = useQuery(recognitionsForQuery(employee.id));
  const directory = useQuery(directoryQuery);
  const byId = new Map((directory.data ?? []).map((e) => [e.id, e]));
  const thisYear = new Date().getFullYear();
  const receivedThisYear = (recognitions.data ?? []).filter(
    (r) => new Date(r.created_at).getFullYear() === thisYear,
  ).length;

  return (
    <div className="mt-6 grid items-start gap-6 lg:grid-cols-[1fr_380px]">
      <div className="grid gap-6">
        <AboutMe employee={employee} editing={editing} onDoneEditing={onDoneEditing} />

        <section>
          <div className="flex items-baseline justify-between gap-4">
            <Kicker>Reconhecimentos recebidos</Kicker>
            <span className="text-xs font-bold tabular-nums text-muted-foreground">
              {receivedThisYear} este ano
            </span>
          </div>

          {recognitions.isLoading ? (
            <Skeleton className="mt-4 h-24 w-full" />
          ) : (recognitions.data ?? []).length === 0 ? (
            <PaperCard tone="soft" className="mt-4 p-6">
              <p className="text-[15px] leading-[1.65] text-muted-foreground">
                Você ainda não recebeu reconhecimentos por aqui.
              </p>
            </PaperCard>
          ) : (
            <div className="mt-4 flex flex-col gap-3">
              {(recognitions.data ?? []).map((r) => {
                const author = r.from_employee_id ? byId.get(r.from_employee_id) : null;
                return (
                  <PaperCard key={r.id} tone="soft" className="grid grid-cols-[40px_1fr] gap-4 p-5">
                    <IconBubble size={40}>
                      <Award />
                    </IconBubble>
                    <div className="min-w-0">
                      <p className="text-[15px] leading-[1.65] text-pretty">{r.message}</p>
                      <p className="mt-2 text-xs font-bold uppercase tracking-[0.1em] tabular-nums text-muted-foreground">
                        {author?.name ?? "Time WG"} · {formatDate(r.created_at)}
                      </p>
                    </div>
                  </PaperCard>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <div className="grid gap-6">
        <RecordCard employee={employee} />
        <MonthCard employee={employee} />
      </div>
    </div>
  );
}

function AboutMe({
  employee,
  editing,
  onDoneEditing,
}: {
  employee: Employee;
  editing: boolean;
  onDoneEditing: () => void;
}) {
  const qc = useQueryClient();
  const saveBio = useServerFn(updateOwnBio);
  const [draft, setDraft] = useState(employee.bio ?? "");

  const mutation = useMutation({
    mutationFn: () => saveBio({ data: { bio: draft } }),
    onSuccess: () => {
      toast.success("Bio atualizada!");
      qc.invalidateQueries({ queryKey: ["current-employee"] });
      onDoneEditing();
    },
    onError: () => toast.error("Não conseguimos salvar agora. Tenta de novo em instantes?"),
  });

  return (
    <PaperCard className="p-6 md:p-7">
      <div className="flex items-center justify-between gap-4">
        <Kicker>Sobre mim</Kicker>
        <span className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-primary">
          {editing ? "Editando" : ""}
        </span>
      </div>

      {editing ? (
        <div className="mt-4">
          <label className="sr-only" htmlFor="bio">
            Sua bio
          </label>
          <textarea
            id="bio"
            rows={4}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Conta pro time o que você faz e o que te move por aqui."
            className="w-full resize-y rounded-lg border-[1.5px] border-ink bg-surface px-4 py-3.5 text-base leading-[1.65] outline-none"
          />
          <div className="mt-3 flex flex-wrap items-center gap-4">
            <InkButton disabled={mutation.isPending} onClick={() => mutation.mutate()}>
              {mutation.isPending ? "Salvando…" : "Salvar bio"}
            </InkButton>
            <button
              type="button"
              onClick={() => {
                setDraft(employee.bio ?? "");
                onDoneEditing();
              }}
              className="text-[13px] font-bold text-muted-foreground hover:text-ink"
            >
              Cancelar
            </button>
            <span className="ml-auto text-xs text-muted-foreground">Visível para o time todo.</span>
          </div>
          <p className="mt-3 text-xs leading-[1.6] text-muted-foreground">{PRIVACY_NOTE}</p>
        </div>
      ) : (
        <p className="mt-4 max-w-[60ch] text-[17px] leading-[1.7] text-pretty">
          {employee.bio ?? "Você ainda não escreveu sua bio — conta pro time quem é você."}
        </p>
      )}
    </PaperCard>
  );
}

function RecordCard({ employee }: { employee: Employee }) {
  const rows: [string, string][] = [
    ["Admissão", formatDate(employee.admission_date)],
    ["Tempo de casa", tenureLabel(employee.admission_date, "")],
    ["Área", employee.department ?? "—"],
    ["Unidade", employee.unit ?? "—"],
    ["Aniversário", formatDayMonth(employee.birthday_day, employee.birthday_month)],
    ["Ramal", employee.extension ?? "—"],
    ["E-mail", employee.email ?? "—"],
  ];

  return (
    <PaperCard className="p-6 md:p-[26px]">
      <Kicker>Minha ficha</Kicker>
      <dl className="mt-4">
        {rows.map(([label, value]) => (
          <div
            key={label}
            className="flex items-baseline justify-between gap-4 border-b border-border py-[11px] last:border-b-0"
          >
            <dt className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground">
              {label}
            </dt>
            <dd className="min-w-0 truncate text-right text-[15px] font-bold tabular-nums">
              {value}
            </dd>
          </div>
        ))}
      </dl>
      <InkButton variant="outline" className="mt-5 w-full" asChild>
        <Link to="/formularios">Atualizar dados de contato</Link>
      </InkButton>
      <p className="mt-4 text-xs leading-[1.6] text-muted-foreground">{PRIVACY_NOTE}</p>
    </PaperCard>
  );
}

function MonthCard({ employee }: { employee: Employee }) {
  const month = MONTHS[new Date().getMonth()];
  const birthdayThisMonth = employee.birthday_month === new Date().getMonth() + 1;
  const anniversaryThisMonth =
    employee.admission_date != null &&
    Number(employee.admission_date.slice(5, 7)) === new Date().getMonth() + 1;

  const headline = birthdayThisMonth
    ? "Seu aniversário é este mês."
    : anniversaryThisMonth
      ? "Seu aniversário de casa é este mês."
      : `Bom ${month} pra você.`;

  const text = birthdayThisMonth
    ? `Dia ${formatDayMonth(employee.birthday_day, employee.birthday_month)} o time todo vai saber. Bolo por sua conta?`
    : anniversaryThisMonth
      ? `${tenureLabel(employee.admission_date)} — e a gente agradece por cada um deles.`
      : "Nada marcado pra você neste mês. Dá uma olhada no calendário interno em Cultura WG.";

  return (
    <PaperCard tone="accent" className="p-6 md:p-[26px]">
      <div className="flex items-center gap-3">
        <IconBubble size={40}>
          <Calendar />
        </IconBubble>
        <span className="text-[11px] font-extrabold uppercase tracking-[0.14em]">Seu mês</span>
      </div>
      <h3 className="mt-4 text-[22px] font-black leading-tight tracking-[-0.03em]">{headline}</h3>
      <p className="mt-2 text-sm leading-[1.6] text-ink/75">{text}</p>
    </PaperCard>
  );
}

// ── Meu time ──────────────────────────────────────────────────────────

function TeamTab({ employee }: { employee: Employee }) {
  const directory = useQuery(directoryQuery);
  const all = directory.data ?? [];
  const manager = employee.manager_id ? all.find((e) => e.id === employee.manager_id) : null;
  const peers = all.filter(
    (e) =>
      e.id !== employee.id &&
      e.id !== employee.manager_id &&
      employee.department != null &&
      e.department === employee.department,
  );

  if (directory.isLoading) return <Skeleton className="mt-6 h-64 w-full" />;

  return (
    <div className="mt-6 grid gap-6">
      {manager ? (
        <PaperCard tone="ink" className="p-6 md:p-7">
          <Kicker color="var(--color-accent)">Meu gestor</Kicker>
          <div className="mt-5 flex flex-wrap items-center gap-5">
            <UserAvatar name={manager.name} photoUrl={manager.photo_url} size={64} tone="accent" />
            <div className="min-w-0 flex-1">
              <p className="text-[22px] font-black tracking-[-0.03em] lg:text-[26px]">
                {manager.name}
              </p>
              <p className="mt-1 text-[15px] text-paper/75">{manager.job_title ?? "Gestão"}</p>
            </div>
            {manager.extension && <InkButton variant="accent">Ramal {manager.extension}</InkButton>}
          </div>
        </PaperCard>
      ) : (
        <PaperCard tone="soft" className="p-6">
          <p className="text-[15px] leading-[1.65] text-muted-foreground">
            Sua gestão ainda não está registrada no portal. G&amp;G resolve isso rapidinho.
          </p>
        </PaperCard>
      )}

      <section>
        <div className="flex items-baseline justify-between gap-4">
          <Kicker>Colegas da área</Kicker>
          <span className="text-xs font-bold tabular-nums text-muted-foreground">
            {peers.length} {peers.length === 1 ? "pessoa" : "pessoas"}
          </span>
        </div>

        {peers.length === 0 ? (
          <PaperCard tone="soft" className="mt-4 p-6">
            <p className="text-[15px] leading-[1.65] text-muted-foreground">
              Ninguém mais cadastrado na sua área por enquanto.
            </p>
          </PaperCard>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {peers.map((p) => (
              <PaperCard key={p.id} hover className="flex items-center gap-4 p-5">
                <UserAvatar name={p.name} photoUrl={p.photo_url} size={48} tone="muted" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[17px] font-extrabold tracking-[-0.02em]">{p.name}</p>
                  <p className="truncate text-[13px] text-muted-foreground">
                    {p.job_title ?? "Colaborador"}
                  </p>
                </div>
                {p.extension && (
                  <span className="shrink-0 text-[11px] font-extrabold uppercase tracking-[0.12em] text-primary">
                    Ramal {p.extension}
                  </span>
                )}
              </PaperCard>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ── Trilha ────────────────────────────────────────────────────────────

function TrackTab() {
  const items = useQuery(checklistItemsQuery);
  const progress = useQuery(ownProgressQuery);

  if (items.isLoading || progress.isLoading) return <Skeleton className="mt-6 h-64 w-full" />;

  const list = items.data ?? [];
  const { completed, total, percent, doneIds } = trackProgress(list, progress.data ?? []);
  const current = list.find((i) => !doneIds.has(i.id));

  if (total === 0) {
    return (
      <PaperCard tone="soft" className="mt-6 p-8">
        <p className="text-xl font-black tracking-tight">
          Sua trilha ainda não tem módulos atribuídos.
        </p>
        <p className="mt-2 text-[15px] leading-[1.65] text-muted-foreground">
          Assim que Gente &amp; Gestão montar a trilha da sua área, ela aparece aqui.
        </p>
      </PaperCard>
    );
  }

  return (
    <div className="mt-6 grid items-start gap-6 lg:grid-cols-[1fr_380px]">
      <div className="flex flex-col gap-3">
        {list.map((item) => {
          const done = doneIds.has(item.id);
          const doing = !done && item.id === current?.id;
          return (
            <PaperCard
              key={item.id}
              tone="soft"
              className="grid grid-cols-[36px_1fr_auto] items-center gap-4 p-[18px]"
            >
              <IconBubble size={36} state={done ? "done" : doing ? "doing" : "todo"}>
                <CircleCheck />
              </IconBubble>
              <div className="min-w-0">
                <p className="text-base font-extrabold">{item.title}</p>
                {item.detail && (
                  <p className="text-[13px] tabular-nums text-muted-foreground">{item.detail}</p>
                )}
              </div>
              <Chip tone={done ? "success" : doing ? "accent" : "soft"}>
                {done ? "Concluído" : doing ? "Em andamento" : "Pendente"}
              </Chip>
            </PaperCard>
          );
        })}
      </div>

      <PaperCard className="p-6 md:p-[26px]">
        <Kicker>Onde você está</Kicker>
        <p className="mt-4 flex items-baseline gap-2">
          <span className="text-[56px] font-black leading-none tracking-[-0.05em] tabular-nums">
            {completed}
          </span>
          <span className="text-[26px] font-black tabular-nums text-muted-foreground">
            /{total}
          </span>
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          módulos concluídos na sua trilha de integração
        </p>
        <ProgressBar className="mt-5" value={percent} label="Progresso da trilha" />
        <p className="mt-4 text-sm leading-[1.65]">
          {current
            ? `Próximo: ${current.title}${current.deadline_label ? ` — ${current.deadline_label}.` : "."}`
            : "Trilha completa. Bem-vindo(a) de vez."}
        </p>
      </PaperCard>
    </div>
  );
}

// ── Solicitações ──────────────────────────────────────────────────────

function RequestsTab() {
  const requests = useQuery(ownRequestsQuery);

  if (requests.isLoading) return <Skeleton className="mt-6 h-48 w-full" />;
  const list = requests.data ?? [];

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Kicker>Minhas solicitações em G&amp;G</Kicker>
        <InkButton asChild>
          <Link to="/formularios">Abrir solicitação ↗</Link>
        </InkButton>
      </div>

      {list.length === 0 ? (
        <PaperCard tone="soft" className="mt-5 p-8">
          <p className="text-xl font-black tracking-tight">Nenhuma solicitação aberta.</p>
          <p className="mt-2 text-[15px] leading-[1.65] text-muted-foreground">
            Quando você pedir alguma coisa pra gente, o protocolo e o andamento aparecem aqui.
          </p>
        </PaperCard>
      ) : (
        <div className="mt-5 flex flex-col gap-3">
          {list.map((r) => (
            <PaperCard key={r.id} className="grid gap-5 p-[22px] sm:grid-cols-[1fr_auto]">
              <div className="min-w-0">
                <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] tabular-nums text-primary">
                  Protocolo {r.protocol}
                  {r.subject ? ` · ${r.subject}` : ""}
                </p>
                <h3 className="mt-1.5 text-xl font-black tracking-[-0.03em]">{r.title}</h3>
                <p className="mt-1.5 text-sm tabular-nums text-muted-foreground">
                  Aberta em {formatDate(r.created_at)}
                  {r.due_date ? ` · prazo até ${formatDate(r.due_date)}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-4 sm:flex-col sm:items-end sm:justify-between">
                <Chip tone={REQUEST_STATUS_TONE[r.status] ?? "soft"}>
                  {REQUEST_STATUS_LABEL[r.status] ?? r.status}
                </Chip>
                <Link
                  to="/formularios"
                  className="text-xs font-extrabold uppercase tracking-[0.12em] text-ink hover:text-primary"
                >
                  Ver conversa ↗
                </Link>
              </div>
            </PaperCard>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Carregando ────────────────────────────────────────────────────────

function ProfileSkeleton() {
  return (
    <div>
      <Skeleton className="h-56 w-full" />
      <Skeleton className="mt-8 h-12 w-full" />
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px]">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  );
}
