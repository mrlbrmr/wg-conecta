import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Kicker } from "./kicker";

export interface PageHeadingProps {
  kicker: ReactNode;
  /** Frase completa, capitalizada, quase sempre com ponto final. */
  title: ReactNode;
  subtitle?: ReactNode;
  /** Ação alinhada ao fim do cabeçalho (botão, contador, par dos dois). */
  action?: ReactNode;
  className?: string;
}

/**
 * Cabeçalho editorial repetido pelas telas do portal:
 * kicker → manchete → subtítulo, fechado por uma régua de tinta.
 */
export function PageHeading({ kicker, title, subtitle, action, className }: PageHeadingProps) {
  return (
    <header className={cn("border-b-[1.5px] border-ink pb-7", className)}>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="min-w-0 flex-1">
          <Kicker>{kicker}</Kicker>
          <h1 className="mt-3 text-[34px] font-black leading-[0.98] tracking-[-0.045em] text-balance sm:text-[44px] lg:text-[56px]">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-4 max-w-[56ch] text-base leading-[1.7] text-muted-foreground text-pretty">
              {subtitle}
            </p>
          )}
        </div>
        {action && <div className="flex shrink-0 flex-wrap items-center gap-3">{action}</div>}
      </div>
    </header>
  );
}

/**
 * Assinatura tipográfica do portal — itálico em verde institucional.
 * No máximo uma por tela.
 */
export function Signature({ children }: { children: ReactNode }) {
  return <span className="italic text-primary">{children}</span>;
}
