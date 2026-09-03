import { Slot } from "@radix-ui/react-slot";
import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";

export type InkButtonVariant = "ink" | "outline" | "accent";

const VARIANT: Record<InkButtonVariant, string> = {
  ink: "btn-ink",
  outline: "btn-outline",
  accent: "btn-accent",
};

export interface InkButtonProps extends ComponentPropsWithoutRef<"button"> {
  variant?: InkButtonVariant;
  /** Renderiza no elemento filho (útil para `<Link>` e `<a>`). */
  asChild?: boolean;
}

/**
 * Botão do portal. Os rótulos nunca quebram em duas linhas (regra do handoff),
 * daí `whitespace-nowrap` e `shrink-0` fazerem parte da base.
 */
export function InkButton({
  variant = "ink",
  asChild = false,
  className,
  type,
  ...props
}: InkButtonProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      className={cn(
        VARIANT[variant],
        "shrink-0 whitespace-nowrap disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      {...(asChild ? {} : { type: type ?? "button" })}
      {...props}
    />
  );
}
