import { BATERITO_COPY } from "@/lib/baterito/copy";
import { BateritoAvatar } from "./baterito-avatar";

/** O Baterito andando enquanto pensa, com os três pontinhos. */
export function TypingIndicator() {
  return (
    <div className="flex items-end gap-2.5">
      <BateritoAvatar size={30} image={24} className="rounded-[9px] bg-ink" stepping />
      <div className="flex items-center gap-[5px] rounded-lg border-[1.5px] border-ink bg-surface p-3.5 shadow-[2px_3px_0_var(--ink)]">
        <span className="sr-only">{BATERITO_COPY.typingLabel}</span>
        {[0, 150, 300].map((delay) => (
          <span
            key={delay}
            aria-hidden
            className="size-1.5 rounded-full bg-ink animate-bat-dot"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </div>
    </div>
  );
}
