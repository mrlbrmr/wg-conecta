import { forwardRef, useState } from "react";
import { BATERITO_COPY } from "@/lib/baterito/copy";
import { BATERITO_IMG } from "./baterito-avatar";
import { cn } from "@/lib/utils";

interface BateritoFabProps {
  /** Painel que este botão controla, para o `aria-controls`. */
  panelId: string;
  open: boolean;
  showBadge: boolean;
  onToggle: () => void;
}

/**
 * Ponto de entrada permanente do assistente.
 * O balão de convite aparece no hover e também no foco de teclado — quem navega
 * de Tab precisa da mesma dica de quem passa o mouse.
 */
export const BateritoFab = forwardRef<HTMLButtonElement, BateritoFabProps>(function BateritoFab(
  { panelId, open, showBadge, onToggle },
  ref,
) {
  const [near, setNear] = useState(false);
  const showHint = near && !open;

  return (
    <div
      className={cn(
        "fixed right-6 z-[60] flex items-center gap-3",
        // No mobile o FAB se apoia na nav inferior; no desktop, na margem de 24px.
        "bottom-[calc(var(--portal-mobile-nav)+1rem)] lg:bottom-6",
        // Painel em folha inteira cobre a tela no mobile: o FAB sai de cena.
        open && "max-lg:hidden",
      )}
    >
      {showHint && (
        <span className="animate-bat-in whitespace-nowrap rounded-full border-[1.5px] border-ink bg-ink px-[15px] py-[9px] text-[13px] font-bold text-paper shadow-[2px_3px_0_var(--accent)]">
          {BATERITO_COPY.fabHintPrefix}
          <span className="text-accent">{BATERITO_COPY.fabHintName}</span>
        </span>
      )}

      <button
        ref={ref}
        type="button"
        onClick={onToggle}
        onMouseEnter={() => setNear(true)}
        onMouseLeave={() => setNear(false)}
        onFocus={() => setNear(true)}
        onBlur={() => setNear(false)}
        aria-label={open ? BATERITO_COPY.fabLabelClose : BATERITO_COPY.fabLabel}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        data-bat-lift
        className={[
          "relative flex size-[72px] items-end justify-center overflow-hidden rounded-full",
          "border-[1.5px] border-ink bg-accent p-0 cursor-pointer",
          "shadow-[3px_4px_0_var(--ink)] transition-[transform,box-shadow] duration-[140ms] ease-[var(--ease-standard)]",
          "hover:-translate-x-px hover:-translate-y-0.5 hover:shadow-[5px_6px_0_var(--ink)]",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        ].join(" ")}
      >
        <img
          src={BATERITO_IMG}
          alt=""
          aria-hidden
          className="size-[62px] translate-y-0.5 object-contain object-bottom"
        />
        {showBadge && (
          <span className="absolute right-[5px] top-1 inline-flex size-5 items-center justify-center rounded-full border-[1.5px] border-accent bg-ink text-[11px] font-extrabold text-accent">
            {BATERITO_COPY.badgeCount}
          </span>
        )}
      </button>
    </div>
  );
});
