import { useId, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Campos de formulário no visual papel-e-tinta.
 *
 * Até aqui cada tela repetia a classe do input à mão, em três variantes que já
 * tinham divergido. Estes componentes unificam a base — e acrescentam o anel de
 * foco, que faltava nas três (o handoff é explícito: o foco nunca some).
 */

/** Base compartilhada por input, select e textarea. */
export const FIELD_CONTROL =
  "w-full rounded-lg border-[1.5px] border-ink bg-surface px-3.5 py-3 text-[15px] outline-none " +
  "placeholder:text-muted-foreground/70 " +
  "focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-1 " +
  "disabled:cursor-not-allowed disabled:opacity-60 " +
  "aria-[invalid=true]:border-destructive";

interface FieldShellProps {
  label: ReactNode;
  /** Mensagem de erro do zod. Presente = campo inválido. */
  error?: string;
  hint?: ReactNode;
  className?: string;
  /** Renderiza o controle recebendo os ids de acessibilidade já ligados. */
  children: (props: {
    id: string;
    "aria-invalid": boolean;
    "aria-describedby": string | undefined;
  }) => ReactNode;
}

/** Rótulo + controle + erro, com os `aria-*` amarrados. */
export function Field({ label, error, hint, className, children }: FieldShellProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ");

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label htmlFor={id} className="text-[13px] font-bold">
        {label}
      </label>
      {children({
        id,
        "aria-invalid": Boolean(error),
        "aria-describedby": describedBy || undefined,
      })}
      {hint && (
        <p id={hintId} className="text-xs leading-[1.5] text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs font-semibold leading-[1.5] text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

export interface TextInputProps extends ComponentPropsWithoutRef<"input"> {
  label: ReactNode;
  error?: string;
  hint?: ReactNode;
  fieldClassName?: string;
}

export function TextInput({
  label,
  error,
  hint,
  fieldClassName,
  className,
  ...props
}: TextInputProps) {
  return (
    <Field label={label} error={error} hint={hint} className={fieldClassName}>
      {(a11y) => <input {...a11y} {...props} className={cn(FIELD_CONTROL, className)} />}
    </Field>
  );
}

export interface SelectInputProps extends ComponentPropsWithoutRef<"select"> {
  label: ReactNode;
  error?: string;
  hint?: ReactNode;
  fieldClassName?: string;
  options: readonly string[] | readonly { value: string; label: string }[];
  /** Primeira opção vazia, para o campo não começar já respondido. */
  placeholder?: string;
}

export function SelectInput({
  label,
  error,
  hint,
  fieldClassName,
  className,
  options,
  placeholder,
  ...props
}: SelectInputProps) {
  const items = options.map((o) => (typeof o === "string" ? { value: o, label: o } : o));
  return (
    <Field label={label} error={error} hint={hint} className={fieldClassName}>
      {(a11y) => (
        <select {...a11y} {...props} className={cn(FIELD_CONTROL, className)}>
          {placeholder && <option value="">{placeholder}</option>}
          {items.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}

export interface TextAreaProps extends ComponentPropsWithoutRef<"textarea"> {
  label: ReactNode;
  error?: string;
  hint?: ReactNode;
  fieldClassName?: string;
}

export function TextArea({
  label,
  error,
  hint,
  fieldClassName,
  className,
  ...props
}: TextAreaProps) {
  return (
    <Field label={label} error={error} hint={hint} className={fieldClassName}>
      {(a11y) => (
        <textarea
          {...a11y}
          {...props}
          className={cn(FIELD_CONTROL, "resize-y leading-[1.5]", className)}
        />
      )}
    </Field>
  );
}

// ── Chips de escolha ──────────────────────────────────────────────────

const CHIP_BASE =
  "rounded-full border-[1.5px] border-ink px-4 py-2 text-[13px] whitespace-nowrap cursor-pointer " +
  "transition-[background-color,color] duration-[120ms] ease-standard " +
  "focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-1";

const CHIP_ON = "bg-accent text-ink";
const CHIP_OFF = "bg-surface text-ink hover:bg-accent-soft";

export interface ChoiceChipsProps<T extends string> {
  label: ReactNode;
  options: readonly T[] | readonly { value: T; label: string }[];
  error?: string;
  hint?: ReactNode;
  className?: string;
}

export interface SingleChoiceChipsProps<T extends string> extends ChoiceChipsProps<T> {
  value: T | "";
  onChange: (value: T) => void;
}

/**
 * Escolha única (Sim/Não, urgência). Os chips do protótipo eram `<button>` sem
 * semântica nenhuma — aqui viram um radiogroup de verdade, que leitor de tela
 * anuncia como "1 de 3, selecionado".
 */
export function ChoiceChips<T extends string>({
  label,
  options,
  value,
  onChange,
  error,
  hint,
  className,
}: SingleChoiceChipsProps<T>) {
  const id = useId();
  const errorId = `${id}-error`;
  const items = options.map((o) =>
    typeof o === "string" ? { value: o as T, label: o as string } : o,
  );

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <span id={id} className="text-[13px] font-bold">
        {label}
      </span>
      <div
        role="radiogroup"
        aria-labelledby={id}
        aria-describedby={error ? errorId : undefined}
        aria-invalid={Boolean(error)}
        className="flex flex-wrap gap-2"
      >
        {items.map((o) => {
          const on = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(o.value)}
              className={cn(CHIP_BASE, "font-extrabold", on ? CHIP_ON : CHIP_OFF)}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      {hint && <p className="text-xs leading-[1.5] text-muted-foreground">{hint}</p>}
      {error && (
        <p id={errorId} className="text-xs font-semibold leading-[1.5] text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

export interface MultiChoiceChipsProps<T extends string> extends ChoiceChipsProps<T> {
  value: readonly T[];
  onChange: (value: T[]) => void;
}

/** Multisseleção ("O que mudou"). Cada chip é um botão de alternar. */
export function MultiChoiceChips<T extends string>({
  label,
  options,
  value,
  onChange,
  error,
  hint,
  className,
}: MultiChoiceChipsProps<T>) {
  const id = useId();
  const errorId = `${id}-error`;
  const items = options.map((o) =>
    typeof o === "string" ? { value: o as T, label: o as string } : o,
  );

  const toggle = (v: T) =>
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <span id={id} className="text-[13px] font-bold">
        {label}
      </span>
      <div
        role="group"
        aria-labelledby={id}
        aria-describedby={error ? errorId : undefined}
        className="flex flex-wrap gap-2.5"
      >
        {items.map((o) => {
          const on = value.includes(o.value);
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(o.value)}
              className={cn(CHIP_BASE, "font-bold", on ? CHIP_ON : CHIP_OFF)}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      {hint && <p className="text-xs leading-[1.5] text-muted-foreground">{hint}</p>}
      {error && (
        <p id={errorId} className="text-xs font-semibold leading-[1.5] text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

// ── Estrutura do formulário ───────────────────────────────────────────

/**
 * Bloco de campos com o kicker de seção. A partir da segunda seção vem um
 * divisor fino acima — é o que separa "Identificação" do corpo do formulário.
 */
export function FormSection({
  title,
  hint,
  divider = true,
  children,
}: {
  title: string;
  hint?: ReactNode;
  divider?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="px-6 pt-7 md:px-8">
      {divider && <div className="mb-6 h-px bg-border" />}
      <h2 className="text-[11.5px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground">
        {title}
      </h2>
      {hint && <p className="mt-2 text-[13.5px] leading-[1.55] text-muted-foreground">{hint}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}
