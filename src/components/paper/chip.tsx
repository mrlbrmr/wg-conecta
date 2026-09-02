import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";

export type ChipTone = "ink" | "accent" | "soft" | "success";

const TONE: Record<ChipTone, string> = {
  ink: "chip",
  accent: "chip-accent",
  soft: "chip-soft",
  success: "chip-success",
};

export interface ChipProps extends ComponentPropsWithoutRef<"span"> {
  tone?: ChipTone;
}

export function Chip({ tone = "ink", className, ...props }: ChipProps) {
  return <span className={cn(TONE[tone], className)} {...props} />;
}
