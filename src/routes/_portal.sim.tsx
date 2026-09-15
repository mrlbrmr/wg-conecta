import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Lightbulb } from "lucide-react";
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
import { SubmissionReceipt } from "@/components/anonymous/submission-receipt";
import { useCurrentEmployee } from "@/hooks/use-current-employee";
import { SIM_KINDS, SIM_REASONS, SIM_SECTORS, simSchema } from "@/lib/anonymous-defs";
import { submitAnonymous } from "@/lib/anonymous.functions";
import { UNITS } from "@/lib/org";

export const Route = createFileRoute("/_portal/sim")({
  head: () => ({ meta: [{ title: "SIM — Sistema Interno de Melhorias — Portal WG" }] }),
  component: SimPage,
});

type Unit = (typeof UNITS)[number];

const EMPTY = {
  contact_name: "",
  contact: "",
  unit: "" as Unit | "",
  kind: "" as (typeof SIM_KINDS)[number] | "",
  sector: "" as (typeof SIM_SECTORS)[number] | "",
  reason: "" as (typeof SIM_REASONS)[number] | "",
  description: "",
};

const OPTIONAL_HINT =
  "Não obrigatório, mas importante caso queira receber qual foi a resolução desse SIM.";

function SimPage() {
  const submit = useServerFn(submitAnonymous);
  const me = useCurrentEmployee();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [receipt, setReceipt] = useState<{ protocol: string; key: string } | null>(null);

  const myUnit = (UNITS as readonly string[]).includes(me.data?.unit ?? "")
    ? (me.data!.unit as Unit)
    : "";

  // O local de trabalho já vem com a filial do cadastro; dá para trocar.
  useEffect(() => {
    if (myUnit) setForm((f) => (f.unit ? f : { ...f, unit: myUnit }));
  }, [myUnit]);

  const set = <K extends keyof typeof EMPTY>(key: K) => (value: (typeof EMPTY)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const mutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => submit({ data: { channel: "sim", payload } }),
    onSuccess: (res) => {
      setReceipt(res);
      setForm({ ...EMPTY, unit: myUnit });
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = simSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(
        Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])),
      );
      return;
    }
    setErrors({});
    mutation.mutate(parsed.data);
  };

  return (
    <div>
      <PageHeading
        kicker="SIM · Sistema Interno de Melhorias"
        title="Viu algo que dá para melhorar?"
        subtitle="Para uma empresa ser produtiva e lucrativa, seus processos devem ser efetivos. O objetivo do SIM é melhorar continuamente a produtividade dos processos — e para isso é preciso identificar os problemas da área para eliminá-los ou implementar melhorias."
      />

      <div className="mt-8 grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_300px]">
        {receipt ? (
          <SubmissionReceipt
            channel="sim"
            protocol={receipt.protocol}
            accessKey={receipt.key}
            onAnother={() => setReceipt(null)}
          />
        ) : (
          <PaperCard asChild className="overflow-hidden">
            <form onSubmit={onSubmit} noValidate>
              <FormSection title="Quem sugere" divider={false} hint={OPTIONAL_HINT}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextInput
                    label="Seu nome"
                    value={form.contact_name}
                    onChange={(e) => set("contact_name")(e.target.value)}
                    error={errors.contact_name}
                  />
                  <TextInput
                    label="Contato"
                    value={form.contact}
                    onChange={(e) => set("contact")(e.target.value)}
                    placeholder="Telefone ou e-mail"
                    error={errors.contact}
                  />
                </div>
                {me.data?.name && !form.contact_name && (
                  <button
                    type="button"
                    onClick={() => set("contact_name")(me.data!.name)}
                    className="mt-3 text-xs font-extrabold uppercase tracking-[0.1em] text-primary hover:underline"
                  >
                    Usar meu nome
                  </button>
                )}
              </FormSection>

              <FormSection title="A melhoria">
                <div className="grid gap-6">
                  <ChoiceChips
                    label="Local de trabalho"
                    options={UNITS}
                    value={form.unit}
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
                    label="Para qual setor?"
                    options={SIM_SECTORS}
                    value={form.sector}
                    onChange={set("sector")}
                    error={errors.sector}
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
                  Ao enviar, você recebe um protocolo e uma chave para acompanhar a resposta.
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
              <li>O G&amp;G leva ao setor responsável.</li>
              <li>A resposta aparece em Acompanhar, com o protocolo e a chave.</li>
            </ol>
          </PaperCard>
          <p className="text-[13px] leading-[1.6] text-muted-foreground">
            Já enviou?{" "}
            <Link to="/acompanhar" className="font-bold text-primary hover:underline">
              Acompanhe pelo protocolo
            </Link>
            .
          </p>
        </aside>
      </div>
    </div>
  );
}
