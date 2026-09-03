import { forwardRef, useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowRight, RotateCcw, X } from "lucide-react";
import { BATERITO_COPY, BATERITO_SUGGESTIONS } from "@/lib/baterito/copy";
import type { BateritoMessage } from "@/lib/baterito/types";
import { BateritoAvatar } from "./baterito-avatar";
import { MessageBubble } from "./message-bubble";
import { TypingIndicator } from "./typing-indicator";
import { cn } from "@/lib/utils";

const HEADER_BUTTON =
  "inline-flex size-8 flex-none items-center justify-center rounded-full border-[1.5px] border-paper/35 bg-transparent text-paper cursor-pointer transition-colors hover:bg-paper/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent";

interface BateritoPanelProps {
  /** Id do elemento: o FAB aponta para ele com `aria-controls`. */
  id: string;
  messages: BateritoMessage[];
  /** Indicador de digitação: some no primeiro pedaço do stream. */
  typing: boolean;
  /** Resposta em andamento: bloqueia novo envio até o texto terminar. */
  busy: boolean;
  /** Folha inteira, abaixo de `lg` — aí o painel é modal de fato. */
  fullSheet: boolean;
  onSend: (text: string) => void;
  onRetry: () => void;
  onReset: () => void;
  onClose: () => void;
}

export const BateritoPanel = forwardRef<HTMLDivElement, BateritoPanelProps>(function BateritoPanel(
  { id, messages, typing, busy, fullSheet, onSend, onRetry, onReset, onClose },
  ref,
) {
  const [draft, setDraft] = useState("");
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const showSuggestions = messages.length < 3 && !busy;

  // O log acompanha sempre a última mensagem — e o indicador de digitação.
  // Exceção: numa conversa nova (só a saudação), o topo é o que interessa —
  // os chips de sugestão empurrariam a saudação para fora da vista.
  useEffect(() => {
    const el = logRef.current;
    if (!el) return;
    el.scrollTop = messages.length <= 1 ? 0 : el.scrollHeight;
  }, [messages, typing]);

  // Foco no input ao abrir: quem clicou no FAB quer digitar.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy || !draft.trim()) return;
    onSend(draft);
    setDraft("");
  }

  function handleSuggestion(text: string) {
    if (busy) return;
    onSend(text);
    setDraft("");
    inputRef.current?.focus();
  }

  function handleReset() {
    onReset();
    setDraft("");
    inputRef.current?.focus();
  }

  return (
    <div
      ref={ref}
      id={id}
      role="dialog"
      aria-modal={fullSheet || undefined}
      aria-label={BATERITO_COPY.panelLabel}
      data-baterito
      className={cn(
        "fixed z-[60] flex flex-col overflow-hidden border-[1.5px] border-ink bg-surface",
        "animate-bat-in",
        fullSheet
          ? "inset-0"
          : [
              "bottom-[104px] right-6 rounded-lg shadow-[6px_7px_0_var(--ink)]",
              "w-[396px] max-w-[calc(100vw-48px)] h-[min(578px,calc(100vh-148px))]",
            ],
      )}
      style={{ "--bat-in-duration": "320ms" } as React.CSSProperties}
    >
      {/* Header */}
      <div className="flex flex-none items-center gap-3 border-b-[1.5px] border-ink bg-ink px-4 py-3.5 text-paper">
        {/* Decorativo: o nome vem escrito logo ao lado. */}
        <BateritoAvatar size={44} image={38} className="rounded-xl bg-accent" />
        <div className="min-w-0 flex-1">
          <span className="block text-[9px] font-extrabold uppercase tracking-[0.2em] text-accent">
            {BATERITO_COPY.headerKicker}
          </span>
          <span className="flex items-center gap-[7px] text-[17px] font-black leading-[1.25] tracking-[-0.03em]">
            {BATERITO_COPY.headerName}
            <span className="inline-flex items-center gap-[5px] text-[10px] font-bold uppercase tracking-[0.08em] text-paper/70">
              <span className="size-[7px] rounded-full bg-accent" aria-hidden />
              {BATERITO_COPY.headerStatus}
            </span>
          </span>
        </div>
        <button
          type="button"
          onClick={handleReset}
          aria-label={BATERITO_COPY.resetLabel}
          title={BATERITO_COPY.resetLabel}
          className={HEADER_BUTTON}
        >
          <RotateCcw className="size-4" aria-hidden />
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label={BATERITO_COPY.closeLabel}
          title={BATERITO_COPY.closeLabel}
          className={HEADER_BUTTON}
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>

      {/* Log de mensagens */}
      <div
        ref={logRef}
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        className="flex flex-1 flex-col gap-3.5 overflow-y-auto overflow-x-hidden bg-paper bg-paper-dots px-4 py-[18px]"
      >
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} onRetry={onRetry} />
        ))}

        {typing && <TypingIndicator />}

        {showSuggestions && (
          <div className="mt-1 max-w-full pl-10">
            <div className="text-[9px] font-extrabold uppercase tracking-[0.18em] text-muted-foreground">
              {BATERITO_COPY.suggestionsLabel}
            </div>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {BATERITO_SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleSuggestion(s)}
                  className="cursor-pointer rounded-full border-[1.5px] border-ink bg-surface px-3 py-2 text-[12.5px] font-bold transition-colors duration-[120ms] ease-[var(--ease-standard)] hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="flex-none border-t-[1.5px] border-ink bg-surface px-3.5 pb-2.5 pt-3">
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={busy}
            placeholder={BATERITO_COPY.inputPlaceholder}
            aria-label={BATERITO_COPY.inputLabel}
            className="min-w-0 flex-1 rounded-full border-[1.5px] border-ink bg-paper px-3.5 py-[11px] text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={busy}
            aria-label={BATERITO_COPY.sendLabel}
            data-bat-lift
            className="inline-flex size-[42px] flex-none cursor-pointer items-center justify-center rounded-full border-[1.5px] border-ink bg-ink text-accent transition-transform duration-[120ms] ease-[var(--ease-standard)] hover:-translate-y-px focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
          >
            <ArrowRight className="size-4" aria-hidden />
          </button>
        </form>
        <p className="mx-0.5 mt-[9px] text-[10.5px] leading-[1.5] text-muted-foreground">
          {BATERITO_COPY.disclaimer}
        </p>
      </div>
    </div>
  );
});
