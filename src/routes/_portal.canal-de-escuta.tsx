import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Ear } from "lucide-react";
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
import { ESCUTA_CATEGORIES, escutaSchema } from "@/lib/anonymous-defs";
import { submitAnonymous } from "@/lib/anonymous.functions";

export const Route = createFileRoute("/_portal/canal-de-escuta")({
  head: () => ({ meta: [{ title: "Canal de Escuta — Portal WG" }] }),
  component: CanalDeEscutaPage,
});

type Category = (typeof ESCUTA_CATEGORIES)[number]["value"];

const EMPTY = {
  category: "" as Category | "",
  description: "",
  where: "",
  when: "",
  involved: "",
  contact_name: "",
  contact: "",
};

function CanalDeEscutaPage() {
  const submit = useServerFn(submitAnonymous);
  const [form, setForm] = useState(EMPTY);
  const [identify, setIdentify] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [receipt, setReceipt] = useState<{ protocol: string; key: string } | null>(null);

  const set = (key: keyof typeof EMPTY) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const mutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      submit({ data: { channel: "escuta", payload } }),
    onSuccess: (res) => {
      setReceipt(res);
      setForm(EMPTY);
      setIdentify(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = identify ? form : { ...form, contact_name: "", contact: "" };
    const parsed = escutaSchema.safeParse(payload);
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
        kicker="Gente & Gestão"
        title="Canal de Escuta."
        subtitle="Viu ou viveu algo que não está certo — assédio, discriminação, desrespeito, risco à segurança, conduta antiética? Conte aqui. Você não precisa se identificar."
      />

      <div className="mt-8 grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_300px]">
        {receipt ? (
          <SubmissionReceipt
            channel="escuta"
            protocol={receipt.protocol}
            accessKey={receipt.key}
            onAnother={() => setReceipt(null)}
          />
        ) : (
          <PaperCard asChild className="overflow-hidden">
            <form onSubmit={onSubmit} noValidate>
              <FormSection title="Sobre o que é" divider={false}>
                <ChoiceChips
                  label="Assunto"
                  options={ESCUTA_CATEGORIES}
                  value={form.category}
                  onChange={set("category")}
                  error={errors.category}
                />
              </FormSection>

              <FormSection title="O que aconteceu">
                <div className="grid gap-4">
                  <TextArea
                    label="Relato"
                    rows={7}
                    value={form.description}
                    onChange={(e) => set("description")(e.target.value)}
                    placeholder="Conte com suas palavras o que aconteceu. O que você lembrar já ajuda."
                    error={errors.description}
                  />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <TextInput
                      label="Onde aconteceu (opcional)"
                      value={form.where}
                      onChange={(e) => set("where")(e.target.value)}
                      placeholder="Filial, setor, rota…"
                      error={errors.where}
                    />
                    <TextInput
                      label="Quando (opcional)"
                      value={form.when}
                      onChange={(e) => set("when")(e.target.value)}
                      placeholder="Ex.: semana passada, 10/09"
                      error={errors.when}
                    />
                  </div>
                  <TextInput
                    label="Pessoas envolvidas (opcional)"
                    value={form.involved}
                    onChange={(e) => set("involved")(e.target.value)}
                    placeholder="Quem fez, quem viu"
                    error={errors.involved}
                  />
                </div>
              </FormSection>

              <FormSection
                title="Identificação"
                hint="Opcional. Sem ela, o G&G conversa com você só pelo protocolo."
              >
                <label className="flex cursor-pointer items-start gap-3 text-[14.5px]">
                  <input
                    type="checkbox"
                    checked={identify}
                    onChange={(e) => setIdentify(e.target.checked)}
                    className="mt-1 h-4 w-4 accent-[var(--color-primary)]"
                  />
                  <span>Quero me identificar para o G&amp;G poder falar comigo diretamente.</span>
                </label>
                {identify && (
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <TextInput
                      label="Nome"
                      value={form.contact_name}
                      onChange={(e) => set("contact_name")(e.target.value)}
                      error={errors.contact_name}
                    />
                    <TextInput
                      label="Telefone ou e-mail"
                      value={form.contact}
                      onChange={(e) => set("contact")(e.target.value)}
                      error={errors.contact}
                    />
                  </div>
                )}
              </FormSection>

              <div className="mt-7 flex flex-wrap items-center justify-between gap-4 border-t-[1.5px] border-ink bg-paper px-6 py-6 md:px-8">
                <p className="max-w-[46ch] text-xs leading-[1.5] text-muted-foreground">
                  Ao enviar, você recebe um protocolo e uma chave para acompanhar a resposta.
                </p>
                <InkButton type="submit" variant="accent" disabled={mutation.isPending}>
                  {mutation.isPending ? "Enviando…" : "Enviar relato ↗"}
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

        <EscutaSidebar />
      </div>
    </div>
  );
}

function EscutaSidebar() {
  return (
    <aside className="flex flex-col gap-4 lg:sticky lg:top-24">
      <PaperCard tone="ink" className="p-[22px]">
        <div className="flex items-center gap-2 text-accent">
          <Ear className="h-4 w-4" />
          <Kicker color="var(--color-accent)">Seu sigilo</Kicker>
        </div>
        <ul className="mt-3.5 flex list-disc flex-col gap-2 pl-5 text-[13.5px] leading-[1.6]">
          <li>O portal não guarda seu nome, e-mail, CPF nem a hora do envio — só o dia.</li>
          <li>Nome e contato só aparecem se você marcar que quer se identificar.</li>
          <li>Quem lê é o time de Gente &amp; Gestão.</li>
          <li>Retaliação contra quem relata de boa-fé não é tolerada.</li>
        </ul>
      </PaperCard>

      <PaperCard className="p-[18px]">
        <Kicker>Depois de enviar</Kicker>
        <p className="mt-2 text-[13px] leading-[1.6] text-muted-foreground">
          Com o protocolo e a chave você vê a resposta e conversa com o G&amp;G em{" "}
          <Link to="/acompanhar" className="font-bold text-primary hover:underline">
            Acompanhar
          </Link>
          , sem se identificar.
        </p>
        <p className="mt-3 text-[13px] leading-[1.6] text-muted-foreground">
          Detalhes muito específicos podem indicar quem escreveu. Conte o necessário para
          entendermos a situação.
        </p>
      </PaperCard>

      <p className="text-[13px] leading-[1.6] text-muted-foreground">
        Em risco imediato, não espere: procure seu gestor ou o G&amp;G, ou ligue <strong>190</strong>.
      </p>
    </aside>
  );
}
