import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Kicker } from "./kicker";

export interface AdminPageHeaderProps {
  /** Seção do menu lateral ("Gente & Gestão", "Home"…). */
  section: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** Ação principal, alinhada à direita. */
  action?: ReactNode;
  className?: string;
}

/**
 * Cabeçalho das telas do painel: seção → título → descrição, fechado por uma régua de tinta.
 * Todas as telas do painel usam este, para ficarem com a mesma cara.
 */
export function AdminPageHeader({
  section,
  title,
  description,
  action,
  className,
}: AdminPageHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-wrap items-end justify-between gap-4 border-b-[1.5px] border-ink pb-5",
        className,
      )}
    >
      <div className="min-w-0">
        <Kicker>{section}</Kicker>
        <h1 className="mt-3 text-[28px] font-black leading-[1.02] tracking-[-0.045em] sm:text-[34px] lg:text-[42px]">
          {title}
        </h1>
        {description && (
          <p className="mt-3 max-w-[60ch] text-[15.5px] leading-[1.7] text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {action && <div className="flex shrink-0 flex-wrap items-center gap-3">{action}</div>}
    </header>
  );
}
