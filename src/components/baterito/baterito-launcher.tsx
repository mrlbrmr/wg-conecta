import { useCallback, useEffect, useRef, useState } from "react";
import { useRouteContext } from "@tanstack/react-router";
import { BateritoFab } from "./baterito-fab";
import { BateritoPanel } from "./baterito-panel";
import { useBateritoChat } from "./use-baterito-chat";

/** Liga o `aria-controls` do FAB ao painel. */
const PANEL_ID = "baterito-panel";

/** Abaixo de `lg` o portal mostra a nav inferior e o painel vira folha inteira. */
const SHEET_QUERY = "(max-width: 1023.98px)";

function useFullSheet() {
  const [full, setFull] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia(SHEET_QUERY);
    const sync = () => setFull(mql.matches);
    sync();
    mql.addEventListener("change", sync);
    return () => mql.removeEventListener("change", sync);
  }, []);
  return full;
}

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Assistente Baterito. Montado no layout do portal do colaborador — o painel
 * administrativo vive em outra árvore de rotas e nunca passa por aqui.
 */
export function BateritoLauncher() {
  // Usuário autenticado, não o registro em `employees`: nem todo mundo que entra
  // no portal tem ficha no diretório, e a conversa precisa de chave mesmo assim.
  const userId = useRouteContext({ from: "/_portal", select: (c) => c.user.id });
  const chat = useBateritoChat(userId);
  const fullSheet = useFullSheet();
  const [open, setOpen] = useState(false);
  const fabRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  /** Só devolve o foco ao FAB se o fechamento partiu do painel. */
  const returnFocus = useRef(false);

  const close = useCallback(() => {
    returnFocus.current = true;
    setOpen(false);
  }, []);

  // Dispensar o badge é efeito colateral e fica fora do updater de estado, que
  // o React pode chamar mais de uma vez.
  const toggle = useCallback(() => {
    setOpen((prev) => !prev);
    if (!open) chat.dismissBadge();
  }, [chat, open]);

  // Esc fecha de qualquer lugar; no mobile o Tab fica preso no painel, que é modal.
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        close();
        return;
      }
      if (e.key !== "Tab" || !fullSheet) return;
      const panel = panelRef.current;
      if (!panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !panel.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, fullSheet, close]);

  // Folha inteira cobre a página: trava a rolagem de fundo enquanto está aberta.
  useEffect(() => {
    if (!open || !fullSheet) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open, fullSheet]);

  // Fechou pelo ✕ ou pelo Esc: o foco volta para o FAB, não para o início da página.
  useEffect(() => {
    if (open || !returnFocus.current) return;
    returnFocus.current = false;
    fabRef.current?.focus();
  }, [open]);

  return (
    <>
      {open && (
        <BateritoPanel
          ref={panelRef}
          id={PANEL_ID}
          messages={chat.messages}
          typing={chat.typing}
          busy={chat.busy}
          fullSheet={fullSheet}
          onSend={chat.send}
          onRetry={chat.retry}
          onReset={chat.reset}
          onClose={close}
        />
      )}
      <BateritoFab
        ref={fabRef}
        panelId={PANEL_ID}
        open={open}
        showBadge={chat.hasBadge}
        onToggle={toggle}
      />
    </>
  );
}
