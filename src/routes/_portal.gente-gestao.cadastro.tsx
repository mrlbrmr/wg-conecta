import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { Clock, KeyRound, Loader2, PencilLine, Send, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { PortalLayout } from "@/components/portal-layout";
import { EmptyState, PageHeader } from "@/components/page-header";
import { fmtDate, fmtDateTime } from "@/lib/employee-ui";
import {
  PROFILE_FIELDS,
  PROFILE_FIELD_GROUPS,
  changedFieldLabels,
  diffProfile,
  fieldLabel,
  type ProfileChanges,
  type ProfileFieldDef,
  type ProfileFieldKey,
  type RequestStatus,
  STATUS_LABEL,
} from "@/lib/profile-fields";
import {
  cancelOwnProfileRequest,
  createProfileUpdateRequest,
  getOwnProfile,
  listOwnProfileRequests,
  type OwnProfile,
  type ProfileRequest,
} from "@/lib/profile-request.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_portal/gente-gestao/cadastro")({
  head: () => ({ meta: [{ title: "Atualização Cadastral — Portal WG" }] }),
  component: CadastroPage,
});

const inputClass =
  "mt-1.5 w-full rounded-xl border border-input bg-surface px-4 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10 disabled:opacity-60";

type FormState = Record<string, string>;

function toFormState(profile: OwnProfile): FormState {
  const record = profile as unknown as Record<string, string | null>;
  const form: FormState = {};
  for (const field of PROFILE_FIELDS) form[field.key] = record[field.key] ?? "";
  return form;
}

function displayValue(profile: OwnProfile, key: ProfileFieldKey): string {
  const raw = (profile as unknown as Record<string, string | null>)[key];
  if (!raw) return "—";
  if (key === "birth_date") return fmtDate(raw) ?? raw;
  return raw;
}

function statusChipClass(status: string): string {
  switch (status) {
    case "aprovada":
      return "chip-success";
    case "pendente":
      return "chip-accent";
    case "rejeitada":
      return "chip border-destructive bg-destructive/10 text-destructive";
    default:
      return "chip-soft";
  }
}

