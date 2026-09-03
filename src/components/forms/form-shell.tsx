import { Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { ClipboardList } from "lucide-react";
import {
  IconBubble,
  InkButton,
  Kicker,
  PaperCard,
  TextInput,
  FormSection,
} from "@/components/paper";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ICON_MAP } from "@/lib/icon-map";
import { FORM_META, HOW_IT_WORKS, PRIVACY_NOTE, type FormSlug } from "@/lib/form-defs";
import type { Identity } from "@/hooks/use-identity";

/**
 * Casca compartilhada pelos três formulários de G&G: cabeçalho com a bolha de
 * ícone, lateral "Como funciona / Privacidade" e o rodapé de ações.
 *
 * A tela do formulário cuida só dos campos — o que muda entre eles.
 */

export function FormShell({
  slug,
  children,
  footer,
}: {
  slug: FormSlug;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const meta = FORM_META[slug];
  const Icon = ICON_MAP[meta.icon] ?? ClipboardList;

  return (
    <div>
      <Link
        to="/formularios"
        className="mb-6 inline-block text-xs font-extrabold uppercase tracking-[0.12em] text-muted-foreground hover:text-ink"
      >
        ← Voltar ao catálogo
      </Link>

      <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_272px]">
        <PaperCard className="overflow-hidden">
          <header className="flex items-start gap-4 border-b-[1.5px] border-ink px-6 py-7 md:px-8">
            <IconBubble size={44}>
              <Icon />
            </IconBubble>
            <div className="min-w-0">
              <p className="text-[11.5px] font-extrabold uppercase tracking-[0.14em] text-primary">
                {meta.category}
              </p>
              <h1 className="mt-1.5 text-[26px] font-black leading-[1.1] tracking-[-0.04em] sm:text-[32px]">
                {meta.title}
              </h1>
              <p className="mt-1 text-[14.5px] text-muted-foreground">{meta.subtitle}</p>
            </div>
          </header>

          {children}
          {footer}
        </PaperCard>

        <FormSidebar />
      </div>
    </div>
  );
}

function FormSidebar() {
  return (
    <aside className="flex flex-col gap-4 lg:sticky lg:top-24">
      <PaperCard tone="ink" className="p-[22px]">
        <Kicker color="var(--color-accent)">Como funciona</Kicker>
        <ol className="mt-3.5 list-decimal pl-5 text-[13.5px] leading-[1.65]">
          {HOW_IT_WORKS.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <p className="mt-4 border-t border-paper/20 pt-4 text-[13px] font-bold">
          Resposta em 3 dias úteis
        </p>
      </PaperCard>

      <PaperCard className="p-[18px]">
        <Kicker>Privacidade</Kicker>
        <p className="mt-2 text-xs leading-[1.6] text-muted-foreground">{PRIVACY_NOTE}</p>
      </PaperCard>

      <p className="text-[13px] leading-[1.6] text-muted-foreground">
        Dúvida boba também vale:{" "}
        <Link to="/gente-gestao/contatos" className="font-bold text-primary hover:underline">
          falar com o time
        </Link>
        .
      </p>
    </aside>
  );
}

export function FormFooter({
  note,
  pending,
  dirty,
  onCancel,
  submitLabel = "Enviar ↗",
  pendingLabel = "Enviando…",
  disabled = false,
}: {
  note: string;
  pending: boolean;
  dirty: boolean;
  onCancel: () => void;
  submitLabel?: string;
  pendingLabel?: string;
  disabled?: boolean;
}) {
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-5 border-t-[1.5px] border-ink bg-paper px-6 py-6 md:px-8">
      <p className="max-w-[44ch] text-xs leading-[1.5] text-muted-foreground">{note}</p>
      <div className="flex gap-2.5">
        {/* Descartar sem querer o que já foi preenchido é o erro mais caro aqui. */}
        <InkButton variant="outline" onClick={() => (dirty ? setConfirming(true) : onCancel())}>
          Cancelar
        </InkButton>
        <InkButton type="submit" variant="accent" disabled={pending || disabled}>
          {pending ? pendingLabel : submitLabel}
        </InkButton>
      </div>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Descartar o que você preencheu?</AlertDialogTitle>
            <AlertDialogDescription>
              Você tem campos preenchidos. Se sair agora, eles se perdem.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar preenchendo</AlertDialogCancel>
            <AlertDialogAction onClick={onCancel}>Descartar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Identificação ─────────────────────────────────────────────────────

export function IdentificationSection({
  identity,
  registration,
  onRegistration,
  editableRegistration,
  error,
}: {
  identity: Identity;
  registration: string;
  onRegistration: (v: string) => void;
  editableRegistration: boolean;
  error?: string;
}) {
  return (
    <FormSection title="Identificação" divider={false}>
      <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
        <TextInput label="Nome completo" value={identity.name} readOnly />
        <TextInput
          label="Matrícula"
          placeholder="0000"
          className="tabular-nums"
          value={registration}
          onChange={(e) => onRegistration(e.target.value)}
          readOnly={!editableRegistration}
          error={error}
        />
        <TextInput label="Setor" value={identity.department || "—"} readOnly />
        <TextInput label="Gestor imediato" value={identity.manager_name || "—"} readOnly />
      </div>
      <p className="mt-3 text-xs leading-[1.5] text-muted-foreground">
        Esses dados vêm do seu cadastro. Se algum estiver errado, corrija pela{" "}
        <Link
          to="/formularios/$slug"
          params={{ slug: "atualizacao-cadastral" }}
          className="font-bold text-primary hover:underline"
        >
          Atualização Cadastral
        </Link>
        .
      </p>
    </FormSection>
  );
}
