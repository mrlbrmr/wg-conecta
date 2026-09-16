import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useId, useState } from "react";
import { EyeOff, Lightbulb, UserRound } from "lucide-react";
import {
  ChoiceChips,
  FormSection,
  InkButton,
  Kicker,
  PageHeading,
  PaperCard,
  TextArea,
  TextInput,
} from "@/components/paper";
import { SubmissionReceipt } from "@/components/channel/submission-receipt";
import { useCurrentEmployee } from "@/hooks/use-current-employee";
import { SIM_KINDS, SIM_REASONS, simSchema } from "@/lib/channel-defs";
import { submitToChannel } from "@/lib/channel.functions";
import { mySubmissionsQuery } from "@/lib/channel-queries";
import { CPF_LOGIN_DOMAIN } from "@/lib/cpf";
import { UNITS } from "@/lib/org";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_portal/sim/")({
  head: () => ({ meta: [{ title: "SIM — Sistema Interno de Melhorias — Portal WG" }] }),
  component: SimPage,
});

type Unit = (typeof UNITS)[number];
type Mode = "identified" | "anonymous";

const EMPTY = {
  contact: "",
  unit: "" as Unit | "",
  kind: "" as (typeof SIM_KINDS)[number] | "",
  reason: "" as (typeof SIM_REASONS)[number] | "",
  description: "",
};

type Receipt = { protocol: string; key: string | null; id: string | null };

function SimPage() {
  const submit = useServerFn(submitToChannel);
  const qc = useQueryClient();
  const me = useCurrentEmployee();
  const [mode, setMode] = useState<Mode | "">("");
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [receipt, setReceipt] = useState<Receipt | null>(null);

  const myUnit = (UNITS as readonly string[]).includes(me.data?.unit ?? "")
    ? (me.data!.unit as Unit)
    : "";
  // Quem entra por CPF tem e-mail sintético, sem caixa postal: não serve de contato.
  const myEmail = me.data?.email?.endsWith(`@${CPF_LOGIN_DOMAIN}`) ? "" : (me.data?.email ?? "");

  // O local de trabalho já vem com a filial do cadastro; dá para trocar.
  const unit = form.unit || myUnit;

  const set = <K extends keyof typeof EMPTY>(key: K) => (value: (typeof EMPTY)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const chooseMode = (next: Mode) => {
    setMode(next);
    setErrors((e) => ({ ...e, mode: "" }));
    // Com o nome, o contato já vem do cadastro — e continua editável.
    if (next === "identified" && !form.contact) set("contact")(myEmail);
  };

  const mutation = useMutation({
    mutationFn: (vars: { identified: boolean; payload: Record<string, unknown> }) =>
      submit({ data: { channel: "sim", ...vars } }),
    onSuccess: (res, vars) => {
      setReceipt(res);
      setForm(EMPTY);
      setMode("");
      if (vars.identified) qc.invalidateQueries({ queryKey: mySubmissionsQuery.queryKey });
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = simSchema.safeParse({
      ...form,
      unit,
      contact: mode === "identified" ? form.contact : "",
    });
    const fieldErrors: Record<string, string> = parsed.success
      ? {}
      : Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message]));
    if (!mode) fieldErrors.mode = "Escolha se quer enviar com seu nome ou sem se identificar.";
    setErrors(fieldErrors);
    if (!parsed.success || !mode) return;
    mutation.mutate({ identified: mode === "identified", payload: parsed.data });
  };

  return (
    <div>
      <PageHeading
        kicker="SIM · Sistema Interno de Melhorias"
        title="Tem uma ideia, crítica ou sugestão?"
        subtitle="Para uma empresa ser produtiva e lucrativa, seus processos devem ser efetivos. O objetivo do SIM é melhorar continuamente a produtividade dos processos — e para isso é preciso identificar os problemas da área para eliminá-los ou implementar melhorias. Vale qualquer assunto da empresa."
      />

      <div className="mt-8 grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_300px]">
        {receipt ? (
          <SubmissionReceipt
            channel="sim"
            protocol={receipt.protocol}
            accessKey={receipt.key}
            id={receipt.id}
            onAnother={() => setReceipt(null)}
          />
        ) : (
          <PaperCard asChild className="overflow-hidden">
            <form onSubmit={onSubmit} noValidate>
              <FormSection title="Como você quer enviar" divider={false}>
                <ModeChoice value={mode} onChange={chooseMode} error={errors.mode} />

                {mode === "identified" && (
                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <TextInput label="Nome" value={me.data?.name ?? ""} disabled readOnly />
                    <TextInput
                      label="Contato"
                      value={form.contact}
                      onChange={(e) => set("contact")(e.target.value)}
                      placeholder="Telefone ou e-mail"
                      hint="Para o G&G falar com você sobre este SIM."
                      error={errors.contact}
                    />
                  </div>
                )}
                {mode === "anonymous" && (
                  <p className="mt-4 max-w-[62ch] text-[13.5px] leading-[1.6] text-muted-foreground">
                    Nada que identifique você é gravado — nem nome, nem horário. Só evite detalhes
                    que só você saberia: em equipes pequenas, o próprio texto pode identificar quem
                    escreveu.
                  </p>
                )}
              </FormSection>

              <FormSection title="A melhoria">
                <div className="grid gap-6">
                  <ChoiceChips
                    label="Local de trabalho"
                    options={UNITS}
                    value={unit}
                    onChange={set("unit")}
                    error={errors.unit}
                  />
                  <ChoiceChips
                    label="Tipo de melhoria"
                    options={SIM_KINDS}
                    value={form.kind}
                    onChange={set("kind")}
                    error={errors.kind}
                  />
                  <ChoiceChips
                    label="Motivo"
                    options={SIM_REASONS}
                    value={form.reason}
                    onChange={set("reason")}
                    error={errors.reason}
                  />
                  <TextArea
                    label="Descreva brevemente a situação (problema e possível solução)"
                    rows={6}
                    value={form.description}
                    onChange={(e) => set("description")(e.target.value)}
                    error={errors.description}
                  />
                </div>
              </FormSection>

              <div className="mt-7 flex flex-wrap items-center justify-between gap-4 border-t-[1.5px] border-ink bg-paper px-6 py-6 md:px-8">
                <p className="max-w-[46ch] text-xs leading-[1.5] text-muted-foreground">
                  {mode === "identified"
                    ? "Você acompanha a resposta em Meu perfil › Solicitações."
                    : "Sem se identificar, você recebe um protocolo e uma chave para acompanhar a resposta."}
                </p>
                <InkButton type="submit" variant="accent" disabled={mutation.isPending}>
                  {mutation.isPending ? "Enviando…" : "Enviar SIM ↗"}
                </InkButton>
              </div>
              {mutation.isError && (
                <p className="px-6 pb-5 text-sm font-semibold text-destructive md:px-8">
                  {(mutation.error as Error).message}
                </p>
              )}
            </form>
          </PaperCard>
        )}

        <aside className="flex flex-col gap-4 lg:sticky lg:top-24">
          <PaperCard tone="accent" className="p-[22px]">
            <div className="flex items-center gap-2">
              <Lightbulb className="h-4 w-4" />
              <Kicker>Como funciona</Kicker>
            </div>
            <ol className="mt-3.5 list-decimal pl-5 text-[13.5px] leading-[1.65]">
              <li>Você descreve o problema e, se tiver, uma solução.</li>
              <li>Só o time de Gente &amp; Gestão lê e responde. Nenhum outro setor recebe o seu SIM.</li>
              <li>A resposta chega pelo portal — no seu Perfil ou pelo protocolo.</li>
            </ol>
          </PaperCard>
          <p className="text-[13px] leading-[1.6] text-muted-foreground">
            Enviou sem se identificar?{" "}
            <Link to="/acompanhar" className="font-bold text-primary hover:underline">
              Acompanhe pelo protocolo
            </Link>
            . Com seu nome? Está em{" "}
            <Link
              to="/perfil"
              search={{ aba: "solicitacoes" }}
              className="font-bold text-primary hover:underline"
            >
              Meu perfil
            </Link>
            .
          </p>
        </aside>
      </div>
    </div>
  );
}

