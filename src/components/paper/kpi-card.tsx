import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { PaperCard } from "./paper-card";

export interface KpiCardProps {
  label: string;
  value: ReactNode;
  note?: ReactNode;
  /** `lg` é o KPI de topo de seção (56px); `sm` é o da grade 2×2 do dashboard (34px). */
  size?: "lg" | "sm";
  className?: string;
}

/** KPI do padrão administrativo. Sem emoji — o do Painel RH é legado. */
export function KpiCard({ label, value, note, size = "lg", className }: KpiCardProps) {
  const big = size === "lg";
  return (
    <PaperCard
      tone={big ? "paper" : "soft"}
      className={cn(big ? "p-[26px]" : "p-[18px]", className)}
    >
      <div
        className={cn(
          "font-extrabold uppercase text-primary",
          big ? "text-[10px] tracking-[0.2em]" : "text-[9.5px] tracking-[0.16em]",
        )}
      >
        {label}
      </div>
      <div
        className={cn(
          "mt-2 font-black tabular-nums",
          big
            ? "text-[56px] leading-none tracking-[-0.05em]"
            : "text-[34px] leading-none tracking-[-0.04em]",
        )}
      >
        {value}
      </div>
      {note && (
        <div className={cn("mt-2 text-muted-foreground", big ? "text-[13px]" : "text-[11.5px]")}>
          {note}
        </div>
      )}
    </PaperCard>
  );
}
