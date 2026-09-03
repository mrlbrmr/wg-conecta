import type { ComponentPropsWithoutRef, CSSProperties } from "react";
import { cn } from "@/lib/utils";

export interface KickerProps extends ComponentPropsWithoutRef<"span"> {
  /**
   * Cor do rótulo e do traço. Padrão: verde institucional.
   * Em cartões `tone="ink"` use `var(--color-accent)`.
   */
  color?: string;
}

export function Kicker({ color, className, style, ...props }: KickerProps) {
  return (
    <span
      className={cn("kicker", className)}
      style={color ? ({ "--kicker-color": color, ...style } as CSSProperties) : style}
      {...props}
    />
  );
}