const MODES: { value: Mode; title: string; desc: string; Icon: typeof UserRound }[] = [
  {
    value: "identified",
    title: "Com meu nome",
    desc: "O G&G sabe quem sugeriu e pode falar com você. Você acompanha pelo Perfil.",
    Icon: UserRound,
  },
  {
    value: "anonymous",
    title: "Sem me identificar",
    desc: "Nada que ligue o SIM a você é gravado. Você acompanha com protocolo e chave.",
    Icon: EyeOff,
  },
];

/** As duas formas de enviar, como radiogroup. Nenhuma vem marcada: a pessoa escolhe. */
function ModeChoice({
  value,
  onChange,
  error,
}: {
  value: Mode | "";
  onChange: (mode: Mode) => void;
  error?: string;
}) {
  const id = useId();
  return (
    <div>
      <div
        role="radiogroup"
        aria-label="Como você quer enviar"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className="grid gap-3 sm:grid-cols-2"
      >
        {MODES.map(({ value: v, title, desc, Icon }) => {
          const on = v === value;
          return (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={on}
              aria-labelledby={`${id}-${v}-title`}
              aria-describedby={`${id}-${v}-desc`}
              onClick={() => onChange(v)}
              className={cn(
                "flex items-start gap-3 rounded-lg border-[1.5px] p-4 text-left transition-colors",
                "focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-1",
                on ? "border-ink bg-accent" : "border-ink/40 bg-surface hover:bg-accent-soft",
                error && !value && "border-destructive",
              )}
            >
              <Icon className="mt-0.5 h-5 w-5 shrink-0" />
              <span>
                <span id={`${id}-${v}-title`} className="block text-[15px] font-black tracking-[-0.01em]">
                  {title}
                </span>
                <span id={`${id}-${v}-desc`} className="mt-1 block text-[13px] leading-[1.5] text-ink/75">
                  {desc}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      {error && (
        <p id={`${id}-error`} className="mt-2 text-xs font-semibold leading-[1.5] text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
