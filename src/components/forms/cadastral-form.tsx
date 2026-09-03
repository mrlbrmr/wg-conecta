import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { Clock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Chip,
  InkButton,
  MultiChoiceChips,
  PaperCard,
  SelectInput,
  TextArea,
  TextInput,
  FormSection,
} from "@/components/paper";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { FormShell, FormFooter } from "@/components/forms/form-shell";
import { FORM_META } from "@/lib/form-defs";
import {
  PROFILE_FIELDS,
  changedFieldLabels,
  diffProfile,
  fieldLabel,
  type ProfileChanges,
  type ProfileFieldDef,
} from "@/lib/profile-fields";
import {
  cancelOwnProfileRequest,
  createProfileUpdateRequest,
  getOwnProfile,
  listOwnProfileRequests,
  type OwnProfile,
  type ProfileRequest,
} from "@/lib/profile-request.functions";
import { fmtDateTime } from "@/lib/employee-ui";
import { cepDigits, isCompleteCep, lookupCep } from "@/lib/cep";

/**
 * Atualização Cadastral.
 *
 * A tela é nova; o fluxo por trás é o que já existia — a solicitação vai para
 * `profile_update_requests` como um diff campo-a-campo, e a aprovação no painel
 * é que aplica no cadastro. Nada disso passa por `requests`.
 *
 * O handoff pede que a pessoa marque primeiro *o que mudou* e só então veja os
 * campos: menos formulário na tela, menos chance de mexer no que não queria.
 */

/** Grupos de mudança que o colaborador marca — e os campos que cada um revela. */
const CHANGE_GROUPS = [
  { key: "Telefone", fields: ["phone"] },
  { key: "E-mail", fields: ["email"] },
  {
    key: "Endereço",
    fields: [
      "address_zip",
      "address_street",
      "address_number",
      "address_complement",
      "address_district",
      "address_city",
      "address_state",
    ],
  },
  { key: "Estado civil", fields: ["marital_status"] },
  { key: "Escolaridade", fields: ["education_level"] },
  { key: "Nome", fields: ["name"] },
  { key: "Data de nascimento", fields: ["birth_date"] },
] as const;

type ChangeGroup = (typeof CHANGE_GROUPS)[number]["key"];

/**
 * Grupos que a gente NÃO coleta por aqui.
 *
 * Dependentes e dados bancários pedem documento e número de conta — exatamente
 * o que o aviso de privacidade do portal proíbe num formulário aberto. Marcar
 * um deles abre um recado, não um campo.
 */
const OFF_CHANNEL_GROUPS = ["Dependentes", "Dados bancários"] as const;
type OffChannelGroup = (typeof OFF_CHANNEL_GROUPS)[number];

const ALL_GROUPS = [...CHANGE_GROUPS.map((g) => g.key), ...OFF_CHANNEL_GROUPS] as const;

/** Campos largos no grid de duas colunas. */
const WIDE = new Set(["name", "address_street", "dependents"]);

type FormState = Record<string, string>;

function toFormState(profile: OwnProfile): FormState {
  const record = profile as unknown as Record<string, string | null>;
  const form: FormState = {};
  for (const field of PROFILE_FIELDS) form[field.key] = record[field.key] ?? "";
  return form;
}

