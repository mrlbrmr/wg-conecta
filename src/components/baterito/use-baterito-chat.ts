import { useCallback, useEffect, useRef, useState } from "react";
import { askBaterito } from "@/lib/baterito/client";
import { BATERITO_COPY } from "@/lib/baterito/copy";
import type { BateritoMessage } from "@/lib/baterito/types";

const STORE_PREFIX = "wg-baterito";
const MAX_STORED = 60;

function conversationKey(userId: string) {
  return `${STORE_PREFIX}:${userId}`;
}
function badgeKey(userId: string) {
  return `${STORE_PREFIX}:badge:${userId}`;
}

function greetingMessage(): BateritoMessage {
  return { id: newId(), role: "bot", text: BATERITO_COPY.greeting };
}

function newId() {
  return Math.random().toString(36).slice(2, 11);
}

function readStored(userId: string | undefined): BateritoMessage[] | null {
  if (!userId) return null;
  try {
    const raw = localStorage.getItem(conversationKey(userId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    // Descarta qualquer coisa que não tenha a forma esperada — a chave é do usuário.
    const clean = parsed.filter(
      (m): m is BateritoMessage =>
        typeof m === "object" &&
        m !== null &&
        typeof (m as BateritoMessage).text === "string" &&
        ((m as BateritoMessage).role === "bot" || (m as BateritoMessage).role === "user"),
    );
    return clean.length > 0 ? clean : null;
  } catch {
    return null;
  }
}

/**
 * Estado da conversa com o Baterito.
 *
 * A conversa vive no `localStorage`, uma chave por colaborador, e sobrevive a
 * troca de rota e a reload. O painel, esse sim, abre sempre fechado.
 */
export function useBateritoChat(userId: string | undefined) {
  const [messages, setMessages] = useState<BateritoMessage[]>([greetingMessage()]);
  /** Indicador de digitação: sai de cena no primeiro pedaço do stream. */
  const [typing, setTyping] = useState(false);
  /** Resposta em andamento: continua verdadeiro enquanto o texto ainda chega. */
  const [busy, setBusy] = useState(false);
  const [hasBadge, setHasBadge] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const pending = useRef<AbortController | null>(null);
  /** Última pergunta do usuário, para o "Tentar de novo" não duplicar a bolha dela. */
  const lastQuestion = useRef<string | null>(null);

  // Carrega a conversa quando o colaborador é conhecido.
  useEffect(() => {
    if (!userId) return;
    const stored = readStored(userId);
    if (stored) setMessages(stored);
    try {
      setHasBadge(localStorage.getItem(badgeKey(userId)) !== "seen");
    } catch {
      setHasBadge(true);
    }
    setHydrated(true);
  }, [userId]);

  // Salva a cada mudança, depois de hidratar (senão o estado inicial sobrescreve).
  useEffect(() => {
    if (!userId || !hydrated) return;
    try {
      localStorage.setItem(conversationKey(userId), JSON.stringify(messages.slice(-MAX_STORED)));
    } catch {
      // Cota cheia ou storage bloqueado: a conversa segue só em memória.
    }
  }, [messages, userId, hydrated]);

  useEffect(() => () => pending.current?.abort(), []);

  const dismissBadge = useCallback(() => {
    setHasBadge(false);
    if (!userId) return;
    try {
      localStorage.setItem(badgeKey(userId), "seen");
    } catch {
      // sem persistência: o badge volta no próximo reload, e tudo bem
    }
  }, [userId]);

  const ask = useCallback(async (question: string, history: BateritoMessage[]) => {
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setTyping(true);

    // A bolha do bot só nasce no primeiro pedaço de texto: até lá, o que o
    // colaborador vê é o indicador de digitação.
    const replyId = newId();
    // O updater precisa ser puro: em modo estrito o React o chama duas vezes, e
    // uma flag de closure aqui dentro faria a bolha nascer e sumir no mesmo
    // ciclo. A presença do id na lista é o próprio "já criei".
    const paint = (partial: string) => {
      setMessages((prev) =>
        prev.some((m) => m.id === replyId)
          ? prev.map((m) => (m.id === replyId ? { ...m, text: partial } : m))
          : [...prev, { id: replyId, role: "bot", text: partial }],
      );
      setTyping(false);
    };

    try {
      const res = await askBaterito({
        message: question,
        history,
        signal: controller.signal,
        onDelta: paint,
      });
      setMessages((prev) =>
        prev.map((m) =>
          m.id === replyId ? { ...m, text: res.answer, source: res.sources[0] } : m,
        ),
      );
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setMessages((prev) => [
        // Um stream que morreu no meio deixa uma bolha pela metade: some com ela.
        ...prev.filter((m) => m.id !== replyId),
        { id: newId(), role: "bot", text: BATERITO_COPY.errorText, failed: true },
      ]);
    } finally {
      if (pending.current === controller) {
        pending.current = null;
        setTyping(false);
        setBusy(false);
      }
    }
  }, []);

  /** Envia uma pergunta nova. Ignora vazio e ignora com resposta em curso. */
  const send = useCallback(
    (raw: string) => {
      const question = raw.trim();
      if (!question || busy) return;
      lastQuestion.current = question;
      const history = messages;
      setMessages((prev) => [...prev, { id: newId(), role: "user", text: question }]);
      void ask(question, history);
    },
    [ask, busy, messages],
  );

  /** Reenvia a última pergunta, trocando a bolha de erro pela resposta. */
  const retry = useCallback(() => {
    const question = lastQuestion.current;
    if (!question || busy) return;
    const history = messages.filter((m) => !m.failed);
    setMessages(history);
    void ask(question, history);
  }, [ask, busy, messages]);

  /** Volta ao estado inicial: só a saudação. */
  const reset = useCallback(() => {
    pending.current?.abort();
    pending.current = null;
    lastQuestion.current = null;
    setTyping(false);
    setBusy(false);
    setMessages([greetingMessage()]);
  }, []);

  return { messages, typing, busy, hasBadge, dismissBadge, send, retry, reset };
}
