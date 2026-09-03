import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { BATERITO_COPY } from "@/lib/baterito/copy";
import type { BateritoMessage, BateritoSource } from "@/lib/baterito/types";
import { BateritoAvatar } from "./baterito-avatar";

interface MessageBubbleProps {
  message: BateritoMessage;
  onRetry: () => void;
}

export function MessageBubble({ message, onRetry }: MessageBubbleProps) {
  if (message.role === "user") return <UserBubble text={message.text} />;
  return <BotBubble message={message} onRetry={onRetry} />;
}

function UserBubble({ text }: { text: string }) {
  return (
    <div
      className="flex justify-end animate-bat-in"
      style={{ "--bat-in-duration": "220ms" } as React.CSSProperties}
    >
      <p className="max-w-[80%] rounded-lg border-[1.5px] border-ink bg-ink px-3.5 py-[11px] text-sm font-semibold leading-[1.6] text-paper">
        {text}
      </p>
    </div>
  );
}

function BotBubble({ message, onRetry }: MessageBubbleProps) {
  return (
    <div className="flex items-end gap-2.5 animate-bat-in">
      <BateritoAvatar size={30} image={24} className="rounded-[9px] bg-wg-green" />
      <div className="max-w-[80%] rounded-lg border-[1.5px] border-ink bg-surface px-3.5 py-3 shadow-[2px_3px_0_var(--ink)]">
        <p className="whitespace-pre-line text-sm leading-[1.65]">{message.text}</p>
        {message.source && <SourceBlock source={message.source} />}
        {message.failed && (
          <button
            type="button"
            onClick={onRetry}
            className="btn-outline mt-3 cursor-pointer px-3 py-1.5 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {BATERITO_COPY.retryLabel}
          </button>
        )}
      </div>
    </div>
  );
}

function SourceBlock({ source }: { source: BateritoSource }) {
  const internal = source.url.startsWith("/");
  const label = (
    <>
      {source.title}
      <ArrowUpRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
    </>
  );
  const className =
    "inline-flex items-center gap-1 text-[13px] font-bold text-primary hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

  return (
    <div className="mt-3 flex items-center gap-2 border-t border-dashed border-border pt-2.5">
      <span className="text-[9px] font-extrabold uppercase tracking-[0.16em] text-muted-foreground">
        {BATERITO_COPY.sourceLabel}
      </span>
      {internal ? (
        // `as "/"` é o mesmo escape usado nos atalhos do mural: a rota vem do banco.
        <Link to={source.url as "/"} className={className}>
          {label}
        </Link>
      ) : (
        <a href={source.url} target="_blank" rel="noreferrer" className={className}>
          {label}
        </a>
      )}
    </div>
  );
}
