import { Slot } from "@radix-ui/react-slot";
import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";

export type PaperTone = "paper" | "soft" | "ink" | "accent" | "primary";

/** Casca comum: borda de tinta 1.5px, raio de papel e sombra offset sólida. */
const SHELL =
  "rounded-lg border-[1.5px] border-ink shadow-paper transition-[transform,box-shadow] duration-[120ms] ease-standard";

const TONE: Record<PaperTone, string> = {
  paper: `${SHELL} bg-surface text-ink`,
  ink: `${SHELL} bg-ink text-paper`,
  accent: `${SHELL} bg-accent text-ink`,
  primary: `${SHELL} bg-primary text-primary-foreground`,
  // variante leve para listas densas: borda cinza e sombra difusa
  soft: "card-soft text-ink transition-[transform,box-shadow] duration-[120ms] ease-standard",
};

const HOVER: Record<PaperTone, string> = {
  paper: "hover:-translate-x-px hover:-translate-y-px hover:shadow-elevated",
  ink: "hover:-translate-x-px hover:-translate-y-px hover:shadow-elevated",
  accent: "hover:-translate-x-px hover:-translate-y-px hover:shadow-elevated",
  primary: "hover:-translate-x-px hover:-translate-y-px hover:shadow-elevated",
  soft: "hover:border-primary/40 hover:shadow-elevated",
};

export interface PaperCardProps extends ComponentPropsWithoutRef<"div"> {
  tone?: PaperTone;
  /** Cartões informativos (sem clique) desligam o hover — padrão do handoff. */
  hover?: boolean;
  /** Renderiza no elemento filho (útil para `<Link>` e `<a>`). */
  asChild?: boolean;
}

export function PaperCard({
  tone = "paper",
  hover = false,
  asChild = false,
  className,
  ...props
}: PaperCardProps) {
  const Comp = asChild ? Slot : "div";
  return <Comp className={cn(TONE[tone], hover && HOVER[tone], className)} {...props} />;
}
