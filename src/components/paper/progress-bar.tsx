import { cn } from "@/lib/utils";

export interface ProgressBarProps {
  /** 0 a 100. Valores fora da faixa são fixados nos limites. */
  value: number;
  /** Cor do preenchimento. `accent` sobre papel, `ink` sobre cartão verde. */
  fill?: "accent" | "ink";
  /** Altura em px: 10 no admin, 12 no portal. */
  height?: 10 | 12;
  label?: string;
  className?: string;
}

export function ProgressBar({
  value,
  fill = "accent",
  height = 12,
  label,
  className,
}: ProgressBarProps) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div
      className={cn(
        "w-full overflow-hidden rounded-full border-[1.5px] border-ink",
        fill === "ink" ? "bg-ink/12" : "bg-surface-muted",
        height === 10 ? "h-2.5" : "h-3",
        className,
      )}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div
        className={cn(
          "h-full transition-[width] duration-[240ms] ease-standard",
          fill === "ink" ? "bg-ink" : "bg-accent",
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
