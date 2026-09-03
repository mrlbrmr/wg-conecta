import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, type FormEvent } from "react";
import { Paperclip, X } from "lucide-react";
import { toast } from "sonner";
import {
  ChoiceChips,
  InkButton,
  SelectInput,
  TextArea,
  TextInput,
  FormSection,
} from "@/components/paper";
import { Skeleton } from "@/components/ui/skeleton";
import { FormShell, FormFooter, IdentificationSection } from "@/components/forms/form-shell";
import { useIdentity } from "@/hooks/use-identity";
import { CadastralForm } from "@/components/forms/cadastral-form";
import {
  FORM_META,
  GENERAL_SUBJECTS,
  PRIORITIES,
  PRIORITY_LABEL,
  YES_NO,
  errorsOf,
  isFormSlug,
  schemaFor,
  vacationDays,
  type FieldErrors,
  type FormSlug,
  type Priority,
  type RequestFormSlug,
} from "@/lib/form-defs";
import { openFormRequest } from "@/lib/portal-write.functions";
import {
  ATTACHMENT_EXTENSIONS,
  ATTACHMENT_MAX_BYTES,
  uploadRequestAttachment,
} from "@/lib/storage";

export const Route = createFileRoute("/_portal/formularios/$slug")({
  params: {
    parse: (raw) => {
      if (!isFormSlug(raw.slug)) throw new Error("Formulário não encontrado.");
      return { slug: raw.slug };
    },
    stringify: (p) => ({ slug: p.slug }),
  },
  head: ({ params }) => ({
    meta: [{ title: `${FORM_META[params.slug]?.title ?? "Formulário"} — Portal WG` }],
  }),
  component: FormPage,
});

function FormPage() {
  const { slug } = Route.useParams();

  // A cadastral tem fluxo próprio: diff contra o cadastro e aprovação que
  // aplica na folha. Não passa por `requests`.
  if (slug === "atualizacao-cadastral") return <CadastralForm />;

  return <RequestForm slug={slug} />;
}

// ── Férias e Solicitação Geral ────────────────────────────────────────

const INITIAL: Record<RequestFormSlug, Record<string, string>> = {
  ferias: { start_date: "", end_date: "", advance_13th: "Sim", sell_days: "Não", coverage: "" },
  "solicitacao-geral": { subject: "", priority: "normal", description: "" },
};

/** Valor que conta como "o usuário mexeu" — os defaults não contam. */
function isDirty(values: Record<string, string>, slug: RequestFormSlug): boolean {
  const initial = INITIAL[slug];
  return Object.entries(values).some(([k, v]) => v !== (initial[k] ?? ""));
}

function RequestForm({ slug }: { slug: RequestFormSlug }) {
  const meta = FORM_META[slug as FormSlug];
  const navigate = useNavigate();
  const send = useServerFn(openFormRequest);
  const { identity, loading, hasRegistration } = useIdentity();

  const [registration, setRegistration] = useState("");
  const [values, setValues] = useState<Record<string, string>>({ ...INITIAL[slug] });
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});

  const set = (key: string, value: string) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => (e[key] ? { ...e, [key]: "" } : e));
  };

  const dirty = isDirty(values, slug) || file !== null;

  const mutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const attachment_path = file
        ? await uploadRequestAttachment(file, identity.employeeId)
        : null;
      return send({ data: { slug, payload, attachment_path } });
    },
    onSuccess: (res) => {
      navigate({ to: "/formularios/enviado", search: { protocolo: res.protocol } });
    },
    onError: (e: Error) =>
      toast.error(e.message || "Não conseguimos enviar agora. Tenta de novo em instantes?"),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const payload = {
      ...values,
      name: identity.name,
      registration_number: hasRegistration ? identity.registration_number : registration,
      department: identity.department,
      manager_name: identity.manager_name,
    };
    const parsed = schemaFor(slug).safeParse(payload);
    if (!parsed.success) {
      setErrors(errorsOf(parsed.error.issues));
      toast.error("Confere os campos marcados?");
      return;
    }
    setErrors({});
    mutation.mutate(parsed.data);
  };

  if (loading) return <Skeleton className="h-[540px] w-full" />;

  return (
    <form onSubmit={submit}>
      <FormShell
        slug={slug}
        footer={
          <FormFooter
            note={meta.footerNote}
            pending={mutation.isPending}
            dirty={dirty}
            onCancel={() => navigate({ to: "/formularios" })}
          />
        }
      >
        <IdentificationSection
          identity={identity}
          registration={hasRegistration ? identity.registration_number : registration}
          onRegistration={setRegistration}
          editableRegistration={!hasRegistration}
          error={errors.registration_number}
        />

        {slug === "ferias" ? (
          <VacationFields values={values} errors={errors} set={set} />
        ) : (
          <GeneralFields values={values} errors={errors} set={set} file={file} onFile={setFile} />
        )}
      </FormShell>
    </form>
  );
}

// ── Férias ────────────────────────────────────────────────────────────

