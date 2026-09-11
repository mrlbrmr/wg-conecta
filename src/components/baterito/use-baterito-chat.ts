import { useCallback, useEffect, useRef, useState } from "react";
import { askBaterito } from "@/lib/baterito/client";
import { BATERITO_COPY } from "@/lib/baterito/copy";
import type { BateritoMessage } from "@/lib/baterito/types";
import { BATERITO_STORE_PREFIX as STORE_PREFIX } from "@/lib/session";

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

/**
 * A conversa ficava no `localStorage` e sobrevivia no computador. Agora vive só
 * na aba (`sessionStorage`); isto apaga o que as versões antigas deixaram
 * gravado. O badge não tem conteúdo e continua no `localStorage`.
 */
function purgeLegacyConversations() {
  try {
    const doomed: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(`${STORE_PREFIX}:`) && !key.startsWith(`${STORE_PREFIX}:badge:`)) {
        doomed.push(key);
      }
    }
    for (const key of doomed) localStorage.removeItem(key);
  } catch {
    // storage bloqueado: não há o que limpar
  }
}

function readStored(userId: string | undefined): BateritoMessage[] | null {
  if (!userId) return null;
  try {
    const raw = sessionStorage.getItem(conversationKey(userId));
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

/** Uma conversa sempre sabe de quem é — é isso que impede gravá-la na chave errada. */
interface Conversation {
  owner: string | undefined;
  messages: BateritoMessage[];
}

type MessagesUpdate = BateritoMessage[] | ((prev: BateritoMessage[]) => BateritoMessage[]);

/**
 * Estado da conversa com o Baterito.
 *
 * A conversa vive no `sessionStorage`, uma chave por colaborador: sobrevive a
 * troca de rota e a reload, e some quando a aba fecha ou a pessoa sai. O
 * painel, esse sim, abre sempre fechado.
 *
 * O layout do portal não desmonta quando a conta muda (login em outra aba, por
 * exemplo), então a troca de `userId` zera tudo antes de ler a nova chave. A
 * versão anterior mantinha as mensagens de quem saiu na tela e as gravava na
 * chave de quem entrou.
 */
export function useBateritoChat(userId: string | undefined) {
  const [conversation, setConversation] = useState<Conversation>(() => ({
    owner: undefined,
    messages: [greetingMessage()],
  }));
  const messages = conversation.messages;
  /** Indicador de digitação: sai de cena no primeiro pedaço do stream. */
  const [typing, setTyping] = useState(false);
  /** Resposta em andamento: continua verdadeiro enquanto o texto ainda chega. */
  const [busy, setBusy] = useState(false);
  const [hasBadge, setHasBadge] = useState(false);
  const pending = useRef<AbortController | null>(null);
  /** Última pergunta do usuário, para o "Tentar de novo" não duplicar a bolha dela. */
  const lastQuestion = useRef<string | null>(null);
  /** Dono atual, lido pelos callbacks assíncronos de uma resposta em curso. */
  const ownerRef = useRef<string | undefined>(undefined);

  /**
   * Atualiza as mensagens de `owner`. Se a conta mudou no meio de uma resposta,
   * a atualização é descartada: o texto de A nunca cai na conversa de B.
   */
  const updateMessages = useCallback((owner: string | undefined, update: MessagesUpdate) => {
    setConversation((prev) => {
      if (prev.owner !== owner) return prev;
      const next = typeof update === "function" ? update(prev.messages) : update;
      return { owner, messages: next };
    });
  }, []);

  // Carrega a conversa de quem está logado — e zera tudo quando a conta muda.
  useEffect(() => {
    pending.current?.abort();
    pending.current = null;
    lastQuestion.current = null;
    ownerRef.current = userId;
    setTyping(false);
    setBusy(false);

    if (!userId) {
      setConversation({ owner: undefined, messages: [greetingMessage()] });
      return;
    }

    purgeLegacyConversations();
    setConversation({ owner: userId, messages: readStored(userId) ?? [greetingMessage()] });
    try {
      setHasBadge(localStorage.getItem(badgeKey(userId)) !== "seen");
    } catch {
      setHasBadge(true);
    }
  }, [userId]);

  // Salva a cada mudança, sempre na chave do dono da conversa em memória.
  useEffect(() => {
    const { owner } = conversation;
    if (!owner || owner !== userId) return;
    try {
      sessionStorage.setItem(
        conversationKey(owner),
        JSON.stringify(conversation.messages.slice(-MAX_STORED)),
      );
    } catch {
      // Cota cheia ou storage bloqueado: a conversa segue só em memória.
    }
  }, [conversation, userId]);

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

  const ask = useCallback(
    async (question: string, history: BateritoMessage[]) => {
      pending.current?.abort();
      const controller = new AbortController();
      pending.current = controller;
      // Resposta presa ao dono de quem perguntou, não a quem estiver logado quando chegar.
      const owner = ownerRef.current;
      setBusy(true);
      setTyping(true);

      // A bolha do bot só nasce no primeiro pedaço de texto: até lá, o que o
      // colaborador vê é o indicador de digitação.
      const replyId = newId();
      // O updater precisa ser puro: em modo estrito o React o chama duas vezes, e
      // uma flag de closure aqui dentro faria a bolha nascer e sumir no mesmo
      // ciclo. A presença do id na lista é o próprio "já criei".
      const paint = (partial: string) => {
        updateMessages(owner, (prev) =>
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
        updateMessages(owner, (prev) =>
          prev.map((m) =>
            m.id === replyId ? { ...m, text: res.answer, source: res.sources[0] } : m,
          ),
        );
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        updateMessages(owner, (prev) => [
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
    },
    [updateMessages],
  );

  /** Envia uma pergunta nova. Ignora vazio e ignora com resposta em curso. */
  const send = useCallback(
    (raw: string) => {
      const question = raw.trim();
      if (!question || busy) return;
      lastQuestion.current = question;
      const history = messages;
      updateMessages(ownerRef.current, (prev) => [
        ...prev,
        { id: newId(), role: "user", text: question },
      ]);
      void ask(question, history);
    },
    [ask, busy, messages, updateMessages],
  );

  /** Reenvia a última pergunta, trocando a bolha de erro pela resposta. */
  const retry = useCallback(() => {
    const question = lastQuestion.current;
    if (!question || busy) return;
    const history = messages.filter((m) => !m.failed);
    updateMessages(ownerRef.current, history);
    void ask(question, history);
  }, [ask, busy, messages, updateMessages]);

  /** Volta ao estado inicial: só a saudação. */
  const reset = useCallback(() => {
    pending.current?.abort();
    pending.current = null;
    lastQuestion.current = null;
    setTyping(false);
    setBusy(false);
    updateMessages(ownerRef.current, [greetingMessage()]);
  }, [updateMessages]);

  return { messages, typing, busy, hasBadge, dismissBadge, send, retry, reset };
}