function CadastroPage() {
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

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<FormState>({});
  const [note, setNote] = useState("");
  const [review, setReview] = useState<ProfileChanges | null>(null);

  const profile = profileQuery.data ?? null;
  const requests = (requestsQuery.data ?? []) as ProfileRequest[];
  const pending = requests.find((r) => r.status === "pendente") ?? null;

  useEffect(() => {
    if (profile) setForm(toFormState(profile));
  }, [profile]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["own-profile"] });
    qc.invalidateQueries({ queryKey: ["own-profile-requests"] });
  };

  const createMutation = useMutation({
    mutationFn: (payload: { proposed: Record<string, string>; note?: string }) =>
      doCreate({ data: payload }),
    onSuccess: () => {
      toast.success("Solicitação enviada. O time de Gente & Gestão vai analisar.");
      setReview(null);
      setEditing(false);
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

  const handlePasswordReset = async () => {
    if (!profile?.email) return;
    const { error } = await supabase.auth.resetPasswordForEmail(profile.email, {
      redirectTo: `${window.location.origin}/colaborador/confirmar`,
    });
    if (error) return toast.error(error.message);
    toast.success("E-mail de redefinição de senha enviado.");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    const changes = diffProfile(
      profile as unknown as Record<string, unknown>,
      form as Record<string, unknown>,
    );
    if (Object.keys(changes).length === 0) {
      return toast.info("Nenhuma alteração para enviar.");
    }
    setReview(changes);
  };

  const confirmSubmit = () => {
    if (!review) return;
    const proposed: Record<string, string> = {};
    for (const key of Object.keys(review)) proposed[key] = form[key] ?? "";
    createMutation.mutate({ proposed, note: note.trim() || undefined });
  };

  if (profileQuery.isLoading) {
    return (
      <PortalLayout>
        <PageHeader eyebrow="Gente & Gestão" title="Atualização Cadastral" backTo="/gente-gestao" />
        <div className="max-w-3xl space-y-6">
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout>
      <PageHeader
        eyebrow="Gente & Gestão"
        title="Atualização Cadastral"
        backTo="/gente-gestao"
        description="Peça a atualização dos seus dados. A solicitação vai para o time de Gente & Gestão, que revisa e aplica no seu cadastro."
      />

      {!profile ? (
        <div className="max-w-3xl">
          <EmptyState
            title="Seu cadastro ainda não está vinculado ao portal"
            description="Fale com o time de Gente & Gestão para liberar o acesso aos seus dados cadastrais."
          />
        </div>
      ) : (
        <div className="max-w-3xl space-y-6">
          {pending && (
            <PendingBanner
              request={pending}
              onCancel={() => cancelMutation.mutate(pending.id)}
              canceling={cancelMutation.isPending}
            />
          )}

          <CurrentDataCard profile={profile} />

          {!pending &&
            (editing ? (
              <ProfileForm
                form={form}
                note={note}
                onChange={(key, value) => setForm((f) => ({ ...f, [key]: value }))}
                onNoteChange={setNote}
                onSubmit={handleSubmit}
                onCancel={() => {
                  setEditing(false);
                  setForm(toFormState(profile));
                  setNote("");
                }}
              />
            ) : (
              <button onClick={() => setEditing(true)} className="btn-ink px-5 py-3">
                <PencilLine className="h-4 w-4" /> Solicitar atualização
              </button>
            ))}

          <RequestHistory requests={requests} loading={requestsQuery.isLoading} />

          <section className="card-soft p-5 space-y-3">
            <div className="flex items-center gap-2">
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-secondary">
                <KeyRound className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold">Alterar senha</h2>
                <p className="text-xs text-muted-foreground">
                  Um link de redefinição será enviado para o seu e-mail.
                </p>
              </div>
            </div>
            <button
              onClick={handlePasswordReset}
              disabled={!profile.email}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-5 py-2.5 text-sm font-semibold hover:bg-secondary disabled:opacity-50"
            >
              Enviar link de redefinição
            </button>
          </section>
        </div>
      )}

      {review && profile && (
        <ReviewModal
          changes={review}
          note={note}
          loading={createMutation.isPending}
          onConfirm={confirmSubmit}
          onClose={() => setReview(null)}
        />
      )}
    </PortalLayout>
  );
}

/* ─── Blocos ───────────────────────────────────────────────────────────────── */

function PendingBanner({
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
    <section className="card-paper p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="chip-accent inline-flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" /> Em análise
          </span>
          <p className="mt-3 text-sm font-bold">
            Você enviou uma solicitação em {fmtDateTime(request.created_at)}.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Campos solicitados: {labels.join(", ")}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Enquanto ela estiver em análise, não é possível enviar outra. Cancele se quiser corrigir
            algo.
          </p>
        </div>
        <button
          onClick={onCancel}
          disabled={canceling}
          className="inline-flex shrink-0 items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-xs font-bold hover:bg-secondary disabled:opacity-50"
        >
          {canceling && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Cancelar solicitação
        </button>
      </div>
    </section>
  );
}

function CurrentDataCard({ profile }: { profile: OwnProfile }) {
  return (
    <section className="card-soft p-5 md:p-6">
      <h2 className="kicker">Seus dados hoje</h2>

      {PROFILE_FIELD_GROUPS.map((group) => {
        const fields = PROFILE_FIELDS.filter((f) => f.group === group);
        return (
          <div key={group} className="mt-5">
            <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              {group}
            </h3>
            <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
              {fields.map((f) => (
                <div key={f.key} className={f.wide ? "sm:col-span-2" : undefined}>
                  <dt className="text-[11px] font-semibold text-muted-foreground">{f.label}</dt>
                  <dd className="mt-0.5 whitespace-pre-line text-sm font-medium">
                    {displayValue(profile, f.key)}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        );
      })}

      <hr className="rule-ink my-5" />
      <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
        Só o time de Gente &amp; Gestão altera
      </h3>
      <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-3">
        <div>
          <dt className="text-[11px] font-semibold text-muted-foreground">Filial / Departamento</dt>
          <dd className="mt-0.5 text-sm font-medium">{profile.department ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-semibold text-muted-foreground">Cargo</dt>
          <dd className="mt-0.5 text-sm font-medium">{profile.job_title ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-semibold text-muted-foreground">Data de admissão</dt>
          <dd className="mt-0.5 text-sm font-medium">{fmtDate(profile.admission_date) ?? "—"}</dd>
        </div>
      </dl>
    </section>
  );
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: ProfileFieldDef;
  value: string;
  onChange: (value: string) => void;
}) {
  if (field.input === "select") {
    return (
      <select value={value} onChange={(e) => onChange(e.target.value)} className={inputClass}>
        <option value="">Não informado</option>
        {(field.options ?? []).map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    );
  }
  if (field.input === "textarea") {
    return (
      <textarea
        rows={4}
        value={value}
        placeholder={field.placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={inputClass}
      />
    );
  }
  return (
    <input
      type={field.input}
      value={value}
      required={field.required}
      placeholder={field.placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={inputClass}
    />
  );
}

function ProfileForm({
  form,
  note,
  onChange,
  onNoteChange,
  onSubmit,
  onCancel,
}: {
  form: FormState;
  note: string;
  onChange: (key: ProfileFieldKey, value: string) => void;
  onNoteChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}) {
  return (
    <form onSubmit={onSubmit} className="card-soft p-5 md:p-6">
      <h2 className="kicker">Nova solicitação</h2>
      <p className="mt-2 text-xs text-muted-foreground">
        Altere apenas o que precisa. Só os campos modificados são enviados.
      </p>

      {PROFILE_FIELD_GROUPS.map((group) => (
        <fieldset key={group} className="mt-5">
          <legend className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            {group}
          </legend>
          <div className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {PROFILE_FIELDS.filter((f) => f.group === group).map((f) => (
              <label key={f.key} className={`block ${f.wide ? "sm:col-span-2" : ""}`}>
                <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                  {f.label}
                </span>
                <FieldInput
                  field={f}
                  value={form[f.key] ?? ""}
                  onChange={(v) => onChange(f.key, v)}
                />
                {f.key === "email" && (
                  <span className="mt-1 block text-[11px] text-muted-foreground">
                    Este é o seu e-mail de acesso ao portal. Ao ser aprovado, o login passa a usar o
                    novo endereço.
                  </span>
                )}
              </label>
            ))}
          </div>
        </fieldset>
      ))}

      <label className="mt-5 block">
        <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
          Observação para o Gente &amp; Gestão (opcional)
        </span>
        <textarea
          rows={3}
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          placeholder="Ex.: mudei de endereço em janeiro; comprovante já enviado por e-mail."
          className={inputClass}
        />
      </label>

      <div className="mt-5 flex flex-wrap gap-2">
        <button type="submit" className="btn-ink px-5 py-3">
          <Send className="h-4 w-4" /> Revisar e enviar
        </button>
        <button type="button" onClick={onCancel} className="btn-outline px-5 py-3">
          Cancelar
        </button>
      </div>
    </form>
  );
}

function ReviewModal({
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
  const rows = useMemo(
    () =>
      PROFILE_FIELDS.filter((f) => f.key in changes).map((f) => ({
        field: f,
        change: changes[f.key],
      })),
    [changes],
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-0 backdrop-blur-sm md:items-center md:p-6"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[95vh] w-full max-w-lg flex-col rounded-t-2xl bg-background shadow-elevated md:rounded-2xl"
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-base font-bold">Confirme sua solicitação</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-secondary">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <p className="text-xs text-muted-foreground">
            Estes {rows.length === 1 ? "é o dado" : "são os dados"} que serão enviados ao time de
            Gente &amp; Gestão para aprovação.
          </p>
          <div className="mt-4 space-y-3">
            {rows.map(({ field, change }) => (
              <div key={field.key} className="rounded-xl border border-border p-3">
                <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                  {field.label}
                </div>
                <div className="mt-1 text-sm">
                  <span className="text-muted-foreground line-through">
                    {change.from ?? "vazio"}
                  </span>
                  <span className="mx-2 text-muted-foreground">→</span>
                  <span className="font-bold">{change.to ?? "vazio"}</span>
                </div>
              </div>
            ))}
          </div>
          {note.trim() && (
            <div className="mt-4">
              <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                Observação
              </div>
              <p className="mt-1 whitespace-pre-line text-sm">{note.trim()}</p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-6 py-4">
          <button onClick={onClose} className="btn-outline px-4 py-2.5">
            Voltar
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="btn-ink px-4 py-2.5 disabled:opacity-50"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />} Enviar solicitação
          </button>
        </div>
      </div>
    </div>
  );
}

function RequestHistory({ requests, loading }: { requests: ProfileRequest[]; loading: boolean }) {
  if (loading) return <Skeleton className="h-24 w-full rounded-xl" />;
  if (requests.length === 0) {
    return (
      <EmptyState
        title="Nenhuma solicitação ainda"
        description="Quando você pedir uma atualização, o andamento aparece aqui."
      />
    );
  }

  return (
    <section className="card-soft p-5 md:p-6">
      <h2 className="kicker">Suas solicitações</h2>
      <ul className="mt-4 space-y-4">
        {requests.map((r) => (
          <li key={r.id} className="border-t border-border pt-4 first:border-0 first:pt-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={statusChipClass(r.status)}>
                {STATUS_LABEL[r.status as RequestStatus] ?? r.status}
              </span>
              <span className="text-xs text-muted-foreground">
                Enviada em {fmtDateTime(r.created_at)}
              </span>
            </div>
            <ul className="mt-2 space-y-1">
              {Object.entries(r.changes).map(([key, change]) => (
                <li key={key} className="text-sm">
                  <span className="font-semibold">{fieldLabel(key)}:</span>{" "}
                  <span className="text-muted-foreground line-through">
                    {change.from ?? "vazio"}
                  </span>
                  <span className="mx-1.5 text-muted-foreground">→</span>
                  <span className="font-medium">{change.to ?? "vazio"}</span>
                </li>
              ))}
            </ul>
            {r.note && (
              <p className="mt-2 text-xs text-muted-foreground">
                <span className="font-semibold">Sua observação:</span> {r.note}
              </p>
            )}
            {r.reviewer_note && (
              <p className="mt-2 rounded-lg bg-surface-muted p-3 text-xs">
                <span className="font-semibold">
                  Resposta de {r.reviewer_name ?? "Gente & Gestão"}
                  {r.reviewed_at ? ` em ${fmtDateTime(r.reviewed_at)}` : ""}:
                </span>{" "}
                {r.reviewer_note}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