function VacationFields({
  values,
  errors,
  set,
}: {
  values: Record<string, string>;
  errors: FieldErrors;
  set: (k: string, v: string) => void;
}) {
  const days = vacationDays(values.start_date, values.end_date);

  return (
    <FormSection title="Período solicitado">
      <div className="grid items-end gap-4 sm:grid-cols-[1fr_1fr_auto]">
        <TextInput
          label="Início"
          type="date"
          value={values.start_date}
          onChange={(e) => set("start_date", e.target.value)}
          error={errors.start_date}
        />
        <TextInput
          label="Retorno"
          type="date"
          value={values.end_date}
          onChange={(e) => set("end_date", e.target.value)}
          error={errors.end_date}
        />
        {/* aria-live: o contador muda sem que nada receba foco. */}
        <div
          aria-live="polite"
          className="mb-0.5 shrink-0 rounded-lg border-[1.5px] border-ink bg-accent-soft px-4 py-2.5 text-center"
        >
          <div className="text-[22px] font-black leading-[1.1] tabular-nums tracking-[-0.03em]">
            {days}
          </div>
          <div className="text-[11px] font-extrabold uppercase tracking-[0.12em]">
            {days === 1 ? "dia" : "dias"}
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <ChoiceChips
          label="Adiantar 13º salário?"
          options={YES_NO}
          value={values.advance_13th as (typeof YES_NO)[number]}
          onChange={(v) => set("advance_13th", v)}
          error={errors.advance_13th}
        />
        <ChoiceChips
          label="Vender 10 dias (abono)?"
          options={YES_NO}
          value={values.sell_days as (typeof YES_NO)[number]}
          onChange={(v) => set("sell_days", v)}
          error={errors.sell_days}
        />
      </div>

      <TextInput
        label="Quem cobre você no período?"
        placeholder="Nome de quem assume as demandas"
        fieldClassName="mt-6"
        value={values.coverage}
        onChange={(e) => set("coverage", e.target.value)}
        error={errors.coverage}
      />
    </FormSection>
  );
}

// ── Solicitação Geral ─────────────────────────────────────────────────

function GeneralFields({
  values,
  errors,
  set,
  file,
  onFile,
}: {
  values: Record<string, string>;
  errors: FieldErrors;
  set: (k: string, v: string) => void;
  file: File | null;
  onFile: (f: File | null) => void;
}) {
  return (
    <FormSection title="Sua solicitação">
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectInput
          label="Assunto"
          options={GENERAL_SUBJECTS}
          placeholder="Escolha o assunto"
          value={values.subject}
          onChange={(e) => set("subject", e.target.value)}
          error={errors.subject}
        />
        <ChoiceChips
          label="Urgência"
          options={PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABEL[p] }))}
          value={values.priority as Priority}
          onChange={(v) => set("priority", v)}
          error={errors.priority}
        />
      </div>

      <TextArea
        label="Conta pra gente"
        rows={5}
        fieldClassName="mt-5"
        placeholder="Descreva o que você precisa. Quanto mais contexto, mais rápido a gente resolve."
        value={values.description}
        onChange={(e) => set("description", e.target.value)}
        error={errors.description}
      />

      <AttachmentBox file={file} onFile={onFile} />
    </FormSection>
  );
}

/**
 * Anexo opcional. Tipo e tamanho são conferidos aqui para a pessoa saber na
 * hora — e de novo no upload, que é o que realmente vale.
 */
function AttachmentBox({ file, onFile }: { file: File | null; onFile: (f: File | null) => void }) {
  const [error, setError] = useState("");

  const pick = (picked: File | null) => {
    if (!picked) {
      setError("");
      return onFile(null);
    }
    const ext = (picked.name.split(".").pop() ?? "").toLowerCase();
    if (!(ATTACHMENT_EXTENSIONS as readonly string[]).includes(ext)) {
      setError("O anexo precisa ser PDF, JPG ou PNG.");
      return;
    }
    if (picked.size > ATTACHMENT_MAX_BYTES) {
      setError("O anexo passa de 10 MB. Comprime ou manda por e-mail?");
      return;
    }
    setError("");
    onFile(picked);
  };

  return (
    <div className="mt-5">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border-[1.5px] border-dashed border-ink bg-paper p-[18px]">
        <div className="min-w-0">
          <p className="text-[13.5px] font-bold">Anexo (opcional)</p>
          <p className="truncate text-xs text-muted-foreground">
            {file ? file.name : "PDF ou imagem, até 10 MB."}
          </p>
        </div>

        {file ? (
          <InkButton variant="outline" onClick={() => pick(null)} className="gap-1.5">
            <X className="h-3.5 w-3.5" /> Remover
          </InkButton>
        ) : (
          <label className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full border-[1.5px] border-ink bg-surface px-4 py-2 text-xs font-extrabold uppercase tracking-[0.1em] hover:bg-accent-soft focus-within:outline-2 focus-within:outline-primary">
            <Paperclip className="h-3.5 w-3.5" />
            Escolher arquivo
            <input
              type="file"
              className="sr-only"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={(e) => pick(e.target.files?.[0] ?? null)}
            />
          </label>
        )}
      </div>
      {error && (
        <p className="mt-2 text-xs font-semibold leading-[1.5] text-destructive">{error}</p>
      )}
    </div>
  );
}
