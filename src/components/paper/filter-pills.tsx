import { cn } from "@/lib/utils";

export interface FilterPillsProps<T extends string> {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  /** Rótulo fixo à esquerda (usado nos filtros de Vagas). */
  label?: string;
  className?: string;
}

/** Pílulas de filtro: ativa em tinta com texto verde elétrico. */
export function FilterPills<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: FilterPillsProps<T>) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {label && (
        <span className="w-[72px] shrink-0 text-[10px] font-extrabold uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </span>
      )}
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "rounded-full border-[1.5px] border-ink px-3.5 py-2 text-xs font-extrabold uppercase tracking-[0.04em] transition-colors duration-[120ms] ease-standard",
              active ? "bg-ink text-accent" : "bg-surface text-ink hover:bg-accent-soft",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
