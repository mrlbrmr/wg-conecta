import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";

export type BubbleSize = 32 | 36 | 40 | 44 | 48;
/** `done` = tinta com glifo verde · `doing` = verde com glifo tinta · `todo` = papel rebaixado. */
export type BubbleState = "done" | "doing" | "todo";

const SIZE: Record<BubbleSize, string> = {
  32: "h-8 w-8 rounded-[9px] [&_svg]:h-4 [&_svg]:w-4",
  36: "h-9 w-9 rounded-[10px] [&_svg]:h-[18px] [&_svg]:w-[18px]",
  40: "h-10 w-10 rounded-[11px] [&_svg]:h-5 [&_svg]:w-5",
  44: "h-11 w-11 rounded-xl [&_svg]:h-5 [&_svg]:w-5",
  48: "h-12 w-12 rounded-xl [&_svg]:h-[22px] [&_svg]:w-[22px]",
};

const STATE: Record<BubbleState, string> = {
  done: "bg-ink text-accent",
  doing: "bg-accent text-ink",
  todo: "bg-surface-muted text-muted-foreground",
};

export interface IconBubbleProps extends ComponentPropsWithoutRef<"div"> {
  size?: BubbleSize;
  state?: BubbleState;
}

/** Bolha de ícone do portal interno: fundo tinta, glifo verde elétrico. */
export function IconBubble({ size = 40, state = "done", className, ...props }: IconBubbleProps) {
  return (
    <div
      className={cn("grid shrink-0 place-items-center", SIZE[size], STATE[state], className)}
      {...props}
    />
  );
}