export function CadastralForm() {
  const meta = FORM_META["atualizacao-cadastral"];
  const navigate = useNavigate();
  const qc = useQueryClient();

  const doGetProfile = useServerFn(getOwnProfile);
  const doListRequests = useServerFn(listOwnProfileRequests);
  const doCreate = useServerFn(createProfileUpdateRequest);
  const doCancel = useServerFn(cancelOwnProfileRequest);

  const profileQuery = useQuery({ queryKey: ["own-profile"], queryFn: () => doGetProfile() });
  const requestsQuery = useQuery({
    queryKey: ["own-profile-requests"],
    queryFn: () => doListRequests(),
  });

  const profile = profileQuery.data ?? null;
  const requests = (requestsQuery.data ?? []) as ProfileRequest[];
  const pending = requests.find((r) => r.status === "pendente") ?? null;

  const [groups, setGroups] = useState<(ChangeGroup | OffChannelGroup)[]>([]);
  const [form, setForm] = useState<FormState>({});
  const [note, setNote] = useState("");
  const [review, setReview] = useState<ProfileChanges | null>(null);
  const [zipLoading, setZipLoading] = useState(false);
  // Evita repetir a busca a cada tecla depois que o CEP já ficou completo.
  const lastZip = useRef("");

  useEffect(() => {
    if (profile) setForm(toFormState(profile));
  }, [profile]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["own-profile"] });
    qc.invalidateQueries({ queryKey: ["own-profile-requests"] });
  };

  /**
   * CEP completo preenche rua, bairro, cidade e UF.
   *
   * Só preenche o que estiver vazio ou o que veio de uma busca anterior — se a
   * pessoa já corrigiu o complemento do logradouro à mão, a busca não desfaz.
   * Falha de rede é silenciosa: o preenchimento manual continua valendo.
   */
  useEffect(() => {
    const zip = form.address_zip ?? "";
    if (!isCompleteCep(zip) || cepDigits(zip) === lastZip.current) return;
    lastZip.current = cepDigits(zip);

    let alive = true;
    setZipLoading(true);
    lookupCep(zip)
      .then((address) => {
        if (!alive || !address) return;
        setForm((s) => ({
          ...s,
          address_street: address.street || s.address_street,
          address_district: address.district || s.address_district,
          address_city: address.city || s.address_city,
          address_state: address.state || s.address_state,
        }));
      })
      .finally(() => alive && setZipLoading(false));

    return () => {
      alive = false;
    };
  }, [form.address_zip]);

  const createMutation = useMutation({
    mutationFn: (payload: { proposed: Record<string, string>; note?: string }) =>
      doCreate({ data: payload }),
    onSuccess: () => {
      toast.success("Solicitação enviada. O time de Gente & Gestão vai analisar.");
      setReview(null);
      setGroups([]);
      setNote("");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => doCancel({ data: { id } }),
    onSuccess: () => {
      toast.success("Solicitação cancelada.");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  /** Campos visíveis: só os dos grupos marcados, na ordem do cadastro. */
  const visibleFields = useMemo<ProfileFieldDef[]>(() => {
    const keys = new Set(
      CHANGE_GROUPS.filter((g) => groups.includes(g.key)).flatMap(
        (g) => g.fields as readonly string[],
      ),
    );
    return PROFILE_FIELDS.filter((f) => keys.has(f.key));
  }, [groups]);

  const offChannel = OFF_CHANNEL_GROUPS.filter((g) => (groups as readonly string[]).includes(g));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    if (visibleFields.length === 0) {
      toast.error(
        offChannel.length > 0
          ? "Esses itens a gente resolve no privado — veja o recado acima."
          : "Marque o que mudou pra gente abrir os campos.",
      );
      return;
    }

    // Só o que a pessoa abriu entra no diff: um campo escondido nunca vira pedido.
    const proposed: Record<string, unknown> = {};
    for (const f of visibleFields) proposed[f.key] = form[f.key] ?? "";

    const changes = diffProfile(profile as unknown as Record<string, unknown>, proposed);
    if (Object.keys(changes).length === 0) {
      toast.info("Os campos abertos estão iguais ao cadastro. Nada para enviar.");
      return;
    }
    setReview(changes);
  };

  const confirmSubmit = () => {
    if (!review) return;
    const proposed: Record<string, string> = {};
    for (const key of Object.keys(review)) proposed[key] = form[key] ?? "";
    createMutation.mutate({ proposed, note: note.trim() || undefined });
  };

  if (profileQuery.isLoading) return <Skeleton className="h-[540px] w-full" />;

  if (!profile) {
    return (
      <FormShell slug="atualizacao-cadastral">
        <div className="px-6 py-10 md:px-8">
          <p className="text-xl font-black tracking-tight">
            Seu cadastro ainda não está vinculado ao portal.
          </p>
          <p className="mt-2 text-[15px] leading-[1.65] text-muted-foreground">
            Fala com o time de Gente & Gestão para liberar o acesso aos seus dados.
          </p>
        </div>
      </FormShell>
    );
  }

  if (pending) {
    return (
      <FormShell slug="atualizacao-cadastral">
        <div className="px-6 py-8 md:px-8">
          <PendingNotice
            request={pending}
            onCancel={() => cancelMutation.mutate(pending.id)}
            canceling={cancelMutation.isPending}
          />
        </div>
      </FormShell>
    );
  }

  const dirty = groups.length > 0 || note.trim() !== "";

  return (
    <form onSubmit={submit}>
      <FormShell
        slug="atualizacao-cadastral"
        footer={
          <FormFooter
            note={meta.footerNote}
            pending={createMutation.isPending}
            dirty={dirty}
            onCancel={() => navigate({ to: "/formularios" })}
            submitLabel="Revisar e enviar ↗"
          />
        }
      >
        <FormSection
          title="O que mudou"
          divider={false}
          hint="Marque tudo que precisa ser atualizado. A gente abre só esses campos."
        >
          <MultiChoiceChips
            label="Itens a atualizar"
            options={ALL_GROUPS}
            value={groups}
            onChange={(v) => setGroups(v as (ChangeGroup | OffChannelGroup)[])}
          />

          {offChannel.length > 0 && (
            <PaperCard tone="soft" className="mt-5 p-4">
              <p className="text-[13.5px] font-bold">
                {offChannel.join(" e ")}: a gente te chama no privado.
              </p>
              <p className="mt-1.5 text-xs leading-[1.6] text-muted-foreground">
                Esses itens pedem documento e dado bancário, que não passam por formulário aberto.
                Envie o pedido com o restante e o time de Gente & Gestão procura você pelo canal
                seguro.
              </p>
            </PaperCard>
          )}
        </FormSection>

        {visibleFields.length > 0 && (
          <FormSection title="Novos dados">
            <div className="grid gap-4 sm:grid-cols-2">
              {visibleFields.map((f) => (
                <ProfileField
                  key={f.key}
                  field={f}
                  value={form[f.key] ?? ""}
                  onChange={(v) => setForm((s) => ({ ...s, [f.key]: v }))}
                  hint={f.key === "address_zip" && zipLoading ? "Buscando o endereço…" : undefined}
                />
              ))}
            </div>

            <TextArea
              label="Quer explicar alguma coisa? (opcional)"
              rows={3}
              fieldClassName="mt-5"
              placeholder="Ex.: mudei de endereço em janeiro, comprovante já entregue no RH."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </FormSection>
        )}
      </FormShell>

      {review && (
        <ReviewDialog
          changes={review}
          note={note}
          loading={createMutation.isPending}
          onConfirm={confirmSubmit}
          onClose={() => setReview(null)}
        />
      )}
    </form>
  );
}

// ── Campo do cadastro ─────────────────────────────────────────────────

function ProfileField({
  field,
  value,
  onChange,
  hint,
}: {
  field: ProfileFieldDef;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
}) {
  const wide = WIDE.has(field.key) ? "sm:col-span-2" : undefined;

  if (field.input === "select") {
    return (
      <SelectInput
        label={field.label}
        options={field.options ?? []}
        placeholder="Selecione"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        fieldClassName={wide}
        hint={hint}
      />
    );
  }

  if (field.input === "textarea") {
    return (
      <TextArea
        label={field.label}
        rows={3}
        placeholder={field.placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        fieldClassName={wide}
        hint={hint}
      />
    );
  }

  const type =
    field.input === "date"
      ? "date"
      : field.input === "email"
        ? "email"
        : field.input === "tel"
          ? "tel"
          : "text";

  return (
    <TextInput
      label={field.label}
      type={type}
      placeholder={field.placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      fieldClassName={wide}
      hint={hint}
      className={field.key === "address_state" ? "uppercase" : undefined}
      maxLength={field.key === "address_state" ? 2 : undefined}
      inputMode={field.key === "address_zip" ? "numeric" : undefined}
    />
  );
}

// ── Solicitação em andamento ──────────────────────────────────────────

function PendingNotice({
  request,
  onCancel,
  canceling,
}: {
  request: ProfileRequest;
  onCancel: () => void;
  canceling: boolean;
}) {
  const labels = changedFieldLabels(request.changes);
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <Chip tone="accent" className="gap-1.5">
          <Clock className="h-3.5 w-3.5" /> Em análise
        </Chip>
        <p className="mt-3.5 text-[15px] font-bold">
          Você enviou uma solicitação em {fmtDateTime(request.created_at)}.
        </p>
        <p className="mt-1.5 text-[13.5px] text-muted-foreground">
          Campos solicitados: {labels.join(", ")}
        </p>
        <p className="mt-2.5 max-w-[52ch] text-[13.5px] leading-[1.6] text-muted-foreground">
          Enquanto ela estiver em análise não dá pra enviar outra. Cancele se quiser corrigir algo.
        </p>
      </div>
      <InkButton variant="outline" onClick={onCancel} disabled={canceling} className="gap-2">
        {canceling && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        Cancelar solicitação
      </InkButton>
    </div>
  );
}

// ── Revisão antes de enviar ───────────────────────────────────────────

function ReviewDialog({
  changes,
  note,
  loading,
  onConfirm,
  onClose,
}: {
  changes: ProfileChanges;
  note: string;
  loading: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-[560px] border-[1.5px] border-ink bg-paper p-0 shadow-elevated sm:rounded-lg">
        <div className="border-b-[1.5px] border-ink px-6 py-5">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-primary">
            Atualização Cadastral
          </p>
          <DialogTitle className="mt-1 text-[22px] font-black tracking-[-0.03em]">
            Confere antes de enviar
          </DialogTitle>
          <DialogDescription className="mt-1 text-[13.5px] text-muted-foreground">
            É isso que vai para o time de Gente & Gestão.
          </DialogDescription>
        </div>

        <div className="max-h-[50vh] overflow-y-auto px-6 py-5">
          <ul className="flex flex-col gap-3.5">
            {Object.entries(changes).map(([key, change]) => (
              <li key={key} className="border-b border-border pb-3.5 last:border-b-0 last:pb-0">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground">
                  {fieldLabel(key)}
                </p>
                <p className="mt-1 text-sm">
                  <span className="text-muted-foreground line-through">
                    {change.from ?? "vazio"}
                  </span>{" "}
                  <span aria-hidden="true">→</span>{" "}
                  <span className="font-bold">{change.to ?? "vazio"}</span>
                </p>
              </li>
            ))}
          </ul>

          {note.trim() && (
            <p className="mt-4 text-[13px] leading-[1.6] text-muted-foreground">
              <span className="font-bold">Sua observação:</span> {note.trim()}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2.5 border-t-[1.5px] border-ink bg-paper px-6 py-5">
          <InkButton variant="outline" onClick={onClose} disabled={loading}>
            Voltar e ajustar
          </InkButton>
          <InkButton variant="accent" onClick={onConfirm} disabled={loading}>
            {loading ? "Enviando…" : "Enviar ↗"}
          </InkButton>
        </div>
      </DialogContent>
    </Dialog>
  );
}
